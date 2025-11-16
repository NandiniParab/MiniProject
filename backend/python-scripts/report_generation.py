# report_generation.py
# Reporting & normalization functions for invoices
# Based on the normalization/aggregation code in train_for_smth

import re
import json
import math
from dateutil.parser import parse as dateparse
from datetime import datetime
import pandas as pd

# ---------- Utilities ----------
def parse_amount(s):
    """Safe parse money string -> float or None."""
    if s is None:
        return None
    if isinstance(s, (int, float)):
        return float(s)
    s2 = re.sub(r'[^\d.\-]', '', str(s))
    if s2 == '':
        return None
    try:
        return float(s2)
    except:
        m = re.search(r'(\d+[.,]?\d*)', str(s))
        if m:
            return float(m.group(1).replace(',', ''))
    return None

def parse_date_safe(s):
    if s is None:
        return None
    try:
        dt = dateparse(str(s), dayfirst=False, fuzzy=True)
        return dt.date()
    except Exception:
        return None

def gst_state_code_from_gstin(gstin):
    if not gstin:
        return None
    gstin = str(gstin).strip()
    if len(gstin) >= 2 and gstin[:2].isdigit():
        return gstin[:2]
    m = re.search(r'(\d{2})', gstin)
    if m:
        return m.group(1)
    return None

# ---------- Normalization ----------
def normalize_invoice(extracted):
    """
    Convert raw OCR-extracted dict into normalized structure:
      invoice_id, invoice_date (date), supplier_gstin, customer_gstin,
      items (list of dicts), taxable_total, cgst, sgst, igst, total_tax, grand_total
    """
    out = {}
    out['invoice_id'] = extracted.get('Invoice Number') or extracted.get('invoice_no') or None
    out['raw_invoice_id'] = extracted.get('Invoice Number')
    out['invoice_date'] = parse_date_safe(extracted.get('Invoice Date'))
    if out['invoice_date'] is None:
        # fallback to trying to parse any date-like string in raw_text
        raw = extracted.get('raw_text','')
        m = re.search(r'(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})', raw)
        if m:
            out['invoice_date'] = parse_date_safe(m.group(1))

    out['supplier_gstin'] = extracted.get('Vendor GSTIN') or extracted.get('Vendor GSTIN ')
    out['customer_gstin'] = extracted.get('Customer GSTIN') or None
    out['place_of_supply'] = extracted.get('Vendor Address') or extracted.get('Customer Address')

    # Items normalization
    items = []
    raw_items = extracted.get('Items') or []
    if isinstance(raw_items, list) and raw_items:
        for it in raw_items:
            desc = it.get('Item Name') or it.get('Item') or it.get('description') or ''
            hsn = it.get('HSN/SAC Code') or it.get('HSN')
            qty = parse_amount(it.get('Quantity') or it.get('Qty') or 1) or 1.0
            unit_price = parse_amount(it.get('Unit Price') or it.get('Rate') or 0) or 0.0
            line_total = parse_amount(it.get('Line Total') or it.get('Amount') or (qty * unit_price))
            gst_rate = None
            if it.get('GST Rate'):
                try:
                    gst_rate = float(str(it.get('GST Rate')).replace('%',''))
                except:
                    gst_rate = None
            gst_amount = parse_amount(it.get('GST Amount') or it.get('Tax Amount') or None)
            items.append({
                'description': str(desc).strip(),
                'hsn': str(hsn).strip() if hsn else None,
                'qty': qty,
                'unit_price': unit_price,
                'line_total': line_total,
                'gst_rate': gst_rate,
                'gst_amount': gst_amount
            })
    out['items'] = items

    # totals
    out['taxable_total'] = parse_amount(extracted.get('Taxable Amount') or extracted.get('Taxable') or None)
    out['cgst'] = parse_amount(extracted.get('CGST Amount') or extracted.get('CGST') or None)
    out['sgst'] = parse_amount(extracted.get('SGST Amount') or extracted.get('SGST') or None)
    out['igst'] = parse_amount(extracted.get('IGST Amount') or extracted.get('IGST') or None)
    out['total_tax'] = parse_amount(extracted.get('Total Tax') or extracted.get('Total Tax ') or None)
    out['grand_total'] = parse_amount(extracted.get('Total Amount') or extracted.get('Grand Total') or None)

    # compute missing taxable_total from items if possible
    if not out['taxable_total'] and out['items']:
        s = 0.0
        for it in out['items']:
            s += float(it['line_total'] or (it['qty'] * it['unit_price'] or 0.0))
        out['taxable_total'] = round(s, 2)

    out['raw_extracted'] = extracted
    return out

