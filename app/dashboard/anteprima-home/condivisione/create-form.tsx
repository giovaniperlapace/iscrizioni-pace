"use client";

import { useActionState, useState } from "react";
import { createPreviewShare } from "./actions";

export function CreatePreviewShareForm() {
  const [state, action, pending] = useActionState(createPreviewShare, {});
  const [copiedPath, setCopiedPath] = useState("");
  return <div className="surface-card p-6">
    <form action={action} className="grid gap-4">
      <label className="grid gap-2 font-semibold">Nome del link<input className="field" name="label" required maxLength={80} placeholder="Approvazione home" /></label>
      <button disabled={pending} className="btn-primary justify-self-start px-5 py-3">{pending ? "Creazione…" : "Crea link riservato"}</button>
    </form>
    {state.error ? <p role="alert" className="mt-4">{state.error}</p> : null}
    {state.path ? <div className="mt-5 grid gap-3" aria-live="polite"><p>Link creato. Copialo ora: per sicurezza non verrà mostrato di nuovo.</p><a className="break-all underline" href={state.path}>Apri anteprima</a><button type="button" className="btn-secondary justify-self-start px-5 py-3" onClick={async () => { try { await navigator.clipboard.writeText(new URL(state.path!, window.location.origin).href); setCopiedPath(state.path!); } catch { setCopiedPath(""); } }}>{copiedPath === state.path ? "Copiato" : "Copia link"}</button></div> : null}
  </div>;
}
