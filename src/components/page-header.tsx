import { HeroPanel, StatusChip } from "@/components/ui/system";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date());

  return (
    <div className="mb-8">
      <HeroPanel
        title={title}
        description={subtitle}
        eyebrow="Personal Life OS"
        actions={actions}
        meta={
          <>
            <StatusChip tone="neutral">{today}</StatusChip>
            <StatusChip tone="info">AI-native workspace</StatusChip>
            <StatusChip tone="success">Structured operating mode</StatusChip>
          </>
        }
      />
    </div>
  );
}
