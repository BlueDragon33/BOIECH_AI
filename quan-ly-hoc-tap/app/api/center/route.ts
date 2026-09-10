import { applicationRegistry } from "../../application-registry";
import { probeBaumanApplication } from "../../bauman-bridge.server";
import {
  ControlAccessError,
  controlErrorResponse,
  getControlDatabase,
  isOwnerEmail,
  verifyControlProof,
  type ControlRole,
} from "../../control-device.server";
import { probeHealthApplication } from "../../health-bridge.server";
import { probeRuLifeApplication } from "../../ru-life-bridge.server";

export const dynamic = "force-dynamic";

const CONTROL_PRESENCE_TIMEOUT_MS = 150_000;

type ControlDeviceRow = {
  device_id: string;
  display_code: string;
  email: string;
  status: "pending" | "approved" | "blocked";
  label: string | null;
  created_at: string;
  approved_at: string | null;
  blocked_at: string | null;
  last_seen_at: string;
  role: ControlRole | null;
  display_name: string | null;
  member_status: "active" | "inactive" | null;
};

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" },
  });
}

async function controlDevices() {
  const database = await getControlDatabase();
  const result = await database.prepare(
    `SELECT d.device_id, d.display_code, d.email, d.status, d.label, d.created_at,
            d.approved_at, d.blocked_at, d.last_seen_at, m.role, m.display_name,
            m.status AS member_status
       FROM control_devices d LEFT JOIN control_members m ON m.email = d.email
      ORDER BY CASE d.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
               d.last_seen_at DESC LIMIT 200`,
  ).all<ControlDeviceRow>();

  return result.results.map((row) => {
    const lastSeenTime = Date.parse(row.last_seen_at);
    const active = row.status === "approved"
      && row.member_status === "active"
      && Number.isFinite(lastSeenTime)
      && Date.now() - lastSeenTime <= CONTROL_PRESENCE_TIMEOUT_MS;
    return {
      deviceId: row.device_id,
      deviceCode: row.display_code,
      email: row.email,
      displayName: row.display_name ?? row.email,
      status: row.status,
      role: row.role ?? "viewer",
      memberStatus: row.member_status ?? "unregistered",
      label: row.label,
      createdAt: row.created_at,
      approvedAt: row.approved_at,
      blockedAt: row.blocked_at,
      lastSeenAt: row.last_seen_at,
      offlineSinceAt: active || !Number.isFinite(lastSeenTime) ? null : new Date(lastSeenTime + CONTROL_PRESENCE_TIMEOUT_MS).toISOString(),
      active,
      owner: row.role === "owner",
    };
  });
}

async function audit(actor: string, action: string, target: string, detail: Record<string, unknown> = {}) {
  const database = await getControlDatabase();
  await database.prepare("INSERT INTO control_audit_log (actor, action, target, detail_json) VALUES (?, ?, ?, ?)")
    .bind(actor, action, target, JSON.stringify(detail)).run();
}

async function localAuditRows() {
  const database = await getControlDatabase();
  const result = await database.prepare(
    `SELECT id, actor, action, target, detail_json, created_at
       FROM control_audit_log ORDER BY id DESC LIMIT 100`,
  ).all<{ id: number; actor: string; action: string; target: string; detail_json: string; created_at: string }>();
  return result.results.map((row) => {
    let detail: Record<string, unknown> = {};
    try { detail = JSON.parse(row.detail_json) as Record<string, unknown>; } catch { detail = {}; }
    return { id: `control-${row.id}`, source: "Trung tâm", actor: row.actor, action: row.action, target: row.target, detail, createdAt: row.created_at };
  });
}

