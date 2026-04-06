import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { checkEmailExists } from "@/lib/supabaseCheck";
import { getDeviceFingerprint } from "@/lib/deviceFingerprint";
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
import {
  isDeviceTrusted,
  addTrustedDevice,
} from "@/lib/supabaseTrustedDevices";

type SignInMode = "password" | "otp";

const LoginForm = () => {
  const [signInMode, setSignInMode] = useState<SignInMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [showForgotPasswordDialog, setShowForgotPasswordDialog] = useState(false);
  const [showNewDeviceOtp, setShowNewDeviceOtp] = useState(false);
  const [newDeviceEmail, setNewDeviceEmail] = useState("");
  const [newDeviceOtpCode, setNewDeviceOtpCode] = useState("");
  const [newDeviceOtpSent, setNewDeviceOtpSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailNotRegisteredError, setEmailNotRegisteredError] = useState("");

  const fingerprint = getDeviceFingerprint();

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailNotRegisteredError("");
    setIsSubmitting(true);
    try {
      const exists = await checkEmailExists(email.trim());
      if (!exists) {
        setEmailNotRegisteredError("Email not found. Please enter a different email or 'Create a new profile'.");
        setIsSubmitting(false);
        return;
      }

      // Prevent Index.tsx from auto-navigating while we check trusted devices
      sessionStorage.setItem("authFlowPending", "true");

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        sessionStorage.removeItem("authFlowPending");
        toast({
          title: "Sign in failed",
          description: error.message || "Please check your email and password.",
          variant: "destructive",
        });
        return;
      }

      if (data.session?.user) {
        const trusted = await isDeviceTrusted(data.session.user.id, fingerprint);
        if (trusted) {
          await addTrustedDevice(data.session.user.id, fingerprint);
          sessionStorage.removeItem("authFlowPending");
          window.location.replace(window.location.origin + "/dashboard");
          return;
        }
        // Not trusted — sign out and show OTP dialog (flag stays set during OTP flow)
        await supabase.auth.signOut();
        setNewDeviceEmail(email.trim());
        setNewDeviceOtpSent(false);
        setShowNewDeviceOtp(true);
      } else {
        sessionStorage.removeItem("authFlowPending");
      }
    } catch {
      sessionStorage.removeItem("authFlowPending");
      toast({
        title: "Sign in failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendNewDeviceOtp = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: newDeviceEmail,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setNewDeviceOtpSent(true);
      toast({ title: "Code sent", description: "Check your email." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not send code.";
      toast({ title: "Failed to send code", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyNewDeviceOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceOtpCode.trim()) return;
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: newDeviceEmail,
        token: newDeviceOtpCode.trim(),
        type: "magiclink",
      });
      if (error) throw error;
      if (data?.user && data?.session) {
        await addTrustedDevice(data.user.id, fingerprint);
        setShowNewDeviceOtp(false);
        setNewDeviceOtpCode("");
        sessionStorage.removeItem("authFlowPending");
        window.location.replace(window.location.origin + "/dashboard");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid code.";
      toast({ title: "Verification failed", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailNotRegisteredError("");
    setIsSubmitting(true);
    try {
      const exists = await checkEmailExists(email.trim());
      if (!exists) {
        setEmailNotRegisteredError("Email not found. Please enter a different email or 'Create a new profile'.");
        setIsSubmitting(false);
        return;
      }
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setOtpSent(true);
      toast({ title: "Code sent", description: "Check your email." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not send code.";
      toast({ title: "Failed to send code", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) return;
    setIsSubmitting(true);
    sessionStorage.setItem("authFlowPending", "true");
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: "magiclink",
      });
      if (error) throw error;
      if (data.user && data.session) {
        await addTrustedDevice(data.user.id, fingerprint);
        sessionStorage.removeItem("authFlowPending");
        window.location.replace(window.location.origin + "/dashboard");
      }
    } catch (err: unknown) {
      sessionStorage.removeItem("authFlowPending");
      const msg = err instanceof Error ? err.message : "Invalid code.";
      toast({ title: "Verification failed", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast({
        title: "Enter your email",
        description: "Please enter the email you used to sign up, then try again.",
        variant: "destructive",
      });
      setShowForgotPasswordDialog(false);
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: "Check your email",
        description: "We've sent a password reset link to your email.",
      });
      setShowForgotPasswordDialog(false);
    } catch {
      toast({
        title: "Reset failed",
        description: "Could not send reset email. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (showNewDeviceOtp) {
    return (
      <Card className="w-full max-w-md mx-auto bg-background border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Verify this device</CardTitle>
          <CardDescription className="text-foreground/70">
            This is a new device. We&apos;ll send an 8-digit code to verify it&apos;s you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!newDeviceOtpSent ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Code will be sent to: <strong>{newDeviceEmail}</strong>
              </p>
              <Button
                className="w-full"
                onClick={() => handleSendNewDeviceOtp()}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sending…" : "Send code to email"}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleVerifyNewDeviceOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-device-otp">Enter 8-digit code</Label>
                <Input
                  id="new-device-otp"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="00000000"
                  value={newDeviceOtpCode}
                  onChange={(e) => setNewDeviceOtpCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting || newDeviceOtpCode.length !== 8}>
                {isSubmitting ? "Verifying…" : "Verify"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setNewDeviceOtpCode("");
                  handleSendNewDeviceOtp();
                }}
                disabled={isSubmitting}
              >
                Resend Code
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setNewDeviceOtpSent(false);
                  setShowNewDeviceOtp(false);
                  sessionStorage.removeItem("authFlowPending");
                }}
              >
                Back to sign in
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full max-w-md mx-auto bg-background border-border">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold text-foreground">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-foreground/70">
            Sign in to continue your fitness journey
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {signInMode === "password" ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailNotRegisteredError(""); }}
                  className="h-12"
                  required
                />
                {emailNotRegisteredError && (
                  <p className="text-sm text-destructive">{emailNotRegisteredError}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12"
                  required
                />
              </div>
              <div className="flex flex-col items-center gap-3">
                <button
                  type="submit"
                  className="w-full h-12 text-base font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Signing in…" : "Sign In"}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-sm text-muted-foreground hover:text-foreground h-auto py-1"
                  onClick={() => {
                    setSignInMode("otp");
                    setOtpSent(false);
                    setOtpCode("");
                  }}
                >
                  Sign in with OTP
                </Button>
              </div>
            </form>
          ) : (
            <>
              {!otpSent ? (
                <form onSubmit={handleOtpRequest} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="otp-email">Email</Label>
                    <Input
                      id="otp-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setEmailNotRegisteredError(""); }}
                      className="h-12"
                      required
                    />
                    {emailNotRegisteredError && (
                      <p className="text-sm text-destructive">{emailNotRegisteredError}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <Button type="submit" className="w-full h-12" disabled={isSubmitting}>
                      {isSubmitting ? "Sending…" : "Send code to email"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-sm text-muted-foreground hover:text-foreground h-auto py-1"
                      onClick={() => setSignInMode("password")}
                    >
                      Use password instead
                    </Button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleOtpVerify} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="otp-code">Enter 8-digit code</Label>
                    <Input
                      id="otp-code"
                      inputMode="numeric"
                      maxLength={8}
                      placeholder="00000000"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      className="h-12"
                    />
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <Button type="submit" className="w-full h-12" disabled={isSubmitting || otpCode.length !== 8}>
                      {isSubmitting ? "Verifying…" : "Verify"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-sm text-muted-foreground hover:text-foreground"
                      onClick={() => setOtpSent(false)}
                    >
                      Use a different method
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}

          <div className="text-center space-y-3">
            {signInMode === "password" && (
              <button
                type="button"
                className="text-sm text-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
                onClick={() => setShowForgotPasswordDialog(true)}
              >
                Forgot your password?
              </button>
            )}
            <div className="text-sm text-foreground">
              Don&apos;t have an account?{" "}
              <Link
                to="/create-your-profile"
                className="text-foreground hover:text-primary font-medium underline-offset-4 hover:underline"
              >
                Create a new profile
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showForgotPasswordDialog} onOpenChange={setShowForgotPasswordDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forgot password?</AlertDialogTitle>
            <AlertDialogDescription>
              Enter the email you used to sign up. We&apos;ll send you a link to reset your password.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleForgotPassword}>
              Send reset link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default LoginForm;
