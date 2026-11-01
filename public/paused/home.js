// Browser-only language selection. No analytics, API calls, auth, timers or polling.
const copy = {
 it: ["Ci vediamo a Genova - Settembre 2027", "Grazie a tutte le persone che hanno condiviso l’incontro di Assisi 2026.", "Lo spirito di Assisi non si ferma:", "Le iscrizioni sono in pausa."],
 en: ["See you in Genoa - September 2027", "Thank you to everyone who shared the Assisi 2026 meeting.", "The spirit of Assisi continues:", "Registration is paused."],
 fr: ["Rendez-vous à Gênes - Septembre 2027", "Merci à toutes les personnes qui ont partagé la rencontre d’Assise 2026.", "L’esprit d’Assise ne s’arrête pas :", "Les inscriptions sont en pause."],
 de: ["Wir sehen uns in Genua - September 2027", "Danke an alle, die am Treffen in Assisi 2026 teilgenommen haben.", "Der Geist von Assisi lebt weiter:", "Die Anmeldung ist pausiert."],
 es: ["Nos vemos en Génova - Septiembre de 2027", "Gracias a todas las personas que compartieron el encuentro de Asís 2026.", "El espíritu de Asís no se detiene:", "Las inscripciones están en pausa."],
 nl: ["Tot ziens in Genua - September 2027", "Dank aan iedereen die deelnam aan de bijeenkomst in Assisi 2026.", "De geest van Assisi leeft voort:", "De inschrijving is gepauzeerd."],
 uk: ["До зустрічі в Генуї - Вересень 2027", "Дякуємо всім, хто долучився до зустрічі в Ассізі 2026 року.", "Дух Ассізі не зупиняється:", "Реєстрацію призупинено."],
};
const keys = ["title", "thanks", "lead", "notice"];
const selector = document.getElementById("language");
function show(locale) {
 if (!copy[locale]) locale = "en";
 document.documentElement.lang = locale;
 selector.value = locale;
 keys.forEach((key, i) => { const node = document.querySelector(`[data-copy="${key}"]`); node.textContent = copy[locale][i]; if (key === "title") node.style.whiteSpace = "pre-line"; });
}
let saved;
try { saved = localStorage.getItem("peace-home-language"); } catch {}
show(saved || (navigator.language || "en").split("-")[0]);
selector.addEventListener("change", () => { show(selector.value); try { localStorage.setItem("peace-home-language", selector.value); } catch {} });
