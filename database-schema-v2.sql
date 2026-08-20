-- ========================================
-- Toiwo Residence - Schema Additions v2
-- ========================================
-- Run these queries in your Supabase SQL Editor.

-- 1. Add Update Policy for properties table
CREATE POLICY "Admin can update properties" ON properties
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT auth.uid() FROM admin_settings
      WHERE admin_email = auth.email()
    )
  );

-- 2. Blocked dates for imported calendars and manual restrictions
CREATE TABLE IF NOT EXISTS blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  source text NOT NULL,
  imported_at timestamptz DEFAULT now(),
  metadata jsonb
);

-- 3. Pricing rules for seasonal and custom pricing
CREATE TABLE IF NOT EXISTS pricing_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  price_per_night DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT check_pricing_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_dates ON pricing_rules(start_date, end_date);
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read pricing rules" ON pricing_rules
  FOR SELECT USING (true);

CREATE POLICY "Admin can manage pricing rules" ON pricing_rules
  FOR ALL USING (
    auth.uid() IN (
      SELECT auth.uid() FROM admin_settings
      WHERE admin_email = auth.email()
    )
  );

-- 4. Editable site content blocks
CREATE TABLE IF NOT EXISTS site_content (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- 5. Add iCal sync fields to admin settings
ALTER TABLE admin_settings
  ADD COLUMN IF NOT EXISTS airbnb_ical_import_url TEXT,
  ADD COLUMN IF NOT EXISTS airbnb_ical_export_uuid UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS booking_ical_import_url TEXT,
  ADD COLUMN IF NOT EXISTS booking_ical_export_uuid UUID DEFAULT gen_random_uuid();

-- 6. Public read access to pricing rules
GRANT SELECT ON TABLE pricing_rules TO anon, authenticated;
