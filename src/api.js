let rawBase = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  ""
).replace(/\/+$/, "");

// On Windows, localhost:8000 often resolves to IPv6 [::1] where Docker/WSL listens,
// resulting in 404s. Normalize localhost:8000 to IPv4 127.0.0.1:8000.
if (rawBase.includes("localhost:8000")) {
  rawBase = rawBase.replace("localhost:8000", "127.0.0.1:8000");
}

const API_BASE_URL = rawBase;

export { API_BASE_URL };

export async function api(path, options = {}) {
  const headers = { ...options.headers };
  const token = sessionStorage.getItem("atlas-token");
  if (token) headers["X-App-Token"] = token;
  if (options.body && !(options.body instanceof FormData))
    headers["Content-Type"] = "application/json";

  const url = `${API_BASE_URL}/api${path}`;
  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (err) {
    throw new Error(
      "Cannot connect to the backend server. If hosted on Render free tier, the instance may be waking up from cold sleep (takes ~45s). Please wait a moment and retry.",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    if (response.status === 502 || response.status === 503) {
      throw new Error(
        `Backend service unavailable (${response.status} Bad Gateway). The application may be starting up or restarting on Render.`,
      );
    }
    throw new Error(
      `The backend returned an unreadable response (HTTP ${response.status}). Check server logs.`,
    );
  }
  if (!response.ok) {
    const message =
      data.error?.message ||
      data.answer ||
      data.message ||
      (response.status === 401
        ? "Authentication failed (401). Please enter a valid workspace token."
        : response.status === 429
        ? "Rate limit reached. Please wait a moment and try again."
        : `Request failed with status ${response.status}.`);
    const err = new Error(message);
    err.code = data.error?.code || (response.status === 401 ? "UNAUTHORIZED" : "ERROR");
    err.status = response.status;
    throw err;
  }
  return data;
}

export async function checkBackendConnection() {
  const t0 = performance.now();
  try {
    const res = await fetch(`${API_BASE_URL}/health/live`, { cache: "no-store" });
    const ms = Math.round(performance.now() - t0);
    if (res.ok) {
      return { connected: true, latency: ms, status: "active", message: `Connected (${ms} ms)` };
    }
    return { connected: false, latency: ms, status: "error", message: `HTTP ${res.status}` };
  } catch (err) {
    const ms = Math.round(performance.now() - t0);
    return {
      connected: false,
      latency: ms,
      status: "unreachable",
      message: "Backend unreachable. Render free tier may be waking up from cold sleep (~45s).",
    };
  }
}

export async function apiStream(path, options = {}, callbacks = {}) {
  const { onStage, onToken, onComplete, onError, signal } = callbacks;
  const headers = { ...options.headers };
  const token = sessionStorage.getItem("atlas-token");
  if (token) headers["X-App-Token"] = token;
  if (options.body && !(options.body instanceof FormData))
    headers["Content-Type"] = "application/json";
  headers["Accept"] = "text/event-stream";

  const url = `${API_BASE_URL}/api${path}`;
  let response;
  try {
    response = await fetch(url, { ...options, headers, signal });
  } catch (err) {
    if (signal?.aborted) return;
    const errorObj = {
      code: "NETWORK_ERROR",
      message: "Cannot connect to the backend server. Please verify the backend is running and reachable.",
    };
    if (onError) onError(errorObj);
    throw new Error(errorObj.message);
  }

  if (!response.ok) {
    let errData;
    try {
      errData = await response.json();
    } catch {
      errData = {};
    }
    const errorObj = {
      code: errData.error?.code || errData.code || "ERROR",
      message: errData.error?.message || errData.answer || errData.message || "Request failed.",
    };
    if (onError) onError(errorObj);
    const err = new Error(errorObj.message);
    err.code = errorObj.code;
    throw err;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        if (!part.trim()) continue;
        let eventType = "message";
        let dataStr = "";
        for (const line of part.split("\n")) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            dataStr = line.slice(6).trim();
          }
        }
        if (!dataStr) continue;
        try {
          const payload = JSON.parse(dataStr);
          if (eventType === "stage" && onStage) {
            onStage(payload);
          } else if (eventType === "token" && onToken) {
            onToken(payload.token);
          } else if (eventType === "complete" && onComplete) {
            onComplete(payload);
          } else if (eventType === "error" && onError) {
            onError(payload);
          }
        } catch (e) {
          console.error("Failed to parse SSE payload", dataStr, e);
        }
      }
    }
  } catch (err) {
    if (signal?.aborted) return;
    if (onError) onError({ code: "STREAM_ERROR", message: err.message });
    throw err;
  }
}
export function downloadJSON(value, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
