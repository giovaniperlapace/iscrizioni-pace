# Checklist apertura iscrizioni

Questa checklist va completata prima di aprire il form pubblico a persone reali.
Non inserire segreti in questo documento.

## 1. Evento e contenuti

- Confermare evento reale, città, paese, date e finestre
  `registration_opens_at` / `registration_closes_at`.
- Rimuovere o nascondere dati seed/test dal flusso pubblico.
- Confermare testi definitivi di privacy, consenso, email di conferma e magic
  link.
- Verificare che la home mostri l'evento corretto e nessun riferimento a test.

## 2. Gruppi e referenti

- Caricare paesi, città, gruppi pubblici assegnabili e nodi interni per nuovi
  partecipanti.
- Verificare referenti per paese, città, area/sottogruppo e gruppo finale.
- Per ogni utente operativo che partecipa all'evento, collegare anche una
  registrazione personale tramite la stessa email/account.
- Verificare almeno un caso "doppio cappello": dashboard operativa e dashboard
  partecipante accessibili con la stessa email.

## 3. Configurazione produzione

- Verificare che le env Vercel production includano Supabase, SMTP,
  `QR_TOKEN_ENCRYPTION_SECRET`, `APP_URL`, `NEXT_PUBLIC_APP_URL` e
  `PUBLIC_SITE_URL`.
- In produzione i tre URL app devono puntare a
  `https://iscrizioni-pace.vercel.app`.
- `EMAIL_DELIVERY_MODE` deve essere `smtp` prima dell'apertura pubblica.
- `QR_TOKEN_ENCRYPTION_SECRET` deve essere stabile tra deploy.
- Eseguire:

```bash
npm run opening:verify
npm run opening:verify:production
npm run email:verify
```

## 4. Verifiche applicative

- Eseguire:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

- Testare da browser desktop e mobile:
  - email nuova -> form iscrizione -> conferma -> email con QR;
  - email esistente -> magic link -> dashboard partecipante;
  - utente manager/referente -> dashboard operativa -> "La mia iscrizione";
  - utente operativo senza registrazione personale -> avviso e avvio iscrizione.
- Eseguire smoke test production su
  `https://iscrizioni-pace.vercel.app`.

## 5. Decisione apertura

- Aprire solo quando evento, testi, SMTP, URL, QR e caso doppio ruolo sono stati
  verificati.
- Se qualcosa va storto dopo l'apertura, chiudere temporaneamente modificando
  stato/finestra iscrizioni dell'evento e annotare il problema in un log
  operativo.

## 6. Monitoraggio iniziale

- Usare `/dashboard/admin` per aprire, mettere in pausa o nascondere l'evento.
- Controllare dopo ogni invio/invito: iscrizioni ultime 24 ore, casi senza
  gruppo corrente, QR mancanti, errori email, email duplicate e richieste di
  supporto operativo.
- Annotare decisioni e problemi in `docs/opening-monitoring-log.md`.
