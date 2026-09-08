"use client";

import { useMemo, useState } from "react";

type SectionId = "today" | "growth" | "nutrition" | "activity" | "care" | "journal" | "profile";
type TaskKey = "breakfast" | "water" | "movement" | "teethMorning" | "teethEvening" | "sleep";
type ModuleCard = { title: string; description: string; status?: string; meta?: string };

const navigation: { id: SectionId; label: string; short: string }[] = [
  { id: "today", label: "Hôm nay", short: "01" },
  { id: "growth", label: "Tăng trưởng", short: "02" },
  { id: "nutrition", label: "Dinh dưỡng", short: "03" },
  { id: "activity", label: "Vận động", short: "04" },
  { id: "care", label: "Chăm sóc", short: "05" },
  { id: "journal", label: "Nhật ký", short: "06" },
  { id: "profile", label: "Hồ sơ", short: "07" },
];

const todayTasks: { key: TaskKey; label: string; group: string }[] = [
  { key: "breakfast", label: "Ăn sáng", group: "Dinh dưỡng" },
  { key: "water", label: "Theo dõi nước uống", group: "Dinh dưỡng" },
  { key: "movement", label: "Có vận động trong ngày", group: "Vận động" },
  { key: "teethMorning", label: "Đánh răng buổi sáng", group: "Chăm sóc" },
  { key: "teethEvening", label: "Đánh răng buổi tối", group: "Chăm sóc" },
  { key: "sleep", label: "Chuẩn bị ngủ đúng kế hoạch", group: "Giấc ngủ" },
];

const sectionCards: Record<Exclude<SectionId, "today">, ModuleCard[]> = {
  growth: [
    { title: "Chiều cao", description: "Lưu từng lần đo theo ngày và theo dõi xu hướng dài hạn.", status: "Chưa có số đo mới", meta: "Mốc 9–10 tuổi" },
    { title: "Cân nặng", description: "Theo dõi biến động theo thời gian, không đánh giá chỉ từ một lần đo.", status: "Chưa có số đo mới" },
    { title: "BMI theo tuổi", description: "Khung dành cho đánh giá theo tuổi và giới tính khi triển khai dữ liệu chuẩn.", status: "Chờ cấu hình dữ liệu chuẩn" },
    { title: "Lịch sử tăng trưởng", description: "3 tháng · 6 tháng · 1 năm · toàn bộ lịch sử.", meta: "Biểu đồ sẽ được làm sâu ở giai đoạn sau" },
  ],
  nutrition: [
    { title: "Nhóm thực phẩm", description: "Đạm · rau · trái cây · sữa/sản phẩm tương đương · ngũ cốc/tinh bột · nước.", status: "Checklist hằng ngày" },
    { title: "Nhật ký bữa ăn", description: "Bữa sáng · trưa · phụ · tối; ghi món, nhóm thực phẩm và mức ăn.", status: "Ghi nhanh" },
    { title: "Nước", description: "Theo dõi bằng đơn vị cốc/khẩu phần thuận tiện; mục tiêu sẽ lấy từ hồ sơ và cấu hình.", status: "Nhắc được" },
    { title: "Nhắc dinh dưỡng", description: "Một lần, hằng ngày, theo ngày trong tuần hoặc theo lịch định kỳ.", meta: "Có thể xuất .ics" },
  ],
  activity: [
    { title: "Hoạt động hôm nay", description: "Đi bộ · chạy · đạp xe · bơi · bóng đá · nhảy dây · thể dục · hoạt động khác.", status: "Ghi phút hoạt động" },
    { title: "Checklist vận động", description: "Theo dõi có hoạt động thể lực, hoạt động ngoài trời và thời gian ngồi lâu.", status: "Theo ngày" },
    { title: "Lịch sử", description: "Xem theo tuần/tháng để nhận biết thói quen thay vì chỉ nhìn một ngày.", meta: "Không phải module gym/giảm cân" },
  ],
  care: [
    { title: "Giấc ngủ", description: "Giờ đi ngủ · giờ thức dậy · tổng thời gian ngủ · checklist trước khi ngủ.", status: "Nhắc được" },
    { title: "Răng miệng", description: "Đánh răng sáng/tối, lịch khám răng, ghi chú đau răng hoặc thay răng.", status: "Theo ngày" },
    { title: "Mắt & học tập", description: "Mỏi mắt · nhìn mờ · đau đầu khi học · thời gian màn hình · thói quen nghỉ mắt.", status: "Sức khỏe học đường" },
    { title: "Vệ sinh cá nhân", description: "Rửa tay · tắm · thay quần áo · chăm sóc tóc · các thói quen cá nhân phù hợp.", status: "Checklist sáng/tối" },
  ],
  journal: [
    { title: "Hôm nay em cảm thấy", description: "Khỏe · bình thường · không khỏe; ghi nhanh mà không tự chẩn đoán.", status: "Nhật ký hằng ngày" },
    { title: "Triệu chứng", description: "Đau đầu · đau bụng · ho · sổ mũi · đau họng · sốt · mệt · triệu chứng khác.", status: "Theo dõi diễn biến" },
    { title: "Timeline sức khỏe", description: "Gộp các mốc tăng trưởng, checklist, triệu chứng, khám và sự kiện quan trọng.", meta: "Theo thứ tự thời gian" },
  ],
  profile: [
    { title: "Hồ sơ trẻ", description: "Tên · ngày sinh · tuổi · giới tính · chiều cao · cân nặng · ngày đo · ghi chú cần thiết.", status: "Trọng tâm 9–10 tuổi" },
    { title: "Quyền riêng tư", description: "Dữ liệu sức khỏe thuộc ứng dụng Sức khỏe Y tế; không mặc định đưa hồ sơ cá nhân sang Site Quản trị.", status: "Tách biệt dữ liệu" },
    { title: "Đồng bộ & offline", description: "Checklist và nhật ký có thể thiết kế lưu cục bộ rồi đồng bộ khi có mạng.", status: "PWA" },
    { title: "Lịch & nhắc việc", description: "Thông báo trình duyệt · nhắc lặp · tải .ics · Google Calendar khi thiết bị được cấp quyền.", status: "Chịu policy thiết bị" },
  ],
};

