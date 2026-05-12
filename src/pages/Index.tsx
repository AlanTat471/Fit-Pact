import React, { useEffect, useState } from "react";
import LoginForm from "@/components/LoginForm";
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

const IDLE_FLAG_KEY = "numiIdleSignOut";

/**
 * Login shell. We do not auto-redirect to the dashboard when a stored JWT
 * exists — AuthContext clears stale sessions unless the user just completed
 * an explicit sign-in (see authSessionGate). The user always starts from this
 * screen on a fresh app/browser session.
 */
const Index = () => {
  const [showIdleDialog, setShowIdleDialog] = useState(false);

  // Surface the idle-timeout popup if AppLayout signed the user out for
  // inactivity. We read AND clear the flag in the same effect so the dialog
  // never re-appears on a subsequent revisit of the login page.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(IDLE_FLAG_KEY) === "1") {
        sessionStorage.removeItem(IDLE_FLAG_KEY);
        setShowIdleDialog(true);
      }
    } catch {
      /* no-op */
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md mx-auto">
        <LoginForm />
      </div>

      <AlertDialog open={showIdleDialog} onOpenChange={setShowIdleDialog}>
        <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <MaterialIcon name="schedule" size="sm" className="text-primary" />
              Signed out for inactivity
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              You have been away for too long and have been signed out. Please sign in again to continue.
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

export default Index;
