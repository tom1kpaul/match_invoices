/** Načte CSV soubor jako text. */
export async function readCsvFile(file: File): Promise<string> {
  return decodeCsvBytes(await file.arrayBuffer());
}

/** Převede bajty na text; české banky často exportují ve windows-1250, proto záložní dekódování. */
export function decodeCsvBytes(buffer: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1250").decode(buffer);
  }
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
