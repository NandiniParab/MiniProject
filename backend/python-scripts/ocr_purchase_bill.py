import sys
import json
import re
import os
import cv2
from PIL import Image
import pytesseract
# Configure Tesseract executable path (Windows default or env override)
TESSERACT_EXE = os.environ.get("TESSERACT_EXE_PATH") or r"C:\\Program Files\\Tesseract-OCR\\tesseract.exe"
if os.path.exists(TESSERACT_EXE):
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_EXE

try:
    from pdf2image import convert_from_path
    PDF_SUPPORT = True
    POPPLER_PATH = os.environ.get("POPPLER_PATH")
except:
    PDF_SUPPORT = False

def preprocess_image(img_path):
    img = cv2.imread(img_path)
    if img is None:
        return Image.open(img_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return cv2.medianBlur(thresh, 3)

def ocr_image(img_path):
    processed = preprocess_image(img_path)
    if not isinstance(processed, Image.Image):
        processed = Image.fromarray(processed)
    return pytesseract.image_to_string(processed, lang='eng')

def extract_purchase_data(text):
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    full = " ".join(lines)

    data = {
        "bill_type": "purchase",
        "Invoice Number": None,
        "Invoice Date": None,
        "Vendor Name": None,
        "Vendor GSTIN": None,
        "Taxable Amount": "0",
        "CGST Amount": "0",
        "SGST Amount": "0",
        "IGST Amount": "0",
        "Total Amount": "0",
        "Items": [],
        "raw_text": text
    }

    m = re.search(r'Invoice\s*(No|Number|Bill)?[\s:]*([A-Z0-9/-]+)', full, re.I)
    data['Invoice Number'] = m.group(2).strip() if m else None

    dates = re.findall(r'\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}', full)
    data['Invoice Date'] = dates[0] if dates else None

    data['Vendor Name'] = re.search(r'(?:From|Seller|Vendor)[\s:]+([^0-9]+?)(?=GSTIN|$)', full, re.I)
    data['Vendor Name'] = data['Vendor Name'].group(1).strip() if data['Vendor Name'] else lines[0]

    data['Vendor GSTIN'] = re.search(r'GSTIN[\s:]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})', full, re.I)
    data['Vendor GSTIN'] = data['Vendor GSTIN'].group(1) if data['Vendor GSTIN'] else None

    data['Total Amount'] = re.search(r'Total[\s:₹]*([0-9,]+\.?[0-9]*)', full, re.I)
    data['Total Amount'] = data['Total Amount'].group(1).replace(',', '') if data['Total Amount'] else "0"

    data['Taxable Amount'] = re.search(r'Taxable[\s:₹]*([0-9,]+\.?[0-9]*)', full, re.I)
    data['Taxable Amount'] = data['Taxable Amount'].group(1).replace(',', '') if data['Taxable Amount'] else "0"

    data['CGST Amount'] = re.search(r'CGST[\s:₹]*([0-9,]+\.?[0-9]*)', full, re.I)
    data['CGST Amount'] = data['CGST Amount'].group(1).replace(',', '') if data['CGST Amount'] else "0"

    data['SGST Amount'] = re.search(r'SGST[\s:₹]*([0-9,]+\.?[0-9]*)', full, re.I)
    data['SGST Amount'] = data['SGST Amount'].group(1).replace(',', '') if data['SGST Amount'] else "0"

    data['IGST Amount'] = re.search(r'IGST[\s:₹]*([0-9,]+\.?[0-9]*)', full, re.I)
    data['IGST Amount'] = data['IGST Amount'].group(1).replace(',', '') if data['IGST Amount'] else "0"

    item_block = re.search(r'(Description|Particulars|Item).+?Total', full, re.I | re.S)
    if item_block:
        for line in item_block.group(0).splitlines():
            if re.search(r'\d', line) and not re.search(r'Total|Taxable', line, re.I):
                parts = line.split()
                if len(parts) > 3:
                    data['Items'].append({
                        "Description": " ".join(parts[:-3]),
                        "HSN": parts[-3] if parts[-3].isdigit() and len(parts[-3]) <= 8 else "",
                        "Qty": parts[-2] if parts[-2].replace('.','').isdigit() else "1",
                        "Rate": parts[-1].replace(',', '') if parts[-1].replace(',','').replace('.','').isdigit() else "0"
                    })

    return data

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file provided"}))
        sys.exit(1)

    file_path = sys.argv[1]
    ext = os.path.splitext(file_path)[1].lower()

    try:
        if ext == '.pdf' and PDF_SUPPORT:
            images = convert_from_path(file_path, dpi=300, poppler_path=POPPLER_PATH) if POPPLER_PATH else convert_from_path(file_path, dpi=300)
            temp = "temp_page.jpg"
            images[0].save(temp, 'JPEG')
            text = ocr_image(temp)
            os.remove(temp)
        else:
            text = ocr_image(file_path)

        result = extract_purchase_data(text)
        print(json.dumps(result, ensure_ascii=False, indent=None))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
