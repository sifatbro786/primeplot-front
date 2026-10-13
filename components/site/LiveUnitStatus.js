"use client";

import { useState } from "react";
import { useProjectLive } from "@/lib/socket";
import { PublicStatusChip } from "./PublicStatusChip";

/** The unit's status chip, kept current over the public Socket.IO room. */
export function LiveUnitStatus({ projectId, unitId, initial }) {
  const [status, setStatus] = useState(initial);
  useProjectLive(projectId, {
    scope: "public",
    onDelta: (d) => d.unitId === unitId && setStatus(d.status),
  });
  return (
    <span aria-live="polite">
      <PublicStatusChip status={status} />
    </span>
  );
}
