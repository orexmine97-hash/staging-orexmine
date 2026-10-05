"use client";

import { useActionState, useRef } from "react";
import { createUserAction, setUserActiveAction, updateUserRoleAction } from "@/app/actions/users";

type RoleOption = { value: string; label: string };

// Create a staff account. The server action provisions Auth0 + the User row and
// returns an invite link the admin sends to the new user (no email provider wired
// yet — see the note in the page). Failures render inline.
export function CreateUserForm({ roles }: { roles: RoleOption[] }) {
  const [state, action, pending] = useActionState<
    Awaited<ReturnType<typeof createUserAction>> | null,
    FormData
  >((_prev, fd) => createUserAction(fd), null);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-muted">
        Name
        <input name="name" required className="w-48 rounded border border-divider bg-bg px-2 py-1.5 text-sm text-text" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Email
        <input name="email" type="email" required className="w-64 rounded border border-divider bg-bg px-2 py-1.5 text-sm text-text" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Role
        <select name="role" required defaultValue="" className="w-52 rounded border border-divider bg-bg px-2 py-1.5 text-sm text-text">
          <option value="" disabled>Select a role…</option>
          {roles.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create & invite"}
      </button>

      {state && !state.ok && <p className="w-full text-xs text-red-700">{state.message}</p>}
      {state && state.ok && (
        <div className="w-full rounded-md border border-accent/30 bg-accent/5 p-3 text-xs">
          <p className="font-medium text-text">Account created. Send this invite link to the user:</p>
          <input
            readOnly
            value={state.inviteUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-1.5 w-full rounded border border-divider bg-surface px-2 py-1 font-mono text-[11px] text-text"
          />
        </div>
      )}
    </form>
  );
}

export function RoleForm({ userId, role, roles }: { userId: string; role: string; roles: RoleOption[] }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<Awaited<ReturnType<typeof updateUserRoleAction>> | null, FormData>(
    (_prev, fd) => updateUserRoleAction(fd),
    null,
  );

  return (
    <form ref={ref} action={action} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue={role}
        onChange={() => ref.current?.requestSubmit()}
        className="rounded border border-divider bg-bg px-2 py-1 text-xs text-text"
      >
        {roles.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      {state && !state.ok && <span className="text-xs text-red-700">{state.message}</span>}
    </form>
  );
}

export function ActiveButton({ userId, active }: { userId: string; active: boolean }) {
  const [state, action, pending] = useActionState<Awaited<ReturnType<typeof setUserActiveAction>> | null, FormData>(
    (_prev, fd) => setUserActiveAction(fd),
    null,
  );

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="active" value={String(!active)} />
      <button
        type="submit"
        disabled={pending}
        className={`rounded px-2 py-1 text-xs font-medium disabled:opacity-50 ${
          active ? "border border-divider text-muted hover:bg-divider/40" : "bg-accent text-white hover:opacity-90"
        }`}
      >
        {pending ? "…" : active ? "Deactivate" : "Reactivate"}
      </button>
      {state && !state.ok && <span className="text-xs text-red-700">{state.message}</span>}
    </form>
  );
}
