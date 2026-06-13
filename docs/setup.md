# Setup progetto

Milestone 1 ha inizializzato la base tecnica nella cartella corrente.

## Decisione Git

E' stata scelta la strada piu' semplice: inizializzare questa cartella come repository Git locale.

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
```

## Note

- Non sono state create migration.
- Non e' stato collegato un database reale.
- Le chiavi Supabase reali devono restare in `.env.local`.
