import { useMemo, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Post } from "./mockData";

interface OverviewTabProps {
  posts: Post[];
  batchPosts: Post[];
  selectedTerms: string[];
  justFetched: boolean;
}

// ── Animated counter hook ──────────────────────────────────────────────────────
function useAnimatedNumber(target: number, duration = 900): number {
  const [current, setCurrent] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const from = fromRef.current;
    startRef.current = null;
    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(from + (target - from) * ease));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return current;
}

function useAnimatedFloat(target: number, duration = 900, decimals = 1): string {
  const [current, setCurrent] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const from = fromRef.current;
    startRef.current = null;
    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCurrent(from + (target - from) * ease);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return current.toFixed(decimals);
}

// ── Metric card ────────────────────────────────────────────────────────────────
function MetricCard({
  label, displayValue, sub, subIcon, subColor, subBg, valueColor, delay, isAlert,
}: {
  label: string;
  displayValue?: string;
  sub: string;
  subIcon?: string;
  subColor?: string;
  subBg?: string;
  valueColor: string;
  delay: number;
  isAlert?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: "easeOut" }}
      style={{
        background: isAlert ? "rgba(255,75,75,0.06)" : "#0d1120",
        border: isAlert ? "1px solid rgba(255,75,75,0.3)" : "1px solid #1e2540",
        borderRadius: 10,
        padding: "0.8rem 1rem",
        flex: 1,
        minWidth: 0,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {isAlert && (
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{
            position: "absolute", top: 0, left: 0,
            width: "100%", height: 2,
            background: "linear-gradient(90deg, transparent, #ff4b4b, transparent)",
          }}
        />
      )}
      <div style={{ fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "1px", color: "#3a4060", marginBottom: "0.35rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.45rem", fontWeight: 700, color: valueColor, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
        {displayValue}
      </div>
      {/* Styled sub badge */}
      <motion.div
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: delay + 0.25, duration: 0.35 }}
        style={{
          marginTop: "0.4rem",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 7px 2px 5px",
          borderRadius: 999,
          background: subBg ?? "rgba(90,96,128,0.12)",
          border: `1px solid ${subColor ? subColor + "30" : "#2a3050"}`,
          maxWidth: "100%",
        }}
      >
        {subIcon && (
          <span style={{ fontSize: "0.65rem", flexShrink: 0 }}>{subIcon}</span>
        )}
        <span style={{
          fontSize: "0.65rem",
          color: subColor ?? "#6a7090",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontWeight: subColor ? 600 : 400,
        }}>
          {sub}
        </span>
      </motion.div>
    </motion.div>
  );
}

// ── Spike alert banner ─────────────────────────────────────────────────────────
function SpikeAlert({ batchToxicRate, batchCount }: { batchToxicRate: number; batchCount: number }) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { setDismissed(false); }, [Math.floor(batchToxicRate)]);
  if (batchToxicRate < 38 || batchCount === 0 || dismissed) return null;

  const severity = batchToxicRate >= 70 ? "critical" : batchToxicRate >= 55 ? "high" : "elevated";
  const severityColor = severity === "critical" ? "#ff4b4b" : severity === "high" ? "#ff6b3d" : "#ff9f43";
  const severityBg = severity === "critical" ? "rgba(255,75,75,0.08)" : severity === "high" ? "rgba(255,107,61,0.08)" : "rgba(255,159,67,0.08)";
  const severityBorder = severity === "critical" ? "rgba(255,75,75,0.35)" : severity === "high" ? "rgba(255,107,61,0.3)" : "rgba(255,159,67,0.28)";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0, y: -12, height: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          background: severityBg,
          border: `1px solid ${severityBorder}`,
          borderRadius: 9, padding: "0.7rem 1rem",
          display: "flex", alignItems: "center", gap: "0.75rem",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Animated scan line */}
        <motion.div
          animate={{ x: ["-100%", "400%"] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
          style={{
            position: "absolute", top: 0, left: 0,
            width: "30%", height: "100%",
            background: `linear-gradient(90deg, transparent, ${severityColor}10, transparent)`,
            pointerEvents: "none",
          }}
        />
        {/* Pulsing dot */}
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.1, repeat: Infinity }}
          style={{
            width: 10, height: 10, borderRadius: "50%",
            background: severityColor,
            boxShadow: `0 0 12px ${severityColor}cc`,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1 }}>
          <span style={{ color: severityColor, fontWeight: 700, fontSize: "0.82rem" }}>
            ⚠ Toxicity Spike Detected
          </span>
          <span style={{ color: "#9a8060", fontSize: "0.78rem", marginLeft: 8 }}>
            {batchToxicRate.toFixed(1)}% of last {batchCount} posts flagged as toxic
          </span>
          <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, height: 3, background: "#1a1d2e", borderRadius: 2, overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(batchToxicRate, 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{ height: "100%", background: `linear-gradient(90deg, ${severityColor}88, ${severityColor})`, borderRadius: 2 }}
              />
            </div>
            <span style={{ fontSize: "0.65rem", color: severityColor, fontWeight: 700, minWidth: 30 }}>
              {severity.toUpperCase()}
            </span>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          style={{ background: "none", border: "none", color: "#5a4040", cursor: "pointer", fontSize: "1rem", padding: "0 4px", flexShrink: 0 }}
        >✕</button>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Custom SVG area chart (no Recharts) ────────────────────────────────────────
