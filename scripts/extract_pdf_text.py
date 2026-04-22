import sys
from pathlib import Path

from pypdf import PdfReader


def main() -> int:
    if len(sys.argv) < 2:
        print("Missing PDF path", file=sys.stderr)
        return 1

    pdf_path = Path(sys.argv[1])
    if not pdf_path.exists():
        print(f"PDF not found: {pdf_path}", file=sys.stderr)
        return 1

    try:
        reader = PdfReader(str(pdf_path))
        parts = []
        for page in reader.pages:
            parts.append(page.extract_text() or "")
        sys.stdout.write("\n".join(parts))
        return 0
    except Exception as err:
        print(str(err), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
