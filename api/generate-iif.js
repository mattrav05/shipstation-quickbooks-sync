/*
 * QuickBooks IIF (Intuit Interchange Format) Generator
 * 
 * REQUIRED FIELDS FOR QUICKBOOKS COMPATIBILITY:
 * 
 * 1. HDR Section (Header):
 *    - PROD: Product name (QuickBooks Pro/Premier/Enterprise)
 *    - VER: Version
 *    - IIFVER: IIF version (usually 1)
 *    - DATE/TIME: Current date and time
 * 
 * 2. TRNS Section (Transaction):
 *    - TRNSTYPE: INVADJ (Inventory Adjustment)
 *    - DATE: Transaction date (MM/DD/YYYY format)
 *    - ACCNT: Account name (must exist in QuickBooks)
 *    - AMOUNT: Total adjustment amount
 *    - DOCNUM: Unique document number
 *    - MEMO: Description
 * 
 * 3. SPL Section (Split Line):
 *    - ACCNT: Account being adjusted
 *    - AMOUNT: Line amount (negative reduces inventory)
 *    - INVITEM: Item name (must EXACTLY match QuickBooks item)
 *    - QNTY: Quantity being adjusted (negative reduces)
 * 
 * CRITICAL REQUIREMENTS:
 * - Item names must EXACTLY match QuickBooks items (case-sensitive)
 * - All referenced accounts must exist in QuickBooks
 * - Use tab separators (\t) between fields
 * - End each transaction with ENDTRNS
 * - Only include items that have valid QuickBooks matches
 */

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
        
        // Transaction header for inventory adjustments
        iifContent += '!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tDOCNUM\tMEMO\tDUEDATE\n';
        iifContent += '!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tDOCNUM\tMEMO\tINVITEM\tQNTY\tPONUM\tVALADJ\n';
        iifContent += '!ENDTRNS\n';
        
        // Create inventory adjustment transactions
        let transactionId = 1;
        const adjustmentDate = new Date().toLocaleDateString('en-US');
        const memo = `ShipStation sync ${startDate} to ${endDate}`;
        
        // Filter to ONLY matched items to prevent QuickBooks errors
        const matchedItems = items.filter(item => 
            item.matched && 
            item.qbItem && 
            item.qbItem !== 'Not Found' && 
            item.quantity > 0
        );
        
        console.log(`Generating IIF for ${matchedItems.length} matched items (filtered from ${items.length} total)`);
        
        if (matchedItems.length === 0) {
            return res.status(400).json({ 
                error: 'No matched items to include in IIF file',
                message: 'All items must have matching QuickBooks SKUs to generate IIF'
            });
        }
        
        // Create single transaction with multiple split lines
        const docNum = `SS-ADJ-${new Date().toISOString().split('T')[0]}`;
        
        // Calculate total quantity for all items
        const totalQuantity = matchedItems.reduce((sum, item) => sum + item.quantity, 0);
        
        // TRNS line (header) - uses the adjustment account, ITEMADJ transaction type
        iifContent += `TRNS\t${transactionId}\tITEMADJ\t${adjustmentDate}\tInventory Adjustments\t\t\t\t\t\t${adjustmentDate}\n`;
        
        // Add SPL lines for each item with individual quantities
        matchedItems.forEach(item => {
            // Clean the QuickBooks item name (remove any category prefix if present)
            let qbItemName = item.qbItem;
            if (qbItemName.includes(':')) {
                // If format is "CATEGORY:ITEM", use just the ITEM part
                qbItemName = qbItemName.split(':').pop().trim();
            }
            
            // SPL line - uses Inventory account, ITEMADJ type, INVITEM shows actual item name
            iifContent += `SPL\t${transactionId}\tITEMADJ\t${adjustmentDate}\tInventory\t\t\t\t\t\t${qbItemName}\t-${item.quantity}\t\tN\n`;
        });
        
        // End transaction
        iifContent += 'ENDTRNS\n';
        
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