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
            const response = await fetch('/api/database?action=all');
            if (response.ok) {
                const data = await response.json();
                this.data.skus = data.skus || [];
                this.data.aliases = data.aliases || {};
                this.data.history = data.history || [];
                this.data.settings = data.settings || {};
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
        const response = await fetch('/api/database?action=import-skus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skuText })
        });
        
        if (response.ok) {
            const result = await response.json();
            App.showNotification(
                `Imported ${result.imported} SKUs (${result.duplicates} duplicates skipped)`, 
                'success'
            );
            
            // Reload data and update UI
            await App.loadData();
            App.updateStats();
            App.renderSkuTable();
            closeModal('importModal');
        } else {
            throw new Error('Import failed');
        }
    } catch (error) {
        console.error('Import error:', error);
        App.showNotification('Failed to import SKUs', 'error');
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
        const response = await fetch('/api/database?action=add-sku', {
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
        const response = await fetch('/api/database?action=add-alias', {
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

async function deleteSku(skuId) {
    if (!confirm('Are you sure you want to delete this SKU?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/database?action=sku&id=${skuId}`, {
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
        const response = await fetch(`/api/database?action=alias&shipstationSku=${encodeURIComponent(shipstationSku)}`, {
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
                ${item.isAlias ? 
                    `<button class="btn btn-outline" onclick="deleteAlias('${item.shipstationSku}')" title="Delete Alias">
                        <i class="fas fa-trash"></i>
                    </button>` :
                    `<button class="btn btn-outline" onclick="deleteSku('${item.id}')" title="Delete SKU">
                        <i class="fas fa-trash"></i>
                    </button>`
                }
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
        App.showNotification('Syncing data from ShipStation...', 'info');
        
        // Fetch shipments
        const response = await fetch('/api/shipments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                startDate: startDate + 'T00:00:01',
                endDate: endDate + 'T23:59:59'
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch shipments');
        }
        
        const data = await response.json();
        
        // Process the data with our SKU lookup
        const processed = App.processShipmentData(data.consolidatedItems);
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
        await fetch('/api/database?action=add-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'sync',
                message: `Synced ${data.totalOrders} orders, ${processed.length} unique SKUs`,
                data: {
                    orders: data.totalOrders,
                    skus: processed.length,
                    matched: processed.filter(item => item.matched).length,
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

// Process shipment data with SKU matching
App.processShipmentData = function(consolidatedItems) {
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
    
    const matchedItems = App.data.currentSync.filter(item => item.matched);
    if (matchedItems.length === 0) {
        App.showNotification('No matched items to export', 'error');
        return;
    }
    
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
        await fetch('/api/database?action=add-history', {
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
    App.showNotification('Please sync data first, then generate IIF file', 'info');
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