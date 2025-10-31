import { AgentBuilderProvider } from "./store/AgentBuilderContext";
import { AgentStudioProvider } from "./providers/AgentStudioProvider";
import { mockToolsClient } from "./mocks/mockToolsClient";
import { TopBar } from "./components/TopBar";
import { Palette } from "./components/Palette";
import { Canvas } from "./components/Canvas";
import { Inspector } from "./components/Inspector";
import { EdgeEditor } from "./components/EdgeEditor";
import { ValidationBanner } from "./components/ValidationBanner";
import { ReactFlowProvider } from "reactflow";
import { useEffect, useRef, useState } from "react";
import TestChatPanel from "./components/TestChatPanel";
import { useAgentBuilder } from "./store/AgentBuilderContext";

export default function AgentBuilderPage(): JSX.Element {
  const [sideWidth, setSideWidth] = useState<number>(340);
  const [dragging, setDragging] = useState(false);
  const layoutRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const el = layoutRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const max = Math.max(260, Math.min(640, rect.right - e.clientX));
      setSideWidth(max);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    };
    const onUp = () => {
      setDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  const gridCols = `260px minmax(0, 1fr) 6px ${sideWidth}px`;

  return (
    <AgentStudioProvider tenantId="demo" toolsClient={mockToolsClient} featureFlags={{ showPinnedTools: false }}>
    <AgentBuilderProvider>
      <div className="agent-builder">
        <div className="ab-header">
          <TopBar />
          <ValidationBanner />
        </div>
        <div className="ab-layout" ref={layoutRef} style={{ gridTemplateColumns: gridCols }}>
          <Palette />
          <div className="ab-stage">
            <ReactFlowProvider>
              <Canvas />
            </ReactFlowProvider>
          </div>
          <div
            className={`ab-resizer${dragging ? " ab-resizer--dragging" : ""}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize right panel"
            onMouseDown={() => setDragging(true)}
          />
          <div className="ab-side" aria-label="Right panel">
            <RightPanel />
          </div>
        </div>
      </div>
    </AgentBuilderProvider>
    </AgentStudioProvider>
  );
}

function RightPanel(): JSX.Element {
  const { state } = useAgentBuilder();
  return state.rightPanelMode === "test" ? (
    <TestChatPanel autoFocus />
  ) : (
    <>
      <Inspector />
      <EdgeEditor />
    </>
  );
}
