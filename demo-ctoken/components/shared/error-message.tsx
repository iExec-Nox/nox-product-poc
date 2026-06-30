interface ErrorMessageProps {
  error: string;
  onRetry: () => void;
  icon?: string;
}

export function ErrorMessage({ error, onRetry, icon = "error" }: ErrorMessageProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-[#BF3131]/40 px-4 py-3">
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="material-icons text-[18px]! text-white">
          {icon}
        </span>
        <p className="min-w-0 flex-1 font-mulish text-xs text-white">
          {error}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="cursor-pointer self-end font-mulish text-xs font-bold text-white underline"
      >
        Retry
      </button>
    </div>
  );
}
