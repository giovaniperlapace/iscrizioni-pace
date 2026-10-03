# Nuovo Magic Link respinto per inattività

## Diagnosi

Il callback autenticava correttamente con `verifyOtp` o
`exchangeCodeForSession`, ma non aggiornava `iscrizioni_last_activity`.
Il cookie applicativo dura 30 giorni; il proxy respinge una sessione
autenticata se il suo timestamp indica almeno 24 ore di inattività.

Un browser può quindi arrivare alla login senza una sessione Auth valida,
ma con un timestamp applicativo ancora presente. La login in questo caso
non lo cancella. Dopo la verifica del nuovo Magic Link il primo accesso alla
dashboard usa il vecchio timestamp: il proxy disconnette la sessione appena
creata e reindirizza a `/login?error=inactive`. Questa disconnessione cancella
anche il timestamp, spiegando perché il tentativo successivo può riuscire.

Difetto riprodotto sul codice aggiornato a `ab836d8` dopo fetch e pull
fast-forward da `bf9a6f9`. Il nuovo test falliva prima della correzione.
Non sono stati ispezionati cookie o log privati dell'utente: il meccanismo
è riprodotto, non è una ricostruzione di ogni singolo tentativo segnalato.

## Correzione

La risposta 303 del callback completato scrive un nuovo timestamp prima che
il browser segua il redirect. Il flag `freshlyAuthenticated` viene impostato
soltanto dopo una verifica OTP/PKCE riuscita. Il fallback già esistente che
riusa una sessione valida dopo un errore del link non rinnova il timestamp.
Anche tipi OTP non riconosciuti e le richieste GET/HEAD non lo rinnovano.

Le opzioni del cookie restano coerenti con proxy e API di attività:
HttpOnly, SameSite=Lax, Secure in produzione, path `/`, maxAge 30 giorni.
La regola delle 24 ore di inattività, la verifica Auth, la conferma esplicita
contro gli scanner email, i ruoli e i testi restano invariati. Nessuna
migration, modifica al database o variazione del provider email.

Riferimento framework: [cookie nelle risposte dei Route Handler](https://nextjs.org/docs/app/api-reference/functions/cookies).

## Verifiche

- `tests/magic-link-session-renewal.test.mts`: callback, proxy e API attività
  effettivi con richieste/risposte Next e provider Auth sintetico. 54
  combinazioni di sei ruoli, cookie vecchio di 48 ore/non valido/assente,
  token hash, token storico e PKCE. Un'unica verifica, nessuna disconnessione,
  redirect autorizzato e attività 204. Controlli negativi su scanner, link
  falliti, tipo sconosciuto e scadenza ordinaria delle sessioni.
- 524 test superati, lint, TypeScript e build production in copia temporanea
  con `npm ci` dal lockfile; nessun file `.env` di produzione copiato.
- Prova HTTP della build production tramite `next start`, con Supabase SSR
  reale e server Auth/REST sintetico su loopback: cookie vecchio/non valido,
  GET/HEAD senza consumo, un solo POST OTP riuscito, cookie Auth e attività
  presenti insieme nella risposta, ping immediato 204 e `/dashboard` verso
  la dashboard partecipante senza logout. Link scaduto ancora respinto.
  La prova verifica il passaggio di autenticazione e il proxy; non carica
  i dati della dashboard né esercita un provider reale.
- Nessun invio email, uso di token reali o modifica a persone e account reali.

## Stato

Commit/push su `main` e pubblicazione Vercel autorizzati esplicitamente
dall'utente il 24 settembre. Il rilascio segue l'integrazione Git del progetto;
verificare stato READY, commit e alias pubblico prima di considerarlo concluso.
