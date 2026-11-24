import io
import math
from typing import Tuple, Dict, Any, List

def hex_to_rgb(hex_code: str) -> Tuple[int, int, int]:
    h = hex_code.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)

def color_distance(hex1: str, hex2: str) -> float:
    try:
        r1, g1, b1 = hex_to_rgb(hex1)
        r2, g2, b2 = hex_to_rgb(hex2)
        return math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
    except Exception:
        return 999.0

def validate_file(filename: str, file_bytes: bytes) -> str:
    # 5 MB check
    if len(file_bytes) > 5 * 1024 * 1024:
        raise ValueError("File size exceeds 5 MB limit.")

    ext = filename.lower().split(".")[-1] if "." in filename else ""
    valid_exts = {"txt", "pdf", "docx", "png", "jpg", "jpeg"}
    if ext not in valid_exts:
        raise ValueError(f"Unsupported file extension '.{ext}'. Allowed: {', '.join(sorted(valid_exts))}")

    # Content signature validation
    if ext == "pdf":
        if not file_bytes.startswith(b"%PDF-"):
            raise ValueError("File content is not a valid PDF document.")
    elif ext == "docx":
        if not file_bytes.startswith(b"PK\x03\x04"):
            raise ValueError("File content is not a valid DOCX document.")
    elif ext == "png":
        if not file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            raise ValueError("File content is not a valid PNG image.")
    elif ext in ("jpg", "jpeg"):
        if not file_bytes.startswith(b"\xff\xd8\xff"):
            raise ValueError("File content is not a valid JPEG/JPG image.")
    elif ext == "txt":
        try:
            file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                file_bytes.decode("latin-1")
            except Exception:
                raise ValueError("File content is not readable plain text.")

    return ext

def extract_content(filename: str, file_bytes: bytes, brand_palette: List[str] = None) -> Dict[str, Any]:
    ext = validate_file(filename, file_bytes)
    text = ""
    meta_suggestions: Dict[str, Any] = {}
    warnings: List[str] = []

    if ext == "txt":
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = file_bytes.decode("latin-1", errors="replace")

    elif ext == "pdf":
        import pdfplumber
        try:
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                pages_text = [p.extract_text() or "" for p in pdf.pages]
                text = "\n\n".join(t for t in pages_text if t).strip()
            if not text:
                warnings.append("No selectable text extracted from PDF. Document might contain scanned images.")
        except Exception as e:
            raise ValueError(f"Error reading PDF content: {str(e)}")

    elif ext == "docx":
        import docx
        try:
            doc = docx.Document(io.BytesIO(file_bytes))
            paras = [p.text for p in doc.paragraphs if p.text]
            text = "\n\n".join(paras).strip()
        except Exception as e:
            raise ValueError(f"Error reading DOCX document: {str(e)}")

    elif ext in ("png", "jpg", "jpeg"):
        from PIL import Image
        try:
            image = Image.open(io.BytesIO(file_bytes))
        except Exception as e:
            raise ValueError(f"Error opening image: {str(e)}")

        # Compute dominant colour using Pillow
        rgb_img = image.convert("RGB")
        small = rgb_img.resize((50, 50))
        colors = small.getcolors(50 * 50)
        if colors:
            dominant_rgb = max(colors, key=lambda c: c[0])[1]
            dominant_hex = "#{:02X}{:02X}{:02X}".format(*dominant_rgb)
        else:
            dominant_hex = "#FFFFFF"

        meta_suggestions = {
            "has_image": True,
            "alt_text": filename.rsplit(".", 1)[0].replace("-", " ").replace("_", " ").capitalize(),
            "logo_bg": dominant_hex,
            "fg": "#1E293B",
            "bg": dominant_hex,
        }

        # Check dominant colour against brand palette
        if brand_palette:
            min_dist = min(color_distance(dominant_hex, p) for p in brand_palette)
            if min_dist > 100:
                warnings.append(
                    f"Dominant image colour {dominant_hex} is significantly different from approved brand palette ({', '.join(brand_palette)})."
                )

        # OCR with pytesseract
        try:
            import pytesseract
            ocr_text = pytesseract.image_to_string(image).strip()
            text = ocr_text
            if not text:
                warnings.append("OCR completed but detected no readable text in the image.")
        except Exception as e:
            warnings.append(
                f"Tesseract OCR program is missing or could not run: {str(e)}. Image metadata and dominant colour were still processed."
            )

    return {
        "text": text,
        "meta_suggestions": meta_suggestions,
        "warnings": warnings,
    }
