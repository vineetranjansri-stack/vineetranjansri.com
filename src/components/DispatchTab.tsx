import { useMemo, useRef, useState } from 'react';
import type { DispatchSheet, ScannedPanel } from '../types';
import { normalizeSerial } from '../types';
import { parseWorkbookFile } from '../lib/excel';
import { reconcile } from '../lib/reconcile';

interface DispatchTabProps {
  panels: ScannedPanel[];
  dispatch: DispatchSheet | null;
  onSetDispatch: (dispatch: DispatchSheet | null) => void;
}

interface PendingUpload {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
  serialColumn: string;
}

function guessSerialColumn(headers: string[]): string {
  const hit = headers.find((h) => h.toLowerCase().includes('serial'));
  return hit ?? headers[0] ?? '';
}

export default function DispatchTab({ panels, dispatch, onSetDispatch }: DispatchTabProps) {
  const [pending, setPending] = useState<PendingUpload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const { headers, rows } = await parseWorkbookFile(file);
      if (headers.length === 0) {
        setError('Could not find a header row in that file.');
        return;
      }
      setPending({ fileName: file.name, headers, rows, serialColumn: guessSerialColumn(headers) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.');
    }
  }

  function confirmDispatch() {
    if (!pending) return;
    const records = pending.rows
      .map((row) => ({ serial: normalizeSerial(String(row[pending.serialColumn] ?? '')), row }))
      .filter((r) => r.serial.length > 0);
    onSetDispatch({
      fileName: pending.fileName,
      headers: pending.headers,
      serialColumn: pending.serialColumn,
      records,
    });
    setPending(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function replaceFile() {
    onSetDispatch(null);
    setPending(null);
  }

  const result = useMemo(() => reconcile(panels, dispatch), [panels, dispatch]);

  return (
    <div className="dispatch-tab">
      {!dispatch && !pending && (
        <div className="card">
          <h3>Upload supplier dispatch sheet</h3>
          <p className="hint">Accepts .xlsx, .xls, or .csv. It should have one column with the panel serial numbers.</p>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
          {error && <p className="scanner-error">{error}</p>}
        </div>
      )}

      {pending && (
        <div className="card">
          <h3>Map the serial number column</h3>
          <p className="hint">
            {pending.fileName} — {pending.rows.length} rows found.
          </p>
          <label htmlFor="serial-col">Which column holds the panel serial number?</label>
          <select
            id="serial-col"
            value={pending.serialColumn}
            onChange={(e) => setPending({ ...pending, serialColumn: e.target.value })}
          >
            {pending.headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>

          <div className="table-wrap preview-table">
            <table>
              <thead>
                <tr>
                  {pending.headers.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pending.rows.slice(0, 5).map((row, i) => (
                  <tr key={i}>
                    {pending.headers.map((h) => (
                      <td key={h}>{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={confirmDispatch}>
              Use this sheet
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {dispatch && (
        <>
          <div className="card">
            <h3>Dispatch sheet loaded</h3>
            <p className="hint">
              {dispatch.fileName} — {dispatch.records.length} panels dispatched (serial column: {dispatch.serialColumn})
            </p>
            <button type="button" className="btn btn-outline" onClick={replaceFile}>
              Replace dispatch sheet
            </button>
          </div>

          <div className="counters">
            <div className="counter">
              <span className="counter-value">{dispatch.records.length}</span>
              <span className="counter-label">Dispatched</span>
            </div>
            <div className="counter counter-good">
              <span className="counter-value">{result.matchedIntact.length}</span>
              <span className="counter-label">Matched Intact</span>
            </div>
            <div className="counter counter-bad">
              <span className="counter-value">{result.matchedDamaged.length}</span>
              <span className="counter-label">Matched Damaged</span>
            </div>
            <div className="counter counter-warn">
              <span className="counter-value">{result.missing.length}</span>
              <span className="counter-label">Missing (not scanned)</span>
            </div>
            <div className="counter counter-warn">
              <span className="counter-value">{result.extra.length}</span>
              <span className="counter-label">Extra (not in dispatch)</span>
            </div>
          </div>

          {result.missing.length > 0 && (
            <div className="card">
              <h3>Missing — dispatched but not scanned ({result.missing.length})</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Sr. No.</th>
                      <th>Serial Number</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.missing.slice(0, 200).map((r, i) => (
                      <tr key={r.serial + i}>
                        <td>{i + 1}</td>
                        <td>{r.serial}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.missing.length > 200 && <p className="hint">Showing first 200 — full list in the exported report.</p>}
              </div>
            </div>
          )}

          {result.extra.length > 0 && (
            <div className="card">
              <h3>Extra — scanned but not in dispatch sheet ({result.extra.length})</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Sr. No.</th>
                      <th>Serial Number</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.extra.slice(0, 200).map((p, i) => (
                      <tr key={p.id}>
                        <td>{i + 1}</td>
                        <td>{p.serial}</td>
                        <td>{p.status === 'intact' ? 'Intact' : 'Damaged'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
