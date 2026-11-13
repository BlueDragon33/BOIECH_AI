"use client";

import StudentRoleShell from "./student-role-shell";
import StudentTeacherInbox from "./student-teacher-inbox";
import StudentAdaptiveCoach from "./student-adaptive-coach";

/** Mount learner-only DOM bridge components only for a live learner workspace. */
export default function LearnerEnhancements() {
  return (
    <>
      <StudentRoleShell />
      <StudentTeacherInbox />
      <StudentAdaptiveCoach />
    </>
  );
}
