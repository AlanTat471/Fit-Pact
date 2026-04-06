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
    <div className="min-h-screen flex flex-col w-full bg-[#0A0A0A] text-zinc-100">
      <header className="fixed top-0 w-full z-50 bg-[#131313]/70 backdrop-blur-xl px-6 py-4 flex justify-between items-center shadow-[0_0_20px_rgba(34,211,238,0.1)]">
        <HamburgerMenu />
        <h1
          className="text-2xl font-black tracking-tighter text-primary italic cursor-pointer"
          onClick={() => navigate("/dashboard")}
        >
          FITPACT
        </h1>
        <button className="p-2 text-zinc-400 hover:text-primary transition-colors">
          <MaterialIcon name="notifications" size="md" />
        </button>
      </header>

      <main className="flex-1 pt-20 pb-24 px-4 sm:px-6 overflow-x-hidden">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