function CustomAreaChart({ data }: { data: { hour: string; value: number | null }[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(400);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) setContainerWidth(e.contentRect.width);
    });
    obs.observe(containerRef.current);
    setContainerWidth(containerRef.current.clientWidth);
    return () => obs.disconnect();
  }, []);

  const W = containerWidth;
  const H = 170;
  const PAD = { top: 12, right: 12, bottom: 28, left: 36 };
  const inner = { w: W - PAD.left - PAD.right, h: H - PAD.top - PAD.bottom };

  // Fill null with 0 so the line is always continuous
  const filled = data.map(d => ({ ...d, value: d.value ?? 0 }));

  const vals = filled.map(d => d.value) as number[];
  const minV = 0;
  const maxV = Math.max(...vals, 0.01);
  const rangeV = maxV - minV || 0.001;

  const [tooltip, setTooltip] = useState<{ x: number; y: number; hour: string; val: number } | null>(null);

  const toX = (i: number) => PAD.left + (i / (filled.length - 1)) * inner.w;
  const toY = (v: number) => PAD.top + inner.h - ((v - minV) / rangeV) * inner.h;

  const linePath = filled.map((d, i) => {
    const x = toX(i); const y = toY(d.value);
    return `${i === 0 ? "M" : "L"} ${x},${y}`;
  }).join(" ");

  const areaPath = `${linePath} L ${toX(filled.length - 1)},${PAD.top + inner.h} L ${toX(0)},${PAD.top + inner.h} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];
  const xLabels = filled.filter((_, i) => i % 4 === 0);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        style={{ display: "block", overflow: "visible", width: "100%" }}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff4b4b" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#ff4b4b" stopOpacity={0.02} />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {yTicks.map(t => {
          const y = PAD.top + inner.h - (t / 1) * inner.h;
          return (
            <g key={`grid-y-${t}`}>
              <line x1={PAD.left} y1={y} x2={PAD.left + inner.w} y2={y} stroke="#1e2540" strokeDasharray="4 4" strokeOpacity={0.7} />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fill="#3a4060" fontSize={9}>{t.toFixed(1)}</text>
            </g>
          );
        })}

        {/* X labels */}
        {xLabels.map(d => {
          const i = filled.indexOf(d);
          return (
            <text key={`xlabel-${d.hour}`} x={toX(i)} y={H - 6} textAnchor="middle" fill="#3a4060" fontSize={9}>{d.hour}</text>
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGrad)" strokeWidth={0} />

        {/* Line */}
        <path d={linePath} fill="none" stroke="#ff4b4b" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" filter="url(#glow)" />

        {/* Interactive dots — only at hours with real data */}
        {data.map((d, i) => {
          if (d.value === null || d.value === 0) return null;
          const x = toX(i); const y = toY(d.value);
          const c = d.value >= 0.7 ? "#ff4b4b" : d.value >= 0.4 ? "#ff8c42" : "#2ecc71";
          return (
            <circle
              key={`dot-${d.hour}`}
              cx={x} cy={y} r={3.5}
              fill={c} stroke="#0a0d14" strokeWidth={1.5}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setTooltip({ x, y, hour: d.hour, val: d.value! })}
            />
          );
        })}

        {/* Tooltip */}
        {tooltip && (
          <g>
            <line x1={tooltip.x} y1={PAD.top} x2={tooltip.x} y2={PAD.top + inner.h} stroke="#ff4b4b" strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.4} />
            <rect x={tooltip.x - 40} y={tooltip.y - 40} width={80} height={32} rx={6} fill="#141826" stroke="#2a3050" strokeWidth={1} />
            <text x={tooltip.x} y={tooltip.y - 26} textAnchor="middle" fill="#8a90ad" fontSize={9}>{tooltip.hour}</text>
            <text x={tooltip.x} y={tooltip.y - 13} textAnchor="middle" fill="#ff6b6b" fontSize={11} fontWeight="bold">{tooltip.val.toFixed(3)}</text>
          </g>
        )}
      </svg>
    </div>
  );
}

// ── Cool Score Distribution Chart ─────────────────────────────────────────────
function CustomScoreBars({ data }: { data: { label: string; count: number; color: string }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const [hovered, setHovered] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const GRADIENTS: [string, string][] = [
    ["#4ade80", "#22c55e"],
    ["#a3e635", "#84cc16"],
    ["#facc15", "#eab308"],
    ["#fb923c", "#f97316"],
    ["#f87171", "#ef4444"],
  ];

  return (
    <div style={{ position: "relative" }}>
      {/* Y grid lines */}
      <div style={{ position: "relative", height: 160, display: "flex", alignItems: "flex-end", gap: 6, padding: "0 2px" }}>
        {/* Grid lines overlay */}
        {[0.25, 0.5, 0.75, 1].map((t, gi) => (
          <div key={gi} style={{
            position: "absolute",
            bottom: `${t * 100}%`,
            left: 0, right: 0,
            height: 1,
            background: "rgba(30,37,64,0.7)",
            pointerEvents: "none",
          }} />
        ))}

        {data.map((d, i) => {
          const heightPct = (d.count / maxCount) * 100;
          const isHov = hovered === i;
          const [colorTop, colorBot] = GRADIENTS[i];
          return (
            <div
              key={`score-bar-${d.label}`}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", position: "relative" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Tooltip */}
              {isHov && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    position: "absolute",
                    bottom: `calc(${heightPct}% + 10px)`,
                    left: "50%", transform: "translateX(-50%)",
                    background: "#141826",
                    border: `1px solid ${colorTop}55`,
                    borderRadius: 6,
                    padding: "3px 8px",
                    fontSize: 10,
                    color: colorTop,
                    whiteSpace: "nowrap",
                    zIndex: 10,
                    fontWeight: 700,
                    boxShadow: `0 0 8px ${colorTop}33`,
                  }}
                >
                  {d.count} posts
                </motion.div>
              )}

              {/* Bar */}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${heightPct}%` }}
                transition={{ delay: 0.3 + i * 0.07, duration: 0.6, ease: [0.34, 1.2, 0.64, 1] }}
                style={{
                  width: "100%",
                  background: `linear-gradient(180deg, ${colorTop} 0%, ${colorBot} 100%)`,
                  borderRadius: "5px 5px 0 0",
                  minHeight: d.count > 0 ? 4 : 0,
                  opacity: hovered === null || isHov ? 1 : 0.4,
                  transition: "opacity 0.2s",
                  boxShadow: isHov ? `0 0 16px ${colorTop}80, 0 0 6px ${colorTop}40` : "none",
                  position: "relative",
                }}
              >
                {/* Shine on top */}
                <div style={{
                  position: "absolute",
                  top: 0, left: 0, right: 0,
                  height: 3,
                  background: `linear-gradient(90deg, transparent, ${colorTop}cc, transparent)`,
                  borderRadius: "5px 5px 0 0",
                }} />
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Baseline */}
      <div style={{ height: 1, background: "#1e2540", margin: "0 2px" }} />

      {/* X labels */}
      <div style={{ display: "flex", gap: 6, padding: "5px 2px 0", marginTop: 2 }}>
        {data.map((d, i) => (
          <div key={i} style={{
            flex: 1,
            fontSize: 8,
            color: hovered === i ? GRADIENTS[i][0] : "#4a5070",
            textAlign: "center",
            transition: "color 0.2s",
            lineHeight: 1.3,
          }}>
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function OverviewTab({ posts, batchPosts, selectedTerms, justFetched }: OverviewTabProps) {
  const totalPosts = posts.length;
  const toxicCount = posts.filter(p => p.label === "toxic").length;
  const toxicRate = totalPosts ? (toxicCount / totalPosts) * 100 : 0;

  // Batch-specific spike detection
  const batchToxicCount = batchPosts.filter(p => p.label === "toxic").length;
  const batchToxicRate = batchPosts.length ? (batchToxicCount / batchPosts.length) * 100 : 0;

  const avgScoreRaw = batchPosts.length
    ? batchPosts.reduce((s, p) => s + p.score, 0) / batchPosts.length
    : 0;

  const termCounts: Record<string, number> = {};
  for (const p of batchPosts) {
    termCounts[p.query_term] = (termCounts[p.query_term] || 0) + 1;
  }
  const topTerm = Object.keys(termCounts).sort((a, b) => termCounts[b] - termCounts[a])[0] || "—";

  const animatedTotal = useAnimatedNumber(totalPosts);
  const animatedToxicRate = useAnimatedFloat(toxicRate, 900, 1);
  const animatedAvg = useAnimatedFloat(avgScoreRaw, 900, 3);

  const timeData = useMemo(() => {
    const buckets: Record<number, { sum: number; count: number }> = {};
    for (const p of posts) {
      const h = new Date(p.created_at).getHours();
      if (!buckets[h]) buckets[h] = { sum: 0, count: 0 };
      buckets[h].sum += p.score;
      buckets[h].count += 1;
    }
    return Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, "0")}:00`,
      value: buckets[h] ? +(buckets[h].sum / buckets[h].count).toFixed(3) : null,
    }));
  }, [posts]);

  const scoreDistData = useMemo(() => {
    const bins = [0, 0, 0, 0, 0];
    for (const p of batchPosts) {
      const idx = Math.min(4, Math.floor(p.score / 0.2));
      bins[idx]++;
    }
    const COLORS = ["#2ecc71", "#a3e635", "#ffeb3b", "#ff8c42", "#ff4b4b"];
    const LABELS = ["0-0.2", "0.2-0.4", "0.4-0.6", "0.6-0.8", "0.8-1.0"];
    return LABELS.map((label, i) => ({ label, count: bins[i], color: COLORS[i] }));
  }, [batchPosts]);

  const heatmapData = useMemo(() => {
    const grid: Record<string, { sum: number; count: number }> = {};
    for (const p of posts) {
      const d = new Date(p.created_at);
      const day = (d.getDay() + 6) % 7;
      const hour = d.getHours();
      const key = `${day}-${hour}`;
      if (!grid[key]) grid[key] = { sum: 0, count: 0 };
      grid[key].sum += p.score;
      grid[key].count += 1;
    }
    return grid;
  }, [posts]);

  const maxHeat = useMemo(() => {
    let mx = 0;
    for (const v of Object.values(heatmapData)) {
      mx = Math.max(mx, v.count ? v.sum / v.count : 0);
    }
    return mx || 1;
  }, [heatmapData]);

  const recentPosts = batchPosts.slice(0, 20);

  return (
    <div style={{ padding: "1.2rem 1.4rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>

      <SpikeAlert batchToxicRate={batchToxicRate} batchCount={batchPosts.length} />

      {/* Metric cards */}
      <div style={{ display: "flex", gap: "0.9rem" }}>
        <MetricCard
          label="Posts analyzed"
          displayValue={String(animatedTotal)}
          sub={`+${batchPosts.length} this batch`}
          subIcon="📥"
          subColor="#4ade80"
          subBg="rgba(74,222,128,0.08)"
          valueColor="#fff"
          delay={0}
        />
        <MetricCard
          label="Toxic rate"
          displayValue={`${animatedToxicRate}%`}
          sub={toxicRate >= 38 ? "↑ High — monitor closely" : "✓ Within expected range"}
          subIcon={toxicRate >= 38 ? "🔴" : undefined}
          subColor={toxicRate >= 38 ? "#ff4b4b" : "#2ecc71"}
          subBg={toxicRate >= 38 ? "rgba(255,75,75,0.1)" : "rgba(46,204,113,0.08)"}
          valueColor="#ff4b4b"
          delay={0.07}
          isAlert={toxicRate >= 38}
        />
        <MetricCard
          label="Avg score (last batch)"
          displayValue={animatedAvg}
          sub="mean toxicity · last fetch"
          subIcon="📊"
          subColor="#ff8c42"
          subBg="rgba(255,140,66,0.08)"
          valueColor="#ff8c42"
          delay={0.14}
        />
        <MetricCard
          label="Top term"
          displayValue={topTerm}
          sub="most frequent · last batch"
          subIcon="🏷️"
          subColor="#9b7fd4"
          subBg="rgba(155,127,212,0.1)"
          valueColor="#9b7fd4"
          delay={0.21}
        />
      </div>

      {/* Charts row */}
      <div style={{ display: "flex", gap: "0.9rem" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.45 }}
          style={{ flex: 3, background: "#0d1120", border: "1px solid #1e2540", borderRadius: 10, padding: "0.9rem 1rem" }}
        >
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#e8eaf0", marginBottom: "0.7rem" }}>Toxicity over time</div>
          <CustomAreaChart data={timeData} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.45 }}
          style={{ flex: 1, background: "#0d1120", border: "1px solid #1e2540", borderRadius: 10, padding: "0.9rem 1rem" }}
        >
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#e8eaf0", marginBottom: "0.7rem" }}>Score distribution</div>
          <CustomScoreBars data={scoreDistData} />
        </motion.div>
      </div>

      {/* Activity heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42, duration: 0.45 }}
        style={{ background: "#0d1120", border: "1px solid #1e2540", borderRadius: 10, padding: "0.9rem 1rem" }}
      >
        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#e8eaf0", marginBottom: "0.8rem" }}>Activity heatmap</div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 4 }}>
            <div style={{ width: 36 }} />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={`hlabel-${h}`} style={{ width: 20, fontSize: "0.52rem", color: "#3a4060", textAlign: "center", userSelect: "none" }}>
                {h % 6 === 0 ? h : ""}
              </div>
            ))}
          </div>
          {DAYS.map((day, d) => (
            <div key={`day-${day}`} style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 2 }}>
              <div style={{ width: 36, fontSize: "0.65rem", color: "#5a6080", textAlign: "right", paddingRight: 6 }}>{day}</div>
              {Array.from({ length: 24 }, (_, h) => {
                const cell = heatmapData[`${d}-${h}`];
                const intensity = cell ? (cell.sum / cell.count) / maxHeat : 0;
                const hasData = cell && cell.count > 0;
                const r = hasData ? Math.round(30 + (255 - 30) * intensity) : 26;
                const g = hasData ? Math.round(37 + (75 - 37) * intensity) : 29;
                const b = hasData ? Math.round(64 + (75 - 64) * intensity) : 46;
                return (
                  <motion.div
                    key={`cell-${day}-${h}`}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (d * 24 + h) * 0.002, duration: 0.25 }}
                    title={hasData ? `${day} ${String(h).padStart(2, "0")}:00 — avg ${(cell.sum / cell.count).toFixed(2)}` : `${day} ${String(h).padStart(2, "0")}:00 — no data`}
                    style={{ width: 20, height: 20, borderRadius: 3, background: `rgb(${r},${g},${b})`, cursor: hasData ? "pointer" : "default" }}
                  />
                );
              })}
            </div>
          ))}
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 7, fontSize: "0.65rem", color: "#5a6080" }}>
            <span>Low</span>
            <div style={{ width: 90, height: 7, borderRadius: 4, background: "linear-gradient(90deg, #1a1d2e, #ff4b4b)" }} />
            <span>High toxicity</span>
          </div>
        </div>
      </motion.div>

      {/* Recent posts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.45 }}
        style={{ background: "#0d1120", border: "1px solid #1e2540", borderRadius: 10, padding: "0.9rem 1rem" }}
      >
        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#e8eaf0", marginBottom: "0.6rem" }}>Recent posts (last batch)</div>
        {recentPosts.length === 0 ? (
          <div style={{ color: "#5a6080", fontSize: "0.8rem", padding: "1rem 0" }}>Click &quot;Fetch &amp; Analyze&quot; to see recent posts.</div>
        ) : (
          <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {recentPosts.map((p, i) => {
              const sc = p.score >= 0.7 ? "#ff4b4b" : p.score >= 0.4 ? "#ff9f43" : "#2ecc71";
              const scBg = p.score >= 0.7 ? "rgba(255,75,75,0.12)" : p.score >= 0.4 ? "rgba(255,159,67,0.12)" : "rgba(46,204,113,0.12)";
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.55rem 0.3rem", borderBottom: "1px solid #141826" }}
                >
                  <div style={{ minWidth: 50, textAlign: "center", fontSize: "0.7rem", fontWeight: 700, borderRadius: 6, padding: "0.2rem 0.3rem", background: scBg, color: sc, flexShrink: 0 }}>
                    {p.score.toFixed(3)}
                  </div>
                  <div style={{ flex: 1, fontSize: "0.77rem", color: "#c8cce0" }}>{p.text.slice(0, 110)}</div>
                  <div style={{ fontSize: "0.65rem", padding: "0.1rem 0.4rem", borderRadius: 999, background: "rgba(155,127,212,0.12)", color: "#c3a6ff", border: "1px solid rgba(155,127,212,0.4)", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {p.query_term}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}