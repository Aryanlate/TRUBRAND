import re, datetime
 
def luminance(hex_color):
    h = hex_color.lstrip("#")
    r, g, b = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
 
def contrast_ratio(a, b):
    hi, lo = sorted([luminance(a), luminance(b)], reverse=True)
    return (hi + 0.05) / (lo + 0.05)
 
def mk(category, severity, quote, rule_id, explanation, suggestion=None):
    return {"category": category, "severity": severity, "source_type": "rule-based",
            "quote": quote, "rule_id": rule_id, "explanation": explanation,
            "confidence": 1.0, "suggestion": suggestion, "status": "open", "label": None}
 
def run_rules(text, kb, meta):
    meta = meta or {}
    out = []
    for t in kb.get("terms", []):
        kind = t["type"]
        if kind in ("banned", "replace"):
            m = re.search(r"\b" + re.escape(t["term"]) + r"\b", text, re.I)
            if m:
                sev = t.get("severity") or ("Blocker" if kind == "banned" else "Info")
                note = t.get("note") or f'"{t["term"]}" is not allowed.'
                out.append(mk("terminology", sev, m.group(0), t["rule_id"], note, t.get("replacement")))
        elif kind == "brand_name":
            pat = re.sub(r"(?<=[a-z])(?=[A-Z])", r"\\s?", re.escape(t["term"]))
            for m in re.finditer(pat, text, re.I):
                if m.group(0) != t["term"]:
                    out.append(mk("terminology", "Warning", m.group(0), t["rule_id"],
                                  f'Brand name must be written exactly as "{t["term"]}".', t["term"]))
    today = datetime.date.today().isoformat()
    for c in kb.get("claims", []):
        if re.search(re.escape(c["phrase"]), text, re.I):
            exp = c.get("expires_on")
            if not c.get("evidence"):
                out.append(mk("claims", "Blocker", c["phrase"], c["id"],
                              f'Claim "{c["phrase"]}" has no approved evidence. Cannot verify.'))
            elif exp and exp < today:
                out.append(mk("claims", "Blocker", c["phrase"], c["id"],
                              f'Evidence for "{c["phrase"]}" expired on {exp}. Cannot verify.'))
    if meta.get("has_image") and not (meta.get("alt_text") or "").strip():
        out.append(mk("accessibility", "Warning", "[image]", "A11Y-1", "Image has no alt text.",
                      "Add a short description of what the image shows."))
    approved = [c.lower() for c in kb.get("assets", {}).get("approved_logo_backgrounds", [])]
    if meta.get("logo_bg") and approved and meta["logo_bg"].lower() not in approved:
        out.append(mk("visual", "Warning", "[logo]", "R-6.1",
                      f'Logo background {meta["logo_bg"]} is not approved. Approved: {", ".join(approved)}.',
                      approved[0]))
    if meta.get("fg") and meta.get("bg"):
        try:
            r = contrast_ratio(meta["fg"], meta["bg"])
            if r < 4.5:
                out.append(mk("accessibility", "Warning", f'{meta["fg"]} on {meta["bg"]}', "A11Y-2",
                              f"Contrast ratio {r:.1f}:1 is below the required 4.5:1.",
                              "Use darker text or a lighter background."))
        except ValueError:
            pass
    return out