-- invoices_schema_adjusted_for_ocr.sql
-- PostgreSQL-compatible schema. Minimal changes from original; added OCR-related fields and a few small improvements.

BEGIN;

-- Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  gst_number VARCHAR(20),
  address TEXT,
  locale VARCHAR(10) DEFAULT 'en-IN',
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Branches Table
CREATE TABLE IF NOT EXISTS branches (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  address TEXT,
  gst_number VARCHAR(20),
  state_code CHAR(2),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id BIGINT REFERENCES branches(id),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('admin', 'accountant', 'sales')),
  locale VARCHAR(10) DEFAULT 'en-IN',
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Customers Table (added shipping_address separate to preserve OCR shipping details)
CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id BIGINT REFERENCES branches(id),
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(150),
  address TEXT,            -- billing / primary address
  shipping_address TEXT,   -- extracted shipping address if different
  gstin VARCHAR(15),
  state_code CHAR(2),
  meta JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id BIGINT REFERENCES branches(id),
  name VARCHAR(150) NOT NULL,
  hsn_sac_code VARCHAR(20),
  price NUMERIC(12,2) NOT NULL,
  expected_gst_rate NUMERIC(5,2) DEFAULT 0,
  stock INT DEFAULT 0,
  meta JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Invoices Table
-- Added OCR-related fields, challan fields, bank/transport JSON, total_in_words, anomalies
CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id BIGINT REFERENCES branches(id),
  customer_id BIGINT REFERENCES customers(id),
  created_by BIGINT REFERENCES users(id),
  invoice_number VARCHAR(120),                          -- allow larger/weird OCR strings
  invoice_type VARCHAR(20) CHECK (invoice_type IN ('GST', 'Non-GST')),
  issue_date DATE NOT NULL,
  due_date DATE,
  challan_number VARCHAR(80),
  challan_date DATE,
  ewaybill_no VARCHAR(80),
  taxable_value NUMERIC(14,2) DEFAULT 0,
  cgst_amount NUMERIC(14,2) DEFAULT 0,
  sgst_amount NUMERIC(14,2) DEFAULT 0,
  igst_amount NUMERIC(14,2) DEFAULT 0,
  cess_amount NUMERIC(14,2) DEFAULT 0,
  discount_amount NUMERIC(14,2) DEFAULT 0,
  rounding NUMERIC(12,2) DEFAULT 0,
  net_amount NUMERIC(14,2) NOT NULL,
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partial')),
  place_of_supply_state CHAR(2),
  pdf_url TEXT,
  total_in_words TEXT,
  bank_details JSONB DEFAULT '{}'::JSONB,        -- store parsed bank details
  transport_details JSONB DEFAULT '{}'::JSONB,   -- store transport/GSTR-related info
  raw_ocr_text TEXT,                              -- store raw OCR dump for traceability
  ocr_extracted JSONB DEFAULT '{}'::JSONB,        -- structured OCR-parsed JSON
  ocr_confidence NUMERIC(5,4),                    -- average confidence (0.0 - 1.0)
  source_file TEXT,                               -- filename or storage key
  page_no INT DEFAULT 0,
  anomalies JSONB DEFAULT '[]'::JSONB,            -- array of anomaly/warnings discovered by post-processing
  meta JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  CONSTRAINT invoices_invoice_number_unique UNIQUE (invoice_number)  -- invoice_number can be NULL; unique for non-null
);

-- Invoice Items Table
-- Added unit, unit_price, gst_amount, cess_amount and a raw OCR line field
CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id),
  description VARCHAR(1000),
  ocr_line TEXT,                 -- store original OCR line for debugging / re-parsing
  hsn_sac_code VARCHAR(20),
  qty NUMERIC(18,6) NOT NULL DEFAULT 0,
  unit VARCHAR(30),
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  price NUMERIC(14,2) NOT NULL DEFAULT 0,  -- legacy column (per-item/unit price or price used in earlier schema)
  applied_gst_rate NUMERIC(6,3) DEFAULT 0,
  gst_amount NUMERIC(14,2) DEFAULT 0,
  cess_amount NUMERIC(14,2) DEFAULT 0,
  line_discount NUMERIC(14,2) DEFAULT 0,
  line_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  meta JSONB DEFAULT '{}'::JSONB
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  method VARCHAR(30),
  provider VARCHAR(50),
  txn_id VARCHAR(120),
  status VARCHAR(20) CHECK (status IN ('success', 'pending', 'failed')),
  amount NUMERIC(14,2),
  received_at TIMESTAMP WITHOUT TIME ZONE,
  meta JSONB DEFAULT '{}'::JSONB
);

