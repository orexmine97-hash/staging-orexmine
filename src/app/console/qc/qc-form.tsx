"use client";

import { useActionState } from "react";
import { recordQcDecisionAction } from "@/app/actions/procurement";

type State = Awaited<ReturnType<typeof recordQcDecisionAction>>;

// Inline QC decision. The server action authenticates + authorizes (QC/ADMIN
// roles) and revalidates, so this stays a thin form; failures render inline.
export function QcDecisionForm({ deliveryId }: { deliveryId: string }) {
  const [state, action, pending] = useActionState<State | null, FormData>(
    (_prev, fd) => recordQcDecisionAction(fd),
    null,
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="deliveryId" value={deliveryId} />
      <select name="decision" required className="rounded border border-divider bg-bg px-2 py-1 text-xs">
        <option value="PASS">Pass</option>
        <option value="FAIL">Fail</option>
        <option value="HOLD">Hold</option>
        <option value="RETEST">Retest</option>
      </select>
      <input
        name="reason"
        required
        placeholder="Reason"
        className="w-32 rounded border border-divider bg-bg px-2 py-1 text-xs"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-accent px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "…" : "Record"}
      </button>
      {state && !state.ok && <span className="text-xs text-red-700">{state.message}</span>}
    </form>
  );
}
