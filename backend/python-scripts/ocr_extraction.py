# backend/python-scripts/ocr_extraction.py
# --------------------------------------------------------------
# OCR → JSON (exactly the same as before) + optional auto-save
# --------------------------------------------------------------
#   python ocr_extraction.py <image_or_pdf> [--json <path>]
# --------------------------------------------------------------

import sys
import json
import re
import os
import cv2
import pytesseract
from PIL import Image

# ---------- PDF support (optional) ----------
try:
    from pdf2image import convert_from_path
    PDF_SUPPORT = True
except Exception:          # ImportError or any other problem
    PDF_SUPPORT = False


# ---------- Pre-process ----------
def preprocess_image(image_path: str):
    """Same preprocessing you used in the notebook."""
    try:
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError("cv2 could not read the file")
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, th = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return cv2.medianBlur(th, 3)
    except Exception:
        # Fallback to plain PIL (no OpenCV)
        return Image.open(image_path)


def image_to_text(image_path: str) -> str:
    """Run Tesseract – identical to the original notebook."""
    processed = preprocess_image(image_path)

    # Convert numpy → PIL if needed
    if isinstance(processed, Image.Image):
        pil_img = processed
    else:
        pil_img = Image.fromarray(processed)

    return pytesseract.image_to_string(pil_img, lang='eng')


# ---------- Field extraction (unchanged) ----------
def extract_fields(raw_text: str) -> dict:
    """The exact regex-based extraction you already had."""
    result = {}
    lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
    full_text = " ".join(lines)

    # ----- Invoice Number -----
    m = re.search(r'Invoice\s*(No\.?|Number)?[:\\s]*([A-Za-z0-9\-_/]+)', full_text, re.I)
    inv = m.group(2) if m else None
    if inv:
        inv_clean = re.sub(r"[^A-Za-z0-9\-_/]", "", inv).strip()
        # Ignore common non-IDs and values without any digits
        if re.fullmatch(r"(?i)(original|duplicate|copy|tax\s*invoice)", inv_clean) or not re.search(r"\d", inv_clean):
            inv_clean = None
        result['Invoice Number'] = inv_clean
    else:
        result['Invoice Number'] = None

    # ----- Invoice Date -----
    dates = re.findall(r'\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b', full_text)
    result['Invoice Date'] = dates[0] if dates else None

    # ----- Vendor -----
    m = re.search(r'(?:Billed From|Vendor|From)[:\\s]*(.*?)(?:GSTIN|Address|$)', full_text, re.I)
    result['Vendor Name'] = m.group(1).strip() if m else (lines[0] if lines else None)

    m = re.search(r'(?:GSTIN|GST No\.?)[:\\s]*([0-9A-Z]{15})\b', full_text)
    result['Vendor GSTIN'] = m.group(1) if m else None

    # ----- Customer -----
    m = re.search(r'(?:Billed To|Customer)[:\\s]*(.*?)(?:GSTIN|Address|$)', full_text, re.I)
    result['Customer Name'] = m.group(1).strip() if m else None

    gstins = re.findall(r'(?:GSTIN|GST No\.?)[:\\s]*([0-9A-Z]{15})\b', full_text)
    result['Customer GSTIN'] = gstins[1] if len(gstins) > 1 else None

    # ----- Items (same regex you used) -----
    result['Items'] = []
    block = re.search(r'(?:Items|Name of Product / Service)(.*?)(?:Total in words|Total Amount)', full_text, re.DOTALL | re.I)
    if block:
        for line in [l.strip() for l in block.group(1).splitlines() if l.strip()]:
            m = re.match(r'(.+?)\s+([0-9A-Za-z]+)?\s+([0-9,.]+)\s+([0-9,.]+)\s*(?:@|\+)?\s*(\d+)?%?\s*([0-9,.]+)?', line)
            if m:
                name, hsn, qty, price, gst_rate, tax_amt = m.groups()
                qty = qty.replace(',', '') or '1'
                price = price.replace(',', '') or '0'
                line_total = str(float(qty) * float(price))
                result['Items'].append({
                    'Item Name': name.strip(),
                    'HSN/SAC Code': hsn.strip() if hsn else None,
                    'Quantity': qty,
                    'Unit Price': price,
                    'Line Total': line_total,
                    'GST Rate': gst_rate,
                    'GST Amount': tax_amt.replace(',', '') if tax_amt else None
                })

    # ----- Totals -----
    m = re.search(r'Taxable Amount[:\\s]*₹?\s*([0-9,]+\.\d{2})', full_text, re.I)
    result['Taxable Amount'] = m.group(1).replace(',', '') if m else None

    m = re.search(r'IGST[:\\s]*([0-9,]+\.\d{2})', full_text, re.I)
    result['IGST Amount'] = m.group(1).replace(',', '') if m else None

    m = re.search(r'(?:Total\s*Amount|Net Total)[:\\s]*₹?\s*([0-9,]+\.\d{2})', full_text, re.I)
    result['Total Amount'] = m.group(1).replace(',', '') if m else None

    result['raw_text'] = raw_text
    return result


# ---------- Process file ----------
def process_invoice_file(file_path: str, json_output_path: str | None = None) -> dict:
    """Core OCR → JSON.  Returns the dict and optionally writes it."""
    ext = os.path.splitext(file_path)[1].lower()

    # ----- PDF handling (exactly like before) -----
    if ext == '.pdf':
        if not PDF_SUPPORT:
            raise ImportError("pdf2image not installed – cannot read PDF")
        images = convert_from_path(file_path, dpi=300)
        tmp = file_path.replace('.pdf', '_tmp_page0.jpg')
        images[0].save(tmp, 'JPEG')
        text = image_to_text(tmp)
        os.remove(tmp)
    else:
        text = image_to_text(file_path)

    if not text.strip():
        raise ValueError("No text extracted from the file")

    extracted = extract_fields(text)

    # ----- Build the final payload (same keys you used in the notebook) -----
    payload = {
        "Invoice Number": extracted.get('Invoice Number'),
        "Invoice Date": extracted.get('Invoice Date'),
        "Vendor Name": extracted.get('Vendor Name'),
        "Vendor GSTIN": extracted.get('Vendor GSTIN'),
        "Customer Name": extracted.get('Customer Name'),
        "Customer GSTIN": extracted.get('Customer GSTIN'),
        "Items": extracted.get('Items', []),
        "Taxable Amount": extracted.get('Taxable Amount'),
        "IGST Amount": extracted.get('IGST Amount'),
        "Total Amount": extracted.get('Total Amount'),
        "raw_text": text
    }

    # ----- AUTO-SAVE JSON (the only new line) -----
    if json_output_path:
        os.makedirs(os.path.dirname(json_output_path), exist_ok=True)
        with open(json_output_path, 'w', encoding='utf-8') as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        print(f"[INFO] JSON saved to {json_output_path}")

    return payload


# ---------- CLI ----------
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="OCR → JSON (auto-save optional)")
    parser.add_argument("input_file", help="Path to invoice image or PDF")
    parser.add_argument("--json", help="Save extracted JSON to this file", default=None)
    args = parser.parse_args()

    try:
        data = process_invoice_file(args.input_file, json_output_path=args.json)
        # ALWAYS print JSON to stdout – Node.js expects it
        print(json.dumps(data, ensure_ascii=False, indent=None))
    except Exception as e:
        # Node.js will see a JSON error object
        err = {"error": str(e)}
        print(json.dumps(err))
        sys.exit(1)