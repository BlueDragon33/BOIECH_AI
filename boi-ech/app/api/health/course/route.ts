import { getCourseDatabase } from "../../../device-auth.server";
import { publishedHealthCourseDocument } from "../../../health-content.server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const database = await getCourseDatabase();
    const course = await publishedHealthCourseDocument(database);
    return Response.json(
      { application: "child-health", course },
      {
        headers: {
          "cache-control": "public, max-age=60, stale-while-revalidate=300",
          "x-content-type-options": "nosniff",
          "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "Nội dung Sức khỏe trẻ đang tạm gián đoạn." },
      { status: 503, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } },
    );
  }
}
