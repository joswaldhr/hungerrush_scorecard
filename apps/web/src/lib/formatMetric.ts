export function formatMetricValue(
  value: number | null,
  unit: string,
): string {
  if (value === null) return 'Not configured';

  switch (unit) {
    case 'seconds': {
      const minutes = value / 60;
      return `${minutes.toFixed(1)} min`;
    }
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'count':
      return String(Math.round(value));
    default:
      return String(value);
  }
}
