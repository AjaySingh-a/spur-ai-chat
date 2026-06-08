import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import type { Message, Conversation } from '../types';

type DbConversationRow = { id: string; created_at: number };
type DbMessageRow = {
  id: string;
  conversation_id: string;
  sender: string;
  text: string;
  timestamp: number;
};

export function getOrCreateConversation(sessionId?: string): Conversation {
  const db = getDb();

  if (sessionId) {
    const row = db
      .prepare('SELECT id, created_at FROM conversations WHERE id = ?')
      .get(sessionId) as DbConversationRow | undefined;

    if (row) return { id: row.id, createdAt: row.created_at };
  }

  const id = uuidv4();
  const createdAt = Date.now();
  db.prepare('INSERT INTO conversations (id, created_at) VALUES (?, ?)').run(id, createdAt);
  return { id, createdAt };
}

export function saveMessage(
  conversationId: string,
  sender: 'user' | 'ai',
  text: string
): Message {
  const db = getDb();
  const message: Message = {
    id: uuidv4(),
    conversationId,
    sender,
    text,
    timestamp: Date.now(),
  };
  db.prepare(
    'INSERT INTO messages (id, conversation_id, sender, text, timestamp) VALUES (?, ?, ?, ?, ?)'
  ).run(message.id, message.conversationId, message.sender, message.text, message.timestamp);
  return message;
}

export function getMessages(conversationId: string): Message[] {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT id, conversation_id, sender, text, timestamp FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC'
    )
    .all(conversationId) as DbMessageRow[];

  return rows.map((r) => ({
    id: r.id,
    conversationId: r.conversation_id,
    sender: r.sender as 'user' | 'ai',
    text: r.text,
    timestamp: r.timestamp,
  }));
}

export function getHistoryForLlm(
  conversationId: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return getMessages(conversationId).map((m) => ({
    role: m.sender === 'user' ? 'user' : 'assistant',
    content: m.text,
  }));
}
