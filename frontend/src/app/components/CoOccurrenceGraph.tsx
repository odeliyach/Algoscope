import { useEffect, useRef, useState, useCallback, useMemo, Component } from "react";
import { motion } from "motion/react";
import { nodeColor, apiGetGraphData, GraphNode, GraphEdge } from "./mockData";

// ── Types ──────────────────────────────────────────────────────────────────────
interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  frequency: number;
  toxicRatio: number;
}

interface Props {
  minCooccurrence: number;
  setMinCooccurrence: (v: number) => void;
  toxicOnly: boolean;
  setToxicOnly: (v: boolean) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const W = 820;
const H = 540;
const REPULSION = 3800;
const SPRING = 0.035;
const EDGE_LEN = 140;
const GRAVITY = 0.01;
const DAMPING = 0.84;
const CENTER_X = W / 2;
const CENTER_Y = H / 2;

// ── Error Boundary ─────────────────────────────────────────────────────────────
interface EBState { hasError: boolean; error?: string }
class GraphErrorBoundary extends Component<{ children: React.ReactNode }, EBState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(err: Error): EBState {
    return { hasError: true, error: err.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          margin: "1.5rem",
          background: "rgba(255,75,75,0.07)",
          border: "1px solid rgba(255,75,75,0.2)",
          borderRadius: 10,
          padding: "1.5rem",
          textAlign: "center",
        }}>
          <div style={{ color: "#ff4b4b", fontSize: "0.9rem", marginBottom: 8 }}>
            ⚠ Graph failed to render
          </div>
          <div style={{ color: "#5a6080", fontSize: "0.75rem" }}>
            {this.state.error || "Unknown error"}
          </div>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              marginTop: 12,
              background: "rgba(255,75,75,0.12)",
              border: "1px solid rgba(255,75,75,0.3)",
              borderRadius: 7,
              color: "#ff6b3d",
              padding: "5px 14px",
              cursor: "pointer",
              fontSize: "0.78rem",
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Physics hook ───────────────────────────────────────────────────────────────
function safeNum(v: number, fallback = 0): number {
  return isFinite(v) && !isNaN(v) ? v : fallback;
}

function useForceSimulation(
  nodeConfigs: GraphNode[],
  edges: GraphEdge[],
  nodeKey: string,
) {
  const nodesRef = useRef<SimNode[]>([]);
  const [positions, setPositions] = useState<SimNode[]>([]);
  const rafRef = useRef<number>(0);
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  const activeRef = useRef(false);

  const run = useCallback(() => {
    if (!activeRef.current) return;
    const ns = nodesRef.current;
    if (!ns.length) return;
    const es = edgesRef.current;

    try {
      // Repulsion
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = (ns[i].x - ns[j].x) || 0.5;
          const dy = (ns[i].y - ns[j].y) || 0.5;
          const dist2 = Math.max(0.01, dx * dx + dy * dy);
          const dist = Math.sqrt(dist2);
          const force = REPULSION / dist2;
          const fx = safeNum((dx / dist) * force);
          const fy = safeNum((dy / dist) * force);
          ns[i].vx += fx;
          ns[i].vy += fy;
          ns[j].vx -= fx;
          ns[j].vy -= fy;
        }
      }

      // Spring edges
      for (const e of es) {
        const s = ns.find(n => n.id === e.source);
        const t = ns.find(n => n.id === e.target);
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        // WHY Math.min cap: with real data edge weights can be 50–500+
        // (co-occurrence count across hundreds of posts). Without capping,
        // naturalLen collapses to ~3px, pulling all nodes into a single blob.
        // Capping at 8 keeps naturalLen in the range 115–140px regardless of
        // how large the real-data weights get.
        const naturalLen = EDGE_LEN / (1 + Math.min(e.weight, 8) * 0.04);
        const force = (dist - naturalLen) * SPRING;
        const fx = safeNum((dx / dist) * force);
        const fy = safeNum((dy / dist) * force);
        s.vx += fx;
        s.vy += fy;
        t.vx -= fx;
        t.vy -= fy;
      }

      // Gravity + integrate
      for (const n of ns) {
        n.vx = safeNum(n.vx + (CENTER_X - n.x) * GRAVITY);
        n.vy = safeNum(n.vy + (CENTER_Y - n.y) * GRAVITY);
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x = safeNum(n.x + n.vx, CENTER_X);
        n.y = safeNum(n.y + n.vy, CENTER_Y);
        // WHY log scale: linear sizing (freq * 0.25) lets high-frequency common
        // words (e.g. "yeah", "his") grow to 10x the size of algospeak terms,
        // dominating the canvas. Math.log compresses the range so all nodes
        // stay visually comparable. Min 8px, max ~32px regardless of frequency.
        const r = 5 + Math.min(Math.log1p(n.frequency ?? 1) * 1.8, 12);
        n.x = Math.max(r + 40, Math.min(W - r - 40, n.x));
        n.y = Math.max(r + 20, Math.min(H - r - 20, n.y));
      }

      if (activeRef.current) {
        setPositions(ns.map(n => ({ ...n })));
        const maxV = ns.reduce((mx, n) => Math.max(mx, Math.abs(n.vx) + Math.abs(n.vy)), 0);
        if (maxV > 0.15) {
          rafRef.current = requestAnimationFrame(run);
        }
      }
    } catch {
      activeRef.current = false;
    }
  }, []);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    activeRef.current = true;

    nodesRef.current = nodeConfigs.map(n => ({
      id: n.id,
      frequency: n.frequency,
      toxicRatio: n.toxicRatio,
      x: CENTER_X + (Math.random() - 0.5) * 280,
      y: CENTER_Y + (Math.random() - 0.5) * 280,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
    }));
    setPositions(nodesRef.current.map(n => ({ ...n })));
    rafRef.current = requestAnimationFrame(run);

    return () => {
      activeRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [nodeKey, run]);

  return positions;
}

