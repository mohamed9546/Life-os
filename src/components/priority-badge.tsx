import { PriorityBand } from "@/types";

interface PriorityBadgeProps {
  band: PriorityBand;
}

const BAND_CLASSES: Record<PriorityBand, string> = {
  high: "badge-high",
  medium: "badge-medium",
  low: "badge-low",
  reject: "badge-reject",
};

export function PriorityBadge({ band }: PriorityBadgeProps) {
  return <span className={BAND_CLASSES[band]}>{band.toUpperCase()}</span>;
}