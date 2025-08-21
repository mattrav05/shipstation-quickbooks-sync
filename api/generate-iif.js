/*
 * QuickBooks IIF (Intuit Interchange Format) Generator - Sales Receipt
 * 
 * REQUIRED FIELDS FOR SALES RECEIPT COMPATIBILITY:
 * 
 * 1. TRNS Section (Transaction Header):
 *    - TRNSTYPE: CASH SALE (Sales Receipt)
 *    - DATE: Transaction date (MM/DD/YYYY format)
 *    - NAME: Customer name
 *    - AMOUNT: Total sale amount ($0.00 for tracking only)
 *    - DOCNUM: Unique document number
 * 
 * 2. SPL Section (Split Lines):
 *    - ACCNT: Income Account
 *    - AMOUNT: Line amount (negative for income)
 *    - INVITEM: Item name (must EXACTLY match QuickBooks item)
 *    - QNTY: Quantity sold
 *    - PRICE: Unit price ($0.00 for tracking only)
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
        
        // Transaction header for sales receipts
        iifContent += '!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tDOCNUM\tMEMO\tCLEAR\tTOPRINT\tNAMEISTAXABLE\tADDR1\tADDR2\tADDR3\tADDR4\tADDR5\tDUEDATE\tTERMS\tPAID\tPAYMETH\tSHIPVIA\tSHIPDATE\tOTHER1\tREP\tFOB\tPONUM\tINVTITLE\tINVMEMO\tSADDR1\tSADDR2\tSADDR3\tSADDR4\tSADDR5\tPAYITEM\tYEARTODATE\tWAGEBASE\tEXTRA\tTOSEND\tISAJE\n';
        iifContent += '!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tDOCNUM\tMEMO\tCLEAR\tQNTY\tPRICE\tINVITEM\tPAYMETH\tTAXABLE\tVALADJ\tREIMBEXP\tSERVICEDATE\tOTHER2\tOTHER3\tPAYITEM\tYEARTODATE\tWAGEBASE\tEXTRA\n';
        iifContent += '!ENDTRNS\n';
        
        // Create sales receipt transaction
        const customerName = 'Shelving.com + TSS+ Walmart Target Driven';
        const transactionDate = new Date().toLocaleDateString('en-US');
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
        
        // Create single sales receipt with multiple line items
        const docNum = `SS-SALE-${new Date().toISOString().split('T')[0]}`;
        
        // TRNS line (transaction header) - $0 sales receipt for tracking purposes
        iifContent += `TRNS\t\tCASH SALE\t${transactionDate}\tChecking\t${customerName}\t\t0.00\t${docNum}\t${memo}\tN\tY\tY\t${customerName}\t\t\t\t\t${transactionDate}\t\tN\t\t\t${transactionDate}\t\t\t\t\t\t\t\t\t\t\t\t\t\tN\tN\n`;
        
        // Add SPL lines for each item - each line represents sold quantity at $0
        matchedItems.forEach(item => {
            const qbItemName = item.qbItem;
            
            // SPL line - Income account with negative amount (income), $0 price
            iifContent += `SPL\t\tCASH SALE\t${transactionDate}\tIncome Account\t\t\t0.00\t${docNum}\t\tN\t${item.quantity}\t0.00\t${qbItemName}\t\tY\tN\tNOTHING\t\t\t\t\t\t\t\t\n`;
        });
        
        // End transaction
        iifContent += 'ENDTRNS\n';
        
        // Set appropriate headers for file download
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="sales_receipt_${new Date().toISOString().split('T')[0]}.iif"`);
        
        return res.status(200).send(iifContent);
        
    } catch (error) {
        console.error('Error generating IIF:', error);
        return res.status(500).json({
            error: 'Failed to generate IIF file',
            message: error.message
        });
    }
};