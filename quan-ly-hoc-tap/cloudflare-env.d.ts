declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    CONTROL_OWNER_EMAILS?: string;
    CONTROL_SERVICE_SECRET?: string;
    HEALTH_CONTROL_SERVICE_SECRET?: string;
    HEALTH_CONTROL_BASE_URL?: string;
    BAUMAN_CONTROL_SERVICE_SECRET?: string;
    BAUMAN_CONTROL_BASE_URL?: string;
    RU_LIFE_CONTROL_SERVICE_SECRET?: string;
    RU_LIFE_BASE_URL?: string;
  }
}
