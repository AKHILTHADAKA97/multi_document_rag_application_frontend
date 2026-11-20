const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  ""
).replace(/\/+$/, "");

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
      "Cannot connect to the backend server. Please verify the backend is running and reachable.",
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
