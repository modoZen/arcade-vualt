"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

const TOUCH_REPEAT_DELAY_MS = 300;
const TOUCH_REPEAT_INTERVAL_MS = 60;
const TOUCH_QUERY = "(pointer: coarse) and (hover: none)";

type DirectionMode = "hold" | "repeat" | "tap";

interface TouchActionConfig {
  code: string;
  label: string;
}

interface TouchControlsProps {
  directionMode: DirectionMode;
  actions?: TouchActionConfig[];
}

function subscribe(callback: () => void) {
  const mql = window.matchMedia(TOUCH_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(TOUCH_QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

function useIsTouchDevice() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function dispatchKey(type: "keydown" | "keyup", code: string) {
  window.dispatchEvent(new KeyboardEvent(type, { code }));
}

const DPAD_ARROW_PATHS: Record<string, string> = {
  up: "M12 4 L20 16 L4 16 Z",
  right: "M8 4 L20 12 L8 20 Z",
  down: "M4 8 L20 8 L12 20 Z",
  left: "M16 4 L16 20 L4 12 Z",
};

interface DirButtonProps {
  code: string;
  label: string;
  mode: DirectionMode;
  direction: "up" | "down" | "left" | "right";
}

function DirButton({ code, label, mode, direction }: DirButtonProps) {
  const repeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);

  function clearRepeatTimers() {
    if (repeatTimeoutRef.current !== null) {
      clearTimeout(repeatTimeoutRef.current);
      repeatTimeoutRef.current = null;
    }
    if (repeatIntervalRef.current !== null) {
      clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  }

  function press() {
    if (activeRef.current) return;
    activeRef.current = true;

    if (mode === "tap") {
      dispatchKey("keydown", code);
      // keydown-only would leave engines that track held-key state (e.g. a
      // justPressed/keys[code] pattern) stuck, unable to detect the next
      // tap's edge — release synchronously so the edge is free again.
      dispatchKey("keyup", code);
      activeRef.current = false;
      return;
    }

    dispatchKey("keydown", code);

    if (mode === "repeat") {
      repeatTimeoutRef.current = setTimeout(() => {
        repeatIntervalRef.current = setInterval(() => {
          dispatchKey("keydown", code);
        }, TOUCH_REPEAT_INTERVAL_MS);
      }, TOUCH_REPEAT_DELAY_MS);
    }
  }

  function release() {
    if (!activeRef.current) return;
    activeRef.current = false;
    clearRepeatTimers();
    if (mode === "hold" || mode === "repeat") {
      dispatchKey("keyup", code);
    }
  }

  useEffect(() => clearRepeatTimers, []);

  return (
    <button
      type="button"
      className={`touch-dpad-btn ${direction}`}
      aria-label={label}
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        e.preventDefault();
        press();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
    >
      <svg className="touch-dpad-arrow" viewBox="0 0 24 24">
        <path d={DPAD_ARROW_PATHS[direction]} fill="currentColor" />
      </svg>
    </button>
  );
}

interface ActionButtonProps extends TouchActionConfig {
  letter: "A" | "B";
}

function ActionButton({ code, label, letter }: ActionButtonProps) {
  return (
    <button
      type="button"
      className={`touch-action-btn ${letter.toLowerCase()}`}
      aria-label={label}
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        e.preventDefault();
        dispatchKey("keydown", code);
        dispatchKey("keyup", code);
      }}
    >
      <span className="touch-action-ring" />
      <span className="touch-action-letter">{letter}</span>
    </button>
  );
}

export default function TouchControls({
  directionMode,
  actions,
}: TouchControlsProps) {
  const isTouch = useIsTouchDevice();
  if (!isTouch) return null;

  return (
    <div className="touch-controls">
      <div className="gp-body">
        <div className="touch-dpad">
          <DirButton
            code="ArrowUp"
            label="▲"
            mode={directionMode}
            direction="up"
          />
          <DirButton
            code="ArrowLeft"
            label="◀"
            mode={directionMode}
            direction="left"
          />
          <DirButton
            code="ArrowRight"
            label="▶"
            mode={directionMode}
            direction="right"
          />
          <DirButton
            code="ArrowDown"
            label="▼"
            mode={directionMode}
            direction="down"
          />
          <div className="touch-hub" aria-hidden="true">
            <span className="touch-hub-gem" />
          </div>
        </div>
        {actions && actions.length > 0 && (
          <div className="touch-actions">
            {actions.map((action, i) => (
              <ActionButton
                key={action.code}
                {...action}
                letter={i === 0 ? "A" : "B"}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
