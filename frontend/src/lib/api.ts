import { PUBLIC_API_URL } from '$env/static/public';
import type { ChatResponse, SessionResponse } from './types';

const BASE = PUBLIC_API_URL || 'http://localhost:3001';

export async function sendMessage(
  message: string,
  sessionId?: string
): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  });

  const data = await res.json().catch(() => ({ error: 'Invalid server response' }));

  if (!res.ok && !data.reply) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  // 502 from LLM errors still carries a reply – surface it
  return data as ChatResponse;
}

export async function fetchSession(sessionId: string): Promise<SessionResponse> {
  const res = await fetch(`${BASE}/chat/session/${encodeURIComponent(sessionId)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to load conversation history');
  }
  return res.json();
}
