from pathlib import Path

# 1) Client descriptor
p = Path("quan-ly-hoc-tap/app/admin-device-client.ts")
text = p.read_text()
old = '''export type ApplicationDescriptor = {
  id: string;
  name: string;
  status: "online" | "warning" | "planned";
};'''
new = '''export type ApplicationDescriptor = {
  id: string;
  name: string;
  status: "online" | "warning" | "planned";
  runtime?: {
    service?: "online" | "paused" | "unreachable";
    contractVersion?: number;
    canonicalApplication?: string | null;
    capabilities?: readonly string[];
    ready?: boolean;
    connectionState?: "ready" | "legacy" | "paused" | "unreachable";
    message?: string;
    pendingDevices?: number;
    activeSessions?: number;
  };
};'''
if old not in text:
    raise SystemExit("ApplicationDescriptor block not found")
p.write_text(text.replace(old, new, 1))

# 2) Server-side readiness probe
p = Path("quan-ly-hoc-tap/app/api/center/route.ts")
text = p.read_text()
old = '''async function applications() {
  const health = await probeHealthApplication().catch(() => null);
  return applicationRegistry.map(({ id, name, status }) => {
    if (id !== "child-health") return { id, name, status };
    return {
      id,
      name,
      status: health?.service === "online" ? "online" as const : "warning" as const,
      runtime: health ? {
        service: health.service,
        contractVersion: health.contractVersion,
        serverTime: health.serverTime,
        pendingDevices: health.devices.pending,
        activeSessions: health.sessions.active,
      } : {
        service: "unreachable",
      },
    };
  });
}'''
new = '''async function applications() {
  const health = await probeHealthApplication().catch(() => null);
  const healthCapabilities = health?.capabilities ?? [];
  const canonicalReady = health?.canonicalApplication === "suc-khoe-y-te";
  const deviceReviewReady = healthCapabilities.includes("device-review-v1");
  const boundarySafe = health?.boundary?.healthDataInControlPlane !== true;
  const healthReady = Boolean(health && health.service === "online" && canonicalReady && deviceReviewReady && boundarySafe);
  const connectionState = !health
    ? "unreachable" as const
    : health.service !== "online"
      ? "paused" as const
      : healthReady
        ? "ready" as const
        : "legacy" as const;
  const healthMessage = !health
    ? "Không kết nối được Health_Care production."
    : health.service !== "online"
      ? "Health_Care đang tạm dừng theo policy."
      : !boundarySafe
        ? "Control API báo ranh giới dữ liệu không an toàn."
        : !canonicalReady
          ? "Backend Health đang chạy contract cũ, chưa công bố canonical id suc-khoe-y-te."
          : !deviceReviewReady
            ? "Backend Health chưa công bố capability device-review-v1."
            : "Health_Care Control Plane đã sẵn sàng.";

  return applicationRegistry.map(({ id, name, status }) => {
    if (id !== "child-health") return { id, name, status };
    return {
      id,
      name,
      status: healthReady ? "online" as const : "warning" as const,
      runtime: health ? {
        service: health.service,
        contractVersion: health.contractVersion,
        canonicalApplication: health.canonicalApplication ?? null,
        capabilities: healthCapabilities,
        ready: healthReady,
        connectionState,
        message: healthMessage,
        pendingDevices: health.devices.pending,
        activeSessions: health.sessions.active,
      } : {
        service: "unreachable" as const,
        ready: false,
        connectionState,
        message: healthMessage,
      },
    };
  });
}'''
if old not in text:
    raise SystemExit("applications readiness block not found")
p.write_text(text.replace(old, new, 1))

# 3) Application card readiness details
p = Path("quan-ly-hoc-tap/app/application-hub.tsx")
text = p.read_text()
old = '''              <h2>{application.name}</h2>
              <p>{config.scope}</p>
              <div className={styles.appScope}>'''
new = '''              <h2>{application.name}</h2>
              <p>{config.scope}</p>
              {application.runtime?.message
                ? <div className={styles.runtimeStatus} data-state={application.runtime.connectionState}>
                  <strong>Kết nối Health_Care</strong>
                  <small>{application.runtime.message}</small>
                  {application.runtime.contractVersion
                    ? <small>Contract v{application.runtime.contractVersion} · {application.runtime.canonicalApplication || "alias legacy"}</small>
                    : null}
                </div>
                : null}
              <div className={styles.appScope}>'''
if old not in text:
    raise SystemExit("application card insertion point not found")
p.write_text(text.replace(old, new, 1))

# 4) Styling
p = Path("quan-ly-hoc-tap/app/center-admin.module.css")
text = p.read_text()
anchor = '''.appCard > p { margin: 0; min-height: 48px; color: #5e6965; line-height: 1.5; }
'''
addition = '''.appCard > p { margin: 0; min-height: 48px; color: #5e6965; line-height: 1.5; }
.runtimeStatus { margin-top: 12px; padding: 10px 12px; border: 1px solid #d5ddd9; border-radius: 11px; background: #f5f8f7; }
.runtimeStatus strong, .runtimeStatus small { display: block; }
.runtimeStatus strong { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
.runtimeStatus small { margin-top: 4px; color: #65706c; font-size: 11px; line-height: 1.4; }
.runtimeStatus[data-state="ready"] { border-color: #b9d8cc; background: #edf7f3; }
.runtimeStatus[data-state="legacy"], .runtimeStatus[data-state="paused"] { border-color: #e4cc8c; background: #fff8e7; }
.runtimeStatus[data-state="unreachable"] { border-color: #e2b7ad; background: #fff1ed; }
'''
if anchor not in text:
    raise SystemExit("runtime style anchor not found")
p.write_text(text.replace(anchor, addition, 1))
