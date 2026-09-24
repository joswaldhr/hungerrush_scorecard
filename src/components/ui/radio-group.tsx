"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root className={cn("flex flex-col gap-2", className)} {...props} />;
}

function RadioGroupItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item> & { children?: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <RadioGroupPrimitive.Item
        className={cn(
          "h-4 w-4 shrink-0 rounded-full border border-input",
          "data-[state=checked]:border-accent",
          className
        )}
        {...props}
      >
        <RadioGroupPrimitive.Indicator className="flex h-full w-full items-center justify-center after:h-2 after:w-2 after:rounded-full after:bg-accent" />
      </RadioGroupPrimitive.Item>
      {children}
    </label>
  );
}

export { RadioGroup, RadioGroupItem };
