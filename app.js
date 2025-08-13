// Global application state
const App = {
    data: {
        skus: [],
        aliases: {},
        history: [],
        settings: {},
        currentSync: null
    },
    
    // Initialize the application
    async init() {
        console.log('Initializing ShipStation QuickBooks Sync...');
        
        // Set default dates
        this.setDefaultDates();
        
        // Load data from database
        await this.loadData();
        
        // Update UI
        this.updateStats();
        this.updateConnectionStatus();
        this.renderSkuTable();
        this.renderHistory();
        
        console.log('Application initialized');
    },
    
    // Load all data from database
    async loadData() {
        try {
            console.log('Loading data from database...');
            const response = await fetch('/api/database-supabase?action=all');
            console.log('Database response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('Database data received:', data);
                
                this.data.skus = data.skus || [];
                this.data.aliases = data.aliases || {};
                this.data.history = data.history || [];
                this.data.settings = data.settings || {};
                
                console.log('App data updated:', {
                    skus: this.data.skus.length,
                    aliases: Object.keys(this.data.aliases).length,
                    history: this.data.history.length
                });
            } else {
                const errorText = await response.text();
                console.error('Failed to load data:', errorText);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.showNotification('Failed to load data', 'error');
        }
    },
    
    // Update dashboard statistics
    updateStats() {
        document.getElementById('totalSkus').textContent = this.data.skus.length;
        document.getElementById('totalAliases').textContent = Object.keys(this.data.aliases).length;
        
        const lastSync = this.data.history.find(h => h.type === 'sync');
        document.getElementById('lastSync').textContent = lastSync ? 
            this.formatDateTime(lastSync.timestamp) : 'Never';
        
        const lastExport = this.data.history.find(h => h.type === 'export');
        document.getElementById('lastExport').textContent = lastExport ? 
            this.formatDateTime(lastExport.timestamp) : 'Never';
    },
    
    // Update connection status indicator
    async updateConnectionStatus() {
        const statusEl = document.getElementById('connectionStatus');
        
        try {
            const response = await fetch('/api/test-shipstation');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    statusEl.className = 'status-indicator connected';
                    statusEl.innerHTML = '<i class="fas fa-circle"></i><span>Connected</span>';
                } else {
                    throw new Error(data.error || 'Connection failed');
                }
            } else {
                throw new Error('API unavailable');
            }
        } catch (error) {
            statusEl.className = 'status-indicator disconnected';
            statusEl.innerHTML = '<i class="fas fa-circle"></i><span>Disconnected</span>';
            console.error('Connection check failed:', error);
        }
    },
    
    // Set default date values
    setDefaultDates() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];
        
        document.getElementById('startDate').value = dateStr;
        document.getElementById('endDate').value = dateStr;
    },
    
    // Format date/time for display
    formatDateTime(isoString) {
        return new Date(isoString).toLocaleString();
    },
    
    // Show notification
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Add styles
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '6px',
            color: 'white',
            zIndex: '9999',
            fontSize: '14px',
            fontWeight: '500',
            maxWidth: '300px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            background: type === 'error' ? '#ef4444' : 
                       type === 'success' ? '#10b981' : 
                       type === 'warning' ? '#f59e0b' : '#2563eb'
        });
        
        document.body.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
};

// Tab Management
function showTab(tabName) {
    // Update nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[onclick="showTab('${tabName}')"]`).classList.add('active');
    
    // Update content sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    
    // Load tab-specific data
    if (tabName === 'inventory') {
        App.renderSkuTable();
    } else if (tabName === 'history') {
        App.renderHistory();
    }
}

// Modal Management
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    
    // Clear form inputs
    const modal = document.getElementById(modalId);
    modal.querySelectorAll('input, textarea').forEach(input => {
        input.value = '';
    });
}

// SKU Management Functions
async function importSkus() {
    const skuText = document.getElementById('skuImportText').value.trim();
    if (!skuText) {
        App.showNotification('Please paste your SKU list', 'error');
        return;
    }
    
    try {
        console.log('Starting SKU import...');
        App.showNotification('Processing large SKU import, please wait...', 'info');
        
        // Add timeout for large imports
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout
        
        const response = await fetch('/api/database-supabase?action=import-skus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skuText }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        console.log('Import response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('Import result:', result);
            
            App.showNotification(
                `Imported ${result.imported} SKUs (${result.duplicates} duplicates skipped)`, 
                'success'
            );
            
            // Force reload data and update UI
            console.log('Reloading data...');
            await App.loadData();
            console.log('Updated data:', App.data);
            
            App.updateStats();
            App.renderSkuTable();
            
            // Switch to inventory tab to show the results
            showTab('inventory');
            closeModal('importModal');
        } else {
            const errorText = await response.text();
            console.error('Import failed:', errorText);
            throw new Error('Import failed: ' + response.status);
        }
    } catch (error) {
        console.error('Import error:', error);
        if (error.name === 'AbortError') {
            App.showNotification('Import timed out. Try with a smaller batch or contact support.', 'error');
        } else if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
            App.showNotification('Network error during import. Please check your connection and try again.', 'error');
        } else {
            App.showNotification('Failed to import SKUs: ' + error.message, 'error');
        }
    }
}

async function addSku() {
    const name = document.getElementById('newSkuName').value.trim();
    const category = document.getElementById('newSkuCategory').value.trim();
    
    if (!name) {
        App.showNotification('Please enter a SKU name', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/database-supabase?action=add-sku', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, category })
        });
        
        if (response.ok) {
            App.showNotification('SKU added successfully', 'success');
            
            // Reload data and update UI
            await App.loadData();
            App.updateStats();
            App.renderSkuTable();
            closeModal('addSkuModal');
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add SKU');
        }
    } catch (error) {
        console.error('Add SKU error:', error);
        App.showNotification(error.message || 'Failed to add SKU', 'error');
    }
}

async function addAlias() {
    const shipstationSku = document.getElementById('aliasShipstationSku').value.trim();
    const quickbooksSku = document.getElementById('aliasQuickbooksSku').value.trim();
    
    if (!shipstationSku || !quickbooksSku) {
        App.showNotification('Please enter both SKUs', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/database-supabase?action=add-alias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shipstationSku, quickbooksSku })
        });
        
        if (response.ok) {
            App.showNotification('Alias added successfully', 'success');
            
            // Reload data and update UI
            await App.loadData();
            App.updateStats();
            App.renderSkuTable();
            closeModal('aliasModal');
        } else {
            throw new Error('Failed to add alias');
        }
    } catch (error) {
        console.error('Add alias error:', error);
        App.showNotification('Failed to add alias', 'error');
    }
}

// Quick alias functions for individual SKUs
function openQuickAliasModal(skuName) {
    document.getElementById('quickAliasSkuName').textContent = skuName;
    document.getElementById('quickAliasQuickbooksSku').value = skuName;
    document.getElementById('quickAliasShipstationSku').value = '';
    openModal('quickAliasModal');
}

async function addQuickAlias() {
    const shipstationSku = document.getElementById('quickAliasShipstationSku').value.trim();
    const quickbooksSku = document.getElementById('quickAliasQuickbooksSku').value.trim();
    
    if (!shipstationSku) {
        App.showNotification('Please enter the ShipStation SKU', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/database-supabase?action=add-alias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shipstationSku, quickbooksSku })
        });
        
        if (response.ok) {
            App.showNotification(`Alias created: ${shipstationSku} → ${quickbooksSku}`, 'success');
            
            // Reload data and update UI
            await App.loadData();
            App.updateStats();
            App.renderSkuTable();
            closeModal('quickAliasModal');
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add alias');
        }
    } catch (error) {
        console.error('Add quick alias error:', error);
        App.showNotification(error.message || 'Failed to add alias', 'error');
    }
}

async function deleteSku(skuId) {
    if (!confirm('Are you sure you want to delete this SKU?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/database-supabase?action=sku&id=${skuId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            App.showNotification('SKU deleted successfully', 'success');
            
            // Reload data and update UI
            await App.loadData();
            App.updateStats();
            App.renderSkuTable();
        } else {
            throw new Error('Failed to delete SKU');
        }
    } catch (error) {
        console.error('Delete SKU error:', error);
        App.showNotification('Failed to delete SKU', 'error');
    }
}

async function deleteAlias(shipstationSku) {
    if (!confirm('Are you sure you want to delete this alias?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/database-supabase?action=alias&shipstationSku=${encodeURIComponent(shipstationSku)}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            App.showNotification('Alias deleted successfully', 'success');
            
            // Reload data and update UI
            await App.loadData();
            App.updateStats();
            App.renderSkuTable();
        } else {
            throw new Error('Failed to delete alias');
        }
    } catch (error) {
        console.error('Delete alias error:', error);
        App.showNotification('Failed to delete alias', 'error');
    }
}

function searchSkus() {
    const query = document.getElementById('skuSearchInput').value.toLowerCase().trim();
    App.renderSkuTable(query);
}

