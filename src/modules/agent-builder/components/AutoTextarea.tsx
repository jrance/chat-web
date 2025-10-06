import { TextareaHTMLAttributes, useCallback, useEffect, useRef } from "react";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  expandWithinParent?: boolean; // cap height to remaining inspector viewport
  minRows?: number;
};

export default function AutoTextarea({
  value,
  onChange,
  expandWithinParent,
  minRows = 2,
  ...rest
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const autosize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";

    // compute natural height
    const lineHeight = getLineHeight(el) || 20;
    const minHeight = lineHeight * minRows + getVerticalPadding(el);
    let desired = Math.max(el.scrollHeight, minHeight);

    if (expandWithinParent) {
      const container = el.closest(".ab-inspector") as HTMLElement | null;
      if (container) {
        const rect = el.getBoundingClientRect();
        const crect = container.getBoundingClientRect();
        // Available space from element top to container bottom (minus small inset)
        const available = Math.max(120, Math.floor(crect.bottom - rect.top - 16));
        desired = Math.min(desired, available);
      }
    }

    el.style.height = desired + "px";
  }, [expandWithinParent, minRows]);

  useEffect(() => {
    // resize on mount and value changes
    requestAnimationFrame(autosize);
  }, [value, autosize]);

  useEffect(() => {
    const onResize = () => requestAnimationFrame(autosize);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [autosize]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onInput={autosize}
      {...rest}
    />
  );
}

function getLineHeight(el: HTMLElement): number | null {
  const lh = window.getComputedStyle(el).lineHeight;
  if (!lh) return null;
  if (lh.endsWith("px")) return parseFloat(lh);
  return null;
}

function getVerticalPadding(el: HTMLElement): number {
  const cs = window.getComputedStyle(el);
  const pt = parseFloat(cs.paddingTop || "0");
  const pb = parseFloat(cs.paddingBottom || "0");
  const bt = parseFloat(cs.borderTopWidth || "0");
  const bb = parseFloat(cs.borderBottomWidth || "0");
  return pt + pb + bt + bb;
}

