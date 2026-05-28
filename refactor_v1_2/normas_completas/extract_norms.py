"""Extrai texto das normas baixadas e gera arquivos .txt limpos."""
from pathlib import Path
import re

from pypdf import PdfReader

HERE = Path(__file__).parent


def extract_pdf(pdf_path: Path) -> str:
    r = PdfReader(str(pdf_path))
    parts = []
    for page in r.pages:
        try:
            txt = page.extract_text() or ""
        except Exception:
            txt = ""
        parts.append(txt)
    return "\n".join(parts)


def extract_html(html_path: Path) -> str:
    raw = html_path.read_text(encoding="utf-8", errors="ignore")
    # Remove scripts e styles
    raw = re.sub(r"<script[^>]*>.*?</script>", " ", raw, flags=re.DOTALL | re.IGNORECASE)
    raw = re.sub(r"<style[^>]*>.*?</style>", " ", raw, flags=re.DOTALL | re.IGNORECASE)
    # Tags para espaço
    raw = re.sub(r"<[^>]+>", " ", raw)
    # Entidades HTML básicas
    raw = (raw.replace("&nbsp;", " ").replace("&amp;", "&")
              .replace("&lt;", "<").replace("&gt;", ">")
              .replace("&quot;", '"').replace("&#39;", "'")
              .replace("&aacute;", "á").replace("&eacute;", "é")
              .replace("&iacute;", "í").replace("&oacute;", "ó")
              .replace("&uacute;", "ú").replace("&atilde;", "ã")
              .replace("&otilde;", "õ").replace("&ccedil;", "ç")
              .replace("&Aacute;", "Á").replace("&Eacute;", "É")
              .replace("&Iacute;", "Í").replace("&Oacute;", "Ó")
              .replace("&Uacute;", "Ú").replace("&Atilde;", "Ã")
              .replace("&Otilde;", "Õ").replace("&Ccedil;", "Ç"))
    return raw


def clean(text: str) -> str:
    """Normaliza espaços e remove linhas vazias múltiplas."""
    text = re.sub(r"[ \t ]+", " ", text)
    text = re.sub(r"\n[ \t]*", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


for src, fmt, dst in [
    ("nr01.pdf", "pdf", "nr01.txt"),
    ("nr17.pdf", "pdf", "nr17.txt"),
    ("lgpd.html", "html", "lgpd.txt"),
]:
    src_path = HERE / src
    if not src_path.exists():
        print(f"[skip] {src} não existe")
        continue
    if fmt == "pdf":
        raw = extract_pdf(src_path)
    else:
        raw = extract_html(src_path)
    cleaned = clean(raw)
    (HERE / dst).write_text(cleaned, encoding="utf-8")
    print(f"{src} -> {dst} ({len(cleaned)} chars, {cleaned.count(chr(10))+1} linhas)")
