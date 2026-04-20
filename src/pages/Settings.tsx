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
import { useUserData } from "@/contexts/UserDataContext";
import { toast } from "@/hooks/use-toast";

type PlanType = 'free' | 'weekly' | 'fortnightly';

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
  const { user, profile } = useAuth();
  const { saveTdee } = useUserData();
  const tabParam = searchParams.get('tab');
  const defaultTab = tabParam === 'payments' ? 'payments' : tabParam === 'privacy' ? 'privacy' : 'account';
  const checkoutParam = searchParams.get('checkout');

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
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showCancelSub, setShowCancelSub] = useState(false);
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
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

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
      setHeight(profile.height || "");
      setWeight(profile.current_weight || "");
    } else {
      const stored = JSON.parse(localStorage.getItem('userProfile') || '{}');
      setFirstName(stored.firstName || "");
      setLastName(stored.lastName || "");
      setEmail(stored.email || "");
      setHeight(stored.height || "");
      setWeight(stored.currentWeight || stored.weight || "");
    }
  }, [profile, user?.id]);

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
      if (plan) setActivePlan(plan as PlanType);
      else setActivePlan((localStorage.getItem('activePlan') as PlanType) || 'free');
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

  // Listen for plan changes from PaymentDetails page (cross-tab)
  useEffect(() => {
    const handleStorage = () => {
      setActivePlan((localStorage.getItem('activePlan') as PlanType) || 'free');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const savePaymentMethods = async (methods: PaymentMethod[]) => {
    setPaymentMethods(methods);
    localStorage.setItem('paymentMethods', JSON.stringify(methods));
    if (user?.id) await setUserPref(user.id, 'paymentMethods', JSON.stringify(methods));
  };

  const getPlanLabel = () => {
    switch (activePlan) {
      case 'weekly': return { name: 'Weekly Plan', price: '$4.99/week' };
      case 'fortnightly': return { name: 'Fortnightly Plan', price: '$8.99/billed fortnightly' };
      default: return { name: 'Free Plan', price: 'Free' };
    }
  };

  const handleChangePlan = async (plan: PlanType) => {
    setActivePlan(plan);
    localStorage.setItem('activePlan', plan);
    if (user?.id) await setUserPref(user.id, 'activePlan', plan);
    setShowChangePlan(false);
    window.dispatchEvent(new Event('storage'));
  };

  const handleCancelSubscription = async () => {
    setActivePlan('free');
    localStorage.setItem('activePlan', 'free');
    if (user?.id) await setUserPref(user.id, 'activePlan', 'free');
    setShowCancelSub(false);
    window.dispatchEvent(new Event('storage'));
  };

  const handleSaveProfile = async () => {
    if (user?.id) {
      const result = await upsertProfile(user.id, {
        first_name: firstName,
        last_name: lastName,
        email,
        height,
        current_weight: weight,
      });
      if (result.error) {
        toast({ title: "Save failed", description: "Could not update your profile. Please try again.", variant: "destructive" });
        return;
      }
      toast({ title: "Profile saved", description: "Your changes have been saved." });
      if (weight) saveTdee({ current_weight: weight });
    }
    const existing = JSON.parse(localStorage.getItem('userProfile') || '{}');
    const updated = { ...existing, firstName, lastName, email, height, weight, currentWeight: weight };
    localStorage.setItem('userProfile', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
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
                  <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input id="height" value={height} onChange={e => setHeight(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input id="weight" value={weight} onChange={e => setWeight(e.target.value)} />
                </div>
              </div>

              <Button variant="default" onClick={handleSaveProfile}>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy & Notifications Tab */}
        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Privacy Controls</CardTitle>
              <CardDescription>Manage your privacy and data sharing preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Public Profile</Label>
                  <p className="text-sm text-muted-foreground">Make your profile visible to other users</p>
                </div>
                <Switch checked={privacy.profileVisibility} onCheckedChange={c => setPrivacy(p => ({ ...p, profileVisibility: c }))} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Share Workouts</Label>
                  <p className="text-sm text-muted-foreground">Allow others to see your workout activities</p>
                </div>
                <Switch checked={privacy.shareWorkouts} onCheckedChange={c => setPrivacy(p => ({ ...p, shareWorkouts: c }))} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Share Progress</Label>
                  <p className="text-sm text-muted-foreground">Share your fitness progress with the community</p>
                </div>
                <Switch checked={privacy.shareProgress} onCheckedChange={c => setPrivacy(p => ({ ...p, shareProgress: c }))} />
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Data Management</h4>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start">
                    <MaterialIcon name="language" size="sm" className="mr-2" />
                    Download My Data
                  </Button>
                  <Button variant="outline" className="w-full justify-start border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                    <MaterialIcon name="delete" size="sm" className="mr-2" />
                    Delete Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notifications & Alerts</CardTitle>
              <CardDescription>Choose what notifications and alerts you want to receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2"><MaterialIcon name="notifications_active" size="sm" /> Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive push notifications on your device</p>
                </div>
                <Switch checked={notifications.pushNotifications} onCheckedChange={c => setNotifications(p => ({ ...p, pushNotifications: c }))} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2"><MaterialIcon name="notifications" size="sm" /> Workout Reminders</Label>
                  <p className="text-sm text-muted-foreground">Get notified about scheduled workouts</p>
                </div>
                <Switch checked={notifications.workoutReminders} onCheckedChange={c => setNotifications(p => ({ ...p, workoutReminders: c }))} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Progress Updates</Label>
                  <p className="text-sm text-muted-foreground">Weekly progress summaries</p>
                </div>
                <Switch checked={notifications.progressUpdates} onCheckedChange={c => setNotifications(p => ({ ...p, progressUpdates: c }))} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Social Updates</Label>
                  <p className="text-sm text-muted-foreground">Friend activities and challenges</p>
                </div>
                <Switch checked={notifications.socialUpdates} onCheckedChange={c => setNotifications(p => ({ ...p, socialUpdates: c }))} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Weekly Report Email</Label>
                  <p className="text-sm text-muted-foreground">Receive a weekly summary email</p>
                </div>
                <Switch checked={notifications.weeklyReport} onCheckedChange={c => setNotifications(p => ({ ...p, weeklyReport: c }))} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Achievement Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified when you unlock achievements</p>
                </div>
                <Switch checked={notifications.achievementAlerts} onCheckedChange={c => setNotifications(p => ({ ...p, achievementAlerts: c }))} />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2"><MaterialIcon name="volume_up" size="sm" /> Sounds</Label>
                  <p className="text-sm text-muted-foreground">Play sounds for notifications</p>
                </div>
                <Switch checked={notifications.sounds} onCheckedChange={c => setNotifications(p => ({ ...p, sounds: c }))} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2"><MaterialIcon name="vibration" size="sm" /> Vibration</Label>
                  <p className="text-sm text-muted-foreground">Vibrate on notifications</p>
                </div>
                <Switch checked={notifications.vibration} onCheckedChange={c => setNotifications(p => ({ ...p, vibration: c }))} />
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
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="mb-2">Active</Badge>
                  <p className="text-sm font-medium">{planInfo.price}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" onClick={() => setShowChangePlan(true)}>Change Plan</Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCancelSub(true)}
                  disabled={activePlan === 'free'}
                  className={activePlan === 'free' ? 'opacity-50' : ''}
                >
                  Cancel Subscription
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
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Description</th>
                      <th className="text-left p-3 font-medium">Amount</th>
                      <th className="text-left p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={4} className="text-center p-6 text-muted-foreground">
                        No transactions yet
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Change Plan Dialog */}
      <AlertDialog open={showChangePlan} onOpenChange={setShowChangePlan}>
        <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Change Plan</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              Select the plan you'd like to switch to.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            {[
              { plan: 'free' as PlanType, label: 'Free Plan', price: 'Free' },
              { plan: 'weekly' as PlanType, label: 'Weekly', price: '$4.99/week' },
              { plan: 'fortnightly' as PlanType, label: 'Fortnightly', price: '$8.99/billed fortnightly' },
            ].map(({ plan, label, price }) => (
              <button
                key={plan}
                onClick={() => handleChangePlan(plan)}
                className={`w-full flex items-center justify-between p-4 border rounded-lg transition-colors ${activePlan === plan ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
              >
                <div className="text-left">
                  <p className="font-medium">{label}</p>
                  <p className="text-sm text-muted-foreground">{price}</p>
                </div>
                {activePlan === plan && <Badge variant="secondary">Current</Badge>}
              </button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background text-foreground hover:bg-muted border-border">Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Subscription Dialog */}
      <AlertDialog open={showCancelSub} onOpenChange={setShowCancelSub}>
        <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Cancel Subscription</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              You will lose your premium features and revert back to the 'Free Plan'. You might also lose all your progress. Are you sure you want to cancel subscription?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background text-foreground hover:bg-muted border-border">No</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleCancelSubscription}>Yes</AlertDialogAction>
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
    </div>
  );
};

const Settings = () => <SettingsContent />;

export default Settings;
