import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/* Pill buttons, 44px minimum height. Default = deep green, outline = green outline. */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-extrabold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-100",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-primary text-primary-foreground hover:shadow-glow hover:-translate-y-px disabled:bg-surface-container-high disabled:bg-none disabled:text-muted-foreground",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border-2 border-primary bg-card text-on-primary-container hover:bg-primary hover:text-primary-foreground disabled:border-outline-variant disabled:bg-surface-container disabled:text-muted-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/90",
        ghost:
          "text-on-surface hover:bg-surface-container-high",
        link: "text-primary underline-offset-4 hover:underline",
        fitness:
          "bg-gradient-primary text-white hover:shadow-glow hover:-translate-y-px font-extrabold",
        accent:
          "bg-accent text-accent-foreground hover:bg-accent/90",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-11 px-4",
        lg: "h-12 px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
