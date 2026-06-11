"use client";

import { Loader2, X } from "lucide-react";
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
  return (
    <div className="grid gap-3">
      {savedPurposes.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Saved events &amp; purposes</label>
          <ul className="space-y-1.5">
            {savedPurposes.map((purpose) => {
              const isSelected = value === purpose;
              const isDeleting = deletingPurpose === purpose;

              return (
                <li
                  key={purpose}
                  className={cx(
                    "flex items-center gap-2 rounded-lg border px-2 py-1.5",
                    isSelected ? "border-violet-300 bg-violet-50" : "border-gray-200 bg-white"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onChange(purpose)}
                    className={cx(
                      "min-w-0 flex-1 text-left text-sm truncate",
                      isSelected ? "font-semibold text-violet-900" : "text-gray-800 hover:text-violet-800"
                    )}
                    title={purpose}
                  >
                    {purpose}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(purpose)}
                    disabled={isDeleting}
                    className="shrink-0 p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
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
