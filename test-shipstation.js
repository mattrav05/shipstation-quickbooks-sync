const axios = require('axios');

// ShipStation API credentials
const SHIPSTATION_API_KEY = 'b5273708f7e5444b9445d406291e5080';
const SHIPSTATION_API_SECRET = 'b247eb116fc7497da4c99c1f82566ae3';

async function testShipStationAPI() {
    console.log('Testing ShipStation API...\n');
    
    // Create auth header
    const auth = Buffer.from(`${SHIPSTATION_API_KEY}:${SHIPSTATION_API_SECRET}`).toString('base64');
    
    // Test with a known date range
    const startDate = '2024-08-12T00:00:00';
    const endDate = '2024-08-12T23:59:59';
    
    console.log(`Testing date range: ${startDate} to ${endDate}`);
    
    try {
        // First, let's test if we can connect at all
        console.log('\n1. Testing basic connection to ShipStation...');
        const testUrl = 'https://ssapi.shipstation.com/carriers';
        
        const testResponse = await axios.get(testUrl, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✓ Successfully connected to ShipStation API');
        console.log(`  Found ${testResponse.data.length} carriers\n`);
        
        // Now test the shipments endpoint
        console.log('2. Testing shipments endpoint...');
        const url = 'https://ssapi.shipstation.com/shipments';
        
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            params: {
                shipDateStart: startDate,
                shipDateEnd: endDate,
                page: 1,
                pageSize: 100,
                includeShipmentItems: true
            }
        });
        
        console.log('✓ Shipments endpoint responded successfully');
        console.log(`\nResults:`);
        console.log(`  - Total shipments: ${response.data.shipments ? response.data.shipments.length : 0}`);
        console.log(`  - Total pages: ${response.data.pages || 'unknown'}`);
        console.log(`  - Current page: ${response.data.page || 1}`);
        
        if (response.data.shipments && response.data.shipments.length > 0) {
            console.log(`\nFirst shipment details:`);
            const firstShipment = response.data.shipments[0];
            console.log(`  - Order Number: ${firstShipment.orderNumber}`);
            console.log(`  - Ship Date: ${firstShipment.shipDate}`);
            console.log(`  - Items: ${firstShipment.shipmentItems ? firstShipment.shipmentItems.length : 0}`);
            
            if (firstShipment.shipmentItems && firstShipment.shipmentItems.length > 0) {
                console.log(`\n  First item:`);
                console.log(`    - SKU: ${firstShipment.shipmentItems[0].sku}`);
                console.log(`    - Quantity: ${firstShipment.shipmentItems[0].quantity}`);
            }
        } else {
            console.log('\n⚠ No shipments found for this date range');
            console.log('\nTrying a broader date range (last 30 days)...');
            
            const endDate2 = new Date().toISOString();
            const startDate2 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            
            const response2 = await axios.get(url, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    shipDateStart: startDate2,
                    shipDateEnd: endDate2,
                    page: 1,
                    pageSize: 10,
                    includeShipmentItems: true
                }
            });
            
            console.log(`\nLast 30 days results:`);
            console.log(`  - Total shipments: ${response2.data.shipments ? response2.data.shipments.length : 0}`);
            
            if (response2.data.shipments && response2.data.shipments.length > 0) {
                console.log(`  - Most recent shipment date: ${response2.data.shipments[0].shipDate}`);
            }
        }
        
    } catch (error) {
        console.error('\n❌ Error connecting to ShipStation:');
        if (error.response) {
            console.error(`  Status: ${error.response.status}`);
            console.error(`  Message: ${error.response.data?.message || error.response.statusText}`);
            
            if (error.response.status === 401) {
                console.error('\n⚠ Authentication failed - API credentials may be invalid or revoked');
            } else if (error.response.status === 429) {
                console.error('\n⚠ Rate limit exceeded - ShipStation is throttling requests');
            }
        } else {
            console.error(`  ${error.message}`);
        }
    }
}

// Run the test
testShipStationAPI();