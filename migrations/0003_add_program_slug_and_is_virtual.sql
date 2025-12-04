-- Add slug and is_virtual columns to programs table
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS slug VARCHAR(100),
ADD COLUMN IF NOT EXISTS is_virtual BOOLEAN DEFAULT false;

-- Create unique constraint on organization_id + slug combination
CREATE UNIQUE INDEX IF NOT EXISTS programs_org_slug_unique ON programs(organization_id, slug) WHERE slug IS NOT NULL;

