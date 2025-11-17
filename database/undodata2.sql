-- =============================================
-- UNDO SEED – 100% SAFE (handles all FK constraints)
-- Removes ONLY "Precision Auto Components" data
-- =============================================
BEGIN;

DO $$
DECLARE
    org_id BIGINT;
BEGIN
    -- 1. Find the seeded organization
    SELECT id INTO org_id
    FROM organizations
    WHERE gst_number = '27AAECP8765H1Z2'
      AND name = 'Precision Auto Components Pvt. Ltd.'
    LIMIT 1;

    IF org_id IS NULL THEN
        RAISE NOTICE 'No seeded organization found – nothing to delete.';
        RETURN;
    END IF;

    RAISE NOTICE 'Found seeded organization id = %', org_id;

    -----------------------------------------------------------------
    -- 2. DELETE IN CORRECT ORDER (children first)
    -----------------------------------------------------------------

    -- 2.1 Delete audit logs that reference seeded users
    DELETE FROM audit_logs
    WHERE user_id IN (SELECT id FROM users WHERE organization_id = org_id);

    -- 2.2 Delete invoice OCR extractions
    DELETE FROM invoice_ocr_extractions
    WHERE invoice_id IN (SELECT id FROM invoices WHERE organization_id = org_id);

    -- 2.3 Delete invoice items
    DELETE FROM invoice_items
    WHERE invoice_id IN (SELECT id FROM invoices WHERE organization_id = org_id);

    -- 2.4 Delete payments
    DELETE FROM payments
    WHERE invoice_id IN (SELECT id FROM invoices WHERE organization_id = org_id);

    -- 2.5 Delete e-way bills
    DELETE FROM ewaybills
    WHERE invoice_id IN (SELECT id FROM invoices WHERE organization_id = org_id);

    -- 2.6 Delete invoices
    DELETE FROM invoices WHERE organization_id = org_id;

    -- 2.7 Delete purchase bill items
    DELETE FROM purchase_bill_items
    WHERE purchase_bill_id IN (SELECT id FROM purchase_bills WHERE organization_id = org_id);

    -- 2.8 Delete purchase bills
    DELETE FROM purchase_bills WHERE organization_id = org_id;

    -- 2.9 Delete expenses, vendors, customers, products
    DELETE FROM expenses   WHERE organization_id = org_id;
    DELETE FROM vendors    WHERE organization_id = org_id;
    DELETE FROM customers  WHERE organization_id = org_id;
    DELETE FROM products   WHERE organization_id = org_id;

    -- 2.10 Delete users (now safe)
    DELETE FROM users WHERE organization_id = org_id;

    -- 2.11 Delete branches
    DELETE FROM branches WHERE organization_id = org_id;

    -- 2.12 Finally delete organization
    DELETE FROM organizations WHERE id = org_id;

    RAISE NOTICE 'All seeded data (org id = %) has been successfully removed.', org_id;
END $$;

COMMIT;