export class DeviceAccessError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function getCourseDatabase() {
  const workers = await import("cloudflare:workers");
  if (!workers.env.DB) throw new DeviceAccessError("Cơ sở dữ liệu Sức khỏe trẻ chưa sẵn sàng.", 503, "HEALTH_DATABASE_UNAVAILABLE");
  return workers.env.DB;
}

export function deviceErrorResponse(error: unknown) {
  if (error instanceof DeviceAccessError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
  }
  return Response.json({ error: "Dịch vụ Sức khỏe trẻ đang tạm gián đoạn." }, { status: 500, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
}
