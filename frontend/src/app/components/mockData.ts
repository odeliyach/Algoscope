// ── API base URL ───────────────────────────────────────────────────────────────
// WHY import.meta.env: Vite reads environment variables at build time.
// VITE_API_URL is empty string in production (same origin as FastAPI),
// and http://localhost:8000 in development.
// This means the same compiled artifact works in both environments without
// any code change — just a different .env file.
const API_BASE = import.meta.env.VITE_API_URL ?? "";

// ── Shared types ───────────────────────────────────────────────────────────────
export const ALGOSPEAK_TERMS = [
  "unalive", "le dollar bean", "seggs", "cute", "based",
  "cornhole", "nsfw", "eggplant", "spicy", "ratio",
  "touch grass", "down bad", "pretty", "why", "mean",
  "better", "someone", "having", "harder", "top",
];

export interface Post {
  id: number | string;  // DB returns number; mock generator uses string
  text: string;
  score: number;
  label: "toxic" | "non-toxic";
  query_term: string;
  created_at: string;
}

export interface GraphNode {
  id: string;
  frequency: number;   // maps to "count" from the API
  toxicRatio: number;  // maps to "toxic_ratio" from the API
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

// ── Real API client functions ──────────────────────────────────────────────────

/**
 * Fetch recent classified posts from the database.
 * Called on mount to populate initial dashboard state.
 */
export async function apiFetchPosts(limit = 100): Promise<Post[]> {
  const res = await fetch(`${API_BASE}/posts?limit=${limit}`);
  if (!res.ok) throw new Error(`/posts failed: ${res.status}`);
  const data = await res.json();
  // Normalize: API returns id as number, mock uses string — cast to keep
  // downstream components happy with either.
  return (data.posts as Post[]).map(p => ({
    ...p,
    id: p.id ?? 0,
    query_term: p.query_term ?? "",
    created_at: p.created_at ?? "",
    label: p.label === "toxic" ? "toxic" : "non-toxic",
  }));
}

/**
 * Fetch just the total post count from the DB without pulling all rows.
 * Used to keep the "Posts analyzed" counter in sync with the real DB after
 * every fetch — avoids stale-closure bugs in useCallback.
 */
export async function apiFetchTotal(): Promise<number> {
  const res = await fetch(`${API_BASE}/posts?limit=1`);
  if (!res.ok) return -1;
  const data = await res.json();
  return typeof data.total === "number" ? data.total : -1;
}

/**
 * Trigger a Bluesky fetch + batch inference cycle.
 * Returns the new posts plus timing metadata for the UI.
 */
export async function apiFetchAndAnalyze(
  queries: string[],
  limit: number,
  threshold: number,
): Promise<{ posts: Post[]; fetchTime: number; inferTime: number; count: number; message?: string }> {
  const res = await fetch(`${API_BASE}/fetch-and-analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queries, limit, threshold }),
  });
  if (!res.ok) throw new Error(`/fetch-and-analyze failed: ${res.status}`);
  const data = await res.json();
  const posts = (data.posts as Post[]).map(p => ({
    ...p,
    id: p.id ?? 0,
    query_term: p.query_term ?? "",
    created_at: p.created_at ?? "",
    label: p.label === "toxic" ? "toxic" : "non-toxic",
  }));
  return {
    posts,
    fetchTime: data.fetch_time,
    inferTime: data.infer_time,
    count: data.count,
    message: data.message,
  };
}

/**
 * Fetch co-occurrence graph data as nodes + edges JSON.
 * The React canvas simulation handles layout — the server only provides structure.
 */
export async function apiGetGraphData(
  minCooccurrence: number,
  toxicOnly: boolean,
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const res = await fetch(
    `${API_BASE}/graph-data?min_cooccurrence=${minCooccurrence}&toxic_only=${toxicOnly}`
  );
  if (!res.ok) throw new Error(`/graph-data failed: ${res.status}`);
  const data = await res.json();
  // Map API field names (count, toxic_ratio) to the names the graph
  // simulation already uses (frequency, toxicRatio).
  const nodes: GraphNode[] = (data.nodes as Array<{
    id: string; count: number; toxic_ratio: number;
  }>).map(n => ({
    id: n.id,
    frequency: n.count,
    toxicRatio: n.toxic_ratio,
  }));
  return { nodes, edges: data.edges as GraphEdge[] };
}

// ── Mock data (kept for local dev / offline fallback) ─────────────────────────
// These are only used if the API is unreachable. They are never sent to the
// backend — no secrets here.

const MOCK_TEMPLATES = [
  "I can't believe they used {term} like that, this is getting out of hand",
  "Found another account using {term} to avoid filters, reported it immediately",
  "The {term} discourse is absolutely wild today, why are people like this",
  "Seeing {term} trending again. Not a great sign for the platform tbh",
  "Whoever invented {term} to avoid filters is frankly unhinged",
  "Just saw {term} used unironically in a serious post, internet is something",
  "Moderators need to update their filters, {term} is literally everywhere now",
  "The {term} to english translation is honestly concerning for society",
  "Why does {term} keep showing up in my feed, algorithm is broken again",
  "Teaching my mom what {term} means was the hardest conversation I've had this year",
  "{term} energy today, not gonna lie tbh",
  "Petition to ban {term} from the platform. Who's with me",
  "Using {term} unironically is such a major red flag ngl",
  "The way {term} has evolved over time is fascinating from a linguistics POV",
  "Just another day of seeing {term} everywhere on here smh",
  "Why is {term} suddenly all over my fyp, is this a new trend",
  "Blocked 3 accounts today for using {term} in my replies",
  "{term} popped up again in the discourse, same old same old",
  "Can we talk about how normalized {term} has become? Not ok.",
  "Researchers studying {term} usage patterns should check bluesky tbh",
];

function randomScore(): number {
  const r = Math.random();
  if (r < 0.55) return 0.62 + Math.random() * 0.38;
  if (r < 0.75) return 0.40 + Math.random() * 0.30;
  return Math.random() * 0.38;
}

export function generateMockPosts(terms: string[], count = 180): Post[] {
  const posts: Post[] = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const term = terms[Math.floor(Math.random() * terms.length)];
    const tpl = MOCK_TEMPLATES[Math.floor(Math.random() * MOCK_TEMPLATES.length)];
    const text = tpl.replace("{term}", term);
    const score = randomScore();
    const created_at = new Date(now - Math.random() * dayMs).toISOString();
    posts.push({
      id: `mock-${i}`,
      text,
      score: Math.round(score * 1000) / 1000,
      label: score >= 0.7 ? "toxic" : "non-toxic",
      query_term: term,
      created_at,
    });
  }
  return posts.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

// ── Graph colour helpers (used by CoOccurrenceGraph.tsx) ──────────────────────
export function nodeColor(toxicRatio: number): string {
  if (toxicRatio >= 0.7) return "#ff4b4b";
  if (toxicRatio >= 0.4) return "#ff8c42";
  return "#2ecc71";
}

export function nodeColorAlpha(toxicRatio: number, alpha = 0.25): string {
  if (toxicRatio >= 0.7) return `rgba(255,75,75,${alpha})`;
  if (toxicRatio >= 0.4) return `rgba(255,140,66,${alpha})`;
  return `rgba(46,204,113,${alpha})`;
}
