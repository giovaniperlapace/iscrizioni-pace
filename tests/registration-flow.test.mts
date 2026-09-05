import assert from "node:assert/strict";
import test from "node:test";

import {
  renderGroupLeaderAssignmentNotificationEmail,
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
  preserveAccessibilityUnlessEdited,
  preserveChildrenUnlessEdited,
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
  formData.set("externalGroupAssociation", "Associazione Giovani del quartiere");
  formData.append("availabilityDays", "2026-10-25");
  formData.append("availabilityDays", "2026-10-27");
  formData.set("moment_11111111-1111-4111-8111-111111111111", "yes");
  formData.set("privacyAccepted", "on");
  formData.set("dataProcessingAccepted", "on");
  formData.set("futureEventsCommunicationsAccepted", "on");

  const parsed = parseRegistrationForm(formData);

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.email, "maria@example.org");
    assert.equal(parsed.value.phone, "+3906000000");
    assert.equal(parsed.value.preferredLocale, "en");
    assert.equal(
      parsed.value.externalGroupAssociation,
      "Associazione Giovani del quartiere"
    );
    assert.equal(parsed.value.attendanceChoice, "unknown");
    assert.deepEqual(parsed.value.availabilitySlots, [
      { day: "2026-10-25", part: "morning" },
      { day: "2026-10-25", part: "afternoon" },
      { day: "2026-10-27", part: "morning" },
      { day: "2026-10-27", part: "afternoon" },
    ]);
    assert.equal(parsed.value.availabilityUnknown, false);
    assert.equal(parsed.value.futureEventsCommunicationsAccepted, true);
    assert.deepEqual(parsed.value.momentAttendanceChoices, {
      "11111111-1111-4111-8111-111111111111": "yes",
    });
    assert.equal(
      buildRegistrationQuestionnaireAnswers(parsed.value).externalGroupAssociation,
      "Associazione Giovani del quartiere"
    );
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

test("parseRegistrationForm validates and stores accompanying children", () => {
  const formData = new FormData();
  formData.set("email", "maria@example.org");
  formData.set("firstName", "Maria");
  formData.set("lastName", "Rossi");
  formData.set("birthDate", "1990-01-02");
  formData.set("birthPlace", "Italia, Roma");
  formData.set("nationality", "Italian (Italy)");
  formData.set("countryOther", "Italia");
  formData.set("cityOther", "Roma");
  formData.set("hasAccessibilityNeeds", "no");
  formData.set("hasPreviousSantegidioParticipation", "no");
  formData.append("availabilityDays", "2026-10-25");
  formData.set("privacyAccepted", "on");
  formData.set("participatesWithChildren", "yes");
  formData.set("childrenCount", "3");
  formData.set("child_0_firstName", "Anna");
  formData.set("child_0_lastName", "Rossi");
  formData.set("child_0_birthDate", "2015-02-03");
  formData.set("child_1_firstName", "Luca");
  formData.set("child_1_lastName", "Rossi");
  formData.set("child_1_birthDate", "2018-04-05");
  formData.set("child_2_firstName", "Sara");
  formData.set("child_2_lastName", "Rossi");
  formData.set("child_2_birthDate", "2021-06-07");

  const parsed = parseRegistrationForm(formData);

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.participatesWithChildren, true);
    assert.equal(parsed.value.children.length, 3);
    assert.deepEqual(parsed.value.children[1], {
      firstName: "Luca",
      lastName: "Rossi",
      birthDate: "2018-04-05",
    });
    assert.equal(
      buildRegistrationQuestionnaireAnswers(parsed.value).accompanyingChildren
        .count,
      3
    );
  }
});

test("parseRegistrationForm rejects incomplete or future child records", () => {
  const formData = new FormData();
  formData.set("email", "maria@example.org");
  formData.set("firstName", "Maria");
  formData.set("lastName", "Rossi");
  formData.set("birthDate", "1990-01-02");
  formData.set("birthPlace", "Italia, Roma");
  formData.set("nationality", "Italian (Italy)");
  formData.set("countryOther", "Italia");
  formData.set("cityOther", "Roma");
  formData.set("hasAccessibilityNeeds", "no");
  formData.set("hasPreviousSantegidioParticipation", "no");
  formData.append("availabilityDays", "2026-10-25");
  formData.set("privacyAccepted", "on");
  formData.set("participatesWithChildren", "yes");
  formData.set("childrenCount", "1");
  formData.set("child_0_firstName", "Anna");
  formData.set("child_0_birthDate", "2999-01-01");

  const parsed = parseRegistrationForm(formData);

  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.ok(parsed.errors.some((error) => error.includes("cognome")));
    assert.ok(parsed.errors.some((error) => error.includes("data di nascita")));
  }
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
  formData.set("hasPreviousSantegidioParticipation", "yes");
  formData.set("participatesWithGroup", "no");
  formData.set("attendanceChoice", "yes");
  formData.set("availabilityUnknown", "on");
  formData.set("privacyAccepted", "on");
  formData.set("dataProcessingAccepted", "on");
  formData.set("futureEventsCommunicationsAccepted", "on");

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
    assert.equal(answers.consents.futureEventsCommunicationsAccepted, true);
  }
});

