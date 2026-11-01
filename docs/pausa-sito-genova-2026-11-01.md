# Pausa del sito dopo Assisi 2026 — 1 novembre 2026

## Richiesta e contenuti

Home leggera coerente con la grafica della preghiera per la pace: logo, titoli
bilingui, palette blu/ciano, gradiente e PeaceLineMark già usati dal sito.
Conservato il riferimento ad Assisi 2026. L’utente ha confermato **Genova,
settembre 2027**, senza giorni ancora certi: nessuna data giornaliera inventata.
Sette lingue, selezione locale nel browser senza chiamate al server.
Su correzione dell’utente, nessun link all’accesso riservato nella pagina pubblica.
Ulteriore revisione: avviso «Le iscrizioni sono in pausa» sotto al ringraziamento;
riquadro bianco senza «Il prossimo incontro», con «Lo spirito di Assisi non si
ferma: Ci vediamo a Genova - Settembre 2027», tradotto nelle sette lingue.
Le foto non sono ancora disponibili: nessuna foto sostitutiva inventata. Uno
slideshow futuro potrà usare immagini statiche ottimizzate e transizioni locali,
con pausa e rispetto delle preferenze di movimento, senza interrogazioni periodiche.

## Stato operativo effettivo

Il timer reale è esterno a Vercel, sul server documentato in `docs/postmark.md`.
Prima: `pace-email-campaigns.timer` active/enabled; servizio inactive/dead.
Eseguito `systemctl disable --now pace-email-campaigns.timer` con la chiave SSH
locale già autorizzata. Rilettura: timer **inactive/disabled**, servizio
**inactive/dead**. Nessun worker interrotto, nessuna configurazione segreta stampata.
Nessuna modifica a database, code, consegne, dati, ruoli, iscrizioni o nomine.
Il timer non riparte al riavvio del server.

**Commit e push su main autorizzati dall’utente il 1 novembre.** Configurazione
Production preparata con pausa attiva e link riservato server-only. Il rilascio
avviene dal commit Git; stato READY e SHA devono essere verificati prima di
dichiarare operative la nuova home e le restrizioni.
Lavoro preesistente su bozze finale e relativi SQL conservato separatamente.
Fetch iniziale: main e origin/main allineati; nessun pull necessario né forzato
sul checkout contenente i documenti preesistenti.

## Architettura e attività sospese

`NEXT_PUBLIC_SITE_PAUSED` diversa da `false` attiva la pausa. È un interruttore
non segreto, condiviso da browser e server, da cambiare con nuovo build.

- Rewrite di `/` verso `public/paused/index.html`, con CSS e JS statici; home,
  logo e risorse escluse dal matcher del proxy. Nessuna sessione, layout React,
  ottimizzazione immagini a richiesta o lettura database per la home.
- Rewrite del vecchio cron verso JSON statico `paused: true`. Anche il gestore
  originale termina prima di inizializzare client o worker se la pausa è attiva.
- Polling disponibilità Forum personali/gruppi fermo; riconciliazione periodica
  presenze e riletture al focus/rete ferme. Prima lettura e aggiornamenti manuali
  restano disponibili agli operatori autorizzati.
- Heartbeat di attività fermo durante la pausa; timer locale di inattività e
  controlli server delle sessioni conservati. Timer puramente grafici non
  producono richieste a Vercel e non sono rimossi.
- Webhook Postmark conservato per ricevute e audit di messaggi già inviati.
  Le attività richieste manualmente da admin/manager non sono un polling.
- Una scheda aperta con il vecchio codice può tentare ancora richieste: i
  controlli server rifiutano gli accessi sospesi; ricaricare le schede dello staff
  per sostituire il vecchio codice client.

La home statica elimina le invocazioni applicative per quella pagina, non ogni
possibile costo Vercel: traffico, accessi staff e webhook restano possibili.
Riferimenti: [Vercel cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs),
[Next rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites).

## Accesso riservato

Solo admin globale o manager assegnato all’evento corrente. Manager viewer,
capigruppo, accoglienza, docenti e partecipanti sono esclusi. Nessuna fiducia
in metadata del browser, ruolo richiesto o appartenenze ad altri eventi.
Controlli al proxy, contesto autenticato, richiesta email e callback; errori di
lettura dei ruoli/evento negano l’accesso. Le vecchie sessioni vengono rifiutate,
i vecchi magic link non abilitano profili sospesi. Uscita locale, non revoca degli
altri dispositivi. Le normali autorizzazioni e RLS restano in vigore.

Indirizzo `/login/<48 caratteri esadecimali casuali>`, generato con 24 byte casuali.
Il valore è in `STAFF_LOGIN_TOKEN`, solo server, già salvato in `.env.local`
ignorato da Git. Non riportarlo nei documenti pubblici o nel repository. Non è
una password sostitutiva: rimangono autenticazione e verifica del ruolo.
La route è dinamica, senza rewrite contenente il token e senza esporlo nei
manifest client. `/login`, suffissi errati, token mancante/malformato e richieste
anonime alle dashboard tornano alla home, senza rivelare il percorso corretto.
La pagina valida ha noindex/nofollow/noarchive, no-referrer e private/no-store.
Le email sospese o sconosciute ricevono un esito neutro senza invio reale.

## Verifiche

- 1.245 test passati, inclusi 11 nuovi casi di pausa, ruoli, errori lettura,
  sessioni aperte, vecchio magic link, registrazioni, email, timer e URL privato.
- TypeScript, lint mirato e diff senza errori. Build production isolata riuscita,
  senza credenziali/dati reali; dipendenze già installate riutilizzate.
- HTTP locale su Next: home e cron 200 con **zero richieste al database sintetico**;
  registrazione/scuole/forum/link gruppo chiusi; partecipante/capogruppo/operatori/
  viewer/manager altro evento negati; admin e manager corrente ammessi.
- `/login` e URL errato chiusi; URL riservato corretto 200, intestazioni verificate.
- Browser: grafica originale, collegamento login assente e sette lingue verificate.
  Layout verificati in frame locali da 320/390/1440px; anteprima principale 753px.
- Nessuna email reale di prova e nessuna migration.

## Rilascio e riapertura

1. Ottenuta la richiesta esplicita di commit/push, impostare `STAFF_LOGIN_TOKEN`
   per Production su Vercel come variabile segreta server-only; trasferirla senza
   stamparla nei log. Verificare che `NEXT_PUBLIC_SITE_PAUSED` non sia `false`.
2. Salvare e inviare solo i file di questa attività, preservando le modifiche
   estranee in AGENTS e i documenti/SQL sulle bozze finale. Deployment da Git;
   verificare lo SHA atteso e lo stato READY, poi home, cron e link privato.
3. Condividere il link completo solo con gli interessati, dopo il rilascio.
4. Per riaprire: verificare prima evento, disponibilità e code/email arretrate;
   impostare `NEXT_PUBLIC_SITE_PAUSED=false` e pubblicare un nuovo build. Il timer
   resta disabilitato fino alla decisione esplicita sulle code. Solo allora
   `systemctl enable --now pace-email-campaigns.timer` e rileggere lo stato.
