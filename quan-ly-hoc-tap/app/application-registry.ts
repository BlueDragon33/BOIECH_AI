export type ApplicationStatus = "online" | "warning" | "planned";

export type ApplicationConfig = {
  id: "boi-ech" | "child-health" | "bauman-master-ai";
  canonicalId?: string;
  aliases?: readonly string[];
  name: string;
  shortName: string;
  href: string;
  icon: string;
  status: ApplicationStatus;
  scope: string;
  capabilities: readonly string[];
  guardrails: readonly string[];
};

export const applicationRegistry: readonly ApplicationConfig[] = [
  {
    id: "boi-ech",
    name: "Bơi ếch AI",
    shortName: "Bơi ếch",
    href: "/apps/boi-ech",
    icon: "BE",
    status: "online",
    scope: "Quản trị vận hành riêng của hệ thống học Bơi ếch.",
    capabilities: ["Thiết bị học & truy cập", "Tiến độ học", "AI", "Thanh toán & thời hạn", "Duyệt nội dung"],
    guardrails: ["Không quản trị Sức khỏe Y tế", "Không quản trị Bauman", "Không cấp quyền thiết bị quản trị trung tâm"],
  },
  {
    id: "child-health",
    canonicalId: "suc-khoe-y-te",
    aliases: ["child-health", "suc-khoe-tre"],
    name: "Sức khỏe Y tế · 9–18 tuổi",
    shortName: "Sức khỏe Y tế",
    href: "/apps/suc-khoe-tre",
    icon: "SK",
    status: "online",
    scope: "Quản trị từ xa ứng dụng Sức khỏe Y tế 9–18 tuổi. Health_Care hoạt động độc lập; Trung tâm chỉ điều khiển thiết bị, truy cập, phiên, chính sách, quyền tính năng và quy trình nội dung qua Control API.",
    capabilities: ["Tự nhận diện loại thiết bị", "Thiết bị & truy cập", "Quyền & cấu hình tính năng", "Nhắc lịch & Calendar", "Duyệt nội dung", "Phiên & nhật ký"],
    guardrails: ["Không nhận hồ sơ sức khỏe cá nhân", "Không dùng runtime/API/DB Bơi ếch", "Không dùng MAC/IMEI làm danh tính", "Google Calendar chỉ bật theo quyền thiết bị", "Thiết bị Sức khỏe Y tế dùng Installation ID + P-256 + mã SK riêng"],
  },
  {
    id: "bauman-master-ai",
    name: "Bauman Master AI",
    shortName: "Bauman",
    href: "/apps/bauman-master-ai",
    icon: "BM",
    status: "planned",
    scope: "Khu quản trị riêng cho lộ trình, môn học và các contract quản trị Bauman.",
    capabilities: ["Khung quản trị độc lập", "Lộ trình & môn học", "Contract dữ liệu riêng"],
    guardrails: ["Không mở thẳng Site Bauman từ Trung tâm", "Không dùng hàng đợi Bơi ếch", "Chỉ bật chức năng đã có backend quản trị"],
  },
];

export function getApplicationConfig(id: string) {
  return applicationRegistry.find((application) => application.id === id || application.canonicalId === id || application.aliases?.includes(id));
}
