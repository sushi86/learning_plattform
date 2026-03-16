/**
 * Centralized permission checks for workspace access control.
 *
 * Permission model (from spec "Berechtigungsmodell"):
 *   - TEACHER (Owner): Full control over owned workspaces
 *   - STUDENT (Member): Can draw, add pages, upload files, export PDF
 *   - Students CANNOT: delete pages/workspaces, manage members, create invites, change settings
 */
import { prisma } from "@/lib/prisma";

export type WorkspaceRole = "owner" | "member" | "none";

/**
 * Check if a user is the owner (teacher) of a workspace.
 */
export async function isWorkspaceOwner(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });
  return workspace?.ownerId === userId;
}

/**
 * Check if a user is a member (student) of a workspace.
 */
export async function isWorkspaceMember(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { id: true },
  });
  return !!membership;
}

/**
 * Check if a user can access a workspace (owner OR member).
 */
export async function canAccessWorkspace(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });

  if (!workspace) return false;
  if (workspace.ownerId === userId) return true;

  return isWorkspaceMember(userId, workspaceId);
}

/**
 * Get the user's role within a workspace.
 * Returns 'owner', 'member', or 'none'.
 */
export async function getWorkspaceRole(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceRole> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });

  if (!workspace) return "none";
  if (workspace.ownerId === userId) return "owner";

  const isMember = await isWorkspaceMember(userId, workspaceId);
  return isMember ? "member" : "none";
}

/**
 * Check if a user can access a page's workspace.
 * Returns the workspaceId if access is granted, null otherwise.
 */
export async function canAccessPage(
  userId: string,
  pageId: string,
): Promise<{ workspaceId: string; role: WorkspaceRole } | null> {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { workspaceId: true },
  });

  if (!page) return null;

  const role = await getWorkspaceRole(userId, page.workspaceId);
  if (role === "none") return null;

  return { workspaceId: page.workspaceId, role };
}

// ----- Role-based action checks per spec table -----

/** Workspace erstellen: Only TEACHER */
export function canCreateWorkspace(userRole: string): boolean {
  return userRole === "TEACHER";
}

/** Workspace löschen: Only owner (TEACHER) */
export async function canDeleteWorkspace(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  return isWorkspaceOwner(userId, workspaceId);
}

/** Einladungslink generieren: Only owner (TEACHER) */
export async function canManageInvites(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  return isWorkspaceOwner(userId, workspaceId);
}

/** Schüler entfernen: Only owner (TEACHER) */
export async function canManageMembers(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  return isWorkspaceOwner(userId, workspaceId);
}

/** Seite hinzufügen: Owner OR member */
export async function canCreatePage(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  return canAccessWorkspace(userId, workspaceId);
}

/** Seite löschen: Only owner (TEACHER) */
export async function canDeletePage(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  return isWorkspaceOwner(userId, workspaceId);
}

/** Auf Canvas zeichnen / Dateien hochladen: Owner OR member */
export async function canDrawAndUpload(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  return canAccessWorkspace(userId, workspaceId);
}

/** Workspace-Einstellungen: Only owner (TEACHER) */
export async function canManageSettings(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  return isWorkspaceOwner(userId, workspaceId);
}

/* ---- AI access ---- */

export function canUseAi(user: { aiEnabled: boolean }): boolean {
  return user.aiEnabled === true;
}
