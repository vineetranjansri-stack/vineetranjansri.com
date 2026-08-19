export type PanelStatus = 'intact' | 'damaged';

export const DEFECT_TYPES = [
  'Crack',
  'Glass Breakage',
  'Frame Damage',
  'Hot Spot',
  'Junction Box Damage',
  'Backsheet Damage',
  'Scratch',
  'Delamination',
  'Other',
] as const;

export type DefectType = (typeof DEFECT_TYPES)[number];

export interface ScannedPanel {
  id: string;
  serial: string;
  status: PanelStatus;
  defectType?: string;
  notes?: string;
  photo?: string; // compressed data URL, damaged panels only
  scannedAt: string;
}

export interface DispatchRecord {
  serial: string;
  row: Record<string, string>;
}

export interface DispatchSheet {
  fileName: string;
  headers: string[];
  serialColumn: string;
  records: DispatchRecord[];
}

export interface SessionState {
  name: string;
  createdAt: string;
  panels: ScannedPanel[];
  dispatch: DispatchSheet | null;
}

export function createEmptySession(name: string): SessionState {
  return {
    name,
    createdAt: new Date().toISOString(),
    panels: [],
    dispatch: null,
  };
}

export interface ReconciliationResult {
  matchedIntact: ScannedPanel[];
  matchedDamaged: ScannedPanel[];
  missing: DispatchRecord[]; // in dispatch, never scanned
  extra: ScannedPanel[]; // scanned, not in dispatch
}

export function normalizeSerial(serial: string): string {
  return serial.trim().toUpperCase();
}
