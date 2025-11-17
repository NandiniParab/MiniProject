-- =============================================
-- SEED: Business Data (Customers, Products, Invoices, etc.)
-- For manually created org (id=9) and users (22,23,24)
-- =============================================
BEGIN;

DO $$
DECLARE
    org_id      BIGINT := 9;  -- Your organization
    branch_id   BIGINT := 1;  -- Your branch
    admin_id    BIGINT;
    accountant_id BIGINT;
    sales_id    BIGINT;
BEGIN
    -- Resolve user IDs by email
    SELECT id INTO admin_id      FROM users WHERE email = 'sid.malhotra@gmail.com';
    SELECT id INTO accountant_id FROM users WHERE email = 'priya.sharma@gmail.com';
    SELECT id INTO sales_id      FROM users WHERE email = 'vikram.singh@gmail.com';

    IF admin_id IS NULL OR accountant_id IS NULL OR sales_id IS NULL THEN
        RAISE EXCEPTION 'Required users not found. Check emails.';
    END IF;

    RAISE NOTICE 'Seeding with: org=%, branch=%, admin=%, accountant=%, sales=%',
                  org_id, branch_id, admin_id, accountant_id, sales_id;

    -----------------------------------------------------------------
    -- 1. CUSTOMERS
    -----------------------------------------------------------------
    INSERT INTO customers (organization_id, branch_id, name, phone, email,
                           address, shipping_address, gstin, state_code, meta)
    VALUES
    (org_id, branch_id, 'Mahindra & Mahindra Ltd.', '+91-22-6247-1000', 'procurement@mahindra.com',
     'Mahindra Towers, Dr. G M Bhosale Marg, Worli, Mumbai, Maharashtra - 400018',
     'Gate No. 2, Chakan Plant, Pune, Maharashtra - 410501', '27AABCM5509K1Z3', '27',
     '{"industry":"Automotive OEM","credit_days":30,"preferred_payment":"NEFT"}'),
    (org_id, branch_id, 'Tata Motors Limited', '+91-20-6613-4000', 'purchase.tatamotors@tata.com',
     'Bombay House, 24 Homi Mody Street, Mumbai, Maharashtra - 400001',
     'Pimpri-Chinchwad Plant, Pune, Maharashtra - 411018', '27AAACT2727Q1ZA', '27',
     '{"industry":"Commercial Vehicles","credit_days":45,"contact_person":"Amit Desai"}'),
    (org_id, branch_id, 'Bajaj Auto Ltd.', '+91-20-2747-2851', 'vendor@bajajauto.co.in',
     'Mumbai-Pune Road, Akurdi, Pune, Maharashtra - 411035', NULL, '27AAACB4536H1Z0', '27',
     '{"industry":"Two-Wheelers","credit_days":30}');

    -----------------------------------------------------------------
    -- 2. PRODUCTS
    -----------------------------------------------------------------
    INSERT INTO products (organization_id, branch_id, name, hsn_sac_code,
                          price, expected_gst_rate, stock, meta)
    VALUES
    (org_id, branch_id, 'Aluminum Die-Cast Housing (ADC12)', '76169990', 285.00, 18.00, 850,
     '{"uom":"Nos","material":"ADC12","weight_kg":0.85}'),
    (org_id, branch_id, 'Precision CNC Machined Shaft', '84831091', 1180.50, 18.00, 320,
     '{"uom":"Nos","tolerance":"±0.01mm","material":"EN19"}'),
    (org_id, branch_id, 'Rubber Gasket Set (EPDM)', '40169330', 42.75, 18.00, 2400,
     '{"uom":"Sets","pack_size":10}'),
    (org_id, branch_id, 'Bearing Assembly (6205ZZ)', '84821020', 156.00, 18.00, 1200,
     '{"uom":"Nos","brand":"NBC"}');

    -----------------------------------------------------------------
    -- 3. VENDOR
    -----------------------------------------------------------------
    INSERT INTO vendors (organization_id, branch_id, name, gstin, pan, phone, email,
                         address, state_code, contact_person, meta)
    VALUES
    (org_id, branch_id, 'Shree Ganesh Aluminium Industries', '27AAECS9876F1Z8', 'AAECS9876F',
     '+91-98201-23456', 'sales@shreeganeshalum.com',
     'Gala No. 12, Vasai East, Mumbai - 401208', '27', 'Mr. Sunil Patil',
     '{"supply_type":"Raw Material","lead_time_days":7}');

    -----------------------------------------------------------------
    -- 4. INVOICE #1 (GST – OCR) + ITEMS + PAYMENT
    -----------------------------------------------------------------
    WITH inv AS (
        INSERT INTO invoices (
            organization_id, branch_id, customer_id, created_by,
            invoice_number, invoice_type, issue_date, due_date,
            challan_number, challan_date, ewaybill_no,
            taxable_value, cgst_amount, sgst_amount, igst_amount, cess_amount,
            discount_amount, rounding, net_amount, payment_status, place_of_supply_state,
            pdf_url, total_in_words, bank_details, transport_details,
            raw_ocr_text, ocr_extracted, ocr_confidence, source_file, page_no, anomalies, meta
        )
        VALUES (
            org_id, branch_id,
            (SELECT id FROM customers WHERE name = 'Mahindra & Mahindra Ltd.'),
            sales_id,
            'PAC/2425/00127', 'GST', '2025-10-18', '2025-11-17',
            'CH/2425/089', '2025-10-17', '271234567890',
            42500.00, 3825.00, 3825.00, 0.00, 0.00,
            850.00, 0.00, 46300.00, 'paid', '27',
            's3://invoices/2025/10/PAC_2425_00127.pdf',
            'Rupees Forty Six Thousand Three Hundred Only',
            '{"bank":"HDFC Bank","account":"50200012345678","ifsc":"HDFC0000123","branch":"Andheri East"}',
            '{"mode":"Road","vehicle":"MH04GT5678","lr_no":"MUM-PUN-1018","driver":"Ramesh Kumar"}',
            '... [simulated raw OCR text dump] ...',
            '{"extracted_at":"2025-10-18T14:22:10Z","engine":"Google Vision","version":"v2"}',
            0.9421, 'uploaded_scans/october_batch/PAC_2425_00127.pdf', 1,
            '[{"code":"LOW_CONFIDENCE_GSTIN","field":"customer_gstin","confidence":0.78,"suggested":"27AABCM5509K1Z3"}]',
            '{"ocr_processed":true,"ewaybill_generated":true}'
        )
        RETURNING id
    ),
    items AS (
        INSERT INTO invoice_items (
            invoice_id, product_id, description, ocr_line,
            hsn_sac_code, qty, unit, unit_price, price,
            applied_gst_rate, gst_amount, cess_amount,
            line_discount, line_total, meta
        )
        SELECT
            inv.id,
            p.id,
            v.description_text,
            v.ocr_line,
            v.hsn,
            v.qty,
            v.unit,
            v.uprice,
            v.uprice,
            18.000,
            v.gst_amt,
            0.00,
            v.disc,
            v.total,
            '{}'
        FROM inv
        CROSS JOIN (
            VALUES
            ((SELECT id FROM products WHERE name = 'Aluminum Die-Cast Housing (ADC12)'),
             'Aluminum Die-Cast Housing (ADC12) - Part # PH-404',
             '1. Aluminum Die-Cast Housing (ADC12)  50 Nos @ 285.00  14250.00',
             '76169990', 50, 'Nos', 285.00, 2565.00, 0.00, 14250.00),
            ((SELECT id FROM products WHERE name = 'Precision CNC Machined Shaft'),
             'Precision CNC Machined Shaft - EN19, Heat Treated',
             '2. Precision CNC Machined Shaft  20 Nos @ 1180.50  23610.00',
             '84831091', 20, 'Nos', 1180.50, 4249.80, 850.00, 22760.00)
        ) AS v(p_id, description_text, ocr_line, hsn, qty, unit, uprice, gst_amt, disc, total)
        JOIN products p ON p.id = v.p_id
        RETURNING invoice_id
    )
    INSERT INTO payments (invoice_id, method, provider, txn_id, status, amount, received_at, meta)
    SELECT
        inv.id,
        'UPI', 'Razorpay', 'pay_Nov16A1B2C3D4E5F6G7H8I9J0', 'success',
        46300.00, '2025-10-25 11:30:00',
        '{"upi_id":"mahindra@upi","payer_note":"Invoice PAC/2425/00127"}'
    FROM inv;

    -----------------------------------------------------------------
    -- 5. INVOICE #2 (Non-GST cash sale) + ITEMS + PAYMENT
    -----------------------------------------------------------------
    WITH inv AS (
        INSERT INTO invoices (
            organization_id, branch_id, created_by,
            invoice_number, invoice_type, issue_date,
            taxable_value, cgst_amount, sgst_amount, net_amount,
            payment_status, place_of_supply_state,
            total_in_words, bank_details, meta
        )
        VALUES (
            org_id, branch_id, sales_id,
            'PAC/CASH/1101', 'Non-GST', '2025-11-01',
            3600.00, 0.00, 0.00, 3600.00,
            'paid', '27',
            'Rupees Three Thousand Six Hundred Only',
            '{"bank":"Cash Counter"}',
            '{"manual_entry":true,"cashier":"Vikram Singh"}'
        )
        RETURNING id
    ),
    items AS (
        INSERT INTO invoice_items (invoice_id, description, hsn_sac_code, qty, unit, unit_price, line_total)
        SELECT
            inv.id,
            v.description_text,
            v.hsn,
            v.qty,
            v.unit,
            v.uprice,
            v.total
        FROM inv
        CROSS JOIN (
            VALUES
            ('Rubber Gasket Set (EPDM) - Retail Pack', '40169330', 20, 'Sets', 45.00, 900.00),
            ('Bearing 6205ZZ - Single Unit', '84821020', 15, 'Nos', 180.00, 2700.00)
        ) AS v(description_text, hsn, qty, unit, uprice, total)
        RETURNING invoice_id
    )
    INSERT INTO payments (invoice_id, method, status, amount, received_at)
    SELECT
        inv.id, 'Cash', 'success', 3600.00, '2025-11-01 16:45:00'
    FROM inv;

    -----------------------------------------------------------------
    -- 6. EXPENSE
    -----------------------------------------------------------------
    INSERT INTO expenses (
        organization_id, branch_id, category, vendor, amount,
        gst_percent, expense_date, notes, meta
    )
    VALUES (
        org_id, branch_id, 'Electricity Bill',
        'Maharashtra State Electricity Distribution Co. Ltd.',
        48750.00, 18.00, '2025-10-31',
        'MSEDCL Bill for October 2025 - HT Industrial Connection',
        '{"bill_no":"HT-456789","units_consumed":12500}'
    );

    -----------------------------------------------------------------
    -- 7. PURCHASE BILL
    -----------------------------------------------------------------
    INSERT INTO purchase_bills (
        organization_id, branch_id, vendor_id, uploaded_by,
        bill_number, bill_date, file_url, status,
        subtotal, cgst_amount, sgst_amount, discount_amount, net_amount,
        structured_json, raw_text, meta
    )
    VALUES (
        org_id, branch_id,
        (SELECT id FROM vendors WHERE name = 'Shree Ganesh Aluminium Industries'),
        accountant_id,
        'SGA/2425/078', '2025-10-15',
        's3://purchases/2025/10/SGA_2425_078.pdf', 'verified',
        125000.00, 11250.00, 11250.00, 2500.00, 133700.00,
        '{"items_parsed":2,"gst_verified":true}',
        '... [raw OCR text] ...',
        '{"ocr_confidence":0.91,"verified_by":"Priya Sharma"}'
    );

    -----------------------------------------------------------------
    -- 8. E-WAY BILL
    -----------------------------------------------------------------
    INSERT INTO ewaybills (
        organization_id, branch_id, invoice_id, generated_by,
        ewaybill_no, file_url, status, meta
    )
    VALUES (
        org_id, branch_id,
        (SELECT id FROM invoices WHERE invoice_number = 'PAC/2425/001/00127'),
        sales_id,
        '271234567890',
        's3://ewaybills/2025/10/271234567890.pdf',
        'valid',
        '{"valid_until":"2025-10-25","distance_km":145}'
    );

    ----------------------------------------------------------------
    -- 9. AUDIT LOGS
    -----------------------------------------------------------------
    INSERT INTO audit_logs (organization_id, user_id, action, entity, entity_id, old_value, new_value)
    VALUES
    (org_id, admin_id, 'Created organization', 'organizations', org_id, NULL,
     '{"name":"Your Company"}'),
    (org_id, sales_id, 'Created invoice via OCR', 'invoices',
     (SELECT id FROM invoices WHERE invoice_number = 'PAC/2425/00127'), NULL,
     '{"invoice_number":"PAC/2425/00127"}'),
    (org_id, accountant_id, 'Verified purchase bill', 'purchase_bills',
     (SELECT id FROM purchase_bills WHERE bill_number = 'SGA/2425/078'),
     '{"status":"pending"}', '{"status":"verified"}');

    RAISE NOTICE 'All business data seeded successfully!';
END $$;

COMMIT;