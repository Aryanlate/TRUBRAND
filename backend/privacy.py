import re
from typing import Tuple, Dict

def mask_pii(text: str) -> Tuple[str, Dict[str, str]]:
    """
    Masks emails, phone numbers (Indian and international), and 12-digit Aadhaar-like numbers.
    Returns (masked_text, mapping) where mapping maps placeholder -> original value.
    """
    mapping: Dict[str, str] = {}

    # 1. Emails
    email_idx = 1
    def email_repl(match):
        nonlocal email_idx
        orig = match.group(0)
        placeholder = f"[EMAIL_{email_idx}]"
        mapping[placeholder] = orig
        email_idx += 1
        return placeholder

    masked = re.sub(
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b',
        email_repl,
        text
    )

    # 2. 12-digit Aadhaar / ID-like numbers (e.g. 1234 5678 9012, 1234-5678-9012, 123456789012)
    id_idx = 1
    def id_repl(match):
        nonlocal id_idx
        orig = match.group(0)
        placeholder = f"[ID_{id_idx}]"
        mapping[placeholder] = orig
        id_idx += 1
        return placeholder

    masked = re.sub(
        r'\b\d{4}[ -]\d{4}[ -]\d{4}\b|\b\d{12}\b',
        id_repl,
        masked
    )

    # 3. Phone numbers (Indian: +91 9876543210, 09876543210, 9876543210; International: +1-555-555-5555, (555) 555-5555)
    phone_idx = 1
    def phone_repl(match):
        nonlocal phone_idx
        orig = match.group(0)
        digits = re.sub(r'\D', '', orig)
        if len(digits) < 8 or len(digits) > 15:
            return orig
        placeholder = f"[PHONE_{phone_idx}]"
        mapping[placeholder] = orig
        phone_idx += 1
        return placeholder

    phone_regex = r'(?:\+?\d{1,3}[ -]?)?(?:\(?\d{2,5}\)?[ -]?)?\d{3,5}[ -]?\d{3,5}\b'
    masked = re.sub(phone_regex, phone_repl, masked)

    return masked, mapping

def unmask_text(text: str, mapping: Dict[str, str]) -> str:
    """Restores masked placeholders in text using the provided mapping."""
    if not text or not mapping:
        return text
    out = text
    for placeholder, orig in mapping.items():
        out = out.replace(placeholder, orig)
    return out
