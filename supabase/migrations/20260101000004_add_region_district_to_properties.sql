ALTER TABLE properties
ADD COLUMN IF NOT EXISTS district TEXT,
ADD COLUMN IF NOT EXISTS region TEXT;

CREATE INDEX IF NOT EXISTS idx_properties_district ON properties(district);
CREATE INDEX IF NOT EXISTS idx_properties_region ON properties(region);
