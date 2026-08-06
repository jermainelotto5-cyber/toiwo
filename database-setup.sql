-- Supabase Database Setup for Toiwo Residence
-- Project ID: kzpdoxmooddkujtntvlf
-- Execute these queries in your Supabase SQL Editor

-- ========================================
-- 1. PROPERTIES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  description TEXT,
  bedrooms INTEGER,
  beds INTEGER,
  bathrooms INTEGER,
  max_guests INTEGER,
  price_per_night DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  host_name VARCHAR(255),
  host_email VARCHAR(255),
  host_phone VARCHAR(20),
  host_whatsapp VARCHAR(20),
  amenities JSONB,
  photos JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 2. BOOKINGS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  guest_name VARCHAR(255) NOT NULL,
  guest_email VARCHAR(255) NOT NULL,
  guest_phone VARCHAR(20),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  num_guests INTEGER NOT NULL,
  special_requests TEXT,
  total_price DECIMAL(10, 2),
  status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, cancelled, completed
  payment_status VARCHAR(50) DEFAULT 'unpaid', -- unpaid, paid, refunded
  payment_method VARCHAR(50), -- selcom, stripe, etc
  payment_reference VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT check_dates CHECK (check_out > check_in)
);

-- ========================================
-- 3. BLOCKED DATES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS blocked_dates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 4. ADMIN SETTINGS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS admin_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  admin_email VARCHAR(255) NOT NULL,
  gallery_images JSONB,
  contact_phone VARCHAR(20),
  contact_whatsapp VARCHAR(20),
  contact_email VARCHAR(255),
  payment_provider VARCHAR(50),
  payment_merchant_id VARCHAR(255),
  payment_api_key VARCHAR(255),
  payment_button_html TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 5. CONTACT MESSAGES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  sender_name VARCHAR(255) NOT NULL,
  sender_email VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 6. CREATE INDEXES
-- ========================================
CREATE INDEX IF NOT EXISTS idx_bookings_property ON bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_check_in ON bookings(check_in);
CREATE INDEX IF NOT EXISTS idx_bookings_check_out ON bookings(check_out);
CREATE INDEX IF NOT EXISTS idx_blocked_dates_property ON blocked_dates(property_id);
CREATE INDEX IF NOT EXISTS idx_blocked_dates_date ON blocked_dates(blocked_date);

-- ========================================
-- 7. ENABLE RLS (Row Level Security)
-- ========================================
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 8. RLS POLICIES - PROPERTIES (Public Read)
-- ========================================
CREATE POLICY "Allow public read properties" ON properties
  FOR SELECT USING (true);

-- ========================================
-- 9. RLS POLICIES - BOOKINGS
-- ========================================
-- Guests can read their own bookings by email
CREATE POLICY "Allow guests read own bookings" ON bookings
  FOR SELECT USING (guest_email = current_user_email() OR auth.uid() IS NULL);

-- Guests can create bookings
CREATE POLICY "Allow guests create bookings" ON bookings
  FOR INSERT WITH CHECK (true);

-- Admin can read/update all bookings (requires auth)
CREATE POLICY "Admin can manage bookings" ON bookings
  FOR ALL USING (
    auth.uid() IN (
      SELECT auth.uid() FROM admin_settings 
      WHERE admin_email = auth.email()
    )
  );

-- ========================================
-- 10. RLS POLICIES - BLOCKED DATES (Public Read)
-- ========================================
CREATE POLICY "Allow public read blocked dates" ON blocked_dates
  FOR SELECT USING (true);

-- Admin can manage blocked dates
CREATE POLICY "Admin can manage blocked dates" ON blocked_dates
  FOR ALL USING (
    auth.uid() IN (
      SELECT auth.uid() FROM admin_settings 
      WHERE admin_email = auth.email()
    )
  );

-- ========================================
-- 11. RLS POLICIES - ADMIN SETTINGS
-- ========================================
-- Admin can read/update own settings
CREATE POLICY "Admin can manage settings" ON admin_settings
  FOR ALL USING (admin_email = auth.email());

-- ========================================
-- 12. RLS POLICIES - CONTACT MESSAGES
-- ========================================
-- Allow public to create messages
CREATE POLICY "Allow public create messages" ON contact_messages
  FOR INSERT WITH CHECK (true);

-- Admin can read messages
CREATE POLICY "Admin can read messages" ON contact_messages
  FOR SELECT USING (
    auth.uid() IN (
      SELECT auth.uid() FROM admin_settings 
      WHERE admin_email = auth.email()
    )
  );

-- ========================================
-- 13. INSERT DEFAULT PROPERTY
-- ========================================
INSERT INTO properties (
  name, location, description, bedrooms, beds, bathrooms, max_guests,
  price_per_night, host_name, host_email, host_phone, host_whatsapp,
  amenities, photos
) VALUES (
  'Toiwo Residence',
  'Ilboru, Arusha, Tanzania',
  'A four-bedroom residence in Ilboru, designed for slow mornings, family stays, and easy safari stopovers.',
  4, 4, 3, 8,
  180.00,
  'Jessica Lotto Mollel',
  'jermainelotto5@gmail.com',
  '+255718654332',
  '+255718654332',
  '["Fast Wi-Fi", "Full Kitchen", "Private Parking", "Hot Water", "Flat-Screen TV", "Washing Machine", "Night Security", "Private Garden"]'::jsonb,
  '[]'::jsonb
) ON CONFLICT DO NOTHING;

-- ========================================
-- 14. INSERT DEFAULT ADMIN SETTINGS
-- ========================================
INSERT INTO admin_settings (
  property_id, admin_email, contact_phone, contact_whatsapp, contact_email, gallery_images
) 
SELECT id, 'jermainelotto5@gmail.com', '+255718654332', '+255718654332', 'jermainelotto5@gmail.com', '[]'::jsonb
FROM properties WHERE name = 'Toiwo Residence'
ON CONFLICT DO NOTHING;

-- ========================================
-- 15. CREATE FUNCTION FOR AVAILABILITY CHECK
-- ========================================
CREATE OR REPLACE FUNCTION check_availability(
  property_id UUID,
  check_in_date DATE,
  check_out_date DATE
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM bookings
    WHERE property_id = $1
    AND status IN ('confirmed', 'pending')
    AND (
      (check_in < $3 AND check_out > $2)
    )
  ) AND NOT EXISTS (
    SELECT 1 FROM blocked_dates
    WHERE property_id = $1
    AND blocked_date BETWEEN $2 AND ($3 - INTERVAL '1 day')
  );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 16. CREATE FUNCTION FOR CALCULATING NIGHTS
-- ========================================
CREATE OR REPLACE FUNCTION calculate_nights(
  check_in_date DATE,
  check_out_date DATE
)
RETURNS INTEGER AS $$
BEGIN
  RETURN (check_out_date - check_in_date);
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 17. GRANT PERMISSIONS
-- ========================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION check_availability(UUID, DATE, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION calculate_nights(DATE, DATE) TO anon, authenticated;
