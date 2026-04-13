/** Safe image URL for React Native Image (invalid URIs can crash). */
export function filterImageUrls(images) {
  if (!Array.isArray(images)) return [];
  return images.filter(
    (u) => typeof u === "string" && /^https?:\/\//i.test(u.trim()),
  );
}

export function priorityAccent(priorityLabel) {
  const x = String(priorityLabel || "").toLowerCase();
  if (x.includes("critical")) return { border: "#FF3B30", soft: "rgba(255, 59, 48, 0.12)", text: "#C62828" };
  if (x.includes("high")) return { border: "#FF9500", soft: "rgba(255, 149, 0, 0.14)", text: "#C05621" };
  if (x.includes("medium")) return { border: "#007AFF", soft: "rgba(0, 122, 255, 0.1)", text: "#007AFF" };
  if (x.includes("low")) return { border: "#8E8E93", soft: "rgba(142, 142, 147, 0.14)", text: "#636366" };
  return { border: "#C7C7CC", soft: "rgba(199, 199, 204, 0.2)", text: "#3C3C43" };
}

/** Status label from API is human-readable e.g. "Scheduled". */
export function statusAccent(statusLabel) {
  const s = String(statusLabel || "").toLowerCase();
  if (s.includes("schedul")) return { bg: "rgba(0, 122, 255, 0.14)", text: "#007AFF", border: "#007AFF" };
  if (s.includes("progress")) return { bg: "rgba(255, 149, 0, 0.18)", text: "#C05621", border: "#FF9500" };
  if (s.includes("complet")) return { bg: "rgba(52, 199, 89, 0.16)", text: "#1B5E20", border: "#34C759" };
  if (s.includes("cancel")) return { bg: "rgba(142, 142, 147, 0.2)", text: "#636366", border: "#8E8E93" };
  if (s.includes("pending")) return { bg: "rgba(175, 82, 222, 0.14)", text: "#7B1FA2", border: "#AF52DE" };
  return { bg: "rgba(142, 142, 147, 0.14)", text: "#3C3C43", border: "#8E8E93" };
}

export function formatActivityTime(t) {
  if (t == null || t === "") return "";
  return String(t).slice(0, 5);
}
