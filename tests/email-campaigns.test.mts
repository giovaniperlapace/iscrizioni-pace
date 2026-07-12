import assert from "node:assert/strict";
import test from "node:test";
import { campaignTextToHtml, renderCampaignTemplate, validateCampaignTemplate } from "../lib/email/campaign-templates.ts";
import { campaignHtmlToText, renderSafeCampaignHtml } from "../lib/email/campaign-html.server.ts";

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
