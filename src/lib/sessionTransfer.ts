import type { SessionState } from '../types';

export function exportSessionFile(session: SessionState): void {
  const json = JSON.stringify(session, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const safeName = (session.name || 'session').replace(/[^a-z0-9_-]+/gi, '_');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}_session_backup.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importSessionFile(file: File): Promise<SessionState> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!isSessionState(parsed)) {
    throw new Error('That file doesn\'t look like a session backup from this app.');
  }
  return parsed;
}

function isSessionState(value: unknown): value is SessionState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === 'string' && typeof v.createdAt === 'string' && Array.isArray(v.panels);
}
