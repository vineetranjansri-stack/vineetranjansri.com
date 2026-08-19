import { Fragment, useMemo, useState } from 'react';
import { buildDispatchIndex, normalizeSerial, DEFECT_TYPES, type DispatchSheet, type ScannedPanel } from '../types';
import { exportPanelsSheet } from '../lib/excel';
import { compressImage } from '../lib/image';

interface InventoryTabProps {
  panels: ScannedPanel[];
  sessionName: string;
  dispatch: DispatchSheet | null;
  onUpdatePanel: (id: string, updates: Partial<ScannedPanel>) => void;
  onDeletePanel: (id: string) => void;
}

type Filter = 'all' | 'intact' | 'damaged';

export default function InventoryTab({ panels, sessionName, dispatch, onUpdatePanel, onDeletePanel }: InventoryTabProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<'intact' | 'damaged'>('intact');
  const [editDefect, setEditDefect] = useState<string>(DEFECT_TYPES[0]);
  const [editNotes, setEditNotes] = useState('');
  const [editPhoto, setEditPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const dispatchIndex = useMemo(() => buildDispatchIndex(dispatch), [dispatch]);

  const filtered = useMemo(() => {
    return panels
      .filter((p) => (filter === 'all' ? true : p.status === filter))
      .filter((p) => p.serial.toLowerCase().includes(search.trim().toLowerCase()))
      .slice()
      .reverse();
  }, [panels, filter, search]);

  function startEdit(p: ScannedPanel) {
    setEditingId(p.id);
    setEditStatus(p.status);
    setEditDefect(p.defectType ?? DEFECT_TYPES[0]);
    setEditNotes(p.notes ?? '');
    setEditPhoto(p.photo ?? null);
  }

  function saveEdit(id: string) {
    onUpdatePanel(id, {
      status: editStatus,
      defectType: editStatus === 'damaged' ? editDefect : undefined,
      notes: editStatus === 'damaged' ? editNotes.trim() || undefined : undefined,
      photo: editStatus === 'damaged' ? editPhoto ?? undefined : undefined,
    });
    setEditingId(null);
  }

  async function handleEditPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    try {
      setEditPhoto(await compressImage(file));
    } catch {
      // photo is optional — silently skip on failure
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <div className="inventory-tab">
      <div className="inventory-toolbar">
        <input
          type="search"
          placeholder="Search serial number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filter-buttons">
          {(['all', 'intact', 'damaged'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={filter === f ? 'btn btn-outline active' : 'btn btn-outline'}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'intact' ? 'Intact' : 'Damaged'}
            </button>
          ))}
        </div>
      </div>

      <div className="btn-row">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => exportPanelsSheet(panels, 'intact', sessionName, dispatch)}
        >
          Export Intact Sheet (.xlsx)
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => exportPanelsSheet(panels, 'damaged', sessionName, dispatch)}
        >
          Export Damaged Sheet (.xlsx)
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sr. No.</th>
              <th>Serial Number</th>
              <th>Status</th>
              <th>Defect / Notes</th>
              <th>Photo</th>
              <th>Scanned At</th>
              {dispatch && <th>Dispatch Details</th>}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const matched = dispatch ? dispatchIndex.get(normalizeSerial(p.serial)) : undefined;
              const detailEntries = matched
                ? Object.entries(matched.row).filter(([key, value]) => key !== dispatch?.serialColumn && value)
                : [];
              return (
              <Fragment key={p.id}>
              <tr className={p.status === 'damaged' ? 'row-damaged' : 'row-intact'}>
                <td>{filtered.length - i}</td>
                <td>{p.serial}</td>
                <td>
                  {editingId === p.id ? (
                    <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as 'intact' | 'damaged')}>
                      <option value="intact">Intact</option>
                      <option value="damaged">Damaged</option>
                    </select>
                  ) : p.status === 'intact' ? (
                    'Intact'
                  ) : (
                    'Damaged'
                  )}
                </td>
                <td>
                  {editingId === p.id ? (
                    editStatus === 'damaged' ? (
                      <div className="inline-defect">
                        <select value={editDefect} onChange={(e) => setEditDefect(e.target.value)}>
                          {DEFECT_TYPES.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Notes"
                        />
                      </div>
                    ) : (
                      '—'
                    )
                  ) : p.status === 'damaged' ? (
                    `${p.defectType ?? ''}${p.notes ? ` — ${p.notes}` : ''}`
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {editingId === p.id ? (
                    editStatus === 'damaged' ? (
                      editPhoto ? (
                        <div className="photo-preview">
                          <img src={editPhoto} alt="Damage preview" />
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditPhoto(null)}>
                            Remove
                          </button>
                        </div>
                      ) : (
                        <input type="file" accept="image/*" capture="environment" onChange={handleEditPhoto} disabled={photoBusy} />
                      )
                    ) : (
                      '—'
                    )
                  ) : p.photo ? (
                    <button type="button" className="thumb-btn" onClick={() => setLightboxSrc(p.photo!)}>
                      <img className="thumb" src={p.photo} alt="Damage" />
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{new Date(p.scannedAt).toLocaleString()}</td>
                {dispatch && (
                  <td>
                    {matched ? (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                      >
                        {expandedId === p.id ? 'Hide' : 'View'} ({detailEntries.length})
                      </button>
                    ) : (
                      <span className="not-in-dispatch">Not in dispatch</span>
                    )}
                  </td>
                )}
                <td>
                  {editingId === p.id ? (
                    <div className="btn-row">
                      <button type="button" className="btn btn-success btn-sm" onClick={() => saveEdit(p.id)}>
                        Save
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="btn-row">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => startEdit(p)}>
                        Edit
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => onDeletePanel(p.id)}>
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
              {expandedId === p.id && detailEntries.length > 0 && (
                <tr className="details-row">
                  <td colSpan={dispatch ? 8 : 7}>
                    <ul className="kv-list">
                      {detailEntries.map(([key, value]) => (
                        <li key={key}>
                          <span>{key}</span>
                          <span>{value}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              )}
              </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={dispatch ? 8 : 7} className="empty-row">
                  No panels match this view yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {lightboxSrc && (
        <div className="lightbox" onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} alt="Damage full size" />
        </div>
      )}
    </div>
  );
}
