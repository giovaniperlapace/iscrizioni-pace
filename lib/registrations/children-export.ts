import type { SupportedLocale } from "../i18n/config.ts";

export const CHILDREN_EXPORT_COPY: Record<SupportedLocale, { headers: [string, string]; help: string; accessibility: string }> = {
  it: { headers: ["Numero dei figli accompagnati", "Nomi e cognomi dei minori accompagnati"], help: "Include sempre il numero e i nomi dei minori accompagnati.", accessibility: "Informazioni sulla disabilità" },
  en: { headers: ["Number of accompanying children", "First and last names of accompanying minors"], help: "Always includes the number and names of accompanying minors.", accessibility: "Disability information" },
  fr: { headers: ["Nombre d’enfants accompagnés", "Prénoms et noms des mineurs accompagnés"], help: "Inclut toujours le nombre et les noms des mineurs accompagnés.", accessibility: "Informations sur le handicap" },
  de: { headers: ["Anzahl der begleiteten Kinder", "Vor- und Nachnamen der begleiteten Minderjährigen"], help: "Enthält immer die Anzahl und die Namen der begleiteten Minderjährigen.", accessibility: "Angaben zu Behinderungen" },
  es: { headers: ["Número de hijos acompañados", "Nombres y apellidos de los menores acompañados"], help: "Incluye siempre el número y los nombres de los menores acompañados.", accessibility: "Información sobre discapacidad" },
  nl: { headers: ["Aantal begeleide kinderen", "Voor- en achternamen van begeleide minderjarigen"], help: "Bevat altijd het aantal en de namen van begeleide minderjarigen.", accessibility: "Informatie over beperkingen" },
  uk: { headers: ["Кількість супроводжуваних дітей", "Імена та прізвища супроводжуваних неповнолітніх"], help: "Завжди містить кількість та імена супроводжуваних неповнолітніх.", accessibility: "Інформація про інвалідність" },
};

export function childrenExportValues(children: { id: string; position: number; firstName: string; lastName: string }[]): [string, string] {
  return [String(children.length), [...children]
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map(child => `${child.firstName} ${child.lastName}`.trim()).join("; ")];
}
