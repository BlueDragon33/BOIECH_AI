// Import binding types without adding the Workers runtime globals to browser files.
declare namespace Cloudflare {
  interface Env {
    DB: import("@cloudflare/workers-types").D1Database;
    BUCKET?: import("@cloudflare/workers-types").R2Bucket;
    CONTROL_SERVICE_SECRET?: string;
    DEVICE_ADMIN_EMAILS?: string;
  }
}

declare module "cloudflare:workers" {
  const env: Cloudflare.Env;
  export { env };
}
