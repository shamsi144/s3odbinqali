import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();

/**
 * CORS FIX:
 * - Allows your dashboard at http://localhost:8000
 * - Also allows any origin (*) so later you can host the dashboard online
 * - Handles OPTIONS preflight (required for POST JSON)
 */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.options("*", cors());

app.use(express.json({ limit: "2mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Health check
app.get("/ping", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ status: "ok" });
});

// Main AI endpoint
app.post("/ask", async (req, res) => {
  try {
    const { room, question, summary, kpis } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is missing on Render (Environment variables)"
      });
    }

    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "question missing or invalid" });
    }

    const systemPrompt =
      "You are an operations analysis AI for a tactical dashboard. " +
      "Answer using ONLY the provided room data. " +
      "If data is insufficient, say so clearly.\n\n" +
      `Room: ${room || "UNKNOWN"}\n` +
      `KPIs: ${JSON.stringify(kpis || {}, null, 2)}\n` +
      `Summary: ${JSON.stringify(summary || {}, null, 2)}\n`;

    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question }
      ],
      temperature: 0.2
    });

    const answer = result?.choices?.[0]?.message?.content || "";
    return res.json({ answer });

  } catch (err) {
    console.error("ASK ERROR:", err);
    return res.status(500).json({
      error: "ask failed",
      details: String(err?.message || err)
    });
  }
});

// IMPORTANT: Render uses process.env.PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("AI backend running on port", PORT);
});
