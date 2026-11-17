/** Shared folding for Vietnamese search. Keep original text for display and citations. */
export function normalizeAiSearchText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}
