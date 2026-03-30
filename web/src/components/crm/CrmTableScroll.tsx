"use client";

import type { ReactNode } from "react";

/** Single scroll wrapper for CRM data tables (desktop + mobile). */
export function CrmTableScroll({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div className="scrollbar-thick w-full overflow-x-auto overflow-y-hidden overscroll-x-contain pb-20 pr-20 [-webkit-overflow-scrolling:touch] touch-pan-x rounded-lg border border-border/50">
        {children}
      </div>
    </div>
  );
}

function Col({ width }: { width: number }) {
  return <col style={{ width }} />;
}

/** Column widths — Car inventory (must match column order). Total drives table width. */
export function CarsInventoryColgroup() {
  return (
    <colgroup>
      <Col width={220} />
      <Col width={100} />
      <Col width={160} />
      <Col width={90} />
      <Col width={140} />
      <Col width={140} />
      <Col width={160} />
      <Col width={220} />
      <Col width={160} />
      <Col width={120} />
      <Col width={260} />
      <Col width={120} />
      <Col width={120} />
      <Col width={120} />
      <Col width={120} />
      <Col width={130} />
      <Col width={140} />
      <Col width={140} />
      <Col width={120} />
      <Col width={108} />
    </colgroup>
  );
}

export const CARS_INVENTORY_TABLE_WIDTH_PX = 2888;

/** Customers list — Name through Actions */
export function CustomersColgroup() {
  return (
    <colgroup>
      <Col width={220} />
      <Col width={160} />
      <Col width={220} />
      <Col width={140} />
      <Col width={220} />
      <Col width={90} />
      <Col width={120} />
      <Col width={100} />
    </colgroup>
  );
}

export const CUSTOMERS_TABLE_WIDTH_PX = 1270;

/** Sold cars tab */
export function SoldCarsColgroup() {
  return (
    <colgroup>
      <Col width={280} />
      <Col width={220} />
      <Col width={140} />
      <Col width={220} />
      <Col width={160} />
      <Col width={140} />
      <Col width={120} />
      <Col width={120} />
      <Col width={180} />
      <Col width={240} />
    </colgroup>
  );
}

export const SOLD_CARS_TABLE_WIDTH_PX = 1820;
