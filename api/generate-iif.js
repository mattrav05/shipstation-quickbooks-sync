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
        const { items, inventoryAccount, startDate, endDate } = req.body;
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'No items to process' });
        }
        
        // Generate IIF content
        let iifContent = '';
        
        // IIF Header
        iifContent += '!HDR\tPROD\tVER\tREL\tIIFVER\tDATE\tTIME\tACCNTNT\tACCNTNTSPLITTIME\n';
        iifContent += 'HDR\tQuickBooks Pro\tVersion 2023\tRelease R1\t1\t' + 
                      new Date().toLocaleDateString() + '\t' + 
                      new Date().toTimeString().split(' ')[0] + '\tN\t0\n';
        
        // Transaction header for inventory adjustments
        iifContent += '!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tDOCNUM\tMEMO\n';
        iifContent += '!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tDOCNUM\tMEMO\tINVITEM\tQNTY\n';
        iifContent += '!ENDTRNS\n';
        
        // Create inventory adjustment transactions
        let transactionId = 1;
        const adjustmentDate = new Date().toLocaleDateString('en-US');
        const memo = `ShipStation sync ${startDate} to ${endDate}`;
        
        items.forEach(item => {
            if (!item.qbItem || item.quantity === 0) return;
            
            // Each item gets its own transaction for clarity
            const docNum = `SS-ADJ-${new Date().toISOString().split('T')[0]}-${transactionId}`;
            
            // TRNS line (header of transaction)
            iifContent += `TRNS\t${transactionId}\tGENERAL JOURNAL\t${adjustmentDate}\t${inventoryAccount || '1500 · Inventory'}\t\t\t${item.quantity}\t${docNum}\t${memo}\n`;
            
            // SPL line (split line with item details)
            // Negative quantity to reduce inventory
            iifContent += `SPL\t${transactionId}\tGENERAL JOURNAL\t${adjustmentDate}\tCost of Goods Sold\t\t\t-${item.quantity}\t${docNum}\t${memo}\t${item.qbItem}\t-${item.quantity}\n`;
            
            // End transaction
            iifContent += 'ENDTRNS\n';
            
            transactionId++;
        });
        
        // Set appropriate headers for file download
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="inventory_adjustment_${new Date().toISOString().split('T')[0]}.iif"`);
        
        return res.status(200).send(iifContent);
        
    } catch (error) {
        console.error('Error generating IIF:', error);
        return res.status(500).json({
            error: 'Failed to generate IIF file',
            message: error.message
        });
    }
};