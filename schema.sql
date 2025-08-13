-- ShipStation QuickBooks Sync Database Schema

-- SKUs table - stores QuickBooks inventory items
CREATE TABLE IF NOT EXISTS skus (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  type TEXT DEFAULT 'manual' CHECK (type IN ('manual', 'imported')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aliases table - maps ShipStation SKUs to QuickBooks SKUs
CREATE TABLE IF NOT EXISTS aliases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shipstation_sku TEXT NOT NULL UNIQUE,
  quickbooks_sku TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- History table - tracks all user actions and sync history
CREATE TABLE IF NOT EXISTS history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settings table - stores application settings
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_account TEXT DEFAULT '1500 - Inventory',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_skus_name ON skus(name);
CREATE INDEX IF NOT EXISTS idx_skus_type ON skus(type);
CREATE INDEX IF NOT EXISTS idx_aliases_shipstation ON aliases(shipstation_sku);
CREATE INDEX IF NOT EXISTS idx_history_type ON history(type);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at DESC);

-- Row Level Security (RLS) policies
ALTER TABLE skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (you can make this more restrictive later)
CREATE POLICY "Enable all operations for authenticated users" ON skus
  FOR ALL USING (true);

CREATE POLICY "Enable all operations for authenticated users" ON aliases
  FOR ALL USING (true);

CREATE POLICY "Enable all operations for authenticated users" ON history
  FOR ALL USING (true);

CREATE POLICY "Enable all operations for authenticated users" ON settings
  FOR ALL USING (true);

-- Insert default settings
INSERT INTO settings (inventory_account) 
VALUES ('1500 - Inventory')
ON CONFLICT DO NOTHING;