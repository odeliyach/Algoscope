import { motion } from "motion/react";

interface HeaderProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

export function Header({ onToggleSidebar, sidebarOpen }: HeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0.6rem 1.4rem 0.7rem",
        borderBottom: "1px solid #1e2540",
        background: "#0a0d14",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
        {/* Sidebar toggle */}
        <button
          onClick={onToggleSidebar}
          style={{
            width: 32,
            height: 32,
            background: "#141826",
            border: "1px solid #1e2540",
            borderRadius: 7,
            color: "#e8eaf0",
            fontSize: 16,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "border-color 0.2s, color 0.2s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#ff6b3d";
            (e.currentTarget as HTMLButtonElement).style.color = "#ff6b3d";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#1e2540";
            (e.currentTarget as HTMLButtonElement).style.color = "#e8eaf0";
          }}
        >
          ☰
        </button>

        {/* Logo */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            background: "linear-gradient(135deg, #ff4b4b, #ff8c42)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            color: "#fff",
            fontSize: "1.15rem",
            boxShadow: "0 0 18px rgba(255,76,76,0.45)",
            flexShrink: 0,
          }}
        >
          A
        </motion.div>

        {/* Title */}
        <div>
          <div style={{ fontSize: "1.55rem", fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>
            AlgoScope
          </div>
          <div style={{ fontSize: "0.78rem", color: "#9aa0c0" }}>
            Real-time algospeak &amp; toxicity intelligence on Bluesky
          </div>
        </div>
      </div>

      {/* Right side */}
      <div style={{ textAlign: "right" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.2rem 0.65rem",
            borderRadius: 999,
            background: "rgba(46,204,113,0.08)",
            border: "1px solid rgba(46,204,113,0.22)",
            marginBottom: "0.25rem",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#2ecc71",
              boxShadow: "0 0 6px rgba(46,204,113,0.9)",
              display: "inline-block",
              animation: "pulse-dot 1.5s infinite",
            }}
          />
          <span style={{ color: "#2ecc71", fontWeight: 700, letterSpacing: 1, fontSize: "0.68rem" }}>
            LIVE
          </span>
        </div>
        <div style={{ fontSize: "0.73rem", color: "#6f7695" }}>
          by Odeliya Charitonova
          <br />
          <a
            href="https://github.com/odeliyach/Algoscope"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#a6b0ff", textDecoration: "none" }}
          >
            github.com/odeliyach/Algoscope
          </a>
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }
      `}</style>
    </motion.div>
  );
}