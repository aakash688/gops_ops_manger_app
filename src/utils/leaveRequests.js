import { apiGetJson, apiPostJson } from "@/utils/api";

/**
 * Org-wide leave list (`name` filters via backend). API also returns `meta.stats` if you need it elsewhere.
 */
export async function fetchLeaveRequests(params = {}) {
  const sp = new URLSearchParams();
  sp.set("limit", String(params.limit ?? 50));
  sp.set("offset", String(params.offset ?? 0));
  if (params.status && params.status !== "ALL") {
    sp.set("status", params.status);
  }
  const name = typeof params.name === "string" ? params.name.trim() : "";
  if (name.length > 0) {
    sp.set("name", name);
  }
  return apiGetJson(`/leave-requests?${sp.toString()}`);
}

export async function createLeaveRequest(payload) {
  return apiPostJson("/leave-requests", payload);
}
