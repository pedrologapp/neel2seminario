"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, hint, id, ...props }, ref) => {
    const inputId = id ?? React.useId();
    return (
      <label
        htmlFor={inputId}
        className={cn(
          "group flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-white p-3 transition-colors hover:border-amadeus-blue/40 has-[:checked]:border-amadeus-blue has-[:checked]:bg-amadeus-blue-50/60",
          className,
        )}
      >
        <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border border-input bg-white transition-colors group-has-[:checked]:border-amadeus-blue group-has-[:checked]:bg-amadeus-blue">
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            className="peer absolute inset-0 cursor-pointer opacity-0"
            {...props}
          />
          <Check
            className="size-3.5 text-white opacity-0 peer-checked:opacity-100"
            strokeWidth={3}
          />
        </span>
        {(label || hint) && (
          <span className="flex min-w-0 flex-col leading-tight">
            {label && (
              <span className="text-sm font-semibold text-foreground">
                {label}
              </span>
            )}
            {hint && (
              <span className="text-xs text-muted-foreground">{hint}</span>
            )}
          </span>
        )}
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
