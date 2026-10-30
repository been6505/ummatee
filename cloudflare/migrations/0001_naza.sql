-- ระบบจองตั๋ว NAZA for GAZA บน Cloudflare D1 (แทน nazaBookings / nazaSeats / config/nazaEvent ใน Firestore)
-- ใช้: npx wrangler d1 migrations apply ummatee --remote

CREATE TABLE IF NOT EXISTS naza_bookings (
  id            TEXT PRIMARY KEY,          -- สุ่ม 20 ตัว ใช้เป็นลิงก์ตั๋ว (/events/Naza?t=<id>) — เดาไม่ได้
  code          TEXT NOT NULL UNIQUE,      -- NZ-XXXXX ที่คนอ่านหน้างาน
  round         TEXT NOT NULL,
  seats         TEXT NOT NULL,             -- JSON array เช่น ["A1","C3"]
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL,
  email         TEXT NOT NULL,
  amount        INTEGER NOT NULL,
  slip_key      TEXT,                      -- key ของไฟล์สลิปใน R2 (bucket ส่วนตัว — เปิดได้เฉพาะแอดมิน)
  slip_url      TEXT,                      -- การจองที่ย้ายมาจาก Firestore ยังเป็นลิงก์ Cloudinary
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  created_at    INTEGER NOT NULL,          -- ms since epoch
  reviewed_at   INTEGER,
  reviewed_by   TEXT,
  checked_in_at INTEGER,
  checked_in_by TEXT,
  admin_note    TEXT
);
CREATE INDEX IF NOT EXISTS naza_bookings_status ON naza_bookings (status);

-- หนึ่งแถว = ที่นั่งหนึ่งที่ที่ถูกถือไว้ — PRIMARY KEY (round, seat) ทำให้ "จองที่นั่งเดียวกันซ้ำ" เป็นไปไม่ได้ในระดับฐานข้อมูล
-- (สร้างที่นั่งกับการจองใน batch เดียว ถ้าที่นั่งไหนชน ทั้ง batch ถูกยกเลิก)
CREATE TABLE IF NOT EXISTS naza_seats (
  round      TEXT NOT NULL,
  seat       TEXT NOT NULL,
  booking_id TEXT NOT NULL REFERENCES naza_bookings (id),
  status     TEXT NOT NULL DEFAULT 'pending',
  at         INTEGER NOT NULL,
  PRIMARY KEY (round, seat)
);
CREATE INDEX IF NOT EXISTS naza_seats_booking ON naza_seats (booking_id);

CREATE TABLE IF NOT EXISTS naza_config (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  data       TEXT NOT NULL,                -- JSON: price, maxSeats, promptpay, accountName, closed
  updated_at INTEGER,
  updated_by TEXT
);
