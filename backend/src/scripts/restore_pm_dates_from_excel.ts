import prisma from '../config/db';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import path from 'path';

const checkArgbIsGreen = (argbRaw: any): boolean => {
  if (!argbRaw) return false;
  const str = String(argbRaw).toUpperCase().trim();
  if (!str) return false;
  const knownGreenHexes = [
    '92D050', '00B050', '70AD47', '548235', '385723', '375623',
    'A9D08E', 'C6EFCE', 'E2EFDA', '006100', 'A4B388', '82A094',
    'D9EAD3', 'B6D7A8', '274E13', '34A853', '22C55E', '16A34A',
    '15803D', '4CAF50', '8BC34A', '57BB8A', 'B7E1CD'
  ];
  if (knownGreenHexes.some(k => str.includes(k))) return true;

  const clean = str.replace(/^#/, '');
  const hex = clean.length === 8 ? clean.slice(2) : clean;
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      if (g > 60 && g > r && g > b) {
        if (g > 200 && (g - r >= 5 || g - b >= 5)) return true;
        if (g > r * 1.05 && g > b * 1.05) return true;
      }
    }
  }
  return false;
};

const isCellGreen = (cell: any): boolean => {
  if (!cell) return false;
  const fills = [cell.fill, cell.style?.fill].filter(Boolean);
  for (const fill of fills) {
    const fg = fill.fgColor;
    const bg = fill.bgColor;
    if (fg?.argb && checkArgbIsGreen(fg.argb)) return true;
    if (bg?.argb && checkArgbIsGreen(bg.argb)) return true;
    if (fg?.theme === 9 || bg?.theme === 9) return true;
  }
  const fonts = [cell.font, cell.style?.font].filter(Boolean);
  for (const font of fonts) {
    if (font?.color?.argb && checkArgbIsGreen(font.color.argb)) return true;
    if (font?.color?.theme === 9) return true;
  }
  return false;
};

const isCompletedText = (val: any): boolean => {
  if (!val) return false;
  const s = String(val).toLowerCase().trim();
  return /\b(done|completed|complete|attended|closed|finished|yes|ok)\b/i.test(s);
};

const monthsMap: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, apri: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, ag: 8, ug: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12
};

const parseCompletionDate = (val: any, fallbackYear = 2026): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return !isNaN(val.getTime()) ? val : null;
  const str = String(val).trim();
  if (!str) return null;

  if (/^\s*(?:generate|generater|generation|need to|to be|due to|qty\b|qty\s*\d|mention\b)/i.test(str)) {
    if (!/(\d{1,2})(?:st|nd|rd|th)\s+[A-Za-z]+/i.test(str) && !/\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}/.test(str)) {
      return null;
    }
  }

  const match = str.match(/(\d{1,2})(?:st|nd|rd|th|tth)?\s+([A-Za-z]+)(?:\s*[, -]?\s*(\d{2,4}))?/i);
  if (match) {
    const day = parseInt(match[1], 10);
    const mStr = match[2].toLowerCase();
    let year = match[3] ? parseInt(match[3].replace(/\s+/g, ''), 10) : fallbackYear;
    if (year < 100) year = 2000 + year;
    const matchedKey = Object.keys(monthsMap).find(k => mStr.startsWith(k));
    const mNum = monthsMap[mStr] || (matchedKey ? monthsMap[matchedKey] : null);
    if (mNum && day >= 1 && day <= 31 && year >= 2020 && year <= 2035) {
      return new Date(Date.UTC(year, mNum - 1, day));
    }
  }

  const cleanStr = str.replace(/(\d+)(st|nd|rd|th|tth)/gi, '$1');
  if (/^\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}$/.test(cleanStr)) {
    const d = new Date(cleanStr);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2020 && d.getFullYear() <= 2035) {
      return d;
    }
  }

  return null;
};