// Render SKU table
App.renderSkuTable = function(searchQuery = '') {
    const tbody = document.getElementById('skuTableBody');
    const skus = this.data.skus || [];
    const aliases = this.data.aliases || {};
    
    // Filter SKUs based on search
    let filteredItems = [...skus];
    
    // Add aliases as separate items
    Object.entries(aliases).forEach(([shipstation, quickbooks]) => {
        filteredItems.push({
            id: `alias_${shipstation}`,
            name: `${shipstation} → ${quickbooks}`,
            category: null,
            type: 'alias',
            isAlias: true,
            shipstationSku: shipstation
        });
    });
    
    if (searchQuery) {
        filteredItems = filteredItems.filter(item => 
            item.name.toLowerCase().includes(searchQuery) ||
            (item.category && item.category.toLowerCase().includes(searchQuery))
        );
    }
    
    if (filteredItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4">
                    <div class="empty-state">
                        <i class="fas fa-${searchQuery ? 'search' : 'box-open'}"></i>
                        <h3>No ${searchQuery ? 'matching ' : ''}SKUs found</h3>
                        <p>${searchQuery ? 'Try a different search term' : 'Import your QuickBooks SKU list to get started'}</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredItems.map(item => `
        <tr>
            <td>
                <strong>${item.name}</strong>
                ${item.isAlias ? '<span class="badge badge-warning">Alias</span>' : ''}
            </td>
            <td>${item.category || '-'}</td>
            <td>
                <span class="badge ${item.type === 'imported' ? 'badge-success' : 
                                   item.type === 'alias' ? 'badge-warning' : 
                                   'badge-error'}">${item.type}</span>
            </td>
            <td>
                <div style="display: flex; gap: 0.5rem;">
                    ${item.isAlias ? 
                        `<button class="btn btn-outline btn-sm" onclick="deleteAlias('${item.shipstationSku}')" title="Delete Alias">
                            <i class="fas fa-trash"></i>
                        </button>` :
                        `<button class="btn btn-outline btn-sm" onclick="openQuickAliasModal('${item.name.replace(/'/g, "\\'")}')" title="Create Alias for this SKU">
                            <i class="fas fa-link"></i>
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="deleteSku('${item.id}')" title="Delete SKU">
                            <i class="fas fa-trash"></i>
                        </button>`
                    }
                </div>
            </td>
        </tr>
    `).join('');
};

// Sync Data Function
async function syncData() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
        App.showNotification('Please select date range', 'error');
        return;
    }
    
    if (App.data.skus.length === 0) {
        App.showNotification('Please import SKUs first', 'error');
        return;
    }
    
    try {
        App.showNotification('Syncing order data from ShipStation...', 'info');
        
        // Fetch orders (not shipments - captures all sales including freight)
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                startDate: startDate + 'T00:00:01',
                endDate: endDate + 'T23:59:59'
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch orders');
        }
        
        const data = await response.json();
        
        // Process the data with our SKU lookup
        const processed = App.processOrderData(data.consolidatedItems);
        App.data.currentSync = processed;
        
        // Update sync results UI
        document.getElementById('syncTotalOrders').textContent = data.totalOrders || 0;
        document.getElementById('syncUniqueSkus').textContent = processed.length;
        document.getElementById('syncMatchedSkus').textContent = processed.filter(item => item.matched).length;
        document.getElementById('syncUnmatchedSkus').textContent = processed.filter(item => !item.matched).length;
        
        // Render results table
        App.renderSyncResults(processed);
        
        // Show results section
        document.getElementById('syncResults').style.display = 'block';
        
        // Add to history
        await fetch('/api/database-supabase?action=add-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'sync',
                message: `Synced ${data.totalOrders} orders, ${processed.length} unique SKUs (excludes cancelled orders)`,
                data: {
                    orders: data.totalOrders,
                    skus: processed.length,
                    matched: processed.filter(item => item.matched).length,
                    orderStatuses: data.orderStatuses,
                    dateRange: { startDate, endDate }
                }
            })
        });
        
        await App.loadData();
        App.updateStats();
        
        App.showNotification('Sync completed successfully', 'success');
        
    } catch (error) {
        console.error('Sync error:', error);
        App.showNotification('Sync failed: ' + error.message, 'error');
    }
}

// Process order data with SKU matching
App.processOrderData = function(consolidatedItems) {
    const results = [];
    const skuLookup = {};
    
    // Build lookup table from our SKUs
    this.data.skus.forEach(sku => {
        skuLookup[sku.name.toLowerCase()] = sku.name;
    });
    
    for (const [sku, quantity] of Object.entries(consolidatedItems)) {
        // Check aliases first, then direct lookup
        const aliasedSku = this.data.aliases[sku.toLowerCase()];
        let qbItem = null;
        
        if (aliasedSku) {
            qbItem = skuLookup[aliasedSku.toLowerCase()] || aliasedSku;
        } else {
            qbItem = skuLookup[sku.toLowerCase()];
        }
        
        results.push({
            sku,
            qbItem: qbItem || null,
            quantity,
            matched: !!qbItem
        });
    }
    
    return results;
};

