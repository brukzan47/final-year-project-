// Shared small chart options for compact visuals
export const smallChartOptionsBase = {
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { display: false, maxTicksLimit: 3 } },
    y: { grid: { display: false }, ticks: { display: false } },
  },
};

export function smallChartOptions(extra = {}) {
  const merged = { ...smallChartOptionsBase, ...extra };
  if (extra.plugins) merged.plugins = { ...smallChartOptionsBase.plugins, ...extra.plugins };
  if (extra.scales) {
    merged.scales = {
      x: { ...(smallChartOptionsBase.scales?.x || {}), ...(extra.scales?.x || {}) },
      y: { ...(smallChartOptionsBase.scales?.y || {}), ...(extra.scales?.y || {}) },
    };
  }
  return merged;
}

export function smallHorizontalBarOptions(extra = {}) {
  return smallChartOptions({ indexAxis: 'y', ...extra });
}

export function smallTimeSeriesOptions(extra = {}) {
  // Minimal x-axis ticks for time series; keep y-axis hidden by default
  return smallChartOptions({
    scales: {
      x: { grid: { display: false }, ticks: { display: true, maxTicksLimit: 4, autoSkip: true } },
      y: { grid: { display: false }, ticks: { display: false } },
    },
    ...extra,
  });
}

// Professional, medium-density chart options
export const professionalChartOptionsBase = {
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'bottom',
      labels: { boxWidth: 10, boxHeight: 10, usePointStyle: false, font: { size: 11 } },
    },
    tooltip: { enabled: true },
  },
  scales: {
    x: {
      grid: { display: true, color: 'rgba(0,0,0,0.05)' },
      ticks: { display: true, autoSkip: true, maxTicksLimit: 6, font: { size: 10 } },
    },
    y: {
      beginAtZero: true,
      grid: { display: true, color: 'rgba(0,0,0,0.06)' },
      ticks: { display: true, maxTicksLimit: 5, font: { size: 10 } },
    },
  },
};

export function professionalChartOptions(extra = {}) {
  const merged = { ...professionalChartOptionsBase, ...extra };
  if (extra.plugins) merged.plugins = { ...professionalChartOptionsBase.plugins, ...extra.plugins };
  if (extra.scales) {
    merged.scales = {
      x: { ...(professionalChartOptionsBase.scales?.x || {}), ...(extra.scales?.x || {}) },
      y: { ...(professionalChartOptionsBase.scales?.y || {}), ...(extra.scales?.y || {}) },
    };
  }
  return merged;
}

export function professionalTimeSeriesOptions(extra = {}) {
  return professionalChartOptions({
    scales: {
      x: { grid: { display: true, color: 'rgba(0,0,0,0.05)' }, ticks: { display: true, maxTicksLimit: 6, autoSkip: true, font: { size: 10 } } },
      y: { grid: { display: true, color: 'rgba(0,0,0,0.06)' }, ticks: { display: true, maxTicksLimit: 5, font: { size: 10 } }, beginAtZero: true },
    },
    ...extra,
  });
}

// Shared chart height for dashboard and other views
export const CHART_HEIGHT = 200;
export const CHART_HEIGHT_DESKTOP = 200;
export const CHART_HEIGHT_MOBILE = 140;
