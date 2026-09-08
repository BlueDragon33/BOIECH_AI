import HealthDeviceGate from "./device-gate";
import "./health-framework.css";
import "./health-polish.css";
import "./control-plane.css";

export const dynamic = "force-dynamic";

export default function ChildHealthPage() {
  return <HealthDeviceGate />;
}
