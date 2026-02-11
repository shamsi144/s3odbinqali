import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();

/* =========================
   BASIC HARDENING / LOGGING
========================= */
process.on("unhandledRejection", (err) => console.error("UNHANDLED:", err));
process.on("uncaughtException", (err) => console.error("UNCAUGHT:", err));

/* =========================
   MIDDLEWARE
========================= */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.options("*", cors());

app.use(express.json({ limit: "10mb" }));

/* =========================
   OPENAI CLIENT
========================= */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* =========================
   HEALTH CHECK
========================= */
app.get("/ping", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ status: "ok" });
});

/* =========================
   AI ENDPOINT
========================= */
app.post("/ask", async (req, res) => {
  try {
    const { room, question, summary, kpis } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY missing on server" });
    }

    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Question is missing or invalid" });
    }

    // "Unlimited-style" prompt: general reasoning allowed, no strict data-only constraint.
    // Still encourages being transparent when assumptions are made.
    const systemPrompt = `
You are a highly capable operations + strategy analyst for a tactical command center dashboard.

GOAL:
Be maximally helpful. Do not refuse just because data is incomplete.
Use general knowledge + reasoning + whatever room data is provided.

RULES:
- You MAY answer using general knowledge even if KPIs/summary are missing.
- If you use assumptions, state them briefly (but do not be annoying about it).
- If the user asks something that could be computed from data but data isn't provided, do a best-effort guess AND suggest the exact data/grouping needed to compute it precisely.
- If the question is vague ("tell me something"), proactively provide 3–6 useful insights/actions.
- If the user asks "most eggs" and there is no grouping, assume each row is one egg if that seems reasonable, and explain how to make it exact (grouping by ring/female).
- Keep answers concise, tactical, and action-oriented.

CONTEXT (may be empty):
Room: ${room || "UNKNOWN"}

KPIs (may be empty):
${JSON.stringify(kpis || {}, null, 2)}

Summary (may be empty):
${JSON.stringify(summary || {}, null, 2)}
`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question }
      ]
    });

    const answer = completion?.choices?.[0]?.message?.content || "No response generated.";
    return res.json({ answer });

  } catch (err) {
    console.error("ASK ERROR:", err);

    // Pass-through useful OpenAI errors (quota, auth) without crashing
    const msg = String(err?.message || err);
    const status = msg.includes("429") ? 429 : msg.includes("401") ? 401 : 500;

    return res.status(status).json({
      error: "ask failed",
      details: msg
    });
  }
});

/* =========================
   START SERVER (RENDER SAFE)
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("AI backend running on port", PORT);
});
