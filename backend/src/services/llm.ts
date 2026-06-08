import Anthropic from '@anthropic-ai/sdk';

// Using Haiku: fast, cheap, more than capable for FAQ support
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 500;
// Cap history sent to LLM – keeps context costs predictable
const MAX_HISTORY_MESSAGES = 20;

const STORE_KNOWLEDGE = `
## Bloom & Co – Store Knowledge Base

**About:** Bloom & Co is an online lifestyle and home goods store.

**Returns & Refunds:**
- 30-day return window from delivery date
- Items must be unused and in original packaging
- Refunds processed within 5–7 business days to original payment method
- Final-sale items cannot be returned
- To start a return: email support@bloomandco.com with your order number

**Shipping (Domestic – US):**
- Free standard shipping on orders over $50
- Standard shipping: 3–5 business days ($5.99)
- Express shipping: 1–2 business days ($14.99)
- Orders are processed within 1 business day (Mon–Fri)

**International Shipping:**
- We ship to the US, UK, Canada, and Australia
- International delivery: 7–14 business days
- Duties and taxes are the customer's responsibility

**Order Tracking:**
- A tracking link is emailed within 24 hours of shipment
- You can also check at bloomandco.com/track with your order number

**Payment Methods:**
- Visa, Mastercard, American Express, PayPal, Apple Pay
- All transactions are SSL-secured

**Damaged or Missing Items:**
- Contact us within 48 hours of delivery with photos of the damage
- We'll send a replacement or issue a full refund

**Support Hours:**
- Monday–Friday, 9 am – 6 pm EST
- Email: support@bloomandco.com
- We respond within 24 business hours
`.trim();

const SYSTEM_PROMPT = `You are a friendly and professional customer support agent for Bloom & Co, an online lifestyle and home goods store.

Use the following store knowledge to answer customer questions accurately:

${STORE_KNOWLEDGE}

Guidelines:
- Be warm, concise, and helpful
- Answer directly and get to the point – aim for 2–4 sentences unless more detail is needed
- If asked something not covered above, suggest the customer emails support@bloomandco.com
- Never invent policies or details not listed in the knowledge base above
- If a customer is frustrated, acknowledge their feelings before helping`;

type LlmMessage = { role: 'user' | 'assistant'; content: string };

export async function generateReply(
  history: LlmMessage[],
  userMessage: string
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const cappedHistory = history.slice(-MAX_HISTORY_MESSAGES);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      ...cappedHistory,
      { role: 'user', content: userMessage },
    ],
  });

  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected LLM response type');
  return block.text;
}
