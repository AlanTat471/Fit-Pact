import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/* Pill buttons. Default = white pill with dark text; outline = white outline on the dark canvas.
   Uppercase, letter-spaced label. At least 44px tall. */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-full text-[13px] font-semibold uppercase tracking-[0.09em] ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default:
          "bg-white text-[#0A0A0C] hover:bg-white/90 hover:-translate-y-px hover:shadow-glow disabled:bg-white/15 disabled:text-white/60",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border-[1.5px] border-white/40 bg-transparent text-white hover:bg-white/10 disabled:border-white/20 disabled:text-white/55",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/90",
        ghost:
          "text-white hover:bg-white/10",
        link: "text-white normal-case tracking-normal underline decoration-white/45 underline-offset-4 hover:decoration-white",
        fitness:
          "bg-white text-[#0A0A0C] hover:bg-white/90 hover:-translate-y-px hover:shadow-glow",
        accent:
          "bg-gradient-primary text-[#0A0A0C] hover:opacity-90",
      },
      size: {
        default: "h-[52px] px-6 py-2",
        sm: "h-11 px-4",
        lg: "h-[54px] px-8",
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
