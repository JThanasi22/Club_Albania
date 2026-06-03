import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { formatAttendanceDisplayDate, formatAttendanceDateTime } from '@/lib/attendance';

const TEAM_LOGO_FILENAME = 'logo-club-albania.png';
const STAMP_FILENAME = 'stamp-club-albania.png';
const DEJAVU_SANS_TTF_DIR = path.join(process.cwd(), 'node_modules', 'dejavu-fonts-ttf', 'ttf');
const LOGO_MAX_HEIGHT = 56;
const TABLE_ROW_H = 22;
const TABLE_HEADER_H = 24;
const FOOTER_SEP_Y = 50;
const FOOTER_LINE1_Y = 36;
const FOOTER_LINE2_Y = 25;
const STAMP_SIZE = 80;

export type PracticeAttendancePdfRow = {
  name: string;
  present: boolean;
};

export type PracticeAttendancePdfInput = {
  teamName: string;
  dateKey: string;
  recordedAt: string | Date;
  rows: PracticeAttendancePdfRow[];
};

async function loadLogoPngBytes(): Promise<Uint8Array | null> {
  const candidates = [
    path.join(process.cwd(), 'public', TEAM_LOGO_FILENAME),
    path.join(process.cwd(), TEAM_LOGO_FILENAME),
  ];
  for (const filePath of candidates) {
    try {
      const raw = await readFile(filePath);
      const normalized = await sharp(raw).png({ compressionLevel: 9 }).toBuffer();
      return new Uint8Array(normalized);
    } catch {
      continue;
    }
  }
  return null;
}

async function loadStampPngBytes(): Promise<Uint8Array | null> {
  const candidates = [
    path.join(process.cwd(), 'public', STAMP_FILENAME),
    path.join(process.cwd(), STAMP_FILENAME),
  ];
  for (const filePath of candidates) {
    try {
      const raw = await readFile(filePath);
      const normalized = await sharp(raw).png({ compressionLevel: 9 }).toBuffer();
      return new Uint8Array(normalized);
    } catch {
      continue;
    }
  }
  return null;
}

export function slugifyAttendanceFilename(teamName: string, dateKey: string): string {
  const safeTeam = teamName.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'ekip';
  return `prezenca-${safeTeam}-${dateKey}.pdf`;
}

