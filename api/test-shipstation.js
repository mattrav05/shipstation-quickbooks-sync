const axios = require('axios');

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
        // Use hardcoded working values for testing
        const SHIPSTATION_API_KEY = 'b5273708f7e5444b9445d406291e5080';
        const SHIPSTATION_API_SECRET = 'b247eb116fc7497da4c99c1f82566ae3';
        
        const auth = Buffer.from(`${SHIPSTATION_API_KEY}:${SHIPSTATION_API_SECRET}`).toString('base64');
        
        // Test with the exact date that worked locally
        const testDate = '2024-08-12T00:00:00';
        
        console.log('Testing ShipStation API from Vercel...');
        
        const url = 'https://ssapi.shipstation.com/shipments';
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            params: {
                shipDateStart: testDate,
                shipDateEnd: testDate + '.999Z',
                page: 1,
                pageSize: 10,
                includeShipmentItems: true
            }
        });
        
        return res.status(200).json({
            success: true,
            message: 'Direct API test',
            shipmentCount: response.data.shipments ? response.data.shipments.length : 0,
            totalPages: response.data.pages || 0,
            firstShipment: response.data.shipments && response.data.shipments[0] ? {
                orderNumber: response.data.shipments[0].orderNumber,
                shipDate: response.data.shipments[0].shipDate,
                itemCount: response.data.shipments[0].shipmentItems ? response.data.shipments[0].shipmentItems.length : 0
            } : null
        });
        
    } catch (error) {
        console.error('Test API Error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        
        return res.status(500).json({
            success: false,
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
    }
};