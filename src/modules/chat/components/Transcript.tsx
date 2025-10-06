import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import type { ChatTurn } from "../model/types";
import { MessageRenderer } from "./MessageRenderer";

const SCROLL_THRESHOLD_PX = 120;
const PINNED_TOP_MARGIN_PX = 24;

type TranscriptProps = {
  turns: ChatTurn[];
  onLoadMore?: () => void;
  footer?: ReactNode;
};

export function Transcript({ turns, onLoadMore, footer }: TranscriptProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const lastUserIdRef = useRef<string | null>(null);
  const anchorIdRef = useRef<string | null>(null);
  const pinnedOffsetRef = useRef<number>(PINNED_TOP_MARGIN_PX);
  const prevFirstTurnIdRef = useRef<string | null>(null);
  const isAdjustingScrollRef = useRef(false);

  const adjustScrollBy = (container: HTMLElement, delta: number) => {
    if (delta !== 0) {
      isAdjustingScrollRef.current = true;
      container.scrollTop += delta;
      requestAnimationFrame(() => {
        isAdjustingScrollRef.current = false;
      });
    }
  };

  const getTurnElement = (container: HTMLElement, turnId: string) => {
    const safeId = String(turnId).replace(/"/g, '\\"');
    return container.querySelector<HTMLElement>(`[data-turn-id="${safeId}"]`);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (isAdjustingScrollRef.current) {
        return;
      }
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      shouldAutoScrollRef.current = distanceFromBottom <= SCROLL_THRESHOLD_PX;
      if (shouldAutoScrollRef.current) {
        // User is near the bottom; clear any pin-to-top anchor
        anchorIdRef.current = null;
      }
    };

    handleScroll();
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || turns.length === 0) return;

    const previousFirstTurnId = prevFirstTurnIdRef.current;
    const currentFirstTurnId = turns[0]?.id ?? null;

    if (previousFirstTurnId && previousFirstTurnId !== currentFirstTurnId) {
      const previousFirstElement = getTurnElement(container, previousFirstTurnId);
      if (previousFirstElement) {
        const containerRect = container.getBoundingClientRect();
        const firstRect = previousFirstElement.getBoundingClientRect();
        const delta = firstRect.top - containerRect.top;
        adjustScrollBy(container, delta);
      }
    }

    prevFirstTurnIdRef.current = currentFirstTurnId;

    // Find the most recent user message
    let lastUserIndex = -1;
    for (let i = turns.length - 1; i >= 0; i--) {
      if (turns[i].role === "user") { lastUserIndex = i; break; }
    }

    if (lastUserIndex >= 0) {
      const userTurn = turns[lastUserIndex];
      const isNewUserTurn = lastUserIdRef.current !== userTurn.id;
      if (isNewUserTurn) {
        lastUserIdRef.current = userTurn.id;
        // Pin viewport to keep the new user message at the top and
        // stop auto-scrolling while assistant streams below.
        shouldAutoScrollRef.current = false;
        anchorIdRef.current = userTurn.id;
        pinnedOffsetRef.current = PINNED_TOP_MARGIN_PX;
        const target = getTurnElement(container, userTurn.id);
        if (target) {
          const containerRect = container.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          const delta = targetRect.top - containerRect.top - pinnedOffsetRef.current;
          adjustScrollBy(container, delta);
        }
        return; // Don't auto-scroll to bottom right after aligning to top
      }
    }

    // Maintain pin-to-top position while assistant streams (anchor exists)
    if (anchorIdRef.current) {
      const target = getTurnElement(container, anchorIdRef.current);
      if (target) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const desiredOffset = pinnedOffsetRef.current;
        const delta = targetRect.top - containerRect.top - desiredOffset;
        if (Math.abs(delta) > 1) {
          adjustScrollBy(container, delta);
        }
      }
      return;
    }

    // Otherwise, only auto-scroll if the user is already near the bottom
    if (shouldAutoScrollRef.current) {
      isAdjustingScrollRef.current = true;
      container.scrollTop = container.scrollHeight;
      requestAnimationFrame(() => {
        isAdjustingScrollRef.current = false;
      });
    }
  }, [turns]);

  return (
    <div className="transcript" role="log" aria-live="polite" ref={containerRef}>
      <div className="transcript__inner">
        {onLoadMore && (
          <div className="transcript__load">
            <button className="transcript-load-more" onClick={onLoadMore} type="button">
              Load earlier messages
            </button>
          </div>
        )}
        {turns.map((turn) => (
          <div key={turn.id} className={`transcript__row transcript__row--${turn.role}`} data-turn-id={turn.id}>
            <div className={`bubble ${turn.role}`}>
              <MessageRenderer turn={turn} />
              {turn.isStreaming && <span className="cursor" aria-hidden="true">?</span>}
            </div>
          </div>
        ))}
        <div className="transcript__spacer" aria-hidden="true" />
        {footer && (
          <div className="transcript__footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
