import type { ChatTurn } from "../model/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type FallbackRendererProps = {
  turn: ChatTurn;
};

export default function FallbackRenderer({ turn }: FallbackRendererProps) {
  return (
    <div className="prose">
      {turn.text && (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ node, ...props }) => (
              <a {...props} target="_blank" rel="noopener noreferrer" />
            ),
          }}
        >
          {turn.text}
        </ReactMarkdown>
      )}
      {turn.structured && (
        <details>
          <summary>Structured</summary>
          <pre>{JSON.stringify(turn.structured.object, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
