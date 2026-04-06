import { NavLink, useLocation } from "react-router-dom";
import { MaterialIcon } from "@/components/ui/material-icon";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navigation = [
  { title: "Profile", url: "/profile", icon: "person" },
  { title: "My TDEE Calculator", url: "/tdee-calculator", icon: "calculate" },
  { title: "Dashboard", url: "/dashboard", icon: "dashboard" },
  { title: "Macro Breakdown", url: "/macro-breakdown", icon: "restaurant" },
  { title: "My Achievements", url: "/achievements", icon: "emoji_events" },
  { title: "Community & Help", url: "/community-help", icon: "help_outline" },
  { title: "Payment Details", url: "/payment-details", icon: "credit_card" },
  { title: "Settings", url: "/settings", icon: "settings" },
  { title: "Privacy", url: "/privacy", icon: "shield" },
  { title: "About Us", url: "/about-us", icon: "info" },
  { title: "Log Out", url: "/logout", icon: "logout" },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent className="bg-card border-r">
        {!collapsed ? (
          <div className="h-16 flex items-center px-4 border-b border-border">
            <div>
              <h2 className="font-bold text-sm bg-gradient-primary bg-clip-text text-transparent">
                Weight Loss Buddy
              </h2>
              <p className="text-xs text-muted-foreground">Your Fitness Partner</p>
            </div>
          </div>
        ) : (
          <div className="h-16 flex items-center justify-center border-b border-border">
            <button
              onClick={toggleSidebar}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Expand sidebar"
            >
              <MaterialIcon name="chevron_right" size="sm" />
            </button>
          </div>
        )}

        <SidebarGroup>
          {!collapsed && (
            <div className="flex items-center justify-between">
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <button
                onClick={toggleSidebar}
                className="text-muted-foreground hover:text-foreground transition-colors mr-2"
                title="Collapse sidebar"
              >
                <MaterialIcon name="chevron_left" size="sm" />
              </button>
            </div>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url}>
                      <MaterialIcon name={item.icon} size="sm" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
