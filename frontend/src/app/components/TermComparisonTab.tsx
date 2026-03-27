import { useState } from "react";
import { motion } from "motion/react";
import { Post, ALGOSPEAK_TERMS, nodeColor } from "./mockData";

interface Props {
  posts: Post[];
}

function termStats(posts: Post[], term: string) {
  const matched = posts.filter(p =>
    p.query_term === term || p.text.toLowerCase().includes(term)
  );
  if (!matched.length) return null;
  const scores = matched.map(p => p.score);
  const toxicN = matched.filter(p => p.label === "toxic").length;
  return {
    count: matched.length,
    toxicRate: (toxicN / matched.length) * 100,
    avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    maxScore: Math.max(...scores),
    posts: matched,
  };
}

const BIN_LABELS = ["0-0.2", "0.2-0.4", "0.4-0.6", "0.6-0.8", "0.8-1.0"];

function binPosts(posts: Post[]) {
  const bins = [0, 0, 0, 0, 0];
  for (const p of posts) {
    const idx = Math.min(4, Math.floor(p.score / 0.2));
    bins[idx]++;
  }
  return bins;
}

export function TermComparisonTab({ posts }: Props) {
  const [termA, setTermA] = useState(ALGOSPEAK_TERMS[0]);
  const [termB, setTermB] = useState(ALGOSPEAK_TERMS[1]);
  const [hovered, setHovered] = useState<{ binIdx: number; series: "a" | "b" } | null>(null);

  const sA = termStats(posts, termA);
  const sB = termStats(posts, termB);

  const selectStyle: React.CSSProperties = {
    background: "#141826",
    border: "1px solid #1e2540",
    borderRadius: 8,
    padding: "6px 10px",
    color: "#e8eaf0",
    fontSize: "0.83rem",
    width: "100%",
    cursor: "pointer",
  };

  const compData = BIN_LABELS.map((label, i) => ({
    label,
    a: sA ? binPosts(sA.posts)[i] : 0,
    b: sB ? binPosts(sB.posts)[i] : 0,
  }));

  return (
    <div style={{ padding: "1.2rem 1.4rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ color: "#5a6080", fontSize: "0.82rem" }}
      >
        Select two algospeak terms to compare their toxicity profiles from all stored posts.
      </motion.div>

      {/* Term selectors */}
      <div style={{ display: "flex", gap: "1rem" }}>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
          style={{ flex: 1 }}
        >
          <div style={{ fontSize: "0.68rem", color: "#5a6080", marginBottom: 5 }}>Term A</div>
          <select value={termA} onChange={e => setTermA(e.target.value)} style={selectStyle}>
            {ALGOSPEAK_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          style={{ flex: 1 }}
        >
          <div style={{ fontSize: "0.68rem", color: "#5a6080", marginBottom: 5 }}>Term B</div>
          <select value={termB} onChange={e => setTermB(e.target.value)} style={selectStyle}>
            {ALGOSPEAK_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </motion.div>
      </div>

      {termA === termB && (
        <div style={{
          background: "rgba(255,159,67,0.08)",
          border: "1px solid rgba(255,159,67,0.2)",
          borderRadius: 8,
          padding: "0.6rem 1rem",
          color: "#ff9f43",
          fontSize: "0.8rem",
        }}>
          Select two different terms to compare.
        </div>
      )}

      {termA !== termB && (
        <>
          {/* Stat cards */}
          <div style={{ display: "flex", gap: "1rem" }}>
            {[
              { term: termA, stats: sA, color: "#a6b0ff" },
              { term: termB, stats: sB, color: "#ff8c42" },
            ].map(({ term, stats, color }, idx) => (
              <motion.div
                key={term}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 + 0.15 }}
                style={{
                  flex: 1,
                  background: "#0d1120",
                  border: "1px solid #1e2540",
                  borderRadius: 10,
                  padding: "0.9rem 1rem",
                }}
              >
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#e8eaf0", marginBottom: "0.6rem" }}>
                  &ldquo;{term}&rdquo;
                </div>
                {!stats ? (
                  <div style={{ color: "#5a6080", fontSize: "0.8rem" }}>No data — fetch more posts first.</div>
                ) : (
                  <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                    {[
                      { label: "Posts", value: String(stats.count), valueColor: color },
                      { label: "Toxic rate", value: `${stats.toxicRate.toFixed(1)}%`, valueColor: nodeColor(stats.toxicRate / 100) },
                      { label: "Avg score", value: stats.avgScore.toFixed(3), valueColor: nodeColor(stats.avgScore) },
                      { label: "Max score", value: stats.maxScore.toFixed(3), valueColor: "#ff4b4b" },
                    ].map(({ label, value, valueColor }) => (
                      <div key={label}>
                        <div style={{ fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "1px", color: "#3a4060", marginBottom: 4 }}>
                          {label}
                        </div>
                        <div style={{ fontSize: "1.25rem", fontWeight: 700, color: valueColor }}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Comparison chart — custom div-based with enhanced visuals */}
          {sA && sB && (() => {
            const binsA = binPosts(sA.posts);
            const binsB = binPosts(sB.posts);
            const maxVal = Math.max(...binsA, ...binsB, 1);
            const gridLines = [0.25, 0.5, 0.75, 1.0];
            return (
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                style={{
                  background: "#0d1120",
                  border: "1px solid #1e2540",
                  borderRadius: 10,
                  padding: "1rem 1.1rem 0.8rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#e8eaf0" }}>
                    Score distribution comparison
                  </div>
                  {/* Legend */}
                  <div style={{ display: "flex", gap: "1rem" }}>
                    {[{ label: termA, color: "#a6b0ff", glow: "rgba(166,176,255,0.4)" }, { label: termB, color: "#ff8c42", glow: "rgba(255,140,66,0.4)" }].map(({ label, color, glow }) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.72rem", color: "#8a90ad" }}>
                        <div style={{
                          width: 10, height: 10, borderRadius: 2,
                          background: color,
                          boxShadow: `0 0 6px ${glow}`,
                        }} />
                        {label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chart wrapper with y-axis */}
                <div style={{ display: "flex", gap: 6 }}>
                  {/* Y-axis labels */}
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end", height: 180, paddingBottom: 18, paddingTop: 2 }}>
                    {[maxVal, Math.round(maxVal * 0.75), Math.round(maxVal * 0.5), Math.round(maxVal * 0.25), 0].map((v, i) => (
                      <div key={i} style={{ fontSize: 9, color: "#3a4060", lineHeight: 1 }}>{v}</div>
                    ))}
                  </div>

                  {/* Chart area */}
                  <div style={{ flex: 1, position: "relative" }}>
                    {/* Grid lines */}
                    <div style={{ position: "absolute", inset: "0 0 18px 0", display: "flex", flexDirection: "column", justifyContent: "space-between", pointerEvents: "none" }}>
                      {gridLines.map((_, i) => (
                        <div key={i} style={{ height: 1, background: "rgba(30,37,64,0.8)", width: "100%" }} />
                      ))}
                      <div style={{ height: 1, background: "#1e2540", width: "100%" }} />
                    </div>

                    {/* Bars */}
                    <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", height: 162, padding: "0 2px" }}>
                      {BIN_LABELS.map((label, i) => (
                        <div key={`bin-group-${i}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0, height: "100%" }}>
                          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 2, width: "100%" }}>
                            {/* Bar A */}
                            <div
                              style={{ flex: 1, display: "flex", alignItems: "flex-end", height: "100%", cursor: "pointer" }}
                              onMouseEnter={() => setHovered({ binIdx: i, series: "a" })}
                              onMouseLeave={() => setHovered(null)}
                            >
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${(binsA[i] / maxVal) * 100}%` }}
                                transition={{ delay: 0.35 + i * 0.04, duration: 0.55, ease: "easeOut" }}
                                style={{
                                  width: "100%",
                                  background: "linear-gradient(180deg, #c0c8ff 0%, #7080e8 100%)",
                                  opacity: hovered && hovered.binIdx === i && hovered.series === "a" ? 1 : 0.82,
                                  borderRadius: "3px 3px 0 0",
                                  minHeight: binsA[i] > 0 ? 3 : 0,
                                  position: "relative",
                                  boxShadow: hovered?.binIdx === i && hovered?.series === "a"
                                    ? "0 0 12px rgba(166,176,255,0.6)"
                                    : "none",
                                  transition: "box-shadow 0.15s, opacity 0.15s",
                                }}
                              >
                                {hovered?.binIdx === i && hovered?.series === "a" && (
                                  <div style={{
                                    position: "absolute", bottom: "calc(100% + 5px)", left: "50%", transform: "translateX(-50%)",
                                    background: "#1a2038", border: "1px solid #2e3a5e", borderRadius: 5,
                                    padding: "4px 8px", fontSize: 10, color: "#a6b0ff", whiteSpace: "nowrap", zIndex: 10,
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                                  }}>
                                    <span style={{ fontWeight: 700 }}>{termA}</span>: {binsA[i]}
                                  </div>
                                )}
                              </motion.div>
                            </div>
                            {/* Bar B */}
                            <div
                              style={{ flex: 1, display: "flex", alignItems: "flex-end", height: "100%", cursor: "pointer" }}
                              onMouseEnter={() => setHovered({ binIdx: i, series: "b" })}
                              onMouseLeave={() => setHovered(null)}
                            >
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${(binsB[i] / maxVal) * 100}%` }}
                                transition={{ delay: 0.38 + i * 0.04, duration: 0.55, ease: "easeOut" }}
                                style={{
                                  width: "100%",
                                  background: "linear-gradient(180deg, #ffa96a 0%, #e06820 100%)",
                                  opacity: hovered && hovered.binIdx === i && hovered.series === "b" ? 1 : 0.82,
                                  borderRadius: "3px 3px 0 0",
                                  minHeight: binsB[i] > 0 ? 3 : 0,
                                  position: "relative",
                                  boxShadow: hovered?.binIdx === i && hovered?.series === "b"
                                    ? "0 0 12px rgba(255,140,66,0.6)"
                                    : "none",
                                  transition: "box-shadow 0.15s, opacity 0.15s",
                                }}
                              >
                                {hovered?.binIdx === i && hovered?.series === "b" && (
                                  <div style={{
                                    position: "absolute", bottom: "calc(100% + 5px)", left: "50%", transform: "translateX(-50%)",
                                    background: "#1a2038", border: "1px solid #2e3a5e", borderRadius: 5,
                                    padding: "4px 8px", fontSize: 10, color: "#ff8c42", whiteSpace: "nowrap", zIndex: 10,
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                                  }}>
                                    <span style={{ fontWeight: 700 }}>{termB}</span>: {binsB[i]}
                                  </div>
                                )}
                              </motion.div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Baseline */}
                    <div style={{ height: 1, background: "#1e2540" }} />

                    {/* X-axis labels */}
                    <div style={{ display: "flex", gap: "0.5rem", padding: "4px 2px 0" }}>
                      {BIN_LABELS.map((label, i) => (
                        <div key={i} style={{ flex: 1, fontSize: 9, color: "#4a5070", textAlign: "center" }}>{label}</div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* X-axis title */}
                <div style={{ textAlign: "center", fontSize: "0.65rem", color: "#3a4060", marginTop: "0.35rem", letterSpacing: "0.5px" }}>
                  Toxicity score range
                </div>
              </motion.div>
            );
          })()}

          {/* Per-term bar comparisons */}
          {sA && sB && (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38 }}
              style={{
                background: "#0d1120",
                border: "1px solid #1e2540",
                borderRadius: 10,
                padding: "0.9rem 1rem",
              }}
            >
              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#e8eaf0", marginBottom: "1rem" }}>
                Key metrics at a glance
              </div>
              {[
                { label: "Toxic rate (%)", a: sA.toxicRate, b: sB.toxicRate, max: 100, colorA: "#a6b0ff", colorB: "#ff8c42" },
                { label: "Avg score", a: sA.avgScore * 100, b: sB.avgScore * 100, max: 100, colorA: "#a6b0ff", colorB: "#ff8c42" },
              ].map(({ label, a, b, max, colorA, colorB }) => (
                <div key={label} style={{ marginBottom: "0.8rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: "0.72rem", color: "#5a6080" }}>{label}</span>
                    <span style={{ fontSize: "0.72rem", color: "#5a6080" }}>
                      <span style={{ color: colorA }}>{termA}: {a.toFixed(1)}</span>
                      {" vs "}
                      <span style={{ color: colorB }}>{termB}: {b.toFixed(1)}</span>
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {[{ pct: a / max * 100, color: colorA }, { pct: b / max * 100, color: colorB }].map((bar, bi) => (
                      <div key={bi} style={{ background: "#1a1f35", borderRadius: 4, height: 6, overflow: "hidden" }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${bar.pct}%` }}
                          transition={{ delay: 0.4 + bi * 0.07, duration: 0.6, ease: "easeOut" }}
                          style={{ height: "100%", background: bar.color, borderRadius: 4 }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}