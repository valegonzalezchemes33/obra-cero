import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-[4px] border px-1.5 h-5 text-[11px] font-medium tracking-[0.01em] gap-1 whitespace-nowrap shrink-0 [&>svg]:size-2.5 [&>svg]:pointer-events-none transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-border bg-muted text-muted-foreground [a&]:hover:bg-muted/80",
        destructive:
          "border-destructive/15 bg-destructive/10 text-destructive [a&]:hover:bg-destructive/15",
        outline:
          "border-border bg-transparent text-foreground [a&]:hover:bg-muted",
        success:
          "border-success/15 bg-success-soft text-success",
        warning:
          "border-warning/20 bg-warning-soft text-warning",
        info:
          "border-info/15 bg-info-soft text-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
