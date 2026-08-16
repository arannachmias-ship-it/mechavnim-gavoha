"use client";
import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react";
import type { MathfieldElement } from "mathlive";

export interface MathFieldHandle {
  getValue: () => string;
  setValue: (latex: string) => void;
  focus: () => void;
  clear: () => void;
  insert: (latex: string) => void;
}

interface Props {
  placeholder?: string;
  onEnter?: () => void;
  onChange?: (latex: string) => void;
  autoFocus?: boolean;
  variables?: string[];
  /** id of an element to host the virtual keyboard (inline instead of overlay) */
  keyboardHostId?: string;
}

let configured = false;
async function setup() {
  const ml = await import("mathlive");
  if (!configured) {
    configured = true;
    ml.MathfieldElement.fontsDirectory = "https://unpkg.com/mathlive@0.110.0/fonts";
    ml.MathfieldElement.soundsDirectory = null;
    ml.MathfieldElement.locale = "he";
    // custom compact keyboard
    const kb = (window as unknown as { mathVirtualKeyboard: { layouts: unknown; addEventListener: (t: string, f: () => void) => void; visible: boolean; boundingRect: DOMRect } }).mathVirtualKeyboard;
    // keep the app's fixed bottom bar above the keyboard: publish keyboard height as a CSS variable
    const publish = () => {
      const h = kb.visible ? Math.round(kb.boundingRect.height) : 0;
      document.documentElement.style.setProperty("--kbh", `${h}px`);
      document.documentElement.classList.toggle("kb-open", h > 0);
    };
    kb.addEventListener("geometrychange", publish);
    kb.addEventListener("virtual-keyboard-toggle", publish);
    kb.layouts = [
      {
        label: "מקלדת",
        displayEditToolbar: false,
        rows: [
          [
            { latex: "x", variants: ["y", "a", "b", "t", "m", "n", "c"] },
            { latex: "y", variants: ["a", "b", "t", "m", "n", "c"] },
            { label: "7", latex: "7" },
            { label: "8", latex: "8" },
            { label: "9", latex: "9" },
            { label: "÷", insert: "\\frac{#@}{#?}" },
            { label: "(", latex: "(" },
            { label: ")", latex: ")" },
          ],
          [
            { latex: "#@^{2}", label: "x²", insert: "#@^{2}" },
            { latex: "#@^{#?}", label: "xⁿ", insert: "#@^{#?}" },
            { label: "4", latex: "4" },
            { label: "5", latex: "5" },
            { label: "6", latex: "6" },
            { label: "×", latex: "\\cdot" },
            { label: "√", insert: "\\sqrt{#0}" },
            { label: "⌫", command: ["deleteBackward"], class: "action" },
          ],
          [
            { label: "a", latex: "a" },
            { label: "b", latex: "b" },
            { label: "1", latex: "1" },
            { label: "2", latex: "2" },
            { label: "3", latex: "3" },
            { label: "−", latex: "-" },
            { label: "←", command: ["moveToPreviousChar"], class: "action" },
            { label: "→", command: ["moveToNextChar"], class: "action" },
          ],
          [
            { label: "t", latex: "t" },
            { label: "m", latex: "m" },
            { label: "0", latex: "0" },
            { label: ".", latex: "." },
            { label: "=", latex: "=" },
            { label: "+", latex: "+" },
            { label: ",", latex: ",", variants: ["\\ne", "\\pm"] },
            { label: "≠", latex: "\\ne" },
            { label: "↵", command: ["commit"], class: "action" },
          ],
        ],
      },
    ];
  }
  return ml;
}

const MathField = forwardRef<MathFieldHandle, Props>(function MathField({ placeholder, onEnter, onChange, autoFocus, keyboardHostId }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mfRef = useRef<MathfieldElement | null>(null);
  const [empty, setEmpty] = useState(true);
  const onEnterRef = useRef(onEnter);
  const onChangeRef = useRef(onChange);
  onEnterRef.current = onEnter;
  onChangeRef.current = onChange;

  useImperativeHandle(ref, () => ({
    getValue: () => mfRef.current?.getValue("latex") ?? "",
    setValue: (v: string) => {
      mfRef.current?.setValue(v);
      setEmpty(!v.trim());
    },
    focus: () => mfRef.current?.focus(),
    clear: () => {
      mfRef.current?.setValue("");
      setEmpty(true);
    },
    insert: (v: string) => {
      mfRef.current?.focus();
      mfRef.current?.insert(v);
    },
  }));

  useEffect(() => {
    let cancelled = false;
    let mf: MathfieldElement | null = null;
    setup().then((ml) => {
      if (cancelled || !hostRef.current) return;
      mf = new ml.MathfieldElement();
      mf.mathVirtualKeyboardPolicy = "manual";
      mf.smartFence = true;
      mf.smartSuperscript = true;
      void placeholder; // MathLive placeholders are LaTeX-only (no Hebrew) – we overlay our own hint instead
      hostRef.current.innerHTML = "";
      hostRef.current.appendChild(mf);
      mfRef.current = mf;
      const kb = (window as unknown as { mathVirtualKeyboard: { show: () => void; hide: () => void } }).mathVirtualKeyboard;
      void keyboardHostId; // (legacy) the keyboard is now MathLive's standard bottom-sheet – reliable on phones
      mf.addEventListener("focusin", () => kb.show());
      mf.addEventListener("focusout", () => {
        setTimeout(() => {
          if (document.activeElement !== mf) kb.hide();
        }, 150);
      });
      mf.addEventListener("input", () => {
        const v = mf!.getValue("latex");
        setEmpty(!v.trim());
        onChangeRef.current?.(v);
      });
      mf.addEventListener("change", () => onEnterRef.current?.());
      mf.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEnterRef.current?.();
        }
      });
      if (autoFocus) setTimeout(() => mf?.focus(), 50);
    });
    return () => {
      cancelled = true;
      mf?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative">
      <div ref={hostRef} className="min-h-[58px]" />
      {empty && placeholder && (
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400 text-base select-none" aria-hidden>
          {placeholder}
        </span>
      )}
    </div>
  );
});
export default MathField;
