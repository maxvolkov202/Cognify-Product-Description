export type RepStatus = 
  | "configuring"      // User is setting up the rep
  | "ready"            // Ready to start recording
  | "countdown"        // 3-2-1 countdown
  | "recording"        // Actively recording
  | "paused"           // Recording paused
  | "uploading"        // Saving audio
  | "analyzing"        // Transcribing and generating feedback
  | "completed"        // Rep finished successfully
  | "failed";          // Processing failed

export interface RepState {
  status: RepStatus;
  progress?: number;   // 0-100 for uploading/analyzing
  error?: string;      // Error message if failed
  canStartNew: boolean; // Whether user can start a new rep
}

export function canStartNewRep(status: RepStatus): boolean {
  return status === "completed" || status === "failed" || status === "configuring";
}

export function getStatusMessage(status: RepStatus): string {
  switch (status) {
    case "configuring":
      return "Configure your rep";
    case "ready":
      return "Ready to begin";
    case "countdown":
      return "Starting...";
    case "recording":
      return "Recording in progress";
    case "paused":
      return "Recording paused";
    case "uploading":
      return "Saving your rep...";
    case "analyzing":
      return "Analyzing your performance...";
    case "completed":
      return "Rep complete!";
    case "failed":
      return "Processing failed";
    default:
      return "";
  }
}
