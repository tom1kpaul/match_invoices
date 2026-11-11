import { Link2 } from "lucide-react";
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
  SUGGESTION_PARAM_COUNT,
  SUGGESTION_PARAM_LABELS,
  type UnmatchedPayment,
} from "@/lib/matching";

interface UnmatchedTableProps {
  items: UnmatchedPayment[];
  onPair: (paymentId: string, invoiceId: string) => void;
}

export function UnmatchedTable({ items, onPair }: UnmatchedTableProps) {
  return (
    <section className="rounded-xl border bg-card shadow-card">
      <div className="flex items-baseline justify-between gap-3 border-b p-4">
        <h2 className="font-semibold">Nespárované platby</h2>
        <span className="text-sm text-muted-foreground">
          příchozí platby, ke kterým se nenašla faktura
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Datum</TableHead>
            <TableHead className="text-right">Částka</TableHead>
            <TableHead>Protiúčet</TableHead>
            <TableHead>VS</TableHead>
            <TableHead>Zpráva pro příjemce</TableHead>
            <TableHead>Důvod</TableHead>
            <TableHead className="pr-4">Nejpodobnější faktura</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                Všechny příchozí platby byly spárovány.
              </TableCell>
            </TableRow>
          )}
          {items.map(({ payment: p, reason, suggestion }) => (
            <TableRow key={p.id}>
              <TableCell className="num pl-4">{formatDate(p.date)}</TableCell>
              <TableCell className="num text-right font-medium">
                {formatMoney(p.amount, p.currency)}
              </TableCell>
              <TableCell>
                <div className="font-medium">{p.accountName || "—"}</div>
                {p.account && (
                  <div className="num text-xs text-muted-foreground">{p.account}</div>
                )}
              </TableCell>
              <TableCell className="num text-muted-foreground">{p.vs || "—"}</TableCell>
              <TableCell className="max-w-56 text-muted-foreground">{p.message || "—"}</TableCell>
              <TableCell className="max-w-56 text-sm">{reason}</TableCell>
              <TableCell className="pr-4">
                {suggestion ? (
                  <div className="flex min-w-56 flex-col items-start gap-1.5">
                    <div className="text-sm">
                      <span className="num font-medium">{suggestion.invoice.number}</span>{" "}
                      <span className="text-muted-foreground">· {suggestion.invoice.customer}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Sedí {suggestion.matched.length} z {SUGGESTION_PARAM_COUNT}:{" "}
                      {suggestion.matched.map((m) => SUGGESTION_PARAM_LABELS[m]).join(", ")}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onPair(p.id, suggestion.invoice.id)}
                    >
                      <Link2 />
                      Spárovat s {suggestion.invoice.number}
                    </Button>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Žádná faktura se dostatečně neshoduje
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
