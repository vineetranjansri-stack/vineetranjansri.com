import { useEffect, useMemo, useRef, useState } from 'react';
import Scanner from './Scanner';
import { buildDispatchIndex, normalizeSerial, DEFECT_TYPES, type DispatchSheet, type ScannedPanel } from '../types';
import { compressImage } from '../lib/image';

interface ScanTabProps {
  panels: ScannedPanel[];
  dispatch: DispatchSheet | null;
  onAddPanel: (panel: ScannedPanel) => void;
  onUpdatePanel: (id: string, updates: Partial<ScannedPanel>) => void;
  onDeletePanel: (id: string) => void;
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `panel-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ScanTab({ panels, dispatch, onAddPanel, onUpdatePanel, onDeletePanel }: ScanTabProps) {
  const [pendingSerial, setPendingSerial] = useState<string | null>(null);
  const [duplicateOf, setDuplicateOf] = useState<ScannedPanel | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDefectForm, setShowDefectForm] = useState(false);
  const [defectType, setDefectType] = useState<string>(DEFECT_TYPES[0]);
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const pendingCardRef = useRef<HTMLDivElement>(null);

  // A scan can land below the fold on a small phone screen once the scanner-gun and
  // camera cards above take up space — scroll the result into view so it's never
  // mistaken for "nothing happened."
  useEffect(() => {
    if (pendingSerial) {
      pendingCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [pendingSerial]);

  const bySerial = useMemo(() => {
    const map = new Map<string, ScannedPanel>();
    for (const p of panels) map.set(normalizeSerial(p.serial), p);
    return map;
  }, [panels]);

  const dispatchIndex = useMemo(() => buildDispatchIndex(dispatch), [dispatch]);
  const dispatchMatch = pendingSerial && dispatch ? dispatchIndex.get(normalizeSerial(pendingSerial)) : undefined;
  const dispatchDetailEntries = dispatchMatch
    ? Object.entries(dispatchMatch.row).filter(([key, value]) => key !== dispatch?.serialColumn && value)
    : [];

  const recent = panels.slice(-6).reverse();

  function handleDecode(value: string) {
    const existing = bySerial.get(normalizeSerial(value));
    setPendingSerial(value);
    setShowDefectForm(false);
    setDefectType(DEFECT_TYPES[0]);
    setNotes('');
    setPhoto(null);
    setEditingId(null);
    if (existing) {
      setDuplicateOf(existing);
    } else {
      setDuplicateOf(null);
    }
  }

  function resetPending() {
    setPendingSerial(null);
    setDuplicateOf(null);
    setEditingId(null);
    setShowDefectForm(false);
    setPhoto(null);
  }

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    try {
      setPhoto(await compressImage(file));
    } catch {
      // photo is optional — silently skip on failure
    } finally {
      setPhotoBusy(false);
    }
  }

  function saveIntact() {
    if (!pendingSerial) return;
    save('intact');
  }

  function saveDamaged() {
    if (!pendingSerial) return;
    save('damaged');
  }

  function save(status: 'intact' | 'damaged') {
    if (!pendingSerial) return;
    if (editingId) {
      onUpdatePanel(editingId, {
        status,
        defectType: status === 'damaged' ? defectType : undefined,
        notes: status === 'damaged' ? notes.trim() || undefined : undefined,
        photo: status === 'damaged' ? photo ?? undefined : undefined,
      });
      setLastSavedId(editingId);
    } else {
      const panel: ScannedPanel = {
        id: newId(),
        serial: pendingSerial.trim(),
        status,
        defectType: status === 'damaged' ? defectType : undefined,
        notes: status === 'damaged' ? notes.trim() || undefined : undefined,
        photo: status === 'damaged' ? photo ?? undefined : undefined,
        scannedAt: new Date().toISOString(),
      };
      onAddPanel(panel);
      setLastSavedId(panel.id);
    }
    resetPending();
  }

  function updateExisting() {
    if (!duplicateOf) return;
    setEditingId(duplicateOf.id);
    setDefectType(duplicateOf.defectType ?? DEFECT_TYPES[0]);
    setNotes(duplicateOf.notes ?? '');
    setPhoto(duplicateOf.photo ?? null);
    setShowDefectForm(duplicateOf.status === 'damaged');
    setDuplicateOf(null);
  }

  function undoLast() {
    if (!lastSavedId) return;
    onDeletePanel(lastSavedId);
    setLastSavedId(null);
  }

  const intactCount = panels.filter((p) => p.status === 'intact').length;
  const damagedCount = panels.filter((p) => p.status === 'damaged').length;

  return (
    <div className="scan-tab">
      <div className="counters">
        <div className="counter">
          <span className="counter-value">{panels.length}</span>
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
      </div>

      <Scanner onDecode={handleDecode} disabled={pendingSerial !== null && !duplicateOf} />

      <div ref={pendingCardRef}>
      {duplicateOf && (
        <div className="card warning-card">
          <p>
            Serial <strong>{pendingSerial}</strong> was already scanned as{' '}
            <strong>{duplicateOf.status === 'intact' ? 'Intact' : 'Damaged'}</strong> at{' '}
            {new Date(duplicateOf.scannedAt).toLocaleTimeString()}.
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn-outline" onClick={updateExisting}>
              Update that entry
            </button>
            <button type="button" className="btn btn-secondary" onClick={resetPending}>
              Ignore, scan next
            </button>
          </div>
        </div>
      )}

      {pendingSerial && (!duplicateOf || editingId) && (
        <div className="card classify-card">
          <p className="pending-serial">
            {editingId ? 'Editing' : 'Classify'}: <strong>{pendingSerial}</strong>
          </p>
          {dispatch && (
            dispatchMatch ? (
              dispatchDetailEntries.length > 0 && (
                <ul className="kv-list dispatch-match">
                  {dispatchDetailEntries.map(([key, value]) => (
                    <li key={key}>
                      <span>{key}</span>
                      <span>{value}</span>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <p className="scanner-error">Not found in the loaded dispatch sheet — check this is the right consignment.</p>
            )
          )}
          {!showDefectForm ? (
            <div className="btn-row">
              <button type="button" className="btn btn-success" onClick={saveIntact}>
                ✓ Mark Intact
              </button>
              <button type="button" className="btn btn-danger" onClick={() => setShowDefectForm(true)}>
                ✗ Mark Damaged
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetPending}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="defect-form">
              <label htmlFor="defect-type">Defect type</label>
              <select id="defect-type" value={defectType} onChange={(e) => setDefectType(e.target.value)}>
                {DEFECT_TYPES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <label htmlFor="defect-notes">Notes (optional)</label>
              <textarea
                id="defect-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. crack near top-left corner, 5cm"
                rows={2}
              />
              <label htmlFor="defect-photo">Photo of damage (optional)</label>
              {photo ? (
                <div className="photo-preview">
                  <img src={photo} alt="Damage preview" />
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setPhoto(null)}>
                    Remove photo
                  </button>
                </div>
              ) : (
                <input
                  id="defect-photo"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelected}
                  disabled={photoBusy}
                />
              )}
              {photoBusy && <p className="hint">Processing photo…</p>}
              <div className="btn-row">
                <button type="button" className="btn btn-danger" onClick={saveDamaged}>
                  Save Damaged Panel
                </button>
                <button type="button" className="btn btn-secondary" onClick={resetPending}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>

      {lastSavedId && !pendingSerial && (
        <div className="card undo-card">
          <span>Saved.</span>
          <button type="button" className="btn btn-outline" onClick={undoLast}>
            Undo last scan
          </button>
        </div>
      )}

      {recent.length > 0 && (
        <div className="recent-scans">
          <h3>Recent scans</h3>
          <ul>
            {recent.map((p) => (
              <li key={p.id} className={p.status === 'damaged' ? 'row-damaged' : 'row-intact'}>
                {p.photo && <img className="thumb" src={p.photo} alt="" />}
                <span className="serial">{p.serial}</span>
                <span className="status">{p.status === 'intact' ? 'Intact' : `Damaged (${p.defectType})`}</span>
                <span className="time">{new Date(p.scannedAt).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
