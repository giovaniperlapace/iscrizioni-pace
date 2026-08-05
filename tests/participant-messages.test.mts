import assert from "node:assert/strict";
import test from "node:test";

import {
  PARTICIPANT_MESSAGE_MAX_LENGTH,
  parseParticipantMessage,
} from "../lib/registrations/participant-message-shared.ts";
import {
  PARTICIPANT_MESSAGE_RECIPIENT,
  renderParticipantOrganizerMessageEmail,
} from "../lib/registrations/participant-messages.server.ts";

test("participant messages always use the fixed organizer recipient and subject", () => {
  const email = renderParticipantOrganizerMessageEmail({
    firstName: "Anna",
    lastName: "Bianchi",
    groupName: "Trastevere",
    participantId: "PACE-1234",
    email: "anna@example.org",
    message: "Vorrei ricevere maggiori informazioni.",
  });

  assert.equal(PARTICIPANT_MESSAGE_RECIPIENT, "registrationspeace@santegidio.org");
  assert.equal(email.subject, "Participant Message - Anna Bianchi");
  assert.match(email.text, /Participant name: Anna/);
  assert.match(email.text, /Participant surname: Bianchi/);
  assert.match(email.text, /Participant group: Trastevere/);
  assert.match(email.text, /Participant ID: PACE-1234/);
  assert.match(email.text, /Participant email: anna@example\.org/);
  assert.match(email.text, /Message\nVorrei ricevere maggiori informazioni\./);
});

test("participant message details stay inline and emphasize important values", () => {
  const email = renderParticipantOrganizerMessageEmail({
    firstName: "Anna",
    lastName: "Bianchi",
    groupName: "Trastevere",
    participantId: "PACE-1234",
    email: "anna@example.org",
    message: "Messaggio di prova",
  });

  assert.doesNotMatch(email.html, /<(?:dl|dt|dd)>/);
  assert.match(
    email.html,
    /<strong>Participant name:<\/strong> Anna/
  );
  assert.match(
    email.html,
    /<strong>Participant surname:<\/strong> Bianchi/
  );
  assert.match(
    email.html,
    /<strong>Participant email:<\/strong> <a href="mailto:anna@example\.org"/
  );
});

test("participant message HTML escapes participant data and message content", () => {
  const email = renderParticipantOrganizerMessageEmail({
    firstName: "<Anna>",
    lastName: "Bianchi",
    groupName: "A & B",
    participantId: "PACE-1",
    email: "anna@example.org",
    message: "Prima riga\n<script>alert(1)</script>",
  });

  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /&lt;Anna&gt;/);
  assert.match(email.html, /A &amp; B/);
  assert.match(email.html, /Prima riga<br \/>&lt;script&gt;/);
});

test("participant message validation accepts only a non-empty bounded message", () => {
  assert.deepEqual(parseParticipantMessage("  Ciao  "), {
    ok: true,
    value: "Ciao",
  });
  assert.deepEqual(parseParticipantMessage("   "), {
    ok: false,
    error: "empty",
  });
  assert.deepEqual(
    parseParticipantMessage("a".repeat(PARTICIPANT_MESSAGE_MAX_LENGTH + 1)),
    { ok: false, error: "too-long" }
  );
});
