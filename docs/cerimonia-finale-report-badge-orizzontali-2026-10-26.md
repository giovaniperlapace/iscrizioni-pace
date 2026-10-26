# Report capogruppo con badge orizzontali - 26 ottobre 2026

**In produzione**: commit `8a2ee7f`, deployment
`dpl_8Fu19nLrNPCQ2JGGXwYfVWwU8zZG` READY sul dominio canonico.
Migration applicata e registrata, invii ancora disattivati e istruzioni vuote.
Nessun nuovo invio reale.

## Comportamento

Il report resta cumulativo. Un PDF allegato per ciascun settore con persone
che hanno delegato esplicitamente le comunicazioni al capogruppo destinatario;
nessun allegato per i settori senza delegati. I PDF includono tutte le nomine
attive pertinenti, anche su più pagine, e i minori espressamente assegnati.
Il normale riepilogo delle quantità da distribuire resta senza badge nominativi.

- A4 orizzontale, sette strisce per pagina, circa 277 x 22 mm ciascuna.
- Nome/cognome, gruppo, colore e nome completo del settore, data della cerimonia.
- Spazio di chiusura e contorni tratteggiati. Su successiva richiesta, **nessuna
  istruzione di stampa o ritaglio**, né etichette di chiusura, in PDF o email.
- Disegno vettoriale e font locale incorporato; nessuna immagine remota o nuovo QR.
- Il badge personale originale PDF/JPEG, il sito e lo scanner restano invariati.
- Per chi non ha email ma neppure delega esplicita, resta il report di contatto;
  queste persone non entrano nei nuovi PDF delle deleghe.

## Destinatario e riservatezza

Migration `20261026170000_closing_leader_badge_strips.sql`: la delega registrata
nel questionario prevale su chi assegna il settore. Origine capogruppo, attore
registrato dal server e identificativo del delegato devono coincidere. La
responsabilità deve essere ancora valida nei gruppi attuali dell'evento.
Delega esplicita scaduta, alterata o non più autorizzata: nessun inoltro a un altro
capogruppo. L'assenza di un destinatario utilizzabile resta un errore esplicito.

Il claim ricontrolla email personale, gruppi, nomine, revoche e minori. La propria
email ha precedenza. Un indicatore server `communicationDelegated` autorizza
l'inclusione nel PDF; nessun dato fornito dal browser determina il destinatario.
Anche le nomine dirette Manager, prive di gruppo sull'assegnazione, usano il
gruppo corrente autorizzato. Coalescenza della coda, ricevute, stati e blocco
invii restano attivi; niente reinvio automatico di fallimenti/incerti.

## Verifiche

- 1.205 test applicativi, TypeScript e lint mirato passati nella working copy.
- SQL su PostgreSQL temporaneo: delegato diverso dall'assegnatore, due delegati
  nello stesso gruppo, ruolo revocato, cambio gruppo, metadati delega non validi,
  email aggiunta dopo la nomina, minore revocato, nomina diretta Manager,
  coalescenza, capacità e concorrenze preesistenti.
- PDF: test 7/8 badge, settori vuoti esclusi, identità mancanti/duplicate rifiutate,
  1.005 persone in tre allegati, sotto i limiti 6 MiB e 9 MB del trasporto.
- Tre anteprime sintetiche di dieci persone ciascuna: due pagine, nomi completi
  presenti esattamente una volta, accenti e cirillico, nessun testo fuori pagina,
  nessuna istruzione di ritaglio; rendering PNG ispezionato.
- Token ufficiale `POSTMARK_API_TEST`: messaggi personali, famiglia, riepilogo,
  report senza deleghe e report con 1.005 delegati/tre PDF accettati (ErrorCode 0),
  senza consegna reale. Formato allegati: nome, MIME `application/pdf`, Base64;
  metadata `ceremony_email_id` conservato entro il limite Postmark.

Riferimento ufficiale:
[Postmark - allegati e test senza consegna](https://postmarkapp.com/developer/user-guide/send-email-with-api/send-a-single-email).

## Rilascio

Estensione del rilascio della cerimonia finale già autorizzato. Backup completo
prima di commit/push e migration; aggiornamento di sole funzioni, senza modifiche
alle assegnazioni, alla coda o alle impostazioni di invio. Le email devono restare
**disattivate** e le istruzioni vuote fino ai testi definitivi dell'utente.
I promemoria Forum locali restano esclusi.

Backup verificato con elenco e decodifica integrale `pg_restore`, permessi 600,
32.025.332 byte, conservato sul server:

`/root/backups/iscrizioni-pace/production-before-closing-strips-1793043601867.dump`

SHA-256: `d70b59c582964a87992c7f352e22a38bdd492837d114713cfb016ab70bdd0ebc`.

Rilascio verificato: **75 tabelle e 313.224 righe** conservate integralmente;
metadati/ACL delle **254 funzioni preesistenti** conservati, salvo i due corpi
previsti. Due nuove funzioni service-only. Primo tentativo annullato prima del
commit per confronto troppo restrittivo dell’offset interno del parametro
predefinito; confronto corretto con `pg_get_expr`, valore e privilegi identici,
regressione ripetuta e transazione successiva completata. Nessuna modifica
parziale rimasta dal tentativo annullato.

Rilettura indipendente: revisione 29, tre settori/3.500 posti, zero nomine,
assegnazioni o bozze; quattro notifiche storiche ancora accepted.
Copia pulita dei soli file del rilascio da npm ci: **1.191 test**, TypeScript
e build production passati; font locale presente nel bundle del cron.
