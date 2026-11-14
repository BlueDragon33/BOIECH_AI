"use client";

import TeacherRoleShell from "./teacher-role-shell";
import TeacherActionBridge from "./teacher-action-bridge";
import TeacherDashboardBlueprint from "./teacher-dashboard-blueprint";
import TeacherRosterManager from "./teacher-roster-manager";

/** Mount teacher-only DOM bridge components only for a live teacher workspace. */
export default function TeacherEnhancements() {
  return (
    <>
      <TeacherRoleShell />
      <TeacherActionBridge />
      <TeacherDashboardBlueprint />
      <TeacherRosterManager />
    </>
  );
}
