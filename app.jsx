import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, addDoc, doc, updateDoc, increment, query, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import logoUrl from "./CityVoice logo.png";

const CATEGORIES = [
  { id: "transport", label: "Transportation", icon: "🚌" },
  { id: "roads", label: "Roads & Bridges", icon: "🛣️" },
  { id: "green", label: "Parks & Green Spaces", icon: "🌳" },
  { id: "housing", label: "Housing", icon: "🏘️" },
  { id: "water", label: "Water & Drainage", icon: "💧" },
  { id: "waste", label: "Waste Management", icon: "♻️" },
  { id: "safety", label: "Safety & Lighting", icon: "💡" },
  { id: "digital", label: "Smart City", icon: "📡" },
  { id: "cycling", label: "Cycling & Walking", icon: "🚴" },
  { id: "other", label: "Other", icon: "🏛️" },
];

const TYPES = [
  { id: "problem", label: "Problem", color: "#e74c3c", bg: "rgba(231,76,60,0.12)", icon: "⚠️" },
  { id: "idea", label: "Idea", color: "#3498db", bg: "rgba(52,152,219,0.12)", icon: "💡" },
  { id: "improvement", label: "Improvement", color: "#27ae60", bg: "rgba(39,174,96,0.12)", icon: "🔧" },
];



function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ─── STORAGE ─────────────────────────────────────────────────────────────────
async function loadIdeas() {
  try {
    const q = query(collection(db, "ideas"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error loading ideas:", error);
    return [];
  }
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function TypeBadge({ type }) {
  const t = TYPES.find(x => x.id === type) || TYPES[0];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: t.bg, color: t.color,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.5px",
      padding: "3px 10px", borderRadius: 100,
      border: `1px solid ${t.color}33`,
    }}>
      {t.icon} {t.label.toUpperCase()}
    </span>
  );
}

function CategoryTag({ catId }) {
  const c = CATEGORIES.find(x => x.id === catId) || CATEGORIES[0];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "rgba(255,255,255,0.06)", color: "#a0b4c8",
      fontSize: 11, fontWeight: 500,
      padding: "3px 10px", borderRadius: 100,
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      {c.icon} {c.label}
    </span>
  );
}

