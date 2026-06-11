"use client";

import { Download, Filter } from "lucide-react";
import { DashButton, SurfaceCard, fieldInput } from "../dashboard/primitives";
import {
  ALL_FILTER,
  type PortalExportFilters,
  hasActivePortalFilters,
} from "../../lib/marketingPortalFilters";

export function MarketingPortalExportBar({
  filters,
  filterOptions,
  filteredCount,
  selectedCount,
  onFiltersChange,
  onClearFilters,
  onExport,
  showDateFilters = true,
}: {
  filters: PortalExportFilters;
  filterOptions: {
    divisions: string[];
    users: Array<{ email: string; name: string }>;
    purposes: Array<{ key: string; label: string }>;
  };
  filteredCount: number;
  selectedCount: number;
  onFiltersChange: (filters: PortalExportFilters) => void;
  onClearFilters: () => void;
  onExport: () => void;
  showDateFilters?: boolean;
}) {
  const exportCount = selectedCount > 0 ? selectedCount : filteredCount;
  const activeFilters = hasActivePortalFilters(filters);

  return (
    <SurfaceCard className="p-4 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 text-violet-700 shrink-0 pb-2.5">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wide">Filter &amp; export</span>
        </div>
        <div className="flex-1 min-w-[130px] max-w-xs">
          <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Division</label>
          <select
            value={filters.division}
            onChange={(e) => onFiltersChange({ ...filters, division: e.target.value })}
            className={fieldInput}
          >
            <option value={ALL_FILTER}>All divisions</option>
            {filterOptions.divisions.map((division) => (
              <option key={division} value={division}>
                {division}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[130px] max-w-xs">
          <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">User</label>
          <select
            value={filters.user}
            onChange={(e) => onFiltersChange({ ...filters, user: e.target.value })}
            className={fieldInput}
          >
            <option value={ALL_FILTER}>All users</option>
            {filterOptions.users.map((user) => (
              <option key={user.email} value={user.email}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[130px] max-w-xs">
          <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Purpose</label>
          <select
            value={filters.purpose}
            onChange={(e) => onFiltersChange({ ...filters, purpose: e.target.value })}
            className={fieldInput}
          >
            <option value={ALL_FILTER}>All purposes</option>
            {filterOptions.purposes.map((purpose) => (
              <option key={purpose.key || "__none__"} value={purpose.key}>
                {purpose.label}
              </option>
            ))}
          </select>
        </div>
        {showDateFilters && (
          <>
            <div className="min-w-[130px] max-w-[160px]">
              <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">From date</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
                className={fieldInput}
              />
            </div>
            <div className="min-w-[130px] max-w-[160px]">
              <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">To date</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
                className={fieldInput}
              />
            </div>
          </>
        )}
        {activeFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-xs font-bold text-violet-700 hover:text-violet-900 pb-2.5"
          >
            Clear filters
          </button>
        )}
        <DashButton
          type="button"
          variant="primary"
          size="md"
          disabled={exportCount === 0}
          onClick={onExport}
          className="shrink-0"
        >
          <Download className="w-4 h-4" />
          Export CSV ({exportCount})
        </DashButton>
      </div>
      <p className="text-xs text-gray-600">
        {selectedCount > 0
          ? `${selectedCount} selected · exports selection only`
          : `${filteredCount} matching · select rows below to export a subset, or export all matching`}
      </p>
    </SurfaceCard>
  );
}
