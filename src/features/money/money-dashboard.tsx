"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Transaction } from "@/types";
import { StatusBadge } from "@/components/status-badge";
import { SpendingCharts } from "./spending-charts";
import { BudgetPlanner } from "./budget-planner";
import { NetWorth } from "./net-worth";
import { RunwayCalculator } from "./runway-calculator";
import { SubscriptionTracker } from "./subscription-tracker";
import { NetWorthProjection } from "./net-worth-projection";
import { BudgetRuleEngine } from "./budget-rule-engine";

type MoneyTab = "overview" | "charts" | "budget" | "networth" | "runway" | "subscriptions" | "projection" | "rules";
const MONEY_TABS: { id: MoneyTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "charts", label: "Charts" },
  { id: "budget", label: "Budget" },
  { id: "rules", label: "Rules" },
  { id: "networth", label: "Net Worth" },
  { id: "runway", label: "Runway" },
  { id: "subscriptions", label: "Subs" },
  { id: "projection", label: "Projection" },
];

interface MoneyReviewEntry {
  id: string;
  review: {
    data: {
      narrativeSummary: string;
      recurringCommitments: string[];
      unusualSpikes: string[];
      monthlyAdjustments: string[];
      stabilityWarning: string;
      confidence: number;
    };
  };
  createdAt: string;
}

interface MoneyResponse {
  transactions: Transaction[];
  summary: {
    totalSpend: number;
    totalIncome: number;
    netFlow: number;
    uncategorizedCount: number;
    topCategories: Array<{ category: string; total: number }>;
    recurringMerchants: Array<{ merchant: string; count: number; total: number }>;
    unusualSpikes: Array<{ merchant: string; amount: number; average: number }>;
    lowConfidenceTransactions: Array<{
      id: string;
      description: string;
      amount: number;
      confidence: number;
    }>;
    stabilityWarning: string | null;
    recommendedAdjustments: string[];
  };
  latestReview: MoneyReviewEntry | null;
  reviewHistory: MoneyReviewEntry[];
}

const INITIAL_FORM = {
  date: new Date().toISOString().slice(0, 10),
  description: "",
  amount: "",
  currency: "GBP",
};

export function MoneyDashboard() {
  const [activeTab, setActiveTab] = useState<MoneyTab>("overview");
  const [data, setData] = useState<MoneyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editState, setEditState] = useState<
    Record<string, { merchantCleaned: string; category: string; saveRule: boolean }>
  >({});

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/money");
      const payload = (await response.json()) as MoneyResponse | { error?: string };
      if (!response.ok || !("transactions" in payload)) {
        throw new Error(("error" in payload && payload.error) || "Failed to load money data");
      }
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load money data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const reviewQueue = useMemo(() => {
    const queued = data?.transactions.filter((transaction) => {
      const confidence = transaction.aiCategorization?.data.confidence ?? 0;
      return !transaction.category || !transaction.merchantCleaned || confidence < 0.7;
    });
    return queued?.slice(0, 8) || [];
  }, [data]);

  const submit = async () => {
    if (!form.description.trim() || !form.amount.trim()) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/money", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          description: form.description.trim(),
          amount: parseFloat(form.amount),
          currency: form.currency,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save transaction");
      }
      setForm(INITIAL_FORM);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save transaction");
    } finally {
      setSaving(false);
    }
  };

  const categorizeAll = async () => {
    setCategorizing(true);
    setError(null);
    try {
      const response = await fetch("/api/money/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to categorize transactions");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to categorize transactions");
    } finally {
      setCategorizing(false);
    }
  };

  const handleReceiptUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";
    if (!file) return;

    setOcrLoading(true);
    setOcrError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await fetch("/api/ai/vision-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });
      const data = (await response.json()) as { merchant?: string; amount?: number; date?: string; error?: string };

      if (!response.ok || data.error) {
        throw new Error(data.error || "Receipt OCR failed");
      }

      setForm((current) => ({
        ...current,
        ...(data.merchant ? { description: data.merchant } : {}),
        ...(data.amount != null ? { amount: String(data.amount) } : {}),
        ...(data.date ? { date: data.date } : {}),
      }));
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "Receipt scan failed");
    } finally {
      setOcrLoading(false);
    }
  };

  const generateReview = async () => {
    setReviewing(true);
    setError(null);
    try {
      const response = await fetch("/api/money/review", { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to generate money review");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate money review");
    } finally {
      setReviewing(false);
    }
  };

  const applyReview = async (transaction: Transaction) => {
    const state = editState[transaction.id] || {
      merchantCleaned:
        transaction.merchantCleaned ||
        transaction.aiCategorization?.data.merchantCleaned ||
        "",
      category:
        transaction.category || transaction.aiCategorization?.data.category || "Uncategorized",
      saveRule: true,
    };

    setUpdatingId(transaction.id);
    setError(null);

    try {
      const response = await fetch("/api/money", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: transaction.id,
          merchantCleaned: state.merchantCleaned,
          category: state.category,
          saveRule: state.saveRule,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update transaction");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update transaction");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="card text-center py-12">
        <StatusBadge status="running" label="Loading money workspace..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 bg-surface-2 rounded-xl p-1">
        {MONEY_TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-fit py-2 px-2 rounded-lg text-xs font-semibold transition-all ${activeTab === tab.id ? "bg-surface-0 text-text-primary shadow-sm" : "text-text-tertiary hover:text-text-primary"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "charts" && <SpendingCharts transactions={data?.transactions ?? []} />}
      {activeTab === "budget" && <BudgetPlanner />}
      {activeTab === "networth" && <NetWorth />}
      {activeTab === "rules" && <BudgetRuleEngine />}
      {activeTab === "runway" && <RunwayCalculator />}
      {activeTab === "subscriptions" && <SubscriptionTracker transactions={data?.transactions ?? []} />}
      {activeTab === "projection" && <NetWorthProjection />}


      {activeTab === "overview" && <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SummaryCard label="Total spend" value={`GBP ${data?.summary.totalSpend.toFixed(2) || "0.00"}`} />
        <SummaryCard label="Total income" value={`GBP ${data?.summary.totalIncome.toFixed(2) || "0.00"}`} />
        <SummaryCard
          label="Net flow"
          value={`GBP ${data?.summary.netFlow.toFixed(2) || "0.00"}`}
          tone={(data?.summary.netFlow || 0) >= 0 ? "text-success" : "text-danger"}
        />
      </div>

      <section className="card space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              AI money review
            </h2>
            <p className="text-sm text-text-secondary mt-2">
              Generate a structured spending review with recurring commitments, unusual spikes, monthly adjustments, and a stability warning.
            </p>
          </div>
          <button className="btn-primary btn-sm w-full sm:w-auto" onClick={generateReview} disabled={reviewing}>
            {reviewing ? "Generating..." : "Generate money review"}
          </button>
        </div>

        {data?.latestReview ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-lg bg-accent-subtle px-4 py-3">
              <p className="text-xs font-semibold text-accent mb-1">Narrative summary</p>
              <p className="text-sm text-text-primary">
                {data.latestReview.review.data.narrativeSummary}
              </p>
            </div>
            <div className="space-y-3">
              <InfoList title="Recurring commitments" items={data.latestReview.review.data.recurringCommitments} empty="No recurring commitments yet." />
              <InfoList title="Unusual spikes" items={data.latestReview.review.data.unusualSpikes} empty="No unusual spikes highlighted." />
              <InfoList title="Monthly adjustments" items={data.latestReview.review.data.monthlyAdjustments} empty="No monthly adjustments suggested yet." />
              <div className="rounded-lg bg-warning/10 px-4 py-3">
                <p className="text-xs font-semibold text-warning mb-1">Stability warning</p>
                <p className="text-sm text-text-primary">
                  {data.latestReview.review.data.stabilityWarning}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-surface-3 px-4 py-5 text-sm text-text-secondary">
            No money review yet. Generate one after importing or adding some transactions.
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <section className="card space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                Transaction intake
              </h2>
              <p className="text-sm text-text-secondary mt-2">
                Add transactions manually, then let the local AI categorize merchants and spending.
              </p>
            </div>
            <button
              className="btn-secondary btn-sm w-full sm:w-auto"
              onClick={categorizeAll}
              disabled={categorizing}
            >
              {categorizing ? "Categorizing..." : "Categorize uncategorized"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input
                className="input"
                type="date"
                value={form.date}
                onChange={(event) =>
                  setForm((current) => ({ ...current, date: event.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Amount</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(event) =>
                  setForm((current) => ({ ...current, amount: event.target.value }))
                }
                placeholder="-48.32"
              />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <input
              className="input"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="TESCO EXTRA GLASGOW 2841"
            />
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button className="btn-primary" onClick={submit} disabled={saving}>
              {saving ? "Saving..." : "Add transaction"}
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm flex items-center gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={ocrLoading}
              title="Scan receipt with AI"
            >
              {ocrLoading ? (
                <span className="animate-spin inline-block w-3 h-3 border border-current border-t-transparent rounded-full" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              {ocrLoading ? "Scanning..." : "Scan receipt"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleReceiptUpload}
            />
            {ocrError && (
              <span className="text-2xs text-error">{ocrError}</span>
            )}
            {!ocrError && (
              <span className="text-2xs text-text-tertiary">
                {data?.summary.uncategorizedCount || 0} uncategorized transactions
              </span>
            )}
          </div>
        </section>

        <section className="card space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            Review queue
          </h2>
          {reviewQueue.length === 0 ? (
            <p className="text-sm text-text-secondary">
              No low-confidence or uncategorized transactions need review right now.
            </p>
          ) : (
            reviewQueue.map((transaction) => {
              const state = editState[transaction.id] || {
                merchantCleaned:
                  transaction.merchantCleaned ||
                  transaction.aiCategorization?.data.merchantCleaned ||
                  "",
                category:
                  transaction.category ||
                  transaction.aiCategorization?.data.category ||
                  "Uncategorized",
                saveRule: true,
              };

              return (
                <div key={transaction.id} className="rounded-lg bg-surface-2 px-4 py-3">
                  <p className="text-sm font-medium text-text-primary">{transaction.description}</p>
                  <p className="text-2xs text-text-tertiary mt-1">
                    GBP {transaction.amount.toFixed(2)} • AI confidence{" "}
                    {Math.round((transaction.aiCategorization?.data.confidence ?? 0) * 100)}%
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <input
                      className="input"
                      value={state.merchantCleaned}
                      onChange={(event) =>
                        setEditState((current) => ({
                          ...current,
                          [transaction.id]: {
                            ...state,
                            merchantCleaned: event.target.value,
                          },
                        }))
                      }
                      placeholder="Merchant"
                    />
                    <input
                      className="input"
                      value={state.category}
                      onChange={(event) =>
                        setEditState((current) => ({
                          ...current,
                          [transaction.id]: {
                            ...state,
                            category: event.target.value,
                          },
                        }))
                      }
                      placeholder="Category"
                    />
                  </div>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="flex items-center gap-2 text-xs text-text-secondary">
                      <input
                        type="checkbox"
                        checked={state.saveRule}
                        onChange={(event) =>
                          setEditState((current) => ({
                            ...current,
                            [transaction.id]: {
                              ...state,
                              saveRule: event.target.checked,
                            },
                          }))
                        }
                      />
                      Reuse this cleanup for similar merchants
                    </label>
                    <button
                      className="btn-primary btn-sm w-full sm:ml-auto sm:w-auto"
                      onClick={() => void applyReview(transaction)}
                      disabled={updatingId !== null}
                    >
                      {updatingId === transaction.id ? "Applying..." : "Apply review"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <section className="card">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
          Transaction ledger
        </h2>
        <div className="space-y-3 mt-4">
          {(data?.transactions || []).length === 0 ? (
            <p className="text-sm text-text-secondary">
              No transactions yet. Add a few rows to start building AI money insight.
            </p>
          ) : (
            data!.transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex flex-col gap-3 rounded-lg bg-surface-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm text-text-primary font-medium">
                    {transaction.merchantCleaned ||
                      transaction.aiCategorization?.data.merchantCleaned ||
                      transaction.description}
                  </p>
                  <p className="text-2xs text-text-tertiary mt-1">
                    {new Date(transaction.date).toLocaleDateString("en-GB")} | {transaction.description}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    <span className="badge-neutral">
                      {transaction.category ||
                        transaction.aiCategorization?.data.category ||
                        "Uncategorized"}
                    </span>
                    {transaction.aiCategorization?.meta && (
                      <span className="badge-neutral">
                        AI {(transaction.aiCategorization.meta.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
                <p
                  className={`self-start text-sm font-semibold sm:self-auto ${
                    transaction.amount >= 0 ? "text-success" : "text-text-primary"
                  }`}
                >
                  GBP {transaction.amount.toFixed(2)}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
      </>}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
        {label}
      </p>
      <p className={`text-2xl font-bold mt-3 ${tone || "text-text-primary"}`}>{value}</p>
    </div>
  );
}

function InfoList({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-text-secondary">{empty}</p>
      ) : (
        <ul className="space-y-2 text-sm text-text-secondary">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="rounded-lg bg-surface-2 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
