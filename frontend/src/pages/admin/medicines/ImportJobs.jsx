import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, History, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { adminApi, showApiError } from "@/lib/adminApi";

const STATUS_BADGE = {
  completed: "bg-emerald-100 text-emerald-700",
  partial: "bg-amber-100 text-amber-700",
  failed: "bg-rose-100 text-rose-700",
  running: "bg-sky-100 text-sky-700",
  aborted_errors: "bg-rose-100 text-rose-700",
};

export default function ImportJobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState(null);

  useEffect(() => {
    adminApi.imports.list()
      .then(setJobs)
      .catch((err) => { setJobs([]); showApiError(err, "Failed to load jobs"); });
  }, []);

  return (
    <div className="mx-auto max-w-5xl" data-testid="med-import-jobs">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => navigate("/admin/medicines")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">
            <History className="mr-1.5 h-3 w-3" /> Import history
          </Badge>
          <h1 className="font-display mt-1 text-2xl font-bold">Past medicine imports</h1>
        </div>
      </div>

      <Card className="mt-6 rounded-3xl">
        <CardContent className="p-0">
          {jobs === null && (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {jobs && jobs.length === 0 && (
            <div className="p-10 text-center text-muted-foreground">
              No imports yet. <Link to="/admin/medicines/import" className="text-[#0F4C3A] underline">Run your first import</Link>.
            </div>
          )}
          {jobs && jobs.length > 0 && (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3 text-right">Created</th>
                  <th className="px-4 py-3 text-right">Updated</th>
                  <th className="px-4 py-3 text-right">Errored</th>
                  <th className="px-4 py-3">By</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-t border-border" data-testid={`med-import-job-${j.id}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{j.file_name || "upload.xlsx"}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{j.id}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(j.started_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">{j.created ?? 0}</td>
                    <td className="px-4 py-3 text-right font-semibold text-sky-700">{j.updated ?? 0}</td>
                    <td className="px-4 py-3 text-right font-semibold text-rose-700">{j.errored ?? 0}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{j.started_by_email || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge className={`rounded-full ${STATUS_BADGE[j.status] || "bg-muted text-muted-foreground"} hover:${STATUS_BADGE[j.status] || "bg-muted"}`}>
                        {j.status === "completed" ? <CheckCircle2 className="mr-1 h-3 w-3 inline" /> :
                         j.status === "partial" || j.status === "failed" || j.status === "aborted_errors" ? <AlertTriangle className="mr-1 h-3 w-3 inline" /> :
                         null}
                        {j.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
