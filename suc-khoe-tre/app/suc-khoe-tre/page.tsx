import { getCourseDatabase } from "../device-auth.server";
import { publishedHealthCourseDocument, staticHealthCourseDocument } from "../health-content.server";
import HealthClient from "./health-client";
import "./health.css";

export const dynamic = "force-dynamic";

export default async function ChildHealthPage() {
  let course = staticHealthCourseDocument();
  try {
    const database = await getCourseDatabase();
    course = await publishedHealthCourseDocument(database);
  } catch {
    // The static, medically reviewed fallback keeps the site usable when D1 is temporarily unavailable.
  }
  return <HealthClient initialCourse={course} />;
}
