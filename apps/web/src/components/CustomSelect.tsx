import React, { useState, useRef, useEffect } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  id?: string;
  value: string;
  options: SelectOption[];
  placeholder?: string;
  onChange: (val: string) => void;
}

export function CustomSelect({
  id,
  value,
  options,
  placeholder = "Any",
  onChange,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    // Only listen when the dropdown is actually open for better performance
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className={`c-select-wrapper ${open ? "open" : ""}`} ref={ref}>
      <button
        id={id}
        type="button"
        className={`c-select-trigger ${open ? "focused" : ""} ${!selectedOption?.value ? "placeholder" : ""}`}
        onClick={(e) => {
          e.preventDefault();
          setOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="c-select-label">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`c-select-arrow ${open ? "rotate" : ""}`}
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <ul className="c-select-menu" role="listbox">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                className={`c-select-option ${isSelected ? "selected" : ""}`}
                // Using pure onClick fixes Next.js Router interruptions
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {isSelected && (
                  <svg
                    className="c-select-check"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 8.5l3.5 3.5 6.5-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {/* Self-contained styles — these pages use plain <style> tags, not CSS Modules,
          so :global() is invalid here. This component owns its own CSS. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .c-select-wrapper { position: relative; width: 100%; }
        .c-select-trigger {
          width: 100%; height: 40px; padding: 0 13px; border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.09);
          background: rgba(255, 255, 255, 0.03); color: #fff;
          font-family: "Inter", sans-serif; font-size: 13px; font-weight: 500;
          display: flex; align-items: center; justify-content: space-between;
          cursor: pointer; box-sizing: border-box; outline: none;
          transition: all 0.18s ease; user-select: none;
        }
        .c-select-trigger.placeholder { color: rgba(255, 255, 255, 0.4); }
        .c-select-trigger:hover { background: rgba(255, 255, 255, 0.05); border-color: rgba(255, 255, 255, 0.16); }
        .c-select-trigger.focused {
          background: rgba(99, 102, 241, 0.06); border-color: rgba(99, 102, 241, 0.45);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }
        .c-select-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; }
        .c-select-arrow {
          width: 14px; height: 14px; color: rgba(255, 255, 255, 0.4);
          flex-shrink: 0; margin-left: 8px; transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .c-select-arrow.rotate { transform: rotate(180deg); color: #818cf8; }
        .c-select-menu {
          position: absolute; top: calc(100% + 6px); left: 0; width: 100%;
          max-height: 240px; overflow-y: auto; background: #11131c;
          border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px;
          padding: 5px; margin: 0; list-style: none; z-index: 9999;
          box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
        }
        .c-select-menu::-webkit-scrollbar { width: 5px; }
        .c-select-menu::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.12); border-radius: 4px; }
        .c-select-option {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 11px; border-radius: 8px; font-size: 13px; font-weight: 500;
          color: rgba(255, 255, 255, 0.7); cursor: pointer; transition: all 0.12s ease;
        }
        .c-select-option:hover { background: rgba(255, 255, 255, 0.06); color: #fff; }
        .c-select-option.selected { background: rgba(99, 102, 241, 0.15); color: #a5b4fc; font-weight: 600; }
        .c-select-check { width: 13px; height: 13px; color: #818cf8; flex-shrink: 0; }
      `,
        }}
      />
    </div>
  );
}
