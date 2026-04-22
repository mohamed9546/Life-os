import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center">
        <span className="text-text-tertiary text-xl font-mono">404</span>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Page not found</h2>
        <p className="text-sm text-text-secondary mt-1">
          This page doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Link href="/overview" className="btn-primary btn-sm">
        Go to Overview
      </Link>
    </div>
  );
}
