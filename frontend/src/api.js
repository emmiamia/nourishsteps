// frontend/src/api.js
// In production (with nginx), use relative paths. In dev, use explicit API URL.
const API = import.meta.env.VITE_API || (import.meta.env.PROD ? "" : "http://localhost:5001");

/** 通用请求封装（带超时 & 统一错误解析） */
async function request(path, { method = "GET", json, signal, headers = {} } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s 超时
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        ...(json ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: json ? JSON.stringify(json) : undefined,
      signal: signal || controller.signal,
    });
    const contentType = res.headers.get("content-type") || "";
    const isJSON = contentType.includes("application/json");

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      if (isJSON) {
        const data = await res.json().catch(() => ({}));
        msg = data.error || data.message || msg;
      } else {
        const text = await res.text().catch(() => "");
        if (text) msg = text;
      }
      throw new Error(msg);
    }

    return isJSON ? res.json() : res.text();
  } finally {
    clearTimeout(timeout);
  }
}

/** 简单工具：对象 -> 查询串 */
function qs(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/* -------------------------------
 * Check-ins
 * ----------------------------- */

export async function getSummary7() {
  return request("/api/summary7");
}

// 注意：需要后端实现 /api/checkins/month?year=YYYY&month=MM
export async function getMonth(year, month) {
  return request(`/api/checkins/month${qs({ year, month })}`);
}

export async function createCheckin(payload) {
  return request("/api/checkins", { method: "POST", json: payload });
}

export async function listCheckins({ date, limit = 10 } = {}) {
  return request(`/api/checkins${qs({ date, limit })}`);
}

export async function updateCheckin(id, patch) {
  return request(`/api/checkins/${id}`, { method: "PATCH", json: patch });
}

export async function deleteCheckin(id) {
  return request(`/api/checkins/${id}`, { method: "DELETE" });
}

export async function listResources() {
  return request("/api/resources");
}

/** 可选：内置一组本地工具箱（无后端也能用） */
export async function getToolbox() {
  return [
    { id: 1, title: "5-4-3-2-1 Grounding", steps: ["Name 5 things you see", "4 you feel", "3 you hear", "2 you smell", "1 you taste"] },
    { id: 2, title: "Urge Surfing", steps: ["Notice urge as a wave", "Breathe through crest", "Remind: urges pass"] },
    { id: 3, title: "Self-Compassion", steps: ["Hands on heart", "Say: “This is hard. Others feel this too. May I be kind.”"] },
    { id: 4, title: "Opposite Action", steps: ["If urge to isolate → text a friend", "If urge to restrict → plan a gentle snack"] },
    { id: 5, title: "10-min Outside", steps: ["Shoes on", "Outside for 10 minutes", "Notice 3 pleasant things"] },
    { id: 6, title: "Call a Friend", steps: ['Send “Can we chat 5 min?”', "Schedule a time"] },
  ];
}

/* -------------------------------
 * Meals
 * ----------------------------- */

export async function listMeals({ date, limit = 50 } = {}) {
  return request(`/api/meals${qs({ date, limit })}`);
}

export async function createMeal(payload) {
  return request("/api/meals", { method: "POST", json: payload });
}

export async function updateMeal(id, payload) {
  return request(`/api/meals/${id}`, { method: "PATCH", json: payload });
}

export async function deleteMeal(id) {
  return request(`/api/meals/${id}`, { method: "DELETE" });
}

export async function mealsSummary7() {
  return request("/api/meals/summary7");
}

export async function getMealsMonth(year, month){
  return request(`/api/meals/month${qs({ year, month })}`);
}

