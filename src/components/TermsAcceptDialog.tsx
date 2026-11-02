import { Link } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export const TERMS_ACCEPTED_KEY = "numiTermsAccepted";

type TermsAcceptDialogProps = {
  open: boolean;
  onAgree: () => void;
  onNotNow: () => void;
};

export function TermsAcceptDialog({ open, onAgree, onNotNow }: TermsAcceptDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl max-h-[85vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-on-surface">Privacy and Disclaimer</AlertDialogTitle>
          <AlertDialogDescription className="text-on-surface-variant space-y-3 text-left">
            <span className="block">Before you continue, please accept these points. The full wording is on the Privacy and Disclaimer page.</span>
            <span className="block">1. Numi only tracks the weight-loss numbers you enter. It is a guide or reference, not weight-loss advice.</span>
            <span className="block">2. Always seek professional medical advice before using a weight-loss plan.</span>
            <span className="block">3. You must not copy, resell, or reuse the app, its wording, or its calculations. Doing so can be copyright infringement and you can be held liable.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" asChild>
            <Link to="/privacy">Read the full page</Link>
          </Button>
          <Button variant="outline" onClick={onNotNow}>Not now</Button>
          <Button onClick={onAgree}>I agree</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
