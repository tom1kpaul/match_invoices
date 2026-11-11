import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney, type UnmatchedPayment } from "@/lib/matching";

export function UnmatchedTable({ items }: { items: UnmatchedPayment[] }) {
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
            <TableHead className="pr-4">Důvod</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                Všechny příchozí platby byly spárovány.
              </TableCell>
            </TableRow>
          )}
          {items.map(({ payment: p, reason }) => (
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
              <TableCell className="max-w-64 text-muted-foreground">{p.message || "—"}</TableCell>
              <TableCell className="pr-4 text-sm">{reason}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
