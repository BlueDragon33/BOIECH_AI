declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    BUCKET?: R2Bucket;
    CONTROL_SERVICE_SECRET?: string;
    DEVICE_ADMIN_EMAILS?: string;
  }
}
