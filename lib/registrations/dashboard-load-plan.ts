/** Data required by the existing sections; never cache authorization or user data. */
export function dashboardLoadPlan(section: string) {
  const participants = section === "iscritti" || section === "gruppi";
  const roles = section === "ruoli" || section === "gruppi";
  return {
    operations: participants || roles || section === "impostazioni",
    participants,
    groups: section === "iscritti",
    groupTree: roles,
    groupLinks: section === "gruppi",
    tags: participants,
    services: participants || section === "impostazioni",
    roles,
  };
}
