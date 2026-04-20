import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MaterialIcon } from "@/components/ui/material-icon";
import { VisaIcon, MastercardIcon, AmexIcon, GooglePayIcon, ApplePayIcon } from "@/components/PaymentIcons";
import { useAuth } from "@/contexts/AuthContext";
import { getUserPref, setUserPref } from "@/lib/supabaseUserPrefs";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/hooks/use-toast";

type PlanType = 'free' | 'weekly' | 'fortnightly';

const PaymentIcons = () => (
  <div className="flex items-center gap-0.5 mt-1 mb-1">
    <VisaIcon className="h-4 w-auto" />
    <MastercardIcon className="h-4 w-auto" />
    <AmexIcon className="h-4 w-auto" />
    <GooglePayIcon className="h-4 w-auto" />
    <ApplePayIcon className="h-4 w-auto" />
  </div>
);

const PaymentDetails = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activePlan, setActivePlan] = useState<PlanType>(() => {
    return (localStorage.getItem('activePlan') as PlanType) || 'free';
  });

  useEffect(() => {
    if (!user?.id) return;
    getUserPref(user.id, 'activePlan').then((val) => {
      if (val) {
        setActivePlan(val as PlanType);
        localStorage.setItem('activePlan', val);
      }
    });
  }, [user?.id]);
  const [showUpdatePayment, setShowUpdatePayment] = useState(false);
  const [showCancelSubscription, setShowCancelSubscription] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");
  const [billingLoading, setBillingLoading] = useState(false);

  const handleSelectPlan = async (plan: PlanType) => {
    if (plan === "free") {
      setActivePlan("free");
      localStorage.setItem("activePlan", "free");
      if (user?.id) await setUserPref(user.id, "activePlan", "free");
      return;
    }

    if (!user?.id) {
      toast({
        title: "Sign in required",
        description: "Please sign in before starting a subscription.",
        variant: "destructive",
      });
      return;
    }

    setBillingLoading(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Could not verify your session. Please sign in again.");
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Missing Supabase configuration.");
      }

      const functionUrl = `${supabaseUrl}/functions/v1/billing`;
      console.log("[Billing] POST", functionUrl, { planType: plan });

      const res = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionData.session.access_token}`,
          "apikey": supabaseAnonKey,
        },
        body: JSON.stringify({ planType: plan }),
      });

      const text = await res.text();
      console.log("[Billing] Response status:", res.status, "body:", text);

      let payload: { url?: string; error?: string } | null = null;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error(`Server returned non-JSON (${res.status}): ${text.slice(0, 300)}`);
      }

      if (!res.ok) {
        throw new Error(payload?.error || `Server error ${res.status}: ${text.slice(0, 300)}`);
      }
      if (!payload?.url) {
        throw new Error(payload?.error || "Checkout URL is missing from billing response.");
      }

      window.location.href = payload.url as string;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not start checkout.";
      console.error("[Billing] checkout error:", msg);
      toast({
        title: "Checkout failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setBillingLoading(false);
    }
  };

  const handleCancelSubscription = () => {
    setActivePlan('free');
    localStorage.setItem('activePlan', 'free');
    if (user?.id) setUserPref(user.id, 'activePlan', 'free');
    setShowCancelSubscription(false);
  };

  const handleSavePayment = () => {
    setShowUpdatePayment(false);
    setCardNumber("");
    setCardExpiry("");
    setCardCvc("");
    setCardName("");
  };

  const statusLabel = (plan: PlanType) =>
    activePlan === plan ? 'your active subscription' : 'inactive subscription';

  const PaidPlanCard = ({ plan, name, price, description }: {
    plan: PlanType;
    name: string;
    price: string;
    period: string;
    description: string;
  }) => (
    <Card className={`relative border flex flex-col min-h-[540px] rounded-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-card ${activePlan === plan ? 'border-primary shadow-glow bg-gradient-hero' : 'border-outline-variant bg-surface-container-low'}`}>
      <CardHeader className="pb-3 min-h-[160px]">
        <CardTitle className="text-xl">{name}</CardTitle>
        <span className="text-[10px] tracking-wide text-on-surface-variant">({statusLabel(plan)})</span>
        <p className="text-[13px] leading-5 text-on-surface-variant mt-1.5 min-h-[100px]">{description}</p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pb-24">
        <div className="flex items-start gap-1.5 min-h-[72px]">
          <MaterialIcon name="check_circle" size="sm" className="text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">Paid subscription</p>
            <p className="text-xs leading-snug text-muted-foreground">
              Access to '12 Week' Plan, downloadable reports, unlock 'Achievements' and more.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-1.5 min-h-[72px]">
          <MaterialIcon name="check_circle" size="sm" className="text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">Payment Method</p>
            <PaymentIcons />
            <p className="text-xs leading-snug text-muted-foreground">Paid via xxxx 123x</p>
          </div>
        </div>

        <div className="flex items-start gap-1.5 min-h-[72px]">
          <MaterialIcon name="check_circle" size="sm" className="text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">Cancel Anytime</p>
            <p className="text-xs leading-snug text-muted-foreground">
              No lock in contract. Cancel anytime. No pro-rata refunds after payment.
            </p>
          </div>
        </div>

        <div className="absolute left-6 right-6 bottom-6">
          {activePlan === plan ? (
            <Button
              onClick={() => setShowUpdatePayment(true)}
              variant="default"
              className="w-full h-auto py-2.5 px-3 flex flex-col gap-0.5 leading-tight"
            >
              <span className="text-xs font-bold">Active</span>
              <span className="text-[10px] opacity-90">Update Payment Method</span>
            </Button>
          ) : (
            <Button
              onClick={() => handleSelectPlan(plan)}
              variant="default"
              className="w-full h-auto py-2.5 px-3 flex flex-col gap-0.5 leading-tight"
              disabled={billingLoading}
            >
              <span className="text-xs font-bold">Subscribe</span>
              <span className="text-[10px] opacity-90">{price} / billed {plan === "fortnightly" ? "fortnightly" : "weekly"}</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-xl border border-outline-variant bg-surface-container-low px-5 py-5 shadow-card">
        <h1 className="text-3xl font-black mb-1 tracking-tight flex items-center gap-2 text-on-surface">
          Subscription & Billing
        </h1>
        <p className="text-[12px] tracking-wide text-on-surface-variant">Securely managed via Stripe</p>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto items-stretch">
        {/* Free Plan */}
        <Card className={`relative border flex flex-col min-h-[540px] rounded-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-card ${activePlan === 'free' ? 'border-primary shadow-glow bg-gradient-hero' : 'border-outline-variant bg-surface-container-low'}`}>
          <CardHeader className="pb-3 min-h-[160px]">
            <CardTitle className="text-xl">Free Plan</CardTitle>
            <span className="text-[10px] tracking-wide text-on-surface-variant">({statusLabel('free')})</span>
            <p className="text-[13px] leading-5 text-on-surface-variant mt-1.5 min-h-[100px]">
              There is nothing wrong with trying before buying! Get 14 days limited access to get a feel of the app before you subscribe!
            </p>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col pb-24">
            <div className="flex items-start gap-1.5 min-h-[72px]">
              <MaterialIcon name="check_circle" size="sm" className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Free trial for 14 days</p>
                <p className="text-xs leading-snug text-muted-foreground">Limited access to pro features</p>
              </div>
            </div>
            <div className="flex items-start gap-1.5 min-h-[72px]">
              <MaterialIcon name="check_circle" size="sm" className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">No credit card required</p>
                <p className="text-xs leading-snug text-muted-foreground">Try before you commit</p>
              </div>
            </div>
            <div className="flex items-start gap-1.5 min-h-[72px]">
              <MaterialIcon name="check_circle" size="sm" className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Trial Period</p>
                <p className="text-xs leading-snug text-muted-foreground">Free Trial will end after 14 days automatically</p>
              </div>
            </div>
            <div className="absolute left-6 right-6 bottom-6">
              {activePlan !== 'free' ? (
                <Button onClick={() => handleSelectPlan('free')} variant="default" className="w-full h-auto py-2.5 px-3 flex flex-col gap-0.5 leading-tight" disabled={billingLoading}>
                  <span className="text-xs font-bold">Switch to Free Plan</span>
                </Button>
              ) : (
                <Button variant="default" className="w-full h-auto py-2.5 px-3 flex flex-col gap-0.5 leading-tight" disabled>
                  <span className="text-xs font-bold">Active</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <PaidPlanCard
          plan="weekly"
          name="Weekly"
          price="$4.99"
          period="week"
          description="For a price of a small coffee, you can be on your way to looking and feeling better! Subscribe now!"
        />

        <PaidPlanCard
          plan="fortnightly"
          name="Fortnightly"
          price="$8.99"
          period="2 weeks"
          description="Save more with our fortnightly plan. All the same great features at a better value!"
        />
      </div>

      {/* Billing History */}
      <div className="max-w-4xl mx-auto">
        <Card className="border-outline-variant shadow-card bg-surface-container-low">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Billing History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <Button variant="default" className="text-sm" onClick={() => navigate('/settings?tab=payments')}>
                View Full Billing History
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Update Payment Method Dialog */}
      <AlertDialog open={showUpdatePayment} onOpenChange={setShowUpdatePayment}>
        <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <MaterialIcon name="verified_user" size="sm" className="text-primary" />
              Update Payment Method
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              Enter your new card details below. Your information is encrypted and secure.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border">
              <MaterialIcon name="lock" size="sm" className="text-primary" />
              <span className="text-xs text-muted-foreground">Secure connection — your details are encrypted</span>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Name on Card</Label>
              <Input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="John Doe" className="w-full" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Card Number</Label>
              <Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value.replace(/[^0-9 ]/g, '').slice(0, 19))} placeholder="1234 5678 9012 3456" className="w-full" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Expiry Date</Label>
                <Input value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value.replace(/[^0-9/]/g, '').slice(0, 5))} placeholder="MM/YY" className="w-full" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">CVC</Label>
                <Input value={cardCvc} onChange={(e) => setCardCvc(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="123" className="w-full" />
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background text-foreground hover:bg-muted border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSavePayment}>Save Card Details</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Subscription Dialog */}
      <AlertDialog open={showCancelSubscription} onOpenChange={setShowCancelSubscription}>
        <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <MaterialIcon name="verified_user" size="sm" className="text-destructive" />
              Cancel Subscription
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70 space-y-2">
              <p>Are you sure you want to cancel your subscription?</p>
              <p>If cancelling after payment has been taken, please note there will be no pro-rata refunds. You will retain access until the end of your current billing period.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border">
            <MaterialIcon name="lock" size="sm" className="text-primary" />
            <span className="text-xs text-muted-foreground">Secure action — your request is processed securely</span>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background text-foreground hover:bg-muted border-border">Keep Subscription</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleCancelSubscription}>Yes, Cancel Subscription</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PaymentDetails;
