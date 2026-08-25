import { GoogleGenAI } from '@google/genai';
import { BrandId } from '../types';
import { BRANDS } from '../data/brands';

export interface AICaptionRequest {
  brandId: BrandId;
  topic: string;
  platform?: string;
  currentCaption?: string;
  tonePreference?: string;
  apiKey?: string;
}

export interface AIRefineRequest {
  brandId: BrandId;
  caption: string;
  action: 'fix-grammar' | 'make-shorter' | 'add-hashtags' | 'add-cta' | 'make-more-clinical' | 'expand';
  apiKey?: string;
}

export interface AIResearchParseRequest {
  fileContent: string;
  fileName: string;
  apiKey?: string;
}

export interface ParsedAIPost {
  title: string;
  brandId: BrandId;
  platform: string;
  contentType: string;
  caption: string;
  scheduledDate?: string;
}

export function getStoredGeminiApiKey(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('pz_gemini_api_key');
    if (stored) return stored;
  }
  return import.meta.env.VITE_GEMINI_API_KEY || '';
}

export function setStoredGeminiApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('pz_gemini_api_key', key.trim());
  }
}

function getAIClient(overrideKey?: string): GoogleGenAI {
  const key = overrideKey || getStoredGeminiApiKey();
  if (!key) {
    throw new Error('Gemini API key missing. Please provide a free Gemini API key in Settings or the AI Assistant modal.');
  }
  return new GoogleGenAI({ apiKey: key });
}

/**
 * Generate an on-brand post caption using Google Gemini Free Tier
 */
export async function generateCaptionWithAI(req: AICaptionRequest): Promise<{ caption: string; hashtags: string[]; cta: string }> {
  const brand = BRANDS[req.brandId] || BRANDS.pharmacozyme;
  const ai = getAIClient(req.apiKey);

  const systemPrompt = `You are an expert medical, biotech, and social media copywriter for the brand "${brand.name}".
Brand Tagline: "${brand.tagline}"
Brand Description: ${brand.description}
Brand Voice Rules:
${brand.voiceRules.map((rule) => `- ${rule}`).join('\n')}

Task: Create an engaging, on-brand social media post caption for ${req.platform || 'Instagram'}.
Topic / Context: ${req.topic}
${req.currentCaption ? `Existing Draft Context: ${req.currentCaption}` : ''}
${req.tonePreference ? `Specific Tone Shift requested: ${req.tonePreference}` : ''}

Output ONLY a JSON object with this exact schema (no markdown fences, raw JSON):
{
  "caption": "The complete post text including formatting and line breaks",
  "hashtags": ["#tag1", "#tag2", "#tag3"],
  "cta": "Single punchy call to action string"
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: systemPrompt,
    });

    const text = response.text?.trim() || '';
    const cleanJsonText = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();

    try {
      const parsed = JSON.parse(cleanJsonText);
      return {
        caption: parsed.caption || text,
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
        cta: parsed.cta || ''
      };
    } catch {
      return {
        caption: text,
        hashtags: [],
        cta: ''
      };
    }
  } catch (err: any) {
    console.error('Gemini AI Generation Error:', err);
    throw new Error(err?.message || 'Failed to generate AI caption.');
  }
}

/**
 * Refine an existing caption (shorten, add hashtags, enforce brand tone)
 */
export async function refineCaptionWithAI(req: AIRefineRequest): Promise<string> {
  const brand = BRANDS[req.brandId] || BRANDS.pharmacozyme;
  const ai = getAIClient(req.apiKey);

  let instruction = '';
  switch (req.action) {
    case 'fix-grammar':
      instruction = 'Fix spelling, grammar, and improve phrasing while preserving the core message.';
      break;
    case 'make-shorter':
      instruction = 'Shorten this caption significantly for fast mobile reading without losing key facts.';
      break;
    case 'add-hashtags':
      instruction = 'Append 5-8 highly relevant medical/biotech hashtags at the bottom of the caption.';
      break;
    case 'add-cta':
      instruction = 'Add a strong, professional call-to-action at the end urging clinicians/readers to learn more.';
      break;
    case 'make-more-clinical':
      instruction = 'Adjust the wording to sound authoritative, clinical, precise, and scientifically grounded.';
      break;
    case 'expand':
      instruction = 'Expand on this hook with structured bullet points and scientific context.';
      break;
  }

  const prompt = `Refine the following caption for the brand "${brand.name}".
Brand Voice Guidelines:
${brand.voiceRules.map((rule) => `- ${rule}`).join('\n')}

Instruction: ${instruction}

Original Caption:
"""
${req.caption}
"""

Return ONLY the final updated caption text. No intro/outro commentary.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  return response.text?.trim() || req.caption;
}

/**
 * Parse an uploaded strategy document or research plan into structured calendar posts
 */
export async function parseResearchDocWithAI(req: AIResearchParseRequest): Promise<ParsedAIPost[]> {
  const ai = getAIClient(req.apiKey);

  const prompt = `You are a social content planner parsing an uploaded research/strategy document titled "${req.fileName}".
Analyze the content below and extract all planned social posts, campaign items, or educational topics.

Document Content:
"""
${req.fileContent.slice(0, 8000)}
"""

Output ONLY a raw JSON array of objects (no markdown blocks, no text before or after).
Each object must have this exact schema:
[
  {
    "title": "Short descriptive post title",
    "brandId": "pharmacozyme" | "pz-academy" | "med-q" | "pillz" | "prescriptionz",
    "platform": "instagram" | "linkedin" | "twitter" | "email" | "web",
    "contentType": "feed-post" | "story" | "reel" | "carousel" | "newsletter" | "bio-report",
    "caption": "Full post caption drafted from the document insights",
    "scheduledDate": "YYYY-MM-DD or empty string if unscheduled"
  }
]`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
    });

    const text = response.text?.trim() || '[]';
    const cleanJson = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        title: item.title || 'Untitled AI Extracted Post',
        brandId: (['pharmacozyme', 'pz-academy', 'med-q', 'pillz', 'prescriptionz'].includes(item.brandId) ? item.brandId : 'pharmacozyme') as BrandId,
        platform: item.platform || 'instagram',
        contentType: item.contentType || 'feed-post',
        caption: item.caption || '',
        scheduledDate: item.scheduledDate || ''
      }));
    }
    return [];
  } catch (err: any) {
    console.error('AI Research Doc Parsing Error:', err);
    throw new Error(err?.message || 'Could not parse document with AI.');
  }
}
