"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="font-anybody text-3xl font-bold text-text-heading">
        Something went wrong
      </h1>
      <p className="max-w-md font-mulish text-base text-text-muted">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-primary px-5 py-4 font-mulish font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        Try again
      </button>
    </main>
  );
}
