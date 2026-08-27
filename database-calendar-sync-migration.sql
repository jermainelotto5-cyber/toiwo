-- Calendar-sync compatibility migration
-- Run once in the Supabase SQL Editor before deploying the updated site.

ALTER TABLE blocked_dates
  ADD COLUMN IF NOT EXISTS blocked_date DATE,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS reason VARCHAR(255);

-- Some earlier installations used start_date/end_date ranges. Keep those
-- records, make the range columns optional for new one-day rows, and expand
-- old ranges so the existing check_availability function blocks every night.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'blocked_dates' AND column_name = 'start_date'
  ) THEN
    EXECUTE 'ALTER TABLE blocked_dates ALTER COLUMN start_date DROP NOT NULL';
    EXECUTE 'ALTER TABLE blocked_dates ALTER COLUMN end_date DROP NOT NULL';
    EXECUTE $sql$
      INSERT INTO blocked_dates (property_id, blocked_date, source, reason)
      SELECT b.property_id, day::date, COALESCE(b.source, 'external'), 'Migrated calendar block'
      FROM blocked_dates b
      CROSS JOIN LATERAL generate_series(
        b.start_date,
        COALESCE(b.end_date, b.start_date + 1) - INTERVAL '1 day',
        INTERVAL '1 day'
      ) AS day
      WHERE b.blocked_date IS NULL
        AND b.start_date IS NOT NULL
    $sql$;
  END IF;
END $$;

-- Existing manual blocks already use blocked_date. A source marker lets the
-- sync replace only Airbnb/Booking.com records without deleting manual ones.
UPDATE blocked_dates
SET source = 'manual'
WHERE source IS NULL;

ALTER TABLE blocked_dates
  ALTER COLUMN source SET DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_blocked_dates_property_date
  ON blocked_dates (property_id, blocked_date);
