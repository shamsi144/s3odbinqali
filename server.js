import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();

/* =========================
   GLOBAL SAFETY LOGGING
========================= */
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

/* =========================
   MIDDLEWARE
========================= */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.options("*", cors());

app.use(express.json({ limit: "5mb" }));

/* =========================
   OPENAI CLIENT
========================= */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/ping", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ status: "ok" });
});

/* =========================
   AI ANALYZER (OPEN-MINDED)
========================= */
app.post("/ask", async (req, res) => {
  try {
    const { room, question, summary, kpis } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY missing on server"
      });
    }

    if (!question || typeof question !== "string") {
      return res.status(400).json({
        error: "Question is missing or invalid"
      });
    }

    /* =========================
       OPEN-MINDED SYSTEM PROMPT
    ========================= */
    const systemPrompt = `
You are an intelligent, open-minded operations analyst
for a tactical command center dashboard.

CORE BEHAVIOR RULES:
- Be helpful and practical.
- Never refuse to answer unless it is truly impossible.
- If exact KPIs are missing, infer reasonably.
- If grouping is missing, assume 1 row = 1 egg when logical.
- Use common sense and operational reasoning.
- Clearly state assumptions before conclusions.
- Prefer usefulness over strict correctness.
- If data is weak, explain what you inferred and why.

YOU ARE ALLOWED TO:
- Infer meaning from column names and row counts
- Assume rows represent events (eggs, chicks, records)
- Suggest improvements instead of refusing
- Give insights even with partial data

YOU MUST NOT:
- Say "data is insufficient" without explanation
- Act like a strict accountant
- Ignore obvious patterns

CURRENT CONTEXT:
Room: ${room || "UNKNOWN"}

KPIs:
${JSON.stringify(kpis || {}, null, 2)}

Summary:
${JSON.stringify(summary || {}, null, 2)}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question }
      ]
    });

    const answer =
      completion?.choices?.[0]?.message?.content ||
      "No response generated.";

    return res.json({ answer });

  } catch (err) {
    console.error("ASK ERROR:", err);
    return res.status(500).json({
      error: "ask failed",
      details: String(err?.message || err)
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
