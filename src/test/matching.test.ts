import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatMoney,
  matchesFilter,
  matchPayments,
  normalizeVs,
  parseAmount,
  parseCsv,
  parseDate,
  parseInvoicesCsv,
  parseStatementCsv,
  plural,
  similarName,
  similarVs,
  type Invoice,
  type Payment,
} from "@/lib/matching";
import { SAMPLE_INVOICES_CSV, SAMPLE_STATEMENT_CSV } from "@/lib/sample-data";

const TODAY = new Date(2026, 10, 11);

function inv(vs: string, amount: number, due = "01.12.2026"): Invoice {
  return {
    id: `inv-${vs}`,
    number: `FV${vs}`,
    customer: "Firma",
    ico: "1",
    issueDate: null,
    dueDate: parseDate(due),
    amount,
    currency: "CZK",
    vs,
    line: 1,
  };
}

let seq = 0;
function pay(amount: number, vs = "", message = ""): Payment {
  seq++;
  return {
    id: `p${seq}`,
    date: null,
    amount,
    currency: "CZK",
    account: "",
    accountName: "",
    vs,
    message,
    line: seq,
  };
}

describe("formát CSV", () => {
  it("čte částku s mezerou jako oddělovačem tisíců a desetinnou čárkou", () => {
    expect(parseAmount("12 100,00")).toBe(1210000);
    expect(parseAmount("-250,00")).toBe(-25000);
  });

  it("čte datum ve formátu DD.MM.RRRR", () => {
    expect(parseDate("05.10.2026")?.getTime()).toBe(new Date(2026, 9, 5).getTime());
    expect(parseDate("31.02.2026")).toBeNull();
  });
});

describe("pravidla párování", () => {
  it("ignoruje záporné částky", () => {
    const r = matchPayments([inv("1", 10000)], [pay(-10000, "1")], TODAY);
    expect(r.ignored).toHaveLength(1);
    expect(r.invoices[0]!.status).toBe("unpaid");
  });

  it("páruje podle variabilního symbolu", () => {
    const r = matchPayments([inv("2026001", 1210000)], [pay(1210000, "2026001")], TODAY);
    expect(r.invoices[0]!.status).toBe("paid");
  });

  it("bez VS najde variabilní symbol ve zprávě pro příjemce", () => {
    const r = matchPayments([inv("2026008", 50000)], [pay(50000, "", "Úhrada VS 2026008")], TODAY);
    expect(r.invoices[0]!.status).toBe("paid");
    expect(r.invoices[0]!.payments[0]!.via).toBe("message");
  });

  it("sčítá více plateb k jedné faktuře", () => {
    const r = matchPayments([inv("5", 847000)], [pay(400000, "5"), pay(447000, "5")], TODAY);
    expect(r.invoices[0]!.paid).toBe(847000);
    expect(r.invoices[0]!.status).toBe("paid");
  });

  it("částečně zaplaceno ukazuje, kolik chybí", () => {
    const r = matchPayments([inv("3", 4598000)], [pay(3000000, "3")], TODAY);
    expect(r.invoices[0]!.status).toBe("partial");
    expect(r.invoices[0]!.difference).toBe(-1598000);
  });

  it("přeplatek ukazuje, o kolik", () => {
    const r = matchPayments([inv("4", 302500)], [pay(325000, "4")], TODAY);
    expect(r.invoices[0]!.status).toBe("overpaid");
    expect(r.invoices[0]!.difference).toBe(22500);
  });

  it("nezaplacená faktura po splatnosti je označena", () => {
    const r = matchPayments([inv("6", 100, "29.10.2026"), inv("7", 100, "30.11.2026")], [], TODAY);
    expect(r.invoices[0]!.overdue).toBe(true);
    expect(r.invoices[1]!.overdue).toBe(false);
    expect(r.summary.overdueUnpaid).toBe(1);
  });

  it("upozorní na možnou duplicitní platbu", () => {
    const r = matchPayments([inv("8", 968000)], [pay(968000, "8"), pay(968000, "8")], TODAY);
    expect(r.invoices[0]!.possibleDuplicate).toBe(true);
    expect(r.invoices[0]!.status).toBe("overpaid");
  });

  it("dvě stejné platby, které fakturu nepřeplatí, nejsou duplicita", () => {
    const r = matchPayments([inv("9", 200000)], [pay(100000, "9"), pay(100000, "9")], TODAY);
    expect(r.invoices[0]!.possibleDuplicate).toBe(false);
    expect(r.invoices[0]!.status).toBe("paid");
  });

  it("platby bez faktury jsou mezi nespárovanými", () => {
    const r = matchPayments([inv("10", 100)], [pay(500000, "2026099"), pay(150000, "", "Děkujeme")], TODAY);
    expect(r.unmatched).toHaveLength(2);
  });
});

describe("jedna platba za více faktur", () => {
  it("dva VS ve zprávě – platba se rozdělí a obě faktury jsou zaplacené", () => {
    const r = matchPayments(
      [inv("11", 484000), inv("12", 726000)],
      [pay(1210000, "", "Faktury 11 a 12")],
      TODAY,
    );
    expect(r.invoices.map((i) => i.status)).toEqual(["paid", "paid"]);
    expect(r.invoices[0]!.payments[0]!.amount).toBe(484000);
    expect(r.invoices[1]!.payments[0]!.amount).toBe(726000);
    expect(r.invoices[0]!.payments[0]!.sharedWith).toEqual(["FV12"]);
    expect(r.unmatched).toHaveLength(0);
  });

  it("nižší platba zaplatí první fakturu, u druhé chybí zbytek", () => {
    const r = matchPayments([inv("11", 484000), inv("12", 726000)], [pay(1000000, "", "11, 12")], TODAY);
    expect(r.invoices[0]!.status).toBe("paid");
    expect(r.invoices[1]!.status).toBe("partial");
    expect(r.invoices[1]!.difference).toBe(-210000);
  });

  it("přeplatek připadne poslední faktuře ze zprávy", () => {
    const r = matchPayments([inv("11", 484000), inv("12", 726000)], [pay(1300000, "", "12 a 11")], TODAY);
    expect(r.invoices[1]!.status).toBe("paid");
    expect(r.invoices[0]!.status).toBe("overpaid");
    expect(r.invoices[0]!.difference).toBe(90000);
  });

  it("VS v kolonce a další VS ve zprávě", () => {
    const r = matchPayments([inv("11", 484000), inv("12", 726000)], [pay(1210000, "11", "a také 12")], TODAY);
    expect(r.invoices.map((i) => i.status)).toEqual(["paid", "paid"]);
    expect(r.invoices[0]!.payments[0]!.via).toBe("vs");
  });

  it("započte dřívější zálohu, i když je ve výpisu až za společnou platbou", () => {
    const r = matchPayments(
      [inv("11", 484000), inv("12", 726000)],
      [pay(926000, "", "11 + 12"), pay(284000, "11", "záloha")],
      TODAY,
    );
    // na FV11 zbývalo 2 000 Kč, zbytek 7 260 Kč šel na FV12
    expect(r.invoices.map((i) => i.status)).toEqual(["paid", "paid"]);
  });
});

describe("ruční spárování s nejpodobnější fakturou", () => {
  function full(over: Partial<Payment>): Payment {
    return { ...pay(605000, "2026060", "Faktura listopad"), ...over };
  }
  const invoice: Invoice = {
    ...inv("2026006", 605000, "30.11.2026"),
    customer: "Zahradnictví Kvítek",
    issueDate: parseDate("01.11.2026"),
  };

  it("navrhne fakturu, když sedí většina parametrů (3 z 5)", () => {
    const p = full({ accountName: "Jiná firma", date: parseDate("08.11.2026"), vs: "999" , message: "" });
    // sedí částka, měna, datum
    const r = matchPayments([invoice], [p], TODAY);
    expect(r.unmatched[0]!.suggestion?.invoice.id).toBe(invoice.id);
    expect(r.unmatched[0]!.suggestion?.matched).toEqual(["amount", "currency", "date"]);
  });

  it("nenavrhne fakturu, když sedí jen 2 z 5 parametrů", () => {
    const p = full({ amount: 150000, accountName: "Jiná firma", vs: "999", message: "", date: parseDate("08.11.2026") });
    const r = matchPayments([invoice], [p], TODAY);
    expect(r.unmatched[0]!.suggestion).toBeNull();
  });

  it("nenavrhne fakturu v jiné měně", () => {
    const p = full({ currency: "EUR", accountName: "Zahradnictví Kvítek", date: parseDate("08.11.2026") });
    const r = matchPayments([invoice], [p], TODAY);
    expect(r.unmatched[0]!.suggestion).toBeNull();
  });

  it("VS s prohozenými číslicemi se počítá jako shoda", () => {
    const p = full({ accountName: "Zahradnictví Kvítek", date: parseDate("08.11.2026") });
    const r = matchPayments([invoice], [p], TODAY);
    expect(r.unmatched[0]!.suggestion?.matched).toEqual(["amount", "currency", "customer", "vs", "date"]);
  });

  it("ručně spárovaná platba se započítá do faktury", () => {
    const p = full({});
    const r = matchPayments([invoice], [p], TODAY, { [p.id]: invoice.id });
    expect(r.unmatched).toHaveLength(0);
    expect(r.invoices[0]!.status).toBe("paid");
    expect(r.invoices[0]!.payments[0]!.via).toBe("manual");
  });
});

