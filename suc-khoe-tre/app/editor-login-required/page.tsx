export const dynamic = "force-dynamic";
export default function EditorLoginRequired() {
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f3f7f6", fontFamily: "system-ui, sans-serif" }}><section style={{ maxWidth: 620, background: "white", padding: 28, borderRadius: 18, boxShadow: "0 14px 40px rgba(0,0,0,.08)" }}><h1>Cần mở trình biên tập từ Trung tâm quản trị</h1><p>Để bảo vệ nội dung y tế, trình biên tập chỉ tạo phiên đăng nhập sau khi thiết bị quản trị đã được xác thực tại Trung tâm.</p><a href="https://learning-management.boiech-ai.workers.dev/apps/suc-khoe-tre">Mở quản trị Sức khỏe trẻ</a></section></main>;
}
