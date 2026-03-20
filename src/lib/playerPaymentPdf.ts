import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

type PaymentEntry = { amount: number; date: string };

const TEAM_LOGO_FILENAME = 'logo-club-albania.png';
const LOGO_MAX_HEIGHT = 56;
const PHOTO_BOX = 92;
const TABLE_ROW_H = 22;
const TABLE_HEADER_H = 24;

export type PlayerPaymentPdfInput = {
  name: string;
  team: string | null;
  jerseyNumber: number | null;
  email: string | null;
  phone: string | null;
  joinDate: Date | string;
  dateOfBirth: Date | string | null;
  active: boolean;
  photo: string | null;
  totalPayment: number;
  paymentHistory: PaymentEntry[];
};

function formatMoney(n: number): string {
  return `${new Intl.NumberFormat('sq-AL', { maximumFractionDigits: 0 }).format(n)} ALL`;
}

function formatDisplayDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso).trim());
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return String(iso).slice(0, 10);
}

function datePart(val: Date | string | null | undefined): string {
  if (val == null) return '';
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

export function slugifyForFilename(name: string): string {
  const s = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return s.slice(0, 60) || 'lojtari';
}

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

async function loadPlayerPhotoPng(photoUrl: string | null | undefined): Promise<Uint8Array | null> {
  if (!photoUrl || !/^https?:\/\//i.test(photoUrl)) return null;
  try {
    const res = await fetch(photoUrl, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const normalized = await sharp(buf)
      .resize(PHOTO_BOX * 3, PHOTO_BOX * 3, { fit: 'cover', position: 'center' })
      .png({ compressionLevel: 9 })
      .toBuffer();
    return new Uint8Array(normalized);
  } catch {
    return null;
  }
}

export async function buildPlayerPaymentPdfBytes(input: PlayerPaymentPdfInput): Promise<Uint8Array> {
  const [{ PDFDocument, StandardFonts, rgb }, logoBytes, photoBytes] = await Promise.all([
    import('pdf-lib'),
    loadLogoPngBytes(),
    loadPlayerPhotoPng(input.photo),
  ]);

  const LIGHT_BORDER = rgb(0.72, 0.72, 0.72);
  const HEADER_FILL = rgb(0.94, 0.94, 0.94);
  const ALT_ROW = rgb(0.985, 0.985, 0.985);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 52;
  const pageWidth = 595;
  const pageHeight = 842;
  const contentW = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawHLine = (yLine: number, fromX = margin, toX = pageWidth - margin) => {
    page.drawLine({
      start: { x: fromX, y: yLine },
      end: { x: toX, y: yLine },
      thickness: 0.75,
      color: LIGHT_BORDER,
    });
  };

  const centerText = (text: string, size: number, useBold: boolean, yPos: number) => {
    const f = useBold ? fontBold : font;
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: (pageWidth - w) / 2,
      y: yPos,
      size,
      font: f,
      color: rgb(0.12, 0.12, 0.12),
    });
  };

  if (logoBytes) {
    try {
      const png = await pdfDoc.embedPng(logoBytes);
      const scale = LOGO_MAX_HEIGHT / png.height;
      const imgW = png.width * scale;
      const imgH = png.height * scale;
      const imgX = (pageWidth - imgW) / 2;
      const imgY = y - imgH;
      page.drawImage(png, { x: imgX, y: imgY, width: imgW, height: imgH });
      y = imgY - 12;
    } catch {
      y -= 4;
    }
  }

  drawHLine(y);
  y -= 22;
  centerText('Përmbledhje e pagesave', 13, true, y);
  y -= 20;
  drawHLine(y);
  y -= 22;

  const photoX = margin;
  const photoTop = y;
  const photoBottom = photoTop - PHOTO_BOX;
  page.drawRectangle({
    x: photoX,
    y: photoBottom,
    width: PHOTO_BOX,
    height: PHOTO_BOX,
    borderColor: LIGHT_BORDER,
    borderWidth: 1,
    color: rgb(0.96, 0.96, 0.96),
  });
  if (photoBytes) {
    try {
      const pImg = await pdfDoc.embedPng(photoBytes);
      page.drawImage(pImg, { x: photoX + 2, y: photoBottom + 2, width: PHOTO_BOX - 4, height: PHOTO_BOX - 4 });
    } catch {
      page.drawText('Foto', { x: photoX + 28, y: photoBottom + 38, size: 9, font, color: rgb(0.55, 0.55, 0.55) });
    }
  } else {
    page.drawText('Pa foto', { x: photoX + 24, y: photoBottom + 38, size: 9, font, color: rgb(0.55, 0.55, 0.55) });
  }

  const infoX = photoX + PHOTO_BOX + 18;
  const labelW = 118;
  let infoY = photoTop - 4;
  const infoLine = (label: string, value: string) => {
    page.drawText(label, {
      x: infoX,
      y: infoY,
      size: 9,
      font: fontBold,
      color: rgb(0.35, 0.35, 0.35),
    });
    page.drawText(value || '-', {
      x: infoX + labelW,
      y: infoY,
      size: 9,
      font,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth: pageWidth - margin - (infoX + labelW) - 8,
    });
    infoY -= 14;
  };

  infoLine('Emri:', input.name);
  infoLine('Ekipi:', input.team || '-');
  infoLine('Nr. fanellës:', input.jerseyNumber != null ? String(input.jerseyNumber) : '-');
  infoLine('Email:', input.email || '-');
  infoLine('Telefoni:', input.phone || '-');
  infoLine('Datelindja:', input.dateOfBirth ? formatDisplayDate(datePart(input.dateOfBirth)) : '-');
  infoLine('Data e bashkimit:', formatDisplayDate(datePart(input.joinDate)));
  infoLine('Statusi:', input.active ? 'Aktiv' : 'Joaktiv');

  y = Math.min(photoBottom - 12, infoY - 8);

  drawHLine(y);
  y -= 24;

  page.drawText('Historiku i pagesave', {
    x: margin,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0.15, 0.15, 0.15),
  });
  y -= 20;

  const total = Number(input.totalPayment) || 0;
  const history = [...(input.paymentHistory ?? [])].sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return 0;
  });
  const paid = history.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const left = total - paid;

  const drawTableHeaderAtTop = (tableTop: number): number => {
    const bottom = tableTop - TABLE_HEADER_H;
    page.drawRectangle({
      x: margin,
      y: bottom,
      width: contentW,
      height: TABLE_HEADER_H,
      color: HEADER_FILL,
      borderColor: LIGHT_BORDER,
      borderWidth: 1,
    });
    const textY = bottom + 8;
    page.drawText('Data e pagesës', { x: margin + 10, y: textY, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    const hdr = 'Shuma (ALL)';
    const hw = fontBold.widthOfTextAtSize(hdr, 10);
    page.drawText(hdr, { x: margin + contentW - 10 - hw, y: textY, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    return bottom;
  };

  const startPaymentsContinuationPage = (): number => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    let py = pageHeight - margin;
    page.drawText('Historiku i pagesave (vazhdim)', {
      x: margin,
      y: py,
      size: 11,
      font: fontBold,
      color: rgb(0.15, 0.15, 0.15),
    });
    py -= 22;
    return drawTableHeaderAtTop(py);
  };

  let cursor = drawTableHeaderAtTop(y);

  const rowFits = (nextRowBottom: number) => nextRowBottom >= margin + 100;

  if (history.length === 0) {
    if (!rowFits(cursor - 40)) {
      cursor = startPaymentsContinuationPage();
    }
    const emptyH = 38;
    const emptyTop = cursor;
    const emptyBottom = emptyTop - emptyH;
    page.drawRectangle({
      x: margin,
      y: emptyBottom,
      width: contentW,
      height: emptyH,
      color: rgb(1, 1, 1),
      borderColor: LIGHT_BORDER,
      borderWidth: 1,
    });
    page.drawText('Nuk ka pagesa të regjistruara.', {
      x: margin + 10,
      y: emptyBottom + 12,
      size: 10,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
    cursor = emptyBottom;
  } else {
    history.forEach((e, i) => {
      const rowBottom = cursor - TABLE_ROW_H;
      if (!rowFits(rowBottom)) {
        cursor = startPaymentsContinuationPage();
      }
      const rb = cursor - TABLE_ROW_H;
      if (i % 2 === 1) {
        page.drawRectangle({
          x: margin + 1,
          y: rb,
          width: contentW - 2,
          height: TABLE_ROW_H,
          color: ALT_ROW,
        });
      }
      page.drawLine({
        start: { x: margin, y: rb + TABLE_ROW_H },
        end: { x: margin + contentW, y: rb + TABLE_ROW_H },
        thickness: 0.5,
        color: LIGHT_BORDER,
      });
      const dateStr = formatDisplayDate(e.date);
      const amtStr = formatMoney(Number(e.amount) || 0);
      const textY = rb + 7;
      page.drawText(dateStr, { x: margin + 10, y: textY, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
      const aw = font.widthOfTextAtSize(amtStr, 10);
      page.drawText(amtStr, { x: margin + contentW - 10 - aw, y: textY, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
      cursor = rb;
    });
    page.drawLine({
      start: { x: margin, y: cursor },
      end: { x: margin + contentW, y: cursor },
      thickness: 1,
      color: LIGHT_BORDER,
    });
  }

  y = cursor - 32;
  if (y < margin + 160) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  }

  drawHLine(y);
  y -= 22;

  page.drawText('Përmbledhje financiare', {
    x: margin,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0.15, 0.15, 0.15),
  });
  y -= 22;

  const sumLines = [
    { label: 'Shuma totale e pritur:', value: formatMoney(total), color: rgb(0.1, 0.1, 0.1) },
    { label: 'Paguar deri tani:', value: formatMoney(paid), color: rgb(0.1, 0.1, 0.1) },
    left > 0
      ? { label: 'Mbetja për të paguar:', value: formatMoney(left), color: rgb(0.65, 0.08, 0.08) }
      : left < 0
        ? { label: 'Tepricë (mbi pagesë):', value: formatMoney(Math.abs(left)), color: rgb(0.05, 0.5, 0.12) }
        : { label: 'Mbetja për të paguar:', value: '0 ALL', color: rgb(0.05, 0.5, 0.12) },
  ];
  const boxPad = 12;
  const sumBoxH = sumLines.length * 18 + boxPad * 2;
  page.drawRectangle({
    x: margin,
    y: y - sumBoxH,
    width: contentW,
    height: sumBoxH,
    color: rgb(0.99, 0.99, 0.99),
    borderColor: LIGHT_BORDER,
    borderWidth: 1,
  });
  let sy = y - boxPad - 4;
  for (const row of sumLines) {
    page.drawText(row.label, { x: margin + boxPad, y: sy, size: 10, font: fontBold, color: rgb(0.35, 0.35, 0.35) });
    const vw = fontBold.widthOfTextAtSize(row.value, 10);
    page.drawText(row.value, { x: margin + contentW - boxPad - vw, y: sy, size: 10, font: fontBold, color: row.color });
    sy -= 18;
  }

  y -= sumBoxH + 24;
  page.drawText(`Gjeneruar më: ${formatDisplayDate(new Date().toISOString())}`, {
    x: margin,
    y: Math.max(margin + 4, y),
    size: 8,
    font,
    color: rgb(0.55, 0.55, 0.55),
  });

  return pdfDoc.save();
}
