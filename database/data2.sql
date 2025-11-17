-- =============================================
-- SEED DATA – 100 % psql-compatible
-- =============================================
BEGIN;

-- -------------------------------------------------
-- 1. ORGANIZATION
-- -------------------------------------------------
WITH ins AS (
  INSERT INTO organizations (name, gst_number, address, locale)
  VALUES (
    'Precision Auto Components Pvt. Ltd.',
    '27AAECP8765H1Z2',
    'Plot No. 42, MIDC Industrial Area, Andheri East, Mumbai, Maharashtra - 400093',
    'en-IN'
  )
  RETURNING id
)
SELECT set_config('my.org_id', id::text, true) FROM ins;

-- -------------------------------------------------
-- 2. PRIMARY BRANCH
-- -------------------------------------------------
WITH ins AS (
  INSERT INTO branches (organization_id, name, address, gst_number, state_code)
  VALUES (
    current_setting('my.org_id')::bigint,
    'Mumbai Manufacturing Unit',
    'Plot No. 42, MIDC Industrial Area, Andheri East, Mumbai, Maharashtra - 400093',
    '27AAECP8765H1Z2',
    '27'
  )
  RETURNING id
)
SELECT set_config('my.branch_id', id::text, true) FROM ins;

-- -------------------------------------------------
-- 3. USERS (admin, accountant, sales)
-- -------------------------------------------------
INSERT INTO users (organization_id, branch_id, name, email, password_hash, role, locale)
VALUES
(
  current_setting('my.org_id')::bigint,
  current_setting('my.branch_id')::bigint,
  'Rohan Malhotra',
  'rohan.malhotra@precisionauto.in',
  'Precision@2025', -- Precision@2025
  'admin','en-IN'
),
(
  current_setting('my.org_id')::bigint,
  current_setting('my.branch_id')::bigint,
  'Priya Sharma',
  'priya.sharma@precisionauto.in',
  '$TaxPro@2025', -- TaxPro@2025 TaxPro@2025
  'accountant','en-IN'
),
(
  current_setting('my.org_id')::bigint,
  current_setting('my.branch_id')::bigint,
  'Vikram Singh',
  'vikram.singh@precisionauto.in',
  'SalesStar@2025', -- Sales2025
  'sales','en-IN'
);

-- -------------------------------------------------
-- 4. CUSTOMERS
-- -------------------------------------------------
INSERT INTO customers (organization_id, branch_id, name, phone, email,
                       address, shipping_address, gstin, state_code, meta)
VALUES
(
  current_setting('my.org_id')::bigint,
  current_setting('my.branch_id')::bigint,
  'Mahindra & Mahindra Ltd.',
  '+91-22-6247-1000','procurement@mahindra.com',
  'Mahindra Towers, Dr. G M Bhosale Marg, Worli, Mumbai, Maharashtra - 400018',
  'Gate No. 2, Chakan Plant, Pune, Maharashtra - 410501',
  '27AABCM5509K1Z3','27',
  '{"industry":"Automotive OEM","credit_days":30,"preferred_payment":"NEFT"}'
),
(
  current_setting('my.org_id')::bigint,
  current_setting('my.branch_id')::bigint,
  'Tata Motors Limited',
  '+91-20-6613-4000','purchase.tatamotors@tata.com',
  'Bombay House, 24 Homi Mody Street, Mumbai, Maharashtra - 400001',
  'Pimpri-Chinchwad Plant, Pune, Maharashtra - 411018',
  '27AAACT2727Q1ZA','27',
  '{"industry":"Commercial Vehicles","credit_days":45,"contact_person":"Amit Desai"}'
),
(
  current_setting('my.org_id')::bigint,
  current_setting('my.branch_id')::bigint,
  'Bajaj Auto Ltd.',
  '+91-20-2747-2851','vendor@bajajauto.co.in',
  'Mumbai-Pune Road, Akurdi, Pune, Maharashtra - 411035',
  NULL,'27AAACB4536H1Z0','27',
  '{"industry":"Two-Wheelers","credit_days":30}'
);

-- -------------------------------------------------
-- 5. PRODUCTS
-- -------------------------------------------------
INSERT INTO products (organization_id, branch_id, name, hsn_sac_code,
                      price, expected_gst_rate, stock, meta)
VALUES
(
  current_setting('my.org_id')::bigint,
  current_setting('my.branch_id')::bigint,
  'Aluminum Die-Cast Housing (ADC12)','76169990',
  285.00,18.00,850,
  '{"uom":"Nos","material":"ADC12","weight_kg":0.85}'
),
(
  current_setting('my.org_id')::bigint,
  current_setting('my.branch_id')::bigint,
  'Precision CNC Machined Shaft','84831091',
  1180.50,18.00,320,
  '{"uom":"Nos","tolerance":"±0.01mm","material":"EN19"}'
),
(
  current_setting('my.org_id')::bigint,
  current_setting('my.branch_id')::bigint,
  'Rubber Gasket Set (EPDM)','40169330',
  42.75,18.00,2400,
  '{"uom":"Sets","pack_size":10}'
),
(
  current_setting('my.org_id')::bigint,
  current_setting('my.branch_id')::bigint,
  'Bearing Assembly (6205ZZ)','84821020',
  156.00,18.00,1200,
  '{"uom":"Nos","brand":"NBC"}'
);

-- -------------------------------------------------
-- 6. INVOICE #1 (GST – OCR)
-- -------------------------------------------------
WITH ins AS (
  INSERT INTO invoices (
    organization_id, branch_id, customer_id, created_by,
    invoice_number, invoice_type, issue_date, due_date,
    challan_number, challan_date, ewaybill_no,
    taxable_value, cgst_amount, sgst_amount, igst_amount, cess_amount,
    discount_amount, rounding, net_amount,
    payment_status, place_of_supply_state,
    pdf_url, total_in_words,
    bank_details, transport_details,
    raw_ocr_text, ocr_extracted, ocr_confidence,
    source_file, page_no, anomalies, meta
  ) VALUES (
    current_setting('my.org_id')::bigint,
    current_setting('my.branch_id')::bigint,
    (SELECT id FROM customers WHERE name='Mahindra & Mahindra Ltd.'),
    (SELECT id FROM users WHERE email='vikram.singh@precisionauto.in'),
    'PAC/2425/00127','GST','2025-10-18','2025-11-17',
    'CH/2425/089','2025-10-17','271234567890',
    42500.00,3825.00,3825.00,0.00,0.00,
    850.00,0.00,46300.00,
    'paid','27',
    's3://invoices/2025/10/PAC_2425_00127.pdf',
    'Rupees Forty Six Thousand Three Hundred Only',
    '{"bank":"HDFC Bank","account":"50200012345678","ifsc":"HDFC0000123","branch":"Andheri East"}',
    '{"mode":"Road","vehicle":"MH04GT5678","lr_no":"MUM-PUN-1018","driver":"Ramesh Kumar"}',
    '... [simulated raw OCR text dump] ...',
    '{"extracted_at":"2025-10-18T14:22:10Z","engine":"Google Vision","version":"v2"}',
    0.9421,
    'uploaded_scans/october_batch/PAC_2425_00127.pdf',
    1,
    '[{"code":"LOW_CONFIDENCE_GSTIN","field":"customer_gstin","confidence":0.78,"suggested":"27AABCM5509K1Z3"}]',
    '{"ocr_processed":true,"ewaybill_generated":true}'
  )
  RETURNING id
)
SELECT set_config('my.inv1_id', id::text, true) FROM ins;

-- Invoice #1 items
INSERT INTO invoice_items (
  invoice_id, product_id, description, ocr_line,
  hsn_sac_code, qty, unit, unit_price, price,
  applied_gst_rate, gst_amount, cess_amount,
  line_discount, line_total, meta
) VALUES
(
  current_setting('my.inv1_id')::bigint,
  (SELECT id FROM products WHERE name='Aluminum Die-Cast Housing (ADC12)'),
  'Aluminum Die-Cast Housing (ADC12) - Part # PH-404',
  '1. Aluminum Die-Cast Housing (ADC12)  50 Nos @ 285.00  14250.00',
  '76169990',50,'Nos',285.00,285.00,
  18.000,2565.00,0.00,0.00,14250.00,'{}'
),
(
  current_setting('my.inv1_id')::bigint,
  (SELECT id FROM products WHERE name='Precision CNC Machined Shaft'),
  'Precision CNC Machined Shaft - EN19, Heat Treated',
  '2. Precision CNC Machined Shaft  20 Nos @ 1180.50  23610.00',
  '84831091',20,'Nos',1180.50,1180.50,
  18.000,4249.80,0.00,850.00,22760.00,
  '{"discount_reason":"Bulk Order"}'
);

-- Payment for invoice #1
INSERT INTO payments (invoice_id, method, provider, txn_id, status, amount, received_at, meta)
VALUES (
  current_setting('my.inv1_id')::bigint,
  'UPI','Razorpay','pay_Nov16A1B2C3D4E5F6G7H8I9J0','success',
  46300.00,'2025-10-25 11:30:00',
  '{"upi_id":"mahindra@upi","payer_note":"Invoice PAC/2425/00127"}'
);

-- -------------------------------------------------
-- 7. INVOICE #2 (Non-GST cash sale)
-- -------------------------------------------------
WITH ins AS (
  INSERT INTO invoices (
    organization_id, branch_id, created_by,
    invoice_number, invoice_type, issue_date,
    taxable_value, cgst_amount, sgst_amount, net_amount,
    payment_status, place_of_supply_state,
    total_in_words, bank_details, meta
  ) VALUES (
    current_setting('my.org_id')::bigint,
    current_setting('my.branch_id')::bigint,
    (SELECT id FROM users WHERE email='vikram.singh@precisionauto.in'),
    'PAC/CASH/1101','Non-GST','2025-11-01',
    3600.00,0.00,0.00,3600.00,
    'paid','27',
    'Rupees Three Thousand Six Hundred Only',
    '{"bank":"Cash Counter"}',
    '{"manual_entry":true,"cashier":"Vikram Singh"}'
  )
  RETURNING id
)
SELECT set_config('my.inv2_id', id::text, true) FROM ins;

-- Invoice #2 items
INSERT INTO invoice_items (invoice_id, description, hsn_sac_code, qty, unit, unit_price, line_total)
VALUES
(current_setting('my.inv2_id')::bigint,'Rubber Gasket Set (EPDM) - Retail Pack','40169330',20,'Sets',45.00,900.00),
(current_setting('my.inv2_id')::bigint,'Bearing 6205ZZ - Single Unit','84821020',15,'Nos',180.00,2700.00);

-- Cash payment
INSERT INTO payments (invoice_id, method, status, amount, received_at)
VALUES (current_setting('my.inv2_id')::bigint,'Cash','success',3600.00,'2025-11-01 16:45:00');

-- -------------------------------------------------
-- 8. VENDOR
-- -------------------------------------------------
WITH ins AS (
  INSERT INTO vendors (
    organization_id, branch_id, name, gstin, pan, phone, email,
    address, state_code, contact_person, meta
  ) VALUES (
    current_setting('my.org_id')::bigint,
    current_setting('my.branch_id')::bigint,
    'Shree Ganesh Aluminium Industries',
    '27AAECS9876F1Z8','AAECS9876F','+91-98201-23456',
    'sales@shreeganeshalum.com',
    'Gala No. 12, Vasai East, Mumbai - 401208','27',
    'Mr. Sunil Patil',
    '{"supply_type":"Raw Material","lead_time_days":7}'
  )
  RETURNING id
)
SELECT set_config('my.vendor_id', id::text, true) FROM ins;

-- -------------------------------------------------
-- 9. EXPENSE
-- -------------------------------------------------
INSERT INTO expenses (
  organization_id, branch_id, category, vendor, amount,
  gst_percent, expense_date, notes, meta
) VALUES (
  current_setting('my.org_id')::bigint,
  current_setting('my.branch_id')::bigint,
  'Electricity Bill',
  'Maharashtra State Electricity Distribution Co. Ltd.',
  48750.00,18.00,'2025-10-31',
  'MSEDCL Bill for October 2025 - HT Industrial Connection',
  '{"bill_no":"HT-456789","units_consumed":12500}'
);

