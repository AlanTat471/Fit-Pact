import { NavLink, useLocation } from "react-router-dom";
import { MaterialIcon } from "@/components/ui/material-icon";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Profile", path: "/profile", icon: "person" },
  { label: "TDEE", path: "/tdee-calculator", icon: "calculate" },
  { label: "Dashboard", path: "/dashboard", icon: "dashboard" },
  { label: "Macros", path: "/macro-breakdown", icon: "restaurant" },
  { label: "Achievements", path: "/achievements", icon: "emoji_events" },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background h-20 flex justify-around items-center px-2 shadow-nav rounded-t-3xl border-t border-outline-variant/50">
      {navItems.map((item) => {
        const active = pathname === item.path;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center px-3 py-2 rounded-full text-[10px] font-semibold tracking-wide transition-all",
              active
                ? "bg-primary text-primary-foreground scale-105 shadow-lg"
                : "text-on-surface-variant hover:bg-surface-container-high active:scale-90"
            )}
          >
            <MaterialIcon name={item.icon} size="sm" filled={active} />
            <span className="mt-0.5">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
