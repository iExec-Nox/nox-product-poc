export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin motion-reduce:animate-none rounded-full border-4 border-surface-border border-t-primary" />
        <p className="font-mulish text-sm text-text-muted">
          Loading activity...
        </p>
      </div>
    </div>
  );
}