async function main() {
  const filePath = path.resolve(__dirname, '../../data/MC List _2026 (2) (1).xlsx');
  console.log('Loading Excel from:', filePath);

  const xlsxWb = XLSX.readFile(filePath);
  const sheetName = 'AMC LIST 2026';
  const xlsxWs = xlsxWb.Sheets[sheetName];
  if (!xlsxWs) {
    console.error(`Sheet "${sheetName}" not found!`);
    return;
  }
  const rows: any[] = XLSX.utils.sheet_to_json(xlsxWs, { header: 1 });

  const ejWb = new ExcelJS.Workbook();
  await ejWb.xlsx.readFile(filePath);
  const ejWs = ejWb.getWorksheet(sheetName);

  const dbContracts = await (prisma as any).contract.findMany({
    include: { pmSchedules: { orderBy: { pmNumber: 'asc' } } }
  });
  console.log(`Loaded ${dbContracts.length} contracts from database.`);

  let updatedPmCount = 0;
  let updatedContractsCount = 0;

  for (let rIdx = 6; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    if (!row || !row[2]) continue;

    const custName = String(row[2]).trim();
    const place = String(row[3] || '').trim();
    const po = String(row[4] || '').trim();
    const startSerial = row[11];
    const endSerial = row[12];

    const contractNum = `CON-2026-${String(rIdx - 5).padStart(3, '0')}`;
    let matchedContract = dbContracts.find((c: any) => c.contractNumber === contractNum);
    if (!matchedContract && (rIdx - 6) < dbContracts.length) {
      matchedContract = dbContracts[rIdx - 6];
    }

    if (!matchedContract) continue;

    const ejRow = ejWs ? ejWs.getRow(rIdx + 1) : null;
    const visitsCount = Number(matchedContract.noOfVisits) || matchedContract.pmSchedules.length || 3;
    let contractModified = false;

    for (let p = 1; p <= visitsCount; p++) {
      const rCol = 18 + (p - 1) * 2;
      const dCol = rCol + 1;

      const pRangeRaw = row[rCol] ? String(row[rCol]).trim() : '';
      const dateValRaw = row[dCol] ? String(row[dCol]).trim() : '';

      const ejRangeCell = ejRow ? ejRow.getCell(rCol + 1) : null;
      const ejDateCell = ejRow ? ejRow.getCell(dCol + 1) : null;
      const isGreen = isCellGreen(ejRangeCell) || isCellGreen(ejDateCell);
      const isDoneText = isCompletedText(pRangeRaw) || isCompletedText(dateValRaw);
      const completionDate = parseCompletionDate(dateValRaw);
      const isCompleted = isGreen || isDoneText || Boolean(completionDate);

      let finalRange = '';
      if (pRangeRaw && dateValRaw) {
        if (/^(?:Done:|done:)/i.test(dateValRaw)) {
          finalRange = `${pRangeRaw} | ${dateValRaw}`;
        } else if (isCompleted) {
          finalRange = `${pRangeRaw} | Done: ${dateValRaw}`;
        } else {
          finalRange = `${pRangeRaw} | ${dateValRaw}`;
        }
      } else if (pRangeRaw) {
        if (isCompleted && isDoneText && !/^(?:Done:|done:)/i.test(pRangeRaw)) {
          finalRange = `Done: ${pRangeRaw}`;
        } else {
          finalRange = pRangeRaw;
        }
      } else if (dateValRaw) {
        if (/^(?:Done:|done:)/i.test(dateValRaw)) {
          finalRange = dateValRaw;
        } else if (isCompleted) {
          finalRange = `Done: ${dateValRaw}`;
        } else {
          finalRange = dateValRaw;
        }
      }

      finalRange = finalRange.replace(/NaN-NaN-NaN/gi, '').replace(/NaN/gi, '').trim();

      const existingPM = matchedContract.pmSchedules.find((pm: any) => pm.pmNumber === p);
      if (existingPM) {
        const targetStatus = isCompleted ? 'Completed' : 'Pending';
        const targetCompletedAt = isCompleted ? (completionDate || existingPM.completedAt) : null;
        if (finalRange !== existingPM.range || existingPM.status !== targetStatus || (existingPM.completedAt && !isCompleted)) {
          await (prisma as any).contractPMSchedule.update({
            where: { id: existingPM.id },
            data: {
              range: finalRange,
              status: targetStatus,
              completedAt: targetCompletedAt
            }
          });
          updatedPmCount++;
          contractModified = true;
        }
      } else {
        await (prisma as any).contractPMSchedule.create({
          data: {
            contractId: matchedContract.id,
            pmNumber: p,
            range: finalRange,
            status: isCompleted ? 'Completed' : 'Pending',
            completedAt: completionDate
          }
        });
        updatedPmCount++;
        contractModified = true;
      }
    }

    if (contractModified) updatedContractsCount++;
  }

  console.log(`Finished! Updated ${updatedPmCount} PM visits across ${updatedContractsCount} contracts.`);
}

main()
  .catch(console.error)
  .finally(() => (prisma as any).$disconnect());
