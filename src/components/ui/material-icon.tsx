import React from "react";
import { cn } from "@/lib/utils";

const sizeClasses = {
  xs: "text-sm",
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
} as const;

export interface MaterialIconProps extends React.HTMLAttributes<HTMLElement> {
  name: string;
  size?: keyof typeof sizeClasses;
  filled?: boolean;
}

/** forwardRef required for Radix TooltipTrigger / PopoverTrigger asChild */
export const MaterialIcon = React.forwardRef<HTMLElement, MaterialIconProps>(function MaterialIcon(
  { name, size = "md", filled = false, className, style, ...props },
  ref
) {
  return (
    <span
      ref={ref as React.Ref<HTMLSpanElement>}
      className={cn("material-symbols-outlined leading-none", sizeClasses[size], className)}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
        ...style,
      }}
      {...props}
    >
      {name}
    </span>
  );
});
