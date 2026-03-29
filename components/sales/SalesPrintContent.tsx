import React from "react";
import SalesCorePrintSections, { type SalesCorePrintSectionsProps } from "./SalesCorePrintSections";
import SalesDrilldownPrintSections, { type SalesDrilldownPrintSectionsProps } from "./SalesDrilldownPrintSections";

type SalesPrintContentProps = {
  rangeLabel: string;
  compareLabel?: string;
  generatedAt: Date;
  selectedSalesperson?: string | null;
  selectedStore?: string | null;
  drilldownProps: SalesDrilldownPrintSectionsProps;
  coreProps: SalesCorePrintSectionsProps;
};

const SalesPrintContent: React.FC<SalesPrintContentProps> = ({
  rangeLabel,
  compareLabel,
  generatedAt,
  selectedSalesperson,
  selectedStore,
  drilldownProps,
  coreProps,
}) => {
  return (
    <div className="fd-print-root space-y-6">
      <div className="fd-print-header">
        <div className="fd-print-title">WOLF FD Sales Report</div>
        <div className="fd-print-meta">
          <div>Range: {rangeLabel || "N/A"}</div>
          {compareLabel ? <div>Compare: {compareLabel}</div> : null}
          <div>
            Generated: {generatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{" "}
            {generatedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </div>
          {selectedSalesperson ? <div>Salesperson: {selectedSalesperson}</div> : null}
          {selectedStore ? <div>Store: {selectedStore}</div> : null}
        </div>
      </div>

      <SalesDrilldownPrintSections {...drilldownProps} />
      <SalesCorePrintSections {...coreProps} />
    </div>
  );
};

export type { SalesPrintContentProps };

export default SalesPrintContent;
