from __future__ import annotations

from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer

BASE_DIR = Path(__file__).resolve().parent
FONT_DIR = Path("C:/Windows/Fonts")
ARIAL = FONT_DIR / "arial.ttf"
ARIAL_BOLD = FONT_DIR / "arialbd.ttf"


def register_fonts() -> tuple[str, str]:
    if ARIAL.exists() and ARIAL_BOLD.exists():
        pdfmetrics.registerFont(TTFont("ArialCustom", str(ARIAL)))
        pdfmetrics.registerFont(TTFont("ArialCustom-Bold", str(ARIAL_BOLD)))
        return "ArialCustom", "ArialCustom-Bold"
    return "Helvetica", "Helvetica-Bold"


BODY_FONT, BOLD_FONT = register_fonts()


def build_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="DocTitle",
            parent=styles["Title"],
            fontName=BOLD_FONT,
            fontSize=20,
            leading=24,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#12344D"),
            spaceAfter=18,
        )
    )
    styles.add(
        ParagraphStyle(
            name="DocMeta",
            parent=styles["Normal"],
            fontName=BODY_FONT,
            fontSize=10,
            leading=14,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#55697A"),
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H1",
            parent=styles["Heading1"],
            fontName=BOLD_FONT,
            fontSize=16,
            leading=20,
            textColor=colors.HexColor("#12344D"),
            spaceBefore=12,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H2",
            parent=styles["Heading2"],
            fontName=BOLD_FONT,
            fontSize=13,
            leading=17,
            textColor=colors.HexColor("#1C4E80"),
            spaceBefore=10,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Body",
            parent=styles["BodyText"],
            fontName=BODY_FONT,
            fontSize=10.5,
            leading=15,
            alignment=TA_LEFT,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BulletItem",
            parent=styles["BodyText"],
            fontName=BODY_FONT,
            fontSize=10.5,
            leading=15,
            leftIndent=12,
            firstLineIndent=0,
            bulletIndent=0,
            spaceAfter=3,
        )
    )
    return styles


STYLES = build_styles()


def paragraph(text: str, style_name: str = "Body") -> Paragraph:
    safe = escape(text).replace("\n", "<br/>")
    return Paragraph(safe, STYLES[style_name])


# ReportLab bullets are unreliable with custom parsing here; prefix is rendered in the text.
def bullet(text: str) -> Paragraph:
    safe = escape(f"• {text}")
    return Paragraph(safe, STYLES["BulletItem"])


def build_story(markdown_text: str, title: str) -> list:
    lines = markdown_text.splitlines()
    story = [Spacer(1, 1.2 * cm), paragraph(title, "DocTitle")]

    meta_lines = []
    index = 0
    while index < len(lines):
        raw = lines[index].rstrip()
        if not raw:
            index += 1
            break
        if raw.startswith("# "):
            index += 1
            continue
        meta_lines.append(raw)
        index += 1

    for meta in meta_lines:
        story.append(paragraph(meta, "DocMeta"))
    if meta_lines:
        story.append(Spacer(1, 0.8 * cm))

    buffer: list[str] = []

    def flush_buffer() -> None:
        nonlocal buffer
        if buffer:
            story.append(paragraph(" ".join(item.strip() for item in buffer if item.strip())))
            buffer = []

    for raw in lines[index:]:
        line = raw.rstrip()
        if not line:
            flush_buffer()
            story.append(Spacer(1, 0.15 * cm))
            continue
        if line.startswith("## "):
            flush_buffer()
            story.append(paragraph(line[3:].strip(), "H1"))
            continue
        if line.startswith("### "):
            flush_buffer()
            story.append(paragraph(line[4:].strip(), "H2"))
            continue
        if line.startswith("- "):
            flush_buffer()
            story.append(bullet(line[2:].strip()))
            continue
        numbered = False
        for prefix in [f"{n}. " for n in range(1, 21)]:
            if line.startswith(prefix):
                flush_buffer()
                story.append(bullet(line))
                numbered = True
                break
        if numbered:
            continue
        buffer.append(line)

    flush_buffer()
    return story


def page_decor(canvas, doc):
    canvas.saveState()
    canvas.setFont(BODY_FONT, 9)
    canvas.setFillColor(colors.HexColor("#55697A"))
    canvas.drawString(doc.leftMargin, 1.2 * cm, "Washapp V2")
    canvas.drawRightString(A4[0] - doc.rightMargin, 1.2 * cm, str(canvas.getPageNumber()))
    canvas.restoreState()


def render(md_path: Path, pdf_path: Path, title: str) -> None:
    story = build_story(md_path.read_text(encoding="utf-8"), title)
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title=title,
        author="GitHub Copilot",
    )
    doc.build(story, onFirstPage=page_decor, onLaterPages=page_decor)


def main() -> None:
    inputs = [
        (
            BASE_DIR / "Documentacao_Tecnica_Washapp_V2.md",
            BASE_DIR / "Documentacao_Tecnica_Washapp_V2.pdf",
            "Documentacao Tecnica - Washapp V2",
        ),
        (
            BASE_DIR / "Manual_Funcional_Washapp_V2.md",
            BASE_DIR / "Manual_Funcional_Washapp_V2.pdf",
            "Manual Funcional e Operacional - Washapp V2",
        ),
    ]

    for md_path, pdf_path, title in inputs:
        render(md_path, pdf_path, title)
        print(f"OK {pdf_path.name}")


if __name__ == "__main__":
    main()
