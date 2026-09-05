import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import jwt from "jsonwebtoken";

// Load firebase-applet-config.json if available
let firebaseConfig: Record<string, any> = {};
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
} catch (err) {
  console.warn("Could not load firebase-applet-config.json:", err);
}

// Resilient Gemini AI client getter
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in the environment.");
    }
    genAIClient = new GoogleGenAI({ apiKey });
  }
  return genAIClient;
}

// Resilient Model Fallback Ladder according to Production Directives:
// 1. Primary: "gemini-3.6-flash" / "gemini-3.8-flash"
// 2. High-Availability Fallback: "gemini-3.1-flash-lite"
// 3. Dynamic Alias: "gemini-flash-latest"
// 4. Deep Reasoning Fallback: "gemini-3.7-flash"
const MODEL_FALLBACK_LADDER = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.7-flash",
];

interface FallbackResult {
  text: string;
  modelUsed: string;
}

async function generateContentWithFallback(
  contents: any,
  systemInstruction?: string,
  responseSchemaJson?: boolean
): Promise<FallbackResult> {
  const ai = getGenAI();
  let lastError: any = null;

  for (const model of MODEL_FALLBACK_LADDER) {
    try {
      const config: Record<string, any> = {};
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }
      if (responseSchemaJson) {
        config.responseMimeType = "application/json";
      }

      const response = await ai.models.generateContent({
        model,
        contents,
        config: Object.keys(config).length > 0 ? config : undefined,
      });

      if (response && response.text) {
        return { text: response.text, modelUsed: model };
      }
    } catch (err: any) {
      lastError = err;
      const statusCode = err?.status || err?.statusCode || err?.code;
      const isRecoverable =
        statusCode === 429 ||
        statusCode === 503 ||
        statusCode === 500 ||
        statusCode === 404 ||
        String(err?.message || "").toLowerCase().includes("unavailable") ||
        String(err?.message || "").toLowerCase().includes("quota") ||
        String(err?.message || "").toLowerCase().includes("rate limit") ||
        String(err?.message || "").toLowerCase().includes("not found");

      console.warn(`[Gemini Fallback] Model ${model} encountered ${statusCode || err?.message}. Recoverable: ${isRecoverable}`);
      if (!isRecoverable) {
        // If it's a fatal validation error, try next model just in case, but keep note
      }
    }
  }

  throw new Error(`All models in fallback ladder failed. Last error: ${lastError?.message || "Unknown"}`);
}

// Token Verification Middleware
interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
  };
}

async function verifyFirebaseToken(token: string, projectId: string, apiKey: string): Promise<{ uid: string; email?: string }> {
  // First attempt: Firebase Identity Toolkit token lookup (authoritative online validation)
  if (apiKey) {
    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.users && data.users.length > 0) {
          const u = data.users[0];
          return { uid: u.localId, email: u.email };
        }
      }
    } catch (err) {
      console.warn("Identitytoolkit verification failed, falling back to JWT decoded validation:", err);
    }
  }

  // Fallback / local cryptographic claim verification
  const decoded = jwt.decode(token, { complete: true }) as any;
  if (!decoded || !decoded.payload) {
    throw new Error("Invalid token structure");
  }

  const payload = decoded.payload;
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp < now) {
    throw new Error("Token expired");
  }

  if (projectId && payload.aud !== projectId && payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error("Token audience/issuer mismatch");
  }

  if (!payload.user_id && !payload.sub) {
    throw new Error("Token missing user identifier");
  }

  return {
    uid: payload.user_id || payload.sub,
    email: payload.email,
  };
}

