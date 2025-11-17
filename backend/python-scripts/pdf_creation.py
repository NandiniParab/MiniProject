# pdf_creation.py
# --------------------------------------------------------------
# Generate a clean PDF invoice from the JSON produced by the OCR notebook
# --------------------------------------------------------------
#   python pdf_creation.py extracted_invoice.json --out MyInvoice.pdf --logo logo.png
# --------------------------------------------------------------

from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
from decimal import Decimal, ROUND_HALF_UP
import os, re, json, sys
from datetime import datetime


# ---------------------- Helpers ----------------------
def fmt(val):
    try:
        return f"{Decimal(str(val or 0)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):.2f}"
    except:
        return "0.00"

def clean(txt):
    return re.sub(r'\s+', ' ', (txt or '').strip())

def parse_date(d):
    if not d: return ""
    d = clean(d)
    for fmt in ("%d %b %Y", "%d-%b-%Y", "%d/%m/%Y", "%d-%m-%Y", "%d %B %Y"):
        try:
            return datetime.strptime(d.replace('-', ' '), fmt).strftime("%d/%m/%Y")
        except:
            continue
    return d


# ---------------------- Normaliser ----------------------
def normalise(ocr):
    n = {
        'invoice_id': clean(ocr.get('Invoice Number', 'UNKNOWN')),
        'invoice_date': parse_date(ocr.get('Invoice Date')),
        'place_of_supply': '',
        'customer_gstin': clean(ocr.get('Customer GSTIN') or 'Unregistered'),
        'supplier_gstin': clean(ocr.get('Vendor GSTIN') or ''),
        'supplier_name': clean(ocr.get('Vendor Name') or 'GUJARAT FREIGHT TOOLS'),
        'customer_name': clean(ocr.get('Customer Name') or 'M/S Shiv Engineering'),
        'items': [],
        'taxable_total': 0.0,
        'igst': 0.0,
        'cgst': 0.0,
        'sgst': 0.0,
        'total_tax': 0.0,
        'grand_total': 0.0,
        'raw': ocr,
    }

    # ---- place of supply (last state code in customer address) ----
    addr = clean(ocr.get('Customer Address', ''))
    m = re.search(r'\b([A-Z]{2})\b', addr[-10:])
    n['place_of_supply'] = m.group(1) if m else ''

    # ---- line items ----
    taxable = 0.0
    for it in ocr.get('Items', []):
        desc = clean(it.get('Item Name', ''))
        if not desc or any(x in desc.lower() for x in ['ze', 'rate', 'total']):
            continue

        qty = float(re.sub(r'[^\d.]', '', str(it.get('Quantity', '1')) or '1'))
        rate = float(re.sub(r'[^\d.]', '', str(it.get('Unit Price', '0')) or '0'))
        line = qty * rate
        gst_rate = float(re.sub(r'[^\d.]', '', str(it.get('GST Rate', '18')) or '18'))
        gst_amt = float(re.sub(r'[^\d.]', '', str(it.get('GST Amount', '0')) or '0'))

        taxable += line
        n['items'].append({
            'hsn': it.get('HSN/SAC Code') or '',
            'description': desc,
            'qty': qty,
            'unit_price': rate,
            'line_total': line,
            'gst_rate': gst_rate,
            'gst_amount': gst_amt,
            'igst': gst_amt if n['place_of_supply'] != ocr.get('Vendor GSTIN', '')[:2] else 0,
            'cgst': gst_amt / 2 if n['place_of_supply'] == ocr.get('Vendor GSTIN', '')[:2] else 0,
            'sgst': gst_amt / 2 if n['place_of_supply'] == ocr.get('Vendor GSTIN', '')[:2] else 0,
        })

    # ---- totals ----
    try:
        n['taxable_total'] = float(ocr.get('Taxable Amount') or taxable)
    except:
        n['taxable_total'] = taxable

    n['igst'] = float(ocr.get('IGST Amount') or 0)
    n['total_tax'] = float(ocr.get('Total Tax') or n['igst'])
    n['grand_total'] = float(ocr.get('Total Amount') or 0) or (n['taxable_total'] + n['total_tax'])

    if n['igst'] == 0:               # intra-state
        n['cgst'] = n['total_tax'] / 2
        n['sgst'] = n['total_tax'] / 2
    return n


# ---------------------- PDF Generator ----------------------
def generate_pdf(inv, out_path, logo_path=None, terms=None):
    doc = SimpleDocTemplate(out_path, pagesize=landscape(letter),
                            rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
    styles = getSampleStyleSheet()
    H = ParagraphStyle('H', parent=styles['Heading1'], alignment=1, spaceAfter=12, fontSize=14)
    N = ParagraphStyle('N', parent=styles['Normal'], fontSize=8, leading=10)
    P = ParagraphStyle('P', parent=styles['Normal'], fontSize=7, leading=9)

    elems = []

    # logo
    if logo_path and os.path.exists(logo_path):
        try:
            img = Image(logo_path, width=100, height=40)
            img.hAlign = 'LEFT'
            elems += [img, Spacer(1, 0.12*inch)]
        except Exception as e:
            print("Logo error:", e)

    elems.append(Paragraph("TAX INVOICE", H))
    elems.append(Spacer(1, 0.18*inch))

    # header
    header = [
        [Paragraph(f"<b>Invoice ID:</b> {inv['invoice_id']}", N),
         Paragraph(f"<b>Date:</b> {inv['invoice_date']}", N)],
        [Paragraph(f"<b>From:</b> {inv['supplier_name']}", N),
         Paragraph(f"<b>GSTIN:</b> {inv['supplier_gstin']}", N)],
        [Paragraph(f"<b>To:</b> {inv['customer_name']}", N),
         Paragraph(f"<b>Customer GSTIN:</b> {inv['customer_gstin']}", N)],
        [Paragraph(f"<b>Place of Supply:</b> {inv['place_of_supply']}", N),
         Paragraph(f"<b>Challan No:</b> {inv['raw'].get('Challan Number','')}", N)],
    ]
    t = Table(header, colWidths=[3.5*inch, 3.5*inch])
    t.setStyle(TableStyle([
        ('VALIGN',(0,0),(-1,-1),'TOP'),
        ('INNERGRID',(0,0),(-1,-1),0.25,colors.grey),
        ('BOX',(0,0),(-1,-1),0.5,colors.grey),
        ('FONTSIZE',(0,0),(-1,-1),8),
        ('LEFTPADDING',(0,0),(-1,-1),6),
    ]))
    elems.append(t)
    elems.append(Spacer(1, 0.22*inch))

    # items
    data = [['HSN/SAC','Description','Qty','Rate','Taxable','Tax %','IGST','CGST','SGST','Tax','Amount']]
    for it in inv['items']:
        data.append([
            it['hsn'],
            Paragraph(it['description'], P),
            fmt(it['qty']),
            fmt(it['unit_price']),
            fmt(it['line_total']),
            fmt(it['gst_rate']),
            fmt(it['igst']),
            fmt(it['cgst']),
            fmt(it['sgst']),
            fmt(it['gst_amount']),
            fmt(it['line_total'] + it['gst_amount']),
        ])
    data.append([
        'Totals','','','',fmt(inv['taxable_total']),'',
        fmt(inv['igst']),fmt(inv['cgst']),fmt(inv['sgst']),
        fmt(inv['total_tax']),fmt(inv['grand_total'])
    ])

    col_w = [0.6,2.0,0.5,0.7,0.8,0.5,0.6,0.6,0.6,0.7,0.8]
    col_w = [w*inch for w in col_w]
    tbl = Table(data, colWidths=col_w)
    tbl.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),colors.grey),
        ('TEXTCOLOR',(0,0),(-1,0),colors.whitesmoke),
        ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),
        ('FONTSIZE',(0,0),(-1,-1),7),
        ('ALIGN',(2,1),(-1,-1),'RIGHT'),
        ('GRID',(0,0),(-1,-1),0.25,colors.black),
        ('BACKGROUND',(0,-1),(-1,-1),colors.lightgrey),
        ('LEFTPADDING',(0,0),(-1,-1),4),
        ('TOPPADDING',(0,0),(-1,-1),2),
    ]))
    elems.append(tbl)
    elems.append(Spacer(1, 0.25*inch))

    # bank / terms
    bank = clean(inv['raw'].get('Bank Details',''))
    upi  = clean(inv['raw'].get('Mode of Payment',''))
    term = terms or clean(inv['raw'].get('Payment Terms','')) or "Goods once sold will not be taken back."

    pay = (f"<b>Bank:</b> {bank}<br/>"
           f"<b>UPI:</b> {upi}<br/>"
           f"<b>Terms:</b> {term}")
    elems.append(Paragraph(pay, N))

    doc.build(elems)
    return out_path


# ---------------------- CLI ----------------------
if __name__ == '__main__':
    import argparse
    p = argparse.ArgumentParser(description="PDF from OCR JSON")
    p.add_argument('json_file', help="Path to extracted_invoice.json")
    p.add_argument('--out', help="Output PDF name")
    p.add_argument('--logo', help="Optional logo image")
    p.add_argument('--terms', help="Custom terms")
    args = p.parse_args()

    if not os.path.exists(args.json_file):
        print(f"File not found: {args.json_file}", file=sys.stderr)
        sys.exit(1)

    with open(args.json_file, 'r', encoding='utf-8') as f:
        ocr = json.load(f)

    inv = normalise(ocr)
    out = args.out or f"Invoice_{inv['invoice_id'] or 'OCR'}.pdf"

    generate_pdf(inv, out, logo_path=args.logo, terms=args.terms)
    print(f"PDF created: {out}")