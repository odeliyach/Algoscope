import { useState, useCallback, useEffect } from "react";
// AlgoScope dashboard — v2 (custom charts, no Recharts)
import { motion, AnimatePresence } from "motion/react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { OverviewTab } from "./components/OverviewTab";
import { CoOccurrenceGraph } from "./components/CoOccurrenceGraph";
import { TermComparisonTab } from "./components/TermComparisonTab";
import { ExportTab } from "./components/ExportTab";
import { SplashScreen } from "./components/SplashScreen";
import {
  apiFetchPosts,
  apiFetchAndAnalyze,
  generateMockPosts,
  ALGOSPEAK_TERMS,
  Post,
} from "./components/mockData";

// WHY empty initial state instead of mock data:
// We fetch real posts from the backend in the useEffect below. Starting with
// an empty array avoids a flash of mock data before real data arrives.
const EMPTY_POSTS: Post[] = [];

const TABS = [
  { id: "overview",   label: "Overview" },
  { id: "graph",      label: "Co-occurrence Graph" },
  { id: "compare",    label: "Term Comparison" },
  { id: "export",     label: "Export" },
];

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Sidebar state
  const [selectedTerms, setSelectedTerms] = useState(ALGOSPEAK_TERMS.slice(0, 4));
  const [threshold, setThreshold] = useState(0.70);
  const [sampling, setSampling] = useState(25);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Data
  const [allPosts, setAllPosts] = useState<Post[]>(EMPTY_POSTS);
  const [batchPosts, setBatchPosts] = useState<Post[]>(EMPTY_POSTS);
  const [fetching, setFetching] = useState(false);
  const [justFetched, setJustFetched] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // WHY separate counter instead of allPosts.length:
  // allPosts is capped at 500 and deduplicates by id, so it can go DOWN
  // when new posts replace old ones. totalAnalyzed is a monotonically
  // increasing sum — the true count of posts ever processed this session.
  const [totalAnalyzed, setTotalAnalyzed] = useState(0);

  // Graph controls
  const [minCooccurrence, setMinCooccurrence] = useState(3);
  const [toxicOnly, setToxicOnly] = useState(false);

  // ── Load initial posts from backend on mount ────────────────────────────────
  // WHY useEffect + apiFetchPosts:
  // On mount we call GET /posts to populate the dashboard with whatever the
  // server already has (either seeded posts from cold start, or posts from
  // previous sessions). This replaces the old `generateMockPosts()` call.
  //
  // WHY fallback to mock data on error:
  // If the backend is unavailable (local dev without FastAPI running), we fall
  // back to mock data so the UI is still usable. This is dev-only behaviour;
  // in production the frontend and backend are served from the same process.
  useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      try {
        const posts = await apiFetchPosts(200);
        if (cancelled) return;
        if (posts.length > 0) {
          setAllPosts(posts);
          setBatchPosts(posts.slice(0, 25));
          // WHY set totalAnalyzed from DB count on mount:
          // The counter starts at 0 but the DB already has posts from previous
          // sessions. Without this, the display jumps DOWN from 200 (DB load)
          // to 25 (first fetch) because totalAnalyzed || totalPosts picks
          // totalPosts on load, then switches to the smaller totalAnalyzed.
          setTotalAnalyzed(posts.length);
        } else {
          // Backend is healthy but DB is empty — show mock data as a placeholder
          const mock = generateMockPosts(ALGOSPEAK_TERMS.slice(0, 4), 30);
          setAllPosts(mock);
          setBatchPosts(mock.slice(0, 25));
        }
      } catch {
        if (cancelled) return;
        // Backend unreachable — fall back to mock data for dev/offline use
        const mock = generateMockPosts(ALGOSPEAK_TERMS.slice(0, 4), 30);
        setAllPosts(mock);
        setBatchPosts(mock.slice(0, 25));
      }
    }
    loadInitial();
    return () => { cancelled = true; };
  }, []);

  // ── Fetch & Analyze handler ─────────────────────────────────────────────────
  // WHY apiFetchAndAnalyze instead of generateMockPosts:
  // This calls POST /fetch-and-analyze which fetches real Bluesky posts,
  // runs batch DistilBERT inference, saves them to SQLite, and returns results.
  const handleFetch = useCallback(async () => {
    setFetching(true);
    setJustFetched(false);
    setFetchError(null);
    try {
      const { posts: newBatch, message } = await apiFetchAndAnalyze(
        selectedTerms.length ? selectedTerms : ALGOSPEAK_TERMS,
        sampling,
        threshold,
      );

      if (newBatch.length === 0) {
        setFetchError(message ?? "No posts fetched from Bluesky. Check credentials and try again.");
        setJustFetched(true);
        return;
      }

      setBatchPosts(newBatch);
      setAllPosts(prev => {
        // Merge new posts in front, deduplicate by id, keep max 500
        const existingIds = new Set(prev.map(p => String(p.id)));
        const trulyNew = newBatch.filter(p => !existingIds.has(String(p.id)));
        // WHY count only trulyNew here instead of newBatch.length:
        // The backend may return posts already present in the DB (from the
        // initial seed or a previous fetch). Counting newBatch.length directly
        // caused the counter to jump to e.g. 229 instead of accumulating
        // (200 → 230 → 229 bug). We compute the truly-new count inside the
        // setAllPosts updater so it uses the same prev snapshot, guaranteeing
        // the dedup logic and the counter increment are always in sync.
        setTotalAnalyzed(c => c + trulyNew.length);
        const idSet = new Set(newBatch.map(p => String(p.id)));
        const filtered = prev.filter(p => !idSet.has(String(p.id)));
        return [...newBatch, ...filtered].slice(0, 500);
      });
      setJustFetched(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fetch failed";
      setFetchError(msg);
      // Fallback: generate mock data so the UI doesn't go blank
      const mock = generateMockPosts(selectedTerms.length ? selectedTerms : ALGOSPEAK_TERMS, sampling);
      setBatchPosts(mock);
      setAllPosts(prev => [...mock, ...prev].slice(0, 500));
      setJustFetched(true);
    } finally {
      setFetching(false);
    }
  }, [selectedTerms, sampling, threshold]);

  return (
    <>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      <div
        style={{
          width: "100vw",
          minHeight: "100vh",
          background: "#0a0d14",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          overflowX: "hidden",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#e8eaf0",
        }}
      >
        {/* Header */}
        <Header onToggleSidebar={() => setSidebarOpen(v => !v)} sidebarOpen={sidebarOpen} />

        {/* Body */}
        <div style={{ flex: 1, display: "flex", overflow: "visible", minHeight: 0 }}>
          {/* Sidebar */}
          <Sidebar
            open={sidebarOpen}
            selectedTerms={selectedTerms}
            setSelectedTerms={setSelectedTerms}
            threshold={threshold}
            setThreshold={setThreshold}
            sampling={sampling}
            setSampling={setSampling}
            autoRefresh={autoRefresh}
            setAutoRefresh={setAutoRefresh}
            onFetch={handleFetch}
            posts={allPosts}
            fetching={fetching}
          />

          {/* Main content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "visible", minHeight: 0 }}>
            {/* Tabs nav */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid #1e2540",
                background: "#0a0d14",
                paddingInline: "1.4rem",
                gap: "0.25rem",
                flexShrink: 0,
              }}
            >
              {TABS.map(tab => {
                const active = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      borderBottom: active ? "2px solid #ff6b3d" : "2px solid transparent",
                      color: active ? "#ff6b3d" : "#5a6080",
                      fontSize: "0.82rem",
                      padding: "0.65rem 0.9rem",
                      cursor: "pointer",
                      fontWeight: active ? 600 : 400,
                      transition: "color 0.2s, border-color 0.2s",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={e => {
                      if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#9aa0c0";
                    }}
                    onMouseLeave={e => {
                      if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#5a6080";
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}

              {/* Status toast — shows fetch success or error */}
              <AnimatePresence>
                {justFetched && !fetchError && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      marginLeft: "auto",
                      alignSelf: "center",
                      fontSize: "0.72rem",
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: "rgba(46,204,113,0.1)",
                      border: "1px solid rgba(46,204,113,0.25)",
                      color: "#2ecc71",
                    }}
                  >
                    ✓ Done! Analyzed {batchPosts.length} posts
                  </motion.div>
                )}
                {justFetched && fetchError && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      marginLeft: "auto",
                      alignSelf: "center",
                      fontSize: "0.72rem",
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: "rgba(255,75,75,0.1)",
                      border: "1px solid rgba(255,75,75,0.25)",
                      color: "#ff6b3d",
                    }}
                  >
                    ⚠ API unavailable — showing mock data
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflow: "visible", minHeight: 0 }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  style={{ minHeight: "100%" }}
                >
                  {activeTab === "overview" && (
                    <OverviewTab
                      posts={allPosts}
                      batchPosts={batchPosts}
                      selectedTerms={selectedTerms}
                      justFetched={justFetched}
                      totalAnalyzed={totalAnalyzed}
                    />
                  )}
                  {activeTab === "graph" && (
                    <CoOccurrenceGraph
                      minCooccurrence={minCooccurrence}
                      setMinCooccurrence={setMinCooccurrence}
                      toxicOnly={toxicOnly}
                      setToxicOnly={setToxicOnly}
                    />
                  )}
                  {activeTab === "compare" && (
                    <TermComparisonTab posts={allPosts} />
                  )}
                  {activeTab === "export" && (
                    <ExportTab posts={allPosts} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        <style>{`
          * { box-sizing: border-box; }
          ::-webkit-scrollbar { width: 5px; height: 5px; }
          ::-webkit-scrollbar-track { background: #0d1120; }
          ::-webkit-scrollbar-thumb { background: #1e2540; border-radius: 3px; }
          ::-webkit-scrollbar-thumb:hover { background: #2e3560; }
          input[type=range] { appearance: none; height: 4px; border-radius: 2px; background: #1e2540; outline: none; }
          input[type=range]::-webkit-slider-thumb {
            appearance: none; width: 14px; height: 14px; border-radius: 50%;
            background: #ff4b4b; cursor: pointer; border: 2px solid #0a0d14;
          }
          select option { background: #141826; color: #e8eaf0; }
        `}</style>
      </div>
    </>
  );
}
