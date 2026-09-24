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
import { getSubscription, SubscriptionRow } from "@/lib/supabaseSubscription";
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
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  // Plan chosen before Week 4 (card saved, nothing charged yet).
  const [pendingPlanChoice, setPendingPlanChoice] = useState<PlanType | null>(
    () => (localStorage.getItem('pendingPlan') as PlanType) || null,
  );

  const refreshSubscription = async () => {
    if (!user?.id) return;
    const sub = await getSubscription(user.id);
    setSubscription(sub);
  };

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
      setPendingPlanChoice((state.pendingPlan as PlanType) || null);
      await refreshSubscription();
    })();
  }, [user?.id]);

  // True when a real Stripe subscription is currently paid up (even if a
  // cancellation is scheduled for the end of the period).
  const hasActiveStripeSub =
    !!subscription?.stripe_subscription_id &&
    (subscription.status === "active" ||
      subscription.status === "trialing" ||
      subscription.status === "past_due");

  const formatDMY = (d: Date) => d.toLocaleDateString("en-GB");
  /** DD/MM/YY — used where space is tight, e.g. inside a button sub-line. */
  const formatDMYShort = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
  /** Last day of paid access, inclusive (the day before Stripe's renewal date). */
  const paidUntilDate = periodEnd ? formatDMY(new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000)) : null;
  const paidUntilShort = periodEnd ? formatDMYShort(new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000)) : null;
  /** The Stripe renewal date — the day the next charge (or lock-out) happens. */
  const renewalDate = periodEnd ? formatDMY(periodEnd) : null;
  const planDisplayName = (p: PlanType) => (p === "monthly" ? "Monthly" : p === "annual" ? "Annually" : "Free");
  const planPriceLabel = (p: PlanType) => (p === "monthly" ? "$8.99" : p === "annual" ? "$72" : "$0");

  useEffect(() => {
    const setup = searchParams.get("setup");
    if (setup === "success") {
      const plan = searchParams.get("plan") as PlanType | null;
      if (plan === "monthly" || plan === "annual") {
        localStorage.setItem("pendingPlan", plan);
        if (user?.id) setUserPref(user.id, "pendingPlan", plan);
        setPendingPlanChoice(plan);
      }
      localStorage.setItem("paymentMethodSaved", "true");
      if (user?.id) setUserPref(user.id, "paymentMethodSaved", "true");
      setPaymentMethodSaved(true);
      toast({
        title: "Card saved",
        description: "Your plan and payment method are saved. You can change or cancel this selection anytime. You will only be charged when you complete Acclimation Week 4 and click Subscribe.",
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

  const [showSwitchToFree, setShowSwitchToFree] = useState(false);
  const [showResumePlan, setShowResumePlan] = useState(false);
  const [switchTargetPlan, setSwitchTargetPlan] = useState<PlanType | null>(null);
  const [showCancelPendingPlan, setShowCancelPendingPlan] = useState(false);
  const [showPaidPlanConfirm, setShowPaidPlanConfirm] = useState(false);
  const [paidPlanToConfirm, setPaidPlanToConfirm] = useState<PlanType | null>(null);

  const setActivePlanEverywhere = async (plan: PlanType) => {
    setActivePlan(plan);
    localStorage.setItem("activePlan", plan);
    if (user?.id) await setUserPref(user.id, "activePlan", plan);
  };

  const handleSelectPlan = async (plan: PlanType) => {
    // ── An active (paid-up) Stripe subscription exists: never send the user to
    // the payment screen and never create a second subscription/charge.
    if (hasActiveStripeSub && subscription) {
      if (plan === "free") {
        // Warn: access continues until the last paid day, then premium locks.
        setShowSwitchToFree(true);
        return;
      }
      if (plan === subscription.plan_type) {
        if (subscription.cancel_at_period_end) {
          // They cancelled earlier and want back in: resume, no charge.
          setShowResumePlan(true);
        } else {
          // Already subscribed to this plan — repair the label if it was stale.
          await setActivePlanEverywhere(plan);
          toast({
            title: "Already subscribed",
            description: `The ${planDisplayName(plan)} plan is already active. No payment was taken.`,
          });
        }
        return;
      }
      // Different paid plan: switch on the existing subscription (no charge today).
      setSwitchTargetPlan(plan);
      return;
    }

    // ── No active Stripe subscription below this point ──
    if (plan === "free") {
      if (pendingPlanChoice && pendingPlanChoice !== "free") {
        // A plan is selected for after Week 4 — confirm cancelling it.
        setShowCancelPendingPlan(true);
        return;
      }
      await setActivePlanEverywhere("free");
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

    // Card already saved during the free Acclimation window: changing the chosen
    // plan just updates the pending plan — no need to visit Stripe again.
    if (!fromAcclimationComplete && paymentMethodSaved) {
      localStorage.setItem("pendingPlan", plan);
      await setUserPref(user.id, "pendingPlan", plan);
      setPendingPlanChoice(plan);
      window.dispatchEvent(new Event("storage"));
      toast({
        title: "Plan updated",
        description: `Your card is already saved. You will be charged for the ${planDisplayName(plan)} plan after you complete Acclimation Week 4. You can change or cancel this anytime before then.`,
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

  const confirmCancelPendingPlan = async () => {
    localStorage.removeItem("pendingPlan");
    if (user?.id) await setUserPref(user.id, "pendingPlan", "");
    setPendingPlanChoice(null);
    await setActivePlanEverywhere("free");
    setShowCancelPendingPlan(false);
    window.dispatchEvent(new Event("storage"));
    toast({
      title: "Selected plan cancelled",
      description: "You have not been charged and nothing will be charged after Week 4. You can choose a plan again anytime.",
    });
  };

  const confirmSwitchToFree = async () => {
    setBillingLoading(true);
    try {
      const result = await callBillingApi(undefined, "cancel");
      if (result.error) throw new Error(result.error);
      const endDate = result.currentPeriodEnd
        ? formatDMY(new Date(new Date(result.currentPeriodEnd).getTime() - 24 * 60 * 60 * 1000))
        : paidUntilDate || "the end of your current billing period";
      setShowSwitchToFree(false);
      toast({
        title: "Switch to Free scheduled",
        description: `You keep full premium access until ${endDate} (inclusive). After that you move to the Free Plan and will not be charged again.`,
      });
      await refreshSubscription();
    } catch (err) {
      toast({
        title: "Could not switch to Free",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBillingLoading(false);
    }
  };

  const confirmResumePlan = async () => {
    setBillingLoading(true);
    try {
      const result = await callBillingApi(undefined, "resume");
      if (result.error) throw new Error(result.error);
      const plan = (result.planType as PlanType) || subscription?.plan_type || "monthly";
      await setActivePlanEverywhere(plan);
      setShowResumePlan(false);
      toast({
        title: "Welcome back!",
        description: `Your ${planDisplayName(plan)} plan continues. Next renewal ${result.currentPeriodEnd ? formatDMY(new Date(result.currentPeriodEnd)) : renewalDate}. You were not charged today.`,
      });
      await refreshSubscription();
    } catch (err) {
      toast({
        title: "Could not resume subscription",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBillingLoading(false);
    }
  };

  const confirmSwitchPlan = async () => {
    if (!switchTargetPlan || switchTargetPlan === "free") return;
    setBillingLoading(true);
    try {
      const result = await callBillingApi(switchTargetPlan as "monthly" | "annual", "switch");
      if (result.error) throw new Error(result.error);
      await setActivePlanEverywhere(switchTargetPlan);
      localStorage.setItem("pendingPlan", switchTargetPlan);
      if (user?.id) await setUserPref(user.id, "pendingPlan", switchTargetPlan);
      const startDate = result.currentPeriodEnd ? formatDMY(new Date(result.currentPeriodEnd)) : renewalDate;
      setSwitchTargetPlan(null);
      toast({
        title: "Plan switched",
        description: `You keep your current paid access until ${paidUntilDate} (inclusive). The ${planDisplayName(switchTargetPlan)} plan starts on ${startDate} and ${planPriceLabel(switchTargetPlan)} will be charged on that date. Nothing was charged today.`,
      });
      await refreshSubscription();
    } catch (err) {
      toast({
        title: "Could not switch plan",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBillingLoading(false);
    }
  };

  // Always uses Stripe's card-saving (setup) flow — never creates a charge or a
  // second subscription, so it is safe for subscribed and unsubscribed users alike.
  const handleAddPaymentViaStripe = async () => {
    if (!user?.id) {
      toast({
        title: "Sign in required",
        description: "Please sign in before adding a payment method.",
        variant: "destructive",
      });
      return;
    }
    const plan =
      (subscription?.plan_type && subscription.plan_type !== "free"
        ? subscription.plan_type
        : (localStorage.getItem("pendingPlan") as PlanType)) || "monthly";
    if (plan === "free") {
      toast({
        title: "Choose a plan first",
        description: "Select Monthly or Annually below, then add your card securely via Stripe.",
      });
      return;
    }
    setBillingLoading(true);
    try {
      const result = await callBillingApi(plan as "monthly" | "annual", "setup");
      if (result.error) throw new Error(result.error);
      if (!result.url) throw new Error("Checkout URL is missing from billing response.");
      window.location.href = result.url;
    } catch (err) {
      toast({
        title: "Could not open Stripe",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBillingLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setBillingLoading(true);
    try {
      const result = await callBillingApi(undefined, "cancel");
      if (result.error) throw new Error(result.error);
      const endDate = result.currentPeriodEnd
        ? new Date(result.currentPeriodEnd).toLocaleDateString()
        : "the end of your current billing period";
      setShowCancelSubscription(false);
      toast({
        title: "Subscription cancellation scheduled",
        description: `You will keep access until ${endDate}. Stripe will not renew or charge you again after that date.`,
      });
    } catch (err) {
      toast({
        title: "Could not cancel subscription",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBillingLoading(false);
    }
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

  /** A paid plan is only live once Stripe has actually unlocked premium. */
  const paidPlanIsActive =
    premiumUnlocked && (activePlan === "monthly" || activePlan === "annual");

  // Pre-Week-4: a Monthly/Annual choice with a saved card, nothing charged yet.
  // A plan that is already live rules this out. Without that guard a stale
  // pendingPlan left over from an earlier choice made this page announce
  // "Monthly is selected" while the live plan — and Settings — said Annual.
  const hasPendingSelection =
    !paidPlanIsActive &&
    !hasActiveStripeSub &&
    paymentMethodSaved &&
    !!pendingPlanChoice &&
    (pendingPlanChoice === "monthly" || pendingPlanChoice === "annual");

  /**
   * Exactly one card is Active. The chosen paid plan wins even before Week 4
   * is charged, so Free cannot stay Active beside a selected Monthly/Annual.
   */
  const isPlanActive = (plan: PlanType) => {
    if (paidPlanIsActive) return plan === activePlan;
    if (hasPendingSelection) return plan === pendingPlanChoice;
    return plan === "free";
  };

  type PlanStatus = "active" | "inactive";
  const planStatus = (plan: PlanType): PlanStatus =>
    isPlanActive(plan) ? "active" : "inactive";
  const statusWord = (s: PlanStatus) => (s === "active" ? "Active" : "Inactive");
  const planCardName = (p: PlanType) =>
    p === "monthly" ? "Monthly Plan" : p === "annual" ? "Annual Plan" : "Free Plan";

  /**
   * First tap from Free onto Monthly/Annual explains the charge timing.
   * Switching Monthly <-> Annual skips this — that is already a paid choice.
   */
  const requestSelectPlan = (plan: PlanType) => {
    if (
      (plan === "monthly" || plan === "annual") &&
      !hasActiveStripeSub &&
      !paidPlanIsActive &&
      !hasPendingSelection
    ) {
      setPaidPlanToConfirm(plan);
      setShowPaidPlanConfirm(true);
      return;
    }
    void handleSelectPlan(plan);
  };

  const confirmPaidPlanSelection = () => {
    const plan = paidPlanToConfirm;
    setShowPaidPlanConfirm(false);
    setPaidPlanToConfirm(null);
    if (plan === "monthly" || plan === "annual") {
      void handleSelectPlan(plan);
    }
  };

  // Self-heal: a live paid plan sitting next to a *different* pending plan is
  // spent data from before that plan activated. Clearing it repairs accounts
  // that already hold the bad combination, without the user doing anything.
  useEffect(() => {
    if (!paidPlanIsActive || !pendingPlanChoice || pendingPlanChoice === activePlan) return;
    localStorage.removeItem("pendingPlan");
    setPendingPlanChoice(null);
    if (user?.id) void setUserPref(user.id, "pendingPlan", "");
    window.dispatchEvent(new Event("storage"));
  }, [paidPlanIsActive, pendingPlanChoice, activePlan, user?.id]);

  /**
   * Last day of the free 4-week Acclimation window. The Dashboard/journey
   * owns these dates; we read the value it stores rather than recalculating
   * the phase here. Null until the user sets their journey start date.
   */
  const freeTrialEndLabel = (() => {
    const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
    const toDmy = (iso: string) => {
      const [y, m, d] = iso.split("-");
      return `${d}/${m}/${y.slice(2)}`;
    };
    try {
      const end = localStorage.getItem("dashboardAcclimationPhaseEndDate");
      if (end && isoPattern.test(end)) return toDmy(end);
      const start = localStorage.getItem("dashboardAcclimationPhaseStartDate");
      if (start && isoPattern.test(start)) {
        const [y, m, d] = start.split("-").map(Number);
        const dt = new Date(y, m - 1, d);
        // 4 weeks inclusive: day 1 + 27 days = day 28.
        dt.setDate(dt.getDate() + 27);
        return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getFullYear()).slice(2)}`;
      }
    } catch {
      /* private mode / quota */
    }
    return null;
  })();

  /**
   * Header shared by the Free, Monthly and Annually cards, so all three read
   * identically: heading (+ badge), Active/Inactive status, price, blurb.
   */
  const PlanCardHeader = ({ name, status, priceMain, priceUnit, billingLine, description, badgeLine1, badgeLine2 }: {
    name: string;
    status: PlanStatus;
    priceMain: string;
    priceUnit: string;
    billingLine: string;
    description: string;
    badgeLine1?: string;
    badgeLine2?: string;
  }) => (
    <CardHeader className="pb-3 space-y-0 gap-0">
      {/* Same heading-row height on all three cards so Active/Inactive
          start on one line. Annual's one-line pill sits in this row,
          top-right; it does not use flex-col (that made a tall circle). */}
      <div className="relative min-h-[22px] pr-1">
        <h3 className="text-[14px] font-semibold leading-[22px] tracking-tight whitespace-nowrap">
          {name}
        </h3>
        {badgeLine1 && (
          <Badge
            variant="secondary"
            className="absolute -top-5 left-1/2 -translate-x-1/2 inline-flex flex-row items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[7px] leading-none uppercase tracking-wide"
          >
            {[badgeLine1, badgeLine2].filter(Boolean).join(" ")}
          </Badge>
        )}
      </div>
      <p className={`text-[12px] font-bold leading-tight mt-1 ${status === "inactive" ? "text-on-surface-variant" : "text-primary"}`}>
        {statusWord(status)}
      </p>
      <div className="mt-2">
        <p className="flex items-baseline gap-1 leading-none">
          <span className="text-2xl font-extrabold tracking-tight text-on-surface">{priceMain}</span>
          <span className="text-[12px] font-semibold text-on-surface-variant">{priceUnit}</span>
        </p>
        <p className="text-[10px] leading-snug text-on-surface-variant mt-1">{billingLine}</p>
      </div>
      <p className="text-[11px] leading-[1.35] text-on-surface-variant mt-2 min-h-[90px]">{description}</p>
    </CardHeader>
  );

  /** Two-line button label, identical on every card so the three line up. */
  const ButtonLabel = ({ main, sub }: { main: string; sub: string }) => (
    <>
      <span className="text-[12px] font-bold leading-tight text-center">{main}</span>
      <span className="text-[10px] opacity-90 text-center leading-snug max-w-full whitespace-normal">{sub}</span>
    </>
  );

  const planButtonClass =
    "w-full min-h-[56px] h-auto py-2.5 px-2 flex flex-col items-center justify-center gap-0.5 leading-tight";

  const PaidPlanCard = ({ plan, name, priceMain, priceUnit, billingLine, description, badgeLine1, badgeLine2 }: {
    plan: PlanType;
    name: string;
    priceMain: string;
    priceUnit: string;
    billingLine: string;
    description: string;
    badgeLine1?: string;
    badgeLine2?: string;
  }) => (
    <Card className={`relative border flex flex-col min-h-[540px] rounded-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-card ${planStatus(plan) !== 'inactive' ? 'border-primary shadow-glow bg-gradient-hero' : 'border-outline-variant bg-surface-container-low'}`}>
      <PlanCardHeader
        name={name}
        status={planStatus(plan)}
        priceMain={priceMain}
        priceUnit={priceUnit}
        billingLine={billingLine}
        description={description}
        badgeLine1={badgeLine1}
        badgeLine2={badgeLine2}
      />
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
          {planStatus(plan) === 'active' ? (
            hasActiveStripeSub && subscription?.cancel_at_period_end && subscription.plan_type === plan ? (
              // Only place in the app that can undo a scheduled cancellation.
              <Button onClick={() => setShowResumePlan(true)} variant="default" className={planButtonClass} disabled={billingLoading}>
                <ButtonLabel main="Resume Plan" sub={`(access ends ${paidUntilShort ?? paidUntilDate} or select a different plan)`} />
              </Button>
            ) : (
              <Button variant="default" className={planButtonClass} disabled>
                <ButtonLabel main="Selected ✓" sub="(your current active plan)" />
              </Button>
            )
          ) : (
            <Button onClick={() => requestSelectPlan(plan)} variant="default" className={planButtonClass} disabled={billingLoading}>
              <ButtonLabel main="Select Plan" sub="(plan not active)" />
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

      {hasPendingSelection && !fromAcclimationComplete && (
        <div className="max-w-4xl mx-auto rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-sm text-on-surface space-y-1">
          <p>
            <span className="font-semibold">{planCardName(pendingPlanChoice!)}</span> is selected. You have not been charged yet — the charge happens after Acclimation Week 4.
          </p>
          <p className="text-on-surface-variant text-[12px]">
            You can switch Monthly Plan / Annual Plan anytime, or tap Select Plan on the Free card (or Cancel in Settings) to clear this selection with no charge.
          </p>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto items-stretch">
        {/* Free Plan */}
        <Card className={`relative border flex flex-col min-h-[540px] rounded-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-card ${planStatus('free') !== 'inactive' ? 'border-primary shadow-glow bg-gradient-hero' : 'border-outline-variant bg-surface-container-low'}`}>
          <PlanCardHeader
            name="Free Plan"
            status={planStatus('free')}
            priceMain="$0"
            priceUnit="/ 4 weeks"
            billingLine="No card required to start"
            description="There is nothing wrong with trying before buying! Get 4 weeks limited access to get a feel of the app before you subscribe!"
          />
          <CardContent className="flex-1 flex flex-col pb-28">
            <div className="flex items-start gap-1.5 min-h-[68px]">
              <MaterialIcon name="check_circle" size="sm" className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-[12px]">Free trial for 4 weeks</p>
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
                <p className="text-[10px] leading-snug text-muted-foreground">
                  {freeTrialEndLabel
                    ? `Your Free Trial will end on ${freeTrialEndLabel}`
                    : "Your Free Trial will end 4 weeks after your journey start date"}
                </p>
              </div>
            </div>
            <div className="absolute left-4 right-4 bottom-6">
              {hasPendingSelection ? (
                <Button onClick={() => handleSelectPlan('free')} variant="default" className={planButtonClass} disabled={billingLoading}>
                  <ButtonLabel main="Select Plan" sub="(cancels your current plan)" />
                </Button>
              ) : planStatus('free') === 'active' ? (
                <Button variant="default" className={planButtonClass} disabled>
                  <ButtonLabel main="Selected ✓" sub="(your current active plan)" />
                </Button>
              ) : (
                <Button onClick={() => handleSelectPlan('free')} variant="default" className={planButtonClass} disabled={billingLoading}>
                  <ButtonLabel main="Select Plan" sub="(plan not active)" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <PaidPlanCard
          plan="monthly"
          name="Monthly Plan"
          priceMain="$8.99"
          priceUnit="/month"
          billingLine="Billed $8.99 monthly"
          description="Full access to all Numi features after your free Acclimation Phase. Less than a daily coffee to kickstart your journey!"
        />

        <PaidPlanCard
          plan="annual"
          name="Annual Plan"
          priceMain="$6.00"
          priceUnit="/month"
          billingLine="Billed $72 yearly"
          description="Get 4 months free compared to Monthly - you save $35.88 every year. Full access to all Numi features after your free Acclimation Phase."
          badgeLine1="Best Value"
          badgeLine2="(4 months free)"
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

      {/* Free → paid: explain charge timing before Stripe / saving the choice */}
      <AlertDialog
        open={showPaidPlanConfirm}
        onOpenChange={(open) => {
          setShowPaidPlanConfirm(open);
          if (!open) setPaidPlanToConfirm(null);
        }}
      >
        <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <MaterialIcon name="info" size="sm" className="text-primary" />
              You have selected a Paid Plan
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70 space-y-2">
              <p>
                You have selected a &apos;Paid Plan&apos;. You will be charged after 4 weeks of Acclimation and on the frequency you have selected.
              </p>
              <p>
                After Acclimation Phase, you will have access to &apos;Weight Loss Phase&apos; and &apos;Maintenance Phase&apos; and premium features to help you on your weight loss journey.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background text-foreground hover:bg-muted border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={(event) => {
                event.preventDefault();
                confirmPaidPlanSelection();
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Pending (pre-charge) Plan Dialog */}
      <AlertDialog open={showCancelPendingPlan} onOpenChange={setShowCancelPendingPlan}>
        <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <MaterialIcon name="info" size="sm" className="text-primary" />
              Cancel your selected plan?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70 space-y-2">
              <p>You currently have the <span className="font-semibold text-foreground">{planDisplayName(pendingPlanChoice || 'monthly')}</span> plan selected. You have <span className="font-semibold text-foreground">not been charged</span> — the charge only happens after you complete Acclimation Week 4 and confirm.</p>
              <p>If you cancel this selection, nothing will be charged and the Weight Loss and Maintenance phases will stay locked until you subscribe. You can choose a plan again anytime.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background text-foreground hover:bg-muted border-border">No, keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmCancelPendingPlan();
              }}
            >
              Yes, cancel selection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Switch to Free Plan Warning Dialog */}
      <AlertDialog open={showSwitchToFree} onOpenChange={setShowSwitchToFree}>
        <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <MaterialIcon name="warning" size="sm" className="text-destructive" />
              Switch to Free Plan?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70 space-y-2">
              <p>You are paid up until <span className="font-semibold text-foreground">{paidUntilDate || "the end of your current billing period"}</span> (inclusive). Once the paid premium is finished, you will lose access to premium features.</p>
              <p>There are no pro-rata refunds — you keep full premium access for the period you have already paid.</p>
              <p className="font-medium text-foreground">Are you sure you want to continue?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background text-foreground hover:bg-muted border-border">No</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={billingLoading}
              onClick={(event) => {
                event.preventDefault();
                void confirmSwitchToFree();
              }}
            >
              {billingLoading ? "Processing…" : "Yes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resume Subscription Dialog (was cancelled, coming back within paid period) */}
      <AlertDialog open={showResumePlan} onOpenChange={setShowResumePlan}>
        <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <MaterialIcon name="celebration" size="sm" className="text-primary" />
              Welcome back!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70 space-y-2">
              <p>Your {planDisplayName(subscription?.plan_type || 'monthly')} plan will simply continue — <span className="font-semibold text-foreground">you will not be charged today</span> and you will not lose any paid time.</p>
              <p>Next renewal: <span className="font-semibold text-foreground">{renewalDate || "your normal renewal date"}</span>.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background text-foreground hover:bg-muted border-border">No</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={billingLoading}
              onClick={(event) => {
                event.preventDefault();
                void confirmResumePlan();
              }}
            >
              {billingLoading ? "Processing…" : "Continue my plan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Switch Plan (Monthly <-> Annually) Dialog */}
      <AlertDialog open={switchTargetPlan !== null} onOpenChange={(open) => { if (!open) setSwitchTargetPlan(null); }}>
        <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <MaterialIcon name="swap_horiz" size="sm" className="text-primary" />
              Switch to {planDisplayName(switchTargetPlan || 'monthly')}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70 space-y-2">
              <p>You are paid up until <span className="font-semibold text-foreground">{paidUntilDate || "the end of your current billing period"}</span> (inclusive) on your current {planDisplayName(subscription?.plan_type || 'monthly')} plan — you keep every day you have already paid for.</p>
              <p>Your new {planDisplayName(switchTargetPlan || 'monthly')} plan starts on <span className="font-semibold text-foreground">{renewalDate || "the day after your paid period ends"}</span>, and <span className="font-semibold text-foreground">{planPriceLabel(switchTargetPlan || 'monthly')}</span> will be charged on that date.</p>
              <p className="font-medium text-foreground">Nothing will be charged today. Continue?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background text-foreground hover:bg-muted border-border">No</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={billingLoading}
              onClick={(event) => {
                event.preventDefault();
                void confirmSwitchPlan();
              }}
            >
              {billingLoading ? "Processing…" : "Yes, switch plan"}
            </AlertDialogAction>
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
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={billingLoading}
              onClick={(event) => {
                event.preventDefault();
                void handleCancelSubscription();
              }}
            >
              {billingLoading ? "Cancelling…" : "Yes, Cancel Subscription"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PaymentDetails;
