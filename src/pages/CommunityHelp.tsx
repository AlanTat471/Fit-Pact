import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MaterialIcon } from "@/components/ui/material-icon";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

const CommunityHelp = () => {
  const { user } = useAuth();
  const [showSupportForm, setShowSupportForm] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [supportForm, setSupportForm] = useState({
    name: "",
    subject: "",
    description: "",
    email: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});
  const confirmationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss the success popup after 3 seconds (or earlier if the user
  // clicks anywhere). Cleared on unmount to avoid leaks.
  useEffect(() => {
    if (!showConfirmation) return;
    confirmationTimerRef.current = setTimeout(() => {
      setShowConfirmation(false);
    }, 3000);
    return () => {
      if (confirmationTimerRef.current) clearTimeout(confirmationTimerRef.current);
    };
  }, [showConfirmation]);

  const handleSupportSubmit = async () => {
    const errors: Record<string, boolean> = {};
    if (!supportForm.name.trim()) errors.name = true;
    if (!supportForm.subject.trim()) errors.subject = true;
    if (!supportForm.description.trim()) errors.description = true;
    if (!supportForm.email.trim() || !supportForm.email.includes("@")) errors.email = true;

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setSubmitLoading(true);

    // Persist the support enquiry to Supabase. The `support_messages` table
    // (see SQL migration in the project root) stores submitter contact details
    // plus the message body. Admins read these from the Supabase dashboard.
    const { error } = await supabase.from('support_messages').insert({
      user_id: user?.id ?? null,
      name: supportForm.name.trim(),
      email: supportForm.email.trim(),
      subject: supportForm.subject.trim(),
      message: supportForm.description.trim(),
    });

    setSubmitLoading(false);

    if (error) {
      toast({
        title: "Could not submit",
        description: error.message || "Please try again or email alan.tat@hotmail.com directly.",
        variant: "destructive",
      });
      return;
    }

    // Reset the form first so the success popup overlays a clean slate.
    setSupportForm({ name: "", subject: "", description: "", email: "" });
    setShowSupportForm(false);
    setShowConfirmation(true);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Community & Help</h1>
        <p className="text-muted-foreground">Get support and connect with other users</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="transition-all duration-300 hover:shadow-card hover:-translate-y-1">
          <CardHeader>
            <MaterialIcon name="email" className="mb-2 text-primary" size="lg" />
            <CardTitle>Email Support</CardTitle>
            <CardDescription>
              Need help? Our support team is here to assist you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="default"
              className="w-full"
              onClick={() => {
                setSupportForm({ name: "", subject: "", description: "", email: "" });
                setFormErrors({});
                setShowSupportForm(true);
              }}
            >
              Contact Support
            </Button>
          </CardContent>
        </Card>

        <Card className="opacity-60 transition-all duration-300 hover:shadow-card hover:-translate-y-1">
          <CardHeader>
            <MaterialIcon name="chat" className="mb-2 text-muted-foreground" size="lg" />
            <div className="flex items-center gap-2 flex-nowrap">
              <CardTitle className="truncate">FAQ</CardTitle>
              <Badge variant="secondary" className="text-[10px] whitespace-nowrap shrink-0">Coming soon</Badge>
            </div>
            <CardDescription>
              Find answers to frequently asked questions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>
              Browse FAQs
            </Button>
          </CardContent>
        </Card>

        <Card className="opacity-60 transition-all duration-300 hover:shadow-card hover:-translate-y-1">
          <CardHeader>
            <MaterialIcon name="menu_book" className="mb-2 text-muted-foreground" size="lg" />
            <div className="flex items-center gap-2 flex-nowrap">
              <CardTitle className="truncate">Articles</CardTitle>
              <Badge variant="secondary" className="text-[10px] whitespace-nowrap shrink-0">Coming soon</Badge>
            </div>
            <CardDescription>
              Read tips, guides, and expert advice on fitness
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>
              Read Articles
            </Button>
          </CardContent>
        </Card>

        <Card className="opacity-60 transition-all duration-300 hover:shadow-card hover:-translate-y-1">
          <CardHeader>
            <MaterialIcon name="group" className="mb-2 text-muted-foreground" size="lg" />
            <div className="flex items-center gap-2 flex-nowrap">
              <CardTitle className="truncate">Your Community</CardTitle>
              <Badge variant="secondary" className="text-[10px] whitespace-nowrap shrink-0">Coming soon</Badge>
            </div>
            <CardDescription>
              Connect with others on their fitness journey
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>
              Join Community
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Email Support Form Dialog */}
      <AlertDialog open={showSupportForm} onOpenChange={setShowSupportForm}>
        <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <MaterialIcon name="email" size="sm" className="text-primary" />
              Contact Support
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              Fill in the details below and we'll get back to you as soon as possible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="support-name">Name</Label>
              <Input
                id="support-name"
                value={supportForm.name}
                onChange={(e) => {
                  setSupportForm((prev) => ({ ...prev, name: e.target.value }));
                  setFormErrors((prev) => ({ ...prev, name: false }));
                }}
                placeholder="Your name"
                className={formErrors.name ? "border-destructive" : ""}
              />
              {formErrors.name && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-email">Contact Email</Label>
              <Input
                id="support-email"
                type="email"
                value={supportForm.email}
                onChange={(e) => {
                  setSupportForm((prev) => ({ ...prev, email: e.target.value }));
                  setFormErrors((prev) => ({ ...prev, email: false }));
                }}
                placeholder="Email we can reply to"
                className={formErrors.email ? "border-destructive" : ""}
              />
              {formErrors.email && <p className="text-xs text-destructive">Valid email required</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-subject">Subject</Label>
              <Input
                id="support-subject"
                value={supportForm.subject}
                onChange={(e) => {
                  setSupportForm((prev) => ({ ...prev, subject: e.target.value }));
                  setFormErrors((prev) => ({ ...prev, subject: false }));
                }}
                placeholder="Brief summary of your enquiry"
                className={formErrors.subject ? "border-destructive" : ""}
              />
              {formErrors.subject && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-description">Enquiry</Label>
              <Textarea
                id="support-description"
                value={supportForm.description}
                onChange={(e) => {
                  setSupportForm((prev) => ({ ...prev, description: e.target.value }));
                  setFormErrors((prev) => ({ ...prev, description: false }));
                }}
                placeholder="Please describe in detail your problem, provide any feedback or if you have any other enquiries."
                className={`min-h-[120px] resize-none ${formErrors.description ? "border-destructive" : ""}`}
              />
              {formErrors.description && <p className="text-xs text-destructive">Required</p>}
            </div>
          </div>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowSupportForm(false)} disabled={submitLoading}>
              Cancel
            </Button>
            <Button className="gap-2" onClick={handleSupportSubmit} disabled={submitLoading}>
              {submitLoading ? (
                <>
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" aria-hidden />
                  Sending...
                </>
              ) : (
                <>
                  <MaterialIcon name="send" size="sm" />
                  Submit
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Soft confirmation popup — auto-dismisses after 3s or on any click.
          Does NOT use AlertDialog so the user can click anywhere to dismiss. */}
      {showConfirmation && (
        <div
          className="fixed inset-0 z-[120] flex items-start justify-center pt-24 px-4"
          onClick={() => setShowConfirmation(false)}
          role="presentation"
        >
          <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm" aria-hidden />
          <div
            role="status"
            aria-live="polite"
            className="relative z-10 max-w-sm w-full rounded-2xl border border-primary/30 bg-card shadow-2xl p-5 animate-in fade-in-0 zoom-in-95 slide-in-from-top-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              {/* Revolving tick: a rotating ring with a static check inside */}
              <div className="relative shrink-0 h-10 w-10">
                <span className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" aria-hidden />
                <span className="absolute inset-0 flex items-center justify-center text-primary">
                  <MaterialIcon name="check" size="md" />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Thank you for submitting your query</h3>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  We will try our best to get back to you as soon as possible. Your feedback is greatly appreciated. Please allow up to 5 business days for a reply. Thank you!
                </p>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground/70 text-right">Tap anywhere to dismiss</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityHelp;
