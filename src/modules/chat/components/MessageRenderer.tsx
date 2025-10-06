import { useEffect, useState } from "react";
import type { ChatTurn } from "../model/types";
import { loadRenderer, type Renderer } from "../rendererRegistry";
import FallbackRenderer from "./FallbackRenderer";

type MessageRendererProps = {
  turn: ChatTurn;
};

export function MessageRenderer({ turn }: MessageRendererProps) {
  const schemaId = turn.structured?.schemaId;
  const [Component, setComponent] = useState<Renderer | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!schemaId) {
      setComponent(null);
      return () => {
        cancelled = true;
      };
    }

    setComponent(null);

    (async () => {
      try {
        const renderer = await loadRenderer(schemaId);
        if (!cancelled) {
          setComponent(renderer);
        }
      } catch (error) {
        if (!cancelled) {
          setComponent(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [schemaId]);

  if (!Component) {
    return <FallbackRenderer turn={turn} />;
  }

  return <Component turn={turn} />;
}
