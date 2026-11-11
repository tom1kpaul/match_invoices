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

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/76197da2-4b7e-5e59-9f0c-285d941c59da).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
