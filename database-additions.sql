-- Toiwo Residence additional schema additions

-- 1. Site Settings
CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  base_price DECIMAL(10,2) DEFAULT 180.00,
  payment_provider_config JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO site_settings (phone, whatsapp, email)
SELECT '+255 718 654 332', '+255 718 654 332', 'jermainelotto5@gmail.com'
WHERE NOT EXISTS (SELECT 1 FROM site_settings);

-- 2. Property Images
CREATE TABLE IF NOT EXISTS property_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  image_url TEXT,
  caption TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Contact Messages
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS and policies
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Allow guests to view settings
CREATE POLICY IF NOT EXISTS "Allow guests to view settings" ON site_settings FOR SELECT USING (true);
-- Allow admin to update settings: replace condition with your admin check (email list or admins table)
CREATE POLICY IF NOT EXISTS "Allow admin to update settings" ON site_settings FOR UPDATE USING (auth.role() = 'authenticated');

-- Policy for property_images
CREATE POLICY IF NOT EXISTS "Guests view images" ON property_images FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Admin manage images" ON property_images FOR ALL USING (auth.role() = 'authenticated');

-- Policy for contact_messages
CREATE POLICY IF NOT EXISTS "Guests insert messages" ON contact_messages FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Admin view messages" ON contact_messages FOR SELECT USING (auth.role() = 'authenticated');

-- Notes:
-- - Review and adjust the RLS policies to match your admin model (e.g., check auth.email() or an admins table)
-- - Run this script in the Supabase SQL editor for project kzpdoxmooddkujtntvlf
