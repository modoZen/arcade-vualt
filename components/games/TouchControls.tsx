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

interface DirButtonProps {
  code: string;
  label: string;
  mode: DirectionMode;
  className: string;
}

function DirButton({ code, label, mode, className }: DirButtonProps) {
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
      className={className}
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
      {label}
    </button>
  );
}

function ActionButton({ code, label }: TouchActionConfig) {
  return (
    <button
      type="button"
      className="touch-action-btn"
      aria-label={label}
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        e.preventDefault();
        dispatchKey("keydown", code);
        dispatchKey("keyup", code);
      }}
    >
      {label}
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
      <div className="touch-dpad">
        <DirButton
          code="ArrowUp"
          label="▲"
          mode={directionMode}
          className="touch-dpad-btn up"
        />
        <DirButton
          code="ArrowLeft"
          label="◀"
          mode={directionMode}
          className="touch-dpad-btn left"
        />
        <DirButton
          code="ArrowRight"
          label="▶"
          mode={directionMode}
          className="touch-dpad-btn right"
        />
        <DirButton
          code="ArrowDown"
          label="▼"
          mode={directionMode}
          className="touch-dpad-btn down"
        />
      </div>
      {actions && actions.length > 0 && (
        <div className="touch-actions">
          {actions.map((action) => (
            <ActionButton key={action.code} {...action} />
          ))}
        </div>
      )}
    </div>
  );
}
