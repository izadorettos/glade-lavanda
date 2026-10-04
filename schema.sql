CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_cep TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('pix', 'card')),
  card_last4 TEXT,
  amount_cents INTEGER NOT NULL
);
