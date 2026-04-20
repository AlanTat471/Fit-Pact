import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MaterialIcon } from "@/components/ui/material-icon";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const menuItems = [
  { label: "Profile Settings", path: "/settings", icon: "settings" },
  { label: "Payment Details", path: "/payment-details", icon: "credit_card" },
  { label: "Community & Help", path: "/community-help", icon: "help_outline" },
  { label: "Privacy", path: "/privacy", icon: "shield" },
  { label: "About Us", path: "/about-us", icon: "info" },
  { label: "Log Out", path: "/logout", icon: "logout" },
] as const;

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="p-2 text-primary hover:text-primary/80 transition-colors">
          <MaterialIcon name="menu" size="md" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-surface-container-lowest border-outline-variant p-0">
        <SheetHeader className="px-6 py-6 border-b border-outline-variant">
          <SheetTitle className="text-2xl font-bold text-primary lowercase tracking-tight">
            Numi
          </SheetTitle>
        </SheetHeader>
        <nav className="px-4 py-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                setOpen(false);
                navigate(item.path);
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-on-surface hover:text-primary hover:bg-surface-container-high transition-colors text-sm font-medium"
            >
              <MaterialIcon name={item.icon} size="sm" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