-- -------------------------------------------------
-- 10. PURCHASE BILL
-- -------------------------------------------------
INSERT INTO purchase_bills (
  organization_id, branch_id, vendor_id, uploaded_by,
  bill_number, bill_date, file_url, status,
  subtotal, cgst_amount, sgst_amount, discount_amount, net_amount,
  structured_json, raw_text, meta
) VALUES (
  current_setting('my.org_id')::bigint,
  current_setting('my.branch_id')::bigint,
  current_setting('my.vendor_id')::bigint,
  (SELECT id FROM users WHERE email='priya.sharma@precisionauto.in'),
  'SGA/2425/078','2025-10-15',
  's3://purchases/2025/10/SGA_2425_078.pdf','verified',
  125000.00,11250.00,11250.00,2500.00,133700.00,
  '{"items_parsed":2,"gst_verified":true}',
  '... [raw OCR text] ...',
  '{"ocr_confidence":0.91,"verified_by":"Priya Sharma"}'
);

-- -------------------------------------------------
-- 11. E-WAY BILL
-- -------------------------------------------------
INSERT INTO ewaybills (
  organization_id, branch_id, invoice_id, generated_by,
  ewaybill_no, file_url, status, meta
) VALUES (
  current_setting('my.org_id')::bigint,
  current_setting('my.branch_id')::bigint,
  current_setting('my.inv1_id')::bigint,
  (SELECT id FROM users WHERE email='vikram.singh@precisionauto.in'),
  '271234567890',
  's3://ewaybills/2025/10/271234567890.pdf',
  'valid',
  '{"valid_until":"2025-10-25","distance_km":145}'
);

-- -------------------------------------------------
-- 12. AUDIT LOGS
-- -------------------------------------------------
INSERT INTO audit_logs (organization_id, user_id, action, entity, entity_id, old_value, new_value)
VALUES
(
  current_setting('my.org_id')::bigint,
  (SELECT id FROM users WHERE email='rohan.malhotra@precisionauto.in'),
  'Created organization','organizations',
  current_setting('my.org_id')::bigint,NULL,
  '{"name":"Precision Auto Components Pvt. Ltd."}'
),
(
  current_setting('my.org_id')::bigint,
  (SELECT id FROM users WHERE email='vikram.singh@precisionauto.in'),
  'Created invoice via OCR','invoices',
  current_setting('my.inv1_id')::bigint,NULL,
  '{"invoice_number":"PAC/2425/00127"}'
),
(
  current_setting('my.org_id')::bigint,
  (SELECT id FROM users WHERE email='priya.sharma@precisionauto.in'),
  'Verified purchase bill','purchase_bills',
  (SELECT id FROM purchase_bills WHERE bill_number='SGA/2425/078'),
  '{"status":"pending"}','{"status":"verified"}'
);

-- -------------------------------------------------
-- 13. LOGIN CREDENTIALS (printed at the end)
-- -------------------------------------------------
DO $$
BEGIN
   RAISE NOTICE '%','======================================';
   RAISE NOTICE '%','   LOGIN CREDENTIALS (Seed Data)     ';
   RAISE NOTICE '%','======================================';
   RAISE NOTICE '%','Admin (Owner):';
   RAISE NOTICE '%','  Email: rohan.malhotra@precisionauto.in';
   RAISE NOTICE '%','  Pass : Precision@2025';
   RAISE NOTICE '%','';
   RAISE NOTICE '%','Accountant:';
   RAISE NOTICE '%','  Email: priya.sharma@precisionauto.in';
   RAISE NOTICE '%','  Pass : TaxPro@2025';
   RAISE NOTICE '%','';
   RAISE NOTICE '%','Sales:';
   RAISE NOTICE '%','  Email: vikram.singh@precisionauto.in';
   RAISE NOTICE '%','  Pass : SalesStar@2025';
   RAISE NOTICE '%','======================================';
   RAISE NOTICE '%','Organization: Precision Auto Components Pvt. Ltd.';
   RAISE NOTICE '%','GSTIN: 27AAECP8765H1Z2 | Branch: Mumbai Manufacturing Unit';
   RAISE NOTICE '%','======================================';
END $$;

COMMIT;