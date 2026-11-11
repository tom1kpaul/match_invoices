/**
 * Párování plateb – čistá logika bez UI.
 * Všechny částky jsou v haléřích (celá čísla), aby nevznikaly chyby zaokrouhlení.
 */

export type InvoiceStatus = "paid" | "partial" | "overpaid" | "unpaid";

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  paid: "Zaplaceno",
  partial: "Částečně zaplaceno",
  overpaid: "Přeplatek",
  unpaid: "Nezaplaceno",
};

export interface Invoice {
  id: string;
  number: string;
  customer: string;
  ico: string;
  issueDate: Date | null;
  dueDate: Date | null;
  amount: number;
  currency: string;
  vs: string;
  line: number;
}

export interface Payment {
  id: string;
  date: Date | null;
  amount: number;
  currency: string;
  account: string;
  accountName: string;
  vs: string;
  message: string;
  line: number;
}

export interface ParseResult<T> {
  items: T[];
  warnings: string[];
}

export interface MatchedPayment {
  payment: Payment;
  via: "vs" | "message";
}

export interface InvoiceResult {
  invoice: Invoice;
  payments: MatchedPayment[];
  paid: number;
  /** paid − amount: záporné = chybí, kladné = přeplatek */
  difference: number;
  status: InvoiceStatus;
  overdue: boolean;
  possibleDuplicate: boolean;
}

export interface UnmatchedPayment {
  payment: Payment;
  reason: string;
}

export interface MatchSummary {
  counts: Record<InvoiceStatus, number>;
  overdueUnpaid: number;
  owed: { currency: string; amount: number }[];
}

export interface MatchResult {
  invoices: InvoiceResult[];
  unmatched: UnmatchedPayment[];
  ignored: Payment[];
  summary: MatchSummary;
}

/* ---------- Parsování hodnot ---------- */

export function parseCsv(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field.trim() === "") {
      field = "";
      inQuotes = true;
    } else if (c === ";") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

/** „12 100,00" → 1210000 (haléře). Vrací null pro neplatnou hodnotu. */
export function parseAmount(raw: string): number | null {
  let s = (raw ?? "").trim().replace(/[\u2212\u2013]/g, "-");
  s = s.replace(/[\s\u00a0\u202f]/g, "").replace(/[^\d,.+-]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** „05.10.2026" → Date (místní půlnoc). */
export function parseDate(raw: string): Date | null {
  const m = (raw ?? "").trim().match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

/** Variabilní symbol: jen číslice, bez úvodních nul. */
export function normalizeVs(raw: string): string {
  return (raw ?? "").replace(/\D/g, "").replace(/^0+/, "");
}

function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCurrency(raw: string): string {
  const c = (raw ?? "").trim().toUpperCase();
  if (!c || c === "KČ" || c === "KC") return "CZK";
  return c;
}

function mapColumns<K extends string>(
  header: string[],
  columns: Record<K, string>,
): Record<K, number> {
  const normalized = header.map(normalizeHeader);
  const index = {} as Record<K, number>;
  const missing: string[] = [];
  for (const key of Object.keys(columns) as K[]) {
    const i = normalized.indexOf(normalizeHeader(columns[key]));
    if (i === -1) missing.push(columns[key]);
    index[key] = i;
  }
  if (missing.length > 0) {
    throw new Error(`V souboru chybí sloupce: ${missing.join(", ")}.`);
  }
  return index;
}

/* ---------- Načtení souborů ---------- */

export const INVOICE_COLUMNS = {
  number: "Číslo faktury",
  customer: "Odběratel",
  ico: "IČO",
  issueDate: "Datum vystavení",
  dueDate: "Datum splatnosti",
  amount: "Částka",
  currency: "Měna",
  vs: "Variabilní symbol",
} as const;

export const STATEMENT_COLUMNS = {
  date: "Datum",
  amount: "Částka",
  currency: "Měna",
  account: "Protiúčet",
  accountName: "Název protiúčtu",
  vs: "Variabilní symbol",
  message: "Zpráva pro příjemce",
} as const;

export function parseInvoicesCsv(text: string): ParseResult<Invoice> {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error("Soubor je prázdný.");
  const col = mapColumns(rows[0]!, INVOICE_COLUMNS);
  const items: Invoice[] = [];
  const warnings: string[] = [];

  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const get = (k: keyof typeof INVOICE_COLUMNS) => (r[col[k]] ?? "").trim();
    const amount = parseAmount(get("amount"));
    if (amount === null) {
      warnings.push(`Řádek ${line}: neplatná částka „${get("amount")}" – faktura přeskočena.`);
      return;
    }
    const dueDate = parseDate(get("dueDate"));
    if (!dueDate) warnings.push(`Řádek ${line}: neplatné datum splatnosti „${get("dueDate")}".`);
    const vs = get("vs");
    if (!normalizeVs(vs)) warnings.push(`Řádek ${line}: faktura ${get("number")} nemá variabilní symbol.`);
    items.push({
      id: `inv-${line}`,
      number: get("number"),
      customer: get("customer"),
      ico: get("ico"),
      issueDate: parseDate(get("issueDate")),
      dueDate,
      amount,
      currency: normalizeCurrency(get("currency")),
      vs,
      line,
    });
  });
  return { items, warnings };
}

export function parseStatementCsv(text: string): ParseResult<Payment> {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error("Soubor je prázdný.");
  const col = mapColumns(rows[0]!, STATEMENT_COLUMNS);
  const items: Payment[] = [];
  const warnings: string[] = [];

  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const get = (k: keyof typeof STATEMENT_COLUMNS) => (r[col[k]] ?? "").trim();
    const amount = parseAmount(get("amount"));
    if (amount === null) {
      warnings.push(`Řádek ${line}: neplatná částka „${get("amount")}" – platba přeskočena.`);
      return;
    }
    items.push({
      id: `pay-${line}`,
      date: parseDate(get("date")),
      amount,
      currency: normalizeCurrency(get("currency")),
      account: get("account"),
      accountName: get("accountName"),
      vs: get("vs"),
      message: get("message"),
      line,
    });
  });
  return { items, warnings };
}

