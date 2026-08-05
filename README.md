# Iscrizioni Pace

Base tecnica per la web app multi-evento di iscrizioni, gruppi, comunicazioni, QR code e accoglienza.

## Stack

- Next.js 16 App Router.
- React 19.
- TypeScript strict.
- Tailwind CSS 4.
- Supabase con client browser/server/service separati.

## Comandi

```bash
npm run dev
npm run dev:staging
npm run lint
npm run typecheck
npm test
npm run build
npm run staging:verify
```

## Ambiente

Copiare `.env.example` in `.env.local` e inserire le chiavi reali solo localmente.

Variabili previste:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

Non committare segreti.

Per il lavoro panel P0-P10 usare `.env.staging.local`, derivato da
`.env.staging.example`, e avviare l'app con `npm run dev:staging`. Il comando
`npm run staging:verify` deve passare prima di usare il nuovo ambiente.

## Workflow

Il ciclo operativo per milestone, lavoro su `main`, verifiche e documentazione e' in `docs/workflow.md`.