test("parseRegistrationForm accepts structured accessibility answers", () => {
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
    assert.deepEqual(parsed.value.accessibilityAnswers, { hearing: true });
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
    assert.equal(
      withoutAccessibilityNeeds.value.futureEventsCommunicationsAccepted,
      false
    );
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
  formData.append("availabilityDays", "2026-10-25");
  formData.append("availabilityDays", "2026-10-26");
  formData.set("hasAccessibilityNeeds", "yes");
  formData.set("accessibility_walkingOrSteps", "on");
  formData.set("leaderNote", "  Arriva con il gruppo di Roma.  ");
  formData.set("consentConfirmed", "on");

  const parsed = parseManualRegistrationForm(formData);

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.email, null);
    assert.equal(parsed.value.phone, "+393331234567");
    assert.equal(parsed.value.preferredLocale, "en");
    assert.equal(parsed.value.participatesWithChildren, false);
    assert.deepEqual(parsed.value.children, []);
    assert.equal(parsed.value.availabilityUnknown, false);
    assert.deepEqual(parsed.value.availabilitySlots, [
      { day: "2026-10-25", part: "morning" },
      { day: "2026-10-25", part: "afternoon" },
      { day: "2026-10-26", part: "morning" },
      { day: "2026-10-26", part: "afternoon" },
    ]);
    assert.equal(parsed.value.hasAccessibilityNeeds, true);
    assert.deepEqual(parsed.value.accessibilityAnswers, {
      walkingOrSteps: true,
    });
    assert.equal(parsed.value.leaderNote, "Arriva con il gruppo di Roma.");
  }
});

test("parseManualRegistrationForm validates accompanying children", () => {
  const formData = new FormData();
  formData.set("groupId", "11111111-1111-4111-8111-111111111111");
  formData.set("firstName", "Paolo");
  formData.set("lastName", "Bianchi");
  formData.set("email", "paolo@example.org");
  formData.set("availabilityUnknown", "on");
  formData.set("participatesWithChildren", "yes");
  formData.set("childrenCount", "2");
  formData.set("child_0_firstName", "Anna");
  formData.set("child_0_lastName", "Bianchi");
  formData.set("child_0_birthDate", "2017-03-12");
  formData.set("child_1_firstName", "Luca");
  formData.set("child_1_lastName", "Bianchi");
  formData.set("child_1_birthDate", "2020-09-04");
  formData.set("consentConfirmed", "on");

  const parsed = parseManualRegistrationForm(formData);

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.participatesWithChildren, true);
    assert.deepEqual(parsed.value.children, [
      {
        firstName: "Anna",
        lastName: "Bianchi",
        birthDate: "2017-03-12",
      },
      {
        firstName: "Luca",
        lastName: "Bianchi",
        birthDate: "2020-09-04",
      },
    ]);
  }

  formData.set("child_1_birthDate", "");
  const incomplete = parseManualRegistrationForm(formData);

  assert.equal(incomplete.ok, false);
  if (!incomplete.ok) {
    assert.ok(
      incomplete.errors.includes(
        "Inserisci una data di nascita valida per il figlio 2."
      )
    );
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
  formData.set("participatesWithChildren", "yes");
  formData.set("childrenCount", "1");
  formData.set("child_0_firstName", "Anna");
  formData.set("child_0_lastName", "Bianchi");
  formData.set("child_0_birthDate", "2017-03-12");
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
    assert.equal(answers.accompanyingChildren.count, 1);
    assert.equal(answers.accompanyingChildren.enteredByGroupLeader, true);
    assert.deepEqual(answers.accompanyingChildren.children, [
      {
        firstName: "Anna",
        lastName: "Bianchi",
        birthDate: "2017-03-12",
      },
    ]);
    assert.equal(answers.accessibility.hasAccessibilityNeeds, true);
    assert.deepEqual(answers.accessibility.washingtonGroupAnswers, {
      walkingOrSteps: true,
    });
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
  withQrSecrets(
    {
      QR_TOKEN_ENCRYPTION_SECRET: "test-secret",
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      EMAIL_PASSWORD: undefined,
    },
    () => {
      const token = createOpaqueQrToken().token;
      const encrypted = encryptQrToken(token);

      assert.notEqual(encrypted, token);
      assert.equal(decryptQrToken(encrypted), token);
    }
  );
});

test("QR token decryption keeps service-role fallback compatibility", () => {
  withQrSecrets(
    {
      QR_TOKEN_ENCRYPTION_SECRET: undefined,
      SUPABASE_SERVICE_ROLE_KEY: "legacy-service-secret",
      EMAIL_PASSWORD: undefined,
    },
    () => {
      const token = createOpaqueQrToken().token;
      const encrypted = encryptQrToken(token);

      process.env.QR_TOKEN_ENCRYPTION_SECRET = "new-stable-secret";

      assert.equal(decryptQrToken(encrypted), token);
    }
  );
});

test("QR renderer returns an image data URL", async () => {
  const dataUrl = await renderQrDataUrl("opaque-token");

  assert.match(dataUrl, /^data:image\/png;base64,/);
});

function withQrSecrets(
  values: {
    QR_TOKEN_ENCRYPTION_SECRET: string | undefined;
    SUPABASE_SERVICE_ROLE_KEY: string | undefined;
    EMAIL_PASSWORD: string | undefined;
  },
  fn: () => void
): void {
  const previous = {
    QR_TOKEN_ENCRYPTION_SECRET: process.env.QR_TOKEN_ENCRYPTION_SECRET,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
  };

  try {
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }

    fn();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

test("magic link template escapes action URLs", () => {
  const rendered = renderMagicLinkEmail({
    actionLink: 'https://example.org/auth?x="<tag>',
  });

  assert.match(rendered.html, /&quot;&lt;tag&gt;/);
});

test("app magic links verify token hashes as email OTPs", () => {
  const link = buildAppMagicLink(
    "https://registrationspeace.santegidio.org/auth/callback?redirect_to=/dashboard/partecipante",
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
    siteLink: "https://registrationspeace.santegidio.org",
    qrCodeContentId: "registration-qr@example.org",
  });

  assert.match(rendered.text, /A7K2/);
  assert.match(rendered.html, /A7K2/);
  assert.match(rendered.text, /QR code personale/);
  assert.match(rendered.html, /cid:registration-qr@example\.org/);
});

test("group leader assignment notification points to the review dashboard", () => {
  const rendered = renderGroupLeaderAssignmentNotificationEmail({
    leaderName: "Referente",
    participantName: "Maria Rossi",
    participantCode: "A7K2",
    groupName: "Roma",
    eventTitle: "Assisi 2026",
    dashboardLink: "https://registrationspeace.santegidio.org/dashboard/capogruppo?filter=to-review",
  });

  assert.match(rendered.subject, /Nuova persona da verificare/);
  assert.match(rendered.text, /Maria Rossi \(A7K2\)/);
  assert.match(rendered.text, /filter=to-review/);
  assert.match(rendered.html, /Apri la dashboard capogruppo/);
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
  formData.set("updatesIdentity", "on");
  formData.set("firstName", "  Maria  Luisa  ");
  formData.set("lastName", "  Rossi ");
  formData.set("phone", "+39 06 000000");
  formData.append("availabilityDays", "2026-09-04");
  formData.set("moment_22222222-2222-4222-8222-222222222222", "yes");
  formData.set("hasAccessibilityNeeds", "on");
  formData.set("accessibility_walkingOrSteps", "on");

  const parsed = parseParticipantDashboardUpdate(formData);

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.updatesIdentity, true);
    assert.equal(parsed.value.firstName, "Maria Luisa");
    assert.equal(parsed.value.lastName, "Rossi");
    assert.equal(parsed.value.phone, "+3906000000");
    assert.deepEqual(parsed.value.availabilitySlots, [
      { day: "2026-09-04", part: "morning" },
      { day: "2026-09-04", part: "afternoon" },
    ]);
    assert.deepEqual(parsed.value.momentAttendanceChoices, {
      "22222222-2222-4222-8222-222222222222": "yes",
    });
    assert.deepEqual(parsed.value.accessibilityAnswers, {
      walkingOrSteps: true,
    });
    assert.equal(parsed.value.needsOperationalSupport, true);
  }
});

test("parseParticipantDashboardUpdate requires both participant names when editing identity", () => {
  const formData = new FormData();
  formData.set("registrationId", "11111111-1111-4111-8111-111111111111");
  formData.set("updatesIdentity", "on");
  formData.set("firstName", "M");
  formData.append("availabilityDays", "2026-09-04");

  const parsed = parseParticipantDashboardUpdate(formData);

  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.ok(parsed.errors.includes("Inserisci il nome."));
    assert.ok(parsed.errors.includes("Inserisci il cognome."));
  }
});

test("parseParticipantDashboardUpdate clears hidden accessibility details when support is not requested", () => {
  const formData = new FormData();
  formData.set("registrationId", "11111111-1111-4111-8111-111111111111");
  formData.append("availabilityDays", "2026-09-04");
  formData.set("accessibility_walkingOrSteps", "on");

  const parsed = parseParticipantDashboardUpdate(formData);

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.deepEqual(parsed.value.accessibilityAnswers, {});
    assert.equal(parsed.value.needsOperationalSupport, false);
  }
});

test("preserveAccessibilityUnlessEdited keeps sensitive details out of unrelated dashboard forms", () => {
  const formData = new FormData();
  formData.set("registrationId", "11111111-1111-4111-8111-111111111111");
  formData.set("phone", "+3906000000");
  formData.append("availabilityDays", "2026-09-04");

  const parsed = parseParticipantDashboardUpdate(formData);

  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    return;
  }

  const preserved = preserveAccessibilityUnlessEdited(
    parsed.value,
    {
      accessibilityAnswers: { walkingOrSteps: true },
      needsOperationalSupport: true,
    },
    false
  );

  assert.deepEqual(preserved.accessibilityAnswers, { walkingOrSteps: true });
  assert.equal(preserved.needsOperationalSupport, true);

  const edited = preserveAccessibilityUnlessEdited(
    parsed.value,
    {
      accessibilityAnswers: { walkingOrSteps: true },
      needsOperationalSupport: true,
    },
    true
  );

  assert.deepEqual(edited.accessibilityAnswers, {});
  assert.equal(edited.needsOperationalSupport, false);
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
      firstName: "Maria",
      lastName: "Rossi",
      phone: "+3906000000",
      availabilitySlots: [
        { day: "2026-09-04", part: "morning" },
        { day: "2026-09-04", part: "afternoon" },
      ],
      availabilityUnknown: false,
      momentAttendanceChoices: {
        "22222222-2222-4222-8222-222222222222": "unknown",
      },
      children: [],
      accessibilityAnswers: {},
      needsOperationalSupport: false,
    },
    {
      registrationId: "11111111-1111-4111-8111-111111111111",
      updatesIdentity: true,
      firstName: "Maria Luisa",
      lastName: "Bianchi",
      phone: "+3906000000",
      availabilitySlots: [
        { day: "2026-09-05", part: "morning" },
        { day: "2026-09-05", part: "afternoon" },
      ],
      availabilityUnknown: false,
      momentAttendanceChoices: {
        "22222222-2222-4222-8222-222222222222": "yes",
      },
      participatesWithChildren: true,
      children: [
        {
          firstName: "Anna",
          lastName: "Rossi",
          birthDate: "2015-02-03",
        },
      ],
      accessibilityAnswers: {
        walkingOrSteps: true,
      },
      needsOperationalSupport: true,
    }
  );

  assert.deepEqual(changed, [
    "first_name",
    "last_name",
    "availability_slots",
    "moment_attendance_choices",
    "accompanying_children",
    "accessibility_answers",
    "needs_operational_support",
  ]);
});

test("preserveChildrenUnlessEdited keeps children out of unrelated dashboard forms", () => {
  const formData = new FormData();
  formData.set("registrationId", "11111111-1111-4111-8111-111111111111");
  formData.append("availabilityDays", "2026-09-04");
  const parsed = parseParticipantDashboardUpdate(formData);

  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    return;
  }

  const children = [
    {
      firstName: "Anna",
      lastName: "Rossi",
      birthDate: "2015-02-03",
    },
  ];
  const preserved = preserveChildrenUnlessEdited(parsed.value, children, false);

  assert.equal(preserved.participatesWithChildren, true);
  assert.deepEqual(preserved.children, children);
  assert.deepEqual(
    preserveChildrenUnlessEdited(parsed.value, children, true).children,
    []
  );
});
