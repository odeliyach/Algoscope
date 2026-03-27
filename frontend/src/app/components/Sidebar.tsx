import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { ALGOSPEAK_TERMS, Post, nodeColor } from "./mockData";

interface SidebarProps {
  open: boolean;
  selectedTerms: string[];
  setSelectedTerms: (terms: string[]) => void;
  threshold: number;
  setThreshold: (v: number) => void;
  sampling: number;
  setSampling: (v: number) => void;
  autoRefresh: boolean;
  setAutoRefresh: (v: boolean) => void;
  onFetch: () => void;
  posts: Post[];
  fetching: boolean;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: "0.58rem",
      textTransform: "uppercase",
      letterSpacing: "1.4px",
      color: "#3a4060",
      marginTop: "1rem",
      marginBottom: "0.35rem",
    }}>
      {children}
    </div>
  );
}

export function Sidebar({
  open,
  selectedTerms,
  setSelectedTerms,
  threshold,
  setThreshold,
  sampling,
  setSampling,
  autoRefresh,
  setAutoRefresh,
  onFetch,
  posts,
  fetching,
}: SidebarProps) {
  const [customInput, setCustomInput] = useState("");
  const [customTerms, setCustomTerms] = useState<string[]>([]);

  const addCustom = () => {
    const t = customInput.trim().toLowerCase();
    if (!t) return;
    if (!customTerms.includes(t)) setCustomTerms(prev => [...prev, t]);
    if (!selectedTerms.includes(t)) setSelectedTerms([...selectedTerms, t]);
    setCustomInput("");
  };

  // Compute toxic ratio per selected term from posts
  const termRatio: Record<string, number> = {};
  for (const term of selectedTerms) {
    const matching = posts.filter(p => p.query_term === term || p.text.toLowerCase().includes(term));
    if (matching.length === 0) { termRatio[term] = Math.random() * 0.8; continue; }
    termRatio[term] = matching.filter(p => p.label === "toxic").length / matching.length;
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="sidebar"
          initial={{ x: -260, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -260, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 30 }}
          style={{
            width: 240,
            minWidth: 240,
            background: "#0d1120",
            borderRight: "1px solid #1e2540",
            padding: "1rem 0.85rem 1.5rem",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {/* Tracked terms */}
          <SectionLabel>Tracked terms</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
            {selectedTerms.slice(0, 6).map(term => {
              const pct = Math.round((termRatio[term] ?? 0) * 100);
              const color = nodeColor(termRatio[term] ?? 0);
              return (
                <motion.div
                  key={term}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#141826",
                    border: "1px solid #1e2540",
                    borderRadius: 8,
                    padding: "5px 9px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: "0.78rem", color: "#c8cce0" }}>{term}</span>
                  </div>
                  <span style={{ fontSize: "0.68rem", color: "#3a4060" }}>{pct}%</span>
                </motion.div>
              );
            })}
          </div>

          {/* Algospeak terms multiselect */}
          <SectionLabel>Algospeak terms</SectionLabel>
          <div style={{
            background: "#141826",
            border: "1px solid #1e2540",
            borderRadius: 8,
            padding: "6px",
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            maxHeight: 160,
            overflowY: "auto",
            flexShrink: 0,
          }}>
            {[...ALGOSPEAK_TERMS, ...customTerms].map(t => {
              const selected = selectedTerms.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => {
                    setSelectedTerms(
                      selected
                        ? selectedTerms.filter(s => s !== t)
                        : [...selectedTerms, t]
                    );
                  }}
                  style={{
                    padding: "2px 6px 2px 8px",
                    borderRadius: 999,
                    fontSize: "0.68rem",
                    cursor: "pointer",
                    border: "1px solid",
                    transition: "all 0.15s",
                    background: selected ? "rgba(155,127,212,0.18)" : "transparent",
                    borderColor: selected ? "rgba(155,127,212,0.5)" : "#2a3050",
                    color: selected ? "#c3a6ff" : "#5a6080",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {t}
                  {selected && (
                    <span
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedTerms(selectedTerms.filter(s => s !== t));
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: "rgba(155,127,212,0.3)",
                        color: "#c3a6ff",
                        fontSize: "0.6rem",
                        lineHeight: 1,
                        flexShrink: 0,
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom term input */}
          <SectionLabel>Add custom term</SectionLabel>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <input
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addCustom()}
              placeholder="Type a term..."
              style={{
                flex: 1,
                background: "#141826",
                border: "1px solid #1e2540",
                borderRadius: 7,
                padding: "5px 9px",
                color: "#e8eaf0",
                fontSize: "0.78rem",
                outline: "none",
              }}
            />
          </div>
          <button
            onClick={addCustom}
            style={{
              marginTop: 6,
              width: "100%",
              background: "rgba(155,127,212,0.12)",
              border: "1px solid rgba(155,127,212,0.3)",
              borderRadius: 7,
              color: "#c3a6ff",
              fontSize: "0.78rem",
              padding: "5px 0",
              cursor: "pointer",
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            + Add term
          </button>

          {/* Threshold slider */}
          <SectionLabel>Threshold</SectionLabel>
          <div style={{ paddingInline: 2, flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
              <span style={{ fontSize: "0.72rem", color: "#ff6b3d", fontWeight: 700 }}>
                {threshold.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0} max={1} step={0.05}
              value={threshold}
              onChange={e => setThreshold(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "#ff4b4b" }}
            />
          </div>

          {/* Sampling slider */}
          <SectionLabel>Sampling</SectionLabel>
          <div style={{ paddingInline: 2, flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
              <span style={{ fontSize: "0.72rem", color: "#ff6b3d", fontWeight: 700 }}>{sampling}</span>
            </div>
            <input
              type="range"
              min={5} max={100} step={5}
              value={sampling}
              onChange={e => setSampling(parseInt(e.target.value))}
              style={{ width: "100%", accentColor: "#ff4b4b" }}
            />
          </div>

          {/* Fetch section */}
          <SectionLabel>Fetch</SectionLabel>
          <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", marginBottom: 10, flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              style={{ accentColor: "#ff4b4b" }}
            />
            <span style={{ fontSize: "0.78rem", color: "#8a90ad" }}>Auto-refresh (60s)</span>
          </label>

          <motion.button
            onClick={onFetch}
            disabled={fetching}
            whileHover={{ scale: fetching ? 1 : 1.02 }}
            whileTap={{ scale: fetching ? 1 : 0.97 }}
            style={{
              width: "100%",
              background: fetching
                ? "linear-gradient(135deg, #aa3333, #aa5f2a)"
                : "linear-gradient(135deg, #ff4b4b, #ff8c42)",
              color: "#fff",
              border: "none",
              borderRadius: 9,
              padding: "9px 0",
              fontWeight: 700,
              fontSize: "0.88rem",
              cursor: fetching ? "not-allowed" : "pointer",
              boxShadow: fetching ? "none" : "0 0 16px rgba(255,75,75,0.3)",
              transition: "box-shadow 0.2s",
              flexShrink: 0,
            }}
          >
            {fetching ? "Fetching…" : "Fetch & Analyze"}
          </motion.button>

          {/* Custom terms pills at bottom */}
          {customTerms.length > 0 && (
            <div style={{ marginTop: "0.8rem", display: "flex", flexWrap: "wrap", gap: 4, flexShrink: 0 }}>
              {customTerms.map(t => (
                <span
                  key={t}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    padding: "2px 7px",
                    borderRadius: 999,
                    background: "rgba(155,127,212,0.1)",
                    border: "1px solid rgba(155,127,212,0.4)",
                    color: "#c3a6ff",
                    fontSize: "0.65rem",
                  }}
                >
                  {t}
                  <X
                    size={10}
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      setCustomTerms(prev => prev.filter(x => x !== t));
                      setSelectedTerms(selectedTerms.filter(x => x !== t));
                    }}
                  />
                </span>
              ))}
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}