import type { DispatchSheet, ReconciliationResult, ScannedPanel } from '../types';
import { normalizeSerial } from '../types';

export function reconcile(panels: ScannedPanel[], dispatch: DispatchSheet | null): ReconciliationResult {
  if (!dispatch) {
    return { matchedIntact: [], matchedDamaged: [], missing: [], extra: [...panels] };
  }

  const dispatchBySerial = new Map(dispatch.records.map((r) => [normalizeSerial(r.serial), r]));
  const scannedSerials = new Set(panels.map((p) => normalizeSerial(p.serial)));

  const matchedIntact: ScannedPanel[] = [];
  const matchedDamaged: ScannedPanel[] = [];
  const extra: ScannedPanel[] = [];

  for (const panel of panels) {
    const key = normalizeSerial(panel.serial);
    if (dispatchBySerial.has(key)) {
      if (panel.status === 'intact') matchedIntact.push(panel);
      else matchedDamaged.push(panel);
    } else {
      extra.push(panel);
    }
  }

  const missing = dispatch.records.filter((r) => !scannedSerials.has(normalizeSerial(r.serial)));

  return { matchedIntact, matchedDamaged, missing, extra };
}
