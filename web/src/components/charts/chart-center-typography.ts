export const chartCenterContainerClassName =
  "@container/chart-center size-full min-w-0";

/** Primary stat — ~22% of center width, clamped between text-sm and text-3xl. */
export const chartCenterValueClassName =
  "font-semibold tabular-nums leading-none text-[clamp(0.75rem,22cqw,1.875rem)]";

/** Supporting label — ~9% of center width, clamped between 11px and text-xs. */
export const chartCenterLabelClassName =
  "max-w-full truncate leading-tight text-[clamp(0.6875rem,9cqw,0.75rem)]";
