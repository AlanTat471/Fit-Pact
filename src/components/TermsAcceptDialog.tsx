import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DisclaimerContent } from "@/pages/Privacy";

export const TERMS_ACCEPTED_KEY = "numiTermsAcceptedFull";

type TermsAcceptDialogProps = {
  open: boolean;
  onAccept: () => void;
  onDeclineConfirmed: () => void;
};

export function TermsAcceptDialog({ open, onAccept, onDeclineConfirmed }: TermsAcceptDialogProps) {
  const [confirmingDecline, setConfirmingDecline] = useState(false);

  useEffect(() => {
    if (open) setConfirmingDecline(false);
  }, [open]);

  if (confirmingDecline) {
    return (
      <AlertDialog open={open}>
        <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-on-surface">Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-on-surface-variant text-left">
              You have clicked &apos;Decline&apos; and chosen not to accept the Terms &amp; Conditions, are you sure you want to decline?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setConfirmingDecline(false)}>No</Button>
            <Button onClick={onDeclineConfirmed}>Yes</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-on-surface">Privacy and Disclaimer</AlertDialogTitle>
          <AlertDialogDescription className="text-on-surface-variant text-left">
            Please read the full terms below. You need to accept them before you can use Numi.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="overflow-y-auto pr-1 text-sm">
          <DisclaimerContent />
        </div>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => setConfirmingDecline(true)}>Decline</Button>
          <Button onClick={onAccept}>Accept</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
