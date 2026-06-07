import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { formatAttendanceDisplayDate } from '@/lib/attendance';
import {
  getMissedPracticePercent,
  getMissedPracticeTier,
  MISSED_PRACTICE_TIER_COLORS,
  type PlayerAttendanceSummary,
} from '@/lib/playerAttendanceSummary';
import type { PlayerPaymentPdfInput } from '@/lib/playerPaymentPdf';

type PaymentEntry = { amount: number; date: string };

const TEAM_LOGO_FILENAME = 'logo-club-albania.png';
const STAMP_FILENAME = 'stamp-club-albania.png';

const DEJAVU_SANS_TTF_DIR = path.join(process.cwd(), 'node_modules', 'dejavu-fonts-ttf', 'ttf');
const LOGO_MAX_HEIGHT = 56;
const PHOTO_BOX = 92;
const TABLE_ROW_H = 22;
const TABLE_HEADER_H = 24;
const FOOTER_SEP_Y = 50;
const FOOTER_LINE1_Y = 36;
const FOOTER_LINE2_Y = 25;

export type PlayerFinalReportPdfInput = PlayerPaymentPdfInput & {
  contractEndDate: Date | string;
  attendance: PlayerAttendanceSummary;
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

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeDonutSlice(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const startOuter = polarToCartesian(cx, cy, outerR, startAngle);
  const endOuter = polarToCartesian(cx, cy, outerR, endAngle);
  const startInner = polarToCartesian(cx, cy, innerR, endAngle);
  const endInner = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ');
}

async function renderAttendanceChartPng(
  missed: number,
  present: number,
  colors: { missed: string; present: string },
): Promise<Uint8Array | null> {
  const total = missed + present;
  if (total === 0) return null;

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 64;
  const innerR = 42;

  let slices: string;
  if (missed === 0) {
    slices = `<circle cx="${cx}" cy="${cy}" r="${outerR}" fill="${colors.present}" />`;
    slices += `<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="white" />`;
  } else if (present === 0) {
    slices = `<circle cx="${cx}" cy="${cy}" r="${outerR}" fill="${colors.missed}" />`;
    slices += `<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="white" />`;
  } else {
    const missedAngle = (missed / total) * 360;
    const missedPath = describeDonutSlice(cx, cy, outerR, innerR, 0, missedAngle);
    const presentPath = describeDonutSlice(cx, cy, outerR, innerR, missedAngle, 360);
    slices = `<path d="${missedPath}" fill="${colors.missed}" />`;
    slices += `<path d="${presentPath}" fill="${colors.present}" />`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${slices}</svg>`;
  const buf = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  return new Uint8Array(buf);
}

export async function buildPlayerFinalReportPdfBytes(input: PlayerFinalReportPdfInput): Promise<Uint8Array> {
  const [
    { PDFDocument, rgb },
    logoBytes,
    stampBytes,
    photoBytes,
    fontRegularBytes,
    fontBoldBytes,
    fontItalicBytes,
    fontBoldItalicBytes,
    fontkit,
    chartBytes,
  ] = await Promise.all([
    import('pdf-lib'),
    loadLogoPngBytes(),
    loadStampPngBytes(),
    loadPlayerPhotoPng(input.photo),
    readFile(path.join(DEJAVU_SANS_TTF_DIR, 'DejaVuSans.ttf')),
    readFile(path.join(DEJAVU_SANS_TTF_DIR, 'DejaVuSans-Bold.ttf')),
    readFile(path.join(DEJAVU_SANS_TTF_DIR, 'DejaVuSans-Oblique.ttf')),
    readFile(path.join(DEJAVU_SANS_TTF_DIR, 'DejaVuSans-BoldOblique.ttf')),
    import('@pdf-lib/fontkit').then((m) => m.default),
    (async () => {
      const total = input.attendance.totalPractices;
      const missed = input.attendance.missedCount;
      const present = total - missed;
      const tier = getMissedPracticeTier(getMissedPracticePercent(input.attendance));
      return renderAttendanceChartPng(missed, present, MISSED_PRACTICE_TIER_COLORS[tier]);
    })(),
  ]);

  const LIGHT_BORDER = rgb(0.72, 0.72, 0.72);
  const HEADER_FILL = rgb(0.94, 0.94, 0.94);
  const ALT_ROW = rgb(0.985, 0.985, 0.985);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const [font, fontBold, fontItalic, fontBoldItalic] = await Promise.all([
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
      /* skip */
    }
  }

  let stampPng: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  if (stampBytes) {
    try {
      stampPng = await pdfDoc.embedPng(stampBytes);
    } catch {
      /* skip */
    }
  }

  let chartPng: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  if (chartBytes) {
    try {
      chartPng = await pdfDoc.embedPng(chartBytes);
    } catch {
      /* skip */
    }
  }

  const margin = 52;
  const pageWidth = 595;
  const pageHeight = 842;
  const contentW = pageWidth - margin * 2;

  const FOOTER_LINE1 =
    'Adresa: Shkolla 9-vje\xE7are "Vasil Shanto" Tirane \xB7 E-mail: clubalbania@fshv.org.al \xB7 Facebook: Club Albania \xB7';
  const FOOTER_LINE2 = 'Instagram: Club.Albania \xB7 Cel - WhatsApp +355697091027';

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
  centerText(page, 'T\xEB dh\xEBnat p\xEBrfundimtare', 13, fontBold, y);
  y -= 20;
  drawHLine(page, y);
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
    page.drawText(label, { x: infoX, y: infoY, size: 9, font: fontBold, color: rgb(0.35, 0.35, 0.35) });
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

  const displayName = String(input.name).normalize('NFC');
  const displayTeam = input.team != null ? String(input.team).normalize('NFC') : '';
  const displayEmail = input.email != null ? String(input.email).normalize('NFC') : '';
  const displayPhone = input.phone != null ? String(input.phone).normalize('NFC') : '';

  infoLine('Emri:', displayName);
  infoLine('Ekipi:', displayTeam || '-');
  infoLine('Nr. fanell\xEBs:', input.jerseyNumber != null ? String(input.jerseyNumber) : '-');
  infoLine('Email:', displayEmail || '-');
  infoLine('Telefoni:', displayPhone || '-');
  infoLine('Datelindja:', input.dateOfBirth ? formatDisplayDate(datePart(input.dateOfBirth)) : '-');
  infoLine('Data e bashkimit:', formatDisplayDate(datePart(input.joinDate)));
  infoLine('Data e mbarimit:', formatDisplayDate(datePart(input.contractEndDate)));
  infoLine('Statusi:', input.active ? 'Aktiv' : 'Joaktiv');

  y = Math.min(photoBottom - 12, infoY - 8);
  drawHLine(page, y);
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
    page.drawText('Data e pages\xEBs', { x: margin + 10, y: textY, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    const hdr = 'Shuma (ALL)';
    const hw = fontBold.widthOfTextAtSize(hdr, 10);
    page.drawText(hdr, { x: margin + contentW - 10 - hw, y: textY, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    return bottom;
  };

  const startContinuationPage = (title: string): number => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    drawPageBackground(page);
    let py = pageHeight - margin;
    page.drawText(title, {
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
  const rowFits = (nextRowBottom: number) => nextRowBottom >= margin + 180;

  if (history.length === 0) {
    if (!rowFits(cursor - 40)) {
      cursor = startContinuationPage('Historiku i pagesave (vazhdim)');
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
    page.drawText('Nuk ka pagesa t\xEB regjistruara.', {
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
        cursor = startContinuationPage('Historiku i pagesave (vazhdim)');
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

  const sumLines = [
    { label: 'Shuma totale e pritur:', value: formatMoney(total), color: rgb(0.1, 0.1, 0.1) },
    { label: 'Paguar deri tani:', value: formatMoney(paid), color: rgb(0.1, 0.1, 0.1) },
    left > 0
      ? { label: 'Mbetja p\xEBr t\xEB paguar:', value: formatMoney(left), color: rgb(0.65, 0.08, 0.08) }
      : left < 0
        ? { label: 'Tepric\xEB (mbi pages\xEB):', value: formatMoney(Math.abs(left)), color: rgb(0.05, 0.5, 0.12) }
        : { label: 'Mbetja p\xEBr t\xEB paguar:', value: '0 ALL', color: rgb(0.05, 0.5, 0.12) },
  ];
  const boxPad = 12;
  const sumBoxH = sumLines.length * 18 + boxPad * 2;

  if (cursor - sumBoxH - 48 < margin + 120) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    drawPageBackground(page);
    cursor = pageHeight - margin - 24;
  }

  y = cursor - 28;
  drawHLine(page, y);
  y -= 22;
  page.drawText('P\xEBrmbledhje financiare', {
    x: margin,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0.15, 0.15, 0.15),
  });
  y -= 22;
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
  cursor = y - sumBoxH - 28;

  const attendanceTotal = input.attendance.totalPractices;
  const attendanceMissed = input.attendance.missedCount;
  const attendancePresent = attendanceTotal - attendanceMissed;
  const missedPct = getMissedPracticePercent(input.attendance);
  const misses = input.attendance.misses;

  const attendanceBlockMinH = attendanceTotal === 0 ? 80 : chartPng ? 220 : 120;
  if (cursor - attendanceBlockMinH < margin + 100) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    drawPageBackground(page);
    cursor = pageHeight - margin - 24;
  }

  y = cursor;
  drawHLine(page, y);
  y -= 22;
  page.drawText('Mungesat n\xEB st\xEBrvitje', {
    x: margin,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0.15, 0.15, 0.15),
  });
  y -= 20;

  if (attendanceTotal === 0) {
    page.drawText('Pa t\xEB dh\xEBna prezence', {
      x: margin,
      y: y - 4,
      size: 10,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
    cursor = y - 28;
  } else {
    const summaryText = `${missedPct}% mungesa n\xEB st\xEBrvitje \xB7 ${attendanceMissed} nga ${attendanceTotal} st\xEBrvitje`;
    page.drawText(summaryText, {
      x: margin,
      y: y - 2,
      size: 10,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 18;
    page.drawText(`Prezent: ${attendancePresent}  \xB7  Munguar: ${attendanceMissed}`, {
      x: margin,
      y: y - 2,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 16;

    if (chartPng) {
      const chartSize = 120;
      const chartX = (pageWidth - chartSize) / 2;
      const chartY = y - chartSize;
      page.drawImage(chartPng, { x: chartX, y: chartY, width: chartSize, height: chartSize });
      y = chartY - 16;
    }

    if (misses.length > 0) {
      y -= 8;
      page.drawText('Lista e mungesave', {
        x: margin,
        y: y - 2,
        size: 10,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 18;

      const missHeaderBottom = y - TABLE_HEADER_H;
      page.drawRectangle({
        x: margin,
        y: missHeaderBottom,
        width: contentW,
        height: TABLE_HEADER_H,
        color: HEADER_FILL,
        borderColor: LIGHT_BORDER,
        borderWidth: 1,
      });
      page.drawText('Data', { x: margin + 10, y: missHeaderBottom + 8, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
      page.drawText('Ekipi', { x: margin + 120, y: missHeaderBottom + 8, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
      cursor = missHeaderBottom;

      const missRowFits = (nextBottom: number) => nextBottom >= margin + 90;

      misses.forEach((m, i) => {
        const rowBottom = cursor - TABLE_ROW_H;
        if (!missRowFits(rowBottom)) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          drawPageBackground(page);
          let py = pageHeight - margin;
          page.drawText('Lista e mungesave (vazhdim)', {
            x: margin,
            y: py,
            size: 11,
            font: fontBold,
            color: rgb(0.15, 0.15, 0.15),
          });
          py -= 22;
          const hb = py - TABLE_HEADER_H;
          page.drawRectangle({
            x: margin,
            y: hb,
            width: contentW,
            height: TABLE_HEADER_H,
            color: HEADER_FILL,
            borderColor: LIGHT_BORDER,
            borderWidth: 1,
          });
          page.drawText('Data', { x: margin + 10, y: hb + 8, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
          page.drawText('Ekipi', { x: margin + 120, y: hb + 8, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
          cursor = hb;
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
        const dateStr = formatAttendanceDisplayDate(m.dateKey);
        const teamStr = String(m.teamName).normalize('NFC');
        page.drawText(dateStr, { x: margin + 10, y: rb + 7, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(teamStr, {
          x: margin + 120,
          y: rb + 7,
          size: 10,
          font,
          color: rgb(0.1, 0.1, 0.1),
          maxWidth: contentW - 130,
        });
        cursor = rb;
      });
    } else {
      page.drawText('Nuk ka mungesa t\xEB regjistruara', {
        x: margin,
        y: y - 4,
        size: 10,
        font,
        color: rgb(0.45, 0.45, 0.45),
      });
      cursor = y - 28;
    }
  }

  const STAMP_SIZE = 80;
  const STAMP_BOTTOM_MIN = FOOTER_SEP_Y + 14;
  if (cursor - STAMP_SIZE - 60 < STAMP_BOTTOM_MIN) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    drawPageBackground(page);
    cursor = pageHeight - margin - 24;
  }

  y = cursor - 20;
  const thankYou = 'Duke ju falenderuar p\xEBr bashk\xEBpunimin!';
  const stampX = margin;
  const stampY = y - 17 - STAMP_SIZE;

  page.drawText(thankYou, {
    x: stampX,
    y: y - 13,
    size: 11,
    font: fontBoldItalic,
    color: rgb(0.05, 0.18, 0.55),
  });

  if (stampPng) {
    const scale = STAMP_SIZE / Math.max(stampPng.width, stampPng.height);
    page.drawImage(stampPng, { x: stampX, y: stampY, width: stampPng.width * scale, height: stampPng.height * scale });
  }

  page.drawText(`Gjeneruar m\xEB: ${formatDisplayDate(new Date().toISOString())}`, {
    x: margin,
    y: Math.max(STAMP_BOTTOM_MIN, stampY - 16),
    size: 8,
    font,
    color: rgb(0.55, 0.55, 0.55),
  });

  return pdfDoc.save();
}
