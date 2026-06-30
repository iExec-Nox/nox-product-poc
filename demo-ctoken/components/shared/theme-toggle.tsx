"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Switch } from "@/components/ui/switch";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!mounted) {
    return (
      <div className="theme-toggle">
        <div
          className="inline-flex h-5 w-9 items-center rounded-full border border-surface-border bg-toggle-track"
          aria-hidden="true"
        >
          <div className="ml-[2px] flex size-4 items-center justify-center rounded-full bg-toggle-thumb shadow-md">
            <span aria-hidden="true" className="material-icons-outlined text-[10px]! leading-none text-toggle-icon">
              light_mode
            </span>
          </div>
        </div>
      </div>
    );
  }

  const isDark = theme === "dark";

  return (
    <div className="theme-toggle">
      <Switch
        checked={!isDark}
        onCheckedChange={(checked) => setTheme(checked ? "light" : "dark")}
        className="h-5! w-9! cursor-pointer border-surface-border bg-toggle-track shadow-none data-[state=checked]:border-surface-border data-[state=checked]:bg-toggle-track dark:data-[state=unchecked]:bg-toggle-track"
        thumbClassName="size-4! bg-toggle-thumb shadow-md"
        thumbChildren={
          <span aria-hidden="true" className="material-icons-outlined text-[10px]! leading-none text-toggle-icon">
            {isDark ? "dark_mode" : "light_mode"}
          </span>
        }
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      />
    </div>
  );
}