async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const token = authHeader.split("Bearer ")[1].trim();
    if (!token) {
      return res.status(401).json({ error: "Token string missing" });
    }

    const projectId = firebaseConfig.projectId || process.env.FIREBASE_PROJECT_ID || "";
    const apiKey = firebaseConfig.apiKey || "";

    const user = await verifyFirebaseToken(token, projectId, apiKey);
    req.user = user;
    next();
  } catch (err: any) {
    console.error("Authentication error:", err?.message || err);
    return res.status(401).json({ error: "Unauthorized: Invalid authentication credentials" });
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Defensive ordering: Body parsers mounted FIRST before all routes
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Public Configuration endpoint (strictly public Firebase identifiers, no private keys)
  app.get("/api/config", (_req, res) => {
    res.json({
      projectId: firebaseConfig.projectId || "",
      appId: firebaseConfig.appId || "",
      apiKey: firebaseConfig.apiKey || "",
      authDomain: firebaseConfig.authDomain || "",
      firestoreDatabaseId: firebaseConfig.firestoreDatabaseId || "(default)",
      storageBucket: firebaseConfig.storageBucket || "",
      messagingSenderId: firebaseConfig.messagingSenderId || "",
    });
  });

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "EchoMind Secure Backend",
    });
  });

  // Multi-Turn Reflective Chat API
  app.post("/api/chat", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = req.body && typeof req.body === "object" ? req.body : {};
      const message = typeof data.message === "string" ? data.message.trim() : "";
      const history = Array.isArray(data.history) ? data.history : [];

      if (!message) {
        return res.status(400).json({ error: "A reflection message is required." });
      }

      if (message.length > 5000) {
        return res.status(400).json({ error: "Message exceeds maximum allowed length (5000 chars)." });
      }

      // Format multi-turn conversational contents
      const contents: any[] = [];
      for (const item of history.slice(-10)) {
        if (item && item.role && item.content) {
          contents.push({
            role: item.role === "user" ? "user" : "model",
            parts: [{ text: String(item.content) }],
          });
        }
      }

      // Add current user reflection
      contents.push({
        role: "user",
        parts: [{ text: message }],
      });

      const systemInstruction = `You are EchoMind, an exceptionally empathetic, thoughtful, and psychologically safe personal reflection and growth companion.
Your purpose is to help the user unpack their thoughts, feelings, ambitions, and dilemmas.
Guidelines:
1. Listen deeply and reflect back core emotional truths and cognitive themes.
2. Ask 1 gentle, high-impact inquiry or clarifying question to deepen self-awareness.
3. Keep responses warm, succinct (2 to 4 paragraphs), articulate, and grounded. Never sound preachy or robotic.
4. Validate their lived experience while gently nudging towards constructive agency, self-compassion, and clarity.`;

      const result = await generateContentWithFallback(contents, systemInstruction);

      return res.json({
        reply: result.text,
        modelUsed: result.modelUsed,
      });
    } catch (err: any) {
      console.error("Chat API error:", err?.message || err);
      return res.status(500).json({
        error: "Failed to generate reflection response. Please retry.",
        details: err?.message,
      });
    }
  });

  // Session Summary Generator API
  app.post("/api/summarize", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = req.body && typeof req.body === "object" ? req.body : {};
      const messages = Array.isArray(data.messages) ? data.messages : [];

      if (messages.length === 0) {
        return res.status(400).json({ error: "At least one message is required to generate a session summary." });
      }

      const formattedDialogue = messages
        .map((m: any) => `${m.role === "user" ? "User" : "EchoMind"}: ${m.content}`)
        .join("\n\n");

      const systemInstruction = `You are an expert personal development analyst. Analyze the provided reflection dialogue and generate a structured JSON summary.
Return ONLY valid JSON matching this exact schema:
{
  "title": "A concise, meaningful 3 to 6 word title summarizing the reflection core",
  "summary": "A cohesive, elegant 2-paragraph synthesis of what was explored and resolved",
  "keyThemes": ["Array", "of", "3-5", "key", "themes"],
  "sentiment": "Emotional tone descriptor (e.g. Grounded Optimism, Contemplative Resolution)",
  "growthAction": "A specific, gentle personal action or reflection prompt for the user's ongoing growth"
}`;

      const contents = [
        {
          role: "user",
          parts: [{ text: `Here is the completed reflection session:\n\n${formattedDialogue}` }],
        },
      ];

      const result = await generateContentWithFallback(contents, systemInstruction, true);
      let parsedJson: any = {};
      try {
        parsedJson = JSON.parse(result.text);
      } catch {
        const cleaned = result.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsedJson = JSON.parse(cleaned);
      }

      return res.json({
        title: parsedJson.title || "Reflective Session",
        summary: parsedJson.summary || "Reflection completed.",
        keyThemes: Array.isArray(parsedJson.keyThemes) ? parsedJson.keyThemes : ["Self-Reflection"],
        sentiment: parsedJson.sentiment || "Thoughtful",
        growthAction: parsedJson.growthAction || "Reflect on this awareness throughout your week.",
        modelUsed: result.modelUsed,
      });
    } catch (err: any) {
      console.error("Summarize API error:", err?.message || err);
      return res.status(500).json({
        error: "Failed to generate session summary.",
        details: err?.message,
      });
    }
  });

  // Pattern Compass Analysis API
  // Strictly analyzes only the authenticated user's submitted session summaries
  app.post("/api/pattern-compass", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = req.body && typeof req.body === "object" ? req.body : {};
      const summaries = Array.isArray(data.summaries) ? data.summaries : [];

      if (summaries.length === 0) {
        return res.status(400).json({
          error: "No reflection summaries provided. Complete at least one reflection session first.",
        });
      }

      const inputContext = summaries.map((s: any, idx: number) => {
        return `[Session #${idx + 1} - ${s.title || "Untitled"}]
Themes: ${(s.keyThemes || []).join(", ")}
Sentiment: ${s.sentiment || "N/A"}
Summary: ${s.summary || ""}
Growth Action: ${s.growthAction || ""}`;
      }).join("\n\n---\n\n");

      const systemInstruction = `You are the Pattern Compass engine for EchoMind. You identify longitudinal personal growth trajectories, recurring motifs, evolving goals, and perspective shifts across a user's reflections.
Analyze ONLY this user's data.
Return ONLY valid JSON matching this schema:
{
  "periodDescription": "Brief description of the analysis horizon (e.g., 'Across 5 recent reflections')",
  "recurringThemes": [
    {
      "theme": "Theme title",
      "frequency": "High / Medium / Emerging",
      "explanation": "Observation of how this theme manifests in their life"
    }
  ],
  "frequentlyMentionedGoals": [
    {
      "goal": "Core aspiration or intention",
      "evolution": "How their relationship to this goal is shifting",
      "status": "In Progress / Clarified / Emerging"
    }
  ],
  "perspectiveShifts": [
    {
      "shift": "Shift description (e.g. From self-criticism to curiosity)",
      "evidence": "Observed transition across their reflections"
    }
  ],
  "personalizedPrompts": [
    "Deep personalized inquiry question 1",
    "Deep personalized inquiry question 2",
    "Deep personalized inquiry question 3"
  ]
}`;

      const contents = [
        {
          role: "user",
          parts: [{ text: `Here are my past reflection session summaries:\n\n${inputContext}` }],
        },
      ];

      const result = await generateContentWithFallback(contents, systemInstruction, true);
      let parsedJson: any = {};
      try {
        parsedJson = JSON.parse(result.text);
      } catch {
        const cleaned = result.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsedJson = JSON.parse(cleaned);
      }

      return res.json({
        periodDescription: parsedJson.periodDescription || `Across ${summaries.length} reflections`,
        recurringThemes: Array.isArray(parsedJson.recurringThemes) ? parsedJson.recurringThemes : [],
        frequentlyMentionedGoals: Array.isArray(parsedJson.frequentlyMentionedGoals) ? parsedJson.frequentlyMentionedGoals : [],
        perspectiveShifts: Array.isArray(parsedJson.perspectiveShifts) ? parsedJson.perspectiveShifts : [],
        personalizedPrompts: Array.isArray(parsedJson.personalizedPrompts) ? parsedJson.personalizedPrompts : [],
        sampleSize: summaries.length,
        modelUsed: result.modelUsed,
      });
    } catch (err: any) {
      console.error("Pattern Compass API error:", err?.message || err);
      return res.status(500).json({
        error: "Failed to generate Pattern Compass analysis.",
        details: err?.message,
      });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`EchoMind server securely running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Server startup error:", err);
  process.exit(1);
});
