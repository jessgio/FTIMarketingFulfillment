import Link from "next/link";
import { Megaphone, Package } from "lucide-react";
import { CenteredPage, SurfaceCard } from "../components/dashboard/primitives";

export default function HomePage() {
  return (
    <CenteredPage>
      <div className="max-w-lg w-full mx-auto text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-600 mb-2">
          From This Island
        </p>
        <h1 className="text-3xl font-black text-gray-900 mb-2">Marketing Fulfillment</h1>
        <p className="text-sm text-gray-600 mb-8">
          Request marketing shipments or pack and dispatch orders from the warehouse.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/marketing" className="group">
            <SurfaceCard className="p-6 h-full text-left transition-shadow hover:shadow-md">
              <Megaphone className="w-8 h-8 text-violet-600 mb-3" />
              <h2 className="font-bold text-gray-900 group-hover:text-violet-700">Marketing portal</h2>
              <p className="text-sm text-gray-600 mt-1">Create and track shipment requests</p>
            </SurfaceCard>
          </Link>

          <Link href="/marketing/fulfill" className="group">
            <SurfaceCard className="p-6 h-full text-left transition-shadow hover:shadow-md">
              <Package className="w-8 h-8 text-violet-600 mb-3" />
              <h2 className="font-bold text-gray-900 group-hover:text-violet-700">Packing portal</h2>
              <p className="text-sm text-gray-600 mt-1">Scan, pack, label, and ship requests</p>
            </SurfaceCard>
          </Link>
        </div>
      </div>
    </CenteredPage>
  );
}