function IdeaCard({ idea, onUpvote, hasVoted }) {
  const [bounce, setBounce] = useState(false);
  function handleVote() {
    if (hasVoted) return;
    setBounce(true);
    setTimeout(() => setBounce(false), 300);
    onUpvote(idea.id);
  }
  return (
    <div className="idea-card" style={{
      background: "rgba(20,32,48,0.85)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16,
      padding: "20px 22px",
      display: "flex", gap: 16,
      backdropFilter: "blur(12px)",
      transition: "border-color 0.2s, transform 0.2s",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(52,199,120,0.3)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"}
    >
      {/* Vote */}
      <button onClick={handleVote} className="vote-btn" style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 4, background: hasVoted ? "rgba(52,199,120,0.15)" : "rgba(255,255,255,0.04)",
        border: hasVoted ? "1px solid rgba(52,199,120,0.4)" : "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12, padding: "10px 14px", cursor: hasVoted ? "default" : "pointer",
        transition: "all 0.2s", minWidth: 52, flexShrink: 0,
        transform: bounce ? "scale(1.15)" : "scale(1)",
      }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>▲</span>
        <span style={{
          fontFamily: "'Syne', sans-serif", fontWeight: 800,
          fontSize: 16, color: hasVoted ? "#34c778" : "#fff",
        }}>{idea.votes}</span>
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          <TypeBadge type={idea.type} />
          <CategoryTag catId={idea.category} />
        </div>
        <p style={{
          fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700,
          color: "#eef2f7", marginBottom: 6, lineHeight: 1.3,
        }}>{idea.title}</p>
        <p style={{
          fontSize: 13, color: "#7a93ab", lineHeight: 1.6, marginBottom: 10,
        }}>{idea.description}</p>
        <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#5a7285", flexWrap: "wrap" }}>
          <span>👤 {idea.name || "Anonymous"}</span>
          {idea.neighborhood && <span>📍 {idea.neighborhood}</span>}
          <span>🕒 {timeAgo(idea.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}

function StatsBar({ ideas }) {
  const total = ideas.length;
  const byType = TYPES.map(t => ({ ...t, count: ideas.filter(i => i.type === t.id).length }));
  const topCat = CATEGORIES.map(c => ({
    ...c, count: ideas.filter(i => i.category === c.id).length
  })).sort((a, b) => b.count - a.count).slice(0, 3);
  const totalVotes = ideas.reduce((s, i) => s + i.votes, 0);

  return (
    <div className="stats-grid">
      {[
        { label: "Total Submissions", value: total, icon: "📋", color: "#a0b4c8" },
        { label: "Total Votes", value: totalVotes, icon: "▲", color: "#34c778" },
        ...byType.map(t => ({ label: t.label + "s", value: t.count, icon: t.icon, color: t.color })),
      ].map((s, i) => (
        <div key={i} style={{
          background: "rgba(20,32,48,0.7)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 14, padding: "16px 18px",
          backdropFilter: "blur(10px)",
        }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontWeight: 800,
            fontSize: 24, color: s.color, lineHeight: 1,
          }}>{s.value}</div>
          <div style={{ fontSize: 11, color: "#5a7285", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function SubmitForm({ onSubmit, onClose }) {
  const [form, setForm] = useState({
    title: "", description: "", type: "problem", category: "transport",
    name: "", neighborhood: "",
  });
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function handleSubmit() {
    if (!form.title.trim() || !form.description.trim()) return;
    onSubmit({ ...form, id: genId(), votes: 0, timestamp: Date.now() });
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); onClose(); setStep(1); setForm({ title: "", description: "", type: "problem", category: "transport", name: "", neighborhood: "" }); }, 2000);
  }

  const inputStyle = {
    width: "100%", background: "rgba(10,20,32,0.8)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "12px 14px", color: "#eef2f7",
    fontFamily: "'DM Sans', sans-serif", fontSize: 14, outline: "none",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(5,12,22,0.92)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: "16px", backdropFilter: "blur(8px)",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="form-modal-inner">
        {submitted ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "rgba(52,199,120,0.15)", border: "2px solid #34c778",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32, margin: "0 auto 20px",
            }}>✓</div>
            <h3 style={{ fontFamily: "'Syne',sans-serif", color: "#eef2f7", fontSize: 22, marginBottom: 8 }}>Submitted!</h3>
            <p style={{ color: "#7a93ab", fontSize: 14 }}>Your submission is now live on the board.</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
              <div>
                <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, color: "#eef2f7", marginBottom: 4 }}>Share Your Input</h2>
                <p style={{ color: "#5a7285", fontSize: 13 }}>Step {step} of 2</p>
              </div>
              <button onClick={onClose} style={{ background: "rgba(255,255,255,0.05)", border: "none", color: "#7a93ab", width: 36, height: 36, borderRadius: "50%", cursor: "pointer", fontSize: 18 }}>×</button>
            </div>

            {/* Step indicator */}
            <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
              {[1, 2].map(s => (
                <div key={s} style={{
                  flex: 1, height: 4, borderRadius: 2,
                  background: s <= step ? "#34c778" : "rgba(255,255,255,0.08)",
                  transition: "background 0.3s",
                }} />
              ))}
            </div>

            {step === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {/* Type */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#7a93ab", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 10 }}>Type of Submission *</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {TYPES.map(t => (
                      <button key={t.id} onClick={() => set("type", t.id)} style={{
                        flex: 1, padding: "10px 8px", borderRadius: 10, border: "1px solid",
                        borderColor: form.type === t.id ? t.color : "rgba(255,255,255,0.08)",
                        background: form.type === t.id ? t.bg : "rgba(255,255,255,0.03)",
                        color: form.type === t.id ? t.color : "#7a93ab",
                        cursor: "pointer", fontSize: 12, fontWeight: 700,
                        transition: "all 0.2s", textAlign: "center",
                      }}>
                        <div style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</div>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#7a93ab", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 10 }}>Category *</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {CATEGORIES.map(c => (
                      <button key={c.id} onClick={() => set("category", c.id)} style={{
                        padding: "8px 12px", borderRadius: 8, border: "1px solid",
                        borderColor: form.category === c.id ? "#34c778" : "rgba(255,255,255,0.07)",
                        background: form.category === c.id ? "rgba(52,199,120,0.1)" : "rgba(255,255,255,0.03)",
                        color: form.category === c.id ? "#34c778" : "#7a93ab",
                        cursor: "pointer", fontSize: 12, fontWeight: 500,
                        textAlign: "left", display: "flex", alignItems: "center", gap: 6,
                        transition: "all 0.2s",
                      }}>
                        <span>{c.icon}</span>{c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={() => setStep(2)} disabled={!form.type} style={{
                  marginTop: 8, padding: "14px 0", borderRadius: 12,
                  background: "linear-gradient(135deg, #34c778, #1a9e56)",
                  border: "none", color: "#fff", fontFamily: "'Syne',sans-serif",
                  fontSize: 15, fontWeight: 800, cursor: "pointer", letterSpacing: "0.5px",
                }}>Continue →</button>
              </div>
            )}

            {step === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#7a93ab", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>Title *</label>
                  <input value={form.title} onChange={e => set("title", e.target.value)}
                    placeholder="Summarize in one sentence…" style={inputStyle}
                    onFocus={e => e.target.style.borderColor = "#34c778"}
                    onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#7a93ab", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>Description *</label>
                  <textarea value={form.description} onChange={e => set("description", e.target.value)}
                    placeholder="Describe the problem, idea, or improvement in detail. Where is it? How does it affect you?"
                    rows={4} style={{ ...inputStyle, resize: "vertical" }}
                    onFocus={e => e.target.style.borderColor = "#34c778"}
                    onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                  />
                </div>
                <div className="name-neighborhood-grid">
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#7a93ab", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>Your Name</label>
                    <input value={form.name} onChange={e => set("name", e.target.value)}
                      placeholder="Optional" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = "#34c778"}
                      onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#7a93ab", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>Neighborhood</label>
                    <input value={form.neighborhood} onChange={e => set("neighborhood", e.target.value)}
                      placeholder="Optional" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = "#34c778"}
                      onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button onClick={() => setStep(1)} style={{
                    padding: "14px 0", borderRadius: 12, flex: "0 0 80px",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "#7a93ab", cursor: "pointer", fontSize: 15,
                  }}>←</button>
                  <button onClick={handleSubmit} disabled={!form.title.trim() || !form.description.trim()} style={{
                    flex: 1, padding: "14px 0", borderRadius: 12,
                    background: form.title.trim() && form.description.trim()
                      ? "linear-gradient(135deg, #34c778, #1a9e56)"
                      : "rgba(255,255,255,0.05)",
                    border: "none",
                    color: form.title.trim() && form.description.trim() ? "#fff" : "#3a5168",
                    fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 800,
                    cursor: form.title.trim() && form.description.trim() ? "pointer" : "not-allowed",
                    letterSpacing: "0.5px", transition: "all 0.2s",
                  }}>Submit →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState("board"); // board | dashboard
  const [filter, setFilter] = useState({ type: "all", category: "all", sort: "votes" });
  const [votedIds, setVotedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("voted-ids") || "[]"); } catch { return []; }
  });
  const [searchQ, setSearchQ] = useState("");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadIdeas().then(data => { setIdeas(data); setLoading(false); });
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function handleSubmit(idea) {
    try {
      const { id, ...ideaData } = idea;
      const docRef = await addDoc(collection(db, "ideas"), ideaData);
      const newIdea = { ...ideaData, id: docRef.id };

      setIdeas([newIdea, ...ideas]);
      showToast("🎉 Submission live on the board!");
    } catch (error) {
      console.error("Error adding document: ", error);
      showToast("❌ Error saving submission.");
    }
  }

  async function handleUpvote(id) {
    if (votedIds.includes(id)) return;
    const updated = ideas.map(i => i.id === id ? { ...i, votes: i.votes + 1 } : i);
    const newVoted = [...votedIds, id];
    setIdeas(updated);
    setVotedIds(newVoted);
    localStorage.setItem("voted-ids", JSON.stringify(newVoted));
    try {
      const ideaRef = doc(db, "ideas", id);
      await updateDoc(ideaRef, { votes: increment(1) });
    } catch (error) {
      console.error("Error upvoting: ", error);
    }
  }

  const filtered = ideas
    .filter(i => filter.type === "all" || i.type === filter.type)
    .filter(i => filter.category === "all" || i.category === filter.category)
    .filter(i => !searchQ || i.title.toLowerCase().includes(searchQ.toLowerCase()) || i.description.toLowerCase().includes(searchQ.toLowerCase()))
    .sort((a, b) => filter.sort === "votes" ? b.votes - a.votes : b.timestamp - a.timestamp);

  // Dashboard data
  const topIdeas = [...ideas].sort((a, b) => b.votes - a.votes).slice(0, 5);
  const catStats = CATEGORIES.map(c => ({
    ...c,
    count: ideas.filter(i => i.category === c.id).length,
    votes: ideas.filter(i => i.category === c.id).reduce((s, i) => s + i.votes, 0),
  })).sort((a, b) => b.count - a.count);

  const maxCatCount = Math.max(...catStats.map(c => c.count), 1);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060e18",
      backgroundImage: "radial-gradient(ellipse at 15% 10%, rgba(52,199,120,0.07) 0%, transparent 45%), radial-gradient(ellipse at 85% 90%, rgba(52,120,219,0.07) 0%, transparent 45%)",
      fontFamily: "'DM Sans', sans-serif",
      color: "#eef2f7",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, textarea, select { color-scheme: dark; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e3347; border-radius: 3px; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes toastIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fabPulse { 0%, 100% { box-shadow: 0 6px 24px rgba(52,199,120,0.35); } 50% { box-shadow: 0 6px 32px rgba(52,199,120,0.55); } }

        /* ── BASE CLASSES ──────────────────────────── */
        .header-inner { max-width: 1320px; margin: 0 auto; padding: 0 32px; height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .header-subtitle { display: block; }
        .header-submit-btn { display: flex; }
        .submit-btn-label { display: inline; }
        .mobile-fab { display: none !important; }
        .dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .form-modal-inner { background: #0f1e2e; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 36px; width: 100%; max-width: 540px; max-height: 90vh; overflow-y: auto; box-shadow: 0 32px 80px rgba(0,0,0,0.6); animation: slideUp 0.3s ease; }
        .name-neighborhood-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .main-padding { max-width: 1320px; margin: 0 auto; padding: 32px 32px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 28px; }
        .filter-select { background: rgba(10,20,32,0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px 12px; color: #eef2f7; font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none; cursor: pointer; flex: 1 1 auto; min-width: 0; }
        .export-row { display: flex; gap: 12px; align-items: center; }
        .export-cat-tag { display: inline-flex; }

        /* ── TABLET ≤768px ─────────────────────────── */
        @media (max-width: 768px) {
          .header-inner { padding: 0 16px; height: 58px; gap: 10px; }
          .dashboard-grid { grid-template-columns: 1fr; }
          .main-padding { padding: 24px 16px; }
          .stats-grid { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
        }

        /* ── MOBILE ≤640px ─────────────────────────── */
        @media (max-width: 640px) {
          .header-inner { padding: 0 14px; height: 56px; gap: 8px; }
          .header-subtitle { display: none; }
          .header-submit-btn { display: none !important; }
          .submit-btn-label { display: none; }
          .mobile-fab { display: flex !important; }
          .form-modal-inner { padding: 24px 18px; border-radius: 18px; }
          .name-neighborhood-grid { grid-template-columns: 1fr; }
          .main-padding { padding: 20px 12px; padding-bottom: 90px; }
          .stats-grid { grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 8px; margin-bottom: 20px; }
          .filters-bar { flex-direction: column !important; gap: 8px !important; }
          .filter-select { width: 100%; flex: unset; }
          .export-row { flex-wrap: wrap; gap: 8px; }
          .export-cat-tag { display: none; }
        }

        /* ── SMALL MOBILE ≤480px ───────────────────── */
        @media (max-width: 480px) {
          .header-inner { height: 52px; padding: 0 12px; }
          .idea-card { padding: 14px !important; gap: 10px !important; }
          .vote-btn { padding: 8px 10px !important; min-width: 44px !important; }
          .filters-bar { padding: 10px !important; border-radius: 10px !important; }
          .form-modal-inner { padding: 20px 14px; border-radius: 14px; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .main-padding { padding: 16px 10px; padding-bottom: 90px; }
        }

        /* ── VERY SMALL ≤360px ─────────────────────── */
        @media (max-width: 360px) {
          .stats-grid { grid-template-columns: 1fr 1fr; gap: 6px; }
          .idea-card { padding: 12px !important; gap: 8px !important; border-radius: 12px !important; }
          .vote-btn { padding: 6px 8px !important; min-width: 40px !important; border-radius: 8px !important; }
        }
      `}</style>

      {/* TOAST */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 2000,
          background: "#0f1e2e", border: "1px solid rgba(52,199,120,0.4)",
          color: "#34c778", padding: "12px 20px", borderRadius: 12,
          fontSize: 14, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          animation: "toastIn 0.3s ease",
        }}>{toast}</div>
      )}

      {/* FORM MODAL */}
      {showForm && <SubmitForm onSubmit={handleSubmit} onClose={() => setShowForm(false)} />}

      {/* HEADER */}
      <header style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(6,14,24,0.9)", backdropFilter: "blur(20px)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div className="header-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <img src={logoUrl} alt="CityVoice Logo" style={{
              width: 36, height: 36, borderRadius: 10,
              objectFit: "cover", flexShrink: 0,
            }} />
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 16, letterSpacing: "-0.3px", lineHeight: 1 }}>CityVoice</div>
              <div className="header-subtitle" style={{ fontSize: 10, color: "#4a6278", fontWeight: 500, letterSpacing: "0.5px" }}>URBAN PLANNING PLATFORM</div>
            </div>
          </div>

          <nav style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4 }}>
            {[["board", "Board"], ["dashboard", "Dashboard"]].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: "6px 14px", borderRadius: 7, border: "none",
                background: view === v ? "rgba(52,199,120,0.15)" : "transparent",
                color: view === v ? "#34c778" : "#5a7285",
                cursor: "pointer", fontSize: 13, fontWeight: view === v ? 700 : 500,
                transition: "all 0.2s", whiteSpace: "nowrap",
              }}>{l}</button>
            ))}
          </nav>

          <button className="header-submit-btn" onClick={() => setShowForm(true)} style={{
            alignItems: "center", gap: 6,
            background: "linear-gradient(135deg, #34c778, #1a9e56)",
            border: "none", color: "#fff", padding: "9px 16px", borderRadius: 10,
            cursor: "pointer", fontFamily: "'Syne',sans-serif",
            fontSize: 13, fontWeight: 800, letterSpacing: "0.3px",
            boxShadow: "0 4px 16px rgba(52,199,120,0.25)",
            transition: "transform 0.2s, box-shadow 0.2s", flexShrink: 0,
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(52,199,120,0.35)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 16px rgba(52,199,120,0.25)"; }}
          >
            <span style={{ fontSize: 16 }}>+</span> <span className="submit-btn-label">Submit</span>
          </button>
        </div>
      </header>

      {/* MOBILE FLOATING ACTION BUTTON */}
      <button className="mobile-fab" onClick={() => setShowForm(true)} style={{
        position: "fixed", bottom: 24, right: 20, zIndex: 99,
        width: 56, height: 56, borderRadius: "50%",
        background: "linear-gradient(135deg, #34c778, #1a9e56)",
        border: "none", color: "#fff",
        alignItems: "center", justifyContent: "center",
        cursor: "pointer", fontSize: 28, fontWeight: 300,
        boxShadow: "0 6px 24px rgba(52,199,120,0.35)",
        animation: "fabPulse 3s ease-in-out infinite",
      }}>
        +
      </button>

      <main className="main-padding">

        {/* ── BOARD VIEW ── */}
        {view === "board" && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            {/* Hero */}
            <div style={{ marginBottom: 36, textAlign: "center" }}>
              <h1 style={{
                fontFamily: "'Syne',sans-serif", fontWeight: 900,
                fontSize: "clamp(2rem, 5vw, 3rem)", letterSpacing: "-1px",
                lineHeight: 1.1, marginBottom: 12,
                background: "linear-gradient(135deg, #eef2f7 40%, #34c778)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                Your City, Your Voice
              </h1>
              <p style={{ color: "#5a7285", fontSize: 15, maxWidth: 480, margin: "0 auto" }}>
                Submit problems, ideas, and improvements for urban planning. Upvote what matters most to shape project priorities.
              </p>
            </div>

            {/* Stats */}
            {ideas.length > 0 && <StatsBar ideas={ideas} />}

            {/* Filters */}
            <div className="filters-bar" style={{
              display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20,
              background: "rgba(20,32,48,0.6)", borderRadius: 14, padding: 12,
              border: "1px solid rgba(255,255,255,0.06)",
            }}>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="🔍  Search submissions…"
                style={{
                  background: "rgba(10,20,32,0.8)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8, padding: "8px 14px", color: "#eef2f7",
                  fontFamily: "'DM Sans',sans-serif", fontSize: 13, outline: "none",
                  flex: "1 1 180px", minWidth: 0,
                }}
              />
              <select className="filter-select" value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}>
                <option value="all">All Types</option>
                {TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}s</option>)}
              </select>
              <select className="filter-select" value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}>
                <option value="all">All Categories</option>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
              <select className="filter-select" value={filter.sort} onChange={e => setFilter(f => ({ ...f, sort: e.target.value }))}>
                <option value="votes">↑ Top Voted</option>
                <option value="new">🕒 Newest</option>
              </select>
            </div>

            {/* Cards */}
            {loading ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#3a5168", fontSize: 14 }}>Loading submissions…</div>
            ) : filtered.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "80px 20px",
                background: "rgba(20,32,48,0.4)", borderRadius: 20,
                border: "1px dashed rgba(255,255,255,0.06)",
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🏙️</div>
                <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, color: "#eef2f7", marginBottom: 8 }}>
                  {ideas.length === 0 ? "Be the first to submit!" : "No matching results"}
                </h3>
                <p style={{ color: "#4a6278", fontSize: 14, marginBottom: 24 }}>
                  {ideas.length === 0 ? "Share a problem, idea, or improvement for your city." : "Try a different filter or search term."}
                </p>
                {ideas.length === 0 && (
                  <button onClick={() => setShowForm(true)} style={{
                    background: "linear-gradient(135deg, #34c778, #1a9e56)",
                    border: "none", color: "#fff", padding: "12px 28px",
                    borderRadius: 10, cursor: "pointer", fontFamily: "'Syne',sans-serif",
                    fontSize: 14, fontWeight: 800,
                  }}>+ Submit First Idea</button>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filtered.map(idea => (
                  <IdeaCard key={idea.id} idea={idea} onUpvote={handleUpvote} hasVoted={votedIds.includes(idea.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── DASHBOARD VIEW ── */}
        {view === "dashboard" && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: "-0.5px", marginBottom: 6 }}>
                Project Dashboard
              </h2>
              <p style={{ color: "#5a7285", fontSize: 14 }}>Insights to help you decide which urban planning projects to prioritize.</p>
            </div>

            {ideas.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#3a5168", fontSize: 15 }}>
                No data yet. Submissions will appear here once collected.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 20 }}>
                {/* Stats overview */}
                <StatsBar ideas={ideas} />

                {/* Two columns */}
                <div className="dashboard-grid">

                  {/* Top voted */}
                  <div style={{
                    background: "rgba(20,32,48,0.7)", border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 18, padding: 24,
                  }}>
                    <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, marginBottom: 18, color: "#eef2f7" }}>
                      🏆 Top Voted Ideas
                    </h3>
                    {topIdeas.length === 0 ? <p style={{ color: "#3a5168", fontSize: 13 }}>No submissions yet.</p> :
                      topIdeas.map((idea, i) => (
                        <div key={idea.id} style={{
                          display: "flex", gap: 12, alignItems: "flex-start",
                          paddingBottom: 14, marginBottom: 14,
                          borderBottom: i < topIdeas.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                        }}>
                          <span style={{
                            fontFamily: "'Syne',sans-serif", fontWeight: 900,
                            fontSize: 22, color: i === 0 ? "#f4d03f" : i === 1 ? "#bdc3c7" : i === 2 ? "#cd7f32" : "#3a5168",
                            minWidth: 32, lineHeight: 1,
                          }}>#{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#eef2f7", marginBottom: 4, lineHeight: 1.3 }}>{idea.title}</p>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <TypeBadge type={idea.type} />
                              <span style={{ fontSize: 12, color: "#34c778", fontWeight: 700 }}>▲ {idea.votes}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    }
                  </div>

                  {/* Category breakdown */}
                  <div style={{
                    background: "rgba(20,32,48,0.7)", border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 18, padding: 24,
                  }}>
                    <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, marginBottom: 18, color: "#eef2f7" }}>
                      📊 By Category
                    </h3>
                    {catStats.filter(c => c.count > 0).length === 0
                      ? <p style={{ color: "#3a5168", fontSize: 13 }}>No data yet.</p>
                      : catStats.filter(c => c.count > 0).map(c => (
                        <div key={c.id} style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                            <span style={{ fontSize: 12, color: "#a0b4c8", fontWeight: 500 }}>{c.icon} {c.label}</span>
                            <span style={{ fontSize: 12, color: "#5a7285" }}>{c.count} · ▲{c.votes}</span>
                          </div>
                          <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{
                              height: "100%", borderRadius: 3,
                              width: `${(c.count / maxCatCount) * 100}%`,
                              background: "linear-gradient(90deg, #34c778, #1a9e56)",
                              transition: "width 0.8s ease",
                            }} />
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>

                {/* All data export */}
                <div style={{
                  background: "rgba(20,32,48,0.7)", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 18, padding: 24,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, color: "#eef2f7" }}>📋 All Submissions</h3>
                    <button onClick={() => {
                      const csv = ["Title,Type,Category,Neighborhood,Votes,Submitted By,Date",
                        ...ideas.map(i => `"${i.title}",${i.type},${i.category},"${i.neighborhood || ''}",${i.votes},"${i.name || ''}","${new Date(i.timestamp).toLocaleDateString()}"`)
                      ].join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = "urban-planning-submissions.csv";
                      a.click();
                    }} style={{
                      background: "rgba(52,199,120,0.1)", border: "1px solid rgba(52,199,120,0.3)",
                      color: "#34c778", padding: "8px 16px", borderRadius: 8,
                      cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'Syne',sans-serif",
                    }}>⬇ Export CSV</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[...ideas].sort((a, b) => b.votes - a.votes).map(idea => (
                      <div key={idea.id} className="export-row" style={{
                        background: "rgba(10,20,32,0.5)", borderRadius: 10, padding: "10px 14px",
                        fontSize: 13, flexWrap: "wrap",
                      }}>
                        <TypeBadge type={idea.type} />
                        <span style={{ flex: 1, color: "#eef2f7", fontWeight: 500, minWidth: 0 }}>{idea.title}</span>
                        <span className="export-cat-tag"><CategoryTag catId={idea.category} /></span>
                        <span style={{ color: "#34c778", fontWeight: 800, fontSize: 13, minWidth: 32, textAlign: "right" }}>▲{idea.votes}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}