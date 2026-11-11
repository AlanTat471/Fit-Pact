import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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
import { BackButton } from "@/components/BackButton";
import { VisaIcon, MastercardIcon, AmexIcon, GooglePayIcon, ApplePayIcon } from "@/components/PaymentIcons";
import { useAuth } from "@/contexts/AuthContext";
import { getUserPref, setUserPref } from "@/lib/supabaseUserPrefs";
import { upsertProfile } from "@/lib/supabaseProfile";
import { toast } from "@/hooks/use-toast";
import { callBillingApi } from "@/lib/billingApi";
import { supabase } from "@/lib/supabaseClient";

type PlanType = 'free' | 'monthly' | 'annual';

interface PaymentMethod {
  id: string;
  last4: string;
  expiry: string;
  name: string;
  isDefault: boolean;
}

export const SettingsContent = ({ embedded = false }: { embedded?: boolean }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const tabParam = searchParams.get('tab');
  const defaultTab = tabParam === 'payments' ? 'payments' : tabParam === 'privacy' ? 'privacy' : 'account';
  const checkoutParam = searchParams.get('checkout');

  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [showDeleteAccountFinal, setShowDeleteAccountFinal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [billingInvoices, setBillingInvoices] = useState<Array<{ id: string; date: string | null; description: string; amount: string; currency: string; status: string | null }>>([]);
  const [billingHistoryNote, setBillingHistoryNote] = useState("Charges appear here after Stripe takes a payment.");

  // Privacy state
  const [privacy, setPrivacy] = useState({
    profileVisibility: true,
    shareWorkouts: true,
    shareProgress: false
  });

  // Notifications state (now under Privacy & Notifications)
  const [notifications, setNotifications] = useState({
    workoutReminders: true,
    progressUpdates: true,
    socialUpdates: false,
    emailMarketing: false,
    pushNotifications: true,
    sounds: true,
    vibration: true,
    weeklyReport: true,
    achievementAlerts: true,
  });

  // Plan state: load from Supabase, fallback to localStorage
  const [activePlan, setActivePlan] = useState<PlanType>('free');

  // Payment methods: load from Supabase, fallback to localStorage
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    { id: '1', last4: '4242', expiry: '12/26', name: 'John Doe', isDefault: true }
  ]);

  // Dialogs
  const [showCancelSub, setShowCancelSub] = useState(false);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);
  const [showEditCard, setShowEditCard] = useState(false);
  const [showRemoveCard, setShowRemoveCard] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [removingCardId, setRemovingCardId] = useState<string | null>(null);

  // Card form
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  // Account profile state synced with localStorage
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");

  const settingsHydratedForUserRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user?.id) settingsHydratedForUserRef.current = null;
  }, [user?.id]);

  useEffect(() => {
    if (settingsHydratedForUserRef.current === (user?.id ?? "local")) return;
    settingsHydratedForUserRef.current = user?.id ?? "local";
    if (profile) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
      setEmail(profile.email || "");
      setMobile(profile.mobile || "");
    } else {
      const stored = JSON.parse(localStorage.getItem('userProfile') || '{}');
      setFirstName(stored.firstName || "");
      setLastName(stored.lastName || "");
      setEmail(stored.email || "");
      setMobile(stored.mobile || "");
    }
  }, [profile, user?.id]);

  // Plan chosen before Week 4 (card saved, nothing charged yet)
  const [pendingPlan, setPendingPlan] = useState<string | null>(
    () => localStorage.getItem('pendingPlan') || null,
  );

  // Load activePlan, paymentMethods from Supabase (or localStorage fallback)
  useEffect(() => {
    if (!user?.id) {
      setActivePlan((localStorage.getItem('activePlan') as PlanType) || 'free');
      const saved = localStorage.getItem('paymentMethods');
      if (saved) setPaymentMethods(JSON.parse(saved));
      return;
    }
    (async () => {
      const plan = await getUserPref(user.id, 'activePlan');
      const methods = await getUserPref(user.id, 'paymentMethods');
      const pending = await getUserPref(user.id, 'pendingPlan');
      if (plan) setActivePlan(plan as PlanType);
      else setActivePlan((localStorage.getItem('activePlan') as PlanType) || 'free');
      setPendingPlan(pending || localStorage.getItem('pendingPlan') || null);
      if (methods) {
        try { setPaymentMethods(JSON.parse(methods)); } catch {}
      } else {
        const saved = localStorage.getItem('paymentMethods');
        if (saved) setPaymentMethods(JSON.parse(saved));
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!checkoutParam) return;
    if (checkoutParam === "success") {
      toast({
        title: "Payment successful",
        description: "Your subscription is being activated. This can take a few seconds.",
      });
    } else if (checkoutParam === "cancelled") {
      toast({
        title: "Checkout cancelled",
        description: "No payment was taken. You can subscribe again anytime.",
      });
    }
    const next = new URLSearchParams(searchParams);
    next.delete("checkout");
    const basePath = embedded ? '/profile' : '/settings';
    navigate(`${basePath}?${next.toString()}`, { replace: true });
  }, [checkoutParam, navigate, searchParams]);

  // Listen for plan changes from PaymentDetails (same tab + when returning to this page)
  useEffect(() => {
    const syncPlans = () => {
      setActivePlan((localStorage.getItem('activePlan') as PlanType) || 'free');
      const pending = localStorage.getItem('pendingPlan');
      setPendingPlan(pending === 'monthly' || pending === 'annual' ? pending : null);
    };
    window.addEventListener('storage', syncPlans);
    window.addEventListener('focus', syncPlans);
    syncPlans();
    return () => {
      window.removeEventListener('storage', syncPlans);
      window.removeEventListener('focus', syncPlans);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      let result: Awaited<ReturnType<typeof callBillingApi>>;
      try {
        result = await callBillingApi(undefined, "invoices");
      } catch {
        if (!cancelled) {
          setBillingHistoryNote("Billing history could not be loaded. After the next deploy, paid invoices from Stripe will show in this table.");
        }
        return;
      }
      if (cancelled) return;
      if (result.error) {
        setBillingHistoryNote("Billing history could not be loaded. After the next deploy, paid invoices from Stripe will show in this table.");
        return;
      }
      setBillingInvoices(result.invoices || []);
      setBillingHistoryNote(result.invoices && result.invoices.length > 0
        ? "These are the payments Stripe has recorded for this account."
        : "No payments have been taken yet. Once Stripe charges the card, the invoice will show here.");
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const savePaymentMethods = async (methods: PaymentMethod[]) => {
    setPaymentMethods(methods);
    localStorage.setItem('paymentMethods', JSON.stringify(methods));
    if (user?.id) await setUserPref(user.id, 'paymentMethods', JSON.stringify(methods));
  };

  /** True when the user has only chosen a plan (pre-Week 4) and no money has been taken. */
  const hasPendingPlanOnly =
    activePlan === 'free' &&
    !!pendingPlan &&
    (pendingPlan === 'monthly' || pendingPlan === 'annual');

  const getPlanLabel = () => {
    if (hasPendingPlanOnly) {
      if (pendingPlan === 'annual') {
        return { name: 'Annually (selected)', price: '$72/year — charged after Week 4' };
      }
      return { name: 'Monthly (selected)', price: '$8.99/month — charged after Week 4' };
    }
    switch (activePlan) {
      case 'monthly': return { name: 'Monthly Plan', price: '$8.99/month' };
      case 'annual': return { name: 'Annual Plan', price: '$72/year ($6.00/month equivalent)' };
      default: return { name: 'Free Plan', price: 'Free' };
    }
  };

  const handleCancelSubscription = async () => {
    // Pre-charge: nothing exists in Stripe yet — just clear the selected plan.
    if (hasPendingPlanOnly) {
      localStorage.removeItem('pendingPlan');
      if (user?.id) await setUserPref(user.id, 'pendingPlan', '');
      setPendingPlan(null);
      setShowCancelSub(false);
      window.dispatchEvent(new Event("storage"));
      toast({
        title: "Selected plan cancelled",
        description: "You have not been charged and nothing will be charged after Week 4. You can choose a plan again anytime.",
      });
      return;
    }

    setCancellingSubscription(true);
    try {
      const result = await callBillingApi(undefined, "cancel");
      if (result.error) throw new Error(result.error);

      const endDate = result.currentPeriodEnd
        ? new Date(result.currentPeriodEnd).toLocaleDateString()
        : "the end of your current billing period";

      setShowCancelSub(false);
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
      setCancellingSubscription(false);
    }
  };

  const handleSaveProfile = async () => {
    if (user?.id) {
      const result = await upsertProfile(user.id, {
        first_name: firstName,
        last_name: lastName,
        email,
        mobile,
      });
      if (result.error) {
        toast({ title: "Save failed", description: "Could not update your profile. Please try again.", variant: "destructive" });
        return;
      }
      await refreshProfile();
      toast({ title: "Profile saved", description: "Your changes have been saved." });
    }
    const existing = JSON.parse(localStorage.getItem('userProfile') || '{}');
    const updated = { ...existing, firstName, lastName, email, mobile };
    localStorage.setItem('userProfile', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
  };

  const handleWipeAccountData = async () => {
    if (!user?.id) return;
    setDeletingAccount(true);
    try {
      try {
        await callBillingApi(undefined, "clear-billing");
      } catch {
        // Billing clear is best-effort. Local progress is still wiped below.
      }
      await supabase.from("journeys").delete().eq("user_id", user.id);
      await supabase.from("tdee_values").delete().eq("user_id", user.id);
      await supabase.from("custom_macros").delete().eq("user_id", user.id);
      await supabase.from("user_preferences").delete().eq("user_id", user.id);
      await upsertProfile(user.id, {
        profile_description: "",
        my_why: "",
        my_goals: [],
        my_day_goals: {
          Monday: [],
          Tuesday: [],
          Wednesday: [],
          Thursday: [],
          Friday: [],
          Saturday: [],
          Sunday: [],
        } as never,
        profile_photo: "",
        mobile: "",
        height: "",
        current_weight: "",
      });
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith("sb-")) continue;
        localStorage.removeItem(key);
      }
      setShowDeleteAccountFinal(false);
      window.location.assign("/tdee-calculator");
    } catch (err) {
      toast({
        title: "Could not delete your data",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleEditCard = (card: PaymentMethod) => {
    setEditingCardId(card.id);
    setCardName(card.name);
    setCardNumber('');
    setCardExpiry(card.expiry);
    setCardCvc('');
    setShowEditCard(true);
  };

  const handleSaveEditCard = () => {
    const updated = paymentMethods.map(c =>
      c.id === editingCardId
        ? { ...c, name: cardName || c.name, expiry: cardExpiry || c.expiry, last4: cardNumber ? cardNumber.slice(-4) : c.last4 }
        : c
    );
    savePaymentMethods(updated);
    setShowEditCard(false);
    resetCardForm();
  };

  const handleRemoveCard = () => {
    const updated = paymentMethods.filter(c => c.id !== removingCardId);
    if (updated.length > 0 && !updated.some(c => c.isDefault)) {
      updated[0].isDefault = true;
    }
    savePaymentMethods(updated);
    setShowRemoveCard(false);
    setRemovingCardId(null);
  };

  const handleAddCard = () => {
    if (!cardNumber || !cardExpiry || !cardCvc) return;
    const newCard: PaymentMethod = {
      id: Date.now().toString(),
      last4: cardNumber.replace(/\s/g, '').slice(-4),
      expiry: cardExpiry,
      name: cardName || 'Card Holder',
      isDefault: paymentMethods.length === 0,
    };
    savePaymentMethods([...paymentMethods, newCard]);
    setShowAddCard(false);
    resetCardForm();
  };

  const handleSetDefault = (id: string) => {
    const updated = paymentMethods.map(c => ({ ...c, isDefault: c.id === id }));
    savePaymentMethods(updated);
  };

  const resetCardForm = () => {
    setCardName("");
    setCardNumber("");
    setCardExpiry("");
    setCardCvc("");
    setEditingCardId(null);
  };

  const planInfo = getPlanLabel();

  // Billing address state
  const [billingAddress, setBillingAddress] = useState<{ line1: string; line2: string; city: string; state: string; postcode: string; country: string }>({
    line1: '', line2: '', city: '', state: '', postcode: '', country: ''
  });

  // Load billing address from Supabase or localStorage
  useEffect(() => {
    if (!user?.id) {
      const saved = localStorage.getItem('billingAddress');
      if (saved) setBillingAddress(JSON.parse(saved));
      return;
    }
    getUserPref(user.id, 'billingAddress').then((val) => {
      if (val) setBillingAddress(JSON.parse(val));
      else {
        const saved = localStorage.getItem('billingAddress');
        if (saved) setBillingAddress(JSON.parse(saved));
      }
    });
  }, [user?.id]);

  const handleSaveBillingAddress = async () => {
    localStorage.setItem('billingAddress', JSON.stringify(billingAddress));
    if (user?.id) await setUserPref(user.id, 'billingAddress', JSON.stringify(billingAddress));
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <>
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your account details and settings.</p>
          </div>
        </>
      )}

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="account" className="gap-2">
            <MaterialIcon name="person" size="sm" />
            <span className="hidden sm:inline">Account</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" className="gap-2">
            <MaterialIcon name="shield" size="sm" />
            <span className="hidden sm:inline">Privacy & Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <MaterialIcon name="credit_card" size="sm" />
            <span className="hidden sm:inline">Billing</span>
          </TabsTrigger>
        </TabsList>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information. Changes sync across the app.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" className="h-12" value={firstName} onChange={e => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" className="h-12" value={lastName} onChange={e => setLastName(e.target.value)} />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" className="h-12" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile</Label>
                <Input id="mobile" className="h-12" type="tel" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="04xx xxx xxx" />
              </div>

              <Button variant="default" className="w-full" onClick={handleSaveProfile}>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy & Notifications Tab */}
        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 flex-wrap">
                Privacy Controls
                <Badge variant="secondary" className="text-[10px]">Coming Soon!</Badge>
              </CardTitle>
              <CardDescription>Privacy settings are being built and will be available in a future update.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 opacity-60 pointer-events-none">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Public Profile</Label>
                  <p className="text-sm text-muted-foreground">Make your profile visible to other users</p>
                </div>
                <Switch checked={privacy.profileVisibility} disabled />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Share Workouts</Label>
                  <p className="text-sm text-muted-foreground">Allow others to see your workout activities</p>
                </div>
                <Switch checked={privacy.shareWorkouts} disabled />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Share Progress</Label>
                  <p className="text-sm text-muted-foreground">Share your fitness progress with the community</p>
                </div>
                <Switch checked={privacy.shareProgress} disabled />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>Manage your personal data and account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start opacity-60" disabled>
                  <MaterialIcon name="language" size="sm" className="mr-2" />
                  Download My Data
                  <Badge variant="secondary" className="ml-2 text-[10px]">Coming Soon!</Badge>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => setShowDeleteAccountConfirm(true)}
                >
                  <MaterialIcon name="delete" size="sm" className="mr-2" />
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 flex-wrap">
                Notifications &amp; Alerts
                <Badge variant="secondary" className="text-[10px]">Coming Soon!</Badge>
              </CardTitle>
              <CardDescription>Notification preferences are not available yet.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pointer-events-none">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2"><MaterialIcon name="notifications_active" size="sm" /> Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive push notifications on your device</p>
                </div>
                <Switch checked={notifications.pushNotifications} disabled />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="payments" className="space-y-6">
          {/* Subscription */}
          <Card>
            <CardHeader>
              <CardTitle>Subscription</CardTitle>
              <CardDescription>Manage your subscription and billing information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">{planInfo.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {activePlan === 'free' ? 'Basic features with limited access' : 'Full access to all premium features'}
                  </p>
                  {hasPendingPlanOnly && (
                    <p className="text-xs text-primary mt-1">
                      Selected plan: {pendingPlan === 'annual' ? 'Annually ($72/year)' : 'Monthly ($8.99/month)'} — you will only be charged after completing Acclimation Week 4.
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="mb-2">Active</Badge>
                  <p className="text-sm font-medium">{planInfo.price}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" onClick={() => navigate('/payment-details')}>Change Plan</Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCancelSub(true)}
                  disabled={activePlan === 'free' && !hasPendingPlanOnly}
                  className={activePlan === 'free' && !hasPendingPlanOnly ? 'opacity-50' : ''}
                >
                  {hasPendingPlanOnly ? 'Cancel Selected Plan' : 'Cancel Subscription'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Payment & Billing Details */}
          <Card>
            <CardHeader>
              <CardTitle>Payment & Billing Details</CardTitle>
              <CardDescription>Manage your payment methods and billing address</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Payment icons */}
              <div className="flex items-center gap-1.5">
                <VisaIcon className="h-6 w-auto" />
                <MastercardIcon className="h-6 w-auto" />
                <AmexIcon className="h-6 w-auto" />
                <GooglePayIcon className="h-6 w-auto" />
                <ApplePayIcon className="h-6 w-auto" />
                <MaterialIcon name="credit_card" size="md" className="text-muted-foreground" />
              </div>

              {/* Payment methods list */}
              {paymentMethods.map(card => (
                <div key={card.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-6 bg-gradient-to-r from-blue-600 to-blue-400 rounded" />
                    <div>
                      <p className="font-medium">•••• •••• •••• {card.last4}</p>
                      <p className="text-sm text-muted-foreground">Expires {card.expiry} · {card.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {card.isDefault ? (
                      <Badge variant="secondary">Default</Badge>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => handleSetDefault(card.id)} className="text-xs">Set Default</Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleEditCard(card)}>
                      <MaterialIcon name="edit" size="sm" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {paymentMethods.length < 3 && (
                <Button variant="outline" className="w-full" onClick={() => { resetCardForm(); setShowAddCard(true); }}>
                  Add Payment Method
                </Button>
              )}

              <Separator />

              {/* Billing Address */}
              <h4 className="text-sm font-medium">Billing Address</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Address Line 1</Label>
                  <Input value={billingAddress.line1} onChange={e => setBillingAddress((p: typeof billingAddress) => ({ ...p, line1: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Address Line 2</Label>
                  <Input value={billingAddress.line2} onChange={e => setBillingAddress((p: typeof billingAddress) => ({ ...p, line2: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={billingAddress.city} onChange={e => setBillingAddress((p: typeof billingAddress) => ({ ...p, city: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input value={billingAddress.state} onChange={e => setBillingAddress((p: typeof billingAddress) => ({ ...p, state: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Postcode</Label>
                  <Input value={billingAddress.postcode} onChange={e => setBillingAddress((p: typeof billingAddress) => ({ ...p, postcode: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input value={billingAddress.country} onChange={e => setBillingAddress((p: typeof billingAddress) => ({ ...p, country: e.target.value }))} />
                </div>
              </div>
              <Button variant="default" onClick={handleSaveBillingAddress}>Save Billing Address</Button>
            </CardContent>
          </Card>

          {/* Billing History */}
          <Card>
            <CardHeader>
              <CardTitle>Billing History</CardTitle>
              <CardDescription>View your past transactions and invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="border-b border-white/15 p-3 text-left text-xs font-semibold uppercase tracking-[0.06em] text-white/80">Date</th>
                      <th className="border-b border-white/15 p-3 text-left text-xs font-semibold uppercase tracking-[0.06em] text-white/80">Description</th>
                      <th className="border-b border-white/15 p-3 text-left text-xs font-semibold uppercase tracking-[0.06em] text-white/80">Amount</th>
                      <th className="border-b border-white/15 p-3 text-left text-xs font-semibold uppercase tracking-[0.06em] text-white/80">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center p-6 text-muted-foreground">
                          {billingHistoryNote}
                        </td>
                      </tr>
                    ) : billingInvoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b last:border-0">
                        <td className="p-3">{invoice.date ? new Date(invoice.date).toLocaleDateString() : "—"}</td>
                        <td className="p-3">{invoice.description}</td>
                        <td className="p-3">{invoice.currency} {invoice.amount}</td>
                        <td className="p-3 capitalize">{invoice.status || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Cancel Subscription Dialog */}
      <AlertDialog open={showCancelSub} onOpenChange={setShowCancelSub}>
        <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">{hasPendingPlanOnly ? 'Cancel Selected Plan' : 'Cancel Subscription'}</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              {hasPendingPlanOnly
                ? "You have not been charged yet — the charge only happens after you complete Acclimation Week 4 and confirm. Cancelling your selected plan means nothing will be charged, and the Weight Loss and Maintenance phases stay locked until you subscribe. You can choose a plan again anytime. Continue?"
                : "Your subscription will stop renewing at the end of your current paid billing period. You will keep premium access until that date, and Stripe will not charge you again afterwards. Your saved journey data will not be deleted. Are you sure you want to cancel?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background text-foreground hover:bg-muted border-border">No</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleCancelSubscription();
              }}
              disabled={cancellingSubscription}
            >
              {cancellingSubscription ? "Cancelling…" : (hasPendingPlanOnly ? "Yes, cancel selection" : "Yes, cancel renewal")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Card Dialog */}
      <AlertDialog open={showEditCard} onOpenChange={setShowEditCard}>
        <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Edit Card Details</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name on Card</Label>
              <Input value={cardName} onChange={e => setCardName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Card Number</Label>
              <Input value={cardNumber} onChange={e => setCardNumber(e.target.value.replace(/[^0-9 ]/g, '').slice(0, 19))} placeholder="Enter new card number" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expiry</Label>
                <Input value={cardExpiry} onChange={e => setCardExpiry(e.target.value.replace(/[^0-9/]/g, '').slice(0, 5))} placeholder="MM/YY" />
              </div>
              <div className="space-y-2">
                <Label>CVC</Label>
                <Input value={cardCvc} onChange={e => setCardCvc(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="123" />
              </div>
            </div>
          </div>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={() => {
                setShowEditCard(false);
                setRemovingCardId(editingCardId);
                setShowRemoveCard(true);
              }}
            >
              Remove Card Details
            </Button>
            <div className="flex gap-2 ml-auto">
              <AlertDialogCancel className="bg-background text-foreground hover:bg-muted border-border">Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSaveEditCard}>Save</AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Card Dialog */}
      <AlertDialog open={showRemoveCard} onOpenChange={setShowRemoveCard}>
        <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Remove Card Details</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              You are removing your card details. If the subscription payment cannot be processed, you may be reverted back to 'Free Plan' and lose your premium features. Please remember to 'Add payment method' to ensure you remain active on your plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background text-foreground hover:bg-muted border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleRemoveCard}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Card Dialog */}
      <AlertDialog open={showAddCard} onOpenChange={setShowAddCard}>
        <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Add Payment Method</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border">
              <MaterialIcon name="lock" size="sm" className="text-primary" />
              <span className="text-xs text-muted-foreground">Secure connection — your details are encrypted</span>
            </div>
            <div className="space-y-2">
              <Label>Name on Card</Label>
              <Input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label>Card Number</Label>
              <Input value={cardNumber} onChange={e => setCardNumber(e.target.value.replace(/[^0-9 ]/g, '').slice(0, 19))} placeholder="1234 5678 9012 3456" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expiry</Label>
                <Input value={cardExpiry} onChange={e => setCardExpiry(e.target.value.replace(/[^0-9/]/g, '').slice(0, 5))} placeholder="MM/YY" />
              </div>
              <div className="space-y-2">
                <Label>CVC</Label>
                <Input value={cardCvc} onChange={e => setCardCvc(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="123" />
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background text-foreground hover:bg-muted border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleAddCard}>Add Card</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Confirmation */}
      <AlertDialog open={showDeleteAccountConfirm} onOpenChange={setShowDeleteAccountConfirm}>
        <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete Account</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70 space-y-2">
              <p>You have clicked &apos;Delete Account&apos;. This will delete all the data, progress and tracking to date. You will not be able to retrieve any data once deleted. Are you sure you want to proceed?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                setShowDeleteAccountConfirm(false);
                setShowDeleteAccountFinal(true);
              }}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteAccountFinal} onOpenChange={setShowDeleteAccountFinal}>
        <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete Account</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              You will delete all data, do you wish to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAccount}>No</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingAccount}
              onClick={(e) => {
                e.preventDefault();
                void handleWipeAccountData();
              }}
            >
              {deletingAccount ? "Deleting…" : "Yes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Settings = () => <SettingsContent />;

export default Settings;
