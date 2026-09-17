import assert from "node:assert/strict";
import test from "node:test";
import {
  interpretationPolicy,
  interpretAdvisorBadge,
  interpretAdvisorGateLabel,
  interpretBilateralStatus,
  interpretCycleStatus,
  interpretIssuePriority,
  interpretIssueTitle,
  interpretV1Summary,
  interpretWeakestPhaseLabel,
} from "../app/phan-tich-video/trust-aware-interpretation-core.mjs";

test("high trust preserves assertive analysis language", () => {
  assert.equal(interpretationPolicy("high").assertiveLanguageAllowed, true);
  assert.equal(interpretV1Summary("Phát hiện 3 điểm cần xem lại", "high"), "Phát hiện 3 điểm cần xem lại");
  assert.equal(interpretBilateralStatus("Lệch rõ", "high"), "Lệch rõ");
  assert.equal(interpretAdvisorBadge("Coverage đạt cho clip", "high"), "Coverage đạt cho clip");
});

test("caution trust softens conclusions without hiding numeric evidence", () => {
  assert.equal(interpretationPolicy("caution").softenConclusions, true);
  assert.equal(interpretV1Summary("Phát hiện 2 điểm cần xem lại", "caution"), "Có 2 điểm AI đánh dấu · cần đối chiếu thêm");
  assert.equal(interpretIssueTitle("Hai chân lệch nhau", "caution"), "Cần đối chiếu · Hai chân lệch nhau");
  assert.equal(interpretCycleStatus("Yếu", "caution"), "Có dấu hiệu yếu · cần đối chiếu");
  assert.equal(interpretBilateralStatus("Cân bằng", "caution"), "Có vẻ cân bằng · nên đối chiếu");
});

test("reference trust removes strong wording from v1, cycle and bilateral conclusions", () => {
  assert.equal(interpretationPolicy("reference").referenceOnly, true);
  assert.equal(interpretIssuePriority("Ưu tiên", "reference"), "Nên kiểm tra");
  assert.equal(interpretCycleStatus("Tốt", "reference"), "Chưa thấy bất thường rõ");
  assert.equal(interpretWeakestPhaseLabel("Pha yếu nhất · bấm để xem", "reference"), "Pha nên xem lại · bấm để xem");
  assert.equal(interpretBilateralStatus("Lệch rõ", "reference"), "Có tín hiệu lệch cần kiểm tra");
});

test("threshold advisor cannot look calibration-ready below high trust", () => {
  assert.equal(interpretationPolicy("caution").advisorEligibilityAllowed, false);
  assert.equal(interpretationPolicy("reference").advisorEligibilityAllowed, false);
  assert.equal(interpretAdvisorBadge("Coverage đạt cho clip", "caution"), "Mô phỏng · cần thận trọng");
  assert.equal(interpretAdvisorBadge("Coverage đạt cho clip", "reference"), "Chỉ mô phỏng · không đủ trust");
  assert.equal(interpretAdvisorGateLabel("Đủ coverage + chất lượng góc cho clip:", "reference"), "Chưa đủ trust để xem xét hiệu chỉnh:");
});

test("unknown trust defaults conservatively to caution", () => {
  assert.equal(interpretationPolicy("unexpected").level, "caution");
  assert.equal(interpretCycleStatus("Yếu", "unexpected"), "Có dấu hiệu yếu · cần đối chiếu");
});
