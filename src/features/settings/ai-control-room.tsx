"use client";

import { useEffect, useMemo, useState } from "react";
import { AIConfig, AITaskType } from "@/types";
import { useAIHealth } from "@/hooks/use-ai-health";
import { useApi } from "@/hooks/use-api";

export function AIControlRoom() {
  const aiConfigApi = useApi<AIConfig>();
  const {
    health,
    diagnostics,
    usage,
    refresh,
    loading: healthLoading,
    error: healthError,
  } = useAIHealth();
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [testResult, setTestResult] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    aiConfigApi.call("/api/ai/config").then((data) => {
      if (data) {
        setConfig(data);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const taskEntries = useMemo(
    () =>
      config
        ? (Object.entries(config.taskSettings) as Array<
            [AITaskType, AIConfig["taskSettings"][AITaskType]]
          >)
        : [],
    [config]
  );

  const updateConfig = (patch: Partial<AIConfig>) => {
    if (!config) return;
    setConfig({ ...config, ...patch });
  };

  const updateTask = (
    taskType: AITaskType,
    patch: Partial<AIConfig["taskSettings"][AITaskType]>
  ) => {
    if (!config) return;
    setConfig({
      ...config,
      taskSettings: {
        ...config.taskSettings,
        [taskType]: {
          ...config.taskSettings[taskType],
          ...patch,
        },
      },
    });
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setSaveMessage("");
    const result = await aiConfigApi.call("/api/ai/config", {
      method: "PUT",
      body: JSON.stringify(config),
    });
    setSaving(false);

    if (result) {
      setConfig(result);
      setSaveMessage("Local AI config saved");
      refresh();
      setTimeout(() => setSaveMessage(""), 3000);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult("");

    try {
      const response = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setTestResult(data.error || `HTTP ${response.status}`);
      } else {
        setTestResult(data.data?.message || "AI test completed");
      }
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : "AI test failed");
    } finally {
      setTesting(false);
      refresh();
    }
  };

  if (!config) {
    return (
      <section className="card text-center py-12">
        <p className="text-sm text-text-secondary">
          {aiConfigApi.loading ? "Loading local AI config..." : aiConfigApi.error || "Unable to load local AI config."}
        </p>
      </section>
    );
  }

  return (
    <section className="card space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            AI control room
          </h2>
          <p className="text-sm text-text-secondary mt-2 max-w-2xl">
            The laptop runtime is now optimized for low-latency structured tasks and manual
            control. Heavy always-on automation belongs on a backend runtime, not inside
            the local interactive loop.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary btn-sm" onClick={refresh} disabled={healthLoading}>
            {healthLoading ? "Checking..." : "Health check"}
          </button>
          <button className="btn-secondary btn-sm" onClick={runTest} disabled={testing}>
            {testing ? "Testing..." : "Test prompt"}
          </button>
          <button className="btn-primary btn-sm" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save AI config"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="rounded-xl border border-surface-3 bg-card-gradient p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
            Live default
          </p>
          <p className="text-lg font-semibold text-text-primary mt-3">{config.model || "—"}</p>
          <p className="text-sm text-text-secondary mt-2">
            Standard app flows should stay on the compact model for predictable latency and
            fewer local memory failures.
          </p>
        </div>

        <div className="rounded-xl border border-surface-3 bg-surface-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
            Split runtime
          </p>
          <p className="text-sm text-text-secondary mt-3 leading-6">
            Laptop: UI, local development, manual control, private AI usage. Backend:
            source ingestion, schedules, queues, browser automation, webhooks, and reliable
            worker execution.
          </p>
        </div>

        <div className="rounded-xl border border-surface-3 bg-surface-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
            Model inventory
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(health?.availableModels || []).length > 0 ? (
              (health?.availableModels || []).map((model) => (
                <span key={model} className="badge-neutral font-mono">
                  {model}
                </span>
              ))
            ) : (
              <span className="text-sm text-text-secondary">No models discovered yet.</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-sm">
        <RuntimeStat
          label="Runtime status"
          value={
            health?.available
              ? `Online${health.responseTimeMs ? ` (${health.responseTimeMs}ms)` : ""}`
              : health?.error || "Offline"
          }
        />
        <RuntimeStat
          label="Provider mode"
          value={`${config.provider}/${config.compatibilityMode}`}
        />
        <RuntimeStat
          label="Calls today"
          value={`${usage?.totalCalls ?? 0} / ${config.maxCallsPerDay}`}
        />
        <RuntimeStat
          label="Models discovered"
          value={`${health?.availableModels.length ?? 0}`}
        />
        <RuntimeStat
          label="Recent timeouts"
          value={`${diagnostics?.recentTimeouts ?? 0}`}
        />
        <RuntimeStat
          label="Recent fallbacks"
          value={`${diagnostics?.recentFallbacks ?? 0}`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Provider</label>
          <select
            className="input"
            value={config.provider}
            onChange={(event) => {
              const provider = event.target.value as AIConfig["provider"];
              updateConfig({ provider, mode: provider === "gemini" ? "cloud" : "local" });
            }}
          >
            <option value="gemini">Gemini (Google AI)</option>
            <option value="ollama">Ollama (local)</option>
          </select>
        </div>
        {config.provider === "gemini" ? (
          <div>
            <label className="label">Gemini API key</label>
            <input
              className="input"
              type="password"
              placeholder="Set via GEMINI_API_KEY env var or enter here"
              value={config.apiKey || ""}
              onChange={(event) => updateConfig({ apiKey: event.target.value || null })}
            />
          </div>
        ) : (
          <div>
            <label className="label">Base URL</label>
            <input
              className="input"
              value={config.baseUrl}
              onChange={(event) => updateConfig({ baseUrl: event.target.value })}
            />
          </div>
        )}
        {config.provider === "ollama" && (
          <div>
            <label className="label">Compatibility mode</label>
            <select
              className="input"
              value={config.compatibilityMode}
              onChange={(event) =>
                updateConfig({
                  compatibilityMode: event.target.value as AIConfig["compatibilityMode"],
                })
              }
            >
              <option value="ollama">Ollama native</option>
              <option value="openai">OpenAI-compatible</option>
              <option value="anthropic">Anthropic-compatible</option>
            </select>
          </div>
        )}
        <div>
          <label className="label">Primary model</label>
          <input
            className="input"
            value={config.model}
            onChange={(event) => updateConfig({ model: event.target.value })}
          />
        </div>
        <div>
          <label className="label">Fallback model</label>
          <input
            className="input"
            value={config.fallbackModel || ""}
            onChange={(event) =>
              updateConfig({ fallbackModel: event.target.value || null })
            }
          />
        </div>
        <div>
          <label className="label">Request timeout (ms)</label>
          <input
            className="input"
            type="number"
            value={config.timeoutMs}
            onChange={(event) =>
              updateConfig({ timeoutMs: parseInt(event.target.value || "0", 10) })
            }
          />
        </div>
        <div>
          <label className="label">Retry attempts</label>
          <input
            className="input"
            type="number"
            min="0"
            value={config.retryAttempts}
            onChange={(event) =>
              updateConfig({
                retryAttempts: parseInt(event.target.value || "0", 10),
              })
            }
          />
        </div>
        <div>
          <label className="label">Default max tokens</label>
          <input
            className="input"
            type="number"
            value={config.maxTokens}
            onChange={(event) =>
              updateConfig({ maxTokens: parseInt(event.target.value || "0", 10) })
            }
          />
        </div>
        <div>
          <label className="label">Daily AI limit</label>
          <input
            className="input"
            type="number"
            value={config.maxCallsPerDay}
            onChange={(event) =>
              updateConfig({
                maxCallsPerDay: parseInt(event.target.value || "0", 10),
              })
            }
          />
        </div>
        <div>
          <label className="label">Per-task daily limit</label>
          <input
            className="input"
            type="number"
            value={config.maxCallsPerTaskType}
            onChange={(event) =>
              updateConfig({
                maxCallsPerTaskType: parseInt(event.target.value || "0", 10),
              })
            }
          />
        </div>
      </div>

      <div className="rounded-xl border border-surface-3 bg-surface-2 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-text-primary">Runtime toggle</h3>
            <p className="text-xs text-text-secondary mt-1">
              Disable this only when you want the deterministic layer to keep running
              without local AI calls.
            </p>
          </div>
          <button
            className={`btn-sm ${config.enabled ? "btn-primary" : "btn-secondary"}`}
            onClick={() => updateConfig({ enabled: !config.enabled })}
          >
            {config.enabled ? "AI enabled" : "AI disabled"}
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            Task matrix
          </h3>
          <p className="text-xs text-text-secondary">
            Every task stays schema-driven, time-bounded, and independently controllable.
          </p>
        </div>
        <div className="space-y-3 mt-4">
          {taskEntries.map(([taskType, taskConfig]) => (
            <div
              key={taskType}
              className="rounded-lg border border-surface-3 bg-surface-2 p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {taskConfig.label}
                  </p>
                  <p className="text-2xs text-text-tertiary mt-1 font-mono">
                    {taskType}
                  </p>
                  <p className="text-2xs text-text-tertiary mt-1">
                    Recent timeouts: {diagnostics?.timeoutsByTaskType?.[taskType] ?? 0}
                  </p>
                  <p className="text-2xs text-text-tertiary mt-1">
                    Structured JSON output with graceful fallback behavior is expected for this task.
                  </p>
                </div>
                <button
                  className={`btn-sm ${taskConfig.enabled ? "btn-primary" : "btn-secondary"}`}
                  onClick={() =>
                    updateTask(taskType, { enabled: !taskConfig.enabled })
                  }
                >
                  {taskConfig.enabled ? "Enabled" : "Disabled"}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="label">Task model override</label>
                  <input
                    className="input"
                    value={taskConfig.model || ""}
                    placeholder={config.model}
                    onChange={(event) =>
                      updateTask(taskType, {
                        model: event.target.value || undefined,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="label">Fallback model override</label>
                  <input
                    className="input"
                    value={taskConfig.fallbackModel || ""}
                    placeholder={config.fallbackModel || "No fallback"}
                    onChange={(event) =>
                      updateTask(taskType, {
                        fallbackModel: event.target.value || null,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="label">Timeout (ms)</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={taskConfig.timeoutMs ?? config.timeoutMs}
                    onChange={(event) =>
                      updateTask(taskType, {
                        timeoutMs: parseInt(event.target.value || "0", 10),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="label">Retry attempts</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={taskConfig.retryAttempts ?? config.retryAttempts}
                    onChange={(event) =>
                      updateTask(taskType, {
                        retryAttempts: parseInt(event.target.value || "0", 10),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="label">Temperature</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={taskConfig.temperature}
                    onChange={(event) =>
                      updateTask(taskType, {
                        temperature: parseFloat(event.target.value || "0"),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="label">Max tokens</label>
                  <input
                    className="input"
                    type="number"
                    value={taskConfig.maxTokens}
                    onChange={(event) =>
                      updateTask(taskType, {
                        maxTokens: parseInt(event.target.value || "0", 10),
                      })
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {(saveMessage || testResult || aiConfigApi.error || healthError) && (
        <div className="space-y-2 text-sm">
          {saveMessage && <p className="text-success">{saveMessage}</p>}
          {testResult && (
            <p className={testResult === "AI is operational" ? "text-success" : "text-text-secondary"}>
              {testResult}
            </p>
          )}
          {aiConfigApi.error && <p className="text-danger">{aiConfigApi.error}</p>}
          {healthError && <p className="text-danger">{healthError}</p>}
        </div>
      )}
    </section>
  );
}

function RuntimeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-surface-3 bg-surface-2 px-4 py-3">
      <p className="text-xs text-text-tertiary">{label}</p>
      <p className="text-sm font-medium text-text-primary mt-2 break-all">{value}</p>
    </div>
  );
}
