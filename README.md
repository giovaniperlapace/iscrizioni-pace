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
npm run lint
npm run typecheck
npm test
npm run build
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

## Workflow

Il ciclo operativo per milestone, lavoro su `main`, verifiche e documentazione e' in `docs/workflow.md`.
