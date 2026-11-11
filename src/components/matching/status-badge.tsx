import { CheckCircle2, CircleDashed, CircleAlert, PlusCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type InvoiceResult } from "@/lib/matching";

export function StatusBadge({ result }: { result: InvoiceResult }) {
  const label = STATUS_LABELS[result.status];
  switch (result.status) {
    case "paid":
      return (
        <Badge variant="success">
          <CheckCircle2 className="size-3.5" />
          {label}
        </Badge>
      );
    case "partial":
      return (
        <Badge variant="warning">
          <CircleDashed className="size-3.5" />
          {label}
        </Badge>
      );
    case "overpaid":
      return (
        <Badge variant="info">
          <PlusCircle className="size-3.5" />
          {label}
        </Badge>
      );
    case "unpaid":
      return result.overdue ? (
        <Badge variant="danger">
          <Clock className="size-3.5" />
          {label} · po splatnosti
        </Badge>
      ) : (
        <Badge variant="neutral">
          <CircleAlert className="size-3.5" />
          {label}
        </Badge>
      );
  }
}
