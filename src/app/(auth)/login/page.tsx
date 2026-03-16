"use client";

import { Suspense, useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface InviteInfo {
  workspaceName: string;
  teacherName: string;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);

  // Fetch invite info if token is present
  useEffect(() => {
    if (inviteToken) {
      fetch(`/api/invite/${inviteToken}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setInviteInfo(data);
          }
        })
        .catch(() => {});
    }
  }, [inviteToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Ungültige E-Mail oder Passwort.");
        return;
      }

      // If invite token present, auto-redeem
      if (inviteToken) {
        try {
          const redeemRes = await fetch(`/api/invite/${inviteToken}/redeem`, {
            method: "POST",
          });
          const redeemData = await redeemRes.json();

          if (redeemRes.ok && redeemData.workspaceId) {
            router.push(`/workspace/${redeemData.workspaceId}`);
            router.refresh();
            return;
          }
        } catch {
          // Redeem failed — still redirect to dashboard
        }
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Ein Fehler ist aufgetreten. Bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-lg">
      <h1 className="mb-6 text-center font-[family-name:var(--font-caveat)] text-4xl font-bold text-gray-900">
        Anmelden
      </h1>

      {inviteInfo && (
        <div className="mb-4 rounded-lg bg-violet-50 p-3 text-center">
          <p className="text-sm text-violet-700">
            Einladung zum Workspace{" "}
            <span className="font-semibold">{inviteInfo.workspaceName}</span>
          </p>
          <p className="text-xs text-violet-500">
            von {inviteInfo.teacherName}
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            E-Mail
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="deine@email.de"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Passwort
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Dein Passwort"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Wird angemeldet..." : "Anmelden"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Noch kein Konto?{" "}
        <Link
          href={inviteToken ? `/register?invite=${inviteToken}` : "/register"}
          className="font-medium text-blue-600 hover:text-blue-500"
        >
          Registrieren
        </Link>
      </p>
    </div>
  );
}
