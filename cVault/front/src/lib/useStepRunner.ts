"use client";

import { useCallback, useState } from "react";
import type { Hex } from "viem";
import type { Step } from "@/components/ui";

export type StepTask = {
  label: string;
  /**
   * Run the step. Return the tx hash if this step emitted one (optional: read-only steps
   * can return `undefined`).
   */
  run: () => Promise<Hex | undefined>;
};

export function useStepRunner() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reset = useCallback(() => {
    setSteps([]);
    setError(null);
    setDone(false);
    setRunning(false);
  }, []);

  const runAll = useCallback(async (tasks: StepTask[]) => {
    setError(null);
    setDone(false);
    setRunning(true);
    const initial: Step[] = tasks.map((t, i) => ({
      label: t.label,
      status: i === 0 ? "active" : "pending",
    }));
    setSteps(initial);

    for (let i = 0; i < tasks.length; i++) {
      try {
        const tx = await tasks[i].run();
        setSteps((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: "done", txHash: tx };
          if (i + 1 < next.length) next[i + 1] = { ...next[i + 1], status: "active" };
          return next;
        });
      } catch (e: unknown) {
        const msg =
          (e as { shortMessage?: string; message?: string })?.shortMessage ??
          (e as Error)?.message ??
          String(e);
        setSteps((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: "error", hint: msg };
          return next;
        });
        setError(msg);
        setRunning(false);
        return;
      }
    }

    setRunning(false);
    setDone(true);
  }, []);

  return { steps, running, error, done, runAll, reset };
}
