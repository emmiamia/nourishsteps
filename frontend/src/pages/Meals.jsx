// src/pages/Meals.jsx
import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Utensils, Pencil, Trash2, Plus } from "lucide-react";
import { listMeals, createMeal, updateMeal, deleteMeal, mealsSummary7, getMealsMonth } from "../api";
import CalendarDiary from "../components/CalendarDiary";
import MealTimer from "../components/MealTimer";

export default function Meals(){
  const todayISO = new Date().toISOString().slice(0,10);
  const [pickedDate, setPickedDate] = useState(todayISO);

  const [mealType, setMealType] = useState("breakfast"); // 新增：早餐/午餐/晚餐/加餐
  const [list, setList] = useState(null);
  const [stats, setStats] = useState(null);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState(null);
  const [showTimer, setShowTimer] = useState(false);

  // Track displayed month in calendar (separate from pickedDate)
  const [displayYear, setDisplayYear] = useState(new Date().getFullYear());
  const [displayMonth, setDisplayMonth] = useState(new Date().getMonth() + 1);

  // Fetch meals count for displayed month to show in calendar
  const [mealsBadges, setMealsBadges] = useState({});
  useEffect(() => {
    getMealsMonth(displayYear, displayMonth)
      .then(data => {
        const badges = {};
        data.days.forEach(day => {
          badges[day.date] = day.count;
        });
        setMealsBadges(badges);
      })
      .catch(err => {
        console.error('Failed to load meals month data:', err);
        setMealsBadges({});
      });
  }, [displayYear, displayMonth]);

  // Handle month change from calendar
  function handleMonthChange(year, month) {
    setDisplayYear(year);
    setDisplayMonth(month);
  }

  async function refreshAll(date = pickedDate){
    const [rows, s7] = await Promise.all([
      listMeals({ date, limit: 100 }),
      mealsSummary7()
    ]);
    setList(rows);
    setStats(s7);
    
    // Also refresh badges if the meal is in the currently displayed month
    const mealYear = date ? Number(date.slice(0,4)) : null;
    const mealMonth = date ? Number(date.slice(5,7)) : null;
    if (mealYear === displayYear && mealMonth === displayMonth) {
      // Refresh badges for current displayed month
      getMealsMonth(displayYear, displayMonth)
        .then(data => {
          const badges = {};
          data.days.forEach(day => {
            badges[day.date] = day.count;
          });
          setMealsBadges(badges);
        })
        .catch(err => {
          console.error('Failed to refresh meals month data:', err);
        });
    }
  }
  useEffect(()=>{ refreshAll(); }, []);
  useEffect(()=>{ refreshAll(pickedDate); }, [pickedDate]);

  // 直接保存一条 meal（不计时）
  async function quickLog(){
    setSaving(true);
    try{
      await createMeal({
        date: pickedDate,
        type: "meal",
        meal_type: mealType,      // 关键：写入 meal_type
        note: ""
      });
      await refreshAll(pickedDate);
    } finally { setSaving(false); }
  }

  // 计时结束回调：写入 log（带时长）
  async function handleTimerFinish(totalSeconds){
    await createMeal({
      date: pickedDate,
      type: "meal",
      meal_type: mealType,
      duration_sec: totalSeconds,
      note: ""
    });
    await refreshAll(pickedDate);
  }

  async function onDelete(id){
    if(!confirm("Delete this meal log?")) return;
    await deleteMeal(id);
    await refreshAll(pickedDate);
  }
  async function onEditSave(){
    await updateMeal(editing.id, {
      date: editing.date,
      type: editing.type || "meal",
      meal_type: editing.meal_type || "meal",
      note: editing.note || ""
    });
    setEditing(null);
    await refreshAll(pickedDate);
  }

  const Card = ({title, value, desc}) => (
    <div className="rounded-2xl bg-base-200/70 p-4">
      <div className="text-sm opacity-70">{title}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
      {desc && <div className="text-xs mt-2 opacity-70">{desc}</div>}
      <div className="w-full h-2 mt-3 rounded-full bg-base-300" />
    </div>
  );

  return (
    <div className="grid gap-6">
      {/* 顶部操作 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-medium">Meals</h2>
        <div className="flex items-center gap-2">
          <select
            className="select select-bordered"
            value={mealType}
            onChange={(e)=>setMealType(e.target.value)}
            title="Meal type"
          >
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>

          <button className="btn" onClick={quickLog} disabled={saving}>
            <Utensils className="w-4 h-4 mr-1" /> Save Log
          </button>
          <button className="btn btn-primary" onClick={()=>setShowTimer(true)}>
            Start Timer
          </button>
        </div>
      </div>

      {/* 顶部统计 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card title="Completed (7d)" value={`${stats?.meals?.completed ?? 0}%`} />
        <Card title="Partial (7d)"   value={`${stats?.meals?.partial ?? 0}%`} />
        <Card title="Skipped (7d)"   value={`${stats?.meals?.skipped ?? 0}%`} />
        <Card title="Streak (days)"  value={`${stats?.streak ?? 0}`} desc="consecutive days with any meal logged" />
      </div>

      <div className="divider">Calendar</div>
      {/* 这里的 CalendarDiary 使用 badges 显示 meal 数，而不是 check-in 数 */}
      <CalendarDiary 
        selectedDate={pickedDate} 
        onPickDate={setPickedDate}
        badges={mealsBadges}
        onMonthChange={handleMonthChange}
      />

      <div className="divider">Logs on {pickedDate}</div>
      {!list ? (
        <div>Loading…</div>
      ) : list.length === 0 ? (
        <div className="opacity-70">No meals yet. Try “Save Log” or “Start Timer”.</div>
      ) : (
        <div className="grid gap-3">
          {list.map(row => (
            <motion.div key={row.id} initial={{opacity:0, y:6}} animate={{opacity:1, y:0}}
              className="rounded-2xl bg-base-200/70 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 grid place-items-center rounded-full bg-white/70">
                  <Utensils className="w-4 h-4" />
                </div>
                <div className="font-medium">{row.date} · {row.meal_type || row.type || "meal"}</div>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-sm" onClick={()=>setEditing({...row})}>
                  <Pencil className="w-4 h-4 mr-1"/> Edit
                </button>
                <button className="btn btn-sm btn-error" onClick={()=>onDelete(row.id)}>
                  <Trash2 className="w-4 h-4 mr-1"/> Delete
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* 编辑弹窗 */}
      <AnimatePresence>
        {editing && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center"
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          >
            <div className="absolute inset-0 bg-black/30" onClick={()=>setEditing(null)} />
            <motion.div className="relative w-[92vw] max-w-md bg-base-100 rounded-2xl p-5 shadow-xl"
              initial={{y:20, opacity:0}} animate={{y:0, opacity:1}} exit={{y:10, opacity:0}}>
              <h3 className="font-bold text-lg">Edit Meal</h3>
              <div className="grid gap-3 mt-3">
                <input type="date" className="input input-bordered" value={editing.date}
                  max={new Date().toISOString().slice(0,10)}
                  onChange={e=>setEditing({...editing, date:e.target.value})} />
                <select className="select select-bordered" value={editing.meal_type || "meal"}
                  onChange={e=>setEditing({...editing, meal_type: e.target.value})}>
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
                <textarea className="textarea textarea-bordered" placeholder="note (optional)"
                  value={editing.note || ""} onChange={e=>setEditing({...editing, note: e.target.value})}/>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button className="btn" onClick={()=>setEditing(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={onEditSave}>Save</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 计时器弹窗：传入选择的 mealType 与当日日期 */}
      <MealTimer
        open={showTimer}
        onClose={()=>setShowTimer(false)}
        meal={{ date: pickedDate, meal_type: mealType }}
        onFinish={handleTimerFinish}
      />
    </div>
  );
}
