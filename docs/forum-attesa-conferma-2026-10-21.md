# Lista d’attesa: conferma bloccata da un altro Forum — 21 ottobre 2026

## Riscontro

Segnalazione di Pietro Menghi verificata con query production in transazione
READ ONLY, senza modificare prenotazioni, coda, presenze o notifiche.
L’offerta per Forum 12 è stata inviata alle 15:04:28 Europe/Rome, con termine
16:04:28. Al controllo risultava scaduta, senza accettazione. Il partecipante
aveva prenotato Forum 11 nello stesso pomeriggio; il catalogo canonico espone
`has_slot_conflict=true` per Forum 12. Non sono state eseguite azioni usando
la sessione dell’utente né inviate email.

## Causa e correzione

`PanelBookingCard` disabilitava il pulsante per qualsiasi conflitto di fascia,
anche con stato `offered`. Il server supporta già l’accettazione atomica con
sostituzione della precedente prenotazione. Il blocco impediva quindi di
raggiungere la RPC. La stessa condizione impediva anche di lasciare la coda.

Il controllo ora si applica soltanto a nuove scelte, conservando il blocco
per le normali prenotazioni incompatibili. Offerte, uscita dalla coda e
annullamenti restano azionabili; autorizzazioni, scadenze, selezione minori,
capienze e sostituzione sono ancora verificate dal server. Nessuna migration.
La correzione non ripristina offerte scadute né recupera posti già riassegnati.

## Verifiche

- Test sul componente originale trasposto in JSX sintetico: offerta con
  conflitto accettabile, uscita dalla coda consentita, annullamento consentito,
  nuova prenotazione in conflitto bloccata, ingresso in coda consentito.
- Suite completa: 1.014 test superati.
- Build production completata. Il primo typecheck parallelo alla build ha
  incontrato file generati `.next/types` rimossi dalla build; rieseguito dopo.
- Nessuna prova autenticata operativa in production, nessuna scrittura remota.
- TypeScript e lint dei file modificati superati; lint generale ha rilevato
  soltanto due annotazioni del nuovo test, corrette e riverificate.