# ---------- Classification and Tax breakup ----------
def classify_inter_state(normalized_invoice):
    sup = normalized_invoice.get('supplier_gstin')
    cus = normalized_invoice.get('customer_gstin')
    sup_code = gst_state_code_from_gstin(sup)
    cus_code = gst_state_code_from_gstin(cus)
    if sup_code and cus_code:
        return (sup_code != cus_code, f"{sup_code} vs {cus_code}")
    pos = normalized_invoice.get('place_of_supply')
    if pos:
        m = re.search(r'\((\d{1,2})\)', str(pos))
        if m:
            pcode = m.group(1).zfill(2)
            if sup_code:
                return (sup_code != pcode, f"{sup_code} vs {pcode}")
    return (None, "unknown")

def compute_invoice_tax_breakup(inv):
    """
    Ensure inv has igst, cgst, sgst; if missing compute using gst_rate per item or split total_tax.
    Returns modified copy.
    """
    inv = dict(inv)
    if inv.get('items') and not inv.get('total_tax'):
        total = 0.0
        for it in inv['items']:
            if it.get('gst_amount'):
                total += it['gst_amount']
            elif it.get('gst_rate') and it.get('line_total') is not None:
                total += (it['line_total'] * it['gst_rate'])/100.0
        if total > 0:
            inv['total_tax'] = round(total, 2)

    inter_state, reason = classify_inter_state(inv)
    inv['classification_inter_state'] = inter_state
    inv['classification_reason'] = reason

    tt = inv.get('total_tax') or 0.0
    if tt:
        if inv.get('igst') is None and inv.get('cgst') is None and inv.get('sgst') is None:
            if inter_state is True:
                inv['igst'] = round(tt, 2)
                inv['cgst'] = 0.0
                inv['sgst'] = 0.0
            elif inter_state is False:
                inv['cgst'] = round(tt/2.0, 2)
                inv['sgst'] = round(tt/2.0, 2)
                inv['igst'] = 0.0
            else:
                inv['igst'] = inv.get('igst') or 0.0
                inv['cgst'] = inv.get('cgst') or 0.0
                inv['sgst'] = inv.get('sgst') or 0.0

    inv['taxable_total'] = inv.get('taxable_total') or 0.0
    inv['total_tax'] = inv.get('total_tax') or ((inv.get('igst') or 0.0) + (inv.get('cgst') or 0.0) + (inv.get('sgst') or 0.0))
    return inv

# ---------- Aggregation ----------
def aggregate_invoices_for_period(norm_invoices):
    """
    Returns (summary_df, rate_breakdown)
    summary_df: DataFrame per YYYY-MM period with invoice_count, totals.
    rate_breakdown: dict {period: {rate: taxable_sum}}
    """
    rows = []
    rate_breakdown = {}
    for inv in norm_invoices:
        inv_date = inv.get('invoice_date')
        if inv_date is None:
            period = 'unknown'
        else:
            period = inv_date.strftime("%Y-%m")
        row = {
            'period': period,
            'invoice_id': inv.get('invoice_id'),
            'taxable_value': float(inv.get('taxable_total') or 0.0),
            'igst': float(inv.get('igst') or 0.0),
            'cgst': float(inv.get('cgst') or 0.0),
            'sgst': float(inv.get('sgst') or 0.0),
            'total_tax': float(inv.get('total_tax') or 0.0),
            'invoice_value': float(inv.get('grand_total') or ((inv.get('taxable_total') or 0.0) + (inv.get('total_tax') or 0.0)))
        }
        rows.append(row)
        if inv.get('items'):
            for it in inv['items']:
                rate = it.get('gst_rate') or 'unknown'
                taxable = it.get('line_total') or (it.get('qty',0)*it.get('unit_price',0))
                rate_breakdown.setdefault(period, {})
                rate_breakdown[period].setdefault(rate, 0.0)
                rate_breakdown[period][rate] += float(taxable or 0.0)

    df = pd.DataFrame(rows)
    if df.empty:
        return pd.DataFrame(), {}
    summary = df.groupby('period').agg(
        invoice_count = ('invoice_id','count'),
        total_taxable_value = ('taxable_value','sum'),
        total_igst = ('igst','sum'),
        total_cgst = ('cgst','sum'),
        total_sgst = ('sgst','sum'),
        total_tax = ('total_tax','sum'),
        total_invoice_value = ('invoice_value','sum')
    ).reset_index()
    for col in ['total_taxable_value','total_igst','total_cgst','total_sgst','total_tax','total_invoice_value']:
        summary[col] = summary[col].round(2)
    return summary, rate_breakdown

