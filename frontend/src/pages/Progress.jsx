// src/pages/Progress.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, RadialBarChart, RadialBar
} from "recharts";
import { Flame, CalendarCheck2, Trophy, Sparkles, RefreshCcw } from "lucide-react";
import { getSummary7, listCheckins } from "../api";
import { SkeletonChart } from "../components/Skeleton";

/* -------------------- Animated Background -------------------- */
function AnimatedBg() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute -top-24 -left-24 h-96 w-96 rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(16,185,129,.35), transparent 65%)" }}
        animate={{ x: [0, 12, -6, 0], y: [0, -10, 6, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-28 -right-24 h-[28rem] w-[28rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(59,130,246,.28), transparent 65%)" }}
        animate={{ x: [0, -10, 8, 0], y: [0, 10, -8, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[22rem] w-[22rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(244,114,182,.22), transparent 65%)" }}
        animate={{ rotate: [0, 20, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

/* -------------------- Helpers -------------------- */
function toShort(dateStr) {
  // YYYY-MM-DD -> M/D
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${m}/${d}`;
}

function niceAvg(nums) {
  if (!nums?.length) return "-";
  const v = nums.reduce((a, b) => a + b, 0) / nums.length;
  return Math.round(v * 10) / 10;
}

const COLORS = {
  emerald: "#10B981",
  emeraldLight: "#A7F3D0",
  amber: "#F59E0B",
  sky: "#38BDF8",
  pink: "#EC4899",
  slate: "#94A3B8",
  baseGrid: "rgba(148,163,184,0.22)",
};

/* -------------------- Page -------------------- */
export default function Progress() {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(14); // trend range: 7/14/30
  const [summary7, setSummary7] = useState(null); // {days, meals, streak}
  const [entries, setEntries] = useState([]);     // recent N entries for trend charts

  async function load() {
    setLoading(true);
    try {
      const [s7, ls] = await Promise.all([
        getSummary7(),
        listCheckins({ limit: 60 }) // get enough to slice 7/14/30 days snapshot
      ]);
      setSummary7(s7);
      setEntries(ls);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  /* ---------- derive chart datasets ---------- */
  // Trend: sort by date ascending then slice last RANGE items (group by date if multiple per day)
  const trendData = useMemo(() => {
    if (!entries?.length) return [];
    // group same-day: average mood, max urge for the day; and count
    const map = new Map();
    entries.forEach((r) => {
      const key = r.date;
      const cur = map.get(key) || { date: key, moods: [], urges: [], mealCounts: { completed:0, partial:0, skipped:0 } };
      cur.moods.push(Number(r.mood));
      cur.urges.push(Number(r.urge));
      if (r.meal_status && cur.mealCounts[r.meal_status] !== undefined) cur.mealCounts[r.meal_status] += 1;
      map.set(key, cur);
    });
    const arr = Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(x => ({
        date: x.date,
        moodAvg: x.moods.length ? x.moods.reduce((a,b)=>a+b,0)/x.moods.length : 0,
        urgeAvg: x.urges.length ? x.urges.reduce((a,b)=>a+b,0)/x.urges.length : 0,
        completed: x.mealCounts.completed,
        partial: x.mealCounts.partial,
        skipped: x.mealCounts.skipped,
        label: toShort(x.date),
      }));
    // slice last RANGE days based on available dates
    return arr.slice(-range);
  }, [entries, range]);

  const mealPieData = useMemo(() => {
    if (!summary7?.meals) return [];
    const m = summary7.meals;
    return [
      { name: "Completed", value: m.completed, color: COLORS.emerald },
      { name: "Partial", value: m.partial, color: COLORS.amber },
      { name: "Skipped", value: m.skipped, color: COLORS.slate },
    ];
  }, [summary7]);

  const moodAvg = niceAvg(trendData.map(d => d.moodAvg));
  const urgeAvg = niceAvg(trendData.map(d => d.urgeAvg));
  const streak = summary7?.streak || 0;

  /* -------------------- UI -------------------- */
  return (
    <div className="relative">
      <AnimatedBg />

      {/* header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Progress
            <motion.span
              layoutId="progress-underline"
              className="block h-[3px] w-24 rounded-full bg-gradient-to-r from-emerald-400 to-sky-400"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ type: "spring", stiffness: 120, damping: 18 }}
            />
          </h2>
          <p className="text-sm opacity-70">
            Your recent check-ins at a glance. Soft charts, gentle gradients, and a bit of sparkle ✨
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="join">
            {[7,14,30].map(v => (
              <button
                key={v}
                onClick={()=>setRange(v)}
                className={`join-item btn btn-sm ${range===v ? "btn-primary" : ""}`}
              >
                {v}d
              </button>
            ))}
          </div>
          <button className="btn btn-sm" onClick={load}>
            <RefreshCcw className="w-4 h-4 mr-1" />
            Refresh
          </button>
        </div>
      </div>

      {/* stat tiles */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile
          icon={<Flame className="w-5 h-5" />}
          title="Current streak"
          value={`${streak} day${streak===1? "": "s"}`}
          gradient="from-orange-200/70 via-amber-100/70 to-emerald-100/70"
          hint="Consecutive days with at least one entry"
        />
        <StatTile
          icon={<CalendarCheck2 className="w-5 h-5" />}
          title={`Mood avg (${range}d)`}
          value={String(moodAvg)}
          gradient="from-emerald-100/70 via-sky-100/70 to-indigo-100/70"
          hint="1 (low) → 5 (great)"
        />
        <StatTile
          icon={<Trophy className="w-5 h-5" />}
          title={`Urge avg (${range}d)`}
          value={String(urgeAvg)}
          gradient="from-pink-100/70 via-fuchsia-100/70 to-violet-100/70"
          hint="0 (none) → 5 (strong)"
        />
      </div>

      {/* charts grid */}
<div className="mt-5 grid grid-cols-1 xl:grid-cols-2 gap-4">
  {/* Row 1: 两张并排 */}
  <ChartCard title={`Mood & Urge Trend (${range}d)`} subtitle="Daily mood average vs. urge average">
    {loading ? <ChartSkeleton /> : trendData.length === 0 ? <EmptyState /> : (
      <ResponsiveContainer width="100%" height={280}>
        <ComposedTrend data={trendData} />
      </ResponsiveContainer>
    )}
  </ChartCard>

  <ChartCard title="7-Day Meal Distribution" subtitle="Completed vs Partial vs Skipped">
    {loading ? <ChartSkeleton /> : mealPieData.length === 0 ? <EmptyState /> : (
      <div className="h-[280px] grid grid-cols-2 gap-2">
        <ResponsiveContainer>
          <PieChart>
            <Tooltip
              contentStyle={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(148,163,184,.25)", borderRadius: 12 }}
              formatter={(v, n) => [v, n]}
            />
            <Pie
              data={mealPieData}
              innerRadius={48}
              outerRadius={78}
              paddingAngle={5}
              dataKey="value"
              nameKey="name"
            >
              {mealPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-col justify-center gap-2 pr-2">
          {mealPieData.map((e) => (
            <div key={e.name} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded" style={{ background: e.color }} />
              <span className="text-sm">{e.name}</span>
              <span className="ml-auto text-sm font-semibold">{e.value}</span>
            </div>
          ))}
          <div className="mt-2 text-xs opacity-60">Based on the last 7 days.</div>
        </div>
      </div>
    )}
  </ChartCard>

  {/* Row 2: 一张全宽（相当于上面两张加起来的宽度） */}
  <div className="xl:col-span-2">
    <ChartCard title="Streak & Daily Entries" subtitle="Little wins add up" height={560}>
      {loading || !summary7 ? <ChartSkeleton /> : (
        <div className="h-full grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 左：streak 圆环 */}
          <div className="relative">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="60%"
                outerRadius="95%"
                data={[{ name: "Streak", value: Math.min(7, summary7.streak || 0) }]}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar dataKey="value" cornerRadius={8} fill={COLORS.emerald} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <div className="text-xs opacity-70">Current streak</div>
                <div className="text-3xl font-bold">{summary7.streak || 0}d</div>
                <div className="text-[10px] opacity-60">max ring shows up to 7</div>
              </div>
            </div>
          </div>

          {/* 右：按天的条形图 */}
          <ResponsiveContainer>
            <BarChart data={(summary7.days || []).map(d => ({ ...d, label: toShort(d.date) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.baseGrid} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} width={32} />
              <Tooltip
                contentStyle={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(148,163,184,.25)", borderRadius: 12 }}
                formatter={(v) => [v, "entries"]}
                labelFormatter={(l) => `Date: ${l}`}
              />
              <Bar dataKey="count" fill={COLORS.sky} radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  </div>
</div>


      {/* footer sparkles */}
      <div className="mt-6 flex items-center gap-2 text-xs opacity-70">
        <Sparkles className="w-4 h-4" />
        Progress updates whenever you log a new check-in. Keep going—you’re doing great.
      </div>
    </div>
  );
}

/* -------------------- Subcomponents -------------------- */

function StatTile({ icon, title, value, gradient, hint }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-[1px] bg-gradient-to-br ${gradient}`}
    >
      <div className="rounded-2xl bg-base-100/70 backdrop-blur shadow-sm p-4 border border-base-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-700/80">{icon}<span className="font-medium">{title}</span></div>
          <div className="text-xl font-semibold">{value}</div>
        </div>
        {hint && <div className="text-xs opacity-60 mt-1">{hint}</div>}
      </div>
    </motion.div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-[1px] bg-gradient-to-br from-emerald-300/40 via-sky-300/30 to-fuchsia-300/40"
    >
      <div className="rounded-2xl bg-base-100/75 backdrop-blur shadow-sm p-4 border border-base-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm opacity-70">{subtitle}</div>
            <div className="text-lg font-semibold">{title}</div>
          </div>
        </div>
        <div className="mt-3 h-[280px]">{children}</div>
      </div>
    </motion.div>
  );
}

function ChartSkeleton() {
  return <SkeletonChart />;
}

function EmptyState() {
  return (
    <div className="h-full w-full rounded-xl grid place-items-center bg-base-200/40">
      <div className="text-sm opacity-70">No data yet—log a few check-ins to see charts.</div>
    </div>
  );
}

/* Mood & Urge Composed Trend */
function ComposedTrend({ data }) {
  return (
    <AreaChart data={data} margin={{ left: 8, right: 8, top: 10 }}>
      <defs>
        <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COLORS.emerald} stopOpacity={0.35} />
          <stop offset="100%" stopColor={COLORS.emerald} stopOpacity={0.06} />
        </linearGradient>
        <linearGradient id="urgeFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COLORS.pink} stopOpacity={0.3} />
          <stop offset="100%" stopColor={COLORS.pink} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.baseGrid} />
      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
      <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} width={28} />
      <Tooltip
        contentStyle={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(148,163,184,.25)", borderRadius: 12 }}
        formatter={(v, name) => [Math.round(v * 10) / 10, name === "moodAvg" ? "Mood" : name === "urgeAvg" ? "Urge" : name]}
        labelFormatter={(l) => `Date: ${l}`}
      />
      <Area type="monotone" dataKey="moodAvg" stroke={COLORS.emerald} fill="url(#moodFill)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      <Line type="monotone" dataKey="urgeAvg" stroke={COLORS.pink} strokeWidth={2} dot={false} />
    </AreaChart>
  );
}
