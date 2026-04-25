// ============================================================
// GET /api/ai/health
// Returns local AI runtime health, config, and usage stats.
// ============================================================

import { NextResponse } from "next/server";
import { checkAIHealth } from "@/lib/ai/client";
import { getAIUsageStats } from "@/lib/ai/rate-limiter";
import { DEFAULT_AI_CONFIG, loadAIConfig } from "@/lib/ai/config";
import { Collections, readCollection } from "@/lib/storage";
import { AIConfig, AIFailureKind, AITaskType } from "@/types";

export const dynamic = "force-dynamic";

interface AILogSnapshot {
  timestamp: string;
  taskType: string;
  success: boolean;
  fallbackUsed: boolean;
  failureKind?: AIFailureKind;
}

export async function GET() {
  try {
    const aiLogs = await readCollection<AILogSnapshot>(Collections.AI_LOG);
    const recentLogs = aiLogs.slice(-50);
    const timeoutsByTaskType = recentLogs.reduce(
      (acc, entry) => {
        if (entry.failureKind === "timeout") {
          const taskType = entry.taskType as AITaskType;
          acc[taskType] = (acc[taskType] || 0) + 1;
        }
        return acc;
      },
      {} as Partial<Record<AITaskType, number>>
    );

    const [health, usage, config] = await Promise.all([
      checkAIHealth(),
      getAIUsageStats(),
      loadAIConfig(),
    ]);

    return NextResponse.json({
      health,
      diagnostics: {
        recentCalls: recentLogs.length,
        recentFailures: recentLogs.filter((entry) => !entry.success).length,
        recentTimeouts: recentLogs.filter(
          (entry) => entry.failureKind === "timeout"
        ).length,
        recentFallbacks: recentLogs.filter((entry) => entry.fallbackUsed).length,
        timeoutsByTaskType,
      },
      usage,
      config: {
        provider: config.provider,
        mode: config.mode,
        enabled: config.enabled,
        baseUrl: config.baseUrl,
        compatibilityMode: config.compatibilityMode,
        model: config.model,
        fallbackModel: config.fallbackModel,
        maxCallsPerDay: config.maxCallsPerDay,
        maxCallsPerTaskType: config.maxCallsPerTaskType,
        taskSettings: config.taskSettings,
      },
    });
  } catch (err) {
    console.error("[api/ai/health] Error:", err);

    // Resolve the configured runtime so the failure response reflects
    // reality (ollama in local-only mode) instead of a hard-coded
    // gemini fallback that confuses the Settings UI.
    let config: AIConfig = DEFAULT_AI_CONFIG;
    try {
      config = await loadAIConfig();
    } catch (configErr) {
      console.warn(
        "[api/ai/health] loadAIConfig failed in catch path; using DEFAULT_AI_CONFIG",
        configErr
      );
    }

    return NextResponse.json(
      {
        health: {
          available: false,
          provider: config.provider,
          mode: config.mode,
          compatibilityMode: config.compatibilityMode,
          error: err instanceof Error ? err.message : "Unknown error",
          checkedAt: new Date().toISOString(),
          endpoint: config.baseUrl || config.provider,
          primaryModel: config.model,
          fallbackModel: config.fallbackModel,
          responseTimeMs: null,
          availableModels: [],
          configuredTasks: [],
        },
        diagnostics: {
          recentCalls: 0,
          recentFailures: 0,
          recentTimeouts: 0,
          recentFallbacks: 0,
          timeoutsByTaskType: {},
        },
      },
      { status: 500 }
    );
  }
}
