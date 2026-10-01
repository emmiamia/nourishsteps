import { Link } from "react-router-dom";
import { localDateISO } from "../utils/date";
import React, { useEffect, useState, useRef } from "react";
import { createCheckin, listCheckins, updateCheckin, deleteCheckin } from "../api";
import { motion, AnimatePresence } from "framer-motion";
import CalendarDiary from "../components/CalendarDiary";
import { Smile, Meh, Frown, Utensils, Activity } from "lucide-react";
import { SkeletonList } from "../components/Skeleton";

// 小表情
function moodEmoji(mood) {
  const map = { 1: "😔", 2: "😕", 3: "🙂", 4: "😊", 5: "😁" };
  return map[mood] || "😐";
}

export default function CheckIn() {
  // 日历选中的日期（默认今天）
  const todayISO = localDateISO();
  const [pickedDate, setPickedDate] = useState(todayISO);

  // 表单数据
  const [dateStr, setDateStr] = useState(todayISO);
  const [mood, setMood] = useState(3);
  const [urge, setUrge] = useState(0);
  const [meal, setMeal] = useState("partial");
  const [note, setNote] = useState("");

  // UI 状态
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [rows, setRows] = useState(null);
  const [editRow, setEditRow] = useState(null);

  // 用于进入编辑时自动滚动与聚焦
  const editBoxRef = useRef(null);

  const noteLimit = 500;

  // 拉取指定日期的记录
  async function refreshByDate(d) {
    const data = await listCheckins({ date: d, limit: 50 });
    setRows(data);
  }

  // 初始化：按今天加载
  useEffect(() => {
    refreshByDate(pickedDate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 进入编辑时进行滚动与聚焦
  useEffect(() => {
    if (editRow && editBoxRef.current) {
      // 平滑滚到弹窗所在区域
      editBoxRef.current.scrollIntoView({ behavior: "smooth", block: "center" });

      // 稍等一会再聚焦到第一个控件
      const t = setTimeout(() => {
        const first = editBoxRef.current.querySelector(
          "input, textarea, select, [tabindex]"
        );
        if (first && typeof first.focus === "function") first.focus();
      }, 80);
      return () => clearTimeout(t);
    }
  }, [editRow]);

  // 表单提交
  async function submit(e) {
    e.preventDefault();
    setMsg("");
    if (note.length > noteLimit) {
      setMsg(`Note too long (${note.length}/${noteLimit}).`);
      return;
    }
    setSaving(true);
    try {
      await createCheckin({
        date: dateStr,
        mood,
        urge,
        meal_status: meal,
        note: note || undefined,
      });
      setMsg("Saved. Proud of you for showing up.");
      setNote("");
      // 保存后刷新当前选中的日历日期（不强制与 dateStr 绑定）
      await refreshByDate(pickedDate);
    } catch (err) {
      setMsg("Error: " + (err.message || "Failed"));
    } finally {
      setSaving(false);
    }
  }

  // 删除
  async function onDelete(id) {
    if (!confirm("Delete this check-in?")) return;
    await deleteCheckin(id);
    await refreshByDate(pickedDate);
  }

  // 编辑保存
  async function onEditSave() {
    try {
      await updateCheckin(editRow.id, {
        date: editRow.date,
        mood: +editRow.mood,
        urge: +editRow.urge,
        meal_status: editRow.meal_status,
        note: editRow.note || null,
      });
      setEditRow(null);
      await refreshByDate(pickedDate);
    } catch (e) {
      alert("Update failed: " + (e.message || ""));
    }
  }

  // 切换日历日期
  function handlePick(d) {
    setPickedDate(d);
    refreshByDate(d);
  }

  return (
    <div className="grid gap-6">
      <Link className="link text-sm justify-self-start" to="/reflect">Try optional reflection with fictional demo data</Link>
      <h2 className="text-2xl font-medium">Daily Check-In</h2>

      {/* 表单 */}
      <form className="grid gap-4 max-w-xl" onSubmit={submit}>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="form-control">
            <span className="label-text">Date</span>
            <input
              type="date"
              className="input input-bordered"
              value={dateStr}
              max={todayISO}
              onChange={(e) => setDateStr(e.target.value)}
            />
          </label>

          <label className="form-control">
            <span className="label-text">Meal</span>
            <select
              className="select select-bordered"
              value={meal}
              onChange={(e) => setMeal(e.target.value)}
            >
              <option value="skipped">Skipped</option>
              <option value="partial">Partial</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        </div>

        <label className="form-control">
          <span className="label-text">Mood (1–5)</span>
          <input
            type="range"
            min="1"
            max="5"
            value={mood}
            onChange={(e) => setMood(+e.target.value)}
            className="range"
          />
        </label>

        <label className="form-control">
          <span className="label-text">Urge (0–5)</span>
          <input
            type="range"
            min="0"
            max="5"
            value={urge}
            onChange={(e) => setUrge(+e.target.value)}
            className="range"
          />
        </label>

        <div className="text-sm opacity-70 -mt-2">
          mood {mood} {moodEmoji(mood)} · urge {urge}
        </div>

        <label className="form-control">
          <span className="label-text">Note (optional)</span>
          <textarea
            className="textarea textarea-bordered"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything you want to remember?"
            maxLength={noteLimit}
          />
          <div className="text-xs text-right opacity-60">
            {note.length}/{noteLimit}
          </div>
        </label>

        <button className={`btn btn-primary ${saving ? "btn-disabled" : ""}`} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>

        {msg && (
          <div className={`alert ${msg.startsWith("Error") ? "alert-error" : "alert-success"}`}>
            {msg}
          </div>
        )}
      </form>

      {/* 日历 */}
      <div className="divider">Calendar</div>
      <CalendarDiary selectedDate={pickedDate} onPickDate={handlePick} />

      {/* 选中日期的记录列表 */}
      <div className="divider">Entries on {pickedDate}</div>
      {!rows ? (
        <SkeletonList count={5} />
      ) : rows.length === 0 ? (
        <div className="opacity-70">No entries for this day.</div>
      ) : (
        <div className="grid gap-4">
          {rows.map((row) => {
            // --- 视觉映射：emoji & 颜色 ---
            const moodToTheme = (m) => {
              if (m <= 1)
                return {
                  emoji: <Frown className="w-5 h-5" />,
                  title: "LOW",
                  bar: "from-rose-300 to-orange-400",
                  stripe: "bg-rose-400",
                  pill: "bg-rose-50 text-rose-700",
                };
              if (m === 2)
                return {
                  emoji: <Meh className="w-5 h-5" />,
                  title: "MEH",
                  bar: "from-amber-300 to-orange-400",
                  stripe: "bg-amber-400",
                  pill: "bg-amber-50 text-amber-700",
                };
              if (m === 3)
                return {
                  emoji: <Meh className="w-5 h-5" />,
                  title: "OKAY",
                  bar: "from-sky-300 to-indigo-400",
                  stripe: "bg-sky-400",
                  pill: "bg-sky-50 text-sky-700",
                };
              if (m === 4)
                return {
                  emoji: <Smile className="w-5 h-5" />,
                  title: "GOOD",
                  bar: "from-emerald-300 to-teal-400",
                  stripe: "bg-emerald-400",
                  pill: "bg-emerald-50 text-emerald-700",
                };
              return {
                emoji: <Smile className="w-5 h-5" />,
                title: "GREAT",
                bar: "from-green-300 to-teal-500",
                stripe: "bg-green-500",
                pill: "bg-green-50 text-green-700",
              };
            };
            const t = moodToTheme(row.mood);

            // 饭量标签
            const mealLabel =
              row.meal_status === "completed"
                ? "completed meal"
                : row.meal_status === "partial"
                ? "partial meal"
                : "skipped meal";
            const mealPill =
              row.meal_status === "completed"
                ? "bg-emerald-50 text-emerald-700"
                : row.meal_status === "partial"
                ? "bg-amber-50 text-amber-700"
                : "bg-slate-50 text-slate-600";

            return (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative rounded-2xl bg-base-200/70 shadow-sm hover:shadow-md transition overflow-hidden"
              >
                {/* 左侧情绪色条 */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${t.stripe}`} />

                <div className="p-4 md:p-5">
                  {/* 头部：emoji + 日期 + 操作 */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid place-items-center rounded-full bg-white/70 w-8 h-8 shadow-sm">
                        {t.emoji}
                      </div>
                      <div>
                        <div className="text-lg md:text-xl font-semibold">{row.date}</div>
                        {/* 胶囊标签区 */}
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${mealPill}`}>
                            <Utensils className="inline-block w-3.5 h-3.5 -mt-0.5 mr-1" />
                            {mealLabel}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${t.pill}`}>
                            <Activity className="inline-block w-3.5 h-3.5 -mt-0.5 mr-1" />
                            urge {row.urge}
                          </span>
                          {/* 情绪标题（可选视觉锚点） */}
                          <span className="px-2 py-0.5 rounded-full text-xs bg-white/60 text-slate-700">
                            {t.title}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button className="btn btn-sm" onClick={() => setEditRow({ ...row })}>
                        Edit
                      </button>
                      <button className="btn btn-sm btn-error" onClick={() => onDelete(row.id)}>
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Note */}
                  {row.note && (
                    <div className="mt-3 text-sm italic opacity-85 leading-relaxed">
                      “{row.note}”
                    </div>
                  )}

                  {/* Urge 渐变进度条 */}
                  <div className="mt-4">
                    <div className="w-full h-2 rounded-full bg-base-300/60 overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${t.bar}`}
                        style={{ width: `${(row.urge / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* 编辑弹窗（自定义 fixed 居中 + 背景遮罩） */}
      <AnimatePresence>
        {editRow && (
          <motion.div
            key="edit-modal"
            className="fixed inset-0 z-50 grid place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-modal="true"
            role="dialog"
          >
            {/* 背景遮罩 */}
            <div
              className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
              onClick={() => setEditRow(null)}
            />

            {/* 居中弹窗 */}
            <motion.div
              ref={editBoxRef}
              className="relative w-[92vw] max-w-lg rounded-2xl bg-base-100 p-5 shadow-xl"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
            >
              <h3 className="font-bold text-lg">Edit Check-In</h3>

              <div className="grid gap-3 mt-3">
                <input
                  type="date"
                  className="input input-bordered"
                  value={editRow.date}
                  max={todayISO}
                  onChange={(e) => setEditRow({ ...editRow, date: e.target.value })}
                />

                <label className="form-control">
                  <span className="label-text">Mood (1–5)</span>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    className="range"
                    value={editRow.mood}
                    onChange={(e) => setEditRow({ ...editRow, mood: +e.target.value })}
                  />
                </label>

                <label className="form-control">
                  <span className="label-text">Urge (0–5)</span>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    className="range"
                    value={editRow.urge}
                    onChange={(e) => setEditRow({ ...editRow, urge: +e.target.value })}
                  />
                </label>

                <select
                  className="select select-bordered"
                  value={editRow.meal_status}
                  onChange={(e) => setEditRow({ ...editRow, meal_status: e.target.value })}
                >
                  <option value="skipped">Skipped</option>
                  <option value="partial">Partial</option>
                  <option value="completed">Completed</option>
                </select>

                <textarea
                  className="textarea textarea-bordered"
                  value={editRow.note || ""}
                  onChange={(e) => setEditRow({ ...editRow, note: e.target.value })}
                  maxLength={500}
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button className="btn" onClick={() => setEditRow(null)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={onEditSave}>
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
