"use client";

import HealthFramework from "./health-framework";

export default function HealthClient({ initialCourse }: { initialCourse: unknown }) {
  return <HealthFramework initialCourse={initialCourse} />;
}
