import type { FC } from "react";
import type { ChatTurn } from "../model/types";

type Props = {
  turn: ChatTurn;
};

const PolicyAnswerRenderer: FC<Props> = ({ turn }) => {
  const structured = turn.structured?.object as
    | {
        policyName?: string;
        verdict?: string;
        explanation?: string;
      }
    | undefined;

  if (!structured) {
    return <div className="policy-answer">No policy data available.</div>;
  }

  return (
    <article className="policy-answer">
      {structured.policyName && <h3>{structured.policyName}</h3>}
      {structured.verdict && <p className="verdict">Verdict: {structured.verdict}</p>}
      {structured.explanation && <p>{structured.explanation}</p>}
    </article>
  );
};

export default PolicyAnswerRenderer;