describe("ukázková data", () => {
  it("dává očekávaný souhrn", () => {
    const invoices = parseInvoicesCsv(SAMPLE_INVOICES_CSV).items;
    const payments = parseStatementCsv(SAMPLE_STATEMENT_CSV).items;
    const r = matchPayments(invoices, payments, TODAY);
    expect(r.summary.counts).toEqual({ paid: 5, partial: 1, overpaid: 2, unpaid: 2 });
    expect(r.summary.overdueUnpaid).toBe(1);
    expect(r.unmatched).toHaveLength(3);
    expect(r.unmatched.map((u) => u.suggestion?.invoice.number ?? null)).toEqual([
      null,
      null,
      "FV2026006",
    ]);
    expect(r.ignored).toHaveLength(2);
    // 15 980 + 18 150 + 6 050
    expect(r.summary.owed).toEqual([{ currency: "CZK", amount: 4018000 }]);
  });
});

describe("čtení CSV", () => {
  it("středník uvnitř uvozovek nerozdělí sloupec, zdvojené uvozovky jsou znak \"", () => {
    const rows = parseCsv('a;"b;c";"řekl ""ahoj"""\r\n\r\nd;e\r\n');
    expect(rows).toEqual([
      ["a", "b;c", 'řekl "ahoj"'],
      ["d", "e"],
    ]);
  });

  it("ignoruje BOM na začátku souboru", () => {
    expect(parseCsv("﻿a;b")).toEqual([["a", "b"]]);
  });

  it("čte různé zápisy částek", () => {
    expect(parseAmount("1 234,50")).toBe(123450); // nezlomitelná mezera
    expect(parseAmount("1.234,50")).toBe(123450); // tečka jako oddělovač tisíců
    expect(parseAmount("+500")).toBe(50000);
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });

  it("VS bez úvodních nul a jiných znaků", () => {
    expect(normalizeVs("0002026001")).toBe("2026001");
    expect(normalizeVs("VS: 2026 001")).toBe("2026001");
  });
});

describe("načtení souborů", () => {
  it("chybějící sloupce ohlásí srozumitelnou chybou", () => {
    expect(() => parseInvoicesCsv("Číslo faktury;Odběratel\nFV1;Firma")).toThrow(
      "V souboru chybí sloupce: IČO",
    );
  });

  it("prázdný soubor ohlásí chybou", () => {
    expect(() => parseStatementCsv("")).toThrow("Soubor je prázdný.");
  });

  it("pozná hlavičku bez diakritiky a malými písmeny, vadný řádek přeskočí", () => {
    const csv = [
      "cislo faktury;odberatel;ico;datum vystaveni;datum splatnosti;castka;mena;variabilni symbol",
      "FV1;Firma;1;01.11.2026;30.11.2026;1 000,00;Kč;1",
      "FV2;Firma;1;01.11.2026;30.11.2026;xyz;CZK;2",
    ].join("\n");
    const r = parseInvoicesCsv(csv);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]!.amount).toBe(100000);
    expect(r.items[0]!.currency).toBe("CZK"); // „Kč“ → CZK
    expect(r.warnings[0]).toContain("Řádek 3: neplatná částka");
  });
});