function SectionHeader({ title, description }: { title: string; description: string }) {
  return <header className="hf-section-head"><div><span className="hf-kicker">Sức khỏe Y tế · 9–10 tuổi</span><h2>{title}</h2><p>{description}</p></div></header>;
}

function ModuleGrid({ cards }: { cards: ModuleCard[] }) {
  return <div className="hf-module-grid">{cards.map((card) => <article className="hf-module-card" key={card.title}>
    <div className="hf-module-top"><h3>{card.title}</h3>{card.status ? <span className="hf-status">{card.status}</span> : null}</div>
    <p>{card.description}</p>
    {card.meta ? <small>{card.meta}</small> : null}
    <button type="button" className="hf-ghost-button" disabled>Thiết kế sâu sau</button>
  </article>)}</div>;
}

export default function HealthFramework({ initialCourse }: { initialCourse: unknown }) {
  const [active, setActive] = useState<SectionId>("today");
  const [tasks, setTasks] = useState<Record<TaskKey, boolean>>({ breakfast: true, water: false, movement: false, teethMorning: true, teethEvening: false, sleep: false });
  const completed = useMemo(() => Object.values(tasks).filter(Boolean).length, [tasks]);
  const progress = Math.round((completed / todayTasks.length) * 100);
  const contentReady = initialCourse !== null && initialCourse !== undefined;

  return <main className="hf-shell" data-content-ready={contentReady ? "true" : "false"}>
    <div className="hf-layout">
      <aside className="hf-sidebar" aria-label="Điều hướng Sức khỏe Y tế">
        <div className="hf-brand"><span className="hf-brand-mark">SK</span><div><strong>Sức khỏe Y tế</strong><small>Trẻ 9–10 tuổi</small></div></div>
        <nav className="hf-nav">{navigation.map((item) => <button key={item.id} type="button" className={active === item.id ? "hf-nav-item is-active" : "hf-nav-item"} onClick={() => setActive(item.id)} aria-current={active === item.id ? "page" : undefined}><span>{item.short}</span><strong>{item.label}</strong></button>)}</nav>
        <div className="hf-boundary-card"><span>Ranh giới hệ thống</span><strong>App hoạt động độc lập</strong><p>Site Quản trị chỉ quản lý thiết bị, quyền, policy và quy trình. Hồ sơ sức khỏe cá nhân không mặc định nằm ở Site Quản trị.</p></div>
      </aside>

      <section className="hf-content">
        <div className="hf-topbar"><div><span className="hf-kicker">Bộ khung vận hành</span><h1>Sức khỏe trẻ 9–10 tuổi</h1></div><div className="hf-top-status"><span className="hf-dot" />{contentReady ? "Đã nhận nội dung được cấp quyền" : "Đang chờ nội dung"}</div></div>

        {active === "today" ? <section className="hf-section">
          <SectionHeader title="Hôm nay" description="Một màn hình gọn để trẻ và phụ huynh biết hôm nay cần làm gì, không biến thành dashboard bệnh án phức tạp." />
          <div className="hf-today-grid">
            <article className="hf-progress-card"><div className="hf-progress-title"><div><span>Tiến độ hôm nay</span><strong>{completed}/{todayTasks.length}</strong></div><b>{progress}%</b></div><div className="hf-progress-track"><span style={{ width: `${progress}%` }} /></div><p>Dinh dưỡng · vận động · răng miệng · giấc ngủ được gom về một nơi.</p></article>
            <article className="hf-next-card"><span>Việc tiếp theo</span><strong>Nhắc việc sẽ lấy từ Reminder Engine</strong><p>Khung đã dành chỗ cho nhắc một lần, hằng ngày, theo tuần, thông báo trình duyệt, .ics và Google Calendar có kiểm soát quyền.</p></article>
          </div>
          <div className="hf-dashboard-grid">
            <section className="hf-panel hf-task-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Checklist</span><h3>Việc của hôm nay</h3></div><small>Tự lưu ở giai đoạn triển khai sâu</small></div><div className="hf-task-list">{todayTasks.map((task) => <label className={tasks[task.key] ? "hf-task is-done" : "hf-task"} key={task.key}><input type="checkbox" checked={tasks[task.key]} onChange={() => setTasks((current) => ({ ...current, [task.key]: !current[task.key] }))} /><span><strong>{task.label}</strong><small>{task.group}</small></span></label>)}</div></section>
            <aside className="hf-quick-column">
              <article className="hf-quick-card"><span>Tăng trưởng</span><strong>Chiều cao · cân nặng · BMI theo tuổi</strong><small>Theo dõi xu hướng, không kết luận từ một lần đo.</small><button type="button" onClick={() => setActive("growth")}>Mở bộ khung</button></article>
              <article className="hf-quick-card"><span>Dinh dưỡng</span><strong>Nhóm thực phẩm · bữa ăn · nước</strong><small>Checklist và nhật ký đơn giản cho 9–10 tuổi.</small><button type="button" onClick={() => setActive("nutrition")}>Mở bộ khung</button></article>
              <article className="hf-quick-card"><span>Sức khỏe học đường</span><strong>Mắt · răng · tư thế · thói quen</strong><small>Nằm trong Chăm sóc, không tách thành một hệ thống rườm rà.</small><button type="button" onClick={() => setActive("care")}>Mở bộ khung</button></article>
            </aside>
          </div>
        </section> : null}

        {active === "growth" ? <section className="hf-section"><SectionHeader title="Tăng trưởng" description="Theo dõi chiều cao, cân nặng và xu hướng phát triển của trẻ trong giai đoạn 9–10 tuổi." /><ModuleGrid cards={sectionCards.growth} /></section> : null}
        {active === "nutrition" ? <section className="hf-section"><SectionHeader title="Dinh dưỡng" description="Khung dinh dưỡng theo đúng nhóm tuổi: nhóm thực phẩm, checklist, nhật ký bữa ăn, nước và nhắc dinh dưỡng." /><ModuleGrid cards={sectionCards.nutrition} /></section> : null}
        {active === "activity" ? <section className="hf-section"><SectionHeader title="Vận động" description="Theo dõi thói quen vận động hằng ngày của trẻ, không xây theo mô hình gym hoặc giảm cân người lớn." /><ModuleGrid cards={sectionCards.activity} /></section> : null}
        {active === "care" ? <section className="hf-section"><SectionHeader title="Chăm sóc" description="Giấc ngủ, răng miệng, mắt & học tập và vệ sinh cá nhân được gom thành một khu vực thống nhất." /><ModuleGrid cards={sectionCards.care} /></section> : null}
        {active === "journal" ? <section className="hf-section"><SectionHeader title="Nhật ký" description="Ghi cảm nhận, triệu chứng và timeline sức khỏe; theo dõi diễn biến nhưng không tự chẩn đoán hay tự kê đơn." /><ModuleGrid cards={sectionCards.journal} /></section> : null}
        {active === "profile" ? <section className="hf-section"><SectionHeader title="Hồ sơ" description="Hồ sơ trẻ, quyền riêng tư, đồng bộ/offline và lịch nhắc — toàn bộ vẫn thuộc Web App Sức khỏe Y tế độc lập." /><ModuleGrid cards={sectionCards.profile} /></section> : null}
      </section>
    </div>
    <nav className="hf-bottom-nav" aria-label="Điều hướng nhanh trên thiết bị nhỏ">{navigation.map((item) => <button key={item.id} type="button" className={active === item.id ? "is-active" : ""} onClick={() => setActive(item.id)}><span>{item.short}</span><strong>{item.label}</strong></button>)}</nav>
  </main>;
}
