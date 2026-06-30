interface StepIndicatorProps {
  state: "pending" | "active" | "done";
  icon: string;
  label: string;
}

export function StepIndicator({ state, icon, label }: StepIndicatorProps) {
  const barColor =
    state === "done"
      ? "bg-tx-success-text"
      : state === "active"
        ? "bg-primary"
        : "bg-surface-border";
  const barWidth = state === "done" ? "w-full" : state === "active" ? "w-1/2" : "w-0";
  const iconColor =
    state === "done"
      ? "text-tx-success-text"
      : state === "active"
        ? "text-primary"
        : "text-text-muted";
  const displayIcon = state === "done" ? "check_circle" : icon;

  return (
    <div className="w-[136px] md:w-auto md:flex-1">
      <div className="h-1 w-full rounded-full bg-surface-border">
        <div
          className={`h-1 rounded-full transition-all duration-500 ${barColor} ${barWidth}`}
        />
      </div>
      <div className="mt-2 flex items-center justify-center gap-1">
        <span
          aria-hidden="true"
          className={`material-icons text-[16px]! ${iconColor} ${state === "active" ? "animate-spin motion-reduce:animate-none" : ""}`}
        >
          {displayIcon}
        </span>
        <span
          className={`font-mulish text-[10px] font-bold tracking-[1px] ${iconColor}`}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

export interface ProgressStep {
  key: string;
  icon: string;
  label: string;
}

interface ProgressTrackerProps {
  currentStep: string;
  steps: ProgressStep[];
}

export function ProgressTracker({ currentStep, steps }: ProgressTrackerProps) {
  function stateFor(target: ProgressStep): "pending" | "active" | "done" {
    if (currentStep === "idle" || currentStep === "error") return "pending";
    const currentIdx = steps.findIndex((s) => s.key === currentStep);
    const targetIdx = steps.findIndex((s) => s.key === target.key);
    if (currentIdx > targetIdx) return "done";
    if (currentIdx === targetIdx) {
      // Last step (confirmed) goes straight to "done"
      return targetIdx === steps.length - 1 ? "done" : "active";
    }
    return "pending";
  }

  return (
    <div
      className="flex w-full flex-col items-center gap-3 md:flex-row md:items-start md:gap-3"
      role="status"
      aria-live="polite"
    >
      {steps.map((step) => (
        <StepIndicator
          key={step.key}
          state={stateFor(step)}
          icon={step.icon}
          label={step.label}
        />
      ))}
    </div>
  );
}
