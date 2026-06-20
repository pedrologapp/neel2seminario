"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, id, ...props }, ref) => {
    const inputId = id ?? React.useId();
    return (
      <label
        htmlFor={inputId}
        className="flex cursor-pointer items-center gap-3"
      >
        <span className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-muted transition-colors has-[:checked]:bg-amadeus-blue">
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            className="peer sr-only"
            {...props}
          />
          <span
            className={cn(
              "pointer-events-none absolute left-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5",
              className,
            )}
          />
        </span>
        {label && (
          <span className="text-sm font-semibold text-foreground">{label}</span>
        )}
      </label>
    );
  },
);
Switch.displayName = "Switch";

export { Switch };