// ── Edge colour ───────────────────────────────────────────────────────────────
function edgeColor(sourceRatio: number, targetRatio: number, weight: number): string {
  const avg = ((sourceRatio ?? 0) + (targetRatio ?? 0)) / 2;
  const alpha = Math.min(0.9, 0.3 + weight * 0.05);
  if (avg >= 0.7) return `rgba(255,75,75,${alpha})`;
  if (avg >= 0.4) return `rgba(255,140,66,${alpha})`;
  return `rgba(46,204,113,${alpha})`;
}

// ── Inner graph component ─────────────────────────────────────────────────────
function GraphCanvas({
  minCooccurrence, toxicOnly, setMinCooccurrence, setToxicOnly,
}: {
  minCooccurrence: number;
  toxicOnly: boolean;
  setMinCooccurrence: (v: number) => void;
  setToxicOnly: (v: boolean) => void;
}) {
  const [built, setBuilt] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WHY state for nodes/edges instead of hardcoded constants:
  // Previously these were GRAPH_NODES / GRAPH_EDGES imported from mockData.
  // Now they come from GET /graph-data when the user clicks "Build Graph".
  // The physics simulation code is exactly unchanged — it just receives real data.
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);

  // ── Fetch graph data from backend ───────────────────────────────────────────
  const handleBuild = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetGraphData(minCooccurrence, toxicOnly);
      setNodes(data.nodes);
      setEdges(data.edges);
      setBuilt(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load graph data");
    } finally {
      setLoading(false);
    }
  }, [minCooccurrence, toxicOnly]);

  const visibleNodes = useMemo(() => {
    return nodes.filter(n => {
      if (toxicOnly && n.toxicRatio < 0.7) return false;
      const edgeCount = edges.filter(
        e => (e.source === n.id || e.target === n.id) && e.weight >= minCooccurrence
      ).length;
      return edgeCount > 0 || minCooccurrence <= 2;
    });
  }, [nodes, edges, toxicOnly, minCooccurrence]);

  const visibleEdges = useMemo(() => {
    const nodeIds = new Set(visibleNodes.map(n => n.id));
    return edges.filter(
      e => e.weight >= minCooccurrence && nodeIds.has(e.source) && nodeIds.has(e.target)
    );
  }, [visibleNodes, edges, minCooccurrence]);

  const nodeKey = useMemo(
    () => visibleNodes.map(n => n.id).sort().join(","),
    [visibleNodes]
  );

  const positions = useForceSimulation(visibleNodes, visibleEdges, nodeKey);

  const posMap = useMemo(() => {
    const m: Record<string, { x: number; y: number }> = {};
    for (const p of positions) m[p.id] = { x: p.x, y: p.y };
    return m;
  }, [positions]);

  const nodeMap = useMemo(() => {
    const m: Record<string, GraphNode> = {};
    for (const n of visibleNodes) m[n.id] = n;
    return m;
  }, [visibleNodes]);

  return (
    <div style={{ padding: "1.2rem 1.4rem" }}>
      {/* Top controls */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        {/* Info card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            flex: 3,
            background: "#0d1120",
            border: "1px solid #1e2540",
            borderRadius: 10,
            padding: "0.75rem 1rem",
          }}
        >
          <div style={{ fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "1px", color: "#3a4060", marginBottom: 6 }}>
            How to read this graph
          </div>
          <div style={{ fontSize: "0.78rem", color: "#8a90ad" }}>
            Words that frequently appear together in algospeak posts are connected. Node size = frequency &nbsp;|&nbsp;
            <span style={{ color: "#ff4b4b" }}>red &gt;70% toxic</span>
            {" "}<span style={{ color: "#ff9f43" }}>orange 40-70% mixed</span>
            {" "}<span style={{ color: "#2ecc71" }}>green &lt;40% benign</span>
          </div>
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          style={{
            flex: 1,
            background: "#0d1120",
            border: "1px solid #1e2540",
            borderRadius: 10,
            padding: "0.75rem 1rem",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div>
            <div style={{ fontSize: "0.62rem", color: "#5a6080", marginBottom: 3 }}>
              Min co-occurrences
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 2 }}>
              <span style={{ fontSize: "0.72rem", color: "#ff6b3d", fontWeight: 700 }}>{minCooccurrence}</span>
            </div>
            <input
              type="range"
              min={2} max={10} step={1}
              value={minCooccurrence}
              onChange={e => {
                setMinCooccurrence(parseInt(e.target.value));
                // Reset graph so user re-clicks Build Graph with new params
                setBuilt(false);
                setNodes([]);
                setEdges([]);
              }}
              style={{ width: "100%", accentColor: "#ff4b4b" }}
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={toxicOnly}
              onChange={e => {
                setToxicOnly(e.target.checked);
                setBuilt(false);
                setNodes([]);
                setEdges([]);
              }}
              style={{ accentColor: "#ff4b4b" }}
            />
            <span style={{ fontSize: "0.75rem", color: "#8a90ad" }}>Toxic posts only</span>
          </label>
          <motion.button
            onClick={handleBuild}
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.97 }}
            style={{
              background: built
                ? "linear-gradient(135deg, #2ecc71, #27ae60)"
                : "linear-gradient(135deg, #ff4b4b, #ff8c42)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "7px 0",
              fontWeight: 700,
              fontSize: "0.82rem",
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
              boxShadow: built
                ? "0 0 14px rgba(46,204,113,0.25)"
                : "0 0 14px rgba(255,75,75,0.25)",
            }}
          >
            {loading ? "Loading…" : built ? "✓ Graph Active" : "Build Graph"}
          </motion.button>
        </motion.div>
      </div>

      {/* Error state */}
      {error && (
        <div style={{
          background: "rgba(255,75,75,0.07)",
          border: "1px solid rgba(255,75,75,0.2)",
          borderRadius: 10,
          padding: "1rem",
          color: "#ff6b3d",
          fontSize: "0.8rem",
          marginBottom: "1rem",
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Graph canvas */}
      {!built ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            background: "#0d1120",
            border: "1px solid #1e2540",
            borderRadius: 10,
            padding: "3rem",
            textAlign: "center",
            color: "#5a6080",
            fontSize: "0.85rem",
          }}
        >
          Adjust settings above and click &quot;Build Graph&quot; to visualize word co-occurrences.
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          style={{
            background: "#080c18",
            border: "1px solid #1e2540",
            borderRadius: 10,
            overflow: "hidden",
            position: "relative",
            maxHeight: "62vh",
          }}
        >
          <svg
            width="100%"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ display: "block", width: "100%", height: "auto", maxHeight: "62vh" }}
          >
            {/* Background grid */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a1f35" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="url(#grid)" opacity={0.5} />

            {/* Edges */}
            {visibleEdges.map(e => {
              const s = posMap[e.source];
              const t = posMap[e.target];
              if (!s || !t) return null;
              const sNode = nodeMap[e.source];
              const tNode = nodeMap[e.target];
              if (!sNode || !tNode) return null;
              const isHighlighted = hoveredNode === e.source || hoveredNode === e.target;
              return (
                <line
                  key={`${e.source}--${e.target}`}
                  x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                  stroke={edgeColor(sNode.toxicRatio, tNode.toxicRatio, e.weight)}
                  strokeWidth={0.5 + Math.min(Math.log1p(e.weight) * 0.5, 2.5)}
                  opacity={hoveredNode ? (isHighlighted ? 0.9 : 0.1) : 0.7}
                  style={{ transition: "opacity 0.2s" }}
                />
              );
            })}

            {/* Nodes */}
            {positions.map(node => {
              const freq = node.frequency ?? 1;
              const tRatio = node.toxicRatio ?? 0.5;
              // WHY log1p: same formula as the physics loop so the rendered
              // circle matches the collision radius used for simulation.
              const size = 5 + Math.min(Math.log1p(freq) * 1.8, 12);
              const color = nodeColor(tRatio);
              const isHovered = hoveredNode === node.id;
              const isDimmed = !!(hoveredNode && !isHovered);
              const r = isHovered ? size * 1.25 : size;

              if (!isFinite(node.x) || !isFinite(node.y)) return null;

              return (
                <g
                  key={node.id}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    cx={node.x} cy={node.y}
                    r={r + 6}
                    fill={color}
                    opacity={isHovered ? 0.2 : 0}
                    style={{ transition: "opacity 0.2s" }}
                  />
                  <circle
                    cx={node.x} cy={node.y}
                    r={r}
                    fill={color}
                    fillOpacity={isDimmed ? 0.2 : 0.85}
                    stroke={color}
                    strokeWidth={isHovered ? 2.5 : 1.5}
                    strokeOpacity={isDimmed ? 0.2 : 0.6}
                    style={{ transition: "opacity 0.2s" }}
                  />
                  <text
                    x={node.x}
                    y={node.y + r + 12}
                    textAnchor="middle"
                    fontSize={isHovered ? 11 : 9.5}
                    fill={isDimmed ? "#3a4060" : "#c8cce0"}
                    fontFamily="system-ui, sans-serif"
                    style={{ userSelect: "none", pointerEvents: "none", transition: "opacity 0.2s" }}
                    opacity={isDimmed ? 0.2 : 1}
                  >
                    {node.id}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Hover tooltip */}
          {hoveredNode && (() => {
            const n = visibleNodes.find(x => x.id === hoveredNode);
            if (!n) return null;
            const color = nodeColor(n.toxicRatio);
            const connections = visibleEdges.filter(
              e => e.source === n.id || e.target === n.id
            ).length;
            return (
              <motion.div
                key={hoveredNode}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  position: "absolute",
                  top: 12, right: 12,
                  background: "#0d1120",
                  border: `1px solid ${color}44`,
                  borderRadius: 9,
                  padding: "0.6rem 0.9rem",
                  minWidth: 150,
                  boxShadow: `0 0 20px ${color}22`,
                }}
              >
                <div style={{ fontWeight: 700, color: "#e8eaf0", fontSize: "0.88rem", marginBottom: 6 }}>
                  {n.id}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#8a90ad", marginBottom: 2 }}>
                  Frequency: <span style={{ color: "#e8eaf0" }}>{n.frequency}</span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "#8a90ad", marginBottom: 2 }}>
                  Toxic ratio:{" "}
                  <span style={{ color, fontWeight: 700 }}>
                    {(n.toxicRatio * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "#8a90ad" }}>
                  Connections: <span style={{ color: "#e8eaf0" }}>{connections}</span>
                </div>
                <div style={{ marginTop: 6, background: "#1a1f35", borderRadius: 4, height: 4, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${n.toxicRatio * 100}%`,
                      height: "100%",
                      background: color,
                      borderRadius: 4,
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              </motion.div>
            );
          })()}
        </motion.div>
      )}
    </div>
  );
}

// ── Public component ───────────────────────────────────────────────────────────
export function CoOccurrenceGraph({ minCooccurrence, setMinCooccurrence, toxicOnly, setToxicOnly }: Props) {
  return (
    <GraphErrorBoundary>
      <GraphCanvas
        minCooccurrence={minCooccurrence}
        setMinCooccurrence={setMinCooccurrence}
        toxicOnly={toxicOnly}
        setToxicOnly={setToxicOnly}
      />
    </GraphErrorBoundary>
  );
}
