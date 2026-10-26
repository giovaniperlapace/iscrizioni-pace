import PDFDocument from "pdfkit";
import { Readable } from "node:stream";
import path from "node:path";
import { createCampaignBadgeImage } from "../email/campaign-badge.server.ts";
import type { closingLeaderDownloadTickets } from "./closing-leader-download.ts";

export function streamClosingLeaderPdf(tickets: ReturnType<typeof closingLeaderDownloadTickets>) {
  if (!tickets.length) throw Error("empty_badges");
  const doc = new PDFDocument({ size: [282.3, 501.6], margin: 0, autoFirstPage: false,
    font: path.join(process.cwd(), "lib/qrcode/fonts/NotoSans-Regular.ttf"),
    info: { Title: "Cerimonia finale - Tutti i biglietti" } });
  const stream = Readable.toWeb(doc) as ReadableStream<Uint8Array>;
  // Generate sequentially and stream pages instead of buffering every badge
  // in the server response. A rendering error aborts the download in full.
  void (async () => {
    try {
      for (const ticket of tickets) {
        if (doc.destroyed) return;
        const { jpeg } = await createCampaignBadgeImage({ firstName: ticket.name, lastName: "", groupName: "" }, ticket.template);
        if (doc.destroyed) return;
        doc.addPage();
        doc.image(jpeg, 0, 0, { width: 282.3, height: 501.6 });
        doc.flushPages();
      }
      doc.end();
    } catch {
      doc.destroy(Error("badge_generation_failed"));
    }
  })();
  return stream;
}
