import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEFAULT_TENANT_ID } from "../modules/chat/config/chatConfig";

function Home(): JSX.Element {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const navigate = useNavigate();

  const autoResize = useCallback(() => {
    const element = textareaRef.current;
    if (!element) {
      return;
    }
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [autoResize, text]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    const sessionId = crypto.randomUUID();
    navigate(`/chat/${encodeURIComponent(sessionId)}`, {
      state: {
        initialText: trimmed,
        tenantId: DEFAULT_TENANT_ID,
      },
    });
    setText("");
  };

  const isDisabled = !text.trim();

  return (
    <section className="home">
      <div className="home-input">
        <textarea
          ref={textareaRef}
          className="home-textbox"
          placeholder="Hello, how can I help you today?"
          aria-label="How can I help you today"
          rows={1}
          value={text}
          onChange={handleChange}
          onInput={autoResize}
        />
        <button
          type="button"
          className="home-send-button"
          aria-label="Send message"
          onClick={handleSend}
          disabled={isDisabled}
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" focusable="false">
            <path d="M3 21v-6l9-3-9-3V3l19 9-19 9z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </section>
  );
}

export default Home;
