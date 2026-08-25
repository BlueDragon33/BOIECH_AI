import { requireChatGPTUser } from "../chatgpt-auth";
import { isDeviceAdminEmail } from "../device-auth.server";
import DeviceManager from "./device-manager";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DeviceAdminPage() {
  const user = await requireChatGPTUser("/quan-ly-thiet-bi");
  if (!(await isDeviceAdminEmail(user.email))) {
    return (
      <main className="device-admin device-admin-forbidden">
        <span>Không có quyền truy cập</span>
        <h1>Đây là khu quản trị thiết bị riêng.</h1>
        <p>Tài khoản đang đăng nhập không nằm trong danh sách quản trị viên.</p>
        <Link href="/">Trở về website học</Link>
      </main>
    );
  }
  return <DeviceManager />;
}
