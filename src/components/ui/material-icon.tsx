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
}

/** forwardRef required for Radix TooltipTrigger / PopoverTrigger asChild */
export const MaterialIcon = React.forwardRef<HTMLElement, MaterialIconProps>(function MaterialIcon(
  { name, size = "md", className, ...props },
  ref
) {
  return (
    <i
      ref={ref as React.Ref<HTMLElement>}
      className={cn("material-icons leading-none", sizeClasses[size], className)}
      {...props}
    >
      {name}
    </i>
  );
});
