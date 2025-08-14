const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
    
    console.log(`Database Supabase API: ${method} ${action}`);

    // Check if Supabase is configured
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ 
        error: 'Database not configured',
        message: 'Supabase environment variables missing' 
      });
    }

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
  try {
    switch (action) {
      case 'all':
        const [skus, aliases, history, settings] = await Promise.all([
          getSkus(),
          getAliases(),
          getHistory(),
          getSettings()
        ]);
        
        return res.json({
          skus,
          aliases,
          history,
          settings
        });
      
      case 'skus':
        const skuData = await getSkus();
        return res.json({ skus: skuData });
      
      case 'aliases':
        const aliasData = await getAliases();
        return res.json({ aliases: aliasData });
      
      case 'history':
        const historyData = await getHistory();
        return res.json({ history: historyData });
      
      case 'settings':
        const settingsData = await getSettings();
        return res.json({ settings: settingsData });
      
      case 'stats':
        const [skusCount, aliasesCount, historyCount] = await Promise.all([
          getSkus(),
          getAliases(),
          getHistory()
        ]);
        
        const lastSync = historyCount.find(h => h.type === 'sync');
        const lastExport = historyCount.find(h => h.type === 'export');
        
        return res.json({
          totalSkus: skusCount.length,
          totalAliases: Object.keys(aliasesCount).length,
          lastSync: lastSync?.created_at || null,
          lastExport: lastExport?.created_at || null
        });

      case 'search-sku':
        const { query } = req.query;
        if (!query) {
          return res.status(400).json({ error: 'Search query required' });
        }
        
        console.log(`Searching for SKU: "${query}"`);
        
        // Search for exact match (case-insensitive)
        const { data: exactMatch, error: exactError } = await supabase
          .from('skus')
          .select('*')
          .ilike('name', query);
        
        if (exactError) throw exactError;
        
        // Also search for partial matches
        const { data: partialMatches, error: partialError } = await supabase
          .from('skus')
          .select('*')
          .ilike('name', `%${query}%`)
          .limit(20);
        
        if (partialError) throw partialError;
        
        console.log(`Exact match results:`, exactMatch);
        console.log(`Partial match results:`, partialMatches);
        
        return res.json({
          query,
          exactMatch: exactMatch || [],
          partialMatches: partialMatches || [],
          found: (exactMatch && exactMatch.length > 0)
        });
      
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('GET operation error:', error);
    return res.status(500).json({ error: 'Failed to fetch data', message: error.message });
  }
}

