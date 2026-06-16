# Log apertura controllata

Questo documento raccoglie problemi, decisioni e verifiche dei primi giorni di
apertura. Non inserire segreti, token, QR, password, service role key o dati
personali non necessari.

## Procedura apertura/chiusura

1. Verificare configurazione e build:

```bash
npm run opening:verify
npm run opening:verify:production
npm run email:verify
npm run lint
npm run typecheck
npm test
npm run build
```

2. Aprire `/dashboard/admin` con utente admin.
3. Sul riquadro dell'evento corretto usare:
   - `Apri ora`: imposta evento `published`, apre subito la finestra e rimuove
     una chiusura passata.
   - `Pausa`: lascia l'evento pubblicato ma chiude la finestra iscrizioni al
     momento corrente.
   - `Nascondi`: imposta l'evento `draft` e chiude la finestra al momento
     corrente.
4. Dopo ogni comando controllare home pubblica e form in una nuova sessione
   browser.
5. Annotare qui orario, decisione e motivo.

Ogni comando admin scrive anche un record in `audit_logs` con action
`event.opening_open`, `event.opening_pause` o `event.opening_draft`.

## Controlli iniziali

Durante l'apertura controllata controllare `/dashboard/admin` almeno dopo ogni
blocco di inviti o comunicazione pubblica:

- `Iscrizioni` e `Ultime 24 ore`: crescita attesa dopo la comunicazione.
- `Senza gruppo corrente`: deve restare a zero o essere corretto rapidamente.
- `Gruppo probabile`: casi da verificare con manager/referenti.
- `QR mancante`: deve restare a zero per nuove iscrizioni.
- `Email fallite 24h`: se maggiore di zero verificare SMTP e inbox mittente.
- `Email duplicate`: indica possibili doppie iscrizioni o correzioni manuali.
- `Supporto richiesto`: casi da passare a chi cura accessibilità e logistica.

Gli errori di invio magic link e conferma iscrizione vengono registrati in
`audit_logs` con action `email.magic_link_failed` e
`email.registration_confirmation_failed`. Nel metadata viene salvato il dominio
email, non l'indirizzo completo.

## Registro

### 2026-06-16

- Milestone 8 implementata localmente: dashboard admin con stato apertura,
  comandi `Apri ora` / `Pausa` / `Nascondi`, conteggi minimi e audit errori
  email.
- Prima dell'apertura reale eseguire ancora checklist completa e smoke test su
  produzione.
