// src/pages/Toolbox.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wind,
  Anchor,
  Sparkles,
  Heart,
  MessageCircle,
  Trees as TreesIcon,
  CheckCircle2,
  Pin,
  PinOff,
  Play,
  Shuffle,
  NotebookPen,
  X,
} from "lucide-react";
import { getToolbox } from "../api";

/* -------------------- Animated Background -------------------- */
function AnimatedBg() {
  // soft gradient blobs in the back; pointer parallax
  const [p, setP] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e) => {
      const { innerWidth: w, innerHeight: h } = window;
      setP({ x: (e.clientX - w / 2) / w, y: (e.clientY - h / 2) / h });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute -top-24 -left-24 h-96 w-96 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(16,185,129,.35), transparent 65%)",
        }}
        animate={{ x: p.x * 30, y: p.y * 30 }}
        transition={{ type: "spring", stiffness: 30, damping: 12 }}
      />
      <motion.div
        className="absolute -bottom-24 -right-24 h-[28rem] w-[28rem] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(59,130,246,.28), transparent 65%)",
        }}
        animate={{ x: -p.x * 40, y: -p.y * 40 }}
        transition={{ type: "spring", stiffness: 30, damping: 12 }}
      />
      <motion.div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[22rem] w-[22rem] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(244,114,182,.22), transparent 65%)",
        }}
        animate={{ y: [0, -10, 0], rotate: [0, 10, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

/* -------------------- Tags / Helpers -------------------- */
const TAGS = [
  { key: "breathing", label: "Breathing", icon: Wind },
  { key: "grounding", label: "Grounding", icon: Anchor },
  { key: "opposite", label: "Opposite Action", icon: Sparkles },
  { key: "compassion", label: "Self-Compassion", icon: Heart },
  { key: "connection", label: "Connection", icon: MessageCircle },
  { key: "outdoor", label: "Outdoor", icon: TreesIcon },
];

function inferTags(t) {
  const title = (t.title || "").toLowerCase();
  const tags = [];
  if (title.includes("breath") || title.includes("5-4-3-2-1")) tags.push("breathing", "grounding");
  if (title.includes("ground")) tags.push("grounding");
  if (title.includes("opposite")) tags.push("opposite");
  if (title.includes("compassion")) tags.push("compassion");
  if (title.includes("call") || title.includes("friend")) tags.push("connection");
  if (title.includes("outside")) tags.push("outdoor");
  if (!tags.length) tags.push("grounding");
  return Array.from(new Set(tags));
}

const FAVORITES_KEY = "ns_toolbox_favs";
const NOTES_KEY_PREFIX = "ns_tool_notes_";
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/* -------------------- Mini 60s Timer Hook -------------------- */
function useMiniTimer() {
  const [running, setRunning] = useState(false);
  const [remain, setRemain] = useState(60);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setRemain((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [running]);
  return {
    running,
    remain,
    start: () => {
      setRemain(60);
      setRunning(true);
    },
    pause: () => setRunning(false),
    resume: () => setRunning(true),
    setRemain,
    setRunning,
  };
}

/* -------------------- Toolbox Page -------------------- */
export default function Toolbox() {
  const [all, setAll] = useState([]);
  const [q, setQ] = useState("");
  const [activeTags, setActiveTags] = useState([]);
  const [favs, setFavs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"); }
    catch { return []; }
  });

  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(null);
  const modalRef = useRef(null);

  useEffect(() => {
    (async () => {
      const data = await getToolbox();
      setAll(
        data.map((t) => ({ ...t, tags: t.tags?.length ? t.tags : inferTags(t) }))
      );
    })();
  }, []);

  // modal focus + gentle auto-scroll
  useEffect(() => {
    if (!open) return;
    const el = modalRef.current;
    if (!el) return;
    const doFocus = () => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
    };
    const raf = requestAnimationFrame(doFocus);
    const t = setTimeout(doFocus, 120);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [open]);

  // keyboard helpers
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key.toLowerCase() === "r") handleRandom();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    const byText = (t) =>
      !text ||
      t.title.toLowerCase().includes(text) ||
      (t.steps || []).join(" ").toLowerCase().includes(text);
    const byTags = (t) => !activeTags.length || t.tags?.some((x) => activeTags.includes(x));
    const sorted = [...all].sort((a, b) => {
      const af = favs.includes(a.id) ? 1 : 0;
      const bf = favs.includes(b.id) ? 1 : 0;
      if (af !== bf) return bf - af;
      return a.title.localeCompare(b.title);
    });
    return sorted.filter((t) => byText(t) && byTags(t));
  }, [all, q, activeTags, favs]);

  function toggleTag(tag) {
    setActiveTags((cur) =>
      cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]
    );
  }
  function toggleFav(id) {
    setFavs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  }
  function startTool(tool) {
    setCurrent(tool);
    setOpen(true);
  }
  function handleRandom() {
    if (!filtered.length) return;
    const idx = Math.floor(Math.random() * filtered.length);
    startTool(filtered[idx]);
  }

  function getNotes(id) {
    try { return localStorage.getItem(NOTES_KEY_PREFIX + id) || ""; }
    catch { return ""; }
  }
  function setNotes(id, value) {
    localStorage.setItem(NOTES_KEY_PREFIX + id, value);
  }

  /* ------------ UI -------------- */
  return (
    <div className="relative">
      <AnimatedBg />

      {/* header with animated underline */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Toolbox
            <motion.span
              layoutId="tb-underline"
              className="block h-[3px] w-20 rounded-full bg-gradient-to-r from-emerald-400 to-sky-400"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ type: "spring", stiffness: 120, damping: 18 }}
            />
          </h2>
          <p className="text-sm opacity-70">
            Filter, favorite, and launch a guided practice. Press <kbd className="kbd kbd-xs">R</kbd> for random.
          </p>
        </div>
        <div className="flex gap-2">
          <motion.button whileTap={{ scale: 0.98 }} className="btn btn-sm" onClick={handleRandom}>
            <Shuffle className="w-4 h-4 mr-1" />
            Random tool
          </motion.button>
        </div>
      </div>

      {/* search + tags */}
      <div className="mt-4 grid md:grid-cols-[1fr_auto] gap-3">
        <input
          className="input input-bordered bg-base-100/70 backdrop-blur"
          placeholder="Search steps or titles…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          {TAGS.map(({ key, label, icon: Icon }) => {
            const active = activeTags.includes(key);
            return (
              <motion.button
                key={key}
                onClick={() => toggleTag(key)}
                whileTap={{ scale: 0.97 }}
                className={[
                  "px-3 py-1 rounded-full text-sm border transition flex items-center gap-1",
                  active
                    ? "bg-gradient-to-r from-emerald-100 to-sky-100 text-emerald-700 border-emerald-200"
                    : "bg-base-100/70 border-base-300 hover:bg-base-200",
                ].join(" ")}
              >
                <Icon className="w-4 h-4" />
                {label}
              </motion.button>
            );
          })}
          {!!activeTags.length && (
            <button className="btn btn-xs btn-ghost" onClick={() => setActiveTags([])}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* grid of cards */}
      {filtered.length === 0 ? (
        <div className="opacity-70 mt-6">No tools match your filters.</div>
      ) : (
        <motion.div
          className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
        >
          {filtered.map((t) => {
            const pinned = favs.includes(t.id);
            return (
              <motion.div
                key={t.id}
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                whileHover={{ rotateX: 2, rotateY: -2 }}
                whileTap={{ scale: 0.99 }}
                className="relative rounded-2xl p-[1px] bg-gradient-to-br from-emerald-300/40 via-sky-300/30 to-fuchsia-300/40"
              >
                <div className="rounded-2xl h-full w-full bg-base-100/70 backdrop-blur shadow-sm p-4 border border-base-200">
                  {/* subtle animated sheen */}
                  <motion.div
                    className="pointer-events-none absolute inset-0 rounded-2xl"
                    style={{
                      background:
                        "linear-gradient(120deg, transparent 0%, rgba(255,255,255,.10) 20%, transparent 40%)",
                    }}
                    animate={{ backgroundPositionX: ["0%", "140%"] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                  />

                  <div className="relative z-10 flex items-start justify-between gap-2">
                    <div>
                      <div className="text-lg font-semibold">{t.title}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {t.tags?.slice(0, 3).map((tag) => {
                          const def = TAGS.find((x) => x.key === tag);
                          const Icon = def?.icon || Sparkles;
                          return (
                            <span
                              key={tag}
                              className="px-2 py-[2px] rounded-full text-[11px] bg-gradient-to-r from-base-200/80 to-base-200/40 flex items-center gap-1"
                            >
                              <Icon className="w-3 h-3" />
                              {def?.label || tag}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => toggleFav(t.id)}
                      title={pinned ? "Unpin" : "Pin to favorites"}
                    >
                      {pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    </button>
                  </div>

                  <ul className="relative z-10 mt-3 text-sm opacity-80 list-disc pl-5 space-y-1">
                    {(t.steps || []).slice(0, 3).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                    {t.steps?.length > 3 && <li className="list-none opacity-60">…</li>}
                  </ul>

                  <div className="relative z-10 mt-4 flex gap-2">
                    <button className="btn btn-sm btn-primary" onClick={() => startTool(t)}>
                      <Play className="w-4 h-4 mr-1" />
                      Start
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        setCurrent(t);
                        setOpen(true);
                      }}
                    >
                      <NotebookPen className="w-4 h-4 mr-1" />
                      Notes
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* modal */}
      <AnimatePresence>
        {open && current && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="absolute inset-0 bg-black/35 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              ref={modalRef}
              tabIndex={-1}
              className="relative w-[92vw] max-w-lg rounded-2xl p-[1px] bg-gradient-to-br from-emerald-300/40 via-sky-300/30 to-fuchsia-300/40"
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 14, opacity: 0 }}
            >
              <div className="rounded-2xl bg-base-100/80 backdrop-blur shadow-2xl p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm opacity-70">Guided practice</div>
                    <div className="text-xl font-semibold">{current.title}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* shimmer divider */}
                <motion.div
                  className="mt-3 h-[2px] w-full rounded-full bg-gradient-to-r from-transparent via-base-300 to-transparent"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2.2, repeat: Infinity }}
                />

                <ChecklistWithTimerAndNotes
                  tool={current}
                  getNotes={(id) => {
                    try { return localStorage.getItem(NOTES_KEY_PREFIX + id) || ""; }
                    catch { return ""; }
                  }}
                  setNotes={(id, v) => localStorage.setItem(NOTES_KEY_PREFIX + id, v)}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------- Modal Content -------------------- */
function ChecklistWithTimerAndNotes({ tool, getNotes, setNotes }) {
  const [done, setDone] = useState(() => new Set());
  const { running, remain, start, pause, resume, setRemain, setRunning } = useMiniTimer();
  const [burst, setBurst] = useState(0); // for emoji confetti
  useEffect(() => {
    setRunning(false);
    setRemain(60);
    setDone(new Set());
  }, [tool.id]); // reset when switching tool

  const steps = tool.steps || [];
  const allDone = done.size && done.size === steps.length;

  useEffect(() => {
    if (allDone) {
      setBurst((b) => b + 1);
      // tiny auto-fade of burst
      const t = setTimeout(() => setBurst((b) => b), 800);
      return () => clearTimeout(t);
    }
  }, [allDone]);

  function toggle(i) {
    setDone((prev) => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }

  return (
    <div className="mt-4 grid gap-4">
      {/* celebration burst */}
      <AnimatePresence>
        {allDone && (
          <motion.div
            key={`burst-${burst}`}
            className="relative"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-center">
              <span className="text-2xl">🎉</span>
              <span className="ml-2 font-medium">Nice! You checked every step.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-xl bg-base-200/70 p-3">
        <div className="text-sm font-medium">Steps</div>
        <ul className="mt-2 space-y-2">
          {steps.map((s, i) => (
            <motion.li
              key={i}
              className="flex items-start gap-2"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <button
                className={[
                  "btn btn-xs rounded-full px-2",
                  done.has(i) ? "btn-success" : "btn-ghost",
                ].join(" ")}
                onClick={() => toggle(i)}
                aria-label={done.has(i) ? "Undo step" : "Mark step done"}
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
              <div className={["text-sm", done.has(i) ? "line-through opacity-60" : ""].join(" ")}>
                {s}
              </div>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* tiny focus timer */}
      <div className="rounded-xl bg-base-200/70 p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">60-sec Focus Timer</div>
          <div className="text-2xl font-semibold tabular-nums">{fmt(remain)}</div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {!running && remain === 60 && (
            <button className="btn btn-sm" onClick={start}>
              Start
            </button>
          )}
          {running ? (
            <button className="btn btn-sm" onClick={pause}>
              Pause
            </button>
          ) : remain !== 60 ? (
            <button className="btn btn-sm" onClick={resume}>
              Resume
            </button>
          ) : null}
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => { setRunning(false); setRemain(60); }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* personal notes */}
      <div className="rounded-xl bg-base-200/70 p-3">
        <div className="text-sm font-medium">My notes</div>
        <textarea
          className="textarea textarea-bordered w-full mt-2"
          rows={3}
          defaultValue={getNotes(tool.id)}
          onBlur={(e) => setNotes(tool.id, e.target.value)}
          placeholder="Write a mantra, a cue that helps, or when you plan to use this."
        />
        <div className="text-xs opacity-60 mt-1">Notes auto-save when you leave the field.</div>
      </div>
    </div>
  );
}
