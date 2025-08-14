const axios = require('axios');

// ShipStation API credentials - using working values from test
const SHIPSTATION_API_KEY = 'b5273708f7e5444b9445d406291e5080';
const SHIPSTATION_API_SECRET = 'b247eb116fc7497da4c99c1f82566ae3';

console.log('Orders API: Using hardcoded API credentials');
console.log('API Key present:', !!SHIPSTATION_API_KEY);
console.log('API Secret present:', !!SHIPSTATION_API_SECRET);

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
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { startDate, endDate, includeCancelled = false, useShipDate = false } = req.body;
        
        console.log('Orders API: Received request body:', req.body);
        console.log('Start date:', startDate);
        console.log('End date:', endDate);
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }
        
        // Create auth header
        const auth = Buffer.from(`${SHIPSTATION_API_KEY}:${SHIPSTATION_API_SECRET}`).toString('base64');
        console.log('Auth header created successfully');
        
        // First, let's check what stores are available
        try {
            console.log('Fetching available stores...');
            const storesResponse = await axios.get('https://ssapi.shipstation.com/stores', {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (storesResponse.data && storesResponse.data.stores) {
                console.log('Available stores:');
                storesResponse.data.stores.forEach(store => {
                    console.log(`  Store ID: ${store.storeId}, Name: ${store.storeName}, Active: ${store.active}`);
                });
            }
        } catch (storeError) {
            console.error('Error fetching stores:', storeError.message);
        }
        
        // Initialize variables for pagination
        let allOrders = [];
        let page = 1;
        let hasMorePages = true;
        const pageSize = 500;
        
        // Fetch all pages of orders
        while (hasMorePages) {
            const url = `https://ssapi.shipstation.com/orders`;
            
            try {
                console.log(`Fetching ShipStation orders page ${page} with date range: ${startDate} to ${endDate}`);
                
                const response = await axios.get(url, {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/json'
                    },
                    params: useShipDate ? {
                        // Use shipDate for when the order was shipped (matches ShipStation reports)
                        shipDateStart: startDate,
                        shipDateEnd: endDate,
                        page: page,
                        pageSize: pageSize,
                        // Explicitly request all stores (omit storeId to get all)
                    } : {
                        // Use orderDate for when the order was placed
                        orderDateStart: startDate,
                        orderDateEnd: endDate,
                        page: page,
                        pageSize: pageSize,
                        // Explicitly request all stores (omit storeId to get all)
                    }
                });
                
                const data = response.data;
                console.log(`Page ${page} returned ${data.orders ? data.orders.length : 0} orders`);
                
                if (data.orders && data.orders.length > 0) {
                    // Track all orders for debugging
                    const skuTracking = {};
                    
                    // Log all statuses on first page for debugging
                    if (page === 1) {
                        const allStatuses = new Set(data.orders.map(o => o.orderStatus));
                        console.log('All order statuses found:', Array.from(allStatuses));
                    }
                    
                    // Optionally filter out cancelled and rejected orders
                    const validOrders = includeCancelled ? data.orders : data.orders.filter(order => {
                        const status = (order.orderStatus || '').toLowerCase().trim();
                        // Include all orders except cancelled ones
                        const isValid = !status.includes('cancel') && !status.includes('rejected') && !status.includes('void');
                        
                        // Track SKUs in excluded orders for debugging
                        if (!isValid && order.items) {
                            console.log(`EXCLUDING Order ${order.orderNumber} with status: ${order.orderStatus}`);
                            order.items.forEach(item => {
                                if (item.sku && item.sku.toLowerCase().includes('p06')) {
                                    console.log(`  -> Contains ${item.quantity}x ${item.sku}`);
                                }
                            });
                        }
                        
                        return isValid;
                    });
                    
                    console.log(`Page ${page}: ${validOrders.length} valid orders (${data.orders.length - validOrders.length} excluded)`);
                    allOrders = allOrders.concat(validOrders);
                }
                
                // Check if there are more pages
                if (!data.orders || data.orders.length < pageSize) {
                    hasMorePages = false;
                } else {
                    page++;
                }
                
                // Rate limiting - ShipStation allows 40 requests per second
                // Add a small delay between requests
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`Error fetching orders page ${page}:`, error.message);
                if (error.response) {
                    console.error('Response status:', error.response.status);
                    console.error('Response data:', error.response.data);
                }
                hasMorePages = false;
            }
        }
        
        // Process orders to consolidate SKUs
        const consolidatedItems = {};
        let totalOrders = 0;
        let totalItems = 0;
        const orderStatuses = {};
        const storeStats = {};
        
        allOrders.forEach(order => {
            totalOrders++;
            
            // Track order statuses for reporting
            const status = order.orderStatus || 'unknown';
            orderStatuses[status] = (orderStatuses[status] || 0) + 1;
            
            // Track store stats
            const storeId = order.advancedOptions?.storeId || order.storeId || 'Unknown';
            if (!storeStats[storeId]) {
                storeStats[storeId] = { orders: 0, items: 0 };
            }
            storeStats[storeId].orders++;
            
            // Special logging for The Shelving Store (438369)
            if (storeId === '438369') {
                console.log(`Store 438369 order: ${order.orderNumber} (${order.orderStatus}) - Items: ${order.items?.length || 0}`);
            }
            
            if (order.items && Array.isArray(order.items)) {
                order.items.forEach(item => {
                    const sku = item.sku || 'UNKNOWN';
                    const quantity = parseInt(item.quantity) || 0;
                    totalItems += quantity;
                    storeStats[storeId].items += quantity;
                    
                    // Special logging for SI-P06C
                    if (sku.toLowerCase().includes('p06')) {
                        console.log(`Found ${quantity}x ${sku} in order ${order.orderNumber} (${order.orderStatus}) from store: ${order.advancedOptions?.storeId || order.storeId || 'Unknown'}`);
                    }
                    
                    if (consolidatedItems[sku]) {
                        consolidatedItems[sku] += quantity;
                    } else {
                        consolidatedItems[sku] = quantity;
                    }
                });
            }
        });
        
        // Log final results
        console.log(`Final results: ${allOrders.length} valid orders, ${totalOrders} processed, ${Object.keys(consolidatedItems).length} unique SKUs, ${totalItems} total items`);
        console.log('Order statuses:', orderStatuses);
        console.log('Store breakdown:', storeStats);
        
        // Log top SKUs with quantities for debugging
        const topSkus = Object.entries(consolidatedItems)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        console.log('Top 10 SKUs by quantity:');
        topSkus.forEach(([sku, qty]) => {
            console.log(`  ${sku}: ${qty} units`);
        });
        
        // Return consolidated data
        return res.status(200).json({
            success: true,
            totalOrders: totalOrders,
            totalItems: totalItems,
            orderStatuses: orderStatuses,
            consolidatedItems: consolidatedItems,
            dateRange: {
                start: startDate,
                end: endDate
            },
            dataType: 'orders' // Indicate this is order data, not shipment data
        });
        
    } catch (error) {
        console.error('Error processing orders request:', error);
        return res.status(500).json({
            error: 'Failed to fetch orders',
            message: error.message
        });
    }
};