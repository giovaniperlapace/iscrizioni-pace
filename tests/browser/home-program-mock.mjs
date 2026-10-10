import { createServer } from "node:http";
const eventId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let role = "admin", mode = "internal", changed = false;
const extraPanels = [
  { id: "99999999-9999-4999-8999-999999999999", title: "Forum 9 – Test alle 17", starts_at: "2026-10-26T16:00:00Z", ends_at: "2026-10-26T17:00:00Z" },
  { id: "11111111-1111-4111-8111-111111111111", title: "Forum 11 – Test pomeriggio", starts_at: "2026-10-26T15:00:00Z", ends_at: "2026-10-26T17:00:00Z" },
  { id: "10101010-1010-4010-8010-101010101010", title: "Forum 10 – Test completo", starts_at: "2026-10-26T15:00:00Z", ends_at: "2026-10-26T17:00:00Z", full: true },
];
const requests = [];
createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  res.setHeader("Content-Type", "application/json");
  if (url.pathname === "/control") {
    role = url.searchParams.get("role") ?? role;
    mode = url.searchParams.get("mode") ?? mode;
    changed = url.searchParams.get("changed") === "true";
    res.end(JSON.stringify({ role, mode, changed })); return;
  }
  if (url.pathname === "/requests") { res.end(JSON.stringify(requests)); return; }
  requests.push({ method: req.method, path: url.pathname });
  const send = data => res.end(JSON.stringify(data));
  if (url.pathname === "/auth/v1/user") return send({ id: userId, email: "synthetic@example.invalid", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} });
  const path = url.pathname.replace("/rest/v1/", "");
  if (path === "rpc/get_panel_release_mode") return send(mode);
  if (path === "event_user_roles") return send([{ role: role === "foreign" ? "manager" : role, event_id: role === "admin" ? null : role === "foreign" ? "other-event" : eventId }]);
  if (path === "group_memberships") return send([]);
  if (path === "events") return send({ id: eventId });
  if (path === "event_moments") return send([{ id: "panel", event_id: eventId, title: changed ? "Titolo modificato" : "Panel sintetico in bozza", description: "Descrizione di collaudo", starts_at: changed ? "2026-10-27T09:00:00Z" : "2026-10-26T08:30:00Z", ends_at: changed ? "2026-10-27T11:30:00Z" : "2026-10-26T11:30:00Z", location_id: "room", publication_status: "draft" }, ...extraPanels.map(panel => ({ ...panel, event_id: eventId, location_id: "room", publication_status: "published", description: "Forum di prova" }))]);
  if (path === "panel_seat_sections") return send([{ id: "section", panel_id: "panel", audience_type_id: "individual", capacity: changed ? 20 : 70 }, ...extraPanels.map(panel => ({ id: `section-${panel.id}`, panel_id: panel.id, audience_type_id: "individual", capacity: panel.full ? 20 : 70 }))]);
  if (path === "panel_audience_types") return send([{ id: "individual", name: "Iscritti", code: "individual", booking_channel: "individual", is_active: true, sort_order: 1 }]);
  if (path === "event_locations") return send([{ id: "room", event_id: eventId, name: changed ? "Nuova location" : "Sala sintetica", address: "Indirizzo sintetico", max_capacity: 200, is_active: true }]);
  if (path === "moment_attendance_choices") return send([]);
  if (path === "rpc/get_panel_seat_availability") return send([{ section_id: "section", occupied: 20 }, ...extraPanels.map(panel => ({ section_id: `section-${panel.id}`, occupied: 20 }))]);
  if (path === "rpc/get_public_panel_program") return send([{ panel_id: "published", title: "Panel pubblico sintetico", description: null, starts_at: "2026-10-26T08:30:00Z", ends_at: "2026-10-26T10:30:00Z", location_name: "Sala pubblica", location_address: null, availability: "available" }, ...extraPanels.map(panel => ({ panel_id: panel.id, title: panel.title, description: "Forum di prova", starts_at: panel.starts_at, ends_at: panel.ends_at, location_name: "Sala pubblica", location_address: null, availability: panel.full ? "full" : "available" }))]);
  res.statusCode = 500; send({ code: "UNEXPECTED", message: `Unexpected synthetic request ${url.pathname}` });
}).listen(55441, "127.0.0.1", () => console.log("Synthetic home programme database ready"));
