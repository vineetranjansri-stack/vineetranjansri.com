import { useMemo } from 'react';
import type { DispatchSheet, ScannedPanel } from '../types';
import { reconcile } from '../lib/reconcile';
import { exportFullReport } from '../lib/excel';

interface SummaryTabProps {
  sessionName: string;
  panels: ScannedPanel[];
  dispatch: DispatchSheet | null;
}

export default function SummaryTab({ sessionName, panels, dispatch }: SummaryTabProps) {
  const result = useMemo(() => reconcile(panels, dispatch), [panels, dispatch]);

  const totalScanned = panels.length;
  const intactCount = panels.filter((p) => p.status === 'intact').length;
  const damagedCount = panels.filter((p) => p.status === 'damaged').length;
  const damageRate = totalScanned > 0 ? ((damagedCount / totalScanned) * 100).toFixed(1) : '0.0';

  const defectBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of panels) {
      if (p.status !== 'damaged') continue;
      const key = p.defectType ?? 'Unspecified';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [panels]);

  const summaryRows = [
    { Metric: 'Session name', Value: sessionName || '(untitled)' },
    { Metric: 'Report generated', Value: new Date().toLocaleString() },
    { Metric: 'Dispatch sheet', Value: dispatch?.fileName ?? 'Not loaded' },
    { Metric: 'Total dispatched (per supplier sheet)', Value: dispatch?.records.length ?? 'N/A' },
    { Metric: 'Total panels scanned', Value: totalScanned },
    { Metric: 'Intact panels', Value: intactCount },
    { Metric: 'Damaged panels', Value: damagedCount },
    { Metric: 'Damage rate', Value: `${damageRate}%` },
    { Metric: 'Matched — Intact', Value: result.matchedIntact.length },
    { Metric: 'Matched — Damaged', Value: result.matchedDamaged.length },
    { Metric: 'Missing (dispatched, not scanned)', Value: result.missing.length },
    { Metric: 'Extra (scanned, not in dispatch)', Value: result.extra.length },
  ];

  function handleExport() {
    exportFullReport({
      sessionName,
      panels,
      summaryRows,
      matchedIntact: dispatch ? result.matchedIntact : panels.filter((p) => p.status === 'intact'),
      matchedDamaged: dispatch ? result.matchedDamaged : panels.filter((p) => p.status === 'damaged'),
      extra: result.extra,
      missing: result.missing,
      dispatch,
    });
  }

  return (
    <div className="summary-tab">
      <div className="counters">
        <div className="counter">
          <span className="counter-value">{totalScanned}</span>
          <span className="counter-label">Total Scanned</span>
        </div>
        <div className="counter counter-good">
          <span className="counter-value">{intactCount}</span>
          <span className="counter-label">Intact</span>
        </div>
        <div className="counter counter-bad">
          <span className="counter-value">{damagedCount}</span>
          <span className="counter-label">Damaged</span>
        </div>
        <div className="counter counter-warn">
          <span className="counter-value">{damageRate}%</span>
          <span className="counter-label">Damage Rate</span>
        </div>
      </div>

      <div className="card">
        <h3>Summary</h3>
        <table className="summary-table">
          <tbody>
            {summaryRows.map((row) => (
              <tr key={row.Metric}>
                <td>{row.Metric}</td>
                <td>{row.Value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {defectBreakdown.length > 0 && (
        <div className="card">
          <h3>Damage breakdown by defect type</h3>
          <table className="summary-table">
            <tbody>
              {defectBreakdown.map(([type, count]) => (
                <tr key={type}>
                  <td>{type}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button type="button" className="btn btn-primary" onClick={handleExport} disabled={totalScanned === 0}>
        Export Full Report (.xlsx)
      </button>
      <p className="hint">
        Includes Summary, Intact Panels, Damaged Panels, Extra (not in dispatch), and Missing (dispatched but not
        scanned) as separate sheets in one workbook.
      </p>
    </div>
  );
}
