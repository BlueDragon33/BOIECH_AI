"use client";

import HealthFramework, { type HealthDeviceAccess } from "./health-framework";

export default function HealthClient({ initialCourse, device }: { initialCourse: unknown; device: HealthDeviceAccess }) {
  return <HealthFramework initialCourse={initialCourse} device={device} />;
}
