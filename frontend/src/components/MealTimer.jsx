// src/pages/MealTimer.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw, SkipForward } from "lucide-react";

const DEFAULT_PHASES = [
  { key: "meal", label: "Meal", minutes: 20 },
  { key: "post", label: "Post-meal", minutes: 20 },
];

const PROMPTS = {
  meal: [
    "Slow down and chew until it’s easy to swallow 🧡",
    "Bring your attention back to your plate and yourself",
    "Give your body some trust: it’s learning to receive",
    "Breathe: inhale for 4 seconds, exhale for 6 seconds",
  ],
  post: [
    "You’ve done it — well done ✨",
    "Take a sip of warm water and stretch a little",
    "Feel the sense of safety in your body right now",
    "Say something gentle to yourself",
  ],
};

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function MealTimer({
  open,
  onClose,
  meal,                    // 可选：{ date, meal_type }
  onFinish,                // (totalSeconds) => void
  phases = DEFAULT_PHASES, // 可自定义阶段
}) {
  // ---------- 聚焦/滚动 ----------
  const rootRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const el = rootRef.current;
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

  // ---------- 配置 & 进度 ----------
  const [localPhases, setLocalPhases] = useState(phases);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(phases[0].minutes * 60);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const intervalRef = useRef(null);

  const phase = localPhases[phaseIdx];
  const totalPhaseSec = phase.minutes * 60;
  const progress = 1 - remaining / totalPhaseSec;

  const promptList = useMemo(
    () => PROMPTS[phase.key] || PROMPTS.meal,
    [phase.key]
  );
  const prompt =
    promptList[Math.floor((totalPhaseSec - remaining) / 60) % promptList.length];

  // 打开时重置
  useEffect(() => {
    if (!open) return;
    setLocalPhases(phases);
    setPhaseIdx(0);
    setRemaining(phases[0].minutes * 60);
    setRunning(false);
    setTotalElapsed(0);
  }, [open, phases]);

  // 切换阶段时同步剩余时间
  useEffect(() => {
    setRemaining(localPhases[phaseIdx].minutes * 60);
  }, [phaseIdx, localPhases]);

  // 计时循环
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r > 0) return r - 1;

        // 当前阶段结束
        setTotalElapsed((t) => t + totalPhaseSec);

        if (phaseIdx < localPhases.length - 1) {
          setPhaseIdx((i) => i + 1);
          return localPhases[phaseIdx + 1].minutes * 60;
        } else {
          // 全部完成
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setRunning(false);
          const total = totalElapsed + totalPhaseSec;
          onFinish && onFinish(total);
          onClose && onClose();
          return 0;
        }
      });
    }, 1000);
    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [running, phaseIdx, localPhases, totalPhaseSec, totalElapsed, onFinish, onClose]);

  // ---------- 交互 ----------
  function handleStartPause() {
    setRunning((v) => !v);
  }
  function handleReset() {
    if (running) return;
    setPhaseIdx(0);
    setRemaining(localPhases[0].minutes * 60);
    setTotalElapsed(0);
  }
  function handleSkip() {
    if (phaseIdx < localPhases.length - 1) {
      setPhaseIdx((i) => i + 1);
    } else {
      const total =
        totalElapsed + (localPhases[phaseIdx].minutes * 60 - remaining);
      onFinish && onFinish(total);
      onClose && onClose();
    }
  }

  // 时长选择 & 预设
  const MINUTE_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 45, 60];

  function updateMinutes(key, minutes) {
    setLocalPhases((prev) => {
      const next = prev.map((p) => (p.key === key ? { ...p, minutes } : p));
      const idx = next.findIndex((p) => p.key === key);
      if (idx === phaseIdx && !running) setRemaining(minutes * 60);
      return next;
    });
  }

  function applyPreset(mealMin, postMin) {
    setLocalPhases((prev) => {
      const next = prev.map((p) =>
        p.key === "meal"
          ? { ...p, minutes: mealMin }
          : p.key === "post"
          ? { ...p, minutes: postMin }
          : p
      );
      if (!running) {
        if (phaseIdx === 0) setRemaining(mealMin * 60);
        if (phaseIdx === 1) setRemaining(postMin * 60);
      }
      return next;
    });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
        >
          {/* 背景遮罩 */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* 弹窗 */}
          <motion.div
            ref={rootRef}
            tabIndex={-1}
            className="relative w-[92vw] max-w-md rounded-2xl bg-base-100 p-6 shadow-2xl outline-none"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 15, opacity: 0 }}
          >
            {/* 顶栏 */}
            <div className="flex items-center justify-between">
              <div className="text-sm opacity-70">
                {meal ? `${meal.date} · ${meal.meal_type}` : "Meal Timer"}
              </div>
              <button className="btn btn-ghost btn-xs" onClick={onClose}>
                Close
              </button>
            </div>

            {/* 时长选择（运行中禁用） */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="form-control">
                <span className="label-text">Meal duration (min)</span>
                <select
                  className="select select-bordered"
                  value={localPhases.find((p) => p.key === "meal")?.minutes ?? 20}
                  onChange={(e) => updateMinutes("meal", Number(e.target.value))}
                  disabled={running}
                >
                  {MINUTE_OPTIONS.map((m) => (
                    <option key={`m-${m}`} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-control">
                <span className="label-text">Post-meal (min)</span>
                <select
                  className="select select-bordered"
                  value={localPhases.find((p) => p.key === "post")?.minutes ?? 20}
                  onChange={(e) => updateMinutes("post", Number(e.target.value))}
                  disabled={running}
                >
                  {MINUTE_OPTIONS.map((m) => (
                    <option key={`p-${m}`} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* 快捷预设 */}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="btn btn-xs"
                disabled={running}
                onClick={() => applyPreset(15, 15)}
              >
                15 + 15
              </button>
              <button
                className="btn btn-xs"
                disabled={running}
                onClick={() => applyPreset(20, 20)}
              >
                20 + 20
              </button>
              <button
                className="btn btn-xs"
                disabled={running}
                onClick={() => applyPreset(25, 15)}
              >
                25 + 15
              </button>
              <button
                className="btn btn-xs"
                disabled={running}
                onClick={() => applyPreset(10, 20)}
              >
                10 + 20
              </button>
            </div>

            {/* 阶段标题 */}
            <div className="mt-3 text-xl font-semibold">
              {phase.label}{" "}
              <span className="text-sm opacity-60">({phase.minutes} min)</span>
            </div>

            {/* 圆形进度（SVG） */}
            <div className="mt-4 grid place-items-center">
              <div className="relative w-[220px] h-[220px]">
                <svg
                  className="absolute inset-0"
                  width="220"
                  height="220"
                  viewBox="0 0 100 100"
                  style={{ transform: "rotate(-90deg)" }}
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="currentColor"
                    className="opacity-10"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    className="text-emerald-500"
                    strokeDasharray={2 * Math.PI * 42}
                    strokeDashoffset={(1 - progress) * 2 * Math.PI * 42}
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                  />
                </svg>

                {/* 居中文字 */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-5xl font-bold tabular-nums leading-none">
                    {fmt(remaining)}
                  </div>
                  <div className="text-xs opacity-60 mt-1">remaining</div>
                </div>
              </div>
            </div>

            {/* 提示语 */}
            <div className="mt-4 p-3 rounded-xl bg-base-200/70 text-sm">
              {prompt}
            </div>

            {/* 控制区 */}
            <div className="mt-5 flex items-center justify-between">
              <div className="text-xs opacity-70">
                Phase {phaseIdx + 1}/{localPhases.length} · elapsed{" "}
                {fmt(totalElapsed)}
              </div>
              <div className="flex gap-2">
                <button className="btn btn-sm" onClick={handleStartPause}>
                  {running ? (
                    <>
                      <Pause className="w-4 h-4 mr-1" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-1" /> Start
                    </>
                  )}
                </button>
                <button
                  className="btn btn-sm"
                  onClick={handleReset}
                  disabled={running}
                  title={running ? "Pause first to reset" : "Reset"}
                >
                  <RotateCcw className="w-4 h-4 mr-1" /> Reset
                </button>
                <button className="btn btn-sm" onClick={handleSkip}>
                  <SkipForward className="w-4 h-4 mr-1" /> Skip
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