-- Vendors Table (added PAN and contact_person)
CREATE TABLE IF NOT EXISTS vendors (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id BIGINT REFERENCES branches(id),
  name VARCHAR(150) NOT NULL,
  gstin VARCHAR(15),
  pan VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(150),
  address TEXT,
  state_code CHAR(2),
  contact_person VARCHAR(150),
  meta JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id BIGINT REFERENCES branches(id),
  category VARCHAR(100),
  vendor VARCHAR(150),
  vendor_id BIGINT REFERENCES vendors(id),
  amount NUMERIC(14,2),
  gst_percent NUMERIC(6,3),
  expense_date DATE,
  notes TEXT,
  purchase_bill_id BIGINT,
  meta JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Purchase Bills Table (kept same but ensured updated_at exists)
CREATE TABLE IF NOT EXISTS purchase_bills (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id BIGINT REFERENCES branches(id),
  vendor_id BIGINT REFERENCES vendors(id),
  uploaded_by BIGINT REFERENCES users(id),
  bill_number VARCHAR(80),
  bill_date DATE,
  raw_text TEXT,
  structured_json JSONB DEFAULT '{}'::JSONB,
  file_url TEXT,
  status VARCHAR(20),
  subtotal NUMERIC(14,2),
  cgst_amount NUMERIC(14,2),
  sgst_amount NUMERIC(14,2),
  igst_amount NUMERIC(14,2),
  discount_amount NUMERIC(14,2),
  rounding NUMERIC(12,2),
  net_amount NUMERIC(14,2),
  meta JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Purchase Bill Items
CREATE TABLE IF NOT EXISTS purchase_bill_items (
  id BIGSERIAL PRIMARY KEY,
  purchase_bill_id BIGINT NOT NULL REFERENCES purchase_bills(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id),
  description VARCHAR(1000),
  qty NUMERIC(18,6),
  price NUMERIC(14,2),
  applied_gst_rate NUMERIC(6,3),
  line_discount NUMERIC(14,2),
  line_total NUMERIC(14,2),
  meta JSONB DEFAULT '{}'::JSONB
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id),
  action VARCHAR(200),
  entity VARCHAR(80),
  entity_id BIGINT,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- E-way Bills Table
CREATE TABLE IF NOT EXISTS ewaybills (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id BIGINT REFERENCES branches(id),
  invoice_id BIGINT REFERENCES invoices(id),
  generated_by BIGINT REFERENCES users(id),
  ewaybill_no VARCHAR(80),
  file_url TEXT,
  status VARCHAR(20),
  meta JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- OCR extraction history table (optional but useful to store multiple OCR attempts / versions)
CREATE TABLE IF NOT EXISTS invoice_ocr_extractions (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT REFERENCES invoices(id) ON DELETE SET NULL,
  source_file TEXT,
  page_no INT,
  raw_ocr_text TEXT,
  extracted_json JSONB DEFAULT '{}'::JSONB,
  ocr_confidence NUMERIC(5,4),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_org ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_ocr_conf ON invoices(ocr_confidence);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- Trigger function to update updated_at timestamp on change (for invoices and purchase_bills)
CREATE OR REPLACE FUNCTION trg_set_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Attach trigger for invoices and purchase_bills
DROP TRIGGER IF EXISTS set_timestamp_invoices ON invoices;
CREATE TRIGGER set_timestamp_invoices
BEFORE UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION trg_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_purchase_bills ON purchase_bills;
CREATE TRIGGER set_timestamp_purchase_bills
BEFORE UPDATE ON purchase_bills
FOR EACH ROW
EXECUTE FUNCTION trg_set_timestamp();

-- (Optional) small data integrity helpers
-- Example: ensure net_amount = taxable + total_tax - discount + rounding (can't enforce always; keep as check suggestion)
-- We avoid strict CHECKs that will fail on messy OCR-derived data; downstream validation should populate anomalies JSONB.

COMMIT;

-- End of schema file
