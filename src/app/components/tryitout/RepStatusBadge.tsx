import { CheckCircle, Loader2, XCircle } from "lucide-react";

interface RepStatusBadgeProps {
  status: "processing" | "completed" | "failed";
}

export function RepStatusBadge({ status }: RepStatusBadgeProps) {
  if (status === "processing") {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm">
        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
        <span className="font-medium text-blue-700">Processing...</span>
      </div>
    );
  }

  if (status === "completed") {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-sm">
        <CheckCircle className="w-4 h-4 text-green-600" />
        <span className="font-medium text-green-700">Rep Completed</span>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-sm">
        <XCircle className="w-4 h-4 text-red-600" />
        <span className="font-medium text-red-700">Processing Failed</span>
      </div>
    );
  }

  return null;
}
