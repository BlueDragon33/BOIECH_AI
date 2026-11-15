/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import type { D1Database } from "@cloudflare/workers-types";
export { ChatRealtimeHub } from "./chat-realtime";

interface Env {
  // Match vinext's standard web Request/Response bridge at the asset boundary.
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: D1Database;
  CHAT_HUB?: {idFromName(name:string):unknown; get(id:unknown):{fetch(request:Request):Promise<Response>}};
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/course/conversations/socket") {
      // A one-time ticket is issued only after the existing P-256 device proof.
      if (request.method !== "GET" || request.headers.get("upgrade")?.toLowerCase() !== "websocket")
        return new Response("Upgrade required", { status: 426 });
      if (request.headers.get("origin") !== url.origin)
        return new Response("Cross-origin WebSocket forbidden", { status: 403 });
      if (!env.CHAT_HUB) return new Response("Realtime not configured", { status: 503 });
      const protocols = (request.headers.get("sec-websocket-protocol") ?? "").split(",").map(x => x.trim());
      if (protocols.length !== 2 || protocols[0] !== "boi-ech.v16" || !protocols[1].startsWith("ticket.") || !/^[a-f0-9]{32}$/.test(protocols[1].slice(7)))
        return new Response("Invalid WebSocket protocol", { status: 401 });
      const stub = env.CHAT_HUB.get(env.CHAT_HUB.idFromName("conversations-v16"));
      return stub.fetch(new Request("https://realtime.internal/socket", request));
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
