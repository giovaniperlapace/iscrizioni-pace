/** Only a recorded manual choice counts; a missing email alone is not delegation. */
export function hasRecordedEmailDelegation(choice: {
  source: unknown;
  use_leader_email: unknown;
  has_email: unknown;
}): boolean {
  return (choice.source === "capogruppo_manual" && choice.use_leader_email === true) ||
    ((choice.source === "manager_manual" || choice.source === "admin_manual") &&
      choice.has_email === false && choice.use_leader_email === false);
}
