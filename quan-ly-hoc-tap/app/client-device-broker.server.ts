import type { ControlRole } from "./control-device.server";
import { manageBaumanDevice, readBaumanDevices } from "./bauman-bridge.server";
import { manageHealthDevice, readHealthDevices } from "./health-bridge.server";
import { manageRuLifeDevice, readRuLifeDevices, type RuLifeControlDevice } from "./ru-life-bridge.server";

export type ClientDeviceOperation = "approve" | "remove";
export type ClientDeviceAutomationMode = "off" | "approve" | "remove";

export type ClientDeviceView = {
  applicationId: "child-health" | "bauman-master-ai" | "ru-life";
  applicationName: string;
  applicationIcon: string;
  adminHref: string;
  deviceId: string;
  deviceCode: string;
  displayName: string;
  userName?: string | null;
  userCode?: string | null;
  deviceType: string;
  status: "pending" | "approved" | "blocked";
  createdAt: string | null;
  lastSeenAt: string | null;
  active: boolean;
  approveMode: "direct" | "app-admin";
  removeMode: "direct" | "app-admin";
  actionNote?: string | null;
};

export type ClientDeviceSource = {
  applicationId: string;
  applicationName: string;
  applicationIcon: string;
  adminHref: string | null;
  state: "ready" | "unreachable" | "app-admin" | "unsupported";
  directApprove: boolean;
  directRemove: boolean;
  message: string;
};

export type ClientDeviceSnapshot = {
  devices: ClientDeviceView[];
  sources: ClientDeviceSource[];
  syncedAt: string;
};

export class ClientDeviceBrokerError extends Error {
  applicationId: string;
  adminHref: string | null;
  constructor(message: string, applicationId: string, adminHref: string | null = null) {
    super(message);
    this.applicationId = applicationId;
    this.adminHref = adminHref;
  }
}

const sourceCatalog = {
  "child-health": { applicationName: "Sức khỏe Y tế", applicationIcon: "YT", adminHref: "/apps/suc-khoe-tre" },
  "bauman-master-ai": { applicationName: "Bauman Hub", applicationIcon: "BM", adminHref: "/apps/bauman-master-ai" },
  "ru-life": { applicationName: "Hòa nhập Nga", applicationIcon: "RU", adminHref: "/apps/ru-life" },
} as const;

type DirectApplicationId = keyof typeof sourceCatalog;

function safeDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function sourceError(applicationId: DirectApplicationId, error: unknown): ClientDeviceSource {
  const config = sourceCatalog[applicationId];
  return {
    applicationId,
    ...config,
    state: "unreachable",
    directApprove: false,
    directRemove: false,
    message: error instanceof Error ? error.message : "Không đọc được registry thiết bị của ứng dụng.",
  };
}

async function healthSnapshot(actor: string, role: ControlRole): Promise<{ devices: ClientDeviceView[]; source: ClientDeviceSource }> {
  const config = sourceCatalog["child-health"];
  const devices = await readHealthDevices(actor, role);
  return {
    devices: devices.map((device) => ({
      applicationId: "child-health", ...config,
      deviceId: device.deviceId, deviceCode: device.deviceCode,
      displayName: device.label || device.autoLabel || device.deviceCode,
      deviceType: device.deviceType === "phone" ? "Điện thoại" : device.deviceType === "tablet" ? "Máy tính bảng" : "Máy tính",
      status: device.status, createdAt: safeDate(device.createdAt), lastSeenAt: safeDate(device.lastSeenAt), active: device.active === true,
      approveMode: "direct", removeMode: "direct", actionNote: null,
    })),
    source: { applicationId: "child-health", ...config, state: "ready", directApprove: true, directRemove: true, message: "Duyệt/Loại bỏ ghi trực tiếp vào registry Health_Care." },
  };
}

async function baumanSnapshot(actor: string, role: ControlRole): Promise<{ devices: ClientDeviceView[]; source: ClientDeviceSource }> {
  const config = sourceCatalog["bauman-master-ai"];
  const devices = await readBaumanDevices(actor, role);
  return {
    devices: devices.map((device) => ({
      applicationId: "bauman-master-ai", ...config,
      deviceId: device.deviceId, deviceCode: device.deviceCode,
      displayName: device.displayName || device.label || [device.platform, device.browser].filter(Boolean).join(" · ") || device.deviceCode,
      deviceType: "Máy tính", status: device.status, createdAt: safeDate(device.createdAt), lastSeenAt: safeDate(device.lastSeenAt), active: device.active === true,
      approveMode: "direct", removeMode: "direct", actionNote: null,
    })),
    source: { applicationId: "bauman-master-ai", ...config, state: "ready", directApprove: role === "owner", directRemove: role === "owner", message: role === "owner" ? "Duyệt/Loại bỏ ghi trực tiếp vào Bauman Control Service." : "Bauman yêu cầu owner cho thao tác thay đổi thiết bị." },
  };
}

