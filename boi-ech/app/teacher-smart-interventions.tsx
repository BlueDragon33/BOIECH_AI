"use client";

export type SmartSuggestionClient = {
  id: string;
  mode: "feedback" | "assignment" | "review";
  priority: "critical" | "high" | "normal";
  lessonNumber: string;
  title: string;
  reason: string;
  noteTemplate: string;
  evidence: string[];
  requiresHumanReview: true;
};

type SmartLearner = {
  name: string;
  personCode: string;
  className: string;
  interventionSuggestions: SmartSuggestionClient[];
};

function modeLabel(mode: SmartSuggestionClient["mode"]) {
  return mode === "assignment" ? "Giao bài luyện" : mode === "review" ? "Review AI" : "Nhận xét";
}

export default function TeacherSmartInterventions({
  learners,
  onUse,
}: {
  learners: SmartLearner[];
  onUse: (personCode: string, suggestion: SmartSuggestionClient) => void;
}) {
  const items = learners
    .flatMap((learner) => learner.interventionSuggestions.map((suggestion) => ({ learner, suggestion })))
    .sort((left, right) => {
      const rank = { critical: 3, high: 2, normal: 1 } as const;
      return rank[right.suggestion.priority] - rank[left.suggestion.priority];
    })
    .slice(0, 18);

  return (
    <section className="teacher-smart-interventions" aria-label="Gợi ý can thiệp thông minh">
      <header>
        <div>
          <span>SMART INTERVENTION ENGINE</span>
          <h2>Đề xuất để Giảng viên xem và quyết định</h2>
          <p>Máy chỉ tổng hợp tín hiệu từ Learner Model, Learning Analytics và chất lượng AI. Không có gợi ý nào được gửi cho học viên nếu Giảng viên chưa mở, kiểm tra và xác nhận.</p>
        </div>
        <strong>{items.length} đề xuất</strong>
      </header>
      <div className="teacher-smart-grid">
        {items.map(({ learner, suggestion }) => (
          <article key={`${learner.personCode}-${suggestion.id}`} className={`teacher-smart-card ${suggestion.priority}`}>
            <header>
              <div><span>{suggestion.priority === "critical" ? "ƯU TIÊN CAO" : suggestion.priority === "high" ? "NÊN XEM" : "GỢI Ý"}</span><strong>{learner.name}</strong><small>{learner.className} · Bài {suggestion.lessonNumber}</small></div>
              <b>{modeLabel(suggestion.mode)}</b>
            </header>
            <h3>{suggestion.title}</h3>
            <p>{suggestion.reason}</p>
            <ul>{suggestion.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
            <footer>
              <span>Giảng viên phải duyệt nội dung trước khi gửi.</span>
              <button type="button" onClick={() => onUse(learner.personCode, suggestion)}>Mở bản nháp →</button>
            </footer>
          </article>
        ))}
        {items.length === 0 ? <div className="teacher-smart-empty"><strong>Chưa có đề xuất cần ưu tiên</strong><p>Engine chỉ tạo đề xuất khi dữ liệu hiện có đủ để nêu một lý do cụ thể.</p></div> : null}
      </div>
    </section>
  );
}
