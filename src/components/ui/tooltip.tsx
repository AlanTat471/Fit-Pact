import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

/**
 * Touch-aware Tooltip wrapper.
 *
 * Why this is a hybrid:
 *   Radix `Tooltip` is hover-and-keyboard-focus only by design — Radix's own
 *   docs explicitly say "use Popover for touch users". That's why the (?)
 *   help icons across the app worked on desktop but did nothing when tapped
 *   on phone/tablet.
 *
 *   This wrapper keeps the existing API exactly the same — every existing
 *   `<Tooltip><TooltipTrigger>...</TooltipTrigger><TooltipContent>...</TooltipContent></Tooltip>`
 *   call site (Dashboard, TDEE, Profile, MacroBreakdown, Achievements,
 *   RegisterForm, …) continues to work unchanged. At runtime we detect
 *   `(hover: hover) and (pointer: fine)` and pick:
 *
 *     • Radix Tooltip on hover-capable devices → hover or keyboard focus to
 *       open, auto-closes when the mouse / focus leaves (the desktop UX you
 *       already had).
 *     • Radix Popover on touch-only devices → TAP to open, tap outside or
 *       press Escape to close (a real touch interaction).
 *
 *   The visual styling (rounded card, border, text colours) is shared so the
 *   bubble looks identical on every device.
 */

const TooltipProvider = TooltipPrimitive.Provider

// Detect once whether this device can hover with a precise pointer (mouse /
// trackpad). Touch-only phones/tablets return false; iPads with a mouse paired
// return true. Re-runs if the matchMedia value flips (e.g. user plugs a mouse
// into an Android tablet).
function useHoverCapable(): boolean {
  const getValue = () => {
    if (typeof window === "undefined" || !window.matchMedia) return true
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches
  }
  const [hoverCapable, setHoverCapable] = React.useState<boolean>(getValue)
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)")
    const onChange = () => setHoverCapable(mq.matches)
    if (mq.addEventListener) mq.addEventListener("change", onChange)
    else if ((mq as MediaQueryList & { addListener?: (cb: () => void) => void }).addListener) {
      (mq as MediaQueryList & { addListener: (cb: () => void) => void }).addListener(onChange)
    }
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange)
      else if ((mq as MediaQueryList & { removeListener?: (cb: () => void) => void }).removeListener) {
        (mq as MediaQueryList & { removeListener: (cb: () => void) => void }).removeListener(onChange)
      }
    }
  }, [])
  return hoverCapable
}

// Shared context so TooltipTrigger / TooltipContent know which primitive to
// render. Defaulting to "tooltip" matches legacy behaviour for any consumer
// rendered outside a <Tooltip> (defensive — shouldn't happen in this codebase
// but keeps types friendly).
type TooltipMode = "tooltip" | "popover"
const TooltipModeContext = React.createContext<TooltipMode>("tooltip")

interface TooltipRootProps extends React.ComponentProps<typeof TooltipPrimitive.Root> {
  /**
   * Override the auto-detected mode (rarely needed; useful for testing or
   * forcing a popover even on desktop, e.g. for a rich help-bubble that
   * shouldn't auto-close on mouse leave).
   */
  mode?: TooltipMode
}

const Tooltip: React.FC<TooltipRootProps> = ({ children, mode: modeProp, ...rootProps }) => {
  const hoverCapable = useHoverCapable()
  const mode: TooltipMode = modeProp ?? (hoverCapable ? "tooltip" : "popover")
  return (
    <TooltipModeContext.Provider value={mode}>
      {mode === "tooltip" ? (
        <TooltipPrimitive.Root {...rootProps}>{children}</TooltipPrimitive.Root>
      ) : (
        // Popover doesn't accept Tooltip-specific props like delayDuration —
        // we deliberately drop them on the touch path.
        <PopoverPrimitive.Root>{children}</PopoverPrimitive.Root>
      )}
    </TooltipModeContext.Provider>
  )
}

const TooltipTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>((props, ref) => {
  const mode = React.useContext(TooltipModeContext)
  if (mode === "popover") {
    return <PopoverPrimitive.Trigger ref={ref} {...props} />
  }
  return <TooltipPrimitive.Trigger ref={ref} {...props} />
})
TooltipTrigger.displayName = "TooltipTrigger"

// Single class list shared by both primitives so the bubble looks identical
// on every device — same rounding, border, padding, animations.
const TOOLTIP_CONTENT_CLASS =
  "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => {
  const mode = React.useContext(TooltipModeContext)
  if (mode === "popover") {
    // Don't yank focus into the popover when it opens via tap — feels jarring
    // on mobile and is unnecessary for a passive help bubble. The user can
    // still focus it with Tab if they need to.
    const popoverProps = props as unknown as React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
    return (
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(TOOLTIP_CONTENT_CLASS, "max-w-[min(20rem,calc(100vw-2rem))]", className)}
          {...popoverProps}
        />
      </PopoverPrimitive.Portal>
    )
  }
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(TOOLTIP_CONTENT_CLASS, className)}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
})
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
