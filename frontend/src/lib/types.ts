export interface Message {
  id: string;
  conversationId: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: number;
}

export interface ChatResponse {
  reply: string;
  sessionId: string;
  error?: string;
}

export interface SessionResponse {
  messages: Message[];
  sessionId: string;
}
