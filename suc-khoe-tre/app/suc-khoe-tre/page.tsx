import HealthDeviceGate from "./device-gate";
import "./health.css";
import "./device-access.css";

export const dynamic = "force-dynamic";

export default function ChildHealthPage() {
  return <HealthDeviceGate />;
}
