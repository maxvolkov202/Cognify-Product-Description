import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

interface ReRecordConfirmationModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ReRecordConfirmationModal({
  open,
  onConfirm,
  onCancel
}: ReRecordConfirmationModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <AlertDialogTitle className="text-xl">Replace this rep?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base text-gray-700 leading-relaxed">
            This will permanently delete your current recording and transcript. You'll start fresh with a new recording.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={onCancel} className="px-4 py-2">
            Keep recording
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white"
          >
            Yes, re-record
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
