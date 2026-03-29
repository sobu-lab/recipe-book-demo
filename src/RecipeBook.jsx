import { useState, useEffect } from "react";

// ── Storage (localStorage) ────────────────────────────────────────────
const LS_KEY = "recipes";
function lsGet() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function lsSave(recipes) {
  localStorage.setItem(LS_KEY, JSON.stringify(recipes));
}

// ── API ──────────────────────────────────────────────────────────────
async function apiExtract(url) {
  const r = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "抽出に失敗しました");
  if (data.error) throw new Error(data.error);
  return data;
}

// ── styling ──────────────────────────────────────────────────────────
const P = {
  bg: "#FAF7F2", card: "#FFFFFF", accent: "#C0583A", accentLight: "#F2E0D8",
  text: "#2D2A26", textSub: "#7A7570", border: "#E8E2DA",
  green: "#5B8C5A", greenLight: "#E8F0E8",
};
const font = `'Noto Serif JP','Georgia',serif`;
const fs = `'Noto Sans JP','Helvetica Neue',sans-serif`;

// ── small components ─────────────────────────────────────────────────
function Btn({ onClick, icon, label, secondary, small, danger, disabled }) {
  const base = {
    fontFamily: fs, fontSize: small ? 12 : 13, fontWeight: 500,
    border: "none", borderRadius: 8, padding: small ? "5px 10px" : "9px 18px",
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
    display: "inline-flex", alignItems: "center", gap: 5,
  };
  const style = danger ? { ...base, background: "#FDE8E8", color: "#B91C1C" }
    : secondary ? { ...base, background: P.accentLight, color: P.accent }
    : { ...base, background: P.accent, color: "#fff" };
  return <button style={style} onClick={onClick} disabled={disabled}>{icon && <span>{icon}</span>}{label}</button>;
}

function Label({ text, mt }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: P.textSub, marginBottom: 4, marginTop: mt || 12, fontFamily: fs }}>{text}</div>;
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: font, fontSize: 15, fontWeight: 700, color: P.accent, borderBottom: `2px solid ${P.accentLight}`, paddingBottom: 4, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

