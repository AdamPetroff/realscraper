ALTER TABLE properties
ADD COLUMN IF NOT EXISTS property_type VARCHAR(50);

ALTER TABLE properties
ALTER COLUMN property_type SET DEFAULT 'apartment';

UPDATE properties
SET property_type = 'apartment'
WHERE property_type IS NULL;
