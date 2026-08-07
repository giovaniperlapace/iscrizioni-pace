import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { renderSchoolBookingConfirmationEmail } from "../lib/email/templates.ts";
import { parsePublicSchoolBookingForm } from "../lib/panels/public-school-bookings.ts";

const migration = await readFile(join(process.cwd(), "supabase/migrations/20260806190000_public_school_booking_flow.sql"), "utf8");
const publicPage = await readFile(join(process.cwd(), "app/scuole/page.tsx"), "utf8");
const teacherPage = await readFile(join(process.cwd(), "app/dashboard/docente/page.tsx"), "utf8");
const publicOptions = await readFile(join(process.cwd(), "lib/panels/public-school-bookings.ts"), "utf8");

test("P8 public RPC reserves only published school sections in one transaction", () => {
  assert.match(migration, /create or replace function public\.create_public_school_booking/);
  assert.match(migration, /audience\.booking_channel = 'school_booking'/);
  assert.match(migration, /panel\.publication_status = 'published'/);
  assert.match(migration, /for update/);
  assert.match(migration, /app\.validate_panel_section_booking_capacity/);
  assert.match(migration, /to service_role/);
  assert.match(
    migration,
    /revoke all on function public\.create_public_school_booking\([\s\S]*?\) from public, anon, authenticated;/
  );
  assert.doesNotMatch(migration, /insert into public\.(participants|registrations)/);
});

test("P8 exposes public school options without leaking reserved capacities", () => {
  assert.match(migration, /create or replace function public\.get_public_school_booking_options/);
  assert.match(migration, /grant execute on function public\.get_public_school_booking_options\(\) to anon, authenticated/);
  assert.match(migration, /revoke select on public\.panel_seat_sections from anon/);
  assert.match(migration, /create policy "panel seat sections operational read"/);
  assert.doesNotMatch(
    migration,
    /returns table \([\s\S]*section_id uuid,[\s\S]*capacity (integer|bigint)/
  );
  assert.match(publicOptions, /supabase\.rpc\("get_public_school_booking_options"\)/);
  assert.doesNotMatch(publicOptions, /from\("panel_seat_sections"\)/);
});

test("P8 parser requires consent and explicit panel choices", () => {
  const form = validForm();
  const parsed = parsePublicSchoolBookingForm(form);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.teacherEmail, "teacher@example.org");
    assert.equal(parsed.value.reservations.length, 1);
  }
  form.delete("privacyAccepted");
  assert.equal(parsePublicSchoolBookingForm(form).ok, false);
});

test("P8 exposes public and teacher self-service surfaces", () => {
  assert.match(publicPage, /submitPublicSchoolBooking/);
  assert.match(publicPage, /privacyAccepted/);
  assert.match(teacherPage, /updateTeacherSchoolBooking/);
  assert.match(teacherPage, /cancelTeacherSchoolBooking/);
  assert.match(teacherPage, /download=/);
});

test("P8 confirmation email contains magic-link access and QR context", () => {
  const email = renderSchoolBookingConfirmationEmail({ teacherFirstName: "Ada", eventTitle: "Evento", schoolName: "Scuola", classDescription: "3A", studentCount: 20, companionCount: 2, panelLines: ["Panel uno"], accessLink: "https://example.org/access", qrCodeContentId: "qr@example.org" });
  assert.match(email.text, /https:\/\/example\.org\/access/);
  assert.match(email.text, /20 studenti, 2 accompagnatori/);
  assert.match(email.html, /cid:qr@example\.org/);
});

function validForm() {
  const form = new FormData();
  form.set("teacherEmail", " Teacher@example.org ");
  form.set("teacherFirstName", "Ada"); form.set("teacherLastName", "Rossi");
  form.set("teacherPhone", "+3906000000"); form.set("schoolName", "Scuola Test");
  form.set("schoolCity", "Roma"); form.set("classDescription", "3A");
  form.set("studentCount", "20"); form.set("companionCount", "2");
  form.set("sectionIds", "11111111-1111-4111-8111-111111111111");
  form.set("panelId:11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222");
  form.set("students:11111111-1111-4111-8111-111111111111", "20");
  form.set("companions:11111111-1111-4111-8111-111111111111", "2");
  form.set("privacyAccepted", "yes");
  return form;
}
