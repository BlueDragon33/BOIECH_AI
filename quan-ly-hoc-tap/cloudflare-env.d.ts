declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    CONTROL_OWNER_EMAILS?: string;
    CONTROL_SERVICE_SECRET?: string;
  }
}
