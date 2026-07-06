import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { callBillingApi, loadPremiumAccessState } from "@/lib/billingApi";
import { toast } from "@/hooks/use-toast";

type PlanType = 'free' | 'monthly' | 'annual';

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
  const [searchParams] = useSearchParams();
  const fromAcclimationComplete = searchParams.get("from") === "acclimationComplete";
  const { user } = useAuth();
  const [activePlan, setActivePlan] = useState<PlanType>(() => {
    return (localStorage.getItem('activePlan') as PlanType) || 'free';
  });
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const [paymentMethodSaved, setPaymentMethodSaved] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const state = await loadPremiumAccessState(user.id);
      if (state.activePlan) {
        setActivePlan(state.activePlan as PlanType);
        localStorage.setItem('activePlan', state.activePlan);
      }
      setPremiumUnlocked(state.premiumUnlocked);
      setPaymentMethodSaved(state.paymentMethodSaved);
    })();
  }, [user?.id]);

  useEffect(() => {
    const setup = searchParams.get("setup");
    if (setup === "success") {
      const plan = searchParams.get("plan");
      if (plan) {
        localStorage.setItem("pendingPlan", plan);
        if (user?.id) setUserPref(user.id, "pendingPlan", plan);
      }
      localStorage.setItem("paymentMethodSaved", "true");
      if (user?.id) setUserPref(user.id, "paymentMethodSaved", "true");
      setPaymentMethodSaved(true);
      toast({
        title: "Card saved",
        description: "Your plan and payment method are saved. You will be charged when you complete Acclimation Week 4 and click Let's Go!",
      });
    }
  }, [searchParams, user?.id]);
  const [showUpdatePayment, setShowUpdatePayment] = useState(false);
  const [showCancelSubscription, setShowCancelSubscription] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");
  const [billingLoading, setBillingLoading] = useState(false);

  // Payment-method-on-file display state. Stored locally so the UI can show
  // the masked last-4 + edit pen once the user has entered card details, and
  // simply show "Add payment method" until they have. We only persist the last
  // 4 digits and the cardholder name — never the full PAN/CVC.
  const [savedCardLast4, setSavedCardLast4] = useState<string>(() => localStorage.getItem('numiSavedCardLast4') || "");
  const [savedCardName, setSavedCardName] = useState<string>(() => localStorage.getItem('numiSavedCardName') || "");
  const hasSavedCard = savedCardLast4.length === 4;

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
      localStorage.setItem("pendingPlan", plan);
      await setUserPref(user.id, "pendingPlan", plan);

      const action = fromAcclimationComplete ? "checkout" : "setup";
      const result = await callBillingApi(plan, action);

      if (result.error) {
        throw new Error(result.error);
      }
      if (!result.url) {
        throw new Error("Checkout URL is missing from billing response.");
      }

      window.location.href = result.url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not start checkout.";
      toast({
        title: "Checkout failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setBillingLoading(false);
    }
  };

  const handleAddPaymentViaStripe = async () => {
    const plan = (localStorage.getItem("pendingPlan") as PlanType) || "monthly";
    if (plan === "free") {
      toast({
        title: "Choose a plan first",
        description: "Select Monthly or Annually below, then add your card securely via Stripe.",
      });
      return;
    }
    await handleSelectPlan(plan);
  };

  const handleCancelSubscription = () => {
    setActivePlan('free');
    localStorage.setItem('activePlan', 'free');
    if (user?.id) setUserPref(user.id, 'activePlan', 'free');
    setShowCancelSubscription(false);
  };

  const handleSavePayment = () => {
    // Persist only the last 4 digits + cardholder name. Full card data is never
    // stored in our app or in Supabase — Stripe holds the real PAN. This is just
    // a friendly UI hint so the user can see which card they last entered.
    const digitsOnly = cardNumber.replace(/[^0-9]/g, '');
    if (digitsOnly.length >= 4) {
      const last4 = digitsOnly.slice(-4);
      setSavedCardLast4(last4);
      localStorage.setItem('numiSavedCardLast4', last4);
    }
    if (cardName.trim()) {
      setSavedCardName(cardName.trim());
      localStorage.setItem('numiSavedCardName', cardName.trim());
    }
    setShowUpdatePayment(false);
    setCardNumber("");
    setCardExpiry("");
    setCardCvc("");
    setCardName("");
  };

  const handleRemoveCard = () => {
    setSavedCardLast4("");
    setSavedCardName("");
    localStorage.removeItem('numiSavedCardLast4');
    localStorage.removeItem('numiSavedCardName');
  };

  const statusLabel = (plan: PlanType) =>
    activePlan === plan ? 'your active subscription' : 'inactive subscription';

  const PaidPlanCard = ({ plan, name, price, billingLine, description, badge, subscribeLabel }: {
    plan: PlanType;
    name: string;
    price: string;
    billingLine: string;
    description: string;
    badge?: string;
    subscribeLabel?: string;
  }) => (
    <Card className={`relative border flex flex-col min-h-[540px] rounded-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-card ${activePlan === plan && premiumUnlocked ? 'border-primary shadow-glow bg-gradient-hero' : 'border-outline-variant bg-surface-container-low'}`}>
      <CardHeader className="pb-3 min-h-[150px]">
        <CardTitle className="text-lg">{name}</CardTitle>
        {badge && (
          <Badge variant="secondary" className="text-[9px] w-fit mt-1 uppercase tracking-wide">
            {badge}
          </Badge>
        )}
        <span className="text-[9px] tracking-wide text-on-surface-variant">({statusLabel(plan)})</span>
        <p className="text-[11px] leading-[1.35] text-on-surface-variant mt-1.5 min-h-[90px]">{description}</p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pb-28">
        <div className="flex items-start gap-1.5 min-h-[68px]">
          <MaterialIcon name="check_circle" size="sm" className="text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-[12px]">Paid subscription</p>
            <p className="text-[10px] leading-snug text-muted-foreground">
              Access to '12 Week' Plan, downloadable reports, unlock 'Achievements' and more.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-1.5 min-h-[68px]">
          <MaterialIcon name="check_circle" size="sm" className="text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[12px]">Payment Method</p>
            <PaymentIcons />
            {hasSavedCard || paymentMethodSaved ? (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] leading-snug text-muted-foreground truncate">
                  {hasSavedCard ? `Default · •••• ${savedCardLast4}` : "Card saved via Stripe"}
                </span>
                <button
                  type="button"
                  aria-label="Edit payment method"
                  onClick={handleAddPaymentViaStripe}
                  className="shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-full hover:bg-primary/10 text-primary"
                >
                  <MaterialIcon name="edit" size="xs" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAddPaymentViaStripe}
                className="text-[10px] leading-snug text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Add payment method
              </button>
            )}
          </div>
        </div>

        <div className="flex items-start gap-1.5 min-h-[68px]">
          <MaterialIcon name="check_circle" size="sm" className="text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-[12px]">Cancel Anytime</p>
            <p className="text-[10px] leading-snug text-muted-foreground">
              No lock in contract. Cancel anytime. No pro-rata refunds after payment.
            </p>
          </div>
        </div>

        <div className="absolute left-4 right-4 bottom-6">
          {activePlan === plan && premiumUnlocked ? (
            <Button
              onClick={handleAddPaymentViaStripe}
              variant="default"
              className="w-full min-h-[56px] h-auto py-2.5 px-2 flex flex-col items-center justify-center gap-0.5 leading-tight"
            >
              <span className="text-xs font-bold">Active</span>
              <span className="text-[9px] opacity-90 text-center">Update Payment Method</span>
            </Button>
          ) : (
            <Button
              onClick={() => handleSelectPlan(plan)}
              variant="default"
              className="w-full min-h-[56px] h-auto py-2.5 px-2 flex flex-col items-center justify-center gap-0.5 leading-tight"
              disabled={billingLoading}
            >
              <span className="text-[11px] font-bold leading-tight text-center">{price}</span>
              <span className="text-[9px] opacity-90 text-center leading-snug max-w-full whitespace-normal">
                {subscribeLabel || billingLine}
              </span>
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

      {fromAcclimationComplete && (
        <div className="max-w-4xl mx-auto rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-sm text-on-surface">
          Choose your plan below to unlock Weight Loss and Maintenance phases. You will complete payment via Stripe and return here with full access.
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto items-stretch">
        {/* Free Plan */}
        <Card className={`relative border flex flex-col min-h-[540px] rounded-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-card ${activePlan === 'free' ? 'border-primary shadow-glow bg-gradient-hero' : 'border-outline-variant bg-surface-container-low'}`}>
          <CardHeader className="pb-3 min-h-[150px]">
            <CardTitle className="text-lg">Free Plan</CardTitle>
            <span className="text-[9px] tracking-wide text-on-surface-variant">({statusLabel('free')})</span>
            <p className="text-[11px] leading-[1.35] text-on-surface-variant mt-1.5 min-h-[90px]">
              There is nothing wrong with trying before buying! Get 14 days limited access to get a feel of the app before you subscribe!
            </p>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col pb-24">
            <div className="flex items-start gap-1.5 min-h-[68px]">
              <MaterialIcon name="check_circle" size="sm" className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-[12px]">Free trial for 14 days</p>
                <p className="text-[10px] leading-snug text-muted-foreground">Limited access to pro features</p>
              </div>
            </div>
            <div className="flex items-start gap-1.5 min-h-[68px]">
              <MaterialIcon name="check_circle" size="sm" className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-[12px]">No credit card required</p>
                <p className="text-[10px] leading-snug text-muted-foreground">Try before you commit</p>
              </div>
            </div>
            <div className="flex items-start gap-1.5 min-h-[68px]">
              <MaterialIcon name="check_circle" size="sm" className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-[12px]">Trial Period</p>
                <p className="text-[10px] leading-snug text-muted-foreground">Free Trial will end after 14 days automatically</p>
              </div>
            </div>
            <div className="absolute left-6 right-6 bottom-6">
              {activePlan !== 'free' ? (
                <Button onClick={() => handleSelectPlan('free')} variant="default" className="w-full h-[52px] px-3 flex flex-col items-center justify-center gap-0.5 leading-tight" disabled={billingLoading}>
                  <span className="text-xs font-bold">Switch to Free Plan</span>
                </Button>
              ) : (
                <Button variant="default" className="w-full h-[52px] px-3 flex items-center justify-center leading-tight" disabled>
                  <span className="text-xs font-bold">Active</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <PaidPlanCard
          plan="monthly"
          name="Monthly"
          price="$8.99 / month"
          billingLine="Billed monthly. Cancel anytime."
          subscribeLabel={fromAcclimationComplete ? "Subscribe now via Stripe" : "Save plan & add card — charged after Week 4"}
          description="Full access to all Numi features after your free Acclimation Phase. Less than a daily coffee to kickstart your journey!"
        />

        <PaidPlanCard
          plan="annual"
          name="Annually"
          price="$5.99 / month"
          billingLine="Billed at $71.88/year. Save 33%!"
          subscribeLabel={fromAcclimationComplete ? "Subscribe now via Stripe" : "Save plan & add card — charged after Week 4"}
          description="Get 4 months free with annual billing at $71.88/year — save $36 compared to paying monthly."
          badge="Best Value"
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
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            {hasSavedCard && (
              <Button
                type="button"
                variant="outline"
                className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
                onClick={() => {
                  handleRemoveCard();
                  setShowUpdatePayment(false);
                }}
              >
                Remove card
              </Button>
            )}
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
