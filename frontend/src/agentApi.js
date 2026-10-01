const API = import.meta.env.VITE_API || (import.meta.env.PROD ? '' : 'http://localhost:5001');
const OWNER_KEY = 'ns_reflection_demo_owner';
export function ownerToken() {
  let token = localStorage.getItem(OWNER_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(OWNER_KEY, token);
  }
  return token;
}
export async function agentRequest(path, { method = 'GET', body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const res = await fetch(`${API}/api/agent${path}`, {
      method, signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'X-Reflection-Owner': ownerToken() },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Reflection is unavailable. Please try again.');
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('This is taking longer than expected. Your message is still here; please try again.');
    throw error;
  } finally { clearTimeout(timer); }
}
