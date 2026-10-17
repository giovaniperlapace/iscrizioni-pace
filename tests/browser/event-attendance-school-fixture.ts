import type { SchoolBookingRow } from "@/lib/panels/school-bookings";
const eventId = "11111111-1111-4111-8111-111111111111";
export const school: SchoolBookingRow = {
  id: "school", eventId, schoolName: "Scuola di prova", schoolCity: "Roma", classDescription: "3A",
  studentCount: 20, companionCount: 3, status: "confirmed", privacyVersion: "v1", privacyAcceptedAt: "2026-09-30T10:00:00Z",
  submittedAt: "2026-09-30T10:00:00Z", updatedAt: "2026-09-30T10:00:00Z", internalNotes: null, reservations: [], hasActiveQr: true,
  teacher: { id: "teacher", firstName: "Docente", lastName: "Prova", email: "teacher@example.invalid", phone: "123" },
};
