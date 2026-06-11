"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, X } from "lucide-react";
import { cx, fieldInput } from "../dashboard/primitives";

export function MarketingSavedPurposesField({
  savedPurposes,
  value,
  onChange,
  onDelete,
  deletingPurpose,
  fieldInputClass = fieldInput,
}: {
  savedPurposes: string[];
  value: string;
  onChange: (value: string) => void;
  onDelete: (purpose: string) => void;
  deletingPurpose?: string | null;
  fieldInputClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedSavedPurpose = savedPurposes.includes(value) ? value : "";

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div className="grid gap-3">
      {savedPurposes.length > 0 && (
        <div ref={containerRef} className="relative">
          <label className="block text-xs font-semibold text-gray-700 mb-1">Saved events &amp; purposes</label>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-haspopup="listbox"
            className={cx(
              fieldInputClass,
              "w-full flex items-center justify-between gap-2 text-left"
            )}
          >
            <span
              className={cx(
                "truncate",
                selectedSavedPurpose ? "text-gray-900" : "text-gray-500"
              )}
            >
              {selectedSavedPurpose || "Select a saved event or purpose…"}
            </span>
            <ChevronDown
              className={cx("w-4 h-4 shrink-0 text-gray-500 transition", open && "rotate-180")}
            />
          </button>

          {open && (
            <ul
              role="listbox"
              className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
            >
              {savedPurposes.map((purpose) => {
                const isSelected = value === purpose;
                const isDeleting = deletingPurpose === purpose;

                return (
                  <li
                    key={purpose}
                    role="option"
                    aria-selected={isSelected}
                    className={cx(
                      "flex items-center gap-1",
                      isSelected ? "bg-violet-50" : "hover:bg-gray-50"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onChange(purpose);
                        setOpen(false);
                      }}
                      className={cx(
                        "min-w-0 flex-1 truncate px-3 py-2 text-left text-sm",
                        isSelected ? "font-semibold text-violet-900" : "text-gray-800"
                      )}
                      title={purpose}
                    >
                      {purpose}
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(purpose);
                      }}
                      disabled={isDeleting}
                      className="shrink-0 mr-1.5 p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                      aria-label={`Delete ${purpose}`}
                    >
                      {isDeleting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <X className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          {savedPurposes.length > 0 ? "Or enter event / purpose" : "Event / purpose"}
        </label>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. TikTok creator seeding — Q2 launch"
          list="marketing-purpose-suggestions"
          className={fieldInputClass}
        />
        <datalist id="marketing-purpose-suggestions">
          {savedPurposes.map((purpose) => (
            <option key={purpose} value={purpose} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
