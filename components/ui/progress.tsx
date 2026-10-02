"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Progress as ProgressPrimitive } from "radix-ui"

// App edit: indicator colour variants for the budget bar (plan 2.2).
const progressIndicatorVariants = cva("size-full flex-1 transition-all", {
  variants: {
    variant: {
      default: "bg-primary",
      ok: "bg-received",
      warning: "bg-pending",
      over: "bg-destructive",
    },
  },
  defaultVariants: { variant: "default" },
})

function Progress({
  className,
  value,
  variant,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> &
  VariantProps<typeof progressIndicatorVariants>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      // App edit (bug fix): pass value through so aria-valuenow is set.
      value={value}
      className={cn(
        "relative flex h-1.5 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={progressIndicatorVariants({ variant })}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
