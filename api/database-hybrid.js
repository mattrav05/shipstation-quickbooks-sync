// Hybrid database approach: localStorage + server-side fallback
// This ensures data persists in browser even if server storage fails

const fs = require('fs');
const path = require('path');

// Default data structure
const defaultData = {
    skus: [],
    aliases: {},
    history: [],
    settings: {
        inventoryAccount: '1500 · Inventory',
        lastUpdated: new Date().toISOString()
    }
};

// Simple in-memory storage as fallback (will reset on server restart)
let memoryStorage = { ...defaultData };

// Try to read from committed database file on startup
try {
    const dbPath = path.join(process.cwd(), 'data', 'database.json');
    if (fs.existsSync(dbPath)) {
        const data = fs.readFileSync(dbPath, 'utf8');
        memoryStorage = JSON.parse(data);
        console.log('Loaded database from file:', Object.keys(memoryStorage));
    }
} catch (error) {
    console.log('Could not load database file, using defaults:', error.message);
}

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const { method } = req;
        const { action } = req.query;
        
        console.log(`Database Hybrid API: ${method} ${action}`);

        switch (method) {
            case 'GET':
                return handleGet(req, res, action);
            case 'POST':
                return handlePost(req, res, action);
            case 'PUT':
                return handlePut(req, res, action);
            case 'DELETE':
                return handleDelete(req, res, action);
            default:
                return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Database API error:', error);
        return res.status(500).json({
            error: 'Database operation failed',
            message: error.message
        });
    }
};

// GET operations
async function handleGet(req, res, action) {
    console.log('GET action:', action, 'Current memory storage keys:', Object.keys(memoryStorage));
    
    switch (action) {
        case 'all':
            console.log('Returning all data:', {
                skus: memoryStorage.skus?.length || 0,
                aliases: Object.keys(memoryStorage.aliases || {}).length,
                history: memoryStorage.history?.length || 0
            });
            return res.json(memoryStorage);
        
        case 'skus':
            return res.json({ skus: memoryStorage.skus || [] });
        
        case 'aliases':
            return res.json({ aliases: memoryStorage.aliases || {} });
        
        case 'history':
            return res.json({ history: memoryStorage.history || [] });
        
        case 'settings':
            return res.json({ settings: memoryStorage.settings || defaultData.settings });
        
        case 'stats':
            return res.json({
                totalSkus: memoryStorage.skus?.length || 0,
                totalAliases: Object.keys(memoryStorage.aliases || {}).length,
                lastSync: memoryStorage.history?.length > 0 ? memoryStorage.history[0].timestamp : null,
                lastExport: memoryStorage.history?.find(h => h.type === 'export')?.timestamp || null
            });
        
        default:
            return res.status(400).json({ error: 'Invalid action' });
    }
}

// POST operations
async function handlePost(req, res, action) {
    const { body } = req;
    console.log('POST action:', action, 'Body received:', !!body);
    
    switch (action) {
        case 'import-skus':
            const { skuText } = body;
            console.log('Importing SKUs, text length:', skuText?.length);
            
            const newSkus = parseSkuText(skuText);
            console.log('Parsed SKUs:', newSkus.length);
            
            // Merge with existing SKUs (avoid duplicates)
            const existingSkuNames = new Set((memoryStorage.skus || []).map(s => s.name.toLowerCase()));
            const uniqueNewSkus = newSkus.filter(sku => !existingSkuNames.has(sku.name.toLowerCase()));
            
            memoryStorage.skus = [...(memoryStorage.skus || []), ...uniqueNewSkus];
            memoryStorage.settings = memoryStorage.settings || {};
            memoryStorage.settings.lastUpdated = new Date().toISOString();
            
            // Add history entry
            memoryStorage.history = memoryStorage.history || [];
            memoryStorage.history.unshift({
                id: Date.now().toString(),
                type: 'import',
                message: `Imported ${uniqueNewSkus.length} SKUs`,
                timestamp: new Date().toISOString(),
                data: { imported: uniqueNewSkus.length, duplicates: newSkus.length - uniqueNewSkus.length }
            });
            
            console.log('After import - Total SKUs:', memoryStorage.skus.length);
            
            return res.json({ 
                success: true, 
                imported: uniqueNewSkus.length, 
                duplicates: newSkus.length - uniqueNewSkus.length,
                total: memoryStorage.skus.length 
            });
        
        case 'add-sku':
            const { name, category } = body;
            if (!name) {
                return res.status(400).json({ error: 'SKU name is required' });
            }
            
            // Check for duplicates
            const existsAlready = (memoryStorage.skus || []).some(s => s.name.toLowerCase() === name.toLowerCase());
            if (existsAlready) {
                return res.status(400).json({ error: 'SKU already exists' });
            }
            
            const newSku = {
                id: Date.now().toString(),
                name: name.trim(),
                category: category?.trim() || null,
                type: 'manual',
                created: new Date().toISOString()
            };
            
            memoryStorage.skus = memoryStorage.skus || [];
            memoryStorage.skus.push(newSku);
            memoryStorage.settings = memoryStorage.settings || {};
            memoryStorage.settings.lastUpdated = new Date().toISOString();
            
            // Add history entry
            memoryStorage.history = memoryStorage.history || [];
            memoryStorage.history.unshift({
                id: Date.now().toString(),
                type: 'add-sku',
                message: `Added SKU: ${newSku.name}`,
                timestamp: new Date().toISOString(),
                data: newSku
            });
            
            return res.json({ success: true, sku: newSku });
        
        case 'add-alias':
            const { shipstationSku, quickbooksSku } = body;
            if (!shipstationSku || !quickbooksSku) {
                return res.status(400).json({ error: 'Both SKUs are required' });
            }
            
            memoryStorage.aliases = memoryStorage.aliases || {};
            memoryStorage.aliases[shipstationSku.toLowerCase()] = quickbooksSku;
            memoryStorage.settings = memoryStorage.settings || {};
            memoryStorage.settings.lastUpdated = new Date().toISOString();
            
            // Add history entry
            memoryStorage.history = memoryStorage.history || [];
            memoryStorage.history.unshift({
                id: Date.now().toString(),
                type: 'add-alias',
                message: `Added alias: ${shipstationSku} → ${quickbooksSku}`,
                timestamp: new Date().toISOString(),
                data: { shipstationSku, quickbooksSku }
            });
            
            return res.json({ success: true });
        
        case 'add-history':
            const historyEntry = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                ...body
            };
            
            memoryStorage.history = memoryStorage.history || [];
            memoryStorage.history.unshift(historyEntry);
            
            // Keep only last 100 history entries
            if (memoryStorage.history.length > 100) {
                memoryStorage.history = memoryStorage.history.slice(0, 100);
            }
            
            return res.json({ success: true });
        
        default:
            return res.status(400).json({ error: 'Invalid action' });
    }
}

