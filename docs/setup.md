# Setup progetto

Milestone 1 ha inizializzato la base tecnica nella cartella corrente.

## Decisione Git

E' stata scelta la strada più semplice: inizializzare questa cartella come repository Git locale.

- Branch di lavoro ordinario: `main`.
- Remote GitHub configurato dopo la milestone 1:
  `https://github.com/giovaniperlapace/iscrizioni-pace`.
- Nessun commit o push eseguito.

## Stack installato

- Next.js 16.
- React 19.
- TypeScript.
- Tailwind CSS 4.
- ESLint.
- Supabase SDK e SSR helpers.

## File principali

- `app/layout.tsx`: layout root e metadati iniziali.
- `app/page.tsx`: home tecnica minima.
- `app/globals.css`: Tailwind 4 e font/theme base.
- `lib/supabase/client.ts`: client browser con anon key.
- `lib/supabase/server.ts`: client server con cookie e RLS.
- `lib/supabase/service.ts`: client service role solo server.
- `.env.example`: variabili richieste senza segreti.

## Comandi disponibili

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run email:verify
npm run opening:verify
npm run opening:verify:production
```

## Note

- Non sono state create migration.
- Non e' stato collegato un database reale.
- Le chiavi Supabase reali devono restare in `.env.local`.
- `npm run email:verify` controlla la connessione SMTP configurata in
  `.env.local` senza inviare email e senza stampare credenziali. Con Gmail
  serve una app password valida dell'account mittente; gli spazi visuali della
  app password vengono rimossi automaticamente dal codice.
- `npm run opening:verify` controlla la presenza delle variabili necessarie
  all'apertura pubblica nella `.env.local`. Non stampa valori segreti.
- `npm run opening:verify:production` esegue lo stesso controllo in modalità
  production usando `.env.production.local` e verifica che gli URL applicativi
  puntino al dominio stabile.
