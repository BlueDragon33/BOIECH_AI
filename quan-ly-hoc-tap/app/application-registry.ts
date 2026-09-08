export type ApplicationStatus = "online" | "warning" | "planned";

export type ApplicationConfig = {
  id: "boi-ech" | "child-health" | "bauman-master-ai";
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
    name: "Sức khỏe Y tế · Trẻ 9–10 tuổi",
    shortName: "Sức khỏe Y tế",
    href: "/apps/suc-khoe-tre",
    icon: "SK",
    status: "online",
    scope: "Quản trị từ xa Web App Sức khỏe Y tế 9–10 tuổi theo mô hình thiết bị của Bơi ếch, nhưng runtime và dữ liệu nghiệp vụ tách biệt hoàn toàn.",
    capabilities: ["Thiết bị & truy cập", "Quyền & cấu hình tính năng", "Nhắc lịch & Calendar", "Duyệt nội dung", "Phiên & nhật ký"],
    guardrails: ["Không nhận hồ sơ sức khỏe cá nhân", "Không dùng runtime/API/DB Bơi ếch", "Google Calendar chỉ bật theo quyền thiết bị", "Thiết bị Sức khỏe Y tế dùng mã SK riêng"],
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
  return applicationRegistry.find((application) => application.id === id);
}
