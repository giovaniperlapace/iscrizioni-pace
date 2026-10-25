# Accoglienza: nomi brevi delle sale collegate e conteggi visibili

Le sei sale collegate usano solo nella postazione Accoglienza queste etichette:

| Forum | Nome interno |
| --- | --- |
| 1 | Collegata F1 · Domus |
| 3 | Collegata F3 · Serafico |
| 9 | Collegata F9 · Domus |
| 10 | Collegata F10 · Serafico |
| 18 | Collegata F18 · Serafico |
| 19 | Collegata F19 · Domus |

Il nome breve è coerente nella scelta dell’incarico, nell’intestazione della
fotocamera e in manuale/USB. La sede canonica rimane nella riga della scelta.
Il numero del Forum distingue i diversi incarichi che condividono la sede.
L’associazione usa gli ID canonici del catalogo delle sale collegate, senza
riconoscimenti per prefisso o modifiche ai titoli dei Forum principali.

Nomi pubblici, email, cataloghi dei partecipanti, database, ID delle operazioni
e conteggi non vengono modificati. Nessuna migration o scrittura operativa.

L’intestazione della fotocamera riserva una riga al titolo e una riga di altezza
sufficiente a contatori/pulsante. Sui telefoni stretti Iscritti/Entrati possono
disporsi uno sopra l’altro accanto ad «Aggiorna conteggi». I nomi brevi entrano
per intero; un altro titolo eccezionalmente lungo può usare ellissi soltanto
nell’anteprima, conservando il testo nel DOM accessibile e nell’attributo title.
In manuale i titoli possono andare a capo. Le bande superiore e inferiore
restano simmetriche, alte 80px; nessuna modifica a decoder o ciclo fotocamera.

## Verifiche

- Due nuovi test sulle sei etichette, unicità per Forum, conservazione degli
  oggetti canonici ed esclusione di Forum principali/cerimonie/verifica iscrizione.
- 1.148 test della working tree passati (incluso il test locale preesistente
  degli incarichi anticipati), TypeScript e lint mirato passati. Build production
  in copia isolata con le dipendenze npm ci già verificate; manifest e lockfile
  del repository invariati. Modifica concorrente alla pubblicazione Forum esclusa
  dalla copia di verifica di questa attività.
- Browser originale con dati sintetici, viewport 320/360/390/844px: tutti e sei
  i nomi interi, ogni contatore e pulsante contenuti nella fascia, nessuno scroll
  verticale interno o overflow orizzontale, conteggi aggiornabili, manuale e
  cambi incarico. Verificati anche Forum principale e cerimonia con titoli lunghi.
- Screenshot a 320px controllati: `/tmp/pace-short-domus.png`,
  `/tmp/pace-short-serafico.png`. Nessun errore JavaScript.

```sh
node --test tests/reception-duty-labels.test.mts
RECEPTION_LABELS_ONLY=1 PLAYWRIGHT_MODULE=/percorso/playwright/index.mjs node tests/browser/run-forum-event-reception.mjs
```
