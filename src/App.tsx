import { useEffect, useState } from 'react';
import ScanTab from './components/ScanTab';
import InventoryTab from './components/InventoryTab';
import DispatchTab from './components/DispatchTab';
import SummaryTab from './components/SummaryTab';
import { clearSession, loadSession, saveSession } from './lib/storage';
import { createEmptySession, type DispatchSheet, type ScannedPanel, type SessionState } from './types';

type Tab = 'scan' | 'inventory' | 'dispatch' | 'summary';

const TABS: { id: Tab; label: string }[] = [
  { id: 'scan', label: 'Scan' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'dispatch', label: 'Dispatch & Reconciliation' },
  { id: 'summary', label: 'Summary' },
];

export default function App() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('scan');
  const [newSessionName, setNewSessionName] = useState('');

  useEffect(() => {
    loadSession().then((s) => {
      setSession(s);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded && session) {
      saveSession(session).catch(() => undefined);
    }
  }, [session, loaded]);

  function startSession() {
    const name = newSessionName.trim() || `Count ${new Date().toLocaleDateString()}`;
    setSession(createEmptySession(name));
    setTab('scan');
  }

  function endSession() {
    if (!confirm('End this counting session? Make sure you have exported any reports you need first.')) return;
    clearSession().catch(() => undefined);
    setSession(null);
    setNewSessionName('');
  }

  function addPanel(panel: ScannedPanel) {
    setSession((s) => (s ? { ...s, panels: [...s.panels, panel] } : s));
  }

  function updatePanel(id: string, updates: Partial<ScannedPanel>) {
    setSession((s) =>
      s ? { ...s, panels: s.panels.map((p) => (p.id === id ? { ...p, ...updates } : p)) } : s,
    );
  }

  function deletePanel(id: string) {
    setSession((s) => (s ? { ...s, panels: s.panels.filter((p) => p.id !== id) } : s));
  }

  function setDispatch(dispatch: DispatchSheet | null) {
    setSession((s) => (s ? { ...s, dispatch } : s));
  }

  if (!loaded) {
    return (
      <div className="app-loading">
        <p>Loading…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="start-screen">
        <div className="card start-card">
          <h1>Solar Panel Inventory &amp; Reconciliation</h1>
          <p className="hint">
            Bulk-count solar panels by barcode/QR scan, log damaged units with defect details, then reconcile
            against the supplier dispatch sheet and export Excel reports.
          </p>
          <label htmlFor="session-name">Batch / consignment name</label>
          <input
            id="session-name"
            type="text"
            placeholder="e.g. PO-4821 – Container 2"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && startSession()}
          />
          <button type="button" className="btn btn-primary" onClick={startSession}>
            Start Counting
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>{session.name}</h1>
          <p className="hint">Started {new Date(session.createdAt).toLocaleString()}</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={endSession}>
          End Session
        </button>
      </header>

      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="tab-content">
        {tab === 'scan' && (
          <ScanTab panels={session.panels} onAddPanel={addPanel} onUpdatePanel={updatePanel} onDeletePanel={deletePanel} />
        )}
        {tab === 'inventory' && (
          <InventoryTab
            panels={session.panels}
            sessionName={session.name}
            onUpdatePanel={updatePanel}
            onDeletePanel={deletePanel}
          />
        )}
        {tab === 'dispatch' && (
          <DispatchTab panels={session.panels} dispatch={session.dispatch} onSetDispatch={setDispatch} />
        )}
        {tab === 'summary' && <SummaryTab sessionName={session.name} panels={session.panels} dispatch={session.dispatch} />}
      </main>
    </div>
  );
}