// Render sync results
App.renderSyncResults = function(data) {
    const tbody = document.getElementById('syncResultsBody');
    
    tbody.innerHTML = data.map(item => `
        <tr>
            <td><strong>${item.sku}</strong></td>
            <td>${item.qbItem || '<em>Not Found</em>'}</td>
            <td>${item.quantity}</td>
            <td>
                <span class="badge ${item.matched ? 'badge-success' : 'badge-warning'}">
                    ${item.matched ? '✓ Matched' : '⚠ Unmatched'}
                </span>
            </td>
        </tr>
    `).join('');
};

// Generate IIF File
async function generateIIF() {
    if (!App.data.currentSync) {
        App.showNotification('No sync data available', 'error');
        return;
    }
    
    const matchedItems = App.data.currentSync.filter(item => 
        item.matched && 
        item.qbItem && 
        item.qbItem !== 'Not Found' && 
        item.quantity > 0
    );
    
    if (matchedItems.length === 0) {
        App.showNotification('No matched items to export. Create aliases for unmatched SKUs first.', 'error');
        return;
    }
    
    console.log(`Generating IIF for ${matchedItems.length} matched items out of ${App.data.currentSync.length} total`);
    
    try {
        const response = await fetch('/api/generate-iif', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: matchedItems,
                inventoryAccount: App.data.settings.inventoryAccount || '1500 · Inventory',
                startDate: document.getElementById('startDate').value,
                endDate: document.getElementById('endDate').value
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate IIF file');
        }
        
        const iifContent = await response.text();
        
        // Create download link
        const blob = new Blob([iifContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = `inventory_adjustment_${new Date().toISOString().split('T')[0]}.iif`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Add to history
        await fetch('/api/database-supabase?action=add-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'export',
                message: `Exported IIF file with ${matchedItems.length} items`,
                data: { items: matchedItems.length }
            })
        });
        
        await App.loadData();
        App.updateStats();
        
        App.showNotification('IIF file downloaded successfully', 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        App.showNotification('Failed to generate IIF file', 'error');
    }
}

// Export latest data
async function exportData() {
    // For now, redirect to sync tab
    showTab('sync');
    App.showNotification('Please sync order data first, then generate IIF file', 'info');
}

// Clear database for fresh start
async function clearDatabase() {
    if (!confirm('⚠️ WARNING: This will permanently delete ALL data including:\n\n• All SKUs\n• All aliases\n• All sync history\n\nThis cannot be undone. Are you sure?')) {
        return;
    }
    
    try {
        App.showNotification('Clearing database...', 'info');
        
        const response = await fetch('/api/clear-database', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Database cleared:', result);
            
            App.showNotification('Database cleared successfully! Ready for fresh import.', 'success');
            
            // Reload data and update UI
            await App.loadData();
            App.updateStats();
            App.renderSkuTable();
            App.renderHistory();
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Failed to clear database');
        }
    } catch (error) {
        console.error('Clear database error:', error);
        App.showNotification('Failed to clear database: ' + error.message, 'error');
    }
}

// Render history
App.renderHistory = function() {
    const container = document.getElementById('historyContent');
    const history = this.data.history || [];
    
    if (history.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-history"></i>
                <h3>No sync history</h3>
                <p>Your sync history will appear here after your first sync</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="history-list">
            ${history.map(entry => `
                <div class="history-item" style="padding: 1rem; border-bottom: 1px solid var(--border);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <strong>${entry.message}</strong>
                        <span class="badge ${entry.type === 'sync' ? 'badge-success' : 
                                           entry.type === 'export' ? 'badge-warning' : 
                                           'badge-error'}">${entry.type}</span>
                    </div>
                    <div style="color: var(--text-muted); font-size: 0.875rem;">
                        ${App.formatDateTime(entry.timestamp)}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    // Also update recent activity on dashboard
    const recentActivity = document.getElementById('recentActivity');
    if (history.length > 0) {
        recentActivity.innerHTML = `
            <div class="history-list">
                ${history.slice(0, 3).map(entry => `
                    <div class="history-item" style="padding: 0.75rem; border-bottom: 1px solid var(--border);">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>${entry.message}</span>
                            <span style="color: var(--text-muted); font-size: 0.75rem;">
                                ${App.formatDateTime(entry.timestamp)}
                            </span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    App.init();
    
    // Close modals when clicking outside
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            const modalId = e.target.id;
            closeModal(modalId);
        }
    });
});