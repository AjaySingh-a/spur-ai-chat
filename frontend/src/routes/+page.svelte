<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { sendMessage, fetchSession } from '$lib/api';
  import type { Message } from '$lib/types';

  const SESSION_KEY = 'bloom_session_id';
  const WELCOME: Message = {
    id: 'welcome',
    conversationId: '',
    sender: 'ai',
    text: "Hi there! 👋 I'm the Bloom & Co support assistant. I can help with shipping, returns, order tracking, and more. What can I help you with today?",
    timestamp: Date.now(),
  };

  let messages: Message[] = [WELCOME];
  let inputText = '';
  let isLoading = false;
  let sessionId: string | undefined;
  let messagesEl: HTMLElement;
  let inputEl: HTMLInputElement;
  let inputError = '';

  onMount(async () => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        const data = await fetchSession(saved);
        if (data.messages.length > 0) {
          messages = data.messages;
          sessionId = saved;
          await scrollToBottom();
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    inputEl?.focus();
  });

  async function scrollToBottom() {
    await tick();
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function handleSend() {
    const text = inputText.trim();
    inputError = '';

    if (!text) {
      inputError = 'Please type a message first.';
      return;
    }
    if (isLoading) return;

    inputText = '';
    isLoading = true;

    const optimistic: Message = {
      id: crypto.randomUUID(),
      conversationId: sessionId ?? '',
      sender: 'user',
      text,
      timestamp: Date.now(),
    };
    messages = [...messages, optimistic];
    await scrollToBottom();

    try {
      const data = await sendMessage(text, sessionId);
      sessionId = data.sessionId;
      localStorage.setItem(SESSION_KEY, sessionId);

      messages = [
        ...messages,
        {
          id: crypto.randomUUID(),
          conversationId: sessionId,
          sender: 'ai',
          text: data.reply,
          timestamp: Date.now(),
        },
      ];
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      messages = [
        ...messages,
        {
          id: crypto.randomUUID(),
          conversationId: sessionId ?? '',
          sender: 'ai',
          text: msg,
          timestamp: Date.now(),
        },
      ];
    } finally {
      isLoading = false;
      await scrollToBottom();
      inputEl?.focus();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function startNewChat() {
    localStorage.removeItem(SESSION_KEY);
    sessionId = undefined;
    messages = [WELCOME];
    inputText = '';
    inputError = '';
    inputEl?.focus();
  }

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="shell">
  <div class="chat">
    <!-- Header -->
    <header class="header">
      <div class="brand">
        <div class="avatar">🌸</div>
        <div class="brand-text">
          <span class="brand-name">Bloom &amp; Co Support</span>
          <span class="brand-status">
            <span class="dot"></span>
            Online · Typically replies instantly
          </span>
        </div>
      </div>
      <button class="new-chat" on:click={startNewChat} title="Start a new conversation">
        New chat
      </button>
    </header>

    <!-- Messages -->
    <div class="messages" bind:this={messagesEl}>
      {#each messages as msg (msg.id)}
        <div class="row" class:row-user={msg.sender === 'user'} class:row-ai={msg.sender === 'ai'}>
          {#if msg.sender === 'ai'}
            <div class="msg-avatar">🌸</div>
          {/if}
          <div class="bubble" class:bubble-user={msg.sender === 'user'} class:bubble-ai={msg.sender === 'ai'}>
            <p class="bubble-text">{msg.text}</p>
            <span class="bubble-time">{formatTime(msg.timestamp)}</span>
          </div>
        </div>
      {/each}

      {#if isLoading}
        <div class="row row-ai">
          <div class="msg-avatar">🌸</div>
          <div class="bubble bubble-ai typing">
            <span></span><span></span><span></span>
          </div>
        </div>
      {/if}
    </div>

    <!-- Input area -->
    <div class="composer">
      {#if inputError}
        <p class="input-error">{inputError}</p>
      {/if}
      <div class="input-row">
        <input
          bind:this={inputEl}
          bind:value={inputText}
          on:keydown={handleKeydown}
          placeholder="Type a message…"
          disabled={isLoading}
          maxlength="2000"
          class="input"
          aria-label="Message input"
        />
        <button
          on:click={handleSend}
          disabled={isLoading || !inputText.trim()}
          class="send"
          aria-label="Send message"
        >
          {#if isLoading}
            <svg class="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          {:else}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          {/if}
        </button>
      </div>
      <p class="hint">Press Enter to send · <button class="link-btn" on:click={startNewChat}>Start new chat</button></p>
    </div>
  </div>
</div>

<style>
  :global(*, *::before, *::after) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f0f4f0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .shell {
    width: 100%;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .chat {
    width: 100%;
    max-width: 680px;
    height: min(800px, calc(100vh - 2rem));
    background: #fff;
    border-radius: 20px;
    box-shadow: 0 8px 48px rgba(0, 0, 0, 0.12);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e8f0e8;
    background: #fff;
    flex-shrink: 0;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: #f0faf0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .brand-name {
    font-weight: 600;
    font-size: 0.95rem;
    color: #1a1a1a;
  }

  .brand-status {
    font-size: 0.75rem;
    color: #6b7280;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #22c55e;
    flex-shrink: 0;
  }

  .new-chat {
    font-size: 0.8rem;
    font-weight: 500;
    color: #16a34a;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 8px;
    padding: 0.4rem 0.85rem;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .new-chat:hover {
    background: #dcfce7;
    border-color: #86efac;
  }

  /* ── Messages ── */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    scroll-behavior: smooth;
  }

  .messages::-webkit-scrollbar {
    width: 4px;
  }

  .messages::-webkit-scrollbar-track {
    background: transparent;
  }

  .messages::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 4px;
  }

  .row {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    max-width: 85%;
  }

  .row-ai {
    align-self: flex-start;
  }

  .row-user {
    align-self: flex-end;
    flex-direction: row-reverse;
  }

  .msg-avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: #f0faf0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    flex-shrink: 0;
    margin-bottom: 2px;
  }

  .bubble {
    padding: 0.65rem 0.9rem;
    border-radius: 16px;
    max-width: 100%;
    word-break: break-word;
  }

  .bubble-ai {
    background: #f3f4f6;
    border-bottom-left-radius: 4px;
    color: #1a1a1a;
  }

  .bubble-user {
    background: #16a34a;
    border-bottom-right-radius: 4px;
    color: #fff;
  }

  .bubble-text {
    font-size: 0.9rem;
    line-height: 1.5;
    white-space: pre-wrap;
  }

  .bubble-time {
    display: block;
    font-size: 0.68rem;
    margin-top: 0.3rem;
    opacity: 0.55;
    text-align: right;
  }

  /* ── Typing indicator ── */
  .typing {
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .typing span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #9ca3af;
    display: inline-block;
    animation: bounce 1.2s infinite ease-in-out;
  }

  .typing span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .typing span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes bounce {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-6px); }
  }

  /* ── Composer ── */
  .composer {
    border-top: 1px solid #e8f0e8;
    padding: 0.85rem 1.25rem 0.75rem;
    flex-shrink: 0;
    background: #fff;
  }

  .input-error {
    font-size: 0.75rem;
    color: #ef4444;
    margin-bottom: 0.4rem;
  }

  .input-row {
    display: flex;
    gap: 0.6rem;
    align-items: center;
  }

  .input {
    flex: 1;
    border: 1.5px solid #d1d5db;
    border-radius: 12px;
    padding: 0.6rem 0.9rem;
    font-size: 0.9rem;
    font-family: inherit;
    color: #1a1a1a;
    outline: none;
    transition: border-color 0.15s;
    background: #fff;
  }

  .input:focus {
    border-color: #16a34a;
  }

  .input:disabled {
    background: #f9fafb;
    color: #9ca3af;
  }

  .input::placeholder {
    color: #9ca3af;
  }

  .send {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    border: none;
    background: #16a34a;
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.15s, opacity 0.15s;
  }

  .send:hover:not(:disabled) {
    background: #15803d;
  }

  .send:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .spin {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .hint {
    font-size: 0.7rem;
    color: #9ca3af;
    margin-top: 0.45rem;
    text-align: center;
  }

  .link-btn {
    background: none;
    border: none;
    color: #16a34a;
    cursor: pointer;
    font-size: inherit;
    padding: 0;
    text-decoration: underline;
  }

  @media (max-width: 600px) {
    .shell { padding: 0; }
    .chat {
      border-radius: 0;
      height: 100vh;
      max-width: 100%;
    }
  }
</style>
