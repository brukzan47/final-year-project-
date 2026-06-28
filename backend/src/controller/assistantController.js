import { env } from "../config/env.js";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

const toMessages = (history) => {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-6)
    .map((item) => {
      const role = item.role === "assistant" ? "assistant" : "user";
      const content = String(item.content || "").trim();
      return content ? { role, content } : null;
    })
    .filter(Boolean);
};

export const assistantChat = async (req, res) => {
  try {
    const key = process.env.OPENAI_API_KEY || env.openai.apiKey;
    if (!key) {
      return res.status(503).json({ message: "OpenAI API key is not configured" });
    }
    const { message, history } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: "Message is required" });
    }
    const payload = {
      model: env.openai.model || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are the Ethiopian Import Customs assistant. Help users understand declarations, payments, inspections, shipment tracking, and general customs navigation.",
        },
        ...toMessages(history),
        { role: "user", content: String(message) },
      ],
      max_tokens: 400,
    };
    const response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      const msg = data?.error?.message || "OpenAI request failed";
      return res.status(response.status).json({ message: msg });
    }
    const text =
      (data.choices || [])
        .map((choice) => choice.message?.content)
        .filter(Boolean)
        .join("\n\n") || "No response from AI.";
    res.json({ answer: text });
  } catch (error) {
    res.status(500).json({ message: error?.message || "Assistant error" });
  }
};
