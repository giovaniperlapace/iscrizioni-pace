# Ordinamento numerico Forum — 20 ottobre 2026

Un comparatore condiviso in `lib/panels/forum-order.ts` ordina per il numero
iniziale del Forum, indipendentemente dall'orario. Supporta i prefissi Forum,
Panel, Foro e Форум, numeri senza prefisso e notazione n.; titoli non numerati
seguono quelli numerati in ordine naturale. A parità di titolo viene conservato
l'ordine delle quote; gli array ricevuti dai componenti non vengono modificati.

Superfici aggiornate: catalogo pubblico e anteprima, scuole pubbliche, docente,
prenotazioni scuole Admin/Manager e relativo filtro, partecipante (anche dopo
refresh disponibilità), capogruppo, gestione/pubblicazione Forum, statistiche
ed export basati sullo stesso snapshot, Forum delle sedi, selettore destinatari
email, assegnazione incarichi e lista incarichi dell'Accoglienza.
Restano i raggruppamenti esistenti per giorno/sessione e prenotati/disponibili.
La cronologia del programma generale e gli orari non cambiano.

Verifiche: 990 test applicativi, TypeScript, lint, build production isolata.
Test dedicati: 1/2/9/10, differenze d'orario, prefissi, titoli senza numero,
stabilità quote, input non mutato, loader scuole con residui invariati e gruppi
giornalieri. Browser sui componenti originali partecipante/capogruppo/pubblico
con input disordinato: 1,2,9,10 a 1440 e 390 pixel, nessun errore JS.
Browser scuole originale con PostgreSQL temporaneo: ordine 1,2,6 anziché
cronologico 1,6,2; iscrizione, modifica, annullamento e concorrenza superati.
Nessuna migration, scrittura operativa remota o email reale.
