import {
  createSiteAccessSession,
  deviceErrorResponse,
  getCourseDatabase,
  getSiteAccessPolicy,
  verifySiteDeviceProof,
} from "../../../device-auth.server";
import { publishedHealthCourseDocument, staticHealthCourseDocument } from "../../../health-content.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const hostname = new URL(request.url).hostname;
    const previewRequest = hostname === "terminal.local" || hostname === "localhost";
    const device = await verifySiteDeviceProof(payload, previewRequest);
    let course = staticHealthCourseDocument();
    try {
      const database = await getCourseDatabase();
      course = await publishedHealthCourseDocument(database);
    } catch {
      // Keep the reviewed static course as fallback after device access was verified.
    }
    const [session, policy] = await Promise.all([
      createSiteAccessSession(device.deviceId),
      getSiteAccessPolicy(),
    ]);
    return Response.json(
      { application: "child-health", device, course, session, policy },
      { headers: { "cache-control": "no-store, private" } },
    );
  } catch (error) {
    return deviceErrorResponse(error);
  }
}
