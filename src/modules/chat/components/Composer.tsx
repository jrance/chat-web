import { ChangeEvent, FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";

type ComposerProps = {
  onSend: (text: string, agentId?: string) => void;
  disabled?: boolean;
};

export function Composer({ onSend, disabled }: ComposerProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const autoResize = useCallback(() => {
    const element = textareaRef.current;
    if (!element) {
      return;
    }
    element.style.height = "auto";
    const next = Math.min(element.scrollHeight, 240);
    element.style.height = `${next}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [autoResize, text]);

  const submitMessage = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }, [onSend, text]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitMessage();
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  };

  const isSendDisabled = disabled || !text.trim();

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <div className="composer-input">
        <textarea
          ref={textareaRef}
          className="composer-textarea"
          placeholder="Type your message…"
          rows={1}
          value={text}
          onChange={handleChange}
          onInput={autoResize}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label="Message the assistant"
        />
        <button
          type="submit"
          className="composer-send"
          disabled={isSendDisabled}
          aria-label="Send message"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" focusable="false">
            <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </form>
  );
}
