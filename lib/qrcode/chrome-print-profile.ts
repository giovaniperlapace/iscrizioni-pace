import { QR_LABEL_PROFILES, type QrLabelProfile } from "./print-label-profile.ts";
// Read-only preflight. A saved state never proves the physical result or loaded roll.
export type MacCustomLabelPaper = { name: string; widthPoints: number; heightPoints: number };
export function chromeLabelProfileErrors(state: Record<string, unknown>, profile: QrLabelProfile, printer: string, paperId: string, customPaper?: MacCustomLabelPaper): string[] {
  const media = state.mediaSize as Record<string, unknown> | undefined;
  const problems: string[] = [];
  // macOS custom papers have no vendor_id. Validate the named OS paper too;
  // Chromium converts its dimensions through integer PostScript points.
  const pointMicrons = 25400 / 72;
  const validCustom = customPaper && !paperId && !media?.vendor_id &&
    Math.abs(customPaper.widthPoints * pointMicrons - 29000) < 1 &&
    Math.abs(customPaper.heightPoints * pointMicrons - QR_LABEL_PROFILES[profile].height * 1000) < 1 &&
    media?.custom_display_name === customPaper.name &&
    media.width_microns === Math.round(Math.floor(customPaper.widthPoints) * pointMicrons) &&
    media.height_microns === Math.round(Math.floor(customPaper.heightPoints) * pointMicrons);
  const validDriver = paperId && !customPaper && media?.vendor_id === paperId && media.width_microns === 29000 && media.height_microns === QR_LABEL_PROFILES[profile].height * 1000;
  if (!validCustom && !validDriver) problems.push("Formato reale del driver non verificato");
  const recent = state.recentDestinations as { id?: string; origin?: string }[] | undefined;
  const destination = state.selectedDestinationId ?? (recent?.[0]?.origin === "local" ? recent[0].id : undefined);
  if (destination !== printer) problems.push("Stampante diversa da quella verificata");
  // Chromium does not serialize copies or ranges: each preview defaults to one
  // copy and all pages. Portrait is also the default when layout is omitted.
  if ((state.copies ?? 1) !== 1) problems.push("Impostare una sola copia");
  // Chromium ScalingType: ACTUAL_SIZE=3, CUSTOM=4; fit modes remain forbidden.
  if (state.marginsType !== 1 || state.scaling !== "100" || ![3, 4].includes(state.scalingType as number) || (state.isLandscapeEnabled ?? false) !== false || state.isHeaderFooterEnabled !== false) problems.push("Verificare verticale, margini Nessuno, scala 100% e nessuna intestazione");
  if (state.pagesPerSheet !== undefined && state.pagesPerSheet !== 1) problems.push("Impostare una pagina per foglio");
  for (const key of ["pageRange", "ranges"]) if (state[key] !== undefined && (!Array.isArray(state[key]) || (state[key] as unknown[]).length)) problems.push("Selezionare tutte le pagine");
  if (state.isDuplexEnabled === true) problems.push("Disattivare fronte/retro");
  return problems;
}
