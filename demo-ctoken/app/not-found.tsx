import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="font-anybody text-5xl font-bold text-text-heading">404</h1>
      <h2 className="font-anybody text-2xl font-bold text-text-heading">
        Page not found
      </h2>
      <p className="max-w-md font-mulish text-base text-text-muted">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-primary px-5 py-4 font-mulish font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        Back to home
      </Link>
    </main>
  );
}
