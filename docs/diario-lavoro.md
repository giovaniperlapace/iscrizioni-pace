# Diario di lavoro

Questo diario raccoglie le decisioni e le verifiche operative delle giornate di
sviluppo. Non deve contenere segreti, token, password, dati personali reali non
necessari o link con token in chiaro.

## 2026-06-18

### Contesto

- Dominio production definitivo: `https://registrationspeace.santegidio.org`.
- Deployment production verificato: `dpl_DoqnqcsFuifN4xG6wbTa48s9k369`.

### Cose fatte

- Aggiornate le env Vercel production:
  - `NEXT_PUBLIC_APP_URL`;
  - `APP_URL`;
  - `PUBLIC_SITE_URL`;
  - `QR_TOKEN_ENCRYPTION_SECRET`.
- Associato esplicitamente l'alias
  `https://registrationspeace.santegidio.org` al deployment production.
- Aggiornata la allow-list Supabase Auth self-hosted aggiungendo
  `https://registrationspeace.santegidio.org/**` a
  `ADDITIONAL_REDIRECT_URLS`; lasciati anche localhost e alias Vercel legacy.
- Riavviato il container `supabase-auth-ammnuajlmd83t94cfy3us6cw`; il container
  e' tornato `healthy`.
- Aggiunta compatibilità in decifratura QR: i nuovi token usano
  `QR_TOKEN_ENCRYPTION_SECRET`, ma la lettura prova anche i fallback storici
  `SUPABASE_SERVICE_ROLE_KEY` ed `EMAIL_PASSWORD`.
- Aggiornati default, test e documentazione per il dominio definitivo.

### Verifiche eseguite

- `npm test`.
- `npm run lint`.
- `npm run typecheck`.
- `npm run build`.
- `npm run opening:verify`.
- `vercel inspect https://registrationspeace.santegidio.org`.
- `curl -I -L https://registrationspeace.santegidio.org/`.
- Login reale con magic link per `nicolamastrorilli33@gmail.com`:
  - email inviata da `registrationspeace@santegidio.org`;
  - link con host `https://registrationspeace.santegidio.org`;
  - callback `/auth/callback` con `type=email`;
  - redirect finale verificato a `/dashboard/partecipante`;
  - nessun errore console browser rilevato dopo il login.

### Decisioni

- Il dominio canonico per produzione e magic link e'
  `https://registrationspeace.santegidio.org`.
- `https://iscrizioni-pace.vercel.app` resta solo alias legacy compatibile.
- Non stampare o salvare mai token dei magic link nei log o nella
  documentazione.

## 2026-06-15

### Contesto

- Branch di lavoro: `main`.
- Repository remoto: `https://github.com/giovaniperlapace/iscrizioni-pace`.
- Commit di partenza della giornata documentato: `9846d40 Implement registration questionnaire milestone`.
- Ambiente locale: `http://localhost:3000`.
- Ambiente production Vercel: `https://registrationspeace.santegidio.org`.

### Cose fatte

- Rifinito il form pubblico di iscrizione sulla base dei test nel browser:
  - rimosso il riferimento tecnico al Washington Group dal testo visibile
    all'utente;
  - mantenuta una descrizione semplice: l'utente può selezionare una o più
    opzioni utili per organizzare meglio l'accoglienza;
  - confermato che le indicazioni pratiche di accessibilità sono opzionali.
- Sistemata e verificata la configurazione production Vercel:
  - production branch impostata su `main`;
  - rimosse le env `Preview (main)` che impedivano a Vercel di trattare `main`
    come production branch;
  - URL production pubblici impostati su `https://registrationspeace.santegidio.org`;
  - variabili pubbliche rese verificabili, lasciando le variabili segrete
    encrypted/sensitive.
- Eseguito un nuovo deploy production Vercel:
  - deployment verificato: `dpl_88vmZqKD4owNWxPgnzJnoueYYmsW`;
  - alias stabile aggiornato: `https://registrationspeace.santegidio.org`;
  - risposta HTTP dell'alias: `200`.
- Aggiornata la configurazione Supabase Auth self-hosted:
  - `API_EXTERNAL_URL` confermato su
    `https://iscrizioni-supabase.stefano-orlando.it`;
  - allowlist redirect aggiornata con localhost e domini Vercel production;
  - container `supabase-auth-ammnuajlmd83t94cfy3us6cw` riavviato e verificato
    `healthy`.
- Verificato il dominio dei magic link per l'ambiente online:
  - action host Supabase pubblico:
    `iscrizioni-supabase.stefano-orlando.it`;
  - redirect finale:
    `https://registrationspeace.santegidio.org/auth/callback`;
  - redirect applicativo:
    `/dashboard/partecipante`;
  - token non stampati né salvati nei log/documenti.
- Aggiornati `AGENTS.md` e `PIANO_DI_LAVORO.md` con lo stato reale del progetto,
  la configurazione production e il prossimo passo consigliato.

### Verifiche eseguite

- `npm run typecheck`.
- `vercel inspect https://registrationspeace.santegidio.org`.
- `curl -I -L https://registrationspeace.santegidio.org/`.
- Verifica non distruttiva di un magic link generato con Supabase admin, con
  output limitato a host/path e senza token.
- Verifica env Vercel production tramite `vercel env pull` su file temporaneo:
  gli URL pubblici puntano a `https://registrationspeace.santegidio.org`.

### Decisioni

- In produzione i push su `main` devono andare a production, non preview.
- Le variabili Vercel pubbliche e non segrete possono essere non-sensitive per
  poterle verificare; le variabili segrete restano sensitive/encrypted.
- Dopo qualunque modifica a `NEXT_PUBLIC_*` serve un redeploy production.
- La UI del questionario deve evitare riferimenti tecnici agli standard usati;
  tali riferimenti restano utili nella documentazione tecnica.

### Rischi residui e prossimi controlli

- L'arrivo reale delle email dipende dalla validità della password app Gmail
  configurata nelle env SMTP.
- Le dashboard sono ancora iniziali: la Milestone 6 dovrà rendere davvero
  utilizzabile la dashboard partecipante.
- Prima di procedere con nuove funzioni, verificare ancora `git status --short`,
  branch `main`, env production e stato deploy.
