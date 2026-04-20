import { useEffect, useRef } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { BottomNav } from "@/components/BottomNav";
import { HamburgerMenu } from "@/components/HamburgerMenu";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (session) {
      hasRedirectedRef.current = false;
      return;
    }
    const revalidate = async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s) return;
      if (!hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        navigate("/", { replace: true });
      }
    };
    revalidate();
  }, [loading, session, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Redirecting to sign in…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col w-full bg-background text-foreground">
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <HamburgerMenu />
        </div>
        <h1
          className="text-2xl font-bold text-primary lowercase tracking-tight cursor-pointer"
          onClick={() => navigate("/dashboard")}
        >
          Numi
        </h1>
        <button className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-surface-container-high">
          <MaterialIcon name="notifications" size="md" />
        </button>
      </header>

      <main className="flex-1 pt-20 pb-32 px-4 sm:px-6 overflow-x-hidden max-w-2xl mx-auto w-full">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
