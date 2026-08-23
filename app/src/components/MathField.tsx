"use client";
import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react";
import type { MathfieldElement } from "mathlive";
import { buildLayout } from "@/lib/math/keyboard";
import { isCommitKey, isIntentionalCommit } from "@/lib/math/commit";

export interface MathFieldHandle {
  getValue: () => string;
  setValue: (latex: string) => void;
  /** keyboard:false – ממקדים את השדה בלי לפתוח את המקלדת (מצב שבו נגה עוד קוראת את התרגיל) */
  focus: (opts?: { keyboard?: boolean }) => void;
  clear: () => void;
  insert: (latex: string) => void;
}

interface Props {
  placeholder?: string;
  onEnter?: () => void;
  onChange?: (latex: string) => void;
  autoFocus?: boolean;
  /** הנעלמים של התרגיל הנוכחי – המקלדת נבנית סביבם, כך שאף אות לא תיחסר */
  variables?: string[];
  /** id of an element to host the virtual keyboard (inline instead of overlay) */
  keyboardHostId?: string;
}

type VKB = {
  layouts: unknown;
  addEventListener: (t: string, f: () => void) => void;
  visible: boolean;
  boundingRect: DOMRect;
  show: () => void;
  hide: () => void;
};
const vkb = () => (window as unknown as { mathVirtualKeyboard: VKB }).mathVirtualKeyboard;

/** כמה זמן אחרי focus שקט עדיין לא פותחים את המקלדת */
const SILENT_MS = 900;

let configured = false;
async function setup() {
  const ml = await import("mathlive");
  if (!configured) {
    configured = true;
    ml.MathfieldElement.fontsDirectory = "https://unpkg.com/mathlive@0.110.0/fonts";
    ml.MathfieldElement.soundsDirectory = null;
    ml.MathfieldElement.locale = "he";
    const kb = vkb();
    // keep the app's fixed bottom bar above the keyboard: publish keyboard height as a CSS variable
    const publish = () => {
      const h = kb.visible ? Math.round(kb.boundingRect.height) : 0;
      document.documentElement.style.setProperty("--kbh", `${h}px`);
      document.documentElement.classList.toggle("kb-open", h > 0);
    };
    kb.addEventListener("geometrychange", publish);
    kb.addEventListener("virtual-keyboard-toggle", publish);
    kb.layouts = buildLayout();
    // משוב מישוש עדין בלחיצת מקש (אנדרואיד; iOS מתעלם בשקט)
    document.addEventListener(
      "pointerdown",
      (e) => {
        const t = e.target as HTMLElement | null;
        if (t?.closest?.(".MLK__keycap, .ML__keyboard [data-command]")) {
          try {
            navigator.vibrate?.(8);
          } catch {
            /* ignore */
          }
        }
      },
      { passive: true, capture: true }
    );
  }
  return ml;
}

const MathField = forwardRef<MathFieldHandle, Props>(function MathField({ placeholder, onEnter, onChange, autoFocus, variables, keyboardHostId }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mfRef = useRef<MathfieldElement | null>(null);
  const [empty, setEmpty] = useState(true);
  /**
   * פוקוס "שקט": השדה מקבל את הסמן, אבל המקלדת לא נפתחת מעצמה.
   * חלון זמן ולא דגל רגעי – MathLive יורה focusin גם באיחור (למשל אחרי setValue
   * כשמשחזרים תרגיל שנקטע), ואז דגל שהתאפס כבר פתח את המקלדת על אמצע המסך.
   */
  const silentUntilRef = useRef(0);
  /** מתי נלחץ ↵ במקלדת – רק change שנגרר ממנו נחשב "בדקי לי את השורה" */
  const commitAtRef = useRef(0);
  const onEnterRef = useRef(onEnter);
  const onChangeRef = useRef(onChange);
  onEnterRef.current = onEnter;
  onChangeRef.current = onChange;
  const varsKey = (variables ?? []).join("");

  useImperativeHandle(ref, () => ({
    getValue: () => mfRef.current?.getValue("latex") ?? "",
    setValue: (v: string) => {
      mfRef.current?.setValue(v);
      setEmpty(!v.trim());
    },
    focus: (opts?: { keyboard?: boolean }) => {
      silentUntilRef.current = opts?.keyboard === false ? Date.now() + SILENT_MS : 0;
      mfRef.current?.focus();
    },
    clear: () => {
      mfRef.current?.setValue("");
      setEmpty(true);
    },
    insert: (v: string) => {
      silentUntilRef.current = 0; // הכנסה מהמחשבון = היא ממשיכה להקליד, המקלדת נפתחת
      mfRef.current?.focus();
      mfRef.current?.insert(v);
    },
  }));

  // המקלדת מתעדכנת לפי הנעלמים של התרגיל הנוכחי
  useEffect(() => {
    let cancelled = false;
    setup().then(() => {
      if (cancelled) return;
      try {
        vkb().layouts = buildLayout(variables ?? []);
      } catch {
        /* ignore */
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [varsKey]);

  useEffect(() => {
    let cancelled = false;
    let mf: MathfieldElement | null = null;
    let onKeycap: ((e: Event) => void) | null = null;
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
      const kb = vkb();
      void keyboardHostId; // (legacy) the keyboard is now MathLive's standard bottom-sheet – reliable on phones
      mf.addEventListener("focusin", () => {
        if (Date.now() < silentUntilRef.current) return;
        kb.show();
      });
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
      mf.addEventListener("change", () => {
        // "change" של MathLive נורה גם בלחיצה מכוונת על ↵ וגם סתם כשהשדה מאבד פוקוס –
        // כולל כשנוגעים בכפתור באפליקציה (מחשבון, רמז, השיטה) או יוצאים לוואטסאפ.
        // בלי השער הזה שורה חלקית נבדקת ונרשמת כטעות רק כי הפוקוס עבר. ראה lib/math/commit.
        let focused = false;
        try {
          focused = typeof mf!.hasFocus === "function" ? mf!.hasFocus() : document.activeElement === mf;
        } catch {
          focused = false;
        }
        const intentional = isIntentionalCommit({
          intentAt: commitAtRef.current,
          now: Date.now(),
          hidden: typeof document !== "undefined" && document.hidden,
          focused,
        });
        commitAtRef.current = 0;
        if (!intentional) return;
        onEnterRef.current?.();
      });
      mf.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEnterRef.current?.();
        }
      });
      // נגיעה בשדה תמיד פותחת את המקלדת – גם אם השדה כבר ממוקד (ואז focusin לא נורה שוב)
      hostRef.current.addEventListener("pointerdown", () => {
        silentUntilRef.current = 0;
        setTimeout(() => kb.show(), 0);
      });
      // מקש ה-↵ של המקלדת המתמטית – מסמנים כוונה מפורשת לשליחה
      onKeycap = (e: Event) => {
        if (isCommitKey(e.target)) commitAtRef.current = Date.now();
      };
      document.addEventListener("pointerdown", onKeycap, true);
      if (autoFocus) setTimeout(() => mf?.focus(), 50);
    });
    return () => {
      cancelled = true;
      if (onKeycap) document.removeEventListener("pointerdown", onKeycap, true);
      mf?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative">
      <div ref={hostRef} className="min-h-[58px]" />
      {empty && placeholder && (
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-faint text-base select-none" aria-hidden>
          {placeholder}
        </span>
      )}
    </div>
  );
});
export default MathField;
