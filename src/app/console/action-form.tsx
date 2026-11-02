"use client";

import { type ReactNode, useActionState, useState } from "react";
import type { ActionResult } from "@/app/actions/procurement";

type Result = ActionResult<{ reference?: string }>;

const input = "rounded border border-divider bg-bg px-2 py-1 text-xs";

// Thin wrapper for console mutations: the server action authenticates,
// authorizes and revalidates; this only shows pending + the outcome inline.
export function ActionForm({
  action,
  children,
  className = "flex flex-wrap items-center gap-2",
  success,
}: {
  action: (fd: FormData) => Promise<Result>;
  children: ReactNode;
  className?: string;
  success?: string;
}) {
  const [state, run, pending] = useActionState<Result | null, FormData>((_prev, fd) => action(fd), null);
  return (
    <form action={run} className={className}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state && !state.ok && <span className="basis-full text-xs text-red-700">{state.message}</span>}
      {state?.ok && success && (
        <span className="basis-full text-xs text-accent">
          {success}
          {state.reference ? ` ${state.reference}` : ""}
        </span>
      )}
    </form>
  );
}

export function Submit({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "ghost" }) {
  return (
    <button
      type="submit"
      className={`rounded px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
        tone === "accent" ? "bg-accent text-white hover:opacity-90" : "border border-divider hover:border-text/40"
      }`}
    >
      {children}
    </button>
  );
}

export type BatchOption = { id: string; label: string; ask: number; cost: number | null; available: number };

const naira = (v: number) => `₦ ${(v / 1e6).toFixed(2)} m`;

// Quote terms with a live expected-margin readout (FR-37). Prices are entered
// in ₦ m/t to match how the desk quotes; the hidden field carries naira.
export function QuoteFields({
  batches,
  batchId,
  quantity,
  priceM,
  showBatch,
}: {
  batches: BatchOption[];
  batchId?: string;
  quantity?: number;
  priceM?: number;
  showBatch?: boolean;
}) {
  const [selected, setSelected] = useState(batchId ?? "");
  const batch = batches.find((b) => b.id === selected);
  const [qty, setQty] = useState(quantity ? String(quantity) : "");
  const [price, setPrice] = useState(priceM ? priceM.toFixed(2) : batch ? (batch.ask / 1e6).toFixed(2) : "");

  const q = Number(qty);
  const p = Number(price) * 1e6;
  const margin = batch?.cost != null && q > 0 && p > 0 ? { total: (p - batch.cost) * q, pct: ((p - batch.cost) / p) * 100 } : null;

  return (
    <>
      {showBatch ? (
        <select
          name="batchId"
          required
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            const b = batches.find((x) => x.id === e.target.value);
            if (b) setPrice((b.ask / 1e6).toFixed(2));
          }}
          className={input}
        >
          <option value="">Batch…</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </select>
      ) : (
        <input type="hidden" name="batchId" value={selected} />
      )}
      <label className="flex items-center gap-1 text-xs text-muted">
        <input
          name="quantity"
          type="number"
          step="0.1"
          min="0.1"
          max={batch?.available}
          required
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className={`${input} w-20 text-text`}
        />
        t
      </label>
      <label className="flex items-center gap-1 text-xs text-muted">
        ₦
        <input
          type="number"
          step="0.01"
          min="0.01"
          required
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className={`${input} w-20 text-text`}
        />
        m/t
      </label>
      <input type="hidden" name="unitPrice" value={p > 0 ? Math.round(p) : ""} />
      <label className="flex items-center gap-1 text-xs text-muted">
        valid
        <input name="validDays" type="number" min="1" max="30" defaultValue={3} className={`${input} w-12 text-text`} />
        days
      </label>
      <input name="deliveryTerms" placeholder="Terms (e.g. FOB Lagos)" className={`${input} w-36`} />
      <input name="destination" placeholder="Destination" className={`${input} w-32`} />
      <span className={`text-xs ${margin && margin.total < 0 ? "text-red-700" : "text-muted"}`}>
        {margin ? `Margin ${naira(margin.total)} · ${margin.pct.toFixed(1)}%` : batch && batch.cost == null ? "No cost on file" : ""}
      </span>
    </>
  );
}
