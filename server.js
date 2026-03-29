import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const EXTRACT_PROMPT = `
以下のテキストからレシピ情報を抽出し、同時に材料から栄養成分を推定して、JSON形式のみで返してください。説明文は不要です。

出力形式:
{
  "title": "料理名",
  "servings": "2人分",
  "source": "元のURL（提供された場合）",
  "ingredients": [
    { "amount": "大さじ2", "name": "醤油" }
  ],
  "steps": ["手順1", "手順2"],
  "memo": "コツやポイント",
  "nutrition": {
    "calories": 350,
    "protein": 25,
    "fat": 12,
    "carbs": 30,
    "note": "推定の根拠や注意事項（任意）"
  }
}

ルール:
- amountは元の表記をそのまま使う
- stepsは番号なしの文字列配列
- nutritionは1人前あたりの推定値（数値はすべて整数、calories=kcal、protein/fat/carbs=g）
- レシピが見つからない場合は { "error": "レシピが見つかりませんでした" } を返す
- JSON以外のテキストは一切出力しない
`;

async function extractWithGemini(text, url) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
  const prompt = `URL: ${url}\n\n${EXTRACT_PROMPT}\n\n--- テキスト ---\n${text.slice(0, 3000)}`;
  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
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
  const match = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/);
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

// POST estimate nutrition
app.post("/api/nutrition", async (req, res) => {
  const { title, servings, ingredients } = req.body;
  if (!ingredients?.length) return res.status(400).json({ error: "材料が必要です" });
  if (!GEMINI_API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY が設定されていません" });

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
  const ingredientText = ingredients.map((i) => `${i.amount || ""}${i.unit || ""} ${i.name}`).join("\n");
  const prompt = `以下のレシピの栄養成分を推定し、JSON形式のみで返してください。説明文は不要です。

料理名: ${title || "不明"}
分量: ${servings || "不明"}

材料:
${ingredientText}

出力形式（1人前あたりの推定値）:
{
  "calories": 350,
  "protein": 25,
  "fat": 12,
  "carbs": 30,
  "note": "推定の根拠や注意事項（任意）"
}

ルール:
- 数値はすべて整数
- 単位: calories=kcal, protein/fat/carbs=g
- 分量の記載がある場合はその人数で割った1人前の値
- JSON以外のテキストは一切出力しない`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
    res.json(JSON.parse(raw));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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
