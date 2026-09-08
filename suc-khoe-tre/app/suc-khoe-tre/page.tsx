import HealthDeviceGate from "./device-gate";
import "./health-framework.css";

export const dynamic = "force-dynamic";

export default function ChildHealthPage() {
  return <HealthDeviceGate />;
}
