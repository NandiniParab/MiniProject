# backend/python-scripts/generate_invoice.py
import os
import json
import subprocess
import sys
from pathlib import Path

def generate_pdf_from_image(image_path, output_pdf=None, logo_path=None):
    """
    Full pipeline: image → OCR → JSON → PDF
    Returns path to generated PDF
    """
    script_dir = Path(__file__).parent
    temp_json = script_dir / "temp_extracted.json"
    
    # Step 1: OCR → JSON
    ocr_cmd = [
        sys.executable, str(script_dir / "ocr_extraction.py"),
        str(image_path), "--json", str(temp_json)
    ]
    print(f"[1] Running OCR: {' '.join(ocr_cmd)}")
    result = subprocess.run(ocr_cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f"OCR failed: {result.stderr}")

    # Step 2: PDF Generation
    pdf_cmd = [
        sys.executable, str(script_dir / "pdf_creation.py"),
        str(temp_json)
    ]
    if output_pdf:
        pdf_cmd += ["--out", str(output_pdf)]
    if logo_path:
        pdf_cmd += ["--logo", str(logo_path)]

    print(f"[2] Generating PDF: {' '.join(pdf_cmd)}")
    result = subprocess.run(pdf_cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f"PDF failed: {result.stderr}")

    # Cleanup
    if temp_json.exists():
        temp_json.unlink()

    final_pdf = output_pdf or script_dir / f"Invoice_{Path(image_path).stem}.pdf"
    print(f"PDF created: {final_pdf}")
    return str(final_pdf)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="OCR + PDF in one command")
    parser.add_argument("image", help="Invoice image/PDF")
    parser.add_argument("--out", help="Output PDF path")
    parser.add_argument("--logo", help="Logo image")
    args = parser.parse_args()

    try:
        pdf_path = generate_pdf_from_image(args.image, args.out, args.logo)
        print(f"SUCCESS: {pdf_path}")
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)