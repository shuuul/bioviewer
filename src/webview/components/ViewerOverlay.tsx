import type { ViewerStatus } from "../hooks/useViewerController";

interface ViewerOverlayProps {
  status: ViewerStatus;
  errorMessage: string;
}

export function ViewerOverlay({ status, errorMessage }: ViewerOverlayProps) {
  const loadingLabel =
    status === "error" ? errorMessage : "Initializing BioViewer with Mol*...";

  return (
    <div className="viewer-overlay" role="status" aria-live="polite">
      <div className="loading-panel">
        {status === "initializing" && <div className="loading-spinner" />}
        <p className="loading-label">{loadingLabel}</p>
      </div>
    </div>
  );
}
