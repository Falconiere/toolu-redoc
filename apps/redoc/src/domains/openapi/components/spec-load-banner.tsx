/** Signal failure / missing-source banner: `dot | message | action`. */

import type { SpecLoadError, SpecLoadRecovery } from "../api/spec-load-error";

/** Props for {@link SpecLoadBanner}. */
export type SpecLoadBannerProps = {
  message: string;
  /** Status tone for the border and dot — danger for failures. */
  tone?: "danger" | "idle";
  recovery?: SpecLoadRecovery;
  onPaste?: () => void;
  onRetry?: () => void;
};

/** Banner grid with optional Paste / Retry recovery action. */
export function SpecLoadBanner({
  message,
  tone = "danger",
  recovery,
  onPaste,
  onRetry,
}: SpecLoadBannerProps) {
  const border = tone === "danger" ? "border-danger" : "border-border";
  const dot = tone === "danger" ? "bg-danger" : "bg-idle";
  const action = recoveryAction(recovery, onPaste, onRetry);

  return (
    <div
      role="alert"
      className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 border bg-surface px-3 py-2 ${border}`}
    >
      <span aria-hidden className={`size-(--spacing-status-dot) rounded-full ${dot}`} />
      <p className="type-body-sm text-text">{message}</p>
      {action}
    </div>
  );
}

/** Build a failure banner from a structured {@link SpecLoadError}. */
export function SpecLoadErrorBanner({
  error,
  onPaste,
  onRetry,
}: {
  error: SpecLoadError;
  onPaste?: () => void;
  onRetry?: () => void;
}) {
  return (
    <SpecLoadBanner
      message={error.message}
      tone="danger"
      {...(error.recovery === undefined ? {} : { recovery: error.recovery })}
      {...(onPaste === undefined ? {} : { onPaste })}
      {...(onRetry === undefined ? {} : { onRetry })}
    />
  );
}

function recoveryAction(
  recovery: SpecLoadRecovery | undefined,
  onPaste: (() => void) | undefined,
  onRetry: (() => void) | undefined,
) {
  if (recovery === "paste" && onPaste !== undefined) {
    return (
      <button
        type="button"
        className="type-button border border-danger px-3 py-1 text-text hover:border-accent active:translate-y-px duration-(--duration-hover)"
        onClick={onPaste}
      >
        Paste
      </button>
    );
  }
  if (recovery === "retry" && onRetry !== undefined) {
    return (
      <button
        type="button"
        className="type-button border border-danger px-3 py-1 text-text hover:border-accent active:translate-y-px duration-(--duration-hover)"
        onClick={onRetry}
      >
        Retry
      </button>
    );
  }
  return null;
}