async function ruLifeSnapshot(actor: string, role: ControlRole, controlDeviceId: string): Promise<{ devices: ClientDeviceView[]; source: ClientDeviceSource }> {
  const config = sourceCatalog["ru-life"];
  const devices = await readRuLifeDevices(actor, role, controlDeviceId);
  const canManage = role === "publisher" || role === "owner";
  return {
    devices: devices.map((device) => {
      const needsBinding = device.status === "pending" && (!device.userName || !device.userCode);
      return {
        applicationId: "ru-life" as const, ...config,
        deviceId: device.deviceId, deviceCode: device.deviceCode,
        displayName: device.userName || device.label || `${device.osName || "Thiết bị"} · ${device.browserName || "trình duyệt"}`,
        userName: device.userName ?? null, userCode: device.userCode ?? null,
        deviceType: device.deviceClass === "phone" ? "Điện thoại" : device.deviceClass === "tablet" ? "Máy tính bảng" : device.deviceClass === "computer" ? "Máy tính" : "Chưa xác định",
        status: device.status, createdAt: safeDate(device.createdAt), lastSeenAt: safeDate(device.lastSeenAt), active: device.active === true,
        approveMode: canManage && !needsBinding ? "direct" as const : "app-admin" as const,
        removeMode: canManage ? "direct" as const : "app-admin" as const,
        actionNote: needsBinding ? "Cần gắn Họ tên + Mã người dùng trong quản trị Hòa nhập Nga trước khi duyệt." : null,
      };
    }),
    source: { applicationId: "ru-life", ...config, state: "ready", directApprove: canManage, directRemove: canManage, message: "Registry HN vẫn thuộc RU_LIFE; duyệt cần đủ thông tin người dùng, loại bỏ có hiệu lực trực tiếp." },
  };
}

export async function readClientDeviceSnapshot(actor: string, role: ControlRole, controlDeviceId: string): Promise<ClientDeviceSnapshot> {
  const settled = await Promise.allSettled([
    healthSnapshot(actor, role),
    baumanSnapshot(actor, role),
    ruLifeSnapshot(actor, role, controlDeviceId),
  ]);
  const ids: DirectApplicationId[] = ["child-health", "bauman-master-ai", "ru-life"];
  const devices: ClientDeviceView[] = [];
  const sources: ClientDeviceSource[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") { devices.push(...result.value.devices); sources.push(result.value.source); }
    else sources.push(sourceError(ids[index], result.reason));
  });
  sources.push(
    { applicationId: "boi-ech", applicationName: "Bơi ếch AI", applicationIcon: "BE", adminHref: "/apps/boi-ech", state: "app-admin", directApprove: false, directRemove: false, message: "Thiết bị Bơi ếch xử lý trong quản trị Bơi ếch; Trung tâm không ghi thay registry." },
    { applicationId: "growup-mychildren", applicationName: "GrowUP MyChildren", applicationIcon: "GU", adminHref: null, state: "unsupported", directApprove: false, directRemove: false, message: "GrowUP chưa có Control API production." },
  );
  devices.sort((left, right) => {
    const rank = (status: string) => status === "pending" ? 0 : status === "approved" ? 1 : 2;
    return rank(left.status) - rank(right.status) || (Date.parse(right.lastSeenAt || right.createdAt || "") || 0) - (Date.parse(left.lastSeenAt || left.createdAt || "") || 0);
  });
  return { devices, sources, syncedAt: new Date().toISOString() };
}

export async function manageClientDevice(actor: string, role: ControlRole, controlDeviceId: string, applicationId: string, deviceId: string, operation: ClientDeviceOperation) {
  if (applicationId === "child-health") {
    await manageHealthDevice(actor, role, deviceId, operation);
    return;
  }
  if (applicationId === "bauman-master-ai") {
    if (role !== "owner") throw new ClientDeviceBrokerError("Bauman yêu cầu owner; hãy vào quản trị Bauman để xử lý.", applicationId, sourceCatalog[applicationId].adminHref);
    await manageBaumanDevice(actor, role, deviceId, operation);
    return;
  }
  if (applicationId === "ru-life") {
    const devices = await readRuLifeDevices(actor, role, controlDeviceId);
    const device = devices.find((item) => item.deviceId === deviceId);
    if (!device) throw new ClientDeviceBrokerError("Thiết bị Hòa nhập Nga không còn trong registry.", applicationId, sourceCatalog[applicationId].adminHref);
    if (operation === "approve" && (!device.userName || !device.userCode)) throw new ClientDeviceBrokerError("Duyệt Hòa nhập Nga cần gắn Họ tên + Mã người dùng trong quản trị app.", applicationId, sourceCatalog[applicationId].adminHref);
    await manageRuLifeDevice(actor, role, controlDeviceId, device as RuLifeControlDevice, operation);
    return;
  }
  const fallback = applicationId === "boi-ech" ? "/apps/boi-ech" : null;
  throw new ClientDeviceBrokerError("Ứng dụng chưa có thao tác thiết bị trực tiếp tại Trung tâm.", applicationId, fallback);
}
