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
  via: "vs" | "message" | "manual";
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

/** Parametry, podle kterých se hledá nejpodobnější faktura. */
export type SuggestionParam = "amount" | "currency" | "customer" | "vs" | "date";

export const SUGGESTION_PARAM_LABELS: Record<SuggestionParam, string> = {
  amount: "částka",
  currency: "měna",
  customer: "odběratel",
  vs: "VS / číslo faktury",
  date: "datum",
};

export const SUGGESTION_PARAM_COUNT = 5;
/** Návrh se zobrazí, jen když sedí většina parametrů (3 z 5). */
export const SUGGESTION_MIN_MATCHES = 3;

export interface Suggestion {
  invoice: Invoice;
  matched: SuggestionParam[];
}

export interface UnmatchedPayment {
  payment: Payment;
  reason: string;
  suggestion: Suggestion | null;
}

/** Ruční spárování: id platby → id faktury. */
export type ManualPairs = Record<string, string>;

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
  manual: ManualPairs = {},
): MatchResult {
  const byId = new Map(invoices.map((inv) => [inv.id, inv]));
  const byVs = new Map<string, Invoice>();
  for (const inv of invoices) {
    const vs = normalizeVs(inv.vs);
    if (vs && !byVs.has(vs)) byVs.set(vs, inv);
  }

  const assigned = new Map<string, MatchedPayment[]>();
  const unmatched: Omit<UnmatchedPayment, "suggestion">[] = [];
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
    const manualInvoice = manual[p.id] ? byId.get(manual[p.id]!) : undefined;

    if (manualInvoice) {
      // 0. Ručně spárovaná platba má přednost.
      invoice = manualInvoice;
      via = "manual";
    } else if (vs) {
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

  const remaining = new Map(results.map((r) => [r.invoice.id, -r.difference]));
  const unmatchedWithSuggestions: UnmatchedPayment[] = unmatched.map((u) => ({
    ...u,
    suggestion: suggestInvoice(u.payment, invoices, remaining),
  }));

  return {
    invoices: results,
    unmatched: unmatchedWithSuggestions,
    ignored,
    summary: { counts, overdueUnpaid, owed },
  };
}

/* ---------- Návrh faktury pro nespárovanou platbu ---------- */

const LEGAL_FORMS = new Set(["sro", "as", "spol", "vos", "ks", "zs", "ops"]);

function nameTokens(name: string): string[] {
  return normalizeHeader(name)
    .replace(/s\.\s*r\.\s*o\.?/g, " sro ")
    .replace(/a\.\s*s\.?/g, " as ")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !LEGAL_FORMS.has(t));
}

/** Název protiúčtu odpovídá odběrateli, když obsahuje aspoň polovinu jeho slov. */
export function similarName(accountName: string, customer: string): boolean {
  const a = new Set(nameTokens(accountName));
  const c = nameTokens(customer);
  if (a.size === 0 || c.length === 0) return false;
  const hits = c.filter((t) => a.has(t)).length;
  return hits * 2 >= c.length;
}

/** VS se liší nejvýš o jednu číslici (překlep, prohozené sousední číslice, chybějící/navíc číslice). */
export function similarVs(a: string, b: string): boolean {
  const x = normalizeVs(a);
  const y = normalizeVs(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (Math.abs(x.length - y.length) > 1) return false;
  // Damerau–Levenshtein (optimal string alignment) ≤ 1
  const d: number[][] = Array.from({ length: x.length + 1 }, (_, i) =>
    Array.from({ length: y.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }
  return d[x.length]![y.length]! <= 1;
}

const DAY = 24 * 60 * 60 * 1000;
/** Platba „sedí datem", když přišla od vystavení faktury do 60 dnů po splatnosti. */
const DATE_TOLERANCE_DAYS = 60;

function dateFits(payment: Payment, invoice: Invoice): boolean {
  if (!payment.date) return false;
  const t = payment.date.getTime();
  const from = invoice.issueDate ?? (invoice.dueDate ? new Date(invoice.dueDate.getTime() - 30 * DAY) : null);
  const to = invoice.dueDate ?? invoice.issueDate;
  if (!from || !to) return false;
  return t >= from.getTime() && t <= to.getTime() + DATE_TOLERANCE_DAYS * DAY;
}

function referenceFits(payment: Payment, invoice: Invoice): boolean {
  if (similarVs(payment.vs, invoice.vs)) return true;
  const msg = payment.message.toUpperCase().replace(/\s+/g, "");
  if (invoice.number && msg.includes(invoice.number.toUpperCase().replace(/\s+/g, ""))) return true;
  return (payment.message.match(/\d+/g) ?? []).some((n) => similarVs(n, invoice.vs));
}

/**
 * Najde fakturu, u které sedí většina parametrů (částka, měna, odběratel, VS, datum).
 * Měna musí sedět vždy – platbu v jiné měně nelze k faktuře připočíst.
 * @param remaining zbývající dlužná částka podle id faktury (haléře)
 */
export function suggestInvoice(
  payment: Payment,
  invoices: Invoice[],
  remaining: Map<string, number> = new Map(),
): Suggestion | null {
  let best: { s: Suggestion; score: number } | null = null;

  for (const invoice of invoices) {
    if (invoice.currency !== payment.currency) continue;
    const left = remaining.get(invoice.id) ?? invoice.amount;
    const matched: SuggestionParam[] = [];
    if (payment.amount === invoice.amount || (left > 0 && payment.amount === left)) matched.push("amount");
    matched.push("currency");
    if (similarName(payment.accountName, invoice.customer)) matched.push("customer");
    if (referenceFits(payment, invoice)) matched.push("vs");
    if (dateFits(payment, invoice)) matched.push("date");

    if (matched.length < SUGGESTION_MIN_MATCHES) continue;
    // Pořadí: počet shod, pak faktury, které ještě nejsou uhrazené.
    const score = matched.length * 10 + (left > 0 ? 1 : 0);
    if (!best || score > best.score) best = { s: { invoice, matched }, score };
  }
  return best?.s ?? null;
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
