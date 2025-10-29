import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

config();
const app = express();
app.use(cors());
app.use(express.json());

const NEWS_API_KEY = process.env.NEWSDATA_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const MAX_AGE_HOURS = Number(process.env.NEWS_MAX_AGE_HOURS || 4);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to fetch news and filter by freshness
async function fetchNews() {
  if (!NEWS_API_KEY) {
    console.warn("No NewsData API key provided - returning mock data.");
    return getMock();
  }
  const params = new URLSearchParams({
    apikey: NEWS_API_KEY,
    country: "in",
    language: "en",
    page: "1"
  });
  const url = `https://newsdata.io/api/1/latest?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("NewsData fetch failed", res.status);
    return getMock();
  }
  const j = await res.json();
  const raw = j.results ?? j.data ?? [];
  const normalized = raw.map((a, idx) => {
    const pubDate = a.pubDate ? new Date(a.pubDate).toISOString() : new Date().toISOString();
    return {
      id: a.link ?? a.title ?? `news-${Date.now()}-${idx}`,
      title: a.title ?? "Untitled",
      summary: a.description ?? a.content ?? "",
      content: a.content ?? "",
      imageUrl: a.image_url ?? null,
      sourceName: a.source_name ?? a.source_id ?? "Unknown",
      category: Array.isArray(a.category) ? a.category[0] : a.category ?? "general",
      pubDate,
      link: a.link ?? ""
    };
  }).filter(x => x.title && x.link);

  const cutoff = Date.now() - MAX_AGE_HOURS*60*60*1000;
  const fresh = normalized.filter(a => {
    const t = new Date(a.pubDate).getTime();
    if (isNaN(t)) return true;
    return t >= cutoff;
  });
  return fresh.length ? fresh : normalized;
}

function getMock() {
  const now = new Date().toISOString();
  return [
    { id: "mock-1", title: "Demo: TruthLensAI sample news", summary: "Mock article - API key missing", content: "Mock content", imageUrl: null, sourceName: "Demo", category: "general", pubDate: now, link: "https://example.com/mock-1" },
    { id: "mock-2", title: "Demo: Second story", summary: "Another mock article", content: "More mock", imageUrl: null, sourceName: "Demo", category: "tech", pubDate: new Date(Date.now()-3600*1000).toISOString(), link: "https://example.com/mock-2" }
  ];
}

// Routes
app.get("/api/news", async (req, res) => {
  try {
    const articles = await fetchNews();
    res.json(articles);
  } catch (err) {
    console.error("Error /api/news", err);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

app.post("/api/analyze", async (req, res) => {
  try {
    const article = req.body;
    if (!article || !article.title) return res.status(400).json({ error: "Missing article" });

    // If OPENAI_KEY not present, return demo analysis
    if (!OPENAI_KEY) {
      const demo = {
        truthScore: 65,
        sentiment: { label: "neutral", scores: { positive: 0.2, neutral: 0.6, negative: 0.2 } },
        bias: { label: "center", confidence: 0.6 },
        sourceCredibility: { score: 60, verified: false },
        factCheckSummary: "OpenAI key not configured - demo summary.",
        perspectives: [{ source: article.sourceName ?? "Original", summary: article.summary ?? "", url: article.link }],
        analyzedAt: new Date().toISOString()
      };
      return res.json(demo);
    }

    // Call OpenAI Chat Completions
    const payload = {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an assistant that returns JSON about news analysis. Return only JSON." },
        { role: "user", content: `Analyze this article for sentiment, bias, truthfulness and provide a short fact-check summary and perspectives. Title: ${article.title}\nSummary: ${article.summary}\nContent: ${article.content || ""}\nURL: ${article.link}` }
      ],
      max_tokens: 600,
      temperature: 0.0
    };

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!openaiRes.ok) {
      const txt = await openaiRes.text();
      console.error("OpenAI error", openaiRes.status, txt);
      return res.status(500).json({ error: "OpenAI API failed" });
    }

    const j = await openaiRes.json();
    const content = j.choices?.[0]?.message?.content ?? j.choices?.[0]?.text ?? "";
    // Try parse JSON out of content
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      const s = content.indexOf("{");
      const eIdx = content.lastIndexOf("}");
      if (s !== -1 && eIdx !== -1 && eIdx > s) {
        parsed = JSON.parse(content.slice(s, eIdx+1));
      } else {
        // fallback basic
        parsed = { truthScore: 60, sentiment: { label: "neutral", scores: { positive: 0.2, neutral: 0.6, negative: 0.2 } }, bias: { label: "unknown", confidence: 0.5 }, sourceCredibility: { score: 50, verified: false }, factCheckSummary: content.slice(0,1000), perspectives: [{ source: article.sourceName || "Original", summary: article.summary || "", url: article.link }], analyzedAt: new Date().toISOString() };
      }
    }
    res.json(parsed);
  } catch (err) {
    console.error("Error /api/analyze", err);
    res.status(500).json({ error: "Analyze failed" });
  }
});

// Serve client static
app.use(express.static(path.join(__dirname, "client")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "client", "index.html"));
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log("TruthLensAI running on port", port);
});
