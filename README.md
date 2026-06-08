# Spur Take-Home – AI Live Chat Agent

A full-stack AI-powered customer support chat widget for a fictional store called **Bloom & Co**.

---

## Stack

| Layer | Choice |
|-------|--------|
| Backend | Node.js + TypeScript + Express |
| Frontend | SvelteKit |
| Database | SQLite (via `better-sqlite3`) |
| LLM | Anthropic Claude (Haiku) |

---

## Running Locally

### Prerequisites

- Node.js 18+
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com))

---

### 1. Backend

```bash
cd backend
npm install

# Set up environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Start dev server (auto-restarts on changes)
npm run dev
```

Backend runs at **http://localhost:3001**

The SQLite database is created automatically at `backend/data/spur.db` on first run — no migration step needed.

---

### 2. Frontend

```bash
cd frontend
npm install

# Set up environment
cp .env.example .env
# Default PUBLIC_API_URL=http://localhost:3001 is correct for local dev

# Start dev server
npm run dev
```

Frontend runs at **http://localhost:5173**

Open that URL in your browser and start chatting.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | *(required)* | Your Anthropic API key |
| `PORT` | `3001` | Port the server listens on |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin |
| `DB_PATH` | `./data/spur.db` | Path to SQLite file |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PUBLIC_API_URL` | `http://localhost:3001` | Backend URL (must be `PUBLIC_` prefix in SvelteKit) |

---

## API Reference

### `POST /chat/message`

Send a user message and receive an AI reply.

**Request:**
```json
{
  "message": "What's your return policy?",
  "sessionId": "optional-uuid-from-previous-request"
}
```

**Response:**
```json
{
  "reply": "We offer a 30-day return window...",
  "sessionId": "uuid-v4"
}
```

### `GET /chat/session/:sessionId`

Fetch the full message history for a session.

**Response:**
```json
{
  "sessionId": "uuid-v4",
  "messages": [
    { "id": "...", "conversationId": "...", "sender": "user", "text": "...", "timestamp": 1234567890 }
  ]
}
```

---

## Architecture

```
spur/
├── backend/
│   └── src/
│       ├── index.ts              # Express app bootstrap, CORS, error handler
│       ├── db/index.ts           # SQLite init & singleton accessor
│       ├── routes/chat.ts        # POST /chat/message, GET /chat/session/:id
│       ├── services/
│       │   ├── llm.ts            # Anthropic API wrapper (generateReply)
│       │   └── conversation.ts   # DB operations (save/fetch messages)
│       └── types/index.ts        # Shared TypeScript types
└── frontend/
    └── src/
        ├── routes/+page.svelte   # Chat UI (all UI state lives here)
        └── lib/
            ├── api.ts            # fetch wrappers for backend endpoints
            └── types.ts          # Frontend-side type definitions
```

### Key design decisions

**Layering.** Routes only validate input and orchestrate; business logic lives in services; data access lives in `conversation.ts`. Adding a new channel (WhatsApp, IG) means wiring a new route that calls the same services.

**LLM encapsulation.** `generateReply(history, userMessage)` is the only LLM interface. Swapping providers, models, or prompts is a one-file change.

**Session handling.** `sessionId` is a UUID stored in `localStorage`. On reload the frontend fetches history from the backend and re-renders it. No auth needed for this exercise.

**History before save.** The route fetches LLM history *before* persisting the new user message, so the message is never accidentally doubled in the context window.

**History cap.** Only the last 20 messages are sent to the LLM. This keeps latency and cost predictable regardless of conversation length.

---

## LLM Notes

**Provider:** Anthropic (Claude)

**Model:** `claude-haiku-4-5-20251001` — chosen because it's fast (<1s typical), cheap, and more than capable for FAQ-style support. Haiku handles this load well; Sonnet would be overkill.

**Prompting strategy:**
- A static system prompt contains the full store knowledge base (return policy, shipping, payment, support hours, etc.).
- Conversation history (up to 20 turns) is prepended so replies stay contextual across a session.
- The system prompt tells the model to stay concise (2–4 sentences), never invent facts not in the knowledge base, and acknowledge frustration before helping.

**Cost controls:**
- `max_tokens: 500` — prevents runaway generation for a simple support reply.
- History capped at 20 messages — avoids sending unbounded context.

**Error handling:**
- API key misconfiguration, rate limits, timeouts, and malformed responses are all caught.
- A friendly, brand-appropriate error message is returned to the user (and persisted to the DB) rather than surfacing a raw error.

---

## Data Model

```sql
conversations (
  id TEXT PRIMARY KEY,      -- UUID v4
  created_at INTEGER        -- Unix ms
)

messages (
  id TEXT PRIMARY KEY,      -- UUID v4
  conversation_id TEXT,     -- FK → conversations.id
  sender TEXT,              -- 'user' | 'ai'
  text TEXT,
  timestamp INTEGER         -- Unix ms
)
```

Indexed on `(conversation_id, timestamp)` for efficient history fetches.

---

## Trade-offs & "If I had more time…"

- **Auth:** No login — sessionId in localStorage is unauthenticated. Real product would tie sessions to user accounts.
- **Streaming:** Responses are sent as a single chunk. Streaming the LLM output token-by-token would feel much snappier for longer replies.
- **Redis:** Could cache recent conversation history to avoid a DB read on every message.
- **Retry logic:** Transient LLM errors (rate limits, 529s) would benefit from exponential backoff before falling back to the error message.
- **Rate limiting:** No per-IP rate limiting on the backend. `express-rate-limit` would be a quick add.
- **Deployment:** SQLite is fine for this exercise but would swap to Postgres for production (and for Render's persistent disk story).
- **Tests:** Would add integration tests for the `/chat/message` route and unit tests for `generateReply` with mocked Anthropic responses.