// ── URL Extract Modal ────────────────────────────────────────────────
function UrlExtractModal({ onExtracted, onClose }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleExtract = async () => {
    if (!url.trim()) return;
    setLoading(true); setErr("");
    try {
      const recipe = await apiExtract(url.trim());
      onExtracted(recipe);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 480, fontFamily: fs }}>
        <h3 style={{ fontFamily: font, fontSize: 18, marginBottom: 8 }}>URLからレシピを抽出</h3>
        <p style={{ fontSize: 12, color: P.textSub, marginBottom: 12, lineHeight: 1.5 }}>
          レシピサイトやYouTubeのURLを貼り付けてください。AIが自動でレシピを抽出します。
        </p>
        <input
          type="url" value={url} onChange={(e) => { setUrl(e.target.value); setErr(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleExtract()}
          placeholder="https://..."
          style={{ width: "100%", boxSizing: "border-box", fontFamily: fs, fontSize: 14, padding: "10px 12px", border: `1px solid ${err ? "#B91C1C" : P.border}`, borderRadius: 8, outline: "none", color: P.text }}
        />
        {err && <div style={{ color: "#B91C1C", fontSize: 12, marginTop: 6 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Btn onClick={handleExtract} label={loading ? "抽出中..." : "✨ 抽出する"} disabled={loading || !url.trim()} />
          <Btn onClick={onClose} label="閉じる" secondary disabled={loading} />
        </div>
      </div>
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────────────
function Header({ onAdd, onExtract, count, loading }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 16px 16px" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet" />
      <div style={{ fontSize: 14, fontFamily: fs, color: P.accent, letterSpacing: 4, marginBottom: 4 }}>MY RECIPE BOOK</div>
      <h1 style={{ fontFamily: font, fontSize: 28, fontWeight: 700, color: P.text, margin: "4px 0 2px" }}>レシピ帳</h1>
      <div style={{ fontFamily: fs, fontSize: 13, color: P.textSub }}>
        {loading ? "⏳ 読み込み中..." : `${count}件のレシピ`}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
        <Btn onClick={onExtract} icon="✨" label="URLから追加" disabled={loading} />
        <Btn onClick={onAdd} icon="＋" label="手動で追加" secondary disabled={loading} />
      </div>
    </div>
  );
}

function SearchBar({ value, onChange }) {
  return (
    <div style={{ padding: "0 16px", marginBottom: 12 }}>
      <input type="text" placeholder="🔍 レシピを検索..." value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", boxSizing: "border-box", fontFamily: fs, fontSize: 14, padding: "10px 14px", border: `1px solid ${P.border}`, borderRadius: 10, background: "#fff", outline: "none", color: P.text }} />
    </div>
  );
}

function RecipeCard({ recipe, onClick }) {
  return (
    <div onClick={onClick} style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, marginBottom: 10, cursor: "pointer", overflow: "hidden", display: "flex" }}>
      {recipe.image && (
        <img src={recipe.image} alt="" style={{ width: 90, height: 90, objectFit: "cover", flexShrink: 0 }}
          onError={(e) => { e.target.style.display = "none"; }} />
      )}
      <div style={{ padding: "14px 16px", flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: font, fontSize: 17, fontWeight: 700, color: P.text, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{recipe.title || "（無題）"}</div>
        <div style={{ fontFamily: fs, fontSize: 12, color: P.textSub, display: "flex", gap: 12 }}>
          {recipe.servings && <span>👤 {recipe.servings}</span>}
          <span>🥕 材料{recipe.ingredients?.length || 0}品</span>
          <span>📝 {recipe.steps?.length || 0}手順</span>
        </div>
      </div>
    </div>
  );
}

// ── Nutrition ─────────────────────────────────────────────────────────
function NutritionPanel({ recipe, onUpdate }) {
  const [nutrition, setNutrition] = useState(recipe.nutrition || null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const fetch_ = async () => {
    setLoading(true); setErr(""); setNutrition(null);
    try {
      const r = await fetch("/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: recipe.title, servings: recipe.servings, ingredients: recipe.ingredients }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "取得に失敗しました");
      setNutrition(data);
      onUpdate(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: font, fontSize: 15, fontWeight: 700, color: P.accent, borderBottom: `2px solid ${P.accentLight}`, paddingBottom: 4, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>栄養成分（AI推定）</span>
        <Btn onClick={fetch_} label={loading ? "推定中..." : "🔄 再推定"} secondary small disabled={loading} />
      </div>
      {err && <div style={{ color: "#B91C1C", fontSize: 12 }}>{err}</div>}
      {nutrition && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
            {[
              { label: "カロリー", value: nutrition.calories, unit: "kcal" },
              { label: "たんぱく質", value: nutrition.protein, unit: "g" },
              { label: "脂質", value: nutrition.fat, unit: "g" },
              { label: "炭水化物", value: nutrition.carbs, unit: "g" },
            ].map(({ label, value, unit }) => (
              <div key={label} style={{ background: P.accentLight, borderRadius: 10, padding: "10px 6px", textAlign: "center" }}>
                <div style={{ fontFamily: fs, fontSize: 10, color: P.textSub, marginBottom: 2 }}>{label}</div>
                <div style={{ fontFamily: font, fontSize: 18, fontWeight: 700, color: P.accent }}>{value}</div>
                <div style={{ fontFamily: fs, fontSize: 10, color: P.textSub }}>{unit}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: P.textSub, lineHeight: 1.5 }}>1人前あたりの推定値。{nutrition.note}</div>
        </>
      )}
      {!nutrition && !loading && !err && (
        <div style={{ fontSize: 13, color: P.textSub }}>「再推定」ボタンで材料からAIが栄養成分を推定します。</div>
      )}
    </div>
  );
}

// ── Detail ────────────────────────────────────────────────────────────
function RecipeDetail({ recipe, onBack, onEdit, onDelete, onNutritionUpdate }) {
  return (
    <div style={{ padding: 16, fontFamily: fs }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Btn onClick={onBack} label="← 戻る" secondary small />
        <div style={{ flex: 1 }} />
        <Btn onClick={onEdit} label="編集" small />
        <Btn onClick={onDelete} label="削除" danger small />
      </div>
      {recipe.image && (
        <img src={recipe.image} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 12, marginBottom: 12 }}
          onError={(e) => { e.target.style.display = "none"; }} />
      )}
      <h2 style={{ fontFamily: font, fontSize: 24, fontWeight: 700, color: P.text, marginBottom: 4 }}>{recipe.title || "（無題）"}</h2>
      {recipe.servings && <div style={{ fontSize: 13, color: P.textSub, marginBottom: 4 }}>👤 {recipe.servings}</div>}
      {recipe.source && <a href={recipe.source} target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: 12, color: P.accent, marginBottom: 12, wordBreak: "break-all", textDecoration: "none" }}>🔗 {recipe.source}</a>}
      <Section title="材料">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <tbody>
            {(recipe.ingredients || []).map((ing, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${P.border}` }}>
                <td style={{ padding: "6px 8px 6px 0", color: P.text, fontWeight: 500 }}>{ing.name}</td>
                <td style={{ padding: "6px 0", color: P.textSub, textAlign: "right", whiteSpace: "nowrap" }}>{ing.amount}{ing.unit || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section title="作り方">
        {(recipe.steps || []).map((step, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ minWidth: 26, height: 26, borderRadius: "50%", background: P.green, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
            <div style={{ fontSize: 14, color: P.text, lineHeight: 1.7 }}>{step}</div>
          </div>
        ))}
      </Section>
      {recipe.memo && <Section title="メモ"><div style={{ fontSize: 14, color: P.textSub, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{recipe.memo}</div></Section>}
      <NutritionPanel recipe={recipe} onUpdate={onNutritionUpdate} />
    </div>
  );
}

// ── Form ──────────────────────────────────────────────────────────────
function RecipeForm({ initial, onSave, onCancel, saving }) {
  const [r, setR] = useState(() => initial || { title: "", servings: "", source: "", image: "", ingredients: [{ amount: "", unit: "", name: "" }], steps: [""], memo: "" });
  const set = (k, v) => setR((p) => ({ ...p, [k]: v }));
  const setIng = (i, k, v) => { const n = [...r.ingredients]; n[i] = { ...n[i], [k]: v }; set("ingredients", n); };
  const setStep = (i, v) => { const n = [...r.steps]; n[i] = v; set("steps", n); };
  const inp = { fontFamily: fs, fontSize: 14, padding: "8px 10px", border: `1px solid ${P.border}`, borderRadius: 8, outline: "none", color: P.text, width: "100%", boxSizing: "border-box" };

  return (
    <div style={{ padding: 16, fontFamily: fs }}>
      <h2 style={{ fontFamily: font, fontSize: 20, fontWeight: 700, marginBottom: 16 }}>{initial ? "レシピを編集" : "レシピを追加"}</h2>
      <Label text="タイトル" />
      <input style={inp} value={r.title} onChange={(e) => set("title", e.target.value)} placeholder="鶏の照り焼き" />
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <div style={{ flex: 1 }}><Label text="分量" /><input style={inp} value={r.servings} onChange={(e) => set("servings", e.target.value)} placeholder="2人分" /></div>
        <div style={{ flex: 2 }}><Label text="出典URL" /><input style={inp} value={r.source} onChange={(e) => set("source", e.target.value)} placeholder="https://..." /></div>
      </div>
      <Label text="画像URL（任意）" mt={12} />
      <input style={inp} value={r.image || ""} onChange={(e) => set("image", e.target.value)} placeholder="https://..." />
      {r.image && <img src={r.image} alt="" style={{ marginTop: 8, width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 8 }} onError={(e) => { e.target.style.display = "none"; }} />}
      <Label text="材料" mt={16} />
      {r.ingredients.map((ing, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
          <input style={{ ...inp, flex: 2 }} value={ing.name} onChange={(e) => setIng(i, "name", e.target.value)} placeholder="鶏もも肉" />
          <input style={{ ...inp, flex: 1 }} value={ing.amount} onChange={(e) => setIng(i, "amount", e.target.value)} placeholder="2枚" />
          {r.ingredients.length > 1 && <button onClick={() => set("ingredients", r.ingredients.filter((_, j) => j !== i))} style={{ border: "none", background: "none", color: "#B91C1C", cursor: "pointer", fontSize: 18, padding: 2 }}>×</button>}
        </div>
      ))}
      <Btn onClick={() => set("ingredients", [...r.ingredients, { amount: "", unit: "", name: "" }])} label="＋ 材料追加" secondary small />
      <Label text="手順" mt={16} />
      {r.steps.map((step, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "flex-start" }}>
          <span style={{ minWidth: 22, textAlign: "center", marginTop: 8, color: P.textSub, fontSize: 13 }}>{i + 1}.</span>
          <textarea style={{ ...inp, minHeight: 40, resize: "vertical", flex: 1 }} value={step} onChange={(e) => setStep(i, e.target.value)} placeholder="手順を入力..." />
          {r.steps.length > 1 && <button onClick={() => set("steps", r.steps.filter((_, j) => j !== i))} style={{ border: "none", background: "none", color: "#B91C1C", cursor: "pointer", fontSize: 18, padding: 2, marginTop: 6 }}>×</button>}
        </div>
      ))}
      <Btn onClick={() => set("steps", [...r.steps, ""])} label="＋ 手順追加" secondary small />
      <Label text="メモ" mt={16} />
      <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={r.memo} onChange={(e) => set("memo", e.target.value)} placeholder="コツ・ポイントなど..." />
      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <Btn onClick={() => onSave(r)} label={saving ? "保存中..." : "保存"} disabled={saving} />
        <Btn onClick={onCancel} label="キャンセル" secondary disabled={saving} />
      </div>
    </div>
  );
}

// ── normalize ────────────────────────────────────────────────────────
function normalizeRecipe(r) {
  return {
    title: r.title || "（無題）",
    servings: r.servings || "",
    source: r.source || "",
    image: r.image || r.imageUrl || "",
    ingredients: (r.ingredients || []).map((ing) =>
      typeof ing === "string" ? { amount: "", name: ing } : { amount: ing.amount || "", unit: ing.unit || "", name: ing.name || "" }
    ),
    steps: (r.steps || []).map(String),
    memo: r.memo || "",
    nutrition: r.nutrition || null,
    createdAt: r.createdAt || new Date().toISOString(),
  };
}

// ── Main App ─────────────────────────────────────────────────────────
export default function RecipeBook() {
  const [recipes, setRecipes] = useState([]);
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [showExtract, setShowExtract] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  useEffect(() => {
    setRecipes(lsGet());
  }, []);

  const handleSave = (recipe) => {
    setSaving(true);
    try {
      const data = normalizeRecipe(recipe);
      let updated;
      if (selected?.id) {
        updated = { ...data, id: selected.id };
        const next = lsGet().map((r) => (r.id === selected.id ? updated : r));
        lsSave(next);
        setRecipes(next);
      } else {
        updated = { ...data, id: crypto.randomUUID() };
        const next = [updated, ...lsGet()];
        lsSave(next);
        setRecipes(next);
      }
      setSelected(updated);
      setView("detail");
      showToast("✓ 保存しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    if (!confirm("このレシピを削除しますか？")) return;
    const next = lsGet().filter((r) => r.id !== id);
    lsSave(next);
    setRecipes(next);
    setView("list"); setSelected(null);
    showToast("✓ 削除しました");
  };

  const filtered = recipes.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.title?.toLowerCase().includes(s) || r.ingredients?.some((ing) => ing.name?.toLowerCase().includes(s)) || r.memo?.toLowerCase().includes(s);
  });

  return (
    <div style={{ background: P.bg, minHeight: "100vh", maxWidth: 520, margin: "0 auto" }}>
      {view === "list" && (
        <>
          <Header count={recipes.length} loading={loading}
            onAdd={() => { setSelected(null); setView("add"); }}
            onExtract={() => setShowExtract(true)}
          />
          <SearchBar value={search} onChange={setSearch} />
          <div style={{ padding: "0 16px 32px" }}>
            {!loading && filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0", fontFamily: fs, color: P.textSub, fontSize: 14, lineHeight: 2, whiteSpace: "pre-wrap" }}>
                {recipes.length === 0 ? "まだレシピがありません\n「URLから追加」または「手動で追加」で\nレシピを登録しましょう" : "該当するレシピがありません"}
              </div>
            )}
            {filtered.map((r) => <RecipeCard key={r.id} recipe={r} onClick={() => { setSelected(r); setView("detail"); }} />)}
          </div>
        </>
      )}
      {view === "detail" && selected && (
        <RecipeDetail recipe={selected} onBack={() => setView("list")} onEdit={() => setView("edit")} onDelete={() => handleDelete(selected.id)}
          onNutritionUpdate={(nutrition) => {
            const updated = { ...selected, nutrition };
            const next = lsGet().map((r) => (r.id === selected.id ? updated : r));
            lsSave(next);
            setRecipes(next);
            setSelected(updated);
          }}
        />
      )}
      {(view === "edit" || view === "add") && (
        <RecipeForm initial={view === "edit" ? selected : (view === "add" && selected?.title ? selected : null)} onSave={handleSave} onCancel={() => { setSelected(null); setView("list"); }} saving={saving} />
      )}
      {showExtract && (
        <UrlExtractModal
          onExtracted={(recipe) => {
            setSelected(normalizeRecipe(recipe));
            setShowExtract(false);
            setView("add");
          }}
          onClose={() => setShowExtract(false)}
        />
      )}
      {toast && (
        <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: toast.includes("⚠") ? "#FFF8E0" : P.greenLight, color: toast.includes("⚠") ? "#92400E" : P.green, fontFamily: fs, fontSize: 13, fontWeight: 500, padding: "8px 20px", borderRadius: 20, boxShadow: "0 2px 10px rgba(0,0,0,.12)", zIndex: 200 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
