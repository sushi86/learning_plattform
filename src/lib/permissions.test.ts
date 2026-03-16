/**
 * Tests for the permissions utility.
 *
 * These tests verify the permission logic by mocking Prisma queries.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma — vi.mock is hoisted automatically
vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
    },
    workspaceMember: {
      findUnique: vi.fn(),
    },
    page: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

import {
  isWorkspaceOwner,
  isWorkspaceMember,
  canAccessWorkspace,
  getWorkspaceRole,
  canAccessPage,
  canCreateWorkspace,
  canDeletePage,
} from "./permissions";

const mockWorkspaceFind = vi.mocked(prisma.workspace.findUnique);
const mockMemberFind = vi.mocked(prisma.workspaceMember.findUnique);
const mockPageFind = vi.mocked(prisma.page.findUnique);

describe("permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isWorkspaceOwner", () => {
    it("returns true when user is the owner", async () => {
      mockWorkspaceFind.mockResolvedValue({ ownerId: "user-1" } as never);

      const result = await isWorkspaceOwner("user-1", "ws-1");
      expect(result).toBe(true);
    });

    it("returns false when user is not the owner", async () => {
      mockWorkspaceFind.mockResolvedValue({ ownerId: "user-2" } as never);

      const result = await isWorkspaceOwner("user-1", "ws-1");
      expect(result).toBe(false);
    });

    it("returns false when workspace does not exist", async () => {
      mockWorkspaceFind.mockResolvedValue(null);

      const result = await isWorkspaceOwner("user-1", "ws-nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("isWorkspaceMember", () => {
    it("returns true when membership exists", async () => {
      mockMemberFind.mockResolvedValue({ id: "member-1" } as never);

      const result = await isWorkspaceMember("user-1", "ws-1");
      expect(result).toBe(true);
    });

    it("returns false when no membership", async () => {
      mockMemberFind.mockResolvedValue(null);

      const result = await isWorkspaceMember("user-1", "ws-1");
      expect(result).toBe(false);
    });
  });

  describe("canAccessWorkspace", () => {
    it("returns true for owner", async () => {
      mockWorkspaceFind.mockResolvedValue({ ownerId: "user-1" } as never);

      const result = await canAccessWorkspace("user-1", "ws-1");
      expect(result).toBe(true);
    });

    it("returns true for member", async () => {
      mockWorkspaceFind.mockResolvedValue({ ownerId: "user-2" } as never);
      mockMemberFind.mockResolvedValue({ id: "member-1" } as never);

      const result = await canAccessWorkspace("user-1", "ws-1");
      expect(result).toBe(true);
    });

    it("returns false for non-member non-owner", async () => {
      mockWorkspaceFind.mockResolvedValue({ ownerId: "user-2" } as never);
      mockMemberFind.mockResolvedValue(null);

      const result = await canAccessWorkspace("user-1", "ws-1");
      expect(result).toBe(false);
    });

    it("returns false for nonexistent workspace", async () => {
      mockWorkspaceFind.mockResolvedValue(null);

      const result = await canAccessWorkspace("user-1", "ws-nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("getWorkspaceRole", () => {
    it("returns owner for workspace owner", async () => {
      mockWorkspaceFind.mockResolvedValue({ ownerId: "user-1" } as never);

      const role = await getWorkspaceRole("user-1", "ws-1");
      expect(role).toBe("owner");
    });

    it("returns member for workspace member", async () => {
      mockWorkspaceFind.mockResolvedValue({ ownerId: "user-2" } as never);
      mockMemberFind.mockResolvedValue({ id: "member-1" } as never);

      const role = await getWorkspaceRole("user-1", "ws-1");
      expect(role).toBe("member");
    });

    it("returns none for unauthorized user", async () => {
      mockWorkspaceFind.mockResolvedValue({ ownerId: "user-2" } as never);
      mockMemberFind.mockResolvedValue(null);

      const role = await getWorkspaceRole("user-1", "ws-1");
      expect(role).toBe("none");
    });

    it("returns none for nonexistent workspace", async () => {
      mockWorkspaceFind.mockResolvedValue(null);

      const role = await getWorkspaceRole("user-1", "ws-1");
      expect(role).toBe("none");
    });
  });

  describe("canAccessPage", () => {
    it("returns role and workspaceId for owner", async () => {
      mockPageFind.mockResolvedValue({ workspaceId: "ws-1" } as never);
      mockWorkspaceFind.mockResolvedValue({ ownerId: "user-1" } as never);

      const result = await canAccessPage("user-1", "page-1");
      expect(result).toEqual({ workspaceId: "ws-1", role: "owner" });
    });

    it("returns null for nonexistent page", async () => {
      mockPageFind.mockResolvedValue(null);

      const result = await canAccessPage("user-1", "page-nonexistent");
      expect(result).toBeNull();
    });

    it("returns null for unauthorized user", async () => {
      mockPageFind.mockResolvedValue({ workspaceId: "ws-1" } as never);
      mockWorkspaceFind.mockResolvedValue({ ownerId: "user-2" } as never);
      mockMemberFind.mockResolvedValue(null);

      const result = await canAccessPage("user-1", "page-1");
      expect(result).toBeNull();
    });
  });

  describe("canCreateWorkspace", () => {
    it("returns true for TEACHER role", () => {
      expect(canCreateWorkspace("TEACHER")).toBe(true);
    });

    it("returns false for STUDENT role", () => {
      expect(canCreateWorkspace("STUDENT")).toBe(false);
    });
  });

  describe("canDeletePage", () => {
    it("returns true for owner", async () => {
      mockWorkspaceFind.mockResolvedValue({ ownerId: "user-1" } as never);

      const result = await canDeletePage("user-1", "ws-1");
      expect(result).toBe(true);
    });

    it("returns false for non-owner", async () => {
      mockWorkspaceFind.mockResolvedValue({ ownerId: "user-2" } as never);

      const result = await canDeletePage("user-1", "ws-1");
      expect(result).toBe(false);
    });
  });
});