describe("další pravidla párování", () => {
  it("VS s úvodními nulami se spáruje", () => {
    const r = matchPayments([inv("2026001", 10000)], [pay(10000, "0002026001")], TODAY);
    expect(r.invoices[0]!.status).toBe("paid");
  });

  it("platba v jiné měně se nepřipočte", () => {
    const p = { ...pay(10000, "1"), currency: "EUR" };
    const r = matchPayments([inv("1", 10000)], [p], TODAY);
    expect(r.invoices[0]!.status).toBe("unpaid");
    expect(r.unmatched[0]!.reason).toBe("Měna EUR neodpovídá faktuře FV1 (CZK)");
  });

  it("ruční spárování má přednost před VS", () => {
    const p = pay(10000, "1");
    const r = matchPayments([inv("1", 10000), inv("2", 10000)], [p], TODAY, { [p.id]: "inv-2" });
    expect(r.invoices[0]!.status).toBe("unpaid");
    expect(r.invoices[1]!.status).toBe("paid");
  });

  it("neznámý VS v kolonce – zpráva se už neprohledává", () => {
    const r = matchPayments([inv("5", 10000)], [pay(10000, "999", "za fakturu 5")], TODAY);
    expect(r.invoices[0]!.status).toBe("unpaid");
    expect(r.unmatched[0]!.reason).toBe("Variabilní symbol neodpovídá žádné faktuře");
  });

  it("zaplacená nebo přeplacená faktura není po splatnosti", () => {
    const r = matchPayments(
      [inv("6", 10000, "01.10.2026"), inv("7", 10000, "01.10.2026")],
      [pay(10000, "6"), pay(20000, "7")],
      TODAY,
    );
    expect(r.invoices.map((i) => i.overdue)).toEqual([false, false]);
  });
});

describe("souhrn", () => {
  it("dlužnou částku počítá zvlášť pro každou měnu, CZK první", () => {
    const r = matchPayments(
      [{ ...inv("1", 5000), currency: "EUR" }, inv("2", 10000), inv("3", 20000)],
      [pay(5000, "3")],
      TODAY,
    );
    expect(r.summary.counts).toEqual({ paid: 0, partial: 1, overpaid: 0, unpaid: 2 });
    expect(r.summary.owed).toEqual([
      { currency: "CZK", amount: 25000 }, // 100 Kč + zbývajících 150 Kč
      { currency: "EUR", amount: 5000 },
    ]);
  });
});

describe("filtr faktur", () => {
  const r = matchPayments(
    [inv("1", 10000, "01.10.2026"), inv("2", 10000)],
    [pay(10000, "2"), pay(10000, "2")],
    TODAY,
  );
  const [overdue, duplicate] = r.invoices as [(typeof r.invoices)[0], (typeof r.invoices)[0]];

  it("„Vše“ ukáže všechny faktury", () => {
    expect(r.invoices.filter((i) => matchesFilter(i, "all"))).toHaveLength(2);
  });

  it("filtr podle stavu", () => {
    expect(matchesFilter(overdue, "unpaid")).toBe(true);
    expect(matchesFilter(duplicate, "unpaid")).toBe(false);
    expect(matchesFilter(duplicate, "overpaid")).toBe(true);
  });

  it("„Po splatnosti“ a „Možná duplicita“", () => {
    expect(matchesFilter(overdue, "overdue")).toBe(true);
    expect(matchesFilter(duplicate, "overdue")).toBe(false);
    expect(matchesFilter(duplicate, "duplicate")).toBe(true);
    expect(matchesFilter(overdue, "duplicate")).toBe(false);
  });
});

describe("podobnost pro návrhy", () => {
  it("jméno odběratele – právní forma se nepočítá", () => {
    expect(similarName("NOVÁK s.r.o.", "Kovářství Novák s.r.o.")).toBe(true);
    expect(similarName("Jan Svoboda", "Kovářství Novák s.r.o.")).toBe(false);
    expect(similarName("", "Firma")).toBe(false);
  });

  it("VS s jedním překlepem je podobný, se dvěma ne", () => {
    expect(similarVs("2026006", "2026060")).toBe(true); // prohozené číslice
    expect(similarVs("2026001", "202600")).toBe(true); // chybí číslice
    expect(similarVs("2026001", "2026099")).toBe(false); // dvě chyby
    expect(similarVs("2026001", "")).toBe(false);
  });
});

describe("formátování", () => {
  it("skloňuje počty", () => {
    expect(plural(1, "platba", "platby", "plateb")).toBe("1 platba");
    expect(plural(3, "platba", "platby", "plateb")).toBe("3 platby");
    expect(plural(0, "platba", "platby", "plateb")).toBe("0 plateb");
    expect(plural(5, "platba", "platby", "plateb")).toBe("5 plateb");
  });

  it("částku z haléřů zobrazí v korunách", () => {
    // Intl používá nezlomitelné mezery – pro porovnání je převedeme na obyčejné.
    const plain = (s: string) => s.replace(/\s/g, " ");
    expect(plain(formatMoney(1210000, "CZK"))).toBe("12 100,00 Kč");
    expect(plain(formatMoney(150000, "EUR"))).toBe("1 500,00 €");
  });

  it("datum ve formátu DD.MM.RRRR", () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe("05.01.2026");
    expect(formatDate(null)).toBe("—");
  });
});
