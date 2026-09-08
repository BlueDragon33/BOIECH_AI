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
    guardrails: ["Không quản trị Sức khỏe trẻ", "Không quản trị Bauman", "Không cấp quyền thiết bị quản trị trung tâm"],
  },
  {
    id: "child-health",
    name: "Sức khỏe trẻ 9 tháng–5 tuổi",
    shortName: "Sức khỏe trẻ",
    href: "/apps/suc-khoe-tre",
    icon: "SK",
    status: "online",
    scope: "Quản trị thiết bị truy cập, quyền chỉnh sửa và nội dung của riêng Sức khỏe trẻ.",
    capabilities: ["Thiết bị & phân loại", "Cấp/khóa truy cập", "Cấp quyền sửa", "Kiểm duyệt & xuất bản", "Rollback"],
    guardrails: ["Không nhận hồ sơ sức khỏe cá nhân", "Không dùng API/DB Bơi ếch", "Thiết bị Sức khỏe trẻ dùng mã SK riêng"],
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
