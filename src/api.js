const base = import.meta.env.VITE_API_URL || "";
export async function api(path, options = {}) {
  const headers = { ...options.headers };
  const token = sessionStorage.getItem("atlas-token");
  if (token) headers["X-App-Token"] = token;
  if (options.body && !(options.body instanceof FormData))
    headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await fetch(base + "/api" + path, { ...options, headers });
  } catch {
    throw new Error(
      "Cannot connect to the backend. Start FastAPI on port 8000 and check the API URL.",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The backend returned an unreadable response. Check the server or reverse proxy.",
    );
  }
  if (!response.ok) {
    const err = new Error(data.error?.message || "The request failed. Please retry.");
    err.code = data.error?.code || "ERROR";
    err.status = response.status;
    throw err;
  }
  return data;
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
