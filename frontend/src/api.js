let token = null,
  refreshPromise = null;
export const setToken = (value) => {
  token = value;
};
export const getToken = () => token;
export async function refresh() {
  if (!refreshPromise)
    refreshPromise = fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Please sign in");
        const data = await res.json();
        token = data.token;
        return data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  return refreshPromise;
}
export async function api(url, options = {}, retry = true) {
  const res = await fetch("/api" + url, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401 && retry && !url.startsWith("/auth/")) {
    try {
      await refresh();
      return api(url, options, false);
    } catch {
      window.dispatchEvent(new Event("auth-expired"));
      throw new Error("Session expired. Please sign in again.");
    }
  }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || "Request failed");
  }
  return res.json();
}
export async function download(query, format) {
  const res = await fetch(
    `/api/reports/export?${new URLSearchParams({ ...query, format })}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok)
    throw new Error("Export failed. Refresh the page and try again.");
  const blob = await res.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `attendly-attendance.${format}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
