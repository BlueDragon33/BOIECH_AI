// Owner-approved FREE reuse, 2026-11-08. Never accept another app's live D1.
export const PREVIEW_MIGRATIONS_TABLE = "boi_ech_preview_migrations";
const RETIRED_NAME = "bauman-control-preview-db";
const RETIRED_ID = "4094a621-3b81-4533-9694-4a2103e03363";

export function previewD1Policy(env = process.env) {
  const name = String(env.BOI_ECH_PREVIEW_D1_DATABASE_NAME ?? "boi-ech-preview-db").trim();
  const id = String(env.BOI_ECH_PREVIEW_D1_DATABASE_ID ?? "").trim().toLowerCase();
  if (name === RETIRED_NAME && id === RETIRED_ID) return { name, id, borrowed: true };
  if (name === "boi-ech-preview-db" && id !== RETIRED_ID) return { name, id, borrowed: false };
  throw new Error("Preview D1 name/UUID is outside the dedicated or explicitly approved retired Preview policy.");
}
