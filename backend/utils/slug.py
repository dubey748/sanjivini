"""Tiny slug helper. ASCII-only, lowercase, dash-separated."""
import re
import unicodedata

_SLUG_CLEAN = re.compile(r"[^a-z0-9]+")
_SLUG_TRIM = re.compile(r"^-+|-+$")


def slugify(text: str, fallback: str = "item") -> str:
    if not text:
        return fallback
    s = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode("ascii")
    s = _SLUG_CLEAN.sub("-", s.lower())
    s = _SLUG_TRIM.sub("", s)
    return s or fallback
