import { Fragment, useState } from "react";
import { ChevronRight, TriangleAlert, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatDate,
  formatMoney,
  STATUS_LABELS,
  type InvoiceResult,
  type InvoiceStatus,
} from "@/lib/matching";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

export type InvoiceFilter = "all" | InvoiceStatus | "overdue" | "duplicate";

const FILTERS: { value: InvoiceFilter; label: string }[] = [
  { value: "all", label: "Vše" },
  { value: "paid", label: STATUS_LABELS.paid },
  { value: "partial", label: STATUS_LABELS.partial },
  { value: "overpaid", label: STATUS_LABELS.overpaid },
  { value: "unpaid", label: STATUS_LABELS.unpaid },
  { value: "overdue", label: "Po splatnosti" },
  { value: "duplicate", label: "Možná duplicita" },
];

function matches(r: InvoiceResult, f: InvoiceFilter) {
  if (f === "all") return true;
  if (f === "overdue") return r.overdue;
  if (f === "duplicate") return r.possibleDuplicate;
  return r.status === f;
}

interface InvoiceTableProps {
  results: InvoiceResult[];
  filter: InvoiceFilter;
  onFilter: (f: InvoiceFilter) => void;
  onUnpair: (paymentId: string) => void;
}

export function InvoiceTable({ results, filter, onFilter, onUnpair }: InvoiceTableProps) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const rows = results.filter((r) => matches(r, filter));

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="rounded-xl border bg-card shadow-card">
      <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
        <h2 className="font-semibold">Faktury</h2>
        <div role="group" aria-label="Filtr podle stavu" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const count = results.filter((r) => matches(r, f.value)).length;
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={active}
                onClick={() => onFilter(f.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {f.label}
                <span className="num ml-1.5 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-8 pl-4" />
            <TableHead>Faktura</TableHead>
            <TableHead>Odběratel</TableHead>
            <TableHead>VS</TableHead>
            <TableHead>Splatnost</TableHead>
            <TableHead className="text-right">Částka</TableHead>
            <TableHead className="text-right">Uhrazeno</TableHead>
            <TableHead className="pr-4">Stav</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                Žádné faktury v tomto stavu.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => {
            const { invoice: inv } = r;
            const isOpen = open.has(inv.id);
            const red = r.status === "unpaid" && r.overdue;
            return (
              <Fragment key={inv.id}>
                <TableRow
                  onClick={() => toggle(inv.id)}
                  className={cn(
                    "cursor-pointer",
                    red && "bg-destructive-soft hover:bg-destructive-soft/80",
                  )}
                >
                  <TableCell className="pl-4">
                    <ChevronRight
                      aria-label={isOpen ? "Skrýt platby" : "Zobrazit platby"}
                      className={cn(
                        "size-4 text-muted-foreground transition-transform",
                        isOpen && "rotate-90",
                      )}
                    />
                  </TableCell>
                  <TableCell className="num font-medium">{inv.number}</TableCell>
                  <TableCell>
                    <div className="font-medium">{inv.customer}</div>
                    {inv.ico && (
                      <div className="num text-xs text-muted-foreground">IČO {inv.ico}</div>
                    )}
                  </TableCell>
                  <TableCell className="num text-muted-foreground">{inv.vs || "—"}</TableCell>
                  <TableCell
                    className={cn("num", r.overdue && "font-medium text-destructive")}
                  >
                    {formatDate(inv.dueDate)}
                  </TableCell>
                  <TableCell className="num text-right">
                    {formatMoney(inv.amount, inv.currency)}
                  </TableCell>
                  <TableCell className="num text-right text-muted-foreground">
                    {formatMoney(r.paid, inv.currency)}
                    <div className="text-xs">
                      {r.payments.length === 1
                        ? "1 platba"
                        : r.payments.length >= 2 && r.payments.length <= 4
                          ? `${r.payments.length} platby`
                          : `${r.payments.length} plateb`}
                    </div>
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge result={r} />
                      {r.status === "partial" && (
                        <span className="num text-xs text-warning">
                          chybí {formatMoney(-r.difference, inv.currency)}
                        </span>
                      )}
                      {r.status === "overpaid" && (
                        <span className="num text-xs text-info">
                          přeplaceno o {formatMoney(r.difference, inv.currency)}
                        </span>
                      )}
                      {r.possibleDuplicate && (
                        <span className="flex items-center gap-1 text-xs font-medium text-warning">
                          <TriangleAlert className="size-3.5" />
                          Možná duplicitní platba
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                {isOpen && (
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableCell />
                    <TableCell colSpan={7} className="py-3 pr-4">
                      {r.payments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          K této faktuře nedorazila žádná platba.
                        </p>
                      ) : (
                        <ul className="space-y-1.5 text-sm">
                          {r.payments.map(({ payment: p, via, amount, sharedWith }) => (
                            <li key={p.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
                              <span className="num w-24 text-muted-foreground">
                                {formatDate(p.date)}
                              </span>
                              <span className="num w-32 text-right font-medium">
                                {formatMoney(amount, p.currency)}
                              </span>
                              {sharedWith.length > 0 && (
                                <span className="num text-xs text-info">
                                  část platby {formatMoney(p.amount, p.currency)}, zbytek k{" "}
                                  {sharedWith.join(", ")}
                                </span>
                              )}
                              <span>{p.accountName || p.account || "—"}</span>
                              <span className="text-muted-foreground">
                                {via === "vs"
                                  ? "podle VS"
                                  : via === "message"
                                    ? `VS nalezen ve zprávě „${p.message}"`
                                    : "spárováno ručně"}
                              </span>
                              {via === "manual" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => onUnpair(p.id)}
                                >
                                  <Unlink />
                                  Zrušit spárování
                                </Button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
