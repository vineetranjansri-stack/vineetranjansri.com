import { get, set, del } from 'idb-keyval';
import type { SessionState } from '../types';

const SESSION_KEY = 'spi-session-v1';

export async function loadSession(): Promise<SessionState | null> {
  const value = await get<SessionState>(SESSION_KEY);
  return value ?? null;
}

export async function saveSession(session: SessionState): Promise<void> {
  await set(SESSION_KEY, session);
}

export async function clearSession(): Promise<void> {
  await del(SESSION_KEY);
}
