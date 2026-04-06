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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#131313]/70 backdrop-blur-xl h-20 flex justify-around items-center px-4 shadow-[0_-10px_30px_rgba(34,211,238,0.05)]">
      {navItems.map((item) => {
        const active = pathname === item.path;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center pt-2 text-[10px] uppercase tracking-widest font-bold transition-colors",
              active
                ? "text-primary border-t-2 border-primary"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <MaterialIcon name={item.icon} size="md" />
            <span className="mt-0.5">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
