# Rilascio complessivo delle modifiche residue — 20 ottobre 2026

Richiesta esplicita: commit, push e deploy in produzione di tutte le modifiche
locali non ancora pubblicate.

Inclusi operazioni multiple Admin/Manager, eliminazione tag con conferma,
filtri delle presenze dichiarate e parità Excel; report delle campagne inviate,
esportazione CSV, avvisi sugli indirizzi soppressi, recupero selettivo esplicito,
istantanea del destinatario, eventi Postmark e protezione degli esiti server.
Lo script di riconciliazione storica è incluso, ma non eseguito da questo rilascio.
Nessuna campagna inviata o reinvio avviato per collaudo.

Migration applicate e registrate prima del codice:
- `20261020160000_manager_bulk_operations`;
- `20261020180000_campaign_delivery_reports`;
- `20261020190000_campaign_evidence_guard` (protezione aggiuntiva separata
  dalla migration dei report già applicata).

Backup custom verificato: 12.985.395 byte, SHA256
`39546e62814eef05c3200c6e12dc0deaa4dd90aefa25032ebcaca2865494bce7`.
Confrontati conteggi e fingerprint di tutte le colonne preesistenti: 64 tabelle,
134.532 righe conservate; i nuovi campi nullable sono esclusi dal confronto
con il vecchio schema. ACL/proprietari delle 196 funzioni esistenti conservati.
Successiva protezione aggiuntiva: 67 tabelle, stesse 134.532 righe e 200 funzioni
conservate. Modalità Forum `internal` invariata.

Verifiche su copia isolata senza credenziali: 978 test applicativi e ulteriori
test di accesso ai report/webhook; lint, build production e TypeScript.
SQL temporaneo: operazioni multiple, autorizzazioni, rollback, concorrenza,
report, deduplicazione eventi, ordine delle soppressioni, selezione atomica,
reinvii idempotenti, protezione scritture dirette e regressione Forum.
Browser sintetico desktop/mobile: selezione, conferma, errori, paginazione,
filtri, report e Viewer; nessuna scrittura operativa remota.

Configurato `POSTMARK_WEBHOOK_SECRET` in Production e Development, senza
salvare il segreto nel repository. Webhook sul solo stream broadcast, eventi
Delivery/Bounce/SpamComplaint/SubscriptionChange, senza corpi dei messaggi.
L’attivazione del webhook segue il deploy dell’endpoint autenticato.
