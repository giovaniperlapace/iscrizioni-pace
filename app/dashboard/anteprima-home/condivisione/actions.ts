"use server";

import { requirePreviewShareAdmin } from "@/lib/panels/home-preview-share.server";
import { revalidatePath } from "next/cache";
import { createHomePreviewToken, hashHomePreviewToken } from "@/lib/panels/home-preview-share";

export async function createPreviewShare(_previous: { path?: string; error?: string }, form: FormData): Promise<{ path?: string; error?: string }> {
  const { db, eventId } = await requirePreviewShareAdmin();
  const label = String(form.get("label") ?? "").trim();
  if (!label || label.length > 80) return { error: "Inserisci un nome per riconoscere il link (massimo 80 caratteri)." };
  const token = createHomePreviewToken();
  const { error } = await db.from("home_preview_shares").insert({ event_id: eventId, label, token_hash: hashHomePreviewToken(token) });
  if (error) return { error: "Non è stato possibile creare il link. Riprova." };
  revalidatePath("/dashboard/anteprima-home/condivisione");
  return { path: `/anteprima-home/${token}` };
}

export async function revokePreviewShare(form: FormData) {
  const { db, eventId } = await requirePreviewShareAdmin();
  const id = String(form.get("shareId") ?? "");
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error("Link non valido.");
  const { error } = await db.from("home_preview_shares").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("event_id", eventId).is("revoked_at", null);
  if (error) throw new Error("Revoca non riuscita. Riprova.");
  revalidatePath("/dashboard/anteprima-home/condivisione");
}
