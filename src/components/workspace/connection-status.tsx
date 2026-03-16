"use client";

import type { ConnectionStatus } from "@/lib/useYjsSync";

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus;
}

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  connected: {
    label: "Online",
    dotClass: "bg-green-500",
    textClass: "text-gray-500",
  },
  reconnecting: {
    label: "Verbinden…",
    dotClass: "bg-yellow-500 animate-pulse",
    textClass: "text-yellow-600",
  },
  offline: {
    label: "Offline",
    dotClass: "bg-red-500",
    textClass: "text-red-600",
  },
};

export default function ConnectionStatusIndicator({
  status,
}: ConnectionStatusIndicatorProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1">
      <div className={`h-2 w-2 rounded-full ${config.dotClass}`} />
      <span className={`text-xs ${config.textClass}`}>{config.label}</span>
    </div>
  );
}