// POST operations
async function handlePost(req, res, action) {
  const { body } = req;
  
  try {
    switch (action) {
      case 'import-skus':
        const { skuText } = body;
        const newSkus = parseSkuText(skuText);
        
        if (newSkus.length === 0) {
          return res.json({ success: true, imported: 0, duplicates: 0, total: 0 });
        }
        
        console.log(`Parsed ${newSkus.length} unique SKUs from input`);
        
        // Get existing SKUs to check for duplicates
        console.log('Fetching existing SKUs from database...');
        const existingSkus = await getSkus();
        console.log(`Found ${existingSkus.length} existing SKUs in database`);
        
        // Debug: log some existing SKU names
        if (existingSkus.length > 0) {
          console.log('Sample existing SKUs:', existingSkus.slice(0, 5).map(s => s.name));
        }
        
        const existingNames = new Set(existingSkus.map(s => s.name.toLowerCase()));
        console.log('Existing names set size:', existingNames.size);
        
        // Debug: log some new SKU names being checked
        if (newSkus.length > 0) {
          console.log('Sample new SKUs:', newSkus.slice(0, 5).map(s => s.name));
        }
        
        const uniqueNewSkus = newSkus.filter(sku => !existingNames.has(sku.name.toLowerCase()));
        
        console.log(`Found ${uniqueNewSkus.length} new SKUs to import (${newSkus.length - uniqueNewSkus.length} already exist)`);
        
        // Debug: if no unique new SKUs but we expected some, log details
        if (uniqueNewSkus.length === 0 && newSkus.length > 100) {
          console.log('DEBUG: No unique SKUs found but expected many. Checking first few:');
          for (let i = 0; i < Math.min(5, newSkus.length); i++) {
            const sku = newSkus[i];
            const lowerName = sku.name.toLowerCase();
            const exists = existingNames.has(lowerName);
            console.log(`SKU "${sku.name}" (lowercase: "${lowerName}") exists: ${exists}`);
          }
        }
        
        let importedCount = 0;
        
        if (uniqueNewSkus.length > 0) {
          // Process in batches to handle large datasets
          const BATCH_SIZE = 500; // Reduced for Vercel timeout limits
          const batches = [];
          
          for (let i = 0; i < uniqueNewSkus.length; i += BATCH_SIZE) {
            batches.push(uniqueNewSkus.slice(i, i + BATCH_SIZE));
          }
          
          console.log(`Processing ${uniqueNewSkus.length} SKUs in ${batches.length} batches of ${BATCH_SIZE}`);
          
          // Process each batch
          for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} SKUs`);
            
            try {
              // Use regular insert with proper conflict handling
              const { data, error } = await supabase
                .from('skus')
                .insert(batch.map(sku => ({
                  name: sku.name,
                  category: sku.category,
                  type: 'imported'
                })))
                .select();
              
              if (error) {
                // If batch insert fails, try individual inserts for this batch
                console.log(`Batch ${batchIndex + 1} failed, trying individual inserts:`, error.message);
                
                for (const sku of batch) {
                  try {
                    const { error: insertError } = await supabase
                      .from('skus')
                      .insert([{
                        name: sku.name,
                        category: sku.category,
                        type: 'imported'
                      }]);
                    
                    if (!insertError) {
                      importedCount++;
                    }
                  } catch (individualError) {
                    // Skip duplicates silently
                  }
                }
              } else {
                const batchImported = data ? data.length : 0;
                importedCount += batchImported;
                console.log(`Batch ${batchIndex + 1} imported ${batchImported} SKUs`);
              }
            } catch (batchError) {
              console.error(`Batch ${batchIndex + 1} error:`, batchError.message);
              
              // Fallback to individual inserts for this batch
              for (const sku of batch) {
                try {
                  const { error: insertError } = await supabase
                    .from('skus')
                    .insert([{
                      name: sku.name,
                      category: sku.category,
                      type: 'imported'
                    }]);
                  
                  if (!insertError) {
                    importedCount++;
                  }
                } catch (individualError) {
                  // Skip duplicates silently
                }
              }
            }
          }
          
          console.log(`Total imported: ${importedCount} SKUs out of ${uniqueNewSkus.length} attempted`);
        }
        
        // Add history entry
        await addHistory({
          type: 'import',
          message: `Imported ${importedCount} new SKUs (${newSkus.length - importedCount} duplicates skipped)`,
          data: { 
            imported: importedCount, 
            duplicates: newSkus.length - importedCount,
            total: newSkus.length
          }
        });
        
        const updatedSkus = await getSkus();
        
        return res.json({
          success: true,
          imported: importedCount,
          duplicates: newSkus.length - importedCount,
          total: updatedSkus.length
        });
      
      case 'add-sku':
        const { name, category } = body;
        if (!name) {
          return res.status(400).json({ error: 'SKU name is required' });
        }
        
        // Check for duplicates
        const { data: existingSku } = await supabase
          .from('skus')
          .select('id')
          .eq('name', name.trim())
          .single();
        
        if (existingSku) {
          return res.status(400).json({ error: 'SKU already exists' });
        }
        
        const { data: newSku, error } = await supabase
          .from('skus')
          .insert([{
            name: name.trim(),
            category: category?.trim() || null,
            type: 'manual'
          }])
          .select()
          .single();
        
        if (error) throw error;
        
        // Add history entry
        await addHistory({
          type: 'add-sku',
          message: `Added SKU: ${newSku.name}`,
          data: newSku
        });
        
        return res.json({ success: true, sku: newSku });
      
      case 'add-alias':
        const { shipstationSku, quickbooksSku } = body;
        if (!shipstationSku || !quickbooksSku) {
          return res.status(400).json({ error: 'Both SKUs are required' });
        }
        
        // Upsert alias
        const { data: aliasData, error: aliasError } = await supabase
          .from('aliases')
          .upsert([{
            shipstation_sku: shipstationSku.toLowerCase(),
            quickbooks_sku: quickbooksSku,
            updated_at: new Date().toISOString()
          }], {
            onConflict: 'shipstation_sku'
          })
          .select()
          .single();
        
        if (aliasError) throw aliasError;
        
        // Add history entry
        await addHistory({
          type: 'add-alias',
          message: `Added alias: ${shipstationSku} → ${quickbooksSku}`,
          data: { shipstationSku, quickbooksSku }
        });
        
        return res.json({ success: true });
      
      case 'add-history':
        await addHistory(body);
        return res.json({ success: true });
      
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('POST operation error:', error);
    return res.status(500).json({ error: 'Failed to save data', message: error.message });
  }
}

// PUT operations
async function handlePut(req, res, action) {
  const { body } = req;
  
  try {
    switch (action) {
      case 'settings':
        const { data, error } = await supabase
          .from('settings')
          .upsert([{
            inventory_account: body.inventoryAccount || body.inventory_account,
            last_updated: new Date().toISOString()
          }])
          .select()
          .single();
        
        if (error) throw error;
        
        return res.json({ success: true, settings: data });
      
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('PUT operation error:', error);
    return res.status(500).json({ error: 'Failed to update data', message: error.message });
  }
}

// DELETE operations
async function handleDelete(req, res, action) {
  const { id, shipstationSku } = req.query;
  
  try {
    switch (action) {
      case 'sku':
        if (!id) {
          return res.status(400).json({ error: 'SKU ID is required' });
        }
        
        // Get SKU info before deletion for history
        const { data: skuToDelete } = await supabase
          .from('skus')
          .select('name')
          .eq('id', id)
          .single();
        
        const { error } = await supabase
          .from('skus')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        
        if (skuToDelete) {
          await addHistory({
            type: 'delete-sku',
            message: `Deleted SKU: ${skuToDelete.name}`,
            data: skuToDelete
          });
        }
        
        return res.json({ success: true });
      
      case 'alias':
        if (!shipstationSku) {
          return res.status(400).json({ error: 'ShipStation SKU is required' });
        }
        
        // Get alias info before deletion
        const { data: aliasToDelete } = await supabase
          .from('aliases')
          .select('*')
          .eq('shipstation_sku', shipstationSku.toLowerCase())
          .single();
        
        const { error: deleteError } = await supabase
          .from('aliases')
          .delete()
          .eq('shipstation_sku', shipstationSku.toLowerCase());
        
        if (deleteError) throw deleteError;
        
        if (aliasToDelete) {
          await addHistory({
            type: 'delete-alias',
            message: `Deleted alias: ${aliasToDelete.shipstation_sku} → ${aliasToDelete.quickbooks_sku}`,
            data: aliasToDelete
          });
        }
        
        return res.json({ success: true });
      
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('DELETE operation error:', error);
    return res.status(500).json({ error: 'Failed to delete data', message: error.message });
  }
}

// Helper functions
async function getSkus() {
  // Get total count first
  const { count, error: countError } = await supabase
    .from('skus')
    .select('*', { count: 'exact', head: true });
  
  if (countError) throw countError;
  console.log(`Total SKUs in database: ${count}`);
  
  // Fetch all SKUs (Supabase default limit is 1000, so we need to paginate)
  let allSkus = [];
  let from = 0;
  const limit = 1000;
  
  while (from < count) {
    console.log(`Fetching SKUs ${from} to ${from + limit - 1}...`);
    const { data, error } = await supabase
      .from('skus')
      .select('*')
      .order('name', { ascending: true })  // Changed to order by name for consistent pagination
      .range(from, from + limit - 1);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      allSkus = allSkus.concat(data);
      from += limit;
      console.log(`Fetched ${data.length} SKUs, total so far: ${allSkus.length}`);
    } else {
      break; // No more data
    }
  }
  
  console.log(`Final SKU count retrieved: ${allSkus.length}`);
  
  // Verify the count matches
  if (allSkus.length !== count) {
    console.warn(`WARNING: Expected ${count} SKUs but got ${allSkus.length}. Some SKUs may be missing!`);
  }
  
  // Sort by created_at descending after fetching all (for display purposes)
  allSkus.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  return allSkus;
}

async function getAliases() {
  const { data, error } = await supabase
    .from('aliases')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  // Convert to frontend format
  const aliasMap = {};
  data?.forEach(alias => {
    aliasMap[alias.shipstation_sku] = alias.quickbooks_sku;
  });
  
  return aliasMap;
}

async function getHistory() {
  const { data, error } = await supabase
    .from('history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (error) throw error;
  
  // Convert to frontend format
  return (data || []).map(item => ({
    id: item.id,
    type: item.type,
    message: item.message,
    data: item.data || {},
    timestamp: item.created_at
  }));
}

async function getSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .limit(1)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  
  return data ? {
    inventoryAccount: data.inventory_account,
    lastUpdated: data.last_updated
  } : {
    inventoryAccount: '1500 · Inventory',
    lastUpdated: new Date().toISOString()
  };
}

async function addHistory(entry) {
  const { error } = await supabase
    .from('history')
    .insert([{
      type: entry.type,
      message: entry.message,
      data: entry.data || {}
    }]);
  
  if (error) throw error;
}

// Helper function to parse SKU text
function parseSkuText(text) {
  if (!text) return [];
  
  const lines = text.split('\n');
  const skus = [];
  const seenSkus = new Set(); // Track duplicates within the import
  
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
    
    if (name && name.trim()) {
      const normalizedName = name.trim();
      const lowerName = normalizedName.toLowerCase();
      
      // Skip duplicates within the import text
      if (!seenSkus.has(lowerName)) {
        seenSkus.add(lowerName);
        skus.push({
          name: normalizedName,
          category: category || null,
          type: 'imported'
        });
      }
    }
  });
  
  return skus;
}