import React, { useState } from "react";
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

const CommunityHelp = () => {
  const [showSupportForm, setShowSupportForm] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [supportForm, setSupportForm] = useState({
    name: "",
    subject: "",
    description: "",
    email: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  const handleSupportSubmit = () => {
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

    const mailtoSubject = encodeURIComponent(supportForm.subject);
    const mailtoBody = encodeURIComponent(
      `Name: ${supportForm.name}\n\nContact Email: ${supportForm.email}\n\nEnquiry:\n${supportForm.description}`
    );
    window.open(`mailto:alan.tat@hotmail.com?subject=${mailtoSubject}&body=${mailtoBody}`, "_blank");

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
        <Card className="transition-all duration-300 hover:shadow-primary hover:-translate-y-1">
          <CardHeader>
            <MaterialIcon name="email" className="mb-2 text-primary" size="lg" />
            <CardTitle>Email Support</CardTitle>
            <CardDescription>
              Need help? Our support team is here to assist you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
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

        <Card className="opacity-60 transition-all duration-300 hover:shadow-primary hover:-translate-y-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MaterialIcon name="chat" className="mb-2 text-muted-foreground" size="lg" />
            </div>
            <div className="flex items-center gap-2">
              <CardTitle>FAQ</CardTitle>
              <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
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

        <Card className="opacity-60 transition-all duration-300 hover:shadow-primary hover:-translate-y-1">
          <CardHeader>
            <MaterialIcon name="menu_book" className="mb-2 text-muted-foreground" size="lg" />
            <div className="flex items-center gap-2">
              <CardTitle>Articles</CardTitle>
              <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
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

        <Card className="opacity-60 transition-all duration-300 hover:shadow-primary hover:-translate-y-1">
          <CardHeader>
            <MaterialIcon name="group" className="mb-2 text-muted-foreground" size="lg" />
            <div className="flex items-center gap-2">
              <CardTitle>Your Community</CardTitle>
              <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
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
        <AlertDialogContent className="bg-background text-foreground border-border max-w-lg">
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
            <Button variant="outline" onClick={() => setShowSupportForm(false)}>
              Cancel
            </Button>
            <Button className="gap-2" onClick={handleSupportSubmit}>
              <MaterialIcon name="send" size="sm" />
              Submit
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Thank You!</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              Thank you for your feedback/enquiry. Please allow up to 5 business days for a response. Thank you!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/90">
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CommunityHelp;
