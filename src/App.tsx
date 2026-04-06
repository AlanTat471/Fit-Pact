import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserDataProvider } from "@/contexts/UserDataContext";
import Index from "./pages/Index";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import TDEE from "./pages/Workouts";
import MacroBreakdown from "./pages/MacroBreakdown";
import Achievements from "./pages/Achievements";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Privacy from "./pages/Privacy";
import CommunityHelp from "./pages/CommunityHelp";
import AboutUs from "./pages/AboutUs";
import PaymentDetails from "./pages/PaymentDetails";
import Logout from "./pages/Logout";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import AppLayout from "./layouts/AppLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <UserDataProvider>
      <TooltipProvider delayDuration={0} skipDelayDuration={0}>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/create-your-profile" element={<Register />} />
          <Route path="/dashboard" element={<AppLayout><ErrorBoundary><Dashboard /></ErrorBoundary></AppLayout>} />
          <Route path="/tdee-calculator" element={<AppLayout><TDEE /></AppLayout>} />
          <Route path="/macro-breakdown" element={<AppLayout><MacroBreakdown /></AppLayout>} />
          <Route path="/achievements" element={<AppLayout><Achievements /></AppLayout>} />
          <Route path="/profile" element={<AppLayout><Profile /></AppLayout>} />
          <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
          <Route path="/privacy" element={<AppLayout><Privacy /></AppLayout>} />
          <Route path="/community-help" element={<AppLayout><CommunityHelp /></AppLayout>} />
          <Route path="/about-us" element={<AppLayout><AboutUs /></AppLayout>} />
          <Route path="/payment-details" element={<AppLayout><PaymentDetails /></AppLayout>} />
          <Route path="/logout" element={<Logout />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
      </UserDataProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
