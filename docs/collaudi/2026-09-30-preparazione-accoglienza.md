# Preparazione collaudo accoglienza — 30 settembre 2026

Predisposizione autorizzata ed eseguita esclusivamente sullo staging, evento
`assisi-2026-test`. Non attesta prove hardware T01–T18 eseguite.

## Accessi

- Primo telefono: **accoglienza.staging@example.invalid** — solo Accoglienza evento.
- Secondo telefono: **accoglienza2.staging@example.invalid** — solo Accoglienza evento.
- Referente T18: **admin.accoglienza.staging@example.invalid** — Admin globale staging.

Email in modalità `log`: nessuna consegna in casella. Il normale ingresso
registra il Magic Link nei log applicativi `[email:log]`. Per il collaudo è
stato generato direttamente tramite Auth un link temporaneo monouso, senza SMTP,
con callback sulla preview panel. Il QR di accesso va inquadrato con la
fotocamera normale del telefono e aperto in Safari/Chrome, non nello scanner
accoglienza. Dopo l'accesso aprire `/dashboard/accoglienza`.

Rigenerazione locale, se scaduto o già usato:

```sh
node scripts/reception-staging-access.mjs
node scripts/reception-staging-access.mjs accoglienza2.staging@example.invalid
node scripts/reception-staging-access.mjs admin.accoglienza.staging@example.invalid
```

File privati in `.env.collaudo-accoglienza/` (esclusa da Git):
`accesso-accoglienza.staging.html`, `accesso-accoglienza2.staging.html`,
`accesso-admin.accoglienza.staging.html`. Non versionare token o link.

## Campioni

| Caso | Dati fittizi | Codice | Stato iniziale verificato |
| --- | --- | --- | --- |
| A | Alba Test Accoglienza | P0LE | Nessun ingresso |
| B | Bruno Test Accoglienza | LPO2 | Nessun ingresso |
| F | Francesca, Luca e Sofia Test Accoglienza | E5FH | Nessun ingresso; due minori |
| S | Scuola Test Accoglienza, Classe S collaudo | QR scuola | 10 studenti + 2 accompagnatori prenotati; nessun ingresso |
| X | Xavier Test Accoglienza | P6BZ | QR revocato, nessun ingresso |

`campioni.html` nella cartella privata contiene i cinque QR visualizzabili e
stampabili, i codici e il contenuto QR scuola per la correzione manuale.
I PNG A/B/F/S/X sono QR semplici di prova: non attestano il download nominativo
applicativo P14/P15. Non confondere il codice pubblico X con il QR revocato:
il test di invalidità usa il QR, mentre il fallback per codice resta autorizzato.

Preparazione ripetibile: `node scripts/prepare-reception-staging.mjs`.
Conservare `campioni.json`: identifica il lotto e conserva i token locali.
Lo script non azzera presenze, non elimina minori e non rinnova QR esistenti.
La preparazione ripristina gli incarichi mancanti dei tre account: non eseguirla
nel mezzo della prova di revoca T18. Non cancellare la cartella per azzerare i test.

Verifiche eseguite: evento corrente corretto; ruoli dei tre account riletti;
RPC di sola verifica sui cinque token (quattro validi, uno invalid);
zero righe check-in per il lotto; due minori solo in F. Nessuna migration,
modifica production, email SMTP o deployment. Restano login sul telefono e
prove fisiche; seguire `docs/guida-collaudo-telefono-qr.md`.