// PUT operations
async function handlePut(req, res, action) {
    const { body } = req;
    
    switch (action) {
        case 'settings':
            memoryStorage.settings = { 
                ...(memoryStorage.settings || {}), 
                ...body, 
                lastUpdated: new Date().toISOString() 
            };
            return res.json({ success: true, settings: memoryStorage.settings });
        
        default:
            return res.status(400).json({ error: 'Invalid action' });
    }
}

// DELETE operations
async function handleDelete(req, res, action) {
    const { id } = req.query;
    
    switch (action) {
        case 'sku':
            if (!id) {
                return res.status(400).json({ error: 'SKU ID is required' });
            }
            
            memoryStorage.skus = memoryStorage.skus || [];
            const skuIndex = memoryStorage.skus.findIndex(s => s.id === id);
            if (skuIndex === -1) {
                return res.status(404).json({ error: 'SKU not found' });
            }
            
            const deletedSku = memoryStorage.skus.splice(skuIndex, 1)[0];
            memoryStorage.settings = memoryStorage.settings || {};
            memoryStorage.settings.lastUpdated = new Date().toISOString();
            
            // Add history entry
            memoryStorage.history = memoryStorage.history || [];
            memoryStorage.history.unshift({
                id: Date.now().toString(),
                type: 'delete-sku',
                message: `Deleted SKU: ${deletedSku.name}`,
                timestamp: new Date().toISOString(),
                data: deletedSku
            });
            
            return res.json({ success: true });
        
        case 'alias':
            const { shipstationSku } = req.query;
            if (!shipstationSku) {
                return res.status(400).json({ error: 'ShipStation SKU is required' });
            }
            
            const aliasKey = shipstationSku.toLowerCase();
            memoryStorage.aliases = memoryStorage.aliases || {};
            
            if (!memoryStorage.aliases[aliasKey]) {
                return res.status(404).json({ error: 'Alias not found' });
            }
            
            const deletedAlias = memoryStorage.aliases[aliasKey];
            delete memoryStorage.aliases[aliasKey];
            memoryStorage.settings = memoryStorage.settings || {};
            memoryStorage.settings.lastUpdated = new Date().toISOString();
            
            // Add history entry
            memoryStorage.history = memoryStorage.history || [];
            memoryStorage.history.unshift({
                id: Date.now().toString(),
                type: 'delete-alias',
                message: `Deleted alias: ${shipstationSku} → ${deletedAlias}`,
                timestamp: new Date().toISOString(),
                data: { shipstationSku, quickbooksSku: deletedAlias }
            });
            
            return res.json({ success: true });
        
        default:
            return res.status(400).json({ error: 'Invalid action' });
    }
}

// Helper function to parse SKU text
function parseSkuText(text) {
    if (!text) return [];
    
    const lines = text.split('\n');
    const skus = [];
    
    lines.forEach((line, index) => {
        line = line.trim();
        if (!line) return;
        
        let name, category = null;
        
        if (line.includes(':')) {
            // Format: CATEGORY:SKU
            const parts = line.split(':');
            category = parts[0].trim();
            name = parts.slice(1).join(':').trim();
        } else {
            // Standalone SKU
            name = line;
        }
        
        if (name) {
            skus.push({
                id: `imported_${Date.now()}_${index}`,
                name,
                category,
                type: 'imported',
                created: new Date().toISOString()
            });
        }
    });
    
    return skus;
}