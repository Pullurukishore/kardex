import { GoogleGenerativeAI, GenerativeModel, ChatSession } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { logger } from '../utils/logger';

/**
 * AI Service — Multi-provider with automatic fallback.
 *
 * Provider priority:
 *   1. Google Gemini Flash (free tier) — primary
 *   2. Groq (llama/mixtral) — fallback when Gemini is rate-limited
 *
 * Features:
 *   • Response caching (5-min TTL)
 *   • Request deduplication
 *   • Retry with exponential backoff
 *   • Automatic provider failover
 */

// ── Provider instances ──
let genAI: GoogleGenerativeAI | null = null;
let geminiModel: GenerativeModel | null = null;
let groqClient: Groq | null = null;

// ── Chat sessions keyed by session ID ──
const chatSessions = new Map<string, ChatSession>();
const groqChatHistories = new Map<string, Array<{ role: 'system' | 'user' | 'assistant'; content: string }>>();

// ── Response cache (TTL-based) ──
interface CacheEntry {
  response: string;
  expiresAt: number;
}
const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Request deduplication ──
const inflightRequests = new Map<string, Promise<string>>();

// ── Rate limiter: minimum interval between API calls ──
let lastApiCallTime = 0;
const MIN_CALL_INTERVAL_MS = 2000; // 2s between calls

// ── Track if Gemini is rate-limited (cooldown) ──
let geminiCooldownUntil = 0;

function getGeminiModel(systemInstruction?: string): GenerativeModel | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  // Use a new model instance if systemInstruction is provided to ensure it's set correctly
  if (systemInstruction || !geminiModel) {
    genAI = new GoogleGenerativeAI(apiKey);
    const modelOptions: any = {
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 1024,
      },
    };
    if (systemInstruction) {
      modelOptions.systemInstruction = systemInstruction;
    }
    const model = genAI.getGenerativeModel(modelOptions);
    if (!systemInstruction) geminiModel = model;
    return model;
  }
  return geminiModel;
}

function getGroqClient(): Groq | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  if (!groqClient) {
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastApiCallTime;
  if (elapsed < MIN_CALL_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_CALL_INTERVAL_MS - elapsed));
  }
  lastApiCallTime = Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate text — tries Gemini first, falls back to Groq.
 */
export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  cacheKey?: string,
): Promise<string> {
  const key = cacheKey || 'gen_' + simpleHash(systemPrompt + userPrompt);

  // 1. Check cache
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    logger.info('AI Service: Returning cached response');
    return cached.response;
  }

  // 2. Dedup: if same request in-flight, wait for it
  const inflight = inflightRequests.get(key);
  if (inflight) {
    logger.info('AI Service: Dedup — waiting for in-flight request');
    return inflight;
  }

  // 3. Execute with fallback
  const requestPromise = executeWithFallback(systemPrompt, userPrompt, key);
  inflightRequests.set(key, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inflightRequests.delete(key);
  }
}

/**
 * Try Gemini → fallback to Groq → retry with backoff.
 */
async function executeWithFallback(
  systemPrompt: string,
  userPrompt: string,
  cacheKey: string,
): Promise<string> {
  let text: string | null = null;

  // Try Gemini first (if not in cooldown)
  const gemini = getGeminiModel(systemPrompt);
  if (Date.now() > geminiCooldownUntil && gemini) {
    try {
      await waitForRateLimit();
      logger.info('AI Service: Trying Gemini...');
      const result = await gemini.generateContent(userPrompt);
      const usage = result.response.usageMetadata;
      logger.info(`AI Service: ✅ Gemini succeeded (${usage?.totalTokenCount || 'unknown'} tokens)`);
      text = result.response.text();
    } catch (error: any) {
      const msg = error.message || '';
      if (msg.includes('429') || msg.includes('quota') || msg.includes('rate') || msg.includes('Resource has been exhausted')) {
        // Set cooldown for 60 seconds so we don't keep hitting Gemini
        geminiCooldownUntil = Date.now() + 60_000;
        logger.warn('AI Service: Gemini rate-limited. Cooldown 60s. Trying Groq...');
      } else {
        logger.warn('AI Service: Gemini error:', msg);
      }
    }
  } else if (Date.now() <= geminiCooldownUntil) {
    logger.info('AI Service: Gemini in cooldown. Using Groq directly.');
  }

  // Fallback to Groq
  if (!text && getGroqClient()) {
    try {
      await waitForRateLimit();
      logger.info('AI Service: Trying Groq...');
      const client = getGroqClient()!;
      const completion = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      });
      text = completion.choices[0]?.message?.content || '';
      const usage = completion.usage;
      logger.info(`AI Service: ✅ Groq succeeded (${usage?.total_tokens || 'unknown'} tokens)`);
    } catch (error: any) {
      logger.error('AI Service: Groq error:', error.message);
    }
  }

  // If both failed, retry Gemini with backoff (last resort)
  if (!text && getGeminiModel()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const backoffMs = 5000 * (attempt + 1);
      logger.warn(`AI Service: All providers failed. Retry ${attempt + 1}/2 in ${backoffMs}ms...`);
      await sleep(backoffMs);
      try {
        const model = getGeminiModel(systemPrompt)!;
        const result = await model.generateContent(userPrompt);
        text = result.response.text();
        const usage = result.response.usageMetadata;
        logger.info(`AI Service: ✅ Retry succeeded (${usage?.totalTokenCount} tokens)`);
        geminiCooldownUntil = 0; // clear cooldown on success
        break;
      } catch {
        continue;
      }
    }
  }

  if (!text) {
    throw new Error('AI service temporarily unavailable. Both Gemini and Groq failed. Please try again in a minute.');
  }

  // Cache the result
  responseCache.set(cacheKey, {
    response: text,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return text;
}

/**
 * Chat — uses Gemini or falls back to Groq.
 */
export async function chat(
  sessionId: string,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  await waitForRateLimit();

  // Try Gemini chat first
  const gemini = getGeminiModel(systemPrompt);
  if (Date.now() > geminiCooldownUntil && gemini) {
    try {
      let session = chatSessions.get(sessionId);
      if (!session) {
        session = gemini.startChat({
          history: [], // systemInstruction handles the context now
        });
        chatSessions.set(sessionId, session);
      }
      const result = await session.sendMessage(userMessage);
      const usage = result.response.usageMetadata;
      logger.info(`AI Chat: ✅ Gemini reply - In: ${usage?.promptTokenCount}, Out: ${usage?.candidatesTokenCount}, Total: ${usage?.totalTokenCount}`);
      return result.response.text();
    } catch (error: any) {
      const msg = error.message || '';
      if (msg.includes('429') || msg.includes('quota') || msg.includes('rate')) {
        geminiCooldownUntil = Date.now() + 60_000;
        logger.warn('AI Chat: Gemini rate-limited. Falling back to Groq.');
        chatSessions.delete(sessionId);
      } else {
        logger.warn('AI Chat: Gemini error:', msg);
        chatSessions.delete(sessionId);
      }
    }
  }

  // Fallback to Groq chat
  if (getGroqClient()) {
    try {
      const client = getGroqClient()!;

      // Get or create Groq chat history
      let history = groqChatHistories.get(sessionId);
      if (!history) {
        history = [{ role: 'system', content: systemPrompt }];
        groqChatHistories.set(sessionId, history);
      }

      history.push({ role: 'user', content: userMessage });

      // Keep history manageable (last 20 messages + system prompt)
      if (history.length > 22) {
        history = [history[0], ...history.slice(-20)];
        groqChatHistories.set(sessionId, history);
      }

      const completion = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: history,
        temperature: 0.7,
        max_tokens: 1024,
      });

      const reply = completion.choices[0]?.message?.content || 'No response generated.';
      const usage = completion.usage;
      logger.info(`AI Chat: ✅ Groq reply - In: ${usage?.prompt_tokens}, Out: ${usage?.completion_tokens}, Total: ${usage?.total_tokens}`);
      history.push({ role: 'assistant', content: reply });
      return reply;
    } catch (error: any) {
      const status = error?.status || error?.response?.status;
      const message = error?.message;
      const details = error?.response?.data || error?.error || error;
      logger.error('AI Chat: Groq error:', {
        status,
        message,
        details,
      });

      if (status === 401 || status === 403) {
        throw new Error('AI chat failed: Groq authentication error. Please verify GROQ_API_KEY.');
      }
      if (status === 413) {
        throw new Error('AI chat failed: Request too large for Groq. Please try a shorter question or reduce system context size.');
      }
      if (status === 429) {
        throw new Error('AI chat failed: Groq rate-limited. Please try again in a minute.');
      }

      throw new Error('AI chat failed (Groq). Please try again.');
    }
  }

  throw new Error('No AI provider available. Please check your API keys.');
}

/**
 * Clear a chat session.
 */
export function clearChatSession(sessionId: string): void {
  chatSessions.delete(sessionId);
  groqChatHistories.delete(sessionId);
}

/**
 * Check if any AI provider is configured.
 */
export function isConfigured(): boolean {
  return !!(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
}

/**
 * Simple string hash for cache keys.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < Math.min(str.length, 500); i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}
