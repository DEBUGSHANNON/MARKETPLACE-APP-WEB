import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT =
  process.env.NODE_ENV === 'production'
    ? Number(process.env.PORT) || 3000
    : 3000;
const MODEL = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function mapGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('GEMINI_API_KEY')) {
    return {
      status: 500,
      message: 'AI service is not configured yet. Please check your Gemini API key in Settings > Secrets.',
    };
  }
  if (raw.includes('403') || raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID') || raw.includes('400')) {
    return {
      status: 400,
      message: 'Gemini API request failed. Please verify your API key in Settings > Secrets.',
    };
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'AI rate limit reached. Please wait a moment and try again.',
    };
  }
  return {
    status: 500,
    message: raw || 'Failed to get response from CampusTrade AI.',
  };
}

const UTM_ZONES = [
  'Perpustakaan Sultanah Zanariah (PSZ)',
  'Arked Meranti Food Court',
  'Faculty of Computing (N28)',
  'Dewan Kuliah L50',
  'Tasik Ilmu Promenade',
  'Kolej Tun Razak (KTR) Courtyard',
  'Kolej Rahman Putra (KRP) Gate',
  'Kolej Perdana (KP) Arked',
];

const CATEGORIES = [
  'Electronics',
  'Books',
  'Mobility',
  'Lifestyle',
  'Clothing',
  'Services',
  'Other',
];

const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Used'];

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '8mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'CampusTrade UTM AI' });
  });

  // 1. AI Listing Drafter (supports text prompt and/or uploaded item photo)
  app.post('/api/ai/draft-listing', async (req, res) => {
    try {
      const { prompt, imageBase64, imageMimeType } = req.body as {
        prompt?: string;
        imageBase64?: string;
        imageMimeType?: string;
      };

      const cleanPrompt = (prompt || '').trim();
      if (!cleanPrompt && !imageBase64) {
        res.status(400).json({ error: 'Please describe your item or attach a photo.' });
        return;
      }

      const ai = getAiClient();
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      if (imageBase64 && imageMimeType) {
        parts.push({
          inlineData: {
            mimeType: imageMimeType,
            data: imageBase64,
          },
        });
      }

      parts.push({
        text: `Draft a student marketplace listing for Universiti Teknologi Malaysia (UTM Skudai).
Seller notes: ${cleanPrompt || 'Analyze the attached photo and create an accurate UTM student listing.'}
Allowed categories: ${CATEGORIES.join(', ')}.
Allowed conditions: ${CONDITIONS.join(', ')}.
Allowed UTM pickup zones: ${UTM_ZONES.join(', ')}.`,
      });

      const response = await ai.models.generateContent({
        model: MODEL,
        contents: { parts },
        config: {
          systemInstruction:
            'You are the CampusTrade UTM listing assistant. Produce concise, honest Malaysian university student marketplace copy in English with realistic student prices in Malaysian Ringgit (RM). Keep titles under 75 characters and descriptions 2-3 clear sentences.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              price: { type: Type.NUMBER },
              category: { type: Type.STRING, enum: CATEGORIES },
              type: { type: Type.STRING, enum: ['item', 'service'] },
              condition: { type: Type.STRING, enum: CONDITIONS },
              campusZone: { type: Type.STRING, enum: UTM_ZONES },
              priceNote: { type: Type.STRING },
            },
            required: [
              'title',
              'description',
              'price',
              'category',
              'type',
              'condition',
              'campusZone',
              'priceNote',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // 2. AI Campus Finder / Natural Language Catalog Matchmaker
  app.post('/api/ai/campus-concierge', async (req, res) => {
    try {
      const { query, listings } = req.body as {
        query?: string;
        listings?: Array<{
          id: string;
          title: string;
          description: string;
          price: number;
          category: string;
          condition: string;
          campusZone: string;
          status: string;
        }>;
      };

      const cleanQuery = (query || '').trim();
      if (!cleanQuery) {
        res.status(400).json({ error: 'Please enter what you are looking for on campus.' });
        return;
      }

      const catalogSummary = (listings || []).slice(0, 40).map((item) => ({
        id: item.id,
        title: item.title,
        priceRM: item.price,
        category: item.category,
        condition: item.condition,
        zone: item.campusZone,
        status: item.status,
        summary: item.description.slice(0, 140),
      }));

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: `Student request: "${cleanQuery}"

Available CampusTrade UTM catalog:
${JSON.stringify(catalogSummary)}`,
        config: {
          systemInstruction:
            'You are the CampusTrade UTM AI Finder. Recommend up to 4 most relevant listings strictly from the provided catalog JSON using their exact "id". Give a helpful, friendly 1-2 sentence reply tailored to UTM Skudai students, plus a short reason for each matched item.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: { type: Type.STRING },
              matches: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                  required: ['id', 'reason'],
                },
              },
            },
            required: ['answer', 'matches'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // 3. AI Buyer Insights & Handover Safety Tips for a Specific Listing
  app.post('/api/ai/listing-insights', async (req, res) => {
    try {
      const { listing } = req.body as {
        listing?: {
          title: string;
          description: string;
          price: number;
          category: string;
          condition: string;
          campusZone: string;
          type: string;
        };
      };

      if (!listing?.title) {
        res.status(400).json({ error: 'Listing details are required.' });
        return;
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: `Evaluate this UTM Skudai student listing:
Title: ${listing.title}
Price: RM ${listing.price}
Category: ${listing.category} (${listing.type})
Condition: ${listing.condition}
Pickup Zone: ${listing.campusZone}
Description: ${listing.description}`,
        config: {
          systemInstruction:
            'You are a practical student marketplace advisor at UTM Skudai. Provide a concise price fairness note in RM, 3 quick things to inspect before paying during campus handover, and a smart meetup tip for the specified UTM zone.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              priceVerdict: { type: Type.STRING },
              inspectionChecklist: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              meetupTip: { type: Type.STRING },
            },
            required: ['priceVerdict', 'inspectionChecklist', 'meetupTip'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // 4. AI Smart Reply Suggestions for Seller-Buyer Chat
  app.post('/api/ai/chat-reply', async (req, res) => {
    try {
      const { role, listingTitle, listingPrice, handoverLocation, recentMessages } = req.body as {
        role?: 'buyer' | 'seller';
        listingTitle?: string;
        listingPrice?: number;
        handoverLocation?: string;
        recentMessages?: Array<{ sender: string; text: string }>;
      };

      const ai = getAiClient();
      const historyText =
        recentMessages && recentMessages.length > 0
          ? recentMessages.map((m) => `${m.sender}: ${m.text}`).join('\n')
          : 'No messages sent yet.';

      const response = await ai.models.generateContent({
        model: MODEL,
        contents: `Role of user needing reply suggestions: ${role === 'seller' ? 'Seller' : 'Buyer'}
Item: ${listingTitle || 'Campus Item'} (RM ${listingPrice ?? 0})
Preferred UTM location: ${handoverLocation || 'PSZ Library or Arked Meranti'}
Recent chat history:
${historyText}`,
        config: {
          systemInstruction:
            'Generate 3 short, natural, polite chat replies for a UTM Skudai student coordinating a campus pickup (mentioning realistic spots like PSZ, Arked Meranti, or N28, payment via DuitNow QR/cash, or timing). Each reply must be under 110 characters.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['suggestions'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // Vite middleware in dev / static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CampusTrade UTM running at http://localhost:${PORT}`);
    console.log(`Local Firebase Emulator mode: http://localhost:${PORT}/?emulator=true`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
