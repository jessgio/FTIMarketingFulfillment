"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Trash2, X } from "lucide-react";
import { DashButton, cx } from "../dashboard/primitives";
import { MarketingPortalExportBar } from "./MarketingPortalExportBar";
import { MarketingPurposeSummary } from "./MarketingPurposeSummary";
import { MarketingShipmentsRegistry } from "./MarketingShipmentsRegistry";
import { deleteMarketingRequestsBulk } from "../../lib/marketingDb";
import {
  ALL_FILTER,
  buildPortalFilterOptions,
  canDeletePortalShipment,
  defaultPortalFilters,
  filterPortalShipmentRequests,
  type PortalExportFilters,
} from "../../lib/marketingPortalFilters";
import { downloadMarketingHistoryExport } from "../../lib/marketingExport";
import type { MarketingRequest, MarketingSession } from "../../types/marketing";

function groupRequestsByPurpose(requests: MarketingRequest[]) {
  const groups = new Map<string, MarketingRequest[]>();
  for (const req of requests) {
    const key = req.request_purpose?.trim() || "";
    const list = groups.get(key) ?? [];
    list.push(req);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b);
    })
    .map(([purposeKey, list]) => ({
      purposeKey,
      label: purposeKey || "No purpose assigned",
      requests: list,
    }));
}

export function MarketingPortalShipmentsPanel({
  requests,
  loading,
  session,
  onViewRequest,
  onUpdated,
  onDeleted,
}: {
  requests: MarketingRequest[];
  loading: boolean;
  session: MarketingSession;
  onViewRequest: (id: string) => void;
  onUpdated: () => void;
  onDeleted?: (ids: string[]) => void;
}) {
  const [filters, setFilters] = useState<PortalExportFilters>(() => defaultPortalFilters(session));
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    if (filtersInitialized) return;
    setFilters(defaultPortalFilters(session));
    setFiltersInitialized(true);
  }, [session, filtersInitialized]);

  const filterOptions = useMemo(() => buildPortalFilterOptions(requests), [requests]);

  const filteredRequests = useMemo(
    () => filterPortalShipmentRequests(requests, filters, session.email),
    [requests, filters, session.email]
  );

  const shipmentsByPurpose = useMemo(
    () => groupRequestsByPurpose(filteredRequests),
    [filteredRequests]
  );

  const selectedRequests = useMemo(
    () => filteredRequests.filter((req) => selectedIds.includes(req.id)),
    [filteredRequests, selectedIds]
  );

  const deletableSelected = useMemo(
    () => selectedRequests.filter((req) => canDeletePortalShipment(req, session)),
    [selectedRequests, session]
  );

  useEffect(() => {
    setSelectedIds([]);
  }, [filters]);

  const allVisibleSelected =
    filteredRequests.length > 0 && selectedIds.length === filteredRequests.length;

  const toggleRow = (id: string) => {
    setActionError("");
    setActionMessage("");
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setActionError("");
    setActionMessage("");
    setSelectedIds(allVisibleSelected ? [] : filteredRequests.map((req) => req.id));
  };

  const handleExport = () => {
    const toExport = selectedRequests.length > 0 ? selectedRequests : filteredRequests;
    downloadMarketingHistoryExport(toExport);
  };

  const handleBatchDelete = async () => {
    if (deletableSelected.length === 0) return;

    const skipped = selectedRequests.length - deletableSelected.length;
    const skipNote =
      skipped > 0
        ? `\n\n${skipped} selected shipment${skipped === 1 ? "" : "s"} cannot be deleted and will be skipped.`
        : "";

    const confirmed = window.confirm(
      `Delete ${deletableSelected.length} shipment${deletableSelected.length === 1 ? "" : "s"}?\n\nThis cannot be undone.${skipNote}`
    );
    if (!confirmed) return;

    setBatchDeleting(true);
    setActionError("");
    setActionMessage("");
    try {
      const ids = deletableSelected.map((req) => req.id);
      const deleted = await deleteMarketingRequestsBulk(session, ids);
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
      onDeleted?.(ids);
      onUpdated();
      setActionMessage(
        `Deleted ${deleted} shipment${deleted === 1 ? "" : "s"}${
          skipped > 0 ? ` (${skipped} skipped)` : ""
        }.`
      );
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Failed to delete selected shipments");
    } finally {
      setBatchDeleting(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      division: ALL_FILTER,
      user: ALL_FILTER,
      purpose: ALL_FILTER,
      status: ALL_FILTER,
      dateFrom: "",
      dateTo: "",
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin w-10 h-10 text-violet-600" />
      </div>
    );
  }

  return (
    <div className={cx("space-y-6", selectedIds.length > 0 && "pb-28")}>
      <MarketingPortalExportBar
        filters={filters}
        filterOptions={filterOptions}
        filteredCount={filteredRequests.length}
        selectedCount={selectedIds.length}
        onFiltersChange={setFilters}
        onClearFilters={clearFilters}
        onExport={handleExport}
      />

      {actionError && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {actionError}
        </p>
      )}
      {actionMessage && (
        <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
          {actionMessage}
        </p>
      )}

      {filteredRequests.length > 0 && (
        <MarketingPurposeSummary groups={shipmentsByPurpose} totalLabel="Filtered shipments" />
      )}

      <MarketingShipmentsRegistry
        requests={filteredRequests}
        session={session}
        onViewRequest={onViewRequest}
        onUpdated={onUpdated}
        variant="portal"
        live
        selectable
        selectedIds={selectedIds}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
        allVisibleSelected={allVisibleSelected}
      />

      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border border-gray-200 shadow-2xl rounded-2xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 z-50 w-full max-w-3xl">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-xl bg-violet-100 text-violet-800">
              {selectedIds.length}
            </div>
            <div>
              <p className="font-bold text-gray-900 leading-tight">Shipments selected</p>
              <p className="text-xs text-gray-600 font-medium">
                {deletableSelected.length > 0
                  ? `${deletableSelected.length} can be deleted · export or delete below`
                  : "Export selection as CSV — selected shipments cannot be deleted"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <DashButton
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedIds([]);
                setActionError("");
              }}
            >
              <X className="w-4 h-4" /> Clear
            </DashButton>
            <DashButton variant="primary" size="md" onClick={handleExport}>
              <Download className="w-4 h-4" /> Export CSV
            </DashButton>
            {deletableSelected.length > 0 && (
              <DashButton
                variant="danger"
                size="md"
                onClick={handleBatchDelete}
                disabled={batchDeleting}
              >
                {batchDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete ({deletableSelected.length})
              </DashButton>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
