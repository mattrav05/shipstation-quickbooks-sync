-- Add full_path column to skus table to store complete QuickBooks item hierarchy
ALTER TABLE skus 
ADD COLUMN IF NOT EXISTS full_path TEXT;

-- Update existing records to use name as full_path if not set
UPDATE skus 
SET full_path = name 
WHERE full_path IS NULL;