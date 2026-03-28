import express from "express";
import { VertexAI } from "@google-cloud/vertexai";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const vertexAI = new VertexAI({ project: "sobu-lab", location: "asia-northeast1" });

const EXTRACT_PROMPT = `
以下のテキストからレシピ情報を抽出し、JSON形式のみで返してください。説明文は不要です。

出力形式:
{
  "title": "料理名",
  "servings": "2人分",
  "source": "元のURL（提供された場合）",
  "ingredients": [
    { "amount": "大さじ2", "name": "醤油" }
  ],
  "steps": ["手順1", "手順2"],
  "memo": "コツやポイント"
}

ルール:
- amountは元の表記をそのまま使う
- stepsは番号なしの文字列配列
- レシピが見つからない場合は { "error": "レシピが見つかりませんでした" } を返す
- JSON以外のテキストは一切出力しない
`;

async function extractWithGemini(text, url) {
  const model = vertexAI.getGenerativeModel({ model: "gemini-2.5-flash-lite-preview-06-17" });
  const prompt = `URL: ${url}\n\n${EXTRACT_PROMPT}\n\n--- テキスト ---\n${text.slice(0, 8000)}`;
  const result = await model.generateContent(prompt);
  const raw = result.response.candidates[0].content.parts[0].text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(raw);
}

async function fetchPageInfo(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const imageUrl = ogMatch ? ogMatch[1] : null;
  const text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                   .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                   .replace(/<[^>]+>/g, " ")
                   .replace(/\s+/g, " ")
                   .trim();
  return { text, imageUrl };
}

async function fetchYoutubeInfo(videoUrl) {
  const match = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  const videoId = match ? match[1] : videoUrl;
  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
  const res = await fetch(apiUrl);
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) throw new Error("動画が見つかりませんでした");
  const s = item.snippet;
  const thumb = s.thumbnails?.maxres?.url || s.thumbnails?.high?.url || s.thumbnails?.medium?.url || s.thumbnails?.default?.url || null;
  return { text: `タイトル: ${s.title}\n概要欄:\n${s.description}`, imageUrl: thumb };
}

app.use(express.json());
app.use(express.static(join(__dirname, "dist")));

// POST extract recipe from URL
app.post("/api/extract", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URLが必要です" });
  if (!GEMINI_API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY が設定されていません" });

  try {
    const isYoutube = /youtube\.com|youtu\.be/.test(url);
    const { text, imageUrl } = isYoutube ? await fetchYoutubeInfo(url) : await fetchPageInfo(url);
    const recipe = await extractWithGemini(text, url);
    if (recipe.error) return res.status(422).json(recipe);
    res.json({ ...recipe, source: recipe.source || url, imageUrl: imageUrl || null, createdAt: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

const port = parseInt(process.env.PORT || "8080");
app.listen(port, () => console.log(`Listening on :${port}`));
