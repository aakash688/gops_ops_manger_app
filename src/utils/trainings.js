import { apiGetJson } from "@/utils/api";

/**
 * Org trainings list (`title` = search on training title). Response includes `meta.stats` when API sends it.
 */
export async function fetchTrainings(params = {}) {
  const sp = new URLSearchParams();
  sp.set("limit", String(params.limit ?? 50));
  sp.set("offset", String(params.offset ?? 0));
  if (params.status && params.status !== "ALL") {
    sp.set("status", params.status);
  }
  const title = typeof params.title === "string" ? params.title.trim() : "";
  if (title.length > 0) {
    sp.set("title", title);
  }
  return apiGetJson(`/trainings?${sp.toString()}`);
}

export async function fetchTrainingById(id) {
  return apiGetJson(`/trainings/${id}`);
}
