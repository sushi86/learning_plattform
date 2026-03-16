"use client";

import { Suspense, useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface InviteInfo {
  workspaceName: string;
  teacherName: string;
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"STUDENT" | "TEACHER">("STUDENT");
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
        .catch(() => {
          // Silently fail — register page still works without invite info
        });
    }
  }, [inviteToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registrierung fehlgeschlagen.");
        return;
      }

      // Auto-login after registration
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Konto erstellt, aber Anmeldung fehlgeschlagen.");
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
        Registrieren
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
            htmlFor="name"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Dein Name"
          />
        </div>

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
            minLength={6}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Mindestens 6 Zeichen"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Rolle
          </label>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="role"
                value="STUDENT"
                checked={role === "STUDENT"}
                onChange={() => setRole("STUDENT")}
                className="h-4 w-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">Schüler</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="role"
                value="TEACHER"
                checked={role === "TEACHER"}
                onChange={() => setRole("TEACHER")}
                className="h-4 w-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">Lehrer</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Wird registriert..." : "Registrieren"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Bereits ein Konto?{" "}
        <Link
          href={inviteToken ? `/login?invite=${inviteToken}` : "/login"}
          className="font-medium text-blue-600 hover:text-blue-500"
        >
          Anmelden
        </Link>
      </p>
    </div>
  );
}
