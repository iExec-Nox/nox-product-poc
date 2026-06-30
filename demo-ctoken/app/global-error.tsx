"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
          <h1 className="text-3xl font-bold text-text-heading">
            Something went wrong
          </h1>
          <p className="max-w-md text-base text-text-muted">
            {error.message || "A critical error occurred."}
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-primary px-5 py-4 font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
