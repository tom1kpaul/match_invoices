# Cesky Platebni Detektiv

Vytvoř webovou aplikaci v češtině s názvem „Párování plateb".

Účel: účetní nahraje seznam vydaných faktur a bankovní výpis

a aplikace zjistí, které faktury jsou zaplacené.

Vstupy:

- Dva CSV soubory nahrané přes tlačítka (faktury a výpis).

- Oddělovač je středník, desetinná čárka, mezera jako oddělovač

  tisíců (např. „12 100,00"), datum ve formátu DD.MM.RRRR.

- Faktury mají sloupce: Číslo faktury; Odběratel; IČO; Datum vystavení;

  Datum splatnosti; Částka; Měna; Variabilní symbol

- Výpis má sloupce: Datum; Částka; Měna; Protiúčet; Název protiúčtu;

  Variabilní symbol; Zpráva pro příjemce

Pravidla párování:

1. Záporné částky (odchozí platby, poplatky) ignoruj.

2. Platbu přiřaď k faktuře podle variabilního symbolu.

3. Pokud platba nemá VS, zkus najít číslo VS ve zprávě pro příjemce.

4. Jedna faktura může mít více plateb – sečti je.

Stav každé faktury:

- Zaplaceno (součet plateb = částka)

- Částečně zaplaceno (méně) – ukaž, kolik chybí

- Přeplatek (více) – ukaž o kolik

- Nezaplaceno – a pokud je po splatnosti, zvýrazni červeně

- Upozornění „Možná duplicitní platba", pokud k faktuře přišly

  dvě platby se stejnou částkou a součet je vyšší než faktura

Výstupy:

- Tabulka faktur se stavem, barevným označením a filtrem podle stavu.

- Samostatná tabulka „Nespárované platby" (platby, ke kterým se

  nenašla faktura).

- Souhrn nahoře: počet faktur v jednotlivých stavech a celková

  dlužná částka.

Zatím bez přihlašování a bez databáze, vše se zpracuje v prohlížeči.

Design čistý a jednoduchý.

## Vývoj

Potřebuješ Node.js a npm.

```sh
npm install      # nainstaluje závislosti
npm run dev      # spustí aplikaci na http://localhost:8080
npm test         # spustí testy
npm run build    # sestaví produkční verzi do složky .output/
```