/* ---------- Párování ---------- */

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function matchPayments(
  invoices: Invoice[],
  payments: Payment[],
  today: Date = new Date(),
): MatchResult {
  const byVs = new Map<string, Invoice>();
  for (const inv of invoices) {
    const vs = normalizeVs(inv.vs);
    if (vs && !byVs.has(vs)) byVs.set(vs, inv);
  }

  const assigned = new Map<string, MatchedPayment[]>();
  const unmatched: UnmatchedPayment[] = [];
  const ignored: Payment[] = [];

  for (const p of payments) {
    // 1. Odchozí platby a poplatky ignorujeme.
    if (p.amount <= 0) {
      ignored.push(p);
      continue;
    }

    let invoice: Invoice | undefined;
    let via: MatchedPayment["via"] = "vs";
    const vs = normalizeVs(p.vs);

    if (vs) {
      // 2. Párování podle variabilního symbolu.
      invoice = byVs.get(vs);
      if (!invoice) {
        unmatched.push({ payment: p, reason: "Variabilní symbol neodpovídá žádné faktuře" });
        continue;
      }
    } else {
      // 3. Bez VS – hledáme číslo VS ve zprávě pro příjemce.
      const candidates = p.message.match(/\d+/g) ?? [];
      for (const c of candidates) {
        const found = byVs.get(normalizeVs(c));
        if (found) {
          invoice = found;
          via = "message";
          break;
        }
      }
      if (!invoice) {
        unmatched.push({
          payment: p,
          reason: "Bez variabilního symbolu, ve zprávě nenalezen",
        });
        continue;
      }
    }

    if (invoice.currency !== p.currency) {
      unmatched.push({
        payment: p,
        reason: `Měna ${p.currency} neodpovídá faktuře ${invoice.number} (${invoice.currency})`,
      });
      continue;
    }

    const list = assigned.get(invoice.id) ?? [];
    list.push({ payment: p, via });
    assigned.set(invoice.id, list);
  }

  const todayStart = startOfDay(today);
  const counts: Record<InvoiceStatus, number> = { paid: 0, partial: 0, overpaid: 0, unpaid: 0 };
  const owedMap = new Map<string, number>();
  let overdueUnpaid = 0;

  const results: InvoiceResult[] = invoices.map((invoice) => {
    const matched = assigned.get(invoice.id) ?? [];
    // 4. Více plateb k jedné faktuře se sčítá.
    const paid = matched.reduce((sum, m) => sum + m.payment.amount, 0);
    const difference = paid - invoice.amount;

    let status: InvoiceStatus;
    if (paid === 0) status = "unpaid";
    else if (difference === 0) status = "paid";
    else if (difference < 0) status = "partial";
    else status = "overpaid";

    const overdue =
      difference < 0 && invoice.dueDate !== null && invoice.dueDate.getTime() < todayStart.getTime();

    const amountCounts = new Map<number, number>();
    for (const m of matched) {
      amountCounts.set(m.payment.amount, (amountCounts.get(m.payment.amount) ?? 0) + 1);
    }
    const possibleDuplicate =
      paid > invoice.amount && [...amountCounts.values()].some((n) => n >= 2);

    counts[status]++;
    if (status === "unpaid" && overdue) overdueUnpaid++;
    if (difference < 0) {
      owedMap.set(invoice.currency, (owedMap.get(invoice.currency) ?? 0) - difference);
    }

    return { invoice, payments: matched, paid, difference, status, overdue, possibleDuplicate };
  });

  const owed = [...owedMap.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => (a.currency === "CZK" ? -1 : b.currency === "CZK" ? 1 : a.currency.localeCompare(b.currency)));

  return { invoices: results, unmatched, ignored, summary: { counts, overdueUnpaid, owed } };
}

/* ---------- Formátování ---------- */

export function formatMoney(halere: number, currency: string): string {
  const value = halere / 100;
  try {
    return new Intl.NumberFormat("cs-CZ", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 2 }).format(value)} ${currency}`;
  }
}

export function formatDate(d: Date | null): string {
  if (!d) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}