# ---------- Filing Assistant ----------
def filing_assistant(summary_df, rate_breakdown, norm_invoices, pay_threshold=0.0):
    per_period = {}
    periods = summary_df['period'].tolist() if not summary_df.empty else ['unknown']
    for period in periods:
        per_period[period] = {
            'total_taxable_value': 0.0,
            'total_tax': 0.0,
            'total_invoice_value': 0.0,
            'invoice_count': 0,
            'recommendation': '',
            'tax_to_pay': 0.0,
            'anomalies': []
        }
    for _, row in (summary_df.iterrows() if not summary_df.empty else []):
        p = row['period']
        per_period[p].update({
            'total_taxable_value': float(row['total_taxable_value']),
            'total_tax': float(row['total_tax']),
            'total_invoice_value': float(row['total_invoice_value']),
            'invoice_count': int(row['invoice_count']),
            'tax_to_pay': float(row['total_tax'])
        })
        per_period[p]['recommendation'] = 'File return for this period.' if (row['invoice_count']>0 or row['total_tax']>0) else 'No filing required (nil).'

    for inv in norm_invoices:
        inv_date = inv.get('invoice_date')
        period = inv_date.strftime("%Y-%m") if inv_date else 'unknown'
        if not inv.get('supplier_gstin'):
            per_period[period]['anomalies'].append({'invoice_id': inv.get('invoice_id'), 'issue': 'Missing supplier GSTIN'})
        if not inv.get('customer_gstin'):
            per_period[period]['anomalies'].append({'invoice_id': inv.get('invoice_id'), 'issue': 'Missing customer GSTIN'})
        if inv.get('items'):
            for it in inv['items']:
                if not it.get('hsn'):
                    per_period[period]['anomalies'].append({'invoice_id': inv.get('invoice_id'), 'issue': f"Missing HSN for item '{it.get('description')}'"})
        if inv.get('items') and inv.get('taxable_total'):
            sum_lines = 0.0
            for it in inv['items']:
                val = it.get('line_total') if it.get('line_total') is not None else (it.get('qty',0)*it.get('unit_price',0))
                sum_lines += float(val or 0.0)
            sum_lines = round(sum_lines, 2)
            taxable = round(float(inv.get('taxable_total') or 0.0), 2)
            if abs(sum_lines - taxable) > 0.5:
                per_period[period]['anomalies'].append({'invoice_id': inv.get('invoice_id'), 'issue': f"Taxable mismatch: sum(items)={sum_lines} vs taxable_total={taxable}"})
        if inv.get('classification_inter_state') is None:
            per_period[period]['anomalies'].append({'invoice_id': inv.get('invoice_id'), 'issue': 'Inter/intra classification unknown (missing GSTIN or place of supply). Please review.'})

    for p, info in per_period.items():
        if info['tax_to_pay'] and info['tax_to_pay'] > pay_threshold:
            info['recommendation'] = f"File return and pay ₹{info['tax_to_pay']:.2f} for period {p}."
        info['rate_breakdown'] = rate_breakdown.get(p, {})
        info['summary_text'] = f"Period {p}: {info['invoice_count']} invoices, taxable ₹{info['total_taxable_value']:.2f}, tax ₹{info['total_tax']:.2f}."
    return per_period

# ---------- Convenience function: one-line report from list of extracted dicts ----------
def generate_report_from_extracted_list(extracted_list, pay_threshold=0.0, write_csv=None, write_json=None):
    """
    Input: list of 'extracted' dicts as produced by ocr_extraction.process_invoice_file
    Returns: (summary_df, rate_breakdown, assistant_dict, normalized_invoices_list)
    Optionally writes CSV/JSON to disk if paths are provided.
    """
    normalized = []
    for ex in extracted_list:
        n = normalize_invoice(ex)
        n = compute_invoice_tax_breakup(n)
        normalized.append(n)
    summary_df, rate_breakdown = aggregate_invoices_for_period(normalized)
    assistant = filing_assistant(summary_df, rate_breakdown, normalized, pay_threshold=pay_threshold)
    if write_csv and not summary_df.empty:
        summary_df.to_csv(write_csv, index=False)
    if write_json:
        with open(write_json, 'w', encoding='utf-8') as f:
            json.dump({'summary': summary_df.to_dict(orient='records'), 'rate_breakdown': rate_breakdown, 'assistant': assistant}, f, default=str, indent=2)
    return summary_df, rate_breakdown, assistant, normalized

# ---------- CLI ----------
if __name__ == '__main__':
    import argparse, sys
    parser = argparse.ArgumentParser(description="Generate reports from OCR-extracted invoice JSONs.")
    parser.add_argument('input_json', help="Path to JSON file containing a list of extracted invoice dicts (or a single dict).")
    parser.add_argument('--out_json', help="Optional output JSON path for report")
    parser.add_argument('--out_csv', help="Optional CSV output path for summary")
    args = parser.parse_args()
    try:
        with open(args.input_json, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if isinstance(data, dict):
            extracted_list = [data]
        else:
            extracted_list = data
        summary_df, rate_breakdown, assistant, normalized = generate_report_from_extracted_list(extracted_list, write_csv=args.out_csv, write_json=args.out_json)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(2)
    print("=== Summary ===")
    if not summary_df.empty:
        print(summary_df.to_string(index=False))
    else:
        print("No invoices to summarize.")
    print("\n=== Assistant ===")
    print(json.dumps(assistant, indent=2, default=str))
