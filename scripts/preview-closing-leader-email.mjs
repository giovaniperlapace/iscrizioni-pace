// Synthetic, local preview only. Does not send email or read production data.
import { prepareClosingBadgeEmail } from '../lib/ceremonies/closing-email.server.ts';
import { CLOSING_BADGE_SECTORS } from '../lib/ceremonies/closing-badges.ts';
import { mkdir, writeFile } from 'node:fs/promises';
const directory = 'output/closing-leader-email-preview';
await mkdir(directory, { recursive: true });
const id = '00000000-0000-4000-8000-000000000001';
const names = ['Anna Bianchi', 'Paolo Verdi', 'Giulia Neri'];
const notice = { id, claim: id, eventId: id, userId: id, registrationId: null,
  payload: { kind: 'closing', badgeWorkflow: true, noticeType: 'leader_contacts', title: 'Cerimonia finale',
    snapshotAt: '2026-10-26T18:00:00Z', startsAt: '2026-10-27T15:15:00Z', location: 'Basilica di San Francesco, Assisi', instructions: {},
    lines: CLOSING_BADGE_SECTORS.map((s, i) => ({ name: names[i], nomineeId: `synthetic-${i}`, groupId: id, groupName: 'Gruppo di esempio', communicationDelegated: true, sector: s.name, badgeCode: s.code })) } };
const email = await prepareClosingBadgeEmail(notice, 'https://example.invalid');
let html = email.html;
for (const file of email.attachments) {
  await writeFile(`${directory}/${file.filename}`, file.content);
  if (file.cid) html = html.replaceAll(`cid:${file.cid}`, file.filename);
}
await writeFile(`${directory}/index.html`, `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Anteprima email capogruppo</title><body style="margin:20px auto;padding:0 16px;max-width:842px;font:16px/1.5 Arial;color:#182230">${html}</body></html>`);
await writeFile(`${directory}/message.txt`, email.text);
console.log(`Anteprima: ${directory}/index.html; ${email.attachments.length} PDF/immagini, nessun invio.`);
