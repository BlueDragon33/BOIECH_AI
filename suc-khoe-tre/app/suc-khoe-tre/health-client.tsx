"use client";

import HealthFramework, { type HealthDeviceAccess } from "./health-framework";
import HealthFrameworkMap from "./health-framework-map";

export default function HealthClient({ initialCourse, device }: { initialCourse: unknown; device: HealthDeviceAccess }) {
  return <>
    <HealthFrameworkMap />
    <HealthFramework initialCourse={initialCourse} device={device} />
  </>;
}
