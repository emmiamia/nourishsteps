import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { getMonth } from "../api";

const WEEK = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function heatClass(count){
  if (count === 0) return "bg-base-200";
  if (count === 1) return "bg-emerald-100/60";
  if (count === 2) return "bg-emerald-200/70";
  if (count >= 3) return "bg-emerald-300/70";
  return "bg-base-200";
}

/**
 * CalendarDiary
 * props:
 * - selectedDate: "YYYY-MM-DD"
 * - onPickDate: (isoDate) => void
 * - badges?: Record<string, number>  // 覆盖显示用的每日计数（如 Meals 的数量）
 * - hideCounts?: boolean             // 不显示任何数字徽标
 * - onMonthChange?: (year, month) => void  // 当月份改变时调用
 */
export default function CalendarDiary({
  onPickDate,
  selectedDate,
  badges = null,
  hideCounts = false,
  onMonthChange,
}){
  const today = new Date();
  const todayISO = today.toISOString().slice(0,10);

  const [y0,m0] = useMemo(()=>[
    selectedDate ? Number(selectedDate.slice(0,4)) : today.getFullYear(),
    selectedDate ? Number(selectedDate.slice(5,7)) : (today.getMonth()+1)
  ], [selectedDate]);

  const [year, setYear]   = useState(y0);
  const [month, setMonth] = useState(m0);
  const [data, setData]   = useState(null);
  const monthInputRef     = useRef(null);

  // 拉取该月的天列表（如果你的 getMonth 还包含 count 字段也没关系，下面会用 badges/hideCounts 覆盖）
  useEffect(()=>{ getMonth(year, month).then(setData); }, [year, month]);

  // 通知父组件月份变化
  useEffect(() => {
    if (onMonthChange) {
      onMonthChange(year, month);
    }
  }, [year, month, onMonthChange]);

  const firstWeekday = (y,m) => new Date(y, m-1, 1).getDay();
  const fd = firstWeekday(year, month);

  const go = (delta)=>{
    let nm = month + delta, ny = year;
    if (nm < 1){ nm = 12; ny--; }
    if (nm > 12){ nm = 1; ny++; }
    setMonth(nm); setYear(ny);
  };

  const openMonthPicker = ()=>{
    const input = monthInputRef.current;
    if (!input) return;
    try { if (typeof input.showPicker === "function") input.showPicker(); else input.click(); }
    catch { input.click(); }
  };

  const handleMonthInputChange = (e)=>{
    const val = e.target.value;
    if (!val) return;
    const [yy, mm] = val.split("-").map(Number);
    setYear(yy);
    setMonth(mm);
  };

  const goToday = ()=>{
    const ty = today.getFullYear();
    const tm = today.getMonth()+1;
    setYear(ty);
    setMonth(tm);
    onPickDate?.(todayISO);
  };

  return (
    <div className="grid gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="btn btn-sm" onClick={()=>go(-1)}>←</button>

          <button
            onClick={openMonthPicker}
            className="text-lg font-medium px-2 py-1 rounded-md hover:bg-base-200 transition cursor-pointer"
          >
            {year} / {String(month).padStart(2,"0")}
          </button>

          <button className="btn btn-sm" onClick={()=>go(1)}>→</button>
          <button className="btn btn-sm btn-ghost" onClick={goToday}>Today</button>

          <input
            ref={monthInputRef}
            type="month"
            value={`${year}-${String(month).padStart(2,"0")}`}
            onChange={handleMonthInputChange}
            className="sr-only"
          />
        </div>
        <div className="text-sm opacity-70">Click a day to view entries</div>
      </div>

      {/* Week header */}
      <div className="grid grid-cols-7 text-xs opacity-70">
        {WEEK.map(w => <div key={w} className="text-center py-1">{w}</div>)}
      </div>

      {!data ? (
        <div className="h-40 grid place-items-center">Loading…</div>
      ) : (
        <motion.div
          key={`${year}-${month}`}
          initial={{opacity:0, y:6}}
          animate={{opacity:1, y:0}}
          className="grid grid-cols-7 gap-[3px]"
        >
          {/* 前置空格 */}
          {Array.from({length: fd}).map((_,i)=> <div key={`b-${i}`} />)}

          {/* 日期格 */}
          {data.days.map((d) => {
            const dayNum = Number(d.date.slice(8,10));
            const isSelected = selectedDate === d.date;
            const isToday = d.date === todayISO;

            // 使用传入的 badges / hideCounts 覆盖显示数量
            const displayCount = hideCounts
              ? 0
              : (badges ? (badges[d.date] || 0) : (d.count || 0));

            return (
              <button
                key={d.date}
                onClick={()=> onPickDate?.(d.date)}
                title={
                  displayCount
                    ? `entries ${displayCount}`
                    : "no entries"
                }
                className={[
                  "relative w-full aspect-[4/3] min-h-[1.6rem] p-[2px] flex items-center justify-center text-center rounded-md border border-transparent",
                  heatClass(displayCount),
                  isSelected
                    ? "bg-emerald-700 text-white font-bold"
                    : "text-gray-800 hover:brightness-105 hover:shadow-sm transition",
                  isToday && !isSelected ? "ring-1 ring-emerald-400" : "",
                  "text-[13px] sm:text-sm"
                ].join(" ")}
              >
                <span>{dayNum}</span>

                {/* 数量徽标（根据 displayCount 判断；hideCounts=true 时不会出现） */}
                {displayCount > 0 && !isSelected && (
                  <div
                    className="absolute top-0 right-0 text-[9px] px-[4px] rounded-full text-white"
                    style={{
                      background: "linear-gradient(135deg, rgba(16,185,129,0.9), rgba(52,211,153,0.9))",
                      boxShadow: "0 0 2px rgba(0,0,0,0.2)"
                    }}
                  >
                    {displayCount}
                  </div>
                )}
              </button>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
