"use client";

import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDevMode } from "@/hooks/use-dev-mode";

interface DevModeToggleProps {
  label?: string;
}

export function DevModeToggle({ label = "Dev Mode" }: DevModeToggleProps) {
  const { enabled, toggle } = useDevMode();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5">
          <span className="font-inter text-sm font-medium text-text-heading">
            {label}
          </span>
          <Switch
            size="sm"
            checked={enabled}
            onCheckedChange={toggle}
            aria-label={enabled ? "Disable developer mode" : "Enable developer mode"}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[220px] text-center">
        View the smart contract functions called during each action
      </TooltipContent>
    </Tooltip>
  );
}
