const axios = require('axios');

// ShipStation API credentials (in production, use environment variables)
const SHIPSTATION_API_KEY = process.env.SHIPSTATION_API_KEY || 'b5273708f7e5444b9445d406291e5080';
const SHIPSTATION_API_SECRET = process.env.SHIPSTATION_API_SECRET || 'b247eb116fc7497da4c99c1f82566ae3';

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
        const { startDate, endDate } = req.body;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }
        
        // Create auth header
        const auth = Buffer.from(`${SHIPSTATION_API_KEY}:${SHIPSTATION_API_SECRET}`).toString('base64');
        
        // Initialize variables for pagination
        let allShipments = [];
        let page = 1;
        let hasMorePages = true;
        const pageSize = 500;
        
        // Fetch all pages of shipments
        while (hasMorePages) {
            const url = `https://ssapi.shipstation.com/shipments`;
            
            try {
                console.log(`Fetching ShipStation page ${page} with date range: ${startDate} to ${endDate}`);
                
                const response = await axios.get(url, {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/json'
                    },
                    params: {
                        shipDateStart: startDate,
                        shipDateEnd: endDate,
                        page: page,
                        pageSize: pageSize,
                        includeShipmentItems: true
                    }
                });
                
                const data = response.data;
                console.log(`Page ${page} returned ${data.shipments ? data.shipments.length : 0} shipments`);
                
                if (data.shipments && data.shipments.length > 0) {
                    allShipments = allShipments.concat(data.shipments);
                }
                
                // Check if there are more pages
                if (!data.shipments || data.shipments.length < pageSize) {
                    hasMorePages = false;
                } else {
                    page++;
                }
                
                // Rate limiting - ShipStation allows 40 requests per second
                // Add a small delay between requests
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`Error fetching page ${page}:`, error.message);
                hasMorePages = false;
            }
        }
        
        // Process shipments to consolidate SKUs
        const consolidatedItems = {};
        let totalOrders = 0;
        
        allShipments.forEach(shipment => {
            if (shipment.shipmentItems && Array.isArray(shipment.shipmentItems)) {
                totalOrders++;
                
                shipment.shipmentItems.forEach(item => {
                    const sku = item.sku || 'UNKNOWN';
                    const quantity = parseInt(item.quantity) || 0;
                    
                    if (consolidatedItems[sku]) {
                        consolidatedItems[sku] += quantity;
                    } else {
                        consolidatedItems[sku] = quantity;
                    }
                });
            }
        });
        
        // Return consolidated data
        return res.status(200).json({
            success: true,
            totalOrders: totalOrders,
            totalShipments: allShipments.length,
            consolidatedItems: consolidatedItems,
            dateRange: {
                start: startDate,
                end: endDate
            }
        });
        
    } catch (error) {
        console.error('Error processing request:', error);
        return res.status(500).json({
            error: 'Failed to fetch shipments',
            message: error.message
        });
    }
};