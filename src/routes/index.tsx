import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadCard } from "@/components/matching/upload-card";
import { Summary } from "@/components/matching/summary";
import { InvoiceTable, type InvoiceFilter } from "@/components/matching/invoice-table";
import { UnmatchedTable } from "@/components/matching/unmatched-table";
import {
  matchPayments,
  parseInvoicesCsv,
  parseStatementCsv,
  type Invoice,
  type ManualPairs,
  type ParseResult,
  type Payment,
} from "@/lib/matching";
import { downloadText, readCsvFile } from "@/lib/read-csv-file";
import { SAMPLE_INVOICES_CSV, SAMPLE_STATEMENT_CSV } from "@/lib/sample-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Párování plateb – faktury a bankovní výpis" },
      {
        name: "description",
        content:
          "Nahrajte vydané faktury a bankovní výpis v CSV a hned uvidíte, co je zaplacené, co chybí a které platby se nespárovaly.",
      },
      { property: "og:title", content: "Párování plateb" },
      {
        property: "og:description",
        content: "Zjistěte z bankovního výpisu, které faktury jsou zaplacené.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

interface Loaded<T> {
  name: string;
  data: ParseResult<T>;
}

function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return `${n} ${one}`;
  if (n >= 2 && n <= 4) return `${n} ${few}`;
  return `${n} ${many}`;
}

function Index() {
  const [invoices, setInvoices] = useState<Loaded<Invoice> | null>(null);
  const [statement, setStatement] = useState<Loaded<Payment> | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [statementError, setStatementError] = useState<string | null>(null);
  const [filter, setFilter] = useState<InvoiceFilter>("all");
  const [manual, setManual] = useState<ManualPairs>({});

  const result = useMemo(() => {
    if (!invoices || !statement) return null;
    return matchPayments(invoices.data.items, statement.data.items, new Date(), manual);
  }, [invoices, statement, manual]);

  function pair(paymentId: string, invoiceId: string) {
    setManual((prev) => ({ ...prev, [paymentId]: invoiceId }));
  }

  function unpair(paymentId: string) {
    setManual((prev) => {
      const next = { ...prev };
      delete next[paymentId];
      return next;
    });
  }

  async function loadInvoices(file: File) {
    try {
      const data = parseInvoicesCsv(await readCsvFile(file));
      setInvoices({ name: file.name, data });
      setInvoiceError(null);
      setManual({});
    } catch (e) {
      setInvoices(null);
      setInvoiceError(e instanceof Error ? e.message : "Soubor se nepodařilo načíst.");
    }
  }

  async function loadStatement(file: File) {
    try {
      const data = parseStatementCsv(await readCsvFile(file));
      setStatement({ name: file.name, data });
      setStatementError(null);
      setManual({});
    } catch (e) {
      setStatement(null);
      setStatementError(e instanceof Error ? e.message : "Soubor se nepodařilo načíst.");
    }
  }

  function loadSample() {
    setInvoices({ name: "ukazka-faktury.csv", data: parseInvoicesCsv(SAMPLE_INVOICES_CSV) });
    setStatement({ name: "ukazka-vypis.csv", data: parseStatementCsv(SAMPLE_STATEMENT_CSV) });
    setInvoiceError(null);
    setStatementError(null);
    setFilter("all");
    setManual({});
  }

  function reset() {
    setInvoices(null);
    setStatement(null);
    setInvoiceError(null);
    setStatementError(null);
    setFilter("all");
    setManual({});
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Párování plateb</h1>
            <p className="text-sm text-muted-foreground">
              Nahrajte vydané faktury a bankovní výpis – zjistíte, co je zaplacené.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={loadSample}>
              <Sparkles />
              Vyzkoušet ukázková data
            </Button>
            {(invoices || statement) && (
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw />
                Začít znovu
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <div className="grid gap-4 md:grid-cols-2">
          <UploadCard
            step={1}
            title="Vydané faktury"
            description="CSV se sloupci Číslo faktury, Odběratel, IČO, Datum vystavení, Datum splatnosti, Částka, Měna, Variabilní symbol."
            buttonLabel="Nahrát faktury (CSV)"
            countLabel={(n) => plural(n, "faktura", "faktury", "faktur")}
            loaded={
              invoices
                ? {
                    name: invoices.name,
                    count: invoices.data.items.length,
                    warnings: invoices.data.warnings,
                  }
                : null
            }
            error={invoiceError}
            onFile={loadInvoices}
          />
          <UploadCard
            step={2}
            title="Bankovní výpis"
            description="CSV se sloupci Datum, Částka, Měna, Protiúčet, Název protiúčtu, Variabilní symbol, Zpráva pro příjemce."
            buttonLabel="Nahrát výpis (CSV)"
            countLabel={(n) => plural(n, "pohyb", "pohyby", "pohybů")}
            loaded={
              statement
                ? {
                    name: statement.name,
                    count: statement.data.items.length,
                    warnings: statement.data.warnings,
                  }
                : null
            }
            error={statementError}
            onFile={loadStatement}
          />
        </div>

        {result ? (
          <>
            <Summary summary={result.summary} filter={filter} onFilter={setFilter} />
            <InvoiceTable
              results={result.invoices}
              filter={filter}
              onFilter={setFilter}
              onUnpair={unpair}
            />
            <UnmatchedTable items={result.unmatched} onPair={pair} />
            {result.ignored.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Ignorováno {plural(result.ignored.length, "odchozí pohyb", "odchozí pohyby", "odchozích pohybů")}{" "}
                (odchozí platby a poplatky).
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center">
            <p className="max-w-md text-muted-foreground">
              Po nahrání obou souborů se zde zobrazí souhrn, stav faktur a nespárované platby.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="link"
                size="sm"
                onClick={() => downloadText("ukazka-faktury.csv", SAMPLE_INVOICES_CSV)}
              >
                <Download />
                Vzor faktur
              </Button>
              <Button
                variant="link"
                size="sm"
                onClick={() => downloadText("ukazka-vypis.csv", SAMPLE_STATEMENT_CSV)}
              >
                <Download />
                Vzor výpisu
              </Button>
            </div>
          </div>
        )}

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4" />
          Soubory se zpracují pouze ve vašem prohlížeči a nikam se neodesílají.
        </p>
      </main>
    </div>
  );
}