async function applications() {
  const [health, bauman, ruLife] = await Promise.all([
    probeHealthApplication().catch(() => null),
    probeBaumanApplication().catch(() => null),
    probeRuLifeApplication().catch(() => null),
  ]);

  const healthCapabilities = health?.capabilities ?? [];
  const healthReady = Boolean(
    health
      && health.service === "online"
      && health.canonicalApplication === "suc-khoe-y-te"
      && healthCapabilities.includes("device-review-v1")
      && health.boundary?.healthDataInControlPlane !== true,
  );
  const healthState = !health ? "unreachable" as const : health.service !== "online" ? "paused" as const : healthReady ? "ready" as const : "legacy" as const;
  const healthMessage = !health
    ? "Không kết nối được Health_Care production."
    : healthReady
      ? "Health_Care Control API sẵn sàng; registry thiết bị vẫn thuộc Health_Care."
      : "Health_Care đã phản hồi nhưng contract chưa đủ điều kiện quản trị trực tiếp.";

  const baumanReadiness = bauman?.readiness ?? {};
  const baumanReady = Boolean(
    bauman
      && bauman.ok
      && baumanReadiness.runtime === "available"
      && baumanReadiness.deviceRegistry === "available"
      && baumanReadiness.deviceGateway === "available",
  );
  const baumanMessage = !bauman
    ? "Không kết nối được Bauman Control Service production."
    : baumanReady
      ? "Bauman Control Service sẵn sàng; thiết bị và quyết định duyệt/loại bỏ được ghi tại Bauman."
      : "Bauman đã phản hồi nhưng deviceRegistry/deviceGateway chưa sẵn sàng.";

  const ruReady = Boolean(ruLife?.ok && ruLife.application === "ru-life");
  const ruMessage = ruReady
    ? "RU_LIFE Control API sẵn sàng; registry HN, người dùng và phiên vẫn thuộc RU_LIFE."
    : "Không kết nối được RU_LIFE Control API production.";

  const base = applicationRegistry.map(({ id, name, status }) => {
    if (id === "child-health") {
      return {
        id,
        name,
        status: healthReady ? "online" as const : "warning" as const,
        runtime: health ? {
          service: health.service,
          contractVersion: health.contractVersion,
          canonicalApplication: health.canonicalApplication ?? null,
          buildRevision: health.buildRevision ?? null,
          buildSource: health.buildSource ?? null,
          capabilities: healthCapabilities,
          ready: healthReady,
          connectionState: healthState,
          message: healthMessage,
          pendingDevices: health.devices.pending,
          activeSessions: health.sessions.active,
        } : {
          service: "unreachable" as const,
          ready: false,
          connectionState: healthState,
          message: healthMessage,
        },
      };
    }

    if (id === "bauman-master-ai") {
      return {
        id,
        name,
        status: baumanReady ? "online" as const : "warning" as const,
        runtime: bauman ? {
          service: "online" as const,
          canonicalApplication: "bauman-master-ai",
          buildRevision: bauman.buildRevision ?? null,
          buildSource: bauman.buildSource ?? null,
          capabilities: bauman.capabilities ?? [],
          ready: baumanReady,
          connectionState: baumanReady ? "ready" as const : "legacy" as const,
          message: baumanMessage,
          pendingDevices: bauman.counts?.pendingDevices,
          activeSessions: bauman.counts?.activeSessions,
        } : {
          service: "unreachable" as const,
          ready: false,
          connectionState: "unreachable" as const,
          message: baumanMessage,
        },
      };
    }

    return { id, name, status };
  });

  return [
    ...base,
    {
      id: "ru-life",
      name: "Hòa nhập Nga",
      status: ruReady ? "online" as const : "warning" as const,
      runtime: {
        service: ruReady ? "online" as const : "unreachable" as const,
        canonicalApplication: "hoa-nhap-nga",
        capabilities: ruReady ? ["device-review-v1", "p256-device-proof-v1", "client-owned-registry-v1"] : [],
        ready: ruReady,
        connectionState: ruReady ? "ready" as const : "unreachable" as const,
        message: ruMessage,
      },
    },
  ];
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const actorDevice = await verifyControlProof(payload, undefined, previewRequest);
    const action = typeof payload.action === "string" ? payload.action : "bootstrap";

    if (action === "bootstrap") {
      return json({
        actor: actorDevice,
        applications: await applications(),
        controlDevices: actorDevice.role === "owner" ? await controlDevices() : [],
        auditLog: ["publisher", "owner"].includes(actorDevice.role) ? await localAuditRows() : [],
        upstreamError: null,
      });
    }

    if (action !== "manage-control-device") {
      throw new ControlAccessError("Thao tác Trung tâm quản trị không hợp lệ.", 400, "INVALID_CENTER_ACTION");
    }

    if (actorDevice.role !== "owner") {
      throw new ControlAccessError("Chỉ chủ hệ thống được quản lý thiết bị và tài khoản quản trị.", 403, "OWNER_REQUIRED");
    }

    const targetId = typeof payload.targetDeviceId === "string" ? payload.targetDeviceId : "";
    const operation = typeof payload.operation === "string" ? payload.operation : "";
    const database = await getControlDatabase();
    const target = await database.prepare(
      `SELECT d.email, m.status AS member_status
         FROM control_devices d LEFT JOIN control_members m ON m.email = d.email
        WHERE d.device_id = ?`,
    ).bind(targetId).first<{ email: string; member_status: "active" | "inactive" | null }>();

    if (!target) throw new ControlAccessError("Không tìm thấy thiết bị quản trị.", 404, "CONTROL_DEVICE_NOT_FOUND");
    if (targetId === actorDevice.deviceId || await isOwnerEmail(target.email)) {
      throw new ControlAccessError("Không thể thay đổi quyền thiết bị của chủ hệ thống tại đây.", 409, "OWNER_DEVICE_PROTECTED");
    }

    if (operation === "approve") {
      const role = typeof payload.role === "string" && ["reviewer", "publisher"].includes(payload.role) ? payload.role : "reviewer";
      const displayName = typeof payload.displayName === "string" ? payload.displayName.trim().slice(0, 100) : "";
      await database.batch([
        database.prepare(
          `INSERT INTO control_members (email, display_name, role, status, created_by)
           VALUES (?, ?, ?, 'active', ?)
           ON CONFLICT(email) DO UPDATE SET display_name=excluded.display_name,
             role=excluded.role, status='active', updated_at=CURRENT_TIMESTAMP`,
        ).bind(target.email, displayName || null, role, actorDevice.email),
        database.prepare("UPDATE control_devices SET status='approved', approved_at=CURRENT_TIMESTAMP, blocked_at=NULL WHERE device_id=?").bind(targetId),
      ]);
      await audit(actorDevice.email, "control_device_approved", targetId, { role });
    } else if (operation === "block") {
      await database.prepare("UPDATE control_devices SET status='blocked', blocked_at=CURRENT_TIMESTAMP WHERE device_id=?").bind(targetId).run();
      await audit(actorDevice.email, "control_device_blocked", targetId);
    } else if (operation === "deactivate-member") {
      await database.batch([
        database.prepare("UPDATE control_members SET status='inactive', updated_at=CURRENT_TIMESTAMP WHERE email=?").bind(target.email),
        database.prepare("UPDATE control_devices SET status='blocked', blocked_at=CURRENT_TIMESTAMP WHERE email=?").bind(target.email),
      ]);
      await audit(actorDevice.email, "control_member_deactivated", target.email, { targetDeviceId: targetId });
    } else if (operation === "delete-member") {
      if (target.member_status !== "inactive") throw new ControlAccessError("Hãy thu hồi tài khoản trước khi xóa vĩnh viễn.", 409, "CONTROL_MEMBER_MUST_BE_INACTIVE");
      await database.batch([
        database.prepare("DELETE FROM control_challenges WHERE device_id IN (SELECT device_id FROM control_devices WHERE email=?)").bind(target.email),
        database.prepare("DELETE FROM control_devices WHERE email=?").bind(target.email),
        database.prepare("DELETE FROM control_members WHERE email=? AND status='inactive'").bind(target.email),
      ]);
      await audit(actorDevice.email, "control_member_deleted", target.email, { targetDeviceId: targetId });
    } else {
      throw new ControlAccessError("Thao tác thiết bị quản trị không hợp lệ.", 400, "INVALID_CONTROL_OPERATION");
    }

    return json({ controlDevices: await controlDevices(), auditLog: await localAuditRows(), applications: await applications() });
  } catch (error) {
    return controlErrorResponse(error);
  }
}
