import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

interface SplashScreenProps {
  onDone: () => void;
}

const TITLE = "ALGOSCOPE";
const SUBTITLE = "Real-time algospeak & toxicity intelligence on Bluesky";

// Animated background nodes for the splash
const BG_NODES = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  x: 8 + (i * 13.5) % 92,
  y: 10 + (i * 17) % 80,
  r: 3 + (i % 4) * 1.8,
  color: i % 3 === 0 ? "#ff4b4b" : i % 3 === 1 ? "#ff8c42" : "#a6b0ff",
  delay: i * 0.07,
}));

const BG_EDGES = [
  [0, 3], [3, 7], [7, 11], [1, 5], [5, 9], [9, 12],
  [2, 6], [6, 10], [0, 4], [4, 8], [8, 13], [2, 7],
  [1, 6], [3, 10], [5, 12], [4, 11],
];

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [lettersDone, setLettersDone] = useState(0);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    // Letter-by-letter reveal
    let i = 0;
    const letterInterval = setInterval(() => {
      i++;
      setLettersDone(i);
      if (i >= TITLE.length) clearInterval(letterInterval);
    }, 80);

    // Show subtitle after title is done
    timerRef.current = setTimeout(() => setSubtitleVisible(true), 900);

    // Progress bar
    let prog = 0;
    const progInterval = setInterval(() => {
      prog += 1.6;
      setProgress(Math.min(100, prog));
      if (prog >= 100) clearInterval(progInterval);
    }, 28);

    // Exit
    const exitTimer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDone, 700);
    }, 2600);

    return () => {
      clearInterval(letterInterval);
      clearInterval(progInterval);
      if (timerRef.current) clearTimeout(timerRef.current);
      clearTimeout(exitTimer);
    };
  }, [onDone]);

  return (
    <AnimatePresence>
      {!exiting && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.65, ease: "easeInOut" }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "#080b12",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {/* Animated background graph */}
          <svg
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              opacity: 0.18,
            }}
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid slice"
          >
            {BG_EDGES.map(([a, b], i) => {
              const nodeA = BG_NODES[a];
              const nodeB = BG_NODES[b];
              return (
                <motion.line
                  key={i}
                  x1={nodeA.x} y1={nodeA.y}
                  x2={nodeB.x} y2={nodeB.y}
                  stroke="#a6b0ff"
                  strokeWidth="0.3"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.04, duration: 0.5 }}
                />
              );
            })}
            {BG_NODES.map(node => (
              <motion.circle
                key={node.id}
                cx={node.x} cy={node.y} r={node.r}
                fill={node.color}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.7 }}
                transition={{ delay: node.delay, duration: 0.4, type: "spring" }}
              />
            ))}
          </svg>

          {/* Radial glow */}
          <div
            style={{
              position: "absolute",
              width: 520,
              height: 520,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(255,75,75,0.08) 0%, rgba(10,13,20,0) 70%)",
              pointerEvents: "none",
            }}
          />

          {/* Logo icon */}
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "linear-gradient(135deg, #ff4b4b, #ff8c42)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2.2rem",
              fontWeight: 900,
              color: "#fff",
              boxShadow:
                "0 0 40px rgba(255,75,75,0.5), 0 0 80px rgba(255,75,75,0.2)",
              marginBottom: "1.5rem",
            }}
          >
            A
          </motion.div>

          {/* Title: letter by letter */}
          <div
            style={{
              display: "flex",
              gap: 3,
              marginBottom: "1rem",
            }}
          >
            {TITLE.split("").map((char, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
                animate={
                  i < lettersDone
                    ? { opacity: 1, y: 0, filter: "blur(0px)" }
                    : { opacity: 0, y: 20, filter: "blur(8px)" }
                }
                transition={{ duration: 0.3, ease: "easeOut" }}
                style={{
                  fontSize: "3.2rem",
                  fontWeight: 900,
                  letterSpacing: "0.06em",
                  color: i < 4 ? "#ff4b4b" : "#e8eaf0",
                  textShadow:
                    i < 4
                      ? "0 0 30px rgba(255,75,75,0.6)"
                      : "0 0 20px rgba(232,234,240,0.2)",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              >
                {char}
              </motion.span>
            ))}
          </div>

          {/* Subtitle */}
          <AnimatePresence>
            {subtitleVisible && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                style={{
                  fontSize: "0.9rem",
                  color: "#6a70a0",
                  letterSpacing: "0.04em",
                  maxWidth: 440,
                  textAlign: "center",
                  marginBottom: "2.5rem",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              >
                {SUBTITLE}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress bar */}
          <div
            style={{
              width: 260,
              height: 3,
              background: "#1a1f35",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <motion.div
              style={{
                height: "100%",
                background: "linear-gradient(90deg, #ff4b4b, #ff8c42)",
                borderRadius: 999,
                boxShadow: "0 0 10px rgba(255,75,75,0.5)",
                width: `${progress}%`,
              }}
            />
          </div>

          {/* Loading label */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            style={{
              marginTop: "0.75rem",
              fontSize: "0.62rem",
              color: "#3a4060",
              letterSpacing: "2px",
              textTransform: "uppercase",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            {progress < 100 ? "Loading intelligence engine…" : "Ready"}
          </motion.div>

          {/* Version badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            style={{
              position: "absolute",
              bottom: "1.5rem",
              right: "1.5rem",
              fontSize: "0.62rem",
              color: "#2a3050",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            by Odeliya Charitonova · TAU CS
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
