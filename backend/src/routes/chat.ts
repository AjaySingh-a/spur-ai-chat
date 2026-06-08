import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getOrCreateConversation,
  saveMessage,
  getMessages,
  getHistoryForLlm,
} from '../services/conversation';
import { generateReply } from '../services/llm';

export const chatRouter = Router();

const MAX_MESSAGE_LENGTH = 2000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const chatSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(MAX_MESSAGE_LENGTH, `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`)
    .transform((s) => s.trim()),
  sessionId: z.string().regex(UUID_RE, 'Invalid session ID format').optional(),
});

// POST /chat/message
chatRouter.post('/message', async (req: Request, res: Response) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const { message, sessionId } = parsed.data;

  let conversation;
  try {
    conversation = getOrCreateConversation(sessionId);
  } catch (err) {
    console.error('DB error creating conversation:', err);
    return res.status(500).json({ error: 'Could not start conversation. Please try again.' });
  }

  // Fetch history BEFORE saving the incoming message so we don't duplicate it
  let history: Array<{ role: 'user' | 'assistant'; content: string }>;
  try {
    history = getHistoryForLlm(conversation.id);
  } catch (err) {
    console.error('DB error fetching history:', err);
    history = [];
  }

  try {
    saveMessage(conversation.id, 'user', message);
  } catch (err) {
    console.error('DB error saving user message:', err);
    return res.status(500).json({ error: 'Could not save message. Please try again.' });
  }

  let reply: string;
  try {
    reply = await generateReply(history, message);
  } catch (err: unknown) {
    console.error('LLM error:', err);
    const raw = err instanceof Error ? err.message : String(err);

    reply = raw.includes('API key') || raw.includes('auth')
      ? "I'm having trouble connecting right now. Please email support@bloomandco.com and we'll get back to you within 24 hours."
      : "I'm temporarily unavailable — please try again in a moment or reach us at support@bloomandco.com.";

    try {
      saveMessage(conversation.id, 'ai', reply);
    } catch { /* best-effort */ }

    return res.status(502).json({ reply, sessionId: conversation.id, error: 'AI service unavailable' });
  }

  try {
    saveMessage(conversation.id, 'ai', reply);
  } catch (err) {
    console.error('DB error saving AI reply:', err);
    // Don't fail the request – the user already got their reply
  }

  return res.json({ reply, sessionId: conversation.id });
});

// GET /chat/session/:sessionId  – load conversation history
chatRouter.get('/session/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;

  if (!UUID_RE.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }

  try {
    const messages = getMessages(sessionId);
    return res.json({ messages, sessionId });
  } catch (err) {
    console.error('DB error fetching session:', err);
    return res.status(500).json({ error: 'Could not load conversation history.' });
  }
});
