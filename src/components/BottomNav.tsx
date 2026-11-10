import { NavLink, useLocation } from "react-router-dom";
import { MaterialIcon } from "@/components/ui/material-icon";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Profile", path: "/profile", icon: "person" },
  { label: "TDEE", path: "/tdee-calculator", icon: "calculate" },
  { label: "Dashboard", path: "/dashboard", icon: "dashboard" },
  { label: "Macros", path: "/macro-breakdown", icon: "restaurant" },
  { label: "Achievements", path: "/achievements", icon: "emoji_events", comingSoon: true },
] as const;

/* Floating dark pill. The current screen is a white pill with its label;
   the others are round icon buttons. Achievements is disabled. */
export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Main"
      className="fixed left-4 right-4 z-50 mx-auto flex h-[68px] max-w-md items-center justify-between rounded-full bg-[#14171C] px-2 shadow-[0_10px_24px_rgba(20,23,28,0.25)]"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {navItems.map((item) => {
        if (item.comingSoon) {
          return (
            <div
              key={item.path}
              aria-disabled
              aria-label="Achievements, Coming Soon"
              className="flex h-14 w-16 cursor-not-allowed flex-col items-center justify-center gap-0.5 text-[9px] font-extrabold text-[#B4BAC2]"
            >
              <MaterialIcon name={item.icon} size="sm" />
              <span>Coming Soon!</span>
            </div>
          );
        }

        const active = pathname === item.path;

        return (
          <NavLink
            key={item.path}
            to={item.path}
            aria-label={item.label}
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-full text-[13px] font-extrabold transition-all",
              active
                ? "bg-white px-4 text-[#14171C]"
                : "w-11 bg-[#2A2F36] text-[#E8ECEF] hover:bg-[#3A4048] active:scale-95"
            )}
          >
            <MaterialIcon name={item.icon} size="sm" filled={active} />
            {active && <span>{item.label}</span>}
          </NavLink>
        );
      })}
    </nav>
  );
}
