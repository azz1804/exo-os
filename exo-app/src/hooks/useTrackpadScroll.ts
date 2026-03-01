import { useEffect, useCallback, useRef, type RefObject } from "react";

// === Constants ===

const FRICTION = 0.96;
const MIN_VELOCITY = 0.2; // px/frame — below this, start snap
const LOCK_TIMEOUT = 150; // ms before releasing direction lock
const GESTURE_END_DELAY = 150; // ms after last wheel → start momentum

// === Types ===

interface TrackpadScrollConfig {
  calendarView: "month" | "week" | "day";
  panelCount?: number; // default 3, use 5 for buffered scrolling
  onNavigate: (dir: -1 | 1) => void;
  onZoom?: (deltaY: number, clientY: number) => void;
  isBlocked: boolean;
}

interface TrackpadScrollReturn {
  /** Call in useLayoutEffect(, [currentDate]) after navigate triggers re-render */
  resetAfterNavigate: () => void;
  /** Current pixel offset (for external read) */
  offsetRef: RefObject<number>;
}

type DirectionLock = "scroll-axis" | "cross-axis" | null;

// === Hook ===

export function useTrackpadScroll(
  viewContainerRef: RefObject<HTMLDivElement | null>,
  fadeRefs: {
    start: RefObject<HTMLDivElement | null>; // left (horizontal) or top (vertical)
    end: RefObject<HTMLDivElement | null>; // right (horizontal) or bottom (vertical)
  },
  config: TrackpadScrollConfig
): TrackpadScrollReturn {
  // --- Stable refs for config values (avoid re-registering listener on every render) ---
  const configRef = useRef(config);
  configRef.current = config;

  // --- Scroll state (all refs, zero re-renders during animation) ---
  const offsetPx = useRef(0);
  const velocity = useRef(0);
  const directionLock = useRef<DirectionLock>(null);
  const lockTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const gestureEndTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const momentumRafId = useRef(0);
  const isSnapping = useRef(false);
  const pendingReset = useRef(false);

  // --- Helpers ---

  const getAxis = useCallback((): "horizontal" | "vertical" => {
    return configRef.current.calendarView === "month" ? "vertical" : "horizontal";
  }, []);

  const getBasePercent = useCallback((): number => {
    const n = configRef.current.panelCount ?? 3;
    return ((n - 1) / 2) / n * 100;
  }, []);

  const getPanelSize = useCallback((): number => {
    const parent = viewContainerRef.current?.parentElement;
    if (!parent) return 800;
    return getAxis() === "horizontal" ? parent.clientWidth : parent.clientHeight;
  }, [viewContainerRef, getAxis]);

  const applyTransform = useCallback(() => {
    const container = viewContainerRef.current;
    if (!container) return;
    const axis = getAxis();
    const fn = axis === "horizontal" ? "translateX" : "translateY";
    const pct = getBasePercent();
    container.style.transform = `${fn}(calc(-${pct}% + ${offsetPx.current}px))`;
  }, [viewContainerRef, getAxis, getBasePercent]);

  const updateFades = useCallback(() => {
    const offset = offsetPx.current;
    const panelSize = getPanelSize();
    const ratio = Math.min(Math.abs(offset) / (panelSize * 0.3), 0.6);
    const startOpacity = offset > 0 ? String(ratio) : "0";
    const endOpacity = offset < 0 ? String(ratio) : "0";
    if (fadeRefs.start.current) fadeRefs.start.current.style.opacity = startOpacity;
    if (fadeRefs.end.current) fadeRefs.end.current.style.opacity = endOpacity;
  }, [fadeRefs, getPanelSize]);

  const clearFades = useCallback(() => {
    if (fadeRefs.start.current) fadeRefs.start.current.style.opacity = "0";
    if (fadeRefs.end.current) fadeRefs.end.current.style.opacity = "0";
  }, [fadeRefs]);

  // --- Boundary crossing ---

  const checkBoundary = useCallback(() => {
    const panelSize = getPanelSize();
    if (panelSize <= 0) return;

    if (offsetPx.current > panelSize) {
      configRef.current.onNavigate(-1); // scrolled right → go to past
      offsetPx.current -= panelSize;
      pendingReset.current = true;
    } else if (offsetPx.current < -panelSize) {
      configRef.current.onNavigate(1); // scrolled left → go to future
      offsetPx.current += panelSize;
      pendingReset.current = true;
    }
  }, [getPanelSize]);

  // --- Snap ---

  const startSnap = useCallback(() => {
    const container = viewContainerRef.current;
    if (!container) return;

    const panelSize = getPanelSize();
    const view = configRef.current.calendarView;
    let snapTarget: number;

    if (view === "week") {
      // Snap to nearest day boundary (dayWidth = panelSize / 7)
      const dayWidth = panelSize / 7;
      snapTarget = Math.round(offsetPx.current / dayWidth) * dayWidth;
    } else {
      // Month/Day: snap to nearest panel boundary (0 or ±panelSize)
      if (Math.abs(offsetPx.current) > panelSize * 0.5) {
        const dir: -1 | 1 = offsetPx.current > 0 ? -1 : 1;
        configRef.current.onNavigate(dir);
        offsetPx.current -= -dir * panelSize;
        pendingReset.current = true;
      }
      snapTarget = 0;
    }

    const distance = Math.abs(offsetPx.current - snapTarget);
    if (distance < 1) {
      // Already at target, no animation needed
      offsetPx.current = snapTarget;
      velocity.current = 0;
      clearFades();
      return;
    }

    const snapDuration = Math.max(80, Math.min(350, distance * 3));

    isSnapping.current = true;

    // Apply target transform via CSS transition
    const axis = getAxis();
    const fn = axis === "horizontal" ? "translateX" : "translateY";
    const pct = getBasePercent();
    container.style.transition = `transform ${snapDuration}ms cubic-bezier(0.25, 1, 0.5, 1)`;
    container.style.transform = `${fn}(calc(-${pct}% + ${snapTarget}px))`;

    let completed = false;
    const onEnd = () => {
      if (completed) return;
      completed = true;
      container.removeEventListener("transitionend", onEnd);
      container.style.transition = "none";
      offsetPx.current = snapTarget;
      velocity.current = 0;
      isSnapping.current = false;
      clearFades();
    };
    container.addEventListener("transitionend", onEnd, { once: true });
    // Safety timeout in case transitionend doesn't fire
    setTimeout(onEnd, snapDuration + 50);
  }, [viewContainerRef, getPanelSize, getAxis, getBasePercent, clearFades]);

  // --- Momentum ---

  const stopMomentum = useCallback(() => {
    if (momentumRafId.current) {
      cancelAnimationFrame(momentumRafId.current);
      momentumRafId.current = 0;
    }
  }, []);

  const startMomentum = useCallback(() => {
    stopMomentum();

    const frame = () => {
      velocity.current *= FRICTION;
      offsetPx.current += velocity.current;

      checkBoundary();
      applyTransform();
      updateFades();

      if (Math.abs(velocity.current) > MIN_VELOCITY) {
        momentumRafId.current = requestAnimationFrame(frame);
      } else {
        momentumRafId.current = 0;
        startSnap();
      }
    };

    momentumRafId.current = requestAnimationFrame(frame);
  }, [stopMomentum, checkBoundary, applyTransform, updateFades, startSnap]);

  // --- Cancel ongoing animations (when user interrupts) ---

  const cancelAll = useCallback(() => {
    stopMomentum();
    clearTimeout(gestureEndTimer.current);

    if (isSnapping.current) {
      const container = viewContainerRef.current;
      if (container) {
        // Capture current computed transform position before cancelling
        const computed = getComputedStyle(container).transform;
        container.style.transition = "none";
        container.style.transform = computed; // freeze at current position

        // Recompute offsetPx from the frozen position
        const panelSize = getPanelSize();
        const axis = getAxis();
        const matrix = new DOMMatrix(computed);
        const currentPx = axis === "horizontal" ? matrix.m41 : matrix.m42;
        const parentSize = axis === "horizontal"
          ? (container.parentElement?.clientWidth ?? 800)
          : (container.parentElement?.clientHeight ?? 600);
        const n = configRef.current.panelCount ?? 3;
        const basePx = -((n - 1) / 2) * parentSize;
        offsetPx.current = currentPx - basePx;
      }
      isSnapping.current = false;
    }
  }, [stopMomentum, viewContainerRef, getPanelSize, getAxis]);

  // --- Main wheel handler ---

  useEffect(() => {
    const handler = (e: WheelEvent) => {
      const cfg = configRef.current;

      // Ctrl/Meta + wheel (pinch) → zoom
      if (e.ctrlKey || e.metaKey) {
        if (cfg.onZoom) {
          e.preventDefault();
          cfg.onZoom(e.deltaY, e.clientY);
        }
        return;
      }

      // Blocked (modal open, etc.)
      if (cfg.isBlocked) return;

      const axis = getAxis();
      const primaryDelta = axis === "horizontal" ? e.deltaX : e.deltaY;
      const secondaryDelta = axis === "horizontal" ? e.deltaY : e.deltaX;

      // Direction locking
      if (directionLock.current === null) {
        // Need a minimum threshold to establish direction
        if (Math.abs(primaryDelta) < 1 && Math.abs(secondaryDelta) < 1) return;

        if (Math.abs(primaryDelta) >= Math.abs(secondaryDelta)) {
          directionLock.current = "scroll-axis";
        } else {
          directionLock.current = "cross-axis";
        }
      }

      // Reset lock timer
      clearTimeout(lockTimer.current);
      lockTimer.current = setTimeout(() => {
        directionLock.current = null;
      }, LOCK_TIMEOUT);

      // Cross-axis → let native scroll handle it
      if (directionLock.current === "cross-axis") return;

      // --- Scroll-axis: we handle this ---
      e.preventDefault();

      // If we were snapping or in momentum, cancel and resume live control
      if (isSnapping.current || momentumRafId.current) {
        cancelAll();
      }

      // Accumulate offset (negate: positive deltaX → content moves left → negative offset)
      offsetPx.current -= primaryDelta;
      velocity.current = -primaryDelta;

      // Check boundary
      checkBoundary();

      // Apply visual transform (60fps — no React re-render)
      applyTransform();
      updateFades();

      // Schedule momentum start after gesture ends
      clearTimeout(gestureEndTimer.current);
      gestureEndTimer.current = setTimeout(startMomentum, GESTURE_END_DELAY);
    };

    window.addEventListener("wheel", handler, { passive: false });
    return () => {
      window.removeEventListener("wheel", handler);
      stopMomentum();
      clearTimeout(lockTimer.current);
      clearTimeout(gestureEndTimer.current);
    };
  }, [getAxis, checkBoundary, applyTransform, updateFades, cancelAll, startMomentum, stopMomentum]);

  // --- Reset after navigate (called from useLayoutEffect in parent) ---

  const resetAfterNavigate = useCallback(() => {
    if (!pendingReset.current || !viewContainerRef.current) return;
    pendingReset.current = false;

    const container = viewContainerRef.current;
    container.style.transition = "none";
    applyTransform(); // apply current offsetPx (adjusted after boundary crossing)
    clearFades();
  }, [viewContainerRef, applyTransform, clearFades]);

  return { resetAfterNavigate, offsetRef: offsetPx };
}
