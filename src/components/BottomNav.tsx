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

/* Floating black pill. The current screen is a white pill with an uppercase label;
   the others are bare white icons. Achievements is disabled. */
export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Main"
      className="fixed left-4 right-4 z-50 mx-auto flex h-[68px] max-w-md items-center justify-between rounded-full border border-white/10 bg-black px-2 shadow-[0_12px_30px_rgba(0,0,0,0.55)]"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {navItems.map((item) => {
        if (item.comingSoon) {
          return (
            <div
              key={item.path}
              aria-disabled
              aria-label="Achievements, Coming Soon"
              className="flex h-14 w-[68px] cursor-not-allowed flex-col items-center justify-center gap-0.5 text-[9px] font-semibold tracking-[0.04em] text-white/60"
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
              "flex items-center justify-center gap-2 rounded-full text-[12px] font-semibold uppercase tracking-[0.08em] transition-all",
              active
                ? "h-12 bg-white px-[18px] text-[#0A0A0C]"
                : "h-11 w-11 text-white/90 hover:bg-white/10 active:scale-95"
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
