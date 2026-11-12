/**
 * P3: restrict role-shell refreshes to source data that actually drives their
 * UI. Both adapters mount React portals inside the original app-shell; ignoring
 * portal mutations (including text-node characterData) prevents observer loops.
 *
 * This is a performance filter, never a source of authorization decisions.
 */
export type RoleShell = "student" | "teacher";

const PORTAL_SELECTOR = '[data-student-role-ui]:not(body),[data-teacher-role-ui]:not(body)';
const STUDENT_SOURCE = '.learner-chip,.sidebar,.top-status,.sidebar-progress,.network-state,.payment-access-status,.page-overview';
const TEACHER_SOURCE = '.learner-chip,.sidebar,.topbar';

function asElement(node: Node): Element | null {
  return node.nodeType === 1 ? node as Element : node.parentElement;
}

function touchesSourceNode(node: Node, selector: string): boolean {
  const element = asElement(node);
  if (!element || element.closest(PORTAL_SELECTOR)) return false;
  return element.matches(".app-shell")
    || element.matches(selector)
    || Boolean(element.querySelector(".app-shell"))
    || Boolean(element.querySelector(selector));
}

export function shouldRefreshRoleShell(mutations: MutationRecord[], role: RoleShell): boolean {
  const source = role === "student" ? STUDENT_SOURCE : TEACHER_SOURCE;
  return mutations.some(mutation => {
    const element = asElement(mutation.target);
    if (element?.closest(PORTAL_SELECTOR)) return false;
    // App root class, device ID and role changes may replace all role mounts.
    if (element?.matches(".app-shell")) return true;
    if (element?.closest(source)) return true;
    if (mutation.type !== "childList") return false;
    // Detect detached/recreated app roots and navigation source nodes without
    // observing unrelated content such as AI result panels and media controls.
    return [...mutation.addedNodes, ...mutation.removedNodes]
      .some(node => touchesSourceNode(node, source));
  });
}
