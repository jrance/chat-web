import React from "react";
import { WidgetEnvelope, getWidget, getFallback } from "./registry";

type Props = { envelopes?: WidgetEnvelope[] };

export function WidgetHost({ envelopes = [] }: Props) {
  if (!envelopes.length) return null;
  return (
    <div className="space-y-2">
      {envelopes.map((env, i) => {
        const reg = getWidget(env.kind) || getFallback();
        if (!reg) return null;
        const Comp: any = reg.component;
        return (
          <div key={env.id ?? `${env.kind}-${i}`} className="w-full">
            <Comp props={env.props} />
          </div>
        );
      })}
    </div>
  );
}
