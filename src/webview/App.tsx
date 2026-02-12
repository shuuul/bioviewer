import { ViewerOverlay } from "./components/ViewerOverlay";
import { useViewerController } from "./hooks/useViewerController";

export function App() {
  const { status, errorMessage, containerRef } = useViewerController();

  return (
    <div className="bioviewer-root">
      <div id="molstar-container" ref={containerRef} className="molstar-container" />
      {status !== "ready" && <ViewerOverlay status={status} errorMessage={errorMessage} />}
    </div>
  );
}
