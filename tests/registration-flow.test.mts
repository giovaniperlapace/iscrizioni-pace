import assert from "node:assert/strict";
import test from "node:test";

import {
  renderMagicLinkEmail,
  renderRegistrationConfirmationEmail,
} from "../lib/email/templates.ts";
import {
  buildRegistrationQuestionnaireAnswers,
  REGISTRATION_QUESTIONS,
} from "../lib/questionnaire/registration.ts";
import { renderQrDataUrl } from "../lib/qrcode/render.ts";
import { decryptQrToken, encryptQrToken } from "../lib/qrcode/secure-token.ts";
import { createOpaqueQrToken, hashQrToken } from "../lib/qrcode/token.ts";
import {
  buildManualRegistrationQuestionnaireAnswers,
  parseManualRegistrationForm,
} from "../lib/registrations/manual-registration.ts";
import {
  canParticipantEditRegistration,
  diffParticipantDashboardUpdate,
  parseParticipantDashboardUpdate,
} from "../lib/registrations/participant-dashboard.ts";
import { buildAppMagicLink } from "../lib/registrations/magic-link.ts";
import {
  normalizeEmail,
  parseRegistrationForm,
} from "../lib/registrations/validation.ts";
import { checkRateLimit } from "../lib/security/rate-limit.ts";

test("normalizeEmail trims and lowercases email addresses", () => {
  assert.equal(normalizeEmail("  USER@Example.Org "), "user@example.org");
});

test("parseRegistrationForm validates required public registration fields", () => {
  const formData = new FormData();
  formData.set("email", "maria@example.org");
  formData.set("firstName", "Maria");
  formData.set("lastName", "Rossi");
  formData.set("birthDate", "2000-01-02");
  formData.set("birthPlace", "Italia, Roma");
  formData.set("nationality", "Italian (Italy)");
  formData.set("phone", "+3906000000");
  formData.set("countryOther", "Italia");
  formData.set("cityOther", "Roma");
  formData.set("hasAccessibilityNeeds", "no");
  formData.set("hasPreviousSantegidioParticipation", "no");
  formData.append("availabilityDays", "2026-10-25");
  formData.append("availabilityDays", "2026-10-27");
  formData.set("moment_11111111-1111-4111-8111-111111111111", "yes");
  formData.set("privacyAccepted", "on");
  formData.set("dataProcessingAccepted", "on");

  const parsed = parseRegistrationForm(formData);

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.email, "maria@example.org");
    assert.equal(parsed.value.phone, "+3906000000");
    assert.equal(parsed.value.preferredLocale, "it");
    assert.equal(parsed.value.attendanceChoice, "unknown");
    assert.deepEqual(parsed.value.availabilityDays, [
      "2026-10-25",
      "2026-10-27",
    ]);
    assert.equal(parsed.value.availabilityUnknown, false);
    assert.deepEqual(parsed.value.momentAttendanceChoices, {
      "11111111-1111-4111-8111-111111111111": "yes",
    });
  }
});

test("registration questionnaire inventory classifies sensitive questions", () => {
  const sensitive = REGISTRATION_QUESTIONS.filter(
    (question) => question.dataClass === "sensitive"
  );

  assert.ok(sensitive.some((question) => question.id === "washington_group_accessibility"));
  assert.ok(
    sensitive.every((question) => !question.visibleTo.includes("accoglienza"))
  );
});

test("questionnaire answers snapshot keeps configurable answers together", () => {
  const formData = new FormData();
  formData.set("email", "maria@example.org");
  formData.set("firstName", "Maria");
  formData.set("lastName", "Rossi");
  formData.set("birthDate", "2000-01-02");
  formData.set("birthPlace", "Italia, Roma");
  formData.set("nationality", "Italian (Italy)");
  formData.set("countryOther", "Italia");
  formData.set("cityOther", "Roma");
  formData.set("hasAccessibilityNeeds", "yes");
  formData.set("accessibility_hearing", "on");
  formData.set("accessibilityNotes", "Preferisce essere contattata al mattino.");
  formData.set("hasPreviousSantegidioParticipation", "yes");
  formData.set("participatesWithGroup", "no");
  formData.set("attendanceChoice", "yes");
  formData.set("availabilityUnknown", "on");
  formData.set("privacyAccepted", "on");
  formData.set("dataProcessingAccepted", "on");

  const parsed = parseRegistrationForm(formData);

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    const answers = buildRegistrationQuestionnaireAnswers(parsed.value);

    assert.equal(answers.birthPlace, "Italia, Roma");
    assert.equal(answers.nationality, "Italian (Italy)");
    assert.equal(answers.attendance.overallChoice, "yes");
    assert.equal(answers.attendance.availabilityUnknown, true);
    assert.deepEqual(answers.attendance.availabilityDays, []);
    assert.equal(answers.groupParticipation.participatesWithGroup, false);
    assert.equal(answers.accessibility.hasAccessibilityNeeds, true);
    assert.deepEqual(answers.accessibility.washingtonGroupAnswers, {
      hearing: true,
    });
    assert.equal(answers.consents.privacyAccepted, true);
  }
});

test("parseRegistrationForm keeps accessibility notes optional", () => {
  const formData = new FormData();
  formData.set("email", "maria@example.org");
  formData.set("firstName", "Maria");
  formData.set("lastName", "Rossi");
  formData.set("birthDate", "2000-01-02");
  formData.set("birthPlace", "Italia, Roma");
  formData.set("nationality", "Italian (Italy)");
  formData.set("countryOther", "Italia");
  formData.set("cityOther", "Roma");
  formData.set("hasAccessibilityNeeds", "yes");
  formData.set("accessibility_hearing", "on");
  formData.set("hasPreviousSantegidioParticipation", "no");
  formData.append("availabilityDays", "2026-10-25");
  formData.set("privacyAccepted", "on");
  formData.set("dataProcessingAccepted", "on");

  const parsed = parseRegistrationForm(formData);

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.accessibilityNotes, null);
  }
});

test("parseRegistrationForm requires sensitive consent only for accessibility needs", () => {
  const formData = new FormData();
  formData.set("email", "maria@example.org");
  formData.set("firstName", "Maria");
  formData.set("lastName", "Rossi");
  formData.set("birthDate", "2000-01-02");
  formData.set("birthPlace", "Italia, Roma");
  formData.set("nationality", "Italian (Italy)");
  formData.set("countryOther", "Italia");
  formData.set("cityOther", "Roma");
  formData.set("hasAccessibilityNeeds", "no");
  formData.set("hasPreviousSantegidioParticipation", "no");
  formData.append("availabilityDays", "2026-10-25");
  formData.set("privacyAccepted", "on");

  const withoutAccessibilityNeeds = parseRegistrationForm(formData);

  assert.equal(withoutAccessibilityNeeds.ok, true);
  if (withoutAccessibilityNeeds.ok) {
    assert.equal(withoutAccessibilityNeeds.value.dataProcessingAccepted, false);
  }

  formData.set("hasAccessibilityNeeds", "yes");
  formData.set("accessibility_hearing", "on");
  const missingSensitiveConsent = parseRegistrationForm(formData);

  assert.equal(missingSensitiveConsent.ok, false);

  formData.set("dataProcessingAccepted", "on");
  const withSensitiveConsent = parseRegistrationForm(formData);

  assert.equal(withSensitiveConsent.ok, true);
});

test("parseRegistrationForm keeps phone optional but validates it when present", () => {
  const formData = new FormData();
  formData.set("email", "maria@example.org");
  formData.set("firstName", "Maria");
  formData.set("lastName", "Rossi");
  formData.set("birthDate", "2000-01-02");
  formData.set("birthPlace", "Italia, Roma");
  formData.set("nationality", "Italian (Italy)");
  formData.set("countryOther", "Italia");
  formData.set("cityOther", "Roma");
  formData.set("hasAccessibilityNeeds", "no");
  formData.set("hasPreviousSantegidioParticipation", "no");
  formData.append("availabilityDays", "2026-10-25");
  formData.set("privacyAccepted", "on");
  formData.set("dataProcessingAccepted", "on");

  const withoutPhone = parseRegistrationForm(formData);

  assert.equal(withoutPhone.ok, true);
  if (withoutPhone.ok) {
    assert.equal(withoutPhone.value.phone, null);
  }

  formData.set("phone", "+39ABC");
  const withInvalidPhone = parseRegistrationForm(formData);

  assert.equal(withInvalidPhone.ok, false);

  formData.set("phone", "+2348012345678");
  const withCustomPrefixPhone = parseRegistrationForm(formData);

  assert.equal(withCustomPrefixPhone.ok, true);
  if (withCustomPrefixPhone.ok) {
    assert.equal(withCustomPrefixPhone.value.phone, "+2348012345678");
  }
});

test("parseRegistrationForm rejects missing consents", () => {
  const formData = new FormData();
  formData.set("email", "maria@example.org");
  formData.set("firstName", "Maria");
  formData.set("lastName", "Rossi");
  formData.set("countryOther", "Italia");
  formData.set("cityOther", "Roma");

  const parsed = parseRegistrationForm(formData);

  assert.equal(parsed.ok, false);
});

test("parseManualRegistrationForm accepts a minimal group leader entry", () => {
  const formData = new FormData();
  formData.set("groupId", "11111111-1111-4111-8111-111111111111");
  formData.set("firstName", "Paolo");
  formData.set("lastName", "Bianchi");
  formData.set("phone", "+39 333 123 4567");
  formData.set("preferredLocale", "en");
  formData.append("availabilityDays", "2026-10-25");
  formData.append("availabilityDays", "2026-10-26");
  formData.set("hasAccessibilityNeeds", "yes");
  formData.set("accessibility_walkingOrSteps", "on");
  formData.set("needsOperationalSupport", "on");
  formData.set("accessibilityNotes", "Serve posto vicino all'ingresso.");
  formData.set("leaderNote", "  Arriva con il gruppo di Roma.  ");
  formData.set("consentConfirmed", "on");

  const parsed = parseManualRegistrationForm(formData);

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.email, null);
    assert.equal(parsed.value.phone, "+393331234567");
    assert.equal(parsed.value.preferredLocale, "en");
    assert.equal(parsed.value.availabilityUnknown, false);
    assert.deepEqual(parsed.value.availabilityDays, [
      "2026-10-25",
      "2026-10-26",
    ]);
    assert.equal(parsed.value.hasAccessibilityNeeds, true);
    assert.deepEqual(parsed.value.accessibilityAnswers, {
      walkingOrSteps: true,
    });
    assert.equal(parsed.value.needsOperationalSupport, true);
    assert.equal(parsed.value.accessibilityNotes, "Serve posto vicino all'ingresso.");
    assert.equal(parsed.value.leaderNote, "Arriva con il gruppo di Roma.");
  }
});

test("parseManualRegistrationForm requires contact and consent", () => {
  const formData = new FormData();
  formData.set("groupId", "11111111-1111-4111-8111-111111111111");
  formData.set("firstName", "Paolo");
  formData.set("lastName", "Bianchi");

  const parsed = parseManualRegistrationForm(formData);

  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.ok(parsed.errors.includes("Inserisci almeno email o telefono."));
    assert.ok(
      parsed.errors.includes(
        "Conferma di avere il consenso della persona iscritta."
      )
    );
  }
});

test("manual registration questionnaire snapshot marks group leader source", () => {
  const formData = new FormData();
  formData.set("groupId", "11111111-1111-4111-8111-111111111111");
  formData.set("firstName", "Paolo");
  formData.set("lastName", "Bianchi");
  formData.set("email", "paolo@example.org");
  formData.set("availabilityUnknown", "on");
  formData.set("hasAccessibilityNeeds", "yes");
  formData.set("accessibility_walkingOrSteps", "on");
  formData.set("accessibilityNotes", "Da richiamare prima della partenza.");
  formData.set("consentConfirmed", "on");

  const parsed = parseManualRegistrationForm(formData);

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    const answers = buildManualRegistrationQuestionnaireAnswers(parsed.value, {
      id: parsed.value.groupId,
      name: "Roma - Giovani per la Pace",
    });

    assert.equal(answers.source, "capogruppo_manual");
    assert.equal(answers.contact.hasEmail, true);
    assert.equal(answers.groupParticipation.enteredByGroupLeader, true);
    assert.equal(answers.accessibility.hasAccessibilityNeeds, true);
    assert.deepEqual(answers.accessibility.washingtonGroupAnswers, {
      walkingOrSteps: true,
    });
    assert.equal(
      answers.accessibility.operationalNotes,
      "Da richiamare prima della partenza."
    );
    assert.equal(answers.consents.acceptedByGroupLeader, true);
  }
});

test("QR tokens are opaque and only hashes are stable", () => {
  const first = createOpaqueQrToken();
  const second = createOpaqueQrToken();

  assert.notEqual(first.token, second.token);
  assert.equal(first.tokenHash, hashQrToken(first.token));
  assert.notEqual(first.tokenHash, first.token);
});

test("QR tokens can be encrypted for server-side dashboard rendering", () => {
  process.env.QR_TOKEN_ENCRYPTION_SECRET = "test-secret";
  const token = createOpaqueQrToken().token;
  const encrypted = encryptQrToken(token);

  assert.notEqual(encrypted, token);
  assert.equal(decryptQrToken(encrypted), token);
});

test("QR renderer returns an image data URL", async () => {
  const dataUrl = await renderQrDataUrl("opaque-token");

  assert.match(dataUrl, /^data:image\/png;base64,/);
});

test("magic link template escapes action URLs", () => {
  const rendered = renderMagicLinkEmail({
    actionLink: 'https://example.org/auth?x="<tag>',
  });

  assert.match(rendered.html, /&quot;&lt;tag&gt;/);
});

test("app magic links verify token hashes as email OTPs", () => {
  const link = buildAppMagicLink(
    "https://iscrizioni-pace.vercel.app/auth/callback?redirect_to=/dashboard/partecipante",
    "hashed-token"
  );

  assert.ok(link);
  const url = new URL(link);

  assert.equal(url.searchParams.get("token_hash"), "hashed-token");
  assert.equal(url.searchParams.get("type"), "email");
  assert.equal(url.searchParams.get("redirect_to"), "/dashboard/partecipante");
});

test("registration confirmation includes the short participant code", () => {
  const rendered = renderRegistrationConfirmationEmail({
    firstName: "Maria",
    lastName: "Rossi",
    participantCode: "A7K2",
    eventTitle: "Assisi 2026",
    siteLink: "https://iscrizioni-pace.vercel.app",
    qrCodeContentId: "registration-qr@example.org",
  });

  assert.match(rendered.text, /A7K2/);
  assert.match(rendered.html, /A7K2/);
  assert.match(rendered.text, /QR code personale/);
  assert.match(rendered.html, /cid:registration-qr@example\.org/);
});

test("rate limit blocks attempts after the configured threshold", () => {
  assert.equal(checkRateLimit("test-key", { limit: 2, windowMs: 1000 }, 0), true);
  assert.equal(checkRateLimit("test-key", { limit: 2, windowMs: 1000 }, 1), true);
  assert.equal(checkRateLimit("test-key", { limit: 2, windowMs: 1000 }, 2), false);
  assert.equal(checkRateLimit("test-key", { limit: 2, windowMs: 1000 }, 1001), true);
});

test("parseParticipantDashboardUpdate validates editable participant fields", () => {
  const formData = new FormData();
  formData.set("registrationId", "11111111-1111-4111-8111-111111111111");
  formData.set("phone", "+39 06 000000");
  formData.set("preferredLocale", "en");
  formData.append("availabilityDays", "2026-09-04");
  formData.set("moment_22222222-2222-4222-8222-222222222222", "yes");
  formData.set("hasAccessibilityNeeds", "on");
  formData.set("accessibility_walkingOrSteps", "on");
  formData.set("accessibilityNotes", "Preferisce ingresso senza scale.");

  const parsed = parseParticipantDashboardUpdate(formData);

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.phone, "+3906000000");
    assert.equal(parsed.value.preferredLocale, "en");
    assert.deepEqual(parsed.value.availabilityDays, ["2026-09-04"]);
    assert.deepEqual(parsed.value.momentAttendanceChoices, {
      "22222222-2222-4222-8222-222222222222": "yes",
    });
    assert.deepEqual(parsed.value.accessibilityAnswers, {
      walkingOrSteps: true,
    });
    assert.equal(parsed.value.needsOperationalSupport, true);
  }
});

test("parseParticipantDashboardUpdate clears hidden accessibility details when support is not requested", () => {
  const formData = new FormData();
  formData.set("registrationId", "11111111-1111-4111-8111-111111111111");
  formData.append("availabilityDays", "2026-09-04");
  formData.set("accessibility_walkingOrSteps", "on");
  formData.set("accessibilityNotes", "Nota rimasta nel form nascosto.");

  const parsed = parseParticipantDashboardUpdate(formData);

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.deepEqual(parsed.value.accessibilityAnswers, {});
    assert.equal(parsed.value.needsOperationalSupport, false);
    assert.equal(parsed.value.accessibilityNotes, null);
  }
});

test("canParticipantEditRegistration closes cancelled and late registrations", () => {
  assert.equal(
    canParticipantEditRegistration({
      status: "cancelled",
      events: { registration_closes_at: null },
    }),
    false
  );
  assert.equal(
    canParticipantEditRegistration(
      {
        status: "submitted",
        events: { registration_closes_at: "2026-08-01T00:00:00.000Z" },
      },
      new Date("2026-08-02T00:00:00.000Z")
    ),
    false
  );
  assert.equal(
    canParticipantEditRegistration(
      {
        status: "submitted",
        events: { registration_closes_at: "2026-08-03T00:00:00.000Z" },
      },
      new Date("2026-08-02T00:00:00.000Z")
    ),
    true
  );
});

test("diffParticipantDashboardUpdate returns changed field names for audit", () => {
  const changed = diffParticipantDashboardUpdate(
    {
      phone: "+3906000000",
      preferredLocale: "it",
      availabilityDays: ["2026-09-04"],
      availabilityUnknown: false,
      momentAttendanceChoices: {
        "22222222-2222-4222-8222-222222222222": "unknown",
      },
      accessibilityAnswers: {},
      needsOperationalSupport: false,
      accessibilityNotes: null,
    },
    {
      registrationId: "11111111-1111-4111-8111-111111111111",
      phone: "+3906000000",
      preferredLocale: "en",
      availabilityDays: ["2026-09-05"],
      availabilityUnknown: false,
      momentAttendanceChoices: {
        "22222222-2222-4222-8222-222222222222": "yes",
      },
      accessibilityAnswers: {
        walkingOrSteps: true,
      },
      needsOperationalSupport: true,
      accessibilityNotes: "Serve supporto.",
    }
  );

  assert.deepEqual(changed, [
    "preferred_locale",
    "availability_days",
    "moment_attendance_choices",
    "accessibility_answers",
    "needs_operational_support",
    "accessibility_notes",
  ]);
});
