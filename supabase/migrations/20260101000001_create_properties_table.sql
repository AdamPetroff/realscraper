-- Create properties table for tracking scraped real estate listings
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL,           -- 'idnes', 'bezrealitky', 'sreality', 'bazos'
  source_id VARCHAR(255) NOT NULL,       -- External ID from source site
  title TEXT,
  location TEXT,
  area TEXT,
  rooms TEXT,
  url TEXT NOT NULL,
  price_formatted TEXT,                  -- Display price (e.g., "3 500 000 Kč")
  price_numeric INTEGER,                 -- Numeric price for comparison
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, source_id)
);

-- Create indexes for common queries
CREATE INDEX idx_properties_source ON properties(source);
CREATE INDEX idx_properties_source_id ON properties(source, source_id);
CREATE INDEX idx_properties_last_seen ON properties(last_seen_at);
