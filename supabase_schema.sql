-- SQL Schema untuk Supabase (PostgreSQL)
-- Jalankan skrip ini di Supabase SQL Editor jika ingin menggunakan database cloud Supabase!

-- 1. Tabel Events
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  admin_pin TEXT NOT NULL,
  title TEXT NOT NULL,
  pic_name TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  restaurant_name TEXT NOT NULL,
  restaurant_address TEXT,
  tax_config JSONB NOT NULL DEFAULT '{"useTax": true, "taxPercent": 10, "useServiceCharge": false, "serviceChargePercent": 0, "rounding": "none"}'::jsonb,
  menu_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabel Orders
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  service_amount NUMERIC NOT NULL DEFAULT 0,
  rounding_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  payment_method TEXT,
  paid_amount NUMERIC,
  change_amount NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_name)
);

-- Migrasi jika tabel orders sudah dibuat sebelumnya:
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_amount NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS change_amount NUMERIC;

-- Indeks untuk pencarian cepat
CREATE INDEX IF NOT EXISTS idx_orders_event_id ON orders(event_id);

-- Enable Row Level Security (RLS)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Public Policy (Allow read and insert/update for public order links)
CREATE POLICY "Public events access" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public orders access" ON orders FOR ALL USING (true) WITH CHECK (true);
