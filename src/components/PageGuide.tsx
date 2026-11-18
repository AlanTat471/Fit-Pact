import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

/** Bump this when the guide text changes and everyone should see it again. */
export const PAGE_GUIDE_VERSION = "1";
const STORAGE_KEY = "numiPageGuideVersion";

const STEPS = [
  {
    path: "/profile",
    title: "Profile",
    body: "This is your profile page where you can track your own daily goals, tasks and actions. This is also where you can tell us a bit about yourself!",
  },
  {
    path: "/tdee-calculator",
    title: "TDEE",
    body: "This is where your daily caloric needs are determined! Accurately calculated based on your own details and catered only to you!",
  },
  {
    path: "/dashboard",
    title: "Dashboard",
    body: "This is where you will track daily and the app will auto-adjust where applicable!",
  },
  {
    path: "/macro-breakdown",
    title: "Macros",
    body: "Your daily calories and macro-nutrients. Fully customizable to fit your needs!",
  },
] as const;

type Hole = { top: number; left: number; width: number; height: number };

function readSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === PAGE_GUIDE_VERSION;
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, PAGE_GUIDE_VERSION);
  } catch {
    /* The guide still closes. A full storage quota should not trap the screen. */
  }
}

export function PageGuide({
  onSpotlight,
  spotlightPath,
}: {
  onSpotlight: (path: string | null) => void;
  spotlightPath: string | null;
}) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(() => !readSeen());
  const [hole, setHole] = useState<Hole | null>(null);
  const current = STEPS[step];

  useLayoutEffect(() => {
    onSpotlight(visible ? current.path : null);
  }, [visible, current.path, onSpotlight]);

  useLayoutEffect(() => {
    if (!visible || spotlightPath !== current.path) return;
    const target = document.querySelector(`[data-guide="${current.path}"]`);
    if (!target) return;

    const measure = () => {
      const rect = target.getBoundingClientRect();
      setHole({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    measure();
    window.addEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => {
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [visible, current.path, spotlightPath]);

  const advance = () => {
    if (step < STEPS.length - 1) {
      setStep((value) => value + 1);
      return;
    }
    markSeen();
    setVisible(false);
  };

  if (!visible || !hole) return null;

  const cardWidth = Math.min(340, window.innerWidth - 32);
  const center = hole.left + hole.width / 2;
  const left = Math.max(16, Math.min(center - cardWidth / 2, window.innerWidth - 16 - cardWidth));
  const last = step === STEPS.length - 1;
  const radius = hole.height / 2;
  const maskId = "numi-page-guide-hole";

  return createPortal(
    <div
      className="fixed inset-0 z-[250]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="page-guide-title"
      onClick={advance}
    >
      <svg
        className="pointer-events-none absolute left-0 top-0"
        width={window.innerWidth}
        height={window.innerHeight}
        aria-hidden
      >
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={window.innerWidth} height={window.innerHeight}>
          <rect width={window.innerWidth} height={window.innerHeight} fill="white" />
          <rect x={hole.left} y={hole.top} width={hole.width} height={hole.height} rx={radius} ry={radius} fill="black" />
        </mask>
      </svg>
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-md"
        style={{ mask: `url(#${maskId})`, WebkitMask: `url(#${maskId})` }}
      />
      <div
        className="absolute rounded-[24px] border border-white/15 bg-[#141417] p-4 text-white shadow-2xl"
        style={{ left, width: cardWidth, bottom: window.innerHeight - hole.top + 14 }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
          {step + 1} of {STEPS.length}
        </p>
        <h2 id="page-guide-title" className="mt-1 text-lg font-semibold">
          {current.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/85">{current.body}</p>
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            size="sm"
            className="h-11 px-5"
            onClick={(event) => {
              event.stopPropagation();
              advance();
            }}
          >
            {last ? "Done" : "Next"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
