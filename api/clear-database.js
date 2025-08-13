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

  // Only allow POST requests for safety
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Clearing all database tables...');

    // Clear all tables in order (due to foreign key constraints)
    const tables = ['history', 'aliases', 'skus', 'settings'];
    const results = {};

    for (const table of tables) {
      console.log(`Clearing table: ${table}`);
      const { data, error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows (dummy condition)
      
      if (error) {
        console.error(`Error clearing ${table}:`, error);
        results[table] = { success: false, error: error.message };
      } else {
        console.log(`Cleared table: ${table}`);
        results[table] = { success: true };
      }
    }

    // Insert default settings
    console.log('Inserting default settings...');
    const { error: settingsError } = await supabase
      .from('settings')
      .insert([{
        inventory_account: '1500 - Inventory'
      }]);

    if (settingsError) {
      console.error('Error inserting default settings:', settingsError);
      results.settings = { success: false, error: settingsError.message };
    } else {
      results.settings = { success: true, message: 'Default settings inserted' };
    }

    console.log('Database cleared successfully');

    return res.json({
      success: true,
      message: 'Database cleared successfully',
      results
    });

  } catch (error) {
    console.error('Database clear error:', error);
    return res.status(500).json({
      error: 'Failed to clear database',
      message: error.message
    });
  }
};