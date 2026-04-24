CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS bookings (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id          UUID           NOT NULL,
  user_id         UUID           NOT NULL,
  start_time      TIMESTAMPTZ    NOT NULL,
  end_time        TIMESTAMPTZ    NOT NULL,
  total_price     INTEGER        NOT NULL CHECK (total_price > 0),
  status          booking_status NOT NULL DEFAULT 'PENDING',
  kafka_published BOOLEAN        NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Speed up the overlap query
CREATE INDEX IF NOT EXISTS idx_bookings_car_status ON bookings (car_id, status);

-- Database-level guard: no two CONFIRMED bookings for the same car can overlap
ALTER TABLE bookings
  ADD CONSTRAINT no_overlapping_confirmed_bookings
  EXCLUDE USING gist (
    car_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (status = 'CONFIRMED');