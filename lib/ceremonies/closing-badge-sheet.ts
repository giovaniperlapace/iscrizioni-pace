import { openSync, type Font } from "fontkit";
import sharp from "sharp";

let localFont: Font | undefined;

// Both outputs use the same coordinates, line breaks and local font outlines.
// No external PDF renderer or remotely loaded image/font is needed by the worker.
export class ClosingBadgeSheet {
  private parts: string[] = [];
  private footer: string[] = [];
  private font: Font;
  private doc: PDFKit.PDFDocument;
  private preview: boolean;
  constructor(doc: PDFKit.PDFDocument, fontPath: string, preview: boolean) {
    this.doc = doc;
    this.preview = preview;
    this.font = localFont ??= openSync(fontPath) as Font;
  }
  rect(x: number, y: number, width: number, height: number, color: string) {
    this.doc.fillColor(color).rect(x, y, width, height).fill();
    if (this.preview) this.parts.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${color}"/>`);
  }
  outline(x: number, y: number, width: number, height: number, closureX: number) {
    this.doc.save().dash(2, { space: 3 }).strokeColor("#7c8797").lineWidth(0.45)
      .rect(x, y, width, height).stroke().moveTo(closureX, y).lineTo(closureX, y + height).stroke().restore();
    if (this.preview) this.parts.push(`<path d="M${x} ${y}h${width}v${height}h-${width}z M${closureX} ${y}v${height}" fill="none" stroke="#7c8797" stroke-width="0.45" stroke-dasharray="2 3"/>`);
  }
  text(value: string, x: number, y: number, size: number, color: string) {
    this.doc.fontSize(size).fillColor(color).text(value, x, y, { lineBreak: false });
    if (!this.preview) return;
    const run = this.font.layout(value);
    const scale = size / this.font.unitsPerEm;
    let cursor = 0;
    for (const [index, glyph] of run.glyphs.entries()) {
      const pos = run.positions[index];
      (y >= 565 ? this.footer : this.parts).push(`<path fill="${color}" transform="translate(${x + (cursor + pos.xOffset) * scale} ${y + (this.font.ascent - pos.yOffset) * scale}) scale(${scale} ${-scale})" d="${glyph.path.toSVG()}"/>`);
      cursor += pos.xAdvance;
    }
  }
  fit(value: string, x: number, y: number, width: number, height: number, max: number, min: number, color: string) {
    const clean = value.replace(/\s+/g, " ").trim();
    for (let size = max; size >= min; size--) {
      this.doc.fontSize(size);
      const lines: string[] = [];
      let line = "";
      for (const word of clean.split(" ")) {
        const candidate = line ? `${line} ${word}` : word;
        if (this.doc.widthOfString(candidate) <= width) { line = candidate; continue; }
        if (line) lines.push(line);
        line = "";
        for (const char of word) {
          if (this.doc.widthOfString(line + char) > width) { lines.push(line); line = ""; }
          line += char;
        }
      }
      if (line) lines.push(line);
      const lineHeight = this.doc.currentLineHeight(true);
      const measured = lines.length * lineHeight;
      if (measured > height) continue;
      lines.forEach((text, index) => this.text(text, x, y + (height - measured) / 2 + index * lineHeight, size, color));
      return;
    }
    throw Error("delegated_badge_text_too_long");
  }
  async image(rows: number) {
    // Trim unused paper between the last badge and footer in the email only.
    // The attached PDF remains A4 with seven badge positions per page.
    const height = rows === 7 ? this.doc.page.height : 80 + (rows - 1) * 70 + 62 + 41;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="842" height="${Math.ceil(height)}" viewBox="0 0 ${this.doc.page.width} ${height}"><rect width="100%" height="100%" fill="white"/>${this.parts.join("")}<g transform="translate(0 ${height - this.doc.page.height})">${this.footer.join("")}</g></svg>`;
    return sharp(Buffer.from(svg)).png({ palette: true, colours: 32, dither: 0, compressionLevel: 9 }).toBuffer();
  }
}
