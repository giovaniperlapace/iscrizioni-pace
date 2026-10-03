# Scheda personale e annullamento dell’iscrizione

La scheda personale usa le icone Lucide condivise, sezioni espandibili con etichette
esplicite, pulsanti con area di clic adeguata e un dialog nativo con focus confinato,
chiusura da tastiera e scorrimento mobile. I campi e il flusso di salvataggio esistenti
restano gli stessi.

Il riepilogo usa icone Lucide, riquadri arrotondati e spaziature coerenti con la
scheda di modifica. Il comando **Annulla la mia iscrizione** si trova in basso a
destra nel riepilogo, fuori dalla modale di modifica, e apre una conferma distinta.
Il focus iniziale è su **Mantieni la mia iscrizione**; Esc chiude la conferma e
restituisce il focus al comando. La conferma spiega QR, figli collegati, storico
e nuova iscrizione con la stessa email, durante l’apertura delle iscrizioni.
Non mostra informazioni sulla conservazione di account e incarichi. Tutti i testi sono disponibili nelle sette lingue. Durante l’invio
sono impedite conferme multiple. Un errore lascia la conferma aperta; il successo
mostra l’esito e il normale accesso a una nuova iscrizione.

## Autorizzazione e transazione

`cancelOwnRegistration` verifica UUID e conferma esplicita, ricava l’attore da
`auth.getUser()` e chiama la RPC `cancel_own_registration`, solo service_role.
La RPC verifica nel database il proprietario effettivo e l’evento corrente, con lock
su iscrizione, identità ed evento prima delle scritture. I ruoli operativi non
consentono di annullare iscrizioni altrui tramite questo percorso. L’annullamento è
disponibile anche oltre il termine delle modifiche. Il reinvio dopo un successo è
idempotente solo per il medesimo attore con audit di annullamento personale.

La transazione applica il soft delete esistente, revoca i QR e disattiva i destinatari
in coda associati a quella specifica iscrizione. Conserva gli esiti già inviati/incerti,
le comunicazioni delegate per altre persone, i ruoli e l’account Auth. Registra
`registration.self_cancelled` e scollega l’identità Auth se non restano altre
iscrizioni non eliminate per quel partecipante, come nel ciclo vita già pubblicato.
Figli, presenze, collegamenti e altri dati storici rimangono conservati, esclusi dalle
letture operative tramite le RLS preesistenti. Un errore nell’audit annulla tutto.
Nessuna modifica alla RPC di eliminazione/ripristino Admin/Manager, ai grant esistenti
o alle RLS. Il riutilizzo email impiega le regole già pubblicate del 22 settembre.

## Verifica e rilascio

- `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
- `tests/self-registration-cancellation.test.mts`: azione reale con builder Supabase,
  attore di sessione, conferma/UUID, errori e lingue.
- `psql -v ON_ERROR_STOP=1 -f tests/sql/self-registration-cancellation.sql` su database
  PostgreSQL temporaneo **vuoto**, mai in produzione. Copre ruoli, evento, idempotenza,
  audit atomico, QR/check-in, storico, coda, riuso account/email, altra iscrizione attiva
  e privilegi/RLS, oltre alla fixture operativa precedente.
- `BASE_URL=http://localhost:3012 node tests/browser/self-registration.mjs`, con dev
  server locale. Monta temporaneamente la pagina reale con dati, sessione e azioni
  sintetici, controlla sette lingue, desktop/mobile, focus/Esc, errore e successo.
  Eseguire separatamente da lint/typecheck/build; la route viene rimossa al termine.

Migration `20260922210000_self_registration_cancellation.sql` applicata e registrata
atomicamente in produzione il 22 settembre 2026, prima del push autorizzato su main.
Impronte delle 15 tabelle operative invariate, policy RLS e RPC operativa invariate;
nuova funzione solo service_role. Backup schema riservato sul server in
`/root/pace-release-20260922-self-cancellation/`. Nessuna cancellazione di persone
reali né email di collaudo.

Verifica completata: 447 test, lint, typecheck e build production superati. Fixture
SQL superata su PostgreSQL 17 temporaneo; pagina reale con dati sintetici verificata
nel browser nelle sette lingue, desktop/mobile, inclusi errore, successo e focus.
