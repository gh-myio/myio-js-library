// engines/CsvExporter.ts
export type CsvRow = (string | number)[];

export const toCsv = (rows: CsvRow[], locale = 'pt-BR', sep = ';') => {
  const fmt = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (v: any) =>
    (typeof v === 'number' ? fmt.format(v) : String(v)).replace(/"/g,'""');
  return rows.map(r => r.map(c => `"${esc(c)}"`).join(sep)).join('\r\n');
};
