import { useId, useRef } from "react";
import { CheckCircle2, FileSpreadsheet, TriangleAlert, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface LoadedFile {
  name: string;
  count: number;
  warnings: string[];
}

interface UploadCardProps {
  step: number;
  title: string;
  description: string;
  buttonLabel: string;
  countLabel: (n: number) => string;
  loaded: LoadedFile | null;
  error: string | null;
  onFile: (file: File) => void;
}

export function UploadCard({
  step,
  title,
  description,
  buttonLabel,
  countLabel,
  loaded,
  error,
  onFile,
}: UploadCardProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card transition-colors",
        loaded && !error && "border-success/30",
        error && "border-destructive/40",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold leading-7">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pl-10">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
        <Button variant={loaded ? "outline" : "default"} onClick={() => inputRef.current?.click()}>
          <Upload />
          {loaded ? "Nahrát jiný soubor" : buttonLabel}
        </Button>

        {loaded && !error && (
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 shrink-0 text-success" />
            <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{loaded.name}</span>
            <span className="shrink-0 text-muted-foreground">· {countLabel(loaded.count)}</span>
          </div>
        )}
      </div>

      {error && (
        <p className="ml-10 flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {loaded && !error && loaded.warnings.length > 0 && (
        <details className="ml-10 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
          <summary className="cursor-pointer font-medium">
            Upozornění při načítání ({loaded.warnings.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {loaded.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
