const fs = require('fs');
const path = require('path');

// Simple file-based database for Vercel
// In production, you'd use a real database like PostgreSQL, MongoDB, etc.

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

// Get database file path (Vercel writable directory)
const getDbPath = () => {
    // Use /tmp for Vercel serverless functions
    return path.join('/tmp', 'shipstation_db.json');
};

// Read database
function readDatabase() {
    try {
        const dbPath = getDbPath();
        if (fs.existsSync(dbPath)) {
            const data = fs.readFileSync(dbPath, 'utf8');
            return JSON.parse(data);
        }
        return { ...defaultData };
    } catch (error) {
        console.error('Error reading database:', error);
        return { ...defaultData };
    }
}

// Write database
function writeDatabase(data) {
    try {
        const dbPath = getDbPath();
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing database:', error);
        return false;
    }
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
        
        console.log(`Database API: ${method} ${action}`);

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
    const db = readDatabase();
    
    switch (action) {
        case 'all':
            return res.json(db);
        
        case 'skus':
            return res.json({ skus: db.skus });
        
        case 'aliases':
            return res.json({ aliases: db.aliases });
        
        case 'history':
            return res.json({ history: db.history });
        
        case 'settings':
            return res.json({ settings: db.settings });
        
        case 'stats':
            return res.json({
                totalSkus: db.skus.length,
                totalAliases: Object.keys(db.aliases).length,
                lastSync: db.history.length > 0 ? db.history[0].timestamp : null,
                lastExport: db.history.find(h => h.type === 'export')?.timestamp || null
            });
        
        default:
            return res.status(400).json({ error: 'Invalid action' });
    }
}

// POST operations
async function handlePost(req, res, action) {
    const db = readDatabase();
    const { body } = req;
    
    switch (action) {
        case 'import-skus':
            const { skuText } = body;
            const newSkus = parseSkuText(skuText);
            
            // Merge with existing SKUs (avoid duplicates)
            const existingSkuNames = new Set(db.skus.map(s => s.name.toLowerCase()));
            const uniqueNewSkus = newSkus.filter(sku => !existingSkuNames.has(sku.name.toLowerCase()));
            
            db.skus = [...db.skus, ...uniqueNewSkus];
            db.settings.lastUpdated = new Date().toISOString();
            
            // Add history entry
            db.history.unshift({
                id: Date.now().toString(),
                type: 'import',
                message: `Imported ${uniqueNewSkus.length} SKUs`,
                timestamp: new Date().toISOString(),
                data: { imported: uniqueNewSkus.length, duplicates: newSkus.length - uniqueNewSkus.length }
            });
            
            writeDatabase(db);
            return res.json({ 
                success: true, 
                imported: uniqueNewSkus.length, 
                duplicates: newSkus.length - uniqueNewSkus.length,
                total: db.skus.length 
            });
        
        case 'add-sku':
            const { name, category } = body;
            if (!name) {
                return res.status(400).json({ error: 'SKU name is required' });
            }
            
            // Check for duplicates
            const existsAlready = db.skus.some(s => s.name.toLowerCase() === name.toLowerCase());
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
            
            db.skus.push(newSku);
            db.settings.lastUpdated = new Date().toISOString();
            
            // Add history entry
            db.history.unshift({
                id: Date.now().toString(),
                type: 'add-sku',
                message: `Added SKU: ${newSku.name}`,
                timestamp: new Date().toISOString(),
                data: newSku
            });
            
            writeDatabase(db);
            return res.json({ success: true, sku: newSku });
        
        case 'add-alias':
            const { shipstationSku, quickbooksSku } = body;
            if (!shipstationSku || !quickbooksSku) {
                return res.status(400).json({ error: 'Both SKUs are required' });
            }
            
            db.aliases[shipstationSku.toLowerCase()] = quickbooksSku;
            db.settings.lastUpdated = new Date().toISOString();
            
            // Add history entry
            db.history.unshift({
                id: Date.now().toString(),
                type: 'add-alias',
                message: `Added alias: ${shipstationSku} → ${quickbooksSku}`,
                timestamp: new Date().toISOString(),
                data: { shipstationSku, quickbooksSku }
            });
            
            writeDatabase(db);
            return res.json({ success: true });
        
        case 'add-history':
            const historyEntry = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                ...body
            };
            
            db.history.unshift(historyEntry);
            
            // Keep only last 100 history entries
            if (db.history.length > 100) {
                db.history = db.history.slice(0, 100);
            }
            
            writeDatabase(db);
            return res.json({ success: true });
        
        default:
            return res.status(400).json({ error: 'Invalid action' });
    }
}

// PUT operations
async function handlePut(req, res, action) {
    const db = readDatabase();
    const { body } = req;
    
    switch (action) {
        case 'settings':
            db.settings = { ...db.settings, ...body, lastUpdated: new Date().toISOString() };
            writeDatabase(db);
            return res.json({ success: true, settings: db.settings });
        
        default:
            return res.status(400).json({ error: 'Invalid action' });
    }
}

// DELETE operations
async function handleDelete(req, res, action) {
    const db = readDatabase();
    const { id } = req.query;
    
    switch (action) {
        case 'sku':
            if (!id) {
                return res.status(400).json({ error: 'SKU ID is required' });
            }
            
            const skuIndex = db.skus.findIndex(s => s.id === id);
            if (skuIndex === -1) {
                return res.status(404).json({ error: 'SKU not found' });
            }
            
            const deletedSku = db.skus.splice(skuIndex, 1)[0];
            db.settings.lastUpdated = new Date().toISOString();
            
            // Add history entry
            db.history.unshift({
                id: Date.now().toString(),
                type: 'delete-sku',
                message: `Deleted SKU: ${deletedSku.name}`,
                timestamp: new Date().toISOString(),
                data: deletedSku
            });
            
            writeDatabase(db);
            return res.json({ success: true });
        
        case 'alias':
            const { shipstationSku } = req.query;
            if (!shipstationSku) {
                return res.status(400).json({ error: 'ShipStation SKU is required' });
            }
            
            const aliasKey = shipstationSku.toLowerCase();
            if (!db.aliases[aliasKey]) {
                return res.status(404).json({ error: 'Alias not found' });
            }
            
            const deletedAlias = db.aliases[aliasKey];
            delete db.aliases[aliasKey];
            db.settings.lastUpdated = new Date().toISOString();
            
            // Add history entry
            db.history.unshift({
                id: Date.now().toString(),
                type: 'delete-alias',
                message: `Deleted alias: ${shipstationSku} → ${deletedAlias}`,
                timestamp: new Date().toISOString(),
                data: { shipstationSku, quickbooksSku: deletedAlias }
            });
            
            writeDatabase(db);
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