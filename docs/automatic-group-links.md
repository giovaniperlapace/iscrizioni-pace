# Impostazioni operative e link automatici

Il form gruppi di admin e manager distingue `Gruppo effettivo` (valore iniziale,
sempre assegnabile) dai nodi paese, città e area. I nodi territoriali nascono
strutturali: una scelta esplicita consente di renderli anche iscrivibili.
Il paese non ha parent, la città richiede un paese e l’area una città; un gruppo
può essere autonomo o appartenere a un nodo dell’evento. Il server verifica
l’evento, il tipo del parent ed esclude se stesso e i discendenti. Non chiamare
il campo HTML `nodeType`: interferisce con la proprietà DOM del form e causa
errori di hydration. Il campo si chiama `groupNodeType`.

La voce `Impostazioni` contiene il catalogo servizi nella route condivisa
`/dashboard/manager?section=impostazioni`, accessibile anche agli admin.
I vecchi URL admin/manager con `section=servizi` ricevono un redirect permanente
che conserva gli altri parametri, inclusi `nav`, `serviceId` e messaggi.

## Database e link

Migration: `20260905170000_automatic_group_links.sql`.

- Il trigger su `groups` crea il link canonico e il relativo audit nella stessa
  transazione, per ogni gruppo assegnabile, compresi i nodi territoriali
  esplicitamente iscrivibili. Non dipende dalla visibilità nel catalogo.
- Il backfill aggiunge i link mancanti senza cambiare gli URL esistenti.
- Il nuovo campo `group_registration_links.slug` contiene l’indirizzo pubblico
  amministrativo, che non è una credenziale. Il resolver pubblico continua a
  cercare il relativo hash SHA-256. I vecchi token cifrati restano leggibili;
  le dashboard preferiscono lo slug quando presente.
- L’indice univoco su `token_hash` arbitra anche creazioni simultanee. Il trigger
  riprova con suffissi numerici, incluse collisioni con vecchi token cifrati;
  le route riservate restano escluse. SQL e TypeScript condividono elenco
  riservato e formato (3–96 caratteri, lettere ASCII, cifre, trattino, underscore).
- Il canonico non può scadere, esaurirsi, essere revocato, cancellato o separato
  dal proprio gruppo. La cancellazione del gruppo conserva il normale cascade.
- `Gestisci link` consente nome pubblico, slug, URL completo e copia. La modifica
  dello slug aggiorna hash, slug e token cifrato con un unico UPDATE: in caso di
  collisione il precedente link resta intatto. Cambiare slug invalida il vecchio
  URL, come spiegato nel form; cambiare soltanto nome conserva l’URL.
- Eliminata l’azione applicativa e tutti i form `Genera link`, anche capogruppo.
  Le etichette capogruppo sono disponibili nelle sette lingue.
- Nessuna modifica alle policy RLS o agli scope di autorizzazione applicativi.

## Verifiche

```sh
npm run lint
npm run typecheck
npm test
npm run build
# Database PostgreSQL vuoto e temporaneo:
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/automatic-group-links.sql
# Con dev server locale sulla porta 3107:
node tests/browser/operational-groups.mjs http://localhost:3107
```

Il test SQL verifica backfill, idempotenza, collisioni anche legacy, nomi riservati,
nomi uguali/accentati/lunghi/non latini, aggiornamento atomico, blocco revoca,
scadenza, quota, cancellazione/detachment e rollback della creazione del gruppo
quando fallisce il link/audit. Il test browser usa esclusivamente dati sintetici,
verifica creazione/modifica e responsive e rimuove la propria route temporanea.
Le pagine reali admin e manager sono state verificate in locale con account test,
inclusi form gruppi e redirect legacy a Impostazioni, senza inviare email.

## Rilascio

Applicare la migration prima del codice che legge la nuova colonna `slug`.
La migration è transazionale. Il backfill non tocca iscrizioni, assegnazioni,
questionari o link preesistenti. In produzione sono stati rilevati 93 gruppi
assegnabili privi di link e 14 link canonici esistenti.

Migration applicata e registrata in produzione il 2026-09-05: 93 link e audit
creati; 107 gruppi assegnabili e 107 canonici, zero mancanti, zero nuovi link
strutturali. Il confronto dell’impronta dei 14 record canonici precedenti
(esclusa soltanto la nuova colonna nulla) conferma che sono rimasti invariati.
