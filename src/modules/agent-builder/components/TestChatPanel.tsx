import TestChatPane from "../../../features/test-panel/components/TestChatPane";
import { API_BASE, DEFAULT_TENANT_ID, ORCH_AUTH_TOKEN } from "../../../app/config";
import { useAgentStudio } from "../providers/AgentStudioProvider";
import { useAgentBuilder } from "../store/AgentBuilderContext";

type Props = {
  autoFocus?: boolean;
};

export default function TestChatPanel({ autoFocus }: Props = {}): JSX.Element {
  const { state } = useAgentBuilder();
  const { tenantId: studioTenantId } = useAgentStudio();

  const tenantId: string =
    (typeof state.ir?.meta?.tenantId === "string" && state.ir.meta.tenantId) || studioTenantId || DEFAULT_TENANT_ID;
  const canRun = Boolean(state.ir?.nodes?.length);

  return (
    <div className="ab-testchat__container">
      <TestChatPane
        ir={state.ir}
        tenantId={tenantId}
        authToken={ORCH_AUTH_TOKEN}
        baseUrl={API_BASE}
        autoFocus={autoFocus}
        canRun={canRun}
      />
      <style>{`
        .ab-testchat__container,
        .ab-testchat {
          display: flex;
          flex-direction: column;
          height: 100%;
          gap: 12px;
        }
        .ab-testchat__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .ab-testchat__status {
          font-size: 12px;
          color: #5a5e6a;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .ab-testchat__run {
          font-family: "JetBrains Mono", "Fira Code", Menlo, monospace;
          font-size: 11px;
          color: #7a7f8c;
        }
        .ab-testchat__actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .ab-testchat__messages {
          flex: 1;
          overflow: auto;
          border: 1px solid #e2e4ea;
          padding: 12px;
          border-radius: 8px;
          background: #f8f9fc;
          font-family: ui-sans-serif, system-ui, -apple-system;
        }
        .ab-msg {
          display: grid;
          grid-template-columns: 90px 1fr;
          gap: 8px;
          margin-bottom: 12px;
        }
        .ab-msg:last-child {
          margin-bottom: 0;
        }
        .ab-msg__role {
          text-transform: capitalize;
          color: #5a5e6a;
          font-size: 12px;
          font-weight: 600;
        }
        .ab-msg__content p {
          margin: 0;
          white-space: pre-wrap;
        }
        .ab-msg__widgets,
        .ab-msg__tool {
          margin-top: 6px;
        }
        .ab-msg__widget,
        .ab-msg__tool-result,
        .ab-msg__tool-error {
          margin: 0;
          padding: 8px;
          border-radius: 6px;
          background: #eef0f8;
          font-family: "JetBrains Mono", Menlo, Consolas, monospace;
          font-size: 12px;
          white-space: pre-wrap;
          overflow-x: auto;
        }
        .ab-msg__tool-error {
          background: #fde7e9;
          color: #7a1f26;
        }
        .ab-msg__tool-name {
          font-weight: 600;
          margin-bottom: 4px;
          font-size: 12px;
          color: #373b47;
        }
        .ab-testchat__composer {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .ab-testchat__composer textarea {
          flex: 1;
          min-height: 72px;
          border-radius: 8px;
          border: 1px solid #ccd0da;
          padding: 8px 10px;
          resize: vertical;
          font-family: inherit;
        }
        .ab-testchat__composer textarea:disabled {
          background: #f1f3f7;
          color: #7a7f8c;
        }
        .ab-testchat__usage {
          border: 1px solid #e2e4ea;
          border-radius: 8px;
          padding: 8px;
          background: #f8f9fc;
        }
        .ab-testchat__usage pre {
          margin: 6px 0 0;
          font-size: 12px;
          font-family: "JetBrains Mono", Menlo, Consolas, monospace;
          white-space: pre-wrap;
        }
        .ab-testchat__error {
          border-radius: 6px;
          padding: 8px 10px;
          background: #fde7e9;
          color: #7a1f26;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}
