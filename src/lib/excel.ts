import type { DispatchRecord, ScannedPanel } from '../types';

export interface ParsedWorkbook {
  headers: string[];
  rows: Record<string, string>[];
}

export async function parseWorkbookFile(file: File): Promise<ParsedWorkbook> {
  const XLSX = await import('xlsx');
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: '',
    raw: false,
  });
  const headerRow = (XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
  })[0] ?? []) as unknown[];
  const headers = headerRow.map((h) => String(h ?? '').trim()).filter(Boolean);
  return { headers, rows };
}

async function downloadWorkbook(sheets: { name: string; rows: Record<string, unknown>[] }[], filename: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'No data': '' }]);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function panelRows(panels: ScannedPanel[]): Record<string, unknown>[] {
  return panels.map((p, i) => ({
    'Sr. No.': i + 1,
    'Serial Number': p.serial,
    Status: p.status === 'intact' ? 'Intact' : 'Damaged',
    'Defect Type': p.defectType ?? '',
    Notes: p.notes ?? '',
    'Has Photo': p.photo ? 'Yes' : 'No',
    'Scanned At': fmtTime(p.scannedAt),
  }));
}

export function missingRows(records: DispatchRecord[]): Record<string, unknown>[] {
  return records.map((r, i) => ({
    'Sr. No.': i + 1,
    'Serial Number': r.serial,
    ...r.row,
  }));
}

export function exportPanelsSheet(panels: ScannedPanel[], status: 'intact' | 'damaged', sessionName: string) {
  const filtered = panels.filter((p) => p.status === status);
  const label = status === 'intact' ? 'Intact_Panels' : 'Damaged_Panels';
  void downloadWorkbook(
    [{ name: label, rows: panelRows(filtered) }],
    `${sessionName || 'session'}_${label}.xlsx`,
  );
}

export function exportFullReport(params: {
  sessionName: string;
  panels: ScannedPanel[];
  summaryRows: Record<string, unknown>[];
  matchedIntact: ScannedPanel[];
  matchedDamaged: ScannedPanel[];
  extra: ScannedPanel[];
  missing: DispatchRecord[];
}) {
  const { sessionName, summaryRows, matchedIntact, matchedDamaged, extra, missing } = params;
  void downloadWorkbook(
    [
      { name: 'Summary', rows: summaryRows },
      { name: 'Intact_Panels', rows: panelRows(matchedIntact) },
      { name: 'Damaged_Panels', rows: panelRows(matchedDamaged) },
      { name: 'Extra_Not_In_Dispatch', rows: panelRows(extra) },
      { name: 'Missing_Not_Scanned', rows: missingRows(missing) },
    ],
    `${sessionName || 'session'}_Full_Report.xlsx`,
  );
}
