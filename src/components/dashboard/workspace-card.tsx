"use client";

import Link from "next/link";

const GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-red-500",
  "from-pink-500 to-rose-600",
  "from-indigo-500 to-blue-600",
  "from-amber-500 to-orange-600",
  "from-cyan-500 to-blue-500",
];

function getGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

interface WorkspaceCardProps {
  id: string;
  name: string;
  description?: string | null;
  memberCount: number;
  pageCount: number;
  isTeacher: boolean;
  onDelete?: (id: string) => void;
  onInvite?: (id: string, name: string) => void;
}

export default function WorkspaceCard({
  id,
  name,
  description,
  memberCount,
  pageCount,
  isTeacher,
  onDelete,
  onInvite,
}: WorkspaceCardProps) {
  const gradient = getGradient(name);

  return (
    <div className="group relative rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md">
      <Link href={`/workspace/${id}`} className="block">
        {/* Gradient header */}
        <div
          className={`h-24 rounded-t-xl bg-gradient-to-br ${gradient} flex items-end p-4`}
        >
          <h3 className="font-[family-name:var(--font-caveat)] text-2xl font-bold text-white drop-shadow-sm">
            {name}
          </h3>
        </div>

        {/* Card body */}
        <div className="p-4">
          {description && (
            <p className="mb-3 text-sm text-gray-500 line-clamp-2">
              {description}
            </p>
          )}

          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
                />
              </svg>
              {memberCount} {memberCount === 1 ? "Mitglied" : "Mitglieder"}
            </span>
            <span className="flex items-center gap-1">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
              </svg>
              {pageCount} {pageCount === 1 ? "Seite" : "Seiten"}
            </span>
          </div>
        </div>
      </Link>

      {/* Action buttons (teacher only) */}
      {isTeacher && (
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {onInvite && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onInvite(id, name);
              }}
              className="rounded-full bg-black/20 p-1.5 text-white hover:bg-black/40"
              title="Einladungslink"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
                />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(id);
              }}
              className="rounded-full bg-black/20 p-1.5 text-white hover:bg-black/40"
              title="Workspace löschen"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
