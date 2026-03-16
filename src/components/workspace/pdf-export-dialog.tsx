"use client";

interface PdfExportDialogProps {
  open: boolean;
  currentPage: number;
  totalPages: number;
  error?: string | null;
  onClose?: () => void;
}

export default function PdfExportDialog({
  open,
  currentPage,
  totalPages,
  error,
  onClose,
}: PdfExportDialogProps) {
  if (!open) return null;

  const progress =
    totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
  const isComplete = currentPage === totalPages && !error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        {error ? (
          <>
            {/* Error state */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-5 w-5 text-red-600"
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
              <div>
                <h3 className="font-[family-name:var(--font-caveat)] text-lg font-bold text-gray-900">
                  Export fehlgeschlagen
                </h3>
                <p className="mt-1 text-sm text-gray-500">{error}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
            >
              Schließen
            </button>
          </>
        ) : (
          <>
            {/* Progress state */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100">
                {isComplete ? (
                  <svg
                    className="h-5 w-5 text-violet-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m4.5 12.75 6 6 9-13.5"
                    />
                  </svg>
                ) : (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
                )}
              </div>
              <div>
                <h3 className="font-[family-name:var(--font-caveat)] text-lg font-bold text-gray-900">
                  {isComplete ? "PDF erstellt!" : "PDF wird erstellt…"}
                </h3>
                <p className="text-sm text-gray-500">
                  {isComplete
                    ? "Download wurde gestartet."
                    : `Seite ${currentPage} von ${totalPages}`}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-violet-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            {isComplete && (
              <button
                onClick={onClose}
                className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
              >
                Schließen
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
