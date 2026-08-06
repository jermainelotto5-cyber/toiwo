-- database-schema-v2.sql
-- Adds tables for calendar sync, pricing rules, and editable site content

-- Table to store blocked dates (source and metadata)
CREATE TABLE IF NOT EXISTS blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date date NOT NULL,
  end_date date NOT NULL,
  source text NOT NULL,
  imported_at timestamptz DEFAULT now(),
  metadata jsonb
);

-- Pricing rules for seasonal pricing
CREATE TABLE IF NOT EXISTS pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  multiplier numeric NOT NULL DEFAULT 1.0,
  notes text
);

-- Site content for editable text blocks
CREATE TABLE IF NOT EXISTS site_content (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);
