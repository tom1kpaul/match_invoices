import { formatMoney, STATUS_LABELS, type InvoiceStatus, type MatchSummary } from "@/lib/matching";
import { cn } from "@/lib/utils";
import type { InvoiceFilter } from "./invoice-table";

const ORDER: { status: InvoiceStatus; dot: string }[] = [
  { status: "paid", dot: "bg-success" },
  { status: "partial", dot: "bg-warning" },
  { status: "overpaid", dot: "bg-info" },
  { status: "unpaid", dot: "bg-muted-foreground" },
];

interface SummaryProps {
  summary: MatchSummary;
  filter: InvoiceFilter;
  onFilter: (f: InvoiceFilter) => void;
}

export function Summary({ summary, filter, onFilter }: SummaryProps) {
  return (
    <section aria-label="Souhrn" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {ORDER.map(({ status, dot }) => {
        const active = filter === status;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onFilter(active ? "all" : status)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-xl border bg-card p-4 text-left shadow-card transition-colors hover:border-ring/40",
              active && "border-ring ring-1 ring-ring",
            )}
          >
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className={cn("size-2 rounded-full", dot)} />
              {STATUS_LABELS[status]}
            </span>
            <span className="num text-3xl font-medium">{summary.counts[status]}</span>
            {status === "unpaid" && (
              <span
                className={cn(
                  "text-xs",
                  summary.overdueUnpaid > 0 ? "text-destructive" : "text-muted-foreground",
                )}
              >
                z toho po splatnosti: {summary.overdueUnpaid}
              </span>
            )}
          </button>
        );
      })}

      <div className="flex flex-col items-start gap-1 rounded-xl bg-primary p-4 text-primary-foreground shadow-card sm:col-span-2 lg:col-span-1">
        <span className="text-sm opacity-80">Celkem dlužná částka</span>
        {summary.owed.length === 0 ? (
          <span className="num text-2xl font-medium">{formatMoney(0, "CZK")}</span>
        ) : (
          summary.owed.map((o) => (
            <span key={o.currency} className="num text-2xl font-medium leading-tight">
              {formatMoney(o.amount, o.currency)}
            </span>
          ))
        )}
        <span className="text-xs opacity-80">nezaplacené a částečně zaplacené</span>
      </div>
    </section>
  );
}
