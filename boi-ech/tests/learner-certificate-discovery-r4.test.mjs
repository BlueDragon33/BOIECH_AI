import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
test("R4: completed learner dashboard offers existing verifiable certificate flow, never directly grants it",()=>{
 const learner=read("../app/learner-role-ui.tsx");
 const page=read("../app/page.tsx");
 const api=read("../app/api/certificate/route.ts");
 assert.match(learner,/snapshot\.completed===8 \? <button/);
 assert.match(learner,/Xem khu chứng chỉ cuối khóa/);
 assert.match(learner,/clickOriginalNav\("Dữ liệu"\)/);
 assert.doesNotMatch(learner,/fetch\("\/api\/certificate"/);
 assert.match(page,/certificate-panel/);
 assert.match(page,/\/chung-chi\?code=/);
 assert.match(api,/verifyDeviceRequest/);
 assert.match(api,/LESSONS\.every/);
 assert.match(api,/Number\(scores\[lesson\]\) >= 8/);
});
test("R4: certificate is not requested by unauthorized management UI or issued simply because completed text is shown",()=>{
 const learner=read("../app/learner-role-ui.tsx");
 const core=read("../app/api/certificate/route.ts");
 assert.match(core,/FROM device_profiles WHERE device_id = \?/);
 assert.match(core,/course_certificates WHERE device_id = \?/);
 assert.match(core,/course_certificate_issued/);
 assert.doesNotMatch(learner,/verificationCode:|issueCertificate\(/);
});
