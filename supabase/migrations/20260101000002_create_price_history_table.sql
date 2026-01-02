-- Create price_history table for tracking price changes over time
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  price_formatted TEXT,
  price_numeric INTEGER,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for property lookups
CREATE INDEX idx_price_history_property_id ON price_history(property_id);
CREATE INDEX idx_price_history_recorded_at ON price_history(recorded_at);
