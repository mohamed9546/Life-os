interface ScoreBarProps {
  score: number; // 0-100
  label: string;
  colorClass?: string;
}

function getScoreColor(score: number): string {
  if (score >= 70) return "bg-success";
  if (score >= 40) return "bg-warning";
  return "bg-danger";
}

export function ScoreBar({ score, label, colorClass }: ScoreBarProps) {
  const color = colorClass || getScoreColor(score);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-primary font-mono">{score}</span>
      </div>
      <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}