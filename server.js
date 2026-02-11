import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.get("/ping", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/ask", async (req, res) => {
  const { question } = req.body;

  const result = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: question }]
  });

  res.json({ answer: result.choices[0].message.content });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("AI backend running"));
