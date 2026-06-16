import type { ReactNode } from "react";
import Barcode from "react-barcode";
import { MARKETING_LABEL_CLASS } from "./MarketingShippingLabel";
import type { BiteshipLabelData } from "../../lib/biteshipLabelData";

function LabelBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3">
      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-600 mb-1">{title}</p>
      {children}
    </div>
  );
}

export function MarketingBiteshipShippingLabel({ label }: { label: BiteshipLabelData }) {
  return (
    <div className={MARKETING_LABEL_CLASS}>
      <div className="border-b-4 border-black pb-3 mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-black text-2xl leading-none uppercase tracking-tight">
            {label.courierDisplayName}
          </h2>
          <p className="text-[10px] font-bold uppercase tracking-widest mt-1">{label.serviceLabel}</p>
        </div>
        {label.routingCode && (
          <div className="text-right shrink-0">
            <p className="text-[8px] font-bold uppercase tracking-widest text-gray-600">Routing</p>
            <p className="font-black text-xl leading-none font-mono">{label.routingCode}</p>
          </div>
        )}
      </div>

      <div className="border-2 border-black px-3 py-2 mb-3 text-center">
        <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-gray-600 mb-1">AWB / Waybill</p>
        <p className="font-black text-lg font-mono tracking-wide">{label.waybillId}</p>
        <div className="mt-2 flex justify-center">
          <Barcode
            value={label.waybillId}
            format="CODE128"
            width={1.6}
            height={48}
            displayValue={false}
            margin={0}
            background="transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <LabelBlock title="From">
          <p className="text-xs font-black leading-tight">{label.senderOrganization}</p>
          <p className="text-[11px] font-bold leading-snug">{label.senderName}</p>
          <p className="text-[11px] font-semibold leading-snug">{label.senderPhone}</p>
          <p className="text-[10px] font-medium leading-snug mt-1">{label.senderAddress}</p>
          <p className="text-[10px] font-bold mt-1">{label.senderPostalCode}</p>
        </LabelBlock>

        <LabelBlock title="Ship to">
          <p className="text-xs font-black leading-tight">{label.recipientName}</p>
          <p className="text-[11px] font-bold leading-snug">{label.recipientPhone}</p>
          {label.recipientAddressLines.map((line) => (
            <p key={line} className="text-[10px] font-semibold leading-snug">
              {line}
            </p>
          ))}
          <p className="text-[10px] font-semibold leading-snug">{label.recipientCityStatePostal}</p>
          <p className="text-[10px] font-bold">{label.recipientCountry}</p>
        </LabelBlock>
      </div>

      <div className="border-y-2 border-black py-2 mb-3 text-[10px]">
        <div className="flex justify-between gap-2">
          <span>
            <span className="font-black uppercase">Weight </span>
            {label.packageWeightGrams} g
          </span>
          <span className="font-mono font-bold">{label.referenceBarcode}</span>
        </div>
        <p className="mt-1 font-medium leading-snug">{label.packageSummary}</p>
        {label.orderNote && (
          <p className="mt-1 text-[9px] leading-snug">
            <span className="font-black uppercase">Note </span>
            {label.orderNote}
          </p>
        )}
      </div>

      <div className="mt-auto pt-1 text-center">
        <p className="text-[8px] font-bold uppercase tracking-widest text-gray-600">
          Biteship · {label.biteshipOrderId}
        </p>
        <p className="text-[8px] text-gray-500 mt-1 uppercase font-bold tracking-wider">
          Affix to package · courier pickup label
        </p>
      </div>
    </div>
  );
}
