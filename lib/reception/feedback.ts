export const RECEPTION_TONES = {
  yellow: "bg-yellow-100 text-yellow-950 border-yellow-500",
  orange: "bg-orange-100 text-orange-950 border-orange-500",
  red: "bg-red-100 text-red-950 border-red-500",
  green: "bg-green-100 text-green-950 border-green-500",
  progress: "bg-sky-100 text-sky-950 border-sky-500",
};
export function receptionFeedbackTone({problem, wrongForum, missingTicket, missingEventEntry}: {
  problem?: string; wrongForum?: boolean; missingTicket?: boolean; missingEventEntry?: boolean;
}): keyof typeof RECEPTION_TONES {
  if (problem === "invalid") return "red";
  if (problem === "not_booked") return wrongForum ? "yellow" : "orange";
  if (missingTicket) return "orange";
  if (problem === "event_entry_required" || missingEventEntry) return "yellow";
  if (problem) return "red";
  return "green";
}
