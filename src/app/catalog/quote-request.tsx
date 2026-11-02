"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestQuoteAction } from "@/app/actions/sales";

type State = Awaited<ReturnType<typeof requestQuoteAction>>;
const btn = "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-accent px-5 text-[15px] font-bold text-white hover:opacity-90 disabled:opacity-50";

// Quote entry on the batch page (FR-86). Buyers send a request into the trade
// desk queue; staff jump to the desk; everyone else signs in first. The server
// action re-checks the role and KYC, so this only picks the right affordance.
export function QuoteRequest({
  viewer,
  batchId,
  batchNumber,
  available,
}: {
  viewer: "anon" | "buyer" | "staff";
  batchId: string;
  batchNumber: string;
  available: number;
}) {
  const [state, action, pending] = useActionState<State | null, FormData>((_p, fd) => requestQuoteAction(fd), null);

  if (viewer === "anon") {
    return (
      <a href={`/auth/login?returnTo=/catalog/${batchNumber}`} className={`mt-4 ${btn}`}>
        Sign in to request a quote
      </a>
    );
  }
  if (viewer === "staff") {
    return (
      <Link href={`/console/trade-desk?batch=${batchNumber}`} className={`mt-4 ${btn}`}>
        Create a quote in the trade desk
      </Link>
    );
  }
  if (state?.ok) {
    return (
      <p className="mt-4 rounded-xl bg-[#d9e6de] px-4 py-3 text-sm text-[#245a4a]">
        Request <b>{state.reference}</b> sent. The trade desk will price it and send you a quote; confirming it reserves the stock.
      </p>
    );
  }
  return (
    <form action={action} className="mt-4 flex flex-col gap-2">
      <input type="hidden" name="batchId" value={batchId} />
      <label className="flex items-center gap-3 rounded-xl border border-divider bg-surface px-4 py-2 text-sm">
        <span className="text-muted">Quantity</span>
        <input
          name="quantity"
          type="number"
          step="0.1"
          min="0.1"
          max={available}
          required
          placeholder={`up to ${available.toFixed(1)}`}
          className="min-w-0 flex-1 bg-transparent text-right font-semibold focus:outline-none"
        />
        <span className="text-muted">t</span>
      </label>
      <button type="submit" disabled={pending} className={btn}>
        {pending ? "Sending…" : "Request a quote"}
      </button>
      {state && !state.ok && <p className="text-sm text-red-700">{state.message}</p>}
    </form>
  );
}
