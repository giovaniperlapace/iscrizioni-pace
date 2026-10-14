# Ritiro dalla pubblicazione dei Forum — 14 ottobre 2026

Richiesta aggiuntiva dell’utente sul lavoro Forum in main: pulsante per rendere
un Forum non pubblicato conservando gli iscritti. Rilascio insieme alle funzioni
Forum già autorizzate, con home attuale e prenotazioni pubbliche ancora chiuse.

Nel catalogo gestionale Admin/Manager, desktop e mobile, i Forum pubblicati
mostrano **Rendi non pubblicato**. La conferma nomina il Forum e spiega che torna
in bozza, scompare dal catalogo pubblico e mantiene iscrizioni individuali,
minori e scuole. L’elenco Iscritti rimane accessibile e il comando Pubblica forum
permette di ripristinare la pubblicazione. Nessun Forum reale ritirato per prova.

Si conserva la FIFO ancora in attesa; le offerte temporanee vengono annullate
secondo la regola DB preesistente. I posti offerti non diventano iscrizioni
confermate. Nessuna nuova offerta durante il ritiro; riprendono al controllo
periodico quando il Forum torna pubblicato e il gate è open.

Server Action autenticata, preflight gestione evento, UUID validati, RPC con
controlli Admin globale/Manager evento corrente e lock della sola riga Forum.
Cambio del solo publication_status, idempotente; i trigger esistenti impostano
is_public, data/autore e audit panel.unpublished. Viewer e pubblico esclusi.
Errori e retry nella conferma ReliableForm; filtri e navigazione full/mini
conservati. X/Escape, focus e scorrimento interno condivisi con la pubblicazione.

Migration additive `20261014160000_forum_unpublication`: nuova RPC autenticata,
nessun nuovo dato/tabella/policy. Aggiorna anche save_panel_draft: modifica le
quote già presenti mantenendone gli ID, inserisce solo quelle nuove e rimuove
solo quelle omesse. I riferimenti FK impediscono di rimuovere quote collegate a
prenotazioni o storico; i vincoli di capienza proteggono i posti occupati. Questa
correzione evita che il ritorno in bozza renda impossibile modificare il Forum
con prenotazioni, perché il vecchio salvataggio cancellava e ricreava ogni quota.

Verifica locale: 884 test, lint, TypeScript, PostgreSQL temporaneo con tutte le
migration canoniche, dati sintetici. Snapshot delle righe conferma identità,
iscrizioni, minori e scuole invariati; quote e roster conservati dopo ritiro,
modifica e ripubblicazione. Controllati ruoli, retry, evento errato, capienza e
lista d’attesa. Browser reale con Server Action e PostgreSQL sintetico: Admin e
Manager, Viewer senza controllo, desktop/mobile, annullamento, Escape/focus,
errori recuperabili, filtri e menu. Nessuna email inviata.

Per ripetere il collaudo: `node tests/sql/run-forum-waitlist.mjs` per SQL e
concorrenza; `--unpublish-browser` per la nuova interazione, con Next locale
sulla porta 3164, entrambe SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL impostate su
http://127.0.0.1:55485, chiavi sintetiche e delivery log. Il runner crea/rimuove
la route temporanea e il database locale; PLAYWRIGHT_MODULE può selezionare il
runtime Playwright installato. I fixture non usano variabili DB remote.

## Migration production

Applicata e registrata atomicamente la migration, con reload PostgREST. Backup
custom completo verificato, permessi 600, 8.683.957 byte sul server:
`/tmp/iscrizioni-pace-production-before-forum-unpublication-20261014-1791984251930.dump`.
SHA-256 backup `fedc3dbafe207849f445251d1505c28c5041c16ed0d7363c3d34d931c11a6754`.
SHA-256 migration `e9c9b787bbd464c87bbe553ca3ec2905eb6a56027f179b54afe545108bd29f10`.

La transazione verifica tutte le colonne/impronte ordinate delle 63 tabelle
pubbliche preesistenti, le 132 policy, definizioni e privilegi delle funzioni:
nessun valore applicativo o policy modificati; soltanto la nuova RPC e il
salvataggio bozza dichiarati. Nessun account/ruolo o dato di collaudo remoto.
Inventario successivo in sola lettura: 84.554 righe pubbliche, 168 funzioni
app/public; unpublish accessibile authenticated e negata ad anon. Modalità
internal, catalogo pubblico e coda vuoti; timer email attivo, esito success.
Staging e configurazioni di apertura conservati.

Build production completata da npm ci in copia pulita senza variabili remote;
route sintetiche rimosse prima della build. Prima del push, testo home acquisito
in sola lettura sul dominio, hash SHA-256
`5600baed8ca7b083e01f2f4e7ec74e4f98543a683fa8d30924acbb14e2e85413`,
nessuna sezione pubblica Forum/scuole visibile. Codice pronto per il normale
rilascio automatico su main già richiesto dall’utente.
