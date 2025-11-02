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
          min-height: 0;
          box-sizing: border-box;
        }

        .ab-testchat {
          gap: 18px;
          padding: 16px;
          color-scheme: light dark;
          box-sizing: border-box;
          --ab-chat-bg: linear-gradient(150deg, rgba(15, 23, 42, 0.05), rgba(79, 70, 229, 0.08));
          --ab-chat-surface: rgba(255, 255, 255, 0.72);
          --ab-chat-surface-strong: rgba(255, 255, 255, 0.95);
          --ab-chat-border: rgba(15, 23, 42, 0.08);
          --ab-chat-muted: #64748b;
          --ab-chat-strong: #0f172a;
          --ab-chat-bubble-assistant: rgba(255, 255, 255, 0.98);
          --ab-chat-bubble-assistant-fg: #0f172a;
          --ab-chat-bubble-user: linear-gradient(135deg, #2563eb, #6366f1);
          --ab-chat-bubble-user-fg: #f8fafc;
          --ab-chat-bubble-system: rgba(59, 130, 246, 0.12);
          --ab-chat-bubble-tool: rgba(15, 23, 42, 0.06);
          --ab-chat-code-bg: rgba(15, 23, 42, 0.06);
          --ab-chat-shadow: 0 28px 80px -40px rgba(15, 23, 42, 0.35);
          --ab-chat-avatar-user: linear-gradient(135deg, #2563eb, #6366f1);
          --ab-chat-avatar-assistant: linear-gradient(135deg, #10b981, #14b8a6);
          --ab-chat-avatar-tool: linear-gradient(135deg, #f97316, #f59e0b);
          --ab-chat-avatar-system: linear-gradient(135deg, #0ea5e9, #6366f1);
          --ab-chat-accent: linear-gradient(135deg, #2563eb, #1d4ed8);
          --ab-chat-accent-fg: #f8fafc;
          --ab-chat-disabled-bg: rgba(148, 163, 184, 0.35);
          --ab-chat-positive: #0fba81;
          --ab-chat-warning: #f59e0b;
          --ab-chat-danger: #ef4444;
          max-width: min(100%, 980px);
          width: 100%;
          margin: 0 auto;
          box-sizing: border-box;
          background: var(--ab-chat-bg);
          color: var(--ab-chat-strong);
        }

        .ab-testchat *,
        .ab-testchat *::before,
        .ab-testchat *::after {
          box-sizing: border-box;
        }

        @media (prefers-color-scheme: dark) {
          .ab-testchat {
            --ab-chat-bg: linear-gradient(150deg, rgba(15, 23, 42, 0.65), rgba(99, 102, 241, 0.3));
            --ab-chat-surface: rgba(17, 24, 39, 0.78);
            --ab-chat-surface-strong: rgba(17, 24, 39, 0.92);
            --ab-chat-border: rgba(148, 163, 184, 0.18);
            --ab-chat-muted: #94a3b8;
            --ab-chat-strong: #e2e8f0;
            --ab-chat-bubble-assistant: rgba(30, 41, 59, 0.92);
            --ab-chat-bubble-assistant-fg: #e2e8f0;
            --ab-chat-bubble-user: linear-gradient(135deg, #2563eb, #7c3aed);
            --ab-chat-bubble-user-fg: #f8fafc;
            --ab-chat-bubble-system: rgba(14, 165, 233, 0.25);
            --ab-chat-bubble-tool: rgba(30, 41, 59, 0.65);
            --ab-chat-code-bg: rgba(15, 23, 42, 0.85);
            --ab-chat-shadow: 0 28px 80px -40px rgba(5, 9, 22, 0.9);
            --ab-chat-avatar-user: linear-gradient(135deg, #60a5fa, #7c3aed);
            --ab-chat-avatar-assistant: linear-gradient(135deg, #34d399, #0ea5e9);
            --ab-chat-avatar-tool: linear-gradient(135deg, #f97316, #fb7185);
            --ab-chat-avatar-system: linear-gradient(135deg, #38bdf8, #a855f7);
            --ab-chat-accent: linear-gradient(135deg, #2563eb, #7c3aed);
            --ab-chat-disabled-bg: rgba(71, 85, 105, 0.45);
            --ab-chat-positive: #34d399;
            --ab-chat-warning: #fbbf24;
            --ab-chat-danger: #f87171;
          }
        }

        :root[data-theme="dark"] .ab-testchat,
        body[data-theme="dark"] .ab-testchat,
        .app--dark .ab-testchat {
          --ab-chat-bg: linear-gradient(150deg, rgba(15, 23, 42, 0.65), rgba(99, 102, 241, 0.3));
          --ab-chat-surface: rgba(17, 24, 39, 0.78);
          --ab-chat-surface-strong: rgba(17, 24, 39, 0.92);
          --ab-chat-border: rgba(148, 163, 184, 0.18);
          --ab-chat-muted: #94a3b8;
          --ab-chat-strong: #e2e8f0;
          --ab-chat-bubble-assistant: rgba(30, 41, 59, 0.92);
          --ab-chat-bubble-assistant-fg: #e2e8f0;
          --ab-chat-bubble-user: linear-gradient(135deg, #2563eb, #7c3aed);
          --ab-chat-bubble-user-fg: #f8fafc;
          --ab-chat-bubble-system: rgba(14, 165, 233, 0.25);
          --ab-chat-bubble-tool: rgba(30, 41, 59, 0.65);
          --ab-chat-code-bg: rgba(15, 23, 42, 0.85);
          --ab-chat-shadow: 0 28px 80px -40px rgba(5, 9, 22, 0.9);
          --ab-chat-avatar-user: linear-gradient(135deg, #60a5fa, #7c3aed);
          --ab-chat-avatar-assistant: linear-gradient(135deg, #34d399, #0ea5e9);
          --ab-chat-avatar-tool: linear-gradient(135deg, #f97316, #fb7185);
          --ab-chat-avatar-system: linear-gradient(135deg, #38bdf8, #a855f7);
          --ab-chat-accent: linear-gradient(135deg, #2563eb, #7c3aed);
          --ab-chat-disabled-bg: rgba(71, 85, 105, 0.45);
          --ab-chat-positive: #34d399;
          --ab-chat-warning: #fbbf24;
          --ab-chat-danger: #f87171;
        }

        .ab-testchat__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          background: var(--ab-chat-surface);
          border: 1px solid var(--ab-chat-border);
          border-radius: 18px;
          padding: 16px 20px;
          box-shadow: var(--ab-chat-shadow);
        }

        .ab-testchat__title-block {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ab-testchat__title {
          font-size: 1.1rem;
          font-weight: 700;
        }

        .ab-testchat__status {
          font-size: 0.75rem;
          color: var(--ab-chat-muted);
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .ab-testchat__tabs {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding-top: 6px;
          flex-wrap: wrap;
        }

        .ab-testchat__tab {
          border: 1px solid transparent;
          background: transparent;
          color: var(--ab-chat-muted);
          font-size: 0.78rem;
          font-weight: 600;
          padding: 0.35rem 0.9rem;
          border-radius: 999px;
          cursor: pointer;
          transition: color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }

        .ab-testchat__tab:not(:disabled):hover {
          color: var(--ab-chat-strong);
        }

        .ab-testchat__tab--active {
          background: rgba(37, 99, 235, 0.12);
          color: var(--ab-chat-strong);
          border-color: rgba(37, 99, 235, 0.3);
          box-shadow: 0 12px 30px -22px rgba(37, 99, 235, 0.4);
        }

        .ab-testchat__tab:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .ab-testchat__run {
          font-family: "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace;
          font-size: 0.7rem;
        }

        .ab-testchat__actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .ab-testchat__telemetry {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.75rem;
          color: var(--ab-chat-muted);
        }

        .ab-testchat__select {
          appearance: none;
          border: 1px solid var(--ab-chat-border);
          border-radius: 12px;
          background: var(--ab-chat-surface-strong);
          color: var(--ab-chat-strong);
          padding: 6px 28px 6px 12px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 12px 30px -24px rgba(15, 23, 42, 0.45);
          transition: box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
          background-image: linear-gradient(45deg, transparent 50%, var(--ab-chat-muted) 50%), linear-gradient(135deg, var(--ab-chat-muted) 50%, transparent 50%);
          background-position: calc(100% - 16px) calc(50% - 3px), calc(100% - 11px) calc(50% - 3px);
          background-size: 6px 6px, 6px 6px;
          background-repeat: no-repeat;
        }

        .ab-testchat__select:hover {
          transform: translateY(-1px);
          border-color: rgba(37, 99, 235, 0.35);
          box-shadow: 0 14px 34px -24px rgba(37, 99, 235, 0.55);
        }

        .ab-testchat__select:focus {
          outline: none;
          border-color: rgba(37, 99, 235, 0.5);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
        }

        .ab-testchat__button {
          border-radius: 12px;
          border: 1px solid var(--ab-chat-border);
          padding: 0.45rem 0.9rem;
          font-size: 0.8rem;
          font-weight: 600;
          background: var(--ab-chat-surface-strong);
          color: var(--ab-chat-strong);
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
          box-shadow: 0 14px 34px -28px rgba(15, 23, 42, 0.44);
        }

        .ab-testchat__button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 18px 38px -28px rgba(37, 99, 235, 0.42);
        }

        .ab-testchat__button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

        .ab-testchat__button--ghost {
          background: transparent;
          color: var(--ab-chat-muted);
        }

        .ab-testchat__send {
          background: var(--ab-chat-accent);
          color: var(--ab-chat-accent-fg);
          border: none;
          padding-inline: 1.1rem;
          box-shadow: 0 18px 40px -26px rgba(37, 99, 235, 0.7);
          position: absolute;
          bottom: 8px;
          right: 12px;
          min-height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.45rem 1.1rem;
          border-radius: 14px;
        }

        .ab-testchat__send:hover:not(:disabled) {
          box-shadow: 0 22px 48px -26px rgba(37, 99, 235, 0.75);
        }

        .ab-testchat__send:disabled {
          background: var(--ab-chat-disabled-bg);
          color: var(--ab-chat-muted);
          box-shadow: none;
        }

        .ab-testchat__body {
          display: flex;
          flex: 1;
          min-height: 0;
          justify-content: center;
          padding-bottom: 12px;
        }

        .ab-testchat__body--chat {
          align-items: stretch;
        }

        .ab-testchat__body--telemetry {
          align-items: flex-start;
        }

        .ab-testchat__column {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-height: 0;
          align-items: stretch;
          padding-bottom: 24px;
        }

        .ab-testchat__telemetry {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
          padding-bottom: 24px;
          overflow: auto;
          width: 100%;
        }

        .ab-testchat__messages {
          flex: 1;
          overflow-y: auto;
          border: 1px solid var(--ab-chat-border);
          border-radius: 20px;
          background: var(--ab-chat-surface-strong);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          box-shadow: var(--ab-chat-shadow);
          width: 100%;
          max-width: min(100%, 720px);
          margin: 0 auto;
          box-sizing: border-box;
        }

        .ab-testchat__messages::-webkit-scrollbar {
          width: 10px;
        }

        .ab-testchat__messages::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.35);
          border-radius: 999px;
        }

        .ab-testchat__messages::-webkit-scrollbar-thumb:hover {
          background: rgba(96, 165, 250, 0.45);
        }

        .ab-testchat__empty {
          align-self: center;
          text-align: center;
          font-size: 0.9rem;
          color: var(--ab-chat-muted);
        }

        .ab-testchat__hint {
          font-size: 0.8rem;
          color: var(--ab-chat-muted);
          text-align: center;
          padding: 0.75rem 1rem;
          border: 1px dashed var(--ab-chat-border);
          border-radius: 16px;
          background: rgba(15, 23, 42, 0.03);
          max-width: min(100%, 720px);
          width: 100%;
          margin: 0 auto;
          box-sizing: border-box;
        }

        .ab-msg {
          display: flex;
          gap: 14px;
          align-items: flex-start;
        }

        .ab-msg__avatar {
          width: 38px;
          height: 38px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          font-weight: 700;
          color: #ffffff;
          box-shadow: 0 12px 30px -16px rgba(15, 23, 42, 0.45);
        }

        .ab-msg--assistant .ab-msg__avatar {
          background: var(--ab-chat-avatar-assistant);
        }

        .ab-msg--user {
          flex-direction: row-reverse;
        }

        .ab-msg--user .ab-msg__avatar {
          background: var(--ab-chat-avatar-user);
        }

        .ab-msg--system .ab-msg__avatar {
          background: var(--ab-chat-avatar-system);
        }

        .ab-msg--tool .ab-msg__avatar {
          background: var(--ab-chat-avatar-tool);
        }

        .ab-msg__body {
          max-width: min(60ch, 100%);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ab-msg--user .ab-msg__body {
          align-items: flex-end;
          text-align: right;
        }

        .ab-msg__meta {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--ab-chat-muted);
          font-weight: 600;
        }

        .ab-msg__bubble {
          padding: 14px 18px;
          border-radius: 18px;
          background: var(--ab-chat-bubble-assistant);
          color: var(--ab-chat-bubble-assistant-fg);
          line-height: 1.6;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .ab-msg__bubble p {
          margin: 0;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .ab-msg--user .ab-msg__bubble {
          background: var(--ab-chat-bubble-user);
          color: var(--ab-chat-bubble-user-fg);
          border-bottom-right-radius: 6px;
          text-align: left;
        }

        .ab-msg--system .ab-msg__bubble {
          background: var(--ab-chat-bubble-system);
        }

        .ab-msg__bubble--tool {
          background: var(--ab-chat-bubble-tool);
          border-left: 3px solid rgba(249, 115, 22, 0.6);
        }

        .ab-msg__bubble--widget {
          background: var(--ab-chat-surface);
          border: 1px dashed var(--ab-chat-border);
        }

        .ab-msg__widgets,
        .ab-msg__tool {
          width: 100%;
        }

        .ab-msg__bubble pre {
          margin: 0;
          padding: 12px 14px;
          border-radius: 12px;
          background: var(--ab-chat-code-bg);
          overflow-x: auto;
          font-family: "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace;
          font-size: 0.85rem;
        }

        .ab-msg__bubble code {
          font-family: "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace;
          font-size: 0.85rem;
        }

        .ab-msg__tool-name {
          font-weight: 600;
          font-size: 0.8rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--ab-chat-muted);
        }

        .ab-testchat__composer {
          display: flex;
          gap: 16px;
          align-items: flex-end;
          background: var(--ab-chat-surface);
          border: 1px solid var(--ab-chat-border);
          border-radius: 20px;
          padding: 18px;
          box-shadow: var(--ab-chat-shadow);
          width: 100%;
          max-width: min(100%, 720px);
          margin: 0 auto;
          box-sizing: border-box;
          position: relative;
          padding-bottom: 48px;
        }

        .ab-testchat__input {
          flex: 1;
          min-height: 88px;
          resize: vertical;
          border: none;
          background: transparent;
          color: var(--ab-chat-strong);
          font-size: 0.95rem;
          line-height: 1.6;
          font-family: inherit;
          padding-right: 140px;
        }

        .ab-testchat__input:focus {
          outline: none;
        }

        .ab-testchat__input::placeholder {
          color: var(--ab-chat-muted);
        }

        .ab-testchat__input:disabled {
          color: var(--ab-chat-muted);
        }

        .ab-testchat__composer-hint {
          position: absolute;
          bottom: 12px;
          left: 18px;
          font-size: 0.75rem;
          color: var(--ab-chat-muted);
          letter-spacing: 0.02em;
        }

        .ab-testchat__usage,
        .ab-testchat__error {
          border-radius: 18px;
          border: 1px solid var(--ab-chat-border);
          background: var(--ab-chat-surface);
          padding: 18px 20px;
          box-shadow: var(--ab-chat-shadow);
          width: 100%;
          max-width: min(100%, 720px);
          margin: 0 auto;
          box-sizing: border-box;
        }

        .ab-testchat__usage {
          font-size: 0.85rem;
          color: var(--ab-chat-muted);
        }

        .ab-testchat__usage pre {
          margin: 12px 0 0;
          padding: 12px 14px;
          border-radius: 12px;
          background: var(--ab-chat-code-bg);
          font-family: "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace;
          font-size: 0.8rem;
          white-space: pre-wrap;
          color: var(--ab-chat-strong);
        }

        .ab-testchat__error {
          color: var(--ab-chat-danger);
          font-weight: 600;
        }

        .ab-resume {
          border: 1px solid var(--ab-chat-border);
          border-radius: 18px;
          background: var(--ab-chat-surface);
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: var(--ab-chat-shadow);
          width: 100%;
          max-width: min(100%, 720px);
          margin: 0 auto;
          box-sizing: border-box;
        }

        .ab-resume__targets {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .ab-resume__choice {
          border-radius: 999px;
          border: none;
          padding: 0.45rem 0.95rem;
          font-size: 0.8rem;
          font-weight: 600;
          background: var(--ab-chat-accent);
          color: var(--ab-chat-accent-fg);
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
          box-shadow: 0 18px 38px -26px rgba(37, 99, 235, 0.65);
        }

        .ab-resume__choice:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .ab-resume__choice:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          box-shadow: none;
        }

        .ab-resume__clarify {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .ab-resume__clarify-input {
          flex: 1;
          border-radius: 12px;
          border: 1px solid var(--ab-chat-border);
          background: var(--ab-chat-surface-strong);
          padding: 10px 14px;
          font-size: 0.9rem;
          color: var(--ab-chat-strong);
        }

        .ab-resume__clarify-input:focus {
          outline: none;
          border-color: rgba(37, 99, 235, 0.45);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
        }

        .ab-resume__clarify-input:disabled {
          background: var(--ab-chat-disabled-bg);
          color: var(--ab-chat-muted);
        }

        .ab-resume__submit {
          border-radius: 12px;
          border: none;
          padding: 0.55rem 1.1rem;
          font-size: 0.85rem;
          font-weight: 600;
          background: var(--ab-chat-accent);
          color: var(--ab-chat-accent-fg);
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
          box-shadow: 0 18px 38px -26px rgba(37, 99, 235, 0.65);
        }

        .ab-resume__submit:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .ab-resume__submit:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          box-shadow: none;
        }

        .ab-testchat__drawer {
          width: min(100%, 840px);
          display: flex;
          flex-direction: column;
          border: 1px solid var(--ab-chat-border);
          border-radius: 20px;
          background: var(--ab-chat-surface);
          box-shadow: var(--ab-chat-shadow);
          overflow: hidden;
          margin: 0 auto;
          box-sizing: border-box;
        }

        .ab-drawer__tabs {
          display: flex;
          align-items: center;
          border-bottom: 1px solid var(--ab-chat-border);
          background: var(--ab-chat-surface-strong);
        }

        .ab-drawer__tab {
          border: none;
          background: transparent;
          font-size: 0.8rem;
          font-weight: 600;
          padding: 0.65rem 1.15rem;
          cursor: pointer;
          color: var(--ab-chat-muted);
          transition: color 0.2s ease, background 0.2s ease;
        }

        .ab-drawer__tab--active {
          color: var(--ab-chat-strong);
          background: rgba(37, 99, 235, 0.08);
        }

        .ab-drawer__count {
          margin-left: auto;
          padding: 0 1rem;
          font-size: 0.7rem;
          color: var(--ab-chat-muted);
        }

        .ab-drawer__body {
          flex: 1;
          min-height: 0;
          overflow: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .ab-drawer__body::-webkit-scrollbar {
          width: 8px;
        }

        .ab-drawer__body::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.35);
          border-radius: 999px;
        }

        .ab-drawer__event {
          border: 1px solid var(--ab-chat-border);
          border-radius: 16px;
          background: var(--ab-chat-surface-strong);
          padding: 0.9rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          box-shadow: var(--ab-chat-shadow);
        }

        .ab-drawer__event-meta {
          display: flex;
          gap: 0.5rem;
          align-items: baseline;
          font-size: 0.7rem;
          color: var(--ab-chat-muted);
        }

        .ab-drawer__event-time {
          font-variant-numeric: tabular-nums;
        }

        .ab-drawer__event-agent {
          opacity: 0.75;
        }

        .ab-drawer__event-title {
          font-size: 0.85rem;
          font-weight: 600;
        }

        .ab-drawer__event-title--error {
          color: var(--ab-chat-danger);
        }

        .ab-drawer__event-title--warn {
          color: var(--ab-chat-warning);
        }

        .ab-drawer__event-details {
          margin: 0;
          padding: 12px 14px;
          border-radius: 12px;
          background: var(--ab-chat-code-bg);
          font-family: "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace;
          font-size: 0.75rem;
          line-height: 1.4;
          max-height: 160px;
          overflow: auto;
        }

        .ab-drawer__raw {
          margin: 0;
          padding: 12px 14px;
          border-radius: 12px;
          background: var(--ab-chat-code-bg);
          font-family: "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace;
          font-size: 0.75rem;
          line-height: 1.4;
        }

        @media (max-width: 1200px) {
          .ab-testchat {
            max-width: 100%;
          }
        }

        @media (max-width: 768px) {
          .ab-testchat {
            padding: 12px;
          }
          .ab-testchat__header {
            flex-direction: column;
            align-items: flex-start;
            gap: 14px;
          }
          .ab-testchat__tabs {
            width: 100%;
          }
          .ab-testchat__actions {
            width: 100%;
            justify-content: flex-start;
            align-items: stretch;
            gap: 8px;
          }
          .ab-testchat__telemetry {
            justify-content: space-between;
          }
          .ab-testchat__composer {
            flex-direction: column;
            align-items: stretch;
          }
          .ab-testchat__send {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
