-- ========================================
-- Toiwo Residence - Schema Additions v2
-- ========================================
-- Run these queries in your Supabase SQL Editor.

-- 1. Add Update Policy for properties table
-- This allows authenticated admins (whose email matches the admin_settings table) to update property info like description, amenities, and price.
CREATE POLICY "Admin can update properties" ON properties
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT auth.uid() FROM admin_settings 
      WHERE admin_email = auth.email()
    )
  );

-- 2. Add custom/seasonal pricing rules table
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

-- Index for efficient date lookups on pricing
CREATE INDEX IF NOT EXISTS idx_pricing_rules_dates ON pricing_rules(start_date, end_date);

-- Enable RLS for pricing rules
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;

-- Allow public read of pricing rules (so guest booking form knows custom rates)
CREATE POLICY "Allow public read pricing rules" ON pricing_rules
  FOR SELECT USING (true);

-- Allow admins to manage pricing rules
CREATE POLICY "Admin can manage pricing rules" ON pricing_rules
  FOR ALL USING (
    auth.uid() IN (
      SELECT auth.uid() FROM admin_settings 
      WHERE admin_email = auth.email()
    )
  );

-- 3. Add iCal sync fields to admin_settings table
ALTER TABLE admin_settings 
  ADD COLUMN IF NOT EXISTS airbnb_ical_import_url TEXT,
  ADD COLUMN IF NOT EXISTS airbnb_ical_export_uuid UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS booking_ical_import_url TEXT,
  ADD COLUMN IF NOT EXISTS booking_ical_export_uuid UUID DEFAULT gen_random_uuid();

-- 4. Enable RLS select policy for admin_settings so public can select if necessary (e.g. to fetch non-sensitive config, but keep API keys hidden)
-- Let's make sure admin settings select is accessible to logged in admin. Actually the existing select is "Admin can manage settings" for SELECT/ALL: admin_email = auth.email()
-- Let's add a public select policy that only exposes non-sensitive settings (like whatsapp/phone, export UUIDs) or just keep select admin-only since public details are rendered from property details or base values. Let's keep it admin-only for safety.

-- 5. Grant access to public/anon on pricing_rules
GRANT SELECT ON TABLE pricing_rules TO anon, authenticated;
