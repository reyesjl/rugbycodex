const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return numberFormatter.format(value);
}

export function formatMb(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${numberFormatter.format(value)} MB`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${numberFormatter.format(value)}%`;
}

export function formatStorage(valueMb: number | null | undefined): string {
  if (valueMb === null || valueMb === undefined) return '—';

  if (valueMb >= 1024) {
    const valueGb = valueMb / 1024;
    const formatted = numberFormatter.format(valueGb);
    const withDecimal = formatted.includes('.') ? formatted : `${formatted}.0`;
    return `${withDecimal} GB`;
  }

  return `${numberFormatter.format(valueMb)} MB`;
}
