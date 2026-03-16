"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface InviteInfo {
  workspaceName: string;
  workspaceId: string;
  teacherName: string;
  expiresAt: string | null;
}

interface InviteError {
  error: string;
  code: string;
}

export default function InvitePage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<InviteError | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState("");

  useEffect(() => {
    async function fetchInviteInfo() {
      try {
        const res = await fetch(`/api/invite/${token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data);
        } else {
          setInviteInfo(data);
        }
      } catch {
        setError({
          error: "Fehler beim Laden der Einladung.",
          code: "NETWORK_ERROR",
        });
      } finally {
        setLoading(false);
      }
    }
    fetchInviteInfo();
  }, [token]);

  async function handleJoin() {
    setRedeeming(true);
    setRedeemError("");

    try {
      const res = await fetch(`/api/invite/${token}/redeem`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setRedeemError(data.error || "Fehler beim Beitreten.");
        return;
      }

      // Success — redirect to workspace or dashboard
      if (data.workspaceId) {
        router.push(`/workspace/${data.workspaceId}`);
      } else {
        router.push("/dashboard");
      }
    } catch {
      setRedeemError("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setRedeeming(false);
    }
  }

  // Loading state
  if (loading || authStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-violet-600" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-8 w-8 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
          </div>
          <h1 className="mb-2 font-[family-name:var(--font-caveat)] text-3xl font-bold text-gray-900">
            {error.code === "ALREADY_USED"
              ? "Bereits verwendet"
              : error.code === "EXPIRED"
                ? "Abgelaufen"
                : "Ungültig"}
          </h1>
          <p className="mb-6 text-gray-600">{error.error}</p>
          <Link
            href="/dashboard"
            className="inline-block rounded-lg bg-violet-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
          >
            Zum Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Valid invite
  const isLoggedIn = !!session?.user;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-100">
          <svg
            className="h-8 w-8 text-violet-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
            />
          </svg>
        </div>

        <h1 className="mb-2 text-center font-[family-name:var(--font-caveat)] text-3xl font-bold text-gray-900">
          Einladung zum Workspace
        </h1>

        <div className="mb-6 rounded-lg bg-gray-50 p-4 text-center">
          <p className="text-lg font-semibold text-gray-900">
            {inviteInfo?.workspaceName}
          </p>
          <p className="text-sm text-gray-500">
            Eingeladen von {inviteInfo?.teacherName}
          </p>
        </div>

        {redeemError && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {redeemError}
          </div>
        )}

        {isLoggedIn ? (
          <div className="space-y-3">
            <p className="text-center text-sm text-gray-600">
              Angemeldet als{" "}
              <span className="font-medium">{session.user.name}</span>
            </p>
            <button
              onClick={handleJoin}
              disabled={redeeming}
              className="w-full rounded-lg bg-violet-600 px-4 py-3 font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {redeeming ? "Beitritt läuft..." : "Workspace beitreten"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-sm text-gray-600">
              Erstelle ein Konto oder melde dich an, um dem Workspace
              beizutreten.
            </p>
            <Link
              href={`/register?invite=${token}`}
              className="block w-full rounded-lg bg-violet-600 px-4 py-3 text-center font-medium text-white transition-colors hover:bg-violet-700"
            >
              Registrieren & beitreten
            </Link>
            <Link
              href={`/login?invite=${token}`}
              className="block w-full rounded-lg border border-gray-300 px-4 py-3 text-center font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Anmelden & beitreten
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
