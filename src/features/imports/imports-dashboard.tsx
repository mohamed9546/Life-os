"use client";

import { useEffect, useState } from "react";
import { ImportRecord } from "@/types";
import { StatusBadge } from "@/components/status-badge";

interface ImportsResponse {
  records: ImportRecord[];
  summary: {
    inboxJobs: number;
    trackedJobs: number;
    transactions: number;
    routines: number;
  };
}

export function ImportsDashboard() {
  const [data, setData] = useState<ImportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobJson, setJobJson] = useState("");
  const [jobText, setJobText] = useState("");
  const [transactionInput, setTransactionInput] = useState("");
  const [transactionFormat, setTransactionFormat] = useState<"csv" | "json">("csv");
  const [previewInput, setPreviewInput] = useState("");
  const [previewResults, setPreviewResults] = useState<
    Array<{ type: string; confidence: number; summary: string; destination: string }>
  >([]);
  const [activeAction, setActiveAction] = useState<
    "jobs-json" | "jobs-text" | "transactions" | "cv-upload" | "preview" | null
  >(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/imports");
      const payload = (await response.json()) as ImportsResponse | { error?: string };
      if (!response.ok || !("records" in payload)) {
        throw new Error(("error" in payload && payload.error) || "Failed to load imports");
      }
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load imports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const runJobImport = async (mode: "json" | "text") => {
    const input = mode === "json" ? jobJson : jobText;
    if (!input.trim()) {
      return;
    }

    setActiveAction(mode === "json" ? "jobs-json" : "jobs-text");
    setError(null);
    try {
      const response = await fetch("/api/imports/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, input }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Job import failed");
      }

      if (mode === "json") {
        setJobJson("");
      } else {
        setJobText("");
      }

      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Job import failed");
    } finally {
      setActiveAction(null);
    }
  };

  const runTransactionImport = async () => {
    if (!transactionInput.trim()) {
      return;
    }

    setActiveAction("transactions");
    setError(null);
    try {
      const response = await fetch("/api/imports/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: transactionFormat,
          input: transactionInput,
          runAI: true,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Transaction import failed");
      }

      setTransactionInput("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction import failed");
    } finally {
      setActiveAction(null);
    }
  };

  const runPreview = async () => {
    if (!previewInput.trim()) {
      return;
    }

    setActiveAction("preview");
    setError(null);
    try {
      const response = await fetch("/api/imports/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: previewInput }),
      });
      const payload = (await response.json()) as
        | { previews?: Array<{ type: string; confidence: number; summary: string; destination: string }>; error?: string }
        | { error?: string };
      if (!response.ok || !("previews" in payload)) {
        throw new Error(("error" in payload && payload.error) || "Preview failed");
      }
      setPreviewResults(payload.previews || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setActiveAction(null);
    }
  };

  const uploadCv = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    setActiveAction("cv-upload");
    setError(null);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      const response = await fetch("/api/profile/import-cv", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "CV import failed");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "CV import failed");
    } finally {
      setActiveAction(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="card text-center py-12">
        <StatusBadge status="running" label="Loading imports..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard label="Inbox jobs" value={String(data?.summary.inboxJobs || 0)} />
        <SummaryCard label="Tracked jobs" value={String(data?.summary.trackedJobs || 0)} />
        <SummaryCard label="Transactions" value={String(data?.summary.transactions || 0)} />
        <SummaryCard label="Routines" value={String(data?.summary.routines || 0)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="card space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Import jobs from JSON
            </h2>
            <p className="text-sm text-text-secondary mt-2">
              Paste an array of structured job objects and push them straight into the Career inbox.
            </p>
          </div>
          <textarea
            className="textarea min-h-[18rem]"
            value={jobJson}
            onChange={(event) => setJobJson(event.target.value)}
            placeholder='[{"title":"Clinical Research Associate","company":"Example Pharma","location":"Glasgow","link":"https://example.com/job"}]'
          />
          <button
            className="btn-primary"
            onClick={() => void runJobImport("json")}
            disabled={activeAction !== null}
          >
            {activeAction === "jobs-json" ? "Importing..." : "Import JSON jobs"}
          </button>
        </section>

        <section className="card space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Paste raw job text or alert batches
            </h2>
            <p className="text-sm text-text-secondary mt-2">
              Paste a full job description, recruiter email, or LinkedIn alert batch and let the local AI route it into Career.
            </p>
          </div>
          <textarea
            className="textarea min-h-[18rem]"
            value={jobText}
            onChange={(event) => setJobText(event.target.value)}
            placeholder="Paste a job description, recruiter note, or alert email here..."
          />
          <button
            className="btn-primary"
            onClick={() => void runJobImport("text")}
            disabled={activeAction !== null}
          >
            {activeAction === "jobs-text" ? "Processing..." : "Process pasted job text"}
          </button>
        </section>
      </div>

      <section className="card space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              CV import and mixed-text routing
            </h2>
            <p className="text-sm text-text-secondary mt-2">
              Upload CV PDFs into your candidate profile draft, or preview how pasted mixed text should route across Career, Decisions, and Money.
            </p>
          </div>
          <label className="btn-secondary btn-sm cursor-pointer">
            {activeAction === "cv-upload" ? "Importing..." : "Import CV PDFs"}
            <input
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(event) => void uploadCv(event.target.files)}
            />
          </label>
        </div>

        <textarea
          className="textarea min-h-[12rem]"
          value={previewInput}
          onChange={(event) => setPreviewInput(event.target.value)}
          placeholder="Paste recruiter email, decision notes, or mixed job alert text here..."
        />
        <button
          className="btn-primary"
          onClick={() => void runPreview()}
          disabled={activeAction !== null}
        >
          {activeAction === "preview" ? "Previewing..." : "Preview routing"}
        </button>

        {previewResults.length > 0 && (
          <div className="space-y-3">
            {previewResults.map((item, index) => (
              <div key={`${item.type}-${index}`} className="rounded-lg bg-surface-2 px-4 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="badge-neutral">{item.type}</span>
                  <span className="badge-neutral">
                    confidence {Math.round(item.confidence * 100)}%
                  </span>
                  <span className="text-2xs text-text-tertiary">{item.destination}</span>
                </div>
                <p className="text-sm text-text-secondary mt-2">{item.summary}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Import bank data
            </h2>
            <p className="text-sm text-text-secondary mt-2">
              Paste CSV or JSON transactions. The import can immediately AI-categorize the first batch so Money gets useful data fast.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`btn-sm ${transactionFormat === "csv" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setTransactionFormat("csv")}
            >
              CSV
            </button>
            <button
              className={`btn-sm ${transactionFormat === "json" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setTransactionFormat("json")}
            >
              JSON
            </button>
          </div>
        </div>
        <textarea
          className="textarea min-h-[14rem]"
          value={transactionInput}
          onChange={(event) => setTransactionInput(event.target.value)}
          placeholder={
            transactionFormat === "csv"
              ? "date,description,amount,currency\n2026-04-20,TESCO EXTRA GLASGOW,-48.32,GBP"
              : '[{"date":"2026-04-20","description":"TESCO EXTRA GLASGOW","amount":-48.32,"currency":"GBP"}]'
          }
        />
        <button
          className="btn-primary"
          onClick={runTransactionImport}
          disabled={activeAction !== null}
        >
          {activeAction === "transactions" ? "Importing..." : "Import transactions"}
        </button>
      </section>

      {error && <p className="text-sm text-danger">{error}</p>}

      <section className="card">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
          Import activity
        </h2>
        <div className="space-y-3 mt-4">
          {(data?.records || []).length === 0 ? (
            <p className="text-sm text-text-secondary">
              No imports yet. Start by pasting jobs or transactions above.
            </p>
          ) : (
            data!.records.map((record) => (
              <div
                key={record.id}
                className="rounded-lg bg-surface-2 px-4 py-3 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={record.status} />
                    <span className="badge-neutral">{record.type}</span>
                  </div>
                  <p className="text-sm text-text-primary font-medium mt-2">{record.label}</p>
                  <p className="text-2xs text-text-tertiary mt-1">
                    {new Date(record.createdAt).toLocaleString("en-GB")}
                  </p>
                  {record.summary && (
                    <p className="text-sm text-text-secondary mt-2">{record.summary}</p>
                  )}
                </div>
                <div className="text-right text-2xs text-text-tertiary">
                  <p>Received {record.counts.received}</p>
                  <p>Imported {record.counts.imported}</p>
                  <p>Failed {record.counts.failed}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
        {label}
      </p>
      <p className="text-2xl font-bold mt-3 text-text-primary">{value}</p>
    </div>
  );
}