export async function buildPracticeAttendancePdfBytes(input: PracticeAttendancePdfInput): Promise<Uint8Array> {
  const [
    { PDFDocument, rgb },
    logoBytes,
    stampBytes,
    fontRegularBytes,
    fontBoldBytes,
    fontItalicBytes,
    fontBoldItalicBytes,
    fontkit,
  ] = await Promise.all([
    import('pdf-lib'),
    loadLogoPngBytes(),
    loadStampPngBytes(),
    readFile(path.join(DEJAVU_SANS_TTF_DIR, 'DejaVuSans.ttf')),
    readFile(path.join(DEJAVU_SANS_TTF_DIR, 'DejaVuSans-Bold.ttf')),
    readFile(path.join(DEJAVU_SANS_TTF_DIR, 'DejaVuSans-Oblique.ttf')),
    readFile(path.join(DEJAVU_SANS_TTF_DIR, 'DejaVuSans-BoldOblique.ttf')),
    import('@pdf-lib/fontkit').then((m) => m.default),
  ]);

  const LIGHT_BORDER = rgb(0.72, 0.72, 0.72);
  const HEADER_FILL = rgb(0.94, 0.94, 0.94);
  const ALT_ROW = rgb(0.985, 0.985, 0.985);
  const CLUB_BLUE = rgb(0.05, 0.18, 0.55);
  const GREEN = rgb(0.05, 0.5, 0.12);
  const RED = rgb(0.65, 0.08, 0.08);

  const FOOTER_LINE1 =
    'Adresa: Shkolla 9-vje\xE7are "Vasil Shanto" Tirane \xB7 E-mail: clubalbania@fshv.org.al \xB7 Facebook: Club Albania \xB7';
  const FOOTER_LINE2 = 'Instagram: Club.Albania \xB7 Cel - WhatsApp +355697091027';

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const [font, fontBold, , fontBoldItalic] = await Promise.all([
    pdfDoc.embedFont(fontRegularBytes),
    pdfDoc.embedFont(fontBoldBytes),
    pdfDoc.embedFont(fontItalicBytes),
    pdfDoc.embedFont(fontBoldItalicBytes),
  ]);

  let logoPng: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  if (logoBytes) {
    try {
      logoPng = await pdfDoc.embedPng(logoBytes);
    } catch {
      logoPng = null;
    }
  }

  let stampPng: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  if (stampBytes) {
    try {
      stampPng = await pdfDoc.embedPng(stampBytes);
    } catch {
      stampPng = null;
    }
  }

  const margin = 52;
  const pageWidth = 595;
  const pageHeight = 842;
  const contentW = pageWidth - margin * 2;

  const drawPageBackground = (pg: ReturnType<typeof pdfDoc.addPage>) => {
    if (logoPng) {
      const wmW = 340;
      const wmH = (logoPng.height / logoPng.width) * wmW;
      pg.drawImage(logoPng, {
        x: (pageWidth - wmW) / 2,
        y: (pageHeight - wmH) / 2,
        width: wmW,
        height: wmH,
        opacity: 0.07,
      });
    }
    pg.drawLine({
      start: { x: margin, y: FOOTER_SEP_Y },
      end: { x: pageWidth - margin, y: FOOTER_SEP_Y },
      thickness: 0.5,
      color: rgb(0.65, 0.65, 0.65),
    });
    const l1w = font.widthOfTextAtSize(FOOTER_LINE1, 7);
    pg.drawText(FOOTER_LINE1, {
      x: (pageWidth - l1w) / 2,
      y: FOOTER_LINE1_Y,
      size: 7,
      font,
      color: rgb(0.38, 0.38, 0.38),
    });
    const l2w = font.widthOfTextAtSize(FOOTER_LINE2, 7);
    pg.drawText(FOOTER_LINE2, {
      x: (pageWidth - l2w) / 2,
      y: FOOTER_LINE2_Y,
      size: 7,
      font,
      color: rgb(0.38, 0.38, 0.38),
    });
  };

  const drawHLine = (pg: ReturnType<typeof pdfDoc.addPage>, yLine: number) => {
    pg.drawLine({
      start: { x: margin, y: yLine },
      end: { x: pageWidth - margin, y: yLine },
      thickness: 0.75,
      color: LIGHT_BORDER,
    });
  };

  const centerText = (
    pg: ReturnType<typeof pdfDoc.addPage>,
    text: string,
    size: number,
    f: typeof font,
    yPos: number,
    color = rgb(0.12, 0.12, 0.12),
  ) => {
    const w = f.widthOfTextAtSize(text, size);
    pg.drawText(text, { x: (pageWidth - w) / 2, y: yPos, size, font: f, color });
  };

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  drawPageBackground(page);
  let y = pageHeight - margin;

  if (logoPng) {
    const scale = LOGO_MAX_HEIGHT / logoPng.height;
    const imgW = logoPng.width * scale;
    const imgH = logoPng.height * scale;
    page.drawImage(logoPng, {
      x: (pageWidth - imgW) / 2,
      y: y - imgH,
      width: imgW,
      height: imgH,
    });
    y -= imgH + 6;
  }

  centerText(page, 'Akademia e Volejbollit "CLUB ALBANIA"', 10, fontBoldItalic, y);
  y -= 16;
  drawHLine(page, y);
  y -= 22;
  centerText(page, 'Regjistrimi i prezenc\xEBs \xB7 St\xEBrvitje', 13, fontBold, y, CLUB_BLUE);
  y -= 24;

  const dateDisp = formatAttendanceDisplayDate(input.dateKey);
  const recordedDisp = formatAttendanceDateTime(input.recordedAt);
  const metaLines = [
    `Ekipi: ${input.teamName}`,
    `Data e st\xEBrvitjes: ${dateDisp}`,
    `Regjistruar: ${recordedDisp}`,
  ];
  for (const line of metaLines) {
    page.drawText(line, { x: margin, y, size: 10, font, color: rgb(0.15, 0.15, 0.15) });
    y -= 16;
  }
  y -= 8;

  const colNumW = 28;
  const colStatusW = 90;
  const colNameW = contentW - colNumW - colStatusW;

  const drawTableHeader = () => {
    page.drawRectangle({
      x: margin,
      y: y - TABLE_HEADER_H,
      width: contentW,
      height: TABLE_HEADER_H,
      color: HEADER_FILL,
      borderColor: LIGHT_BORDER,
      borderWidth: 0.5,
    });
    const hy = y - TABLE_HEADER_H + 7;
    page.drawText('#', { x: margin + 8, y: hy, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText('Lojtari', { x: margin + colNumW + 4, y: hy, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText('Statusi', {
      x: margin + colNumW + colNameW + 4,
      y: hy,
      size: 9,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= TABLE_HEADER_H;
  };

  drawTableHeader();

  const minY = FOOTER_SEP_Y + STAMP_SIZE + 24;
  input.rows.forEach((row, idx) => {
    if (y - TABLE_ROW_H < minY) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      drawPageBackground(page);
      y = pageHeight - margin - 20;
      drawTableHeader();
    }

    const rowY = y - TABLE_ROW_H;
    if (idx % 2 === 1) {
      page.drawRectangle({
        x: margin,
        y: rowY,
        width: contentW,
        height: TABLE_ROW_H,
        color: ALT_ROW,
        borderColor: LIGHT_BORDER,
        borderWidth: 0.25,
      });
    } else {
      page.drawRectangle({
        x: margin,
        y: rowY,
        width: contentW,
        height: TABLE_ROW_H,
        borderColor: LIGHT_BORDER,
        borderWidth: 0.25,
      });
    }

    const ty = rowY + 7;
    page.drawText(String(idx + 1), { x: margin + 8, y: ty, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(row.name, {
      x: margin + colNumW + 4,
      y: ty,
      size: 9,
      font,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth: colNameW - 8,
    });
    const status = row.present ? 'Prezent' : 'Jo prezent';
    page.drawText(status, {
      x: margin + colNumW + colNameW + 4,
      y: ty,
      size: 9,
      font: fontBold,
      color: row.present ? GREEN : RED,
    });
    y -= TABLE_ROW_H;
  });

  if (stampPng) {
    const stampY = FOOTER_SEP_Y + 8;
    page.drawImage(stampPng, {
      x: pageWidth - margin - STAMP_SIZE,
      y: stampY,
      width: STAMP_SIZE,
      height: STAMP_SIZE,
    });
  }

  const presentCount = input.rows.filter((r) => r.present).length;
  const summary = `P\xEBrmbledhje: ${presentCount} / ${input.rows.length} prezent`;
  page.drawText(summary, {
    x: margin,
    y: FOOTER_SEP_Y + STAMP_SIZE + 12,
    size: 10,
    font: fontBold,
    color: CLUB_BLUE,
  });

  return pdfDoc.save();
}
