import { useState } from "react";
import { motion } from "motion/react";
import { Download, FileText, FileJson, CheckCircle } from "lucide-react";
import { Post } from "./mockData";

interface Props {
  posts: Post[];
}

function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCSV(posts: Post[], filename: string) {
  const header = "id,text,score,label,query_term,created_at";
  const rows = posts.map(p =>
    [p.id, `"${p.text.replace(/"/g, '""')}"`, p.score, p.label, p.query_term, p.created_at].join(",")
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportCard({
  icon,
  title,
  description,
  buttonLabel,
  color,
  onClick,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  color: string;
  onClick: () => void;
  delay: number;
}) {
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    onClick();
    setClicked(true);
    setTimeout(() => setClicked(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45 }}
      style={{
        background: "#0d1120",
        border: "1px solid #1e2540",
        borderRadius: 10,
        padding: "1.1rem 1.2rem",
        display: "flex",
        alignItems: "center",
        gap: "1rem",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          background: `${color}18`,
          border: `1px solid ${color}44`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#e8eaf0", marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: "0.73rem", color: "#5a6080" }}>{description}</div>
      </div>
      <motion.button
        onClick={handleClick}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        style={{
          background: clicked ? "rgba(46,204,113,0.12)" : `${color}18`,
          border: `1px solid ${clicked ? "#2ecc71" : color}55`,
          borderRadius: 8,
          color: clicked ? "#2ecc71" : color,
          padding: "6px 14px",
          fontSize: "0.78rem",
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 5,
          whiteSpace: "nowrap",
          transition: "all 0.2s",
        }}
      >
        {clicked ? <CheckCircle size={14} /> : <Download size={14} />}
        {clicked ? "Downloaded!" : buttonLabel}
      </motion.button>
    </motion.div>
  );
}

export function ExportTab({ posts }: Props) {
  const toxicPosts = posts.filter(p => p.label === "toxic");
  const nonToxicPosts = posts.filter(p => p.label === "non-toxic");

  const summaryData = {
    exported_at: new Date().toISOString(),
    total_posts: posts.length,
    toxic_count: toxicPosts.length,
    non_toxic_count: nonToxicPosts.length,
    toxic_rate: posts.length ? ((toxicPosts.length / posts.length) * 100).toFixed(2) + "%" : "0%",
    avg_score: posts.length
      ? (posts.reduce((s, p) => s + p.score, 0) / posts.length).toFixed(4)
      : "0",
    posts,
  };

  return (
    <div style={{ padding: "1.2rem 1.4rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ color: "#5a6080", fontSize: "0.82rem" }}
      >
        Export your analyzed data for further research or archiving.
      </motion.div>

      {/* Stats summary */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        style={{
          background: "#0d1120",
          border: "1px solid #1e2540",
          borderRadius: 10,
          padding: "0.9rem 1rem",
          display: "flex",
          gap: "2rem",
          flexWrap: "wrap",
        }}
      >
        {[
          { label: "Total posts", value: String(posts.length), color: "#fff" },
          { label: "Toxic", value: String(toxicPosts.length), color: "#ff4b4b" },
          { label: "Non-toxic", value: String(nonToxicPosts.length), color: "#2ecc71" },
          {
            label: "Toxic rate",
            value: posts.length ? `${((toxicPosts.length / posts.length) * 100).toFixed(1)}%` : "0%",
            color: "#ff8c42",
          },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <div style={{ fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "1px", color: "#3a4060", marginBottom: 4 }}>
              {label}
            </div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </motion.div>

      {/* Export options */}
      <ExportCard
        icon={<FileJson size={20} />}
        title="Full dataset (JSON)"
        description={`Export all ${posts.length} analyzed posts with scores, labels, and metadata`}
        buttonLabel="Export JSON"
        color="#a6b0ff"
        onClick={() => downloadJSON(summaryData, "algoscope-export.json")}
        delay={0.1}
      />

      <ExportCard
        icon={<FileText size={20} />}
        title="All posts (CSV)"
        description={`${posts.length} rows · id, text, score, label, query_term, created_at`}
        buttonLabel="Export CSV"
        color="#ff8c42"
        onClick={() => downloadCSV(posts, "algoscope-posts.csv")}
        delay={0.18}
      />

      <ExportCard
        icon={<FileText size={20} />}
        title="Toxic posts only (CSV)"
        description={`${toxicPosts.length} rows · filtered to toxic label (score ≥ threshold)`}
        buttonLabel="Export CSV"
        color="#ff4b4b"
        onClick={() => downloadCSV(toxicPosts, "algoscope-toxic.csv")}
        delay={0.26}
      />

      <ExportCard
        icon={<FileJson size={20} />}
        title="Summary statistics (JSON)"
        description="Aggregate metrics: counts, rates, avg scores per term"
        buttonLabel="Export JSON"
        color="#2ecc71"
        onClick={() => {
          const termStats: Record<string, unknown> = {};
          const terms = [...new Set(posts.map(p => p.query_term))];
          for (const t of terms) {
            const tp = posts.filter(p => p.query_term === t);
            const toxicN = tp.filter(p => p.label === "toxic").length;
            termStats[t] = {
              count: tp.length,
              toxic_count: toxicN,
              toxic_rate: `${((toxicN / tp.length) * 100).toFixed(1)}%`,
              avg_score: (tp.reduce((s, p) => s + p.score, 0) / tp.length).toFixed(4),
            };
          }
          downloadJSON({
            exported_at: new Date().toISOString(),
            total: posts.length,
            toxic_rate: `${((toxicPosts.length / posts.length) * 100).toFixed(1)}%`,
            per_term: termStats,
          }, "algoscope-summary.json");
        }}
        delay={0.34}
      />
    </div>
  );
}
