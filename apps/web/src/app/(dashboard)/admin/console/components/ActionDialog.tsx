"use client";

import { useState, useEffect, useRef } from "react";

export type ActionDialogType = "alert" | "confirm" | "prompt";
export type ActionDialogTone = "info" | "danger" | "warning" | "success";

export interface ActionDialogProps {
  isOpen: boolean;
  type?: ActionDialogType;
  tone?: ActionDialogTone;
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  onConfirm: (value?: string) => void;
  onCancel: () => void;
}

export function ActionDialog({
  isOpen,
  type = "alert",
  tone = "info",
  title,
  message,
  placeholder = "Type your response...",
  initialValue = "",
  confirmText,
  cancelText = "Cancel",
  isLoading = false,
  onConfirm,
  onCancel,
}: ActionDialogProps) {
  const [inputValue, setInputValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset input when opened and auto-focus
  useEffect(() => {
    if (isOpen) {
      setInputValue(initialValue);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialValue]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onCancel();
      } else if (e.key === "Enter" && !isLoading) {
        onConfirm(type === "prompt" ? inputValue : undefined);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, inputValue, type, onConfirm, onCancel]);

  if (!isOpen) return null;

  // Visuals based on tone
  const tones = {
    info: {
      color: "#818cf8",
      bg: "rgba(99,102,241,0.1)",
      border: "rgba(99,102,241,0.2)",
    },
    danger: {
      color: "#f87171",
      bg: "rgba(239,68,68,0.1)",
      border: "rgba(239,68,68,0.2)",
    },
    warning: {
      color: "#fbbf24",
      bg: "rgba(245,158,11,0.1)",
      border: "rgba(245,158,11,0.2)",
    },
    success: {
      color: "#34d399",
      bg: "rgba(16,185,129,0.1)",
      border: "rgba(16,185,129,0.2)",
    },
  };
  const activeTone = tones[tone];

  // Default button text
  const defaultConfirmText =
    type === "alert" ? "OK" : type === "prompt" ? "Submit" : "Confirm";
  const finalConfirmText = confirmText || defaultConfirmText;

  return (
    <div className="ad-backdrop" onMouseDown={onCancel}>
      <style>{`
        .ad-backdrop {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          animation: adFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ad-container {
          background: linear-gradient(180deg, #12141c 0%, #0a0c10 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          width: 100%; max-width: 420px;
          box-shadow: 0 32px 120px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05);
          animation: adSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }
        .ad-content { padding: 32px 32px 24px; }
        .ad-footer {
          padding: 20px 32px;
          background: rgba(0,0,0,0.2);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          display: flex; gap: 12px; justify-content: flex-end;
        }
        .ad-icon-wrapper {
          width: 48px; height: 48px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 20px;
        }
        .ad-title {
          font-family: 'Manrope', sans-serif; font-size: 20px; font-weight: 800;
          color: #fff; margin: 0 0 10px; letter-spacing: -0.01em;
        }
        .ad-message {
          font-size: 14px; color: rgba(255,255,255,0.6); line-height: 1.6; margin: 0;
        }
        .ad-input {
          width: 100%; margin-top: 20px;
          background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15);
          color: #fff; padding: 12px 16px; border-radius: 12px; font-size: 14px;
          outline: none; transition: all 0.2s; box-sizing: border-box;
        }
        .ad-input:focus {
          border-color: ${activeTone.color};
          background: ${activeTone.bg};
          box-shadow: 0 0 0 3px rgba(255,255,255,0.05);
        }
        .ad-btn {
          padding: 10px 20px; border-radius: 10px; font-size: 14px; font-weight: 600;
          cursor: pointer; transition: all 0.2s; border: none; outline: none;
        }
        .ad-btn-cancel {
          background: transparent; color: rgba(255,255,255,0.6);
        }
        .ad-btn-cancel:hover { background: rgba(255,255,255,0.05); color: #fff; }
        .ad-btn-confirm {
          background: ${activeTone.color}; color: #000; box-shadow: 0 4px 14px ${activeTone.bg};
        }
        .ad-btn-confirm:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
        .ad-btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

        @keyframes adFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes adSlideUp { from { opacity: 0; transform: translateY(10px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        
        @media (max-width: 600px) {
          .ad-content, .ad-footer { padding: 24px; }
          .ad-footer { flex-direction: column-reverse; }
          .ad-btn { width: 100%; text-align: center; }
        }
      `}</style>

      <div className="ad-container" onMouseDown={(e) => e.stopPropagation()}>
        <div className="ad-content">
          <div
            className="ad-icon-wrapper"
            style={{
              background: activeTone.bg,
              border: `1px solid ${activeTone.border}`,
            }}
          >
            {/* Simple dynamic icon based on tone */}
            <svg
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24"
              stroke={activeTone.color}
              strokeWidth="2.5"
            >
              {tone === "danger" ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              ) : tone === "success" ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              )}
            </svg>
          </div>

          <h2 className="ad-title">{title}</h2>
          {message && <p className="ad-message">{message}</p>}

          {type === "prompt" && (
            <input
              ref={inputRef}
              className="ad-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder}
            />
          )}
        </div>

        <div className="ad-footer">
          {type !== "alert" && (
            <button
              className="ad-btn ad-btn-cancel"
              onClick={onCancel}
              disabled={isLoading}
            >
              {cancelText}
            </button>
          )}
          <button
            className="ad-btn ad-btn-confirm"
            onClick={() =>
              onConfirm(type === "prompt" ? inputValue : undefined)
            }
            disabled={isLoading || (type === "prompt" && !inputValue.trim())}
          >
            {isLoading ? "Processing..." : finalConfirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
