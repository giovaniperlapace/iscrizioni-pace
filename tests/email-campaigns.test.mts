import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { campaignTextToHtml, renderCampaignTemplate, validateCampaignTemplate } from "../lib/email/campaign-templates.ts";
import { campaignHtmlToText, renderSafeCampaignHtml } from "../lib/email/campaign-html.server.ts";
import { publicCampaignError } from "../lib/email/public-errors.ts";

const person = { firstName: "Ada", lastName: "Lovelace", participantCode: "P-1", groupName: "Roma", eventTitle: "Pace" };

test("campaign templates render supported participant fields", () => {
  assert.equal(renderCampaignTemplate("Ciao {{ nome }} — {{evento}}", person), "Ciao Ada — Pace");
});

test("campaign HTML escapes user and operator content", () => {
  assert.equal(campaignTextToHtml("Ciao <script>\n\nGrazie"), "<p>Ciao &lt;script&gt;</p><p>Grazie</p>");
});

test("campaign templates report unsupported fields", () => {
  assert.deepEqual(validateCampaignTemplate("{{nome}}", "{{email}} {{segreto}}"), ["email", "segreto"]);
});

test("rich campaign HTML keeps formatting and removes unsafe content", () => {
  const html = renderSafeCampaignHtml(
    '<h2>Ciao {{nome}}</h2><script>alert(1)</script><p onclick="bad()">Testo</p>',
    { ...person, firstName: '<Ada>' }
  );

  assert.match(html, /<h2>Ciao &lt;Ada&gt;<\/h2>/);
  assert.doesNotMatch(html, /script|onclick|alert/);
});

test("rich campaign HTML has a readable text fallback", () => {
  assert.equal(campaignHtmlToText("<h2>Titolo</h2><p>Prima<br>Seconda</p>"), "Titolo\nPrima\nSeconda");
});

test("campaign queue supports leaders and removes the 100 recipient database limit", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260729120000_email_campaign_audiences_and_daily_queue.sql",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(migration, /recipient_type in \('participant', 'group_leader'\)/);
  assert.match(migration, /recipient_count >= 0/);
  assert.match(migration, /scheduled_for date/);
  assert.match(migration, /attempted_on date/);
  assert.match(migration, /delivery_order integer/);
  assert.match(migration, /unique \(campaign_id, recipient_key\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /300 - v_attempted/);
  assert.match(migration, /for update skip locked/);
});

test("campaign API does not expose database details to users", () => {
  const result = publicCampaignError(
    new Error(
      "Could not find the 'delivery_order' column of 'email_campaign_recipients' in the schema cache"
    ),
    "preview"
  );

  assert.equal(result.status, 500);
  assert.equal(result.unexpected, true);
  assert.equal(
    result.message,
    "Non è stato possibile preparare l'anteprima. Nessuna email è stata inviata. Riprova tra qualche minuto."
  );
  assert.doesNotMatch(result.message, /delivery_order|schema cache/);
});

test("campaign API keeps useful validation errors", () => {
  const result = publicCampaignError(
    new Error("Seleziona almeno un destinatario."),
    "preview"
  );

  assert.deepEqual(result, {
    message: "Seleziona almeno un destinatario.",
    status: 400,
    unexpected: false,
  });
});

test("final delivery error does not claim that no message was sent", () => {
  const result = publicCampaignError(
    new Error("Connection unexpectedly closed"),
    "send"
  );

  assert.equal(
    result.message,
    "Non è stato possibile completare l'invio. Controlla lo stato della campagna prima di riprovare."
  );
  assert.doesNotMatch(result.message, /Nessuna email/);
});
