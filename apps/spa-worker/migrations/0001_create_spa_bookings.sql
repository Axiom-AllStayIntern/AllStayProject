CREATE TABLE IF NOT EXISTS spa_bookings (
  confirmation_code TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  booking_date TEXT NOT NULL,
  booking_time TEXT NOT NULL,
  therapist_gender_preference TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_spa_bookings_availability
  ON spa_bookings (service_id, booking_date, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_spa_bookings_confirmed_slot
  ON spa_bookings (service_id, booking_date, booking_time)
  WHERE status = 'confirmed';
