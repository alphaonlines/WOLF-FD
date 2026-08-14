export type LatestDeliveredRange = {
  start: string;
  endInclusive: string;
  label: "Month to date" | "Latest available month";
};

export function latestDeliveredRange(newestDeliveredDate: string | null, localToday: string): LatestDeliveredRange | null {
  if (!newestDeliveredDate || !/^\d{4}-\d{2}-\d{2}$/.test(newestDeliveredDate) || !/^\d{4}-\d{2}-\d{2}$/.test(localToday)) return null;
  const newestMonth = newestDeliveredDate.slice(0, 7);
  const currentMonth = localToday.slice(0, 7);
  const isCurrentMonth = newestMonth === currentMonth;
  return {
    start: `${newestMonth}-01`,
    endInclusive: isCurrentMonth ? localToday : newestDeliveredDate,
    label: isCurrentMonth ? "Month to date" : "Latest available month",
  };
}
