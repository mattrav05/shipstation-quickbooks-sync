import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database helper functions
export const db = {
  // SKUs table operations
  async getSkus() {
    const { data, error } = await supabase
      .from('skus')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async addSku(sku) {
    const { data, error } = await supabase
      .from('skus')
      .insert([{
        name: sku.name,
        category: sku.category,
        type: sku.type || 'manual',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async addSkus(skus) {
    const { data, error } = await supabase
      .from('skus')
      .insert(skus.map(sku => ({
        name: sku.name,
        category: sku.category,
        type: sku.type || 'imported',
        created_at: new Date().toISOString()
      })))
      .select();
    
    if (error) throw error;
    return data || [];
  },

  async deleteSku(id) {
    const { error } = await supabase
      .from('skus')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  },

  // Aliases table operations
  async getAliases() {
    const { data, error } = await supabase
      .from('aliases')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Convert to the format expected by the frontend
    const aliasMap = {};
    data?.forEach(alias => {
      aliasMap[alias.shipstation_sku.toLowerCase()] = alias.quickbooks_sku;
    });
    
    return aliasMap;
  },

  async addAlias(shipstationSku, quickbooksSku) {
    // First, check if alias already exists
    const { data: existing } = await supabase
      .from('aliases')
      .select('id')
      .eq('shipstation_sku', shipstationSku.toLowerCase())
      .single();

    if (existing) {
      // Update existing alias
      const { data, error } = await supabase
        .from('aliases')
        .update({
          quickbooks_sku: quickbooksSku,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } else {
      // Create new alias
      const { data, error } = await supabase
        .from('aliases')
        .insert([{
          shipstation_sku: shipstationSku.toLowerCase(),
          quickbooks_sku: quickbooksSku,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  },

  async deleteAlias(shipstationSku) {
    const { error } = await supabase
      .from('aliases')
      .delete()
      .eq('shipstation_sku', shipstationSku.toLowerCase());
    
    if (error) throw error;
    return true;
  },

  // History table operations
  async getHistory() {
    const { data, error } = await supabase
      .from('history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) throw error;
    return data || [];
  },

  async addHistory(entry) {
    const { data, error } = await supabase
      .from('history')
      .insert([{
        type: entry.type,
        message: entry.message,
        data: entry.data || {},
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Settings operations
  async getSettings() {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    
    return data || {
      inventory_account: '1500 · Inventory',
      last_updated: new Date().toISOString()
    };
  },

  async updateSettings(settings) {
    // Check if settings row exists
    const { data: existing } = await supabase
      .from('settings')
      .select('id')
      .limit(1)
      .single();

    const settingsData = {
      inventory_account: settings.inventoryAccount || settings.inventory_account,
      last_updated: new Date().toISOString(),
      ...settings
    };

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('settings')
        .update(settingsData)
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } else {
      // Create new
      const { data, error } = await supabase
        .from('settings')
        .insert([settingsData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  }
};