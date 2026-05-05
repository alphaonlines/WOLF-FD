import React from "react";
import { Calculator } from "lucide-react";

type SmartPricingCalculatorPageProps = {
  isDarkMode: boolean;
};

const SmartPricingCalculatorPage: React.FC<SmartPricingCalculatorPageProps> = ({ isDarkMode }) => {
  const calculatorUrl = `${import.meta.env.BASE_URL}tools/smart-pricing-calculator.html`;
  const mutedClassName = isDarkMode ? "text-slate-400" : "text-slate-600";
  const headingClassName = isDarkMode ? "text-white" : "text-slate-950";
  const iconClassName = isDarkMode
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const dividerClassName = isDarkMode ? "border-slate-800" : "border-slate-200";
  const frameClassName = isDarkMode
    ? "border-slate-800 bg-slate-950"
    : "border-slate-200 bg-white";

  return (
    <div className="h-full overflow-hidden p-5 lg:p-7">
      <div className="flex h-full min-h-[720px] flex-col gap-4">
        <div className={`flex items-center gap-3 border-b pb-4 ${dividerClassName}`}>
          <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border ${iconClassName}`}>
            <Calculator size={19} />
          </span>
          <div>
            <h2 className={`text-xl font-semibold ${headingClassName}`}>Smart Calc</h2>
            <p className={`mt-1 text-sm ${mutedClassName}`}>Cost, margin, delivery, tax, protection, and financing tool.</p>
          </div>
        </div>
        <iframe
          title="Smart Calc"
          src={calculatorUrl}
          className={`min-h-[680px] flex-1 rounded-2xl border ${frameClassName}`}
        />
      </div>
    </div>
  );
};

export default SmartPricingCalculatorPage;
