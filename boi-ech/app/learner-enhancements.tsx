"use client";

import {useAccountWorkspace} from "./account-workspace-bootstrap";

import StudentRoleShell from "./student-role-shell";
import StudentTeacherInbox from "./student-teacher-inbox";
import StudentAdaptiveCoach from "./student-adaptive-coach";

/** Mount learner-only DOM bridge components only for a live learner workspace. */
export default function LearnerEnhancements() {
  const workspace=useAccountWorkspace();
  if(workspace?.role!=="learner") return null;
  return (
    <>
      <StudentRoleShell />
      <StudentTeacherInbox />
      <StudentAdaptiveCoach />
    </>
  );
}
