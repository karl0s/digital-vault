from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import pandas as pd

# Load master CSV (update path if needed)
path = "/Users/ko/Desktop/NEW_MASTER_merged_shows_2025-11-06_2113.csv"
df = pd.read_csv(path, dtype=str, keep_default_na=False)

# Normalize columns
df.columns = [c.strip() for c in df.columns]

# Keep required columns
columns = ["Artist", "ShowDate", "FolderName", "FolderPath", "TotalSizeHuman"]
df = df[["SourceCatalog"] + columns]

# Group by SourceCatalog
groups = df.groupby("SourceCatalog")

# Output PDF
output_path = "/Users/ko/Desktop/Unique_Shows_Checklist.pdf"
doc = SimpleDocTemplate(
    output_path,
    pagesize=landscape(A4),
    leftMargin=0.8*cm, rightMargin=0.8*cm,
    topMargin=0.8*cm, bottomMargin=0.8*cm
)

styles = getSampleStyleSheet()
wrap_style = ParagraphStyle(
    "wrapped",
    fontName="Helvetica",
    fontSize=6,          # small font for better fit
    leading=7,
    wordWrap='CJK',      # enables wrapping
    alignment=0          # left align
)

story = []

for catalog, data in groups:
    show_count = len(data)

    # Heading with total number of shows for this drive
    heading_text = f"<b>{catalog} — Unique Shows Checklist ({show_count} shows)</b>"
    story.append(Paragraph(heading_text, styles["Heading2"]))
    story.append(Spacer(1, 0.25*cm))

    # Table header
    table_data = [["☐", "Artist", "Show Date", "Folder Name", "Folder Path", "Size"]]

    # Table rows
    for _, row in data.iterrows():
        wrapped_row = [
            "☐",
            Paragraph(row["Artist"], wrap_style),
            Paragraph(row["ShowDate"], wrap_style),
            Paragraph(row["FolderName"], wrap_style),
            Paragraph(row["FolderPath"], wrap_style),
            Paragraph(row["TotalSizeHuman"], wrap_style),
        ]
        table_data.append(wrapped_row)

    # Column widths tuned for wrapping
    col_widths = [0.8*cm, 3.5*cm, 2*cm, 5*cm, 10*cm, 2*cm]

    table = Table(table_data, repeatRows=1, colWidths=col_widths)
    table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 7),
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.grey),
        ('BOX', (0, 0), (-1, -1), 0.25, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1),
            [colors.whitesmoke, colors.lightgrey]),
    ]))

    story.append(table)
    story.append(PageBreak())

doc.build(story)
print(f"✅ New checklist created with counts per drive: {output_path}")
