import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2,
  Loader2, ListChecks,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { adminApi, showApiError } from "@/lib/adminApi";

export default function MedicineImport() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [schema, setSchema] = useState(null);
  const [file, setFile] = useState(null);
  const [dryRun, setDryRun] = useState(null);
  const [busy, setBusy] = useState(false);
  const [committed, setCommitted] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    adminApi.imports.schema().then(setSchema).catch(() => {});
  }, []);

  const reset = () => {
    setFile(null); setDryRun(null); setCommitted(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onChooseFile = useCallback(async (f) => {
    if (!f) return;
    const ok = /\.(xlsx|xlsm|csv|tsv)$/i.test(f.name);
    if (!ok) {
      toast.error("Please upload an .xlsx, .csv, or .tsv file");
      return;
    }
    setFile(f); setDryRun(null); setCommitted(null);
    setBusy(true);
    try {
      const r = await adminApi.imports.dryRun(f);
      setDryRun(r);
    } catch (err) {
      showApiError(err, "Failed to validate file");
    } finally {
      setBusy(false);
    }
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onChooseFile(f);
  };

  const commit = async (skipErrors) => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await adminApi.imports.commit(file, { skipErrors });
      setCommitted(r);
      if (r.status === "aborted_errors") {
        toast.error("Import aborted because of validation errors");
      } else {
        toast.success(`Imported — ${r.created} created, ${r.updated} updated, ${r.errored} errored`);
      }
    } catch (err) {
      showApiError(err, "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl" data-testid="med-import">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => navigate("/admin/medicines")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">Bulk import</Badge>
          <h1 className="font-display mt-1 text-2xl font-bold">Import medicines</h1>
          <p className="text-sm text-muted-foreground">
            Upload an Excel or CSV sheet. We&apos;ll validate every row before committing changes.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="rounded-3xl lg:col-span-2">
          <CardContent className="p-6">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 text-center transition-colors ${
                dragOver ? "border-[#0F4C3A] bg-[#0F4C3A]/5" : "border-border bg-muted/30"
              }`}
              data-testid="med-import-dropzone"
            >
              <FileSpreadsheet className="h-10 w-10 text-[#0F4C3A]" />
              <h2 className="font-display mt-3 text-lg font-semibold">
                {file ? file.name : "Drag & drop your file here"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">.xlsx, .xlsm or .csv · up to 25MB · max 10,000 rows</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xlsm,.csv,.tsv"
                  className="hidden"
                  onChange={(e) => onChooseFile(e.target.files?.[0])}
                  data-testid="med-import-file-input"
                />
                <Button
                  type="button"
                  className="rounded-full bg-[#0F4C3A] hover:bg-[#0F4C3A]/90"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="med-import-choose"
                >
                  <Upload className="mr-1.5 h-4 w-4" /> Choose file
                </Button>
                <Button asChild type="button" variant="outline" className="rounded-full" data-testid="med-import-template">
                  <a href={adminApi.imports.templateUrl()}>
                    <Download className="mr-1.5 h-4 w-4" /> Download template
                  </a>
                </Button>
                {file && (
                  <Button type="button" variant="ghost" className="rounded-full" onClick={reset} data-testid="med-import-reset">
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* Dry-run results */}
            {busy && !dryRun && (
              <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Validating rows…
              </div>
            )}
            {dryRun && !committed && (
              <DryRunReport dryRun={dryRun} onCommit={commit} busy={busy} />
            )}
            {committed && (
              <CommitReport committed={committed} onAgain={reset} />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardContent className="p-6">
            <h3 className="font-display flex items-center gap-2 text-lg font-semibold">
              <ListChecks className="h-4 w-4 text-[#0F4C3A]" /> Column reference
            </h3>
            <p className="text-xs text-muted-foreground">Headers in your file must match these names (case-insensitive).</p>
            <ScrollArea className="mt-3 h-[440px] pr-2">
              <ul className="space-y-2">
                {(schema?.columns || []).map((c) => (
                  <li key={c.name} className="rounded-2xl border border-border bg-card p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-[12px] font-semibold">{c.name}</code>
                      {c.required && (
                        <Badge className="rounded-full bg-rose-100 text-[10px] text-rose-700 hover:bg-rose-100">required</Badge>
                      )}
                      <Badge className="rounded-full bg-muted text-[10px] text-muted-foreground hover:bg-muted">{c.type}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{c.description}</div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const DryRunReport = ({ dryRun, onCommit, busy }) => {
  const { summary, rows, truncated } = dryRun;
  const errors = rows.filter((r) => r.action === "error");
  return (
    <div className="mt-6 space-y-4" data-testid="med-import-dryrun">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total" value={summary.total} />
        <Stat label="To create" value={summary.will_create} accent />
        <Stat label="To update" value={summary.will_update} info />
        <Stat label="Errors" value={summary.errors} warn={summary.errors > 0} />
      </div>

      {errors.length > 0 && (
        <Card className="rounded-2xl border-amber-300 bg-amber-50">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
              <AlertTriangle className="h-4 w-4" /> {errors.length} row{errors.length === 1 ? "" : "s"} have problems
            </div>
            <ScrollArea className="max-h-48">
              <ul className="space-y-1 text-xs">
                {errors.slice(0, 60).map((r) => (
                  <li key={r.row_index} className="rounded-md bg-white/70 px-2 py-1">
                    <span className="font-mono">row {r.row_index}</span>
                    {r.name ? <> — <strong>{r.name}</strong></> : null}
                    <span className="ml-1 text-amber-700">— {r.errors.join("; ")}</span>
                  </li>
                ))}
                {errors.length > 60 && (
                  <li className="text-amber-700">… and {errors.length - 60} more</li>
                )}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Row</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Composition</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-right">Stock</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 100).map((r) => (
              <tr key={r.row_index} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{r.row_index}</td>
                <td className="px-3 py-2">
                  <ActionBadge action={r.action} />
                </td>
                <td className="px-3 py-2">{r.name || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.composition || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.category || "—"}</td>
                <td className="px-3 py-2 text-right">{r.price ?? "—"}</td>
                <td className="px-3 py-2 text-right">{r.stock ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {truncated && (
          <div className="border-t border-border bg-muted/30 p-2 text-center text-xs text-muted-foreground">
            Showing first 100 of {summary.total} rows. Errors are listed in full above.
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {summary.errors > 0 && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onCommit(false)}
            data-testid="med-import-commit-abort-on-error"
          >
            Import only if zero errors
          </Button>
        )}
        <Button
          type="button"
          disabled={busy || (summary.will_create === 0 && summary.will_update === 0)}
          className="bg-[#0F4C3A] hover:bg-[#0F4C3A]/90"
          onClick={() => onCommit(true)}
          data-testid="med-import-commit"
        >
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
          Commit ({summary.will_create + summary.will_update} rows)
        </Button>
      </div>
    </div>
  );
};

const CommitReport = ({ committed, onAgain }) => (
  <div className="mt-6 space-y-4" data-testid="med-import-commit-result">
    <Card className="rounded-2xl border-emerald-200 bg-emerald-50">
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
            <h3 className="font-semibold">Import {committed.status}</h3>
          </div>
          <p className="text-sm text-emerald-800">
            {committed.created} created · {committed.updated} updated · {committed.errored} errored
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onAgain} variant="outline" className="rounded-full" data-testid="med-import-again">
            Import another file
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
);

const ActionBadge = ({ action }) => {
  if (action === "create") return <Badge className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100">create</Badge>;
  if (action === "update") return <Badge className="rounded-full bg-sky-100 text-sky-700 hover:bg-sky-100">update</Badge>;
  if (action === "error") return <Badge className="rounded-full bg-rose-100 text-rose-700 hover:bg-rose-100">error</Badge>;
  return <Badge className="rounded-full bg-muted text-muted-foreground hover:bg-muted">{action}</Badge>;
};

const Stat = ({ label, value, accent, info, warn }) => (
  <div
    className={`rounded-2xl border px-4 py-3 ${
      accent ? "border-emerald-200 bg-emerald-50" :
      info ? "border-sky-200 bg-sky-50" :
      warn ? "border-rose-200 bg-rose-50" :
      "border-border bg-card"
    }`}
  >
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="font-display text-xl font-bold">{value ?? 0}</div>
  </div>
);
