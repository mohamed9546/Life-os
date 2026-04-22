function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

interface DailyRecord {
  date: string;
  calls: Record<string, number>;
}

export class CallBudget {
  private daily: DailyRecord = { date: todayUtc(), calls: {} };

  constructor(
    private readonly dailyLimit: number,
    private readonly perEndpointLimits: Record<string, number> = {}
  ) {}

  canCall(endpoint: string): { allowed: boolean; reason?: string } {
    this.rollover();
    const total = Object.values(this.daily.calls).reduce((a, b) => a + b, 0);
    if (total >= this.dailyLimit) {
      return { allowed: false, reason: `daily limit ${this.dailyLimit} reached (${total} calls today)` };
    }
    const perLimit = this.perEndpointLimits[endpoint];
    if (perLimit !== undefined && (this.daily.calls[endpoint] ?? 0) >= perLimit) {
      return { allowed: false, reason: `${endpoint} limit ${perLimit} reached` };
    }
    return { allowed: true };
  }

  record(endpoint: string): void {
    this.rollover();
    this.daily.calls[endpoint] = (this.daily.calls[endpoint] ?? 0) + 1;
  }

  stats(): { date: string; total: number; byEndpoint: Record<string, number> } {
    this.rollover();
    return {
      date: this.daily.date,
      total: Object.values(this.daily.calls).reduce((a, b) => a + b, 0),
      byEndpoint: { ...this.daily.calls },
    };
  }

  private rollover(): void {
    const today = todayUtc();
    if (this.daily.date !== today) {
      this.daily = { date: today, calls: {} };
    }
  }
}
