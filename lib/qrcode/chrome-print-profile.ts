import { QR_LABEL_PROFILES, type QrLabelProfile } from "./print-label-profile.ts";
// Read-only preflight. A saved state never proves the physical result or loaded roll.
export function chromeLabelProfileErrors(state: Record<string, unknown>, profile: QrLabelProfile, printer: string, paperId: string): string[] {
  const media = state.mediaSize as Record<string, unknown> | undefined;
  const problems: string[] = [];
  if (!paperId || media?.vendor_id !== paperId || media.width_microns !== 29000 || media.height_microns !== QR_LABEL_PROFILES[profile].height * 1000) problems.push("Formato reale del driver non verificato");
  if (state.selectedDestinationId !== printer) problems.push("Stampante diversa da quella verificata");
  if (state.copies !== 1) problems.push("Impostare una sola copia");
  if (state.marginsType !== 1 || state.scaling !== "100" || state.scalingType !== 3 || state.isLandscapeEnabled !== false || state.isHeaderFooterEnabled !== false) problems.push("Verificare verticale, margini Nessuno, scala 100% e nessuna intestazione");
  if (state.pagesPerSheet !== undefined && state.pagesPerSheet !== 1) problems.push("Impostare una pagina per foglio");
  for (const key of ["pageRange", "ranges"]) if (state[key] !== undefined && (!Array.isArray(state[key]) || (state[key] as unknown[]).length)) problems.push("Selezionare tutte le pagine");
  if (state.isDuplexEnabled === true) problems.push("Disattivare fronte/retro");
  return problems;
}
