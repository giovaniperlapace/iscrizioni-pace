# Attivazione email cerimonia finale — 26 ottobre 2026

Autorizzazione esplicita dell’utente: attivare badge personali e report ai
capigruppo; istruzioni di accesso attraverso campagne separate.

La migration `20261026180000` consente istruzioni vuote nelle impostazioni.
Non attiva gli invii da sola. Restano invariati l’abilitazione esplicita,
l’autorizzazione Admin, il lock, la revisione e l’audit della RPC
`set_closing_badge_delivery`. I messaggi personali conservano PDF e immagine
CID; i report conservano riepilogo e PDF per settore senza sezioni istruzioni.

Verifiche: suite completa SQL cerimonie e concorrenza su PostgreSQL temporaneo
superata; payload con istruzioni vuote, conflitto revisione e rifiuto non Admin
verificati. Test ufficiale Postmark senza consegna: tre settori personali,
famiglia con tre badge, riepilogo quantità, report di 1.005 persone e report
con tre PDF accettati con ErrorCode 0.

Rilascio: backup completo verificato prima della modifica remota; guardie su
righe, ACL/RLS e metadati delle funzioni prima dell’attivazione canonica.
Preflight: solo quattro notifiche storiche già accettate, nessun messaggio in
attesa. Nessun reinvio o riaccodamento previsto. Il cron ordinario elaborerà le
nuove pubblicazioni e gli abbinamenti del capogruppo.

Gli artefatti operativi di questa attivazione sono conservati localmente in
`output/closing-badges/activation/`. I promemoria Forum restano esclusi.
