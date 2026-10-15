import type { BulkLinkPayload } from '../services/api';
import { normalizeUrl, parseClickLimit } from './link-input';

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, '');
  const pushRow = () => {
    row.push(value.trim());
    if (row.some(Boolean)) rows.push(row);
    row = [];
    value = '';
  };

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"') {
      if (inQuotes && source[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(value.trim());
      value = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      pushRow();
    } else {
      value += char;
    }
  }
  if (inQuotes) throw new Error('The CSV has an unclosed quoted field. Check the file and try again.');
  if (value.length || row.length) pushRow();
  return rows;
}

export function buildBulkPayload(rows: string[][]): { payloads: BulkLinkPayload[]; skipped: number } {
  if (!rows.length) return { payloads: [], skipped: 0 };
  const header = rows[0].map((column) => column.toLowerCase());
  const urlColumn = header.findIndex((column) => ['original_url', 'url', 'link'].includes(column));
  // A title such as "Title" in a headerless file must not consume the first row.
  const hasHeader = urlColumn >= 0;
  const payloads: BulkLinkPayload[] = [];
  let skipped = 0;
  const start = hasHeader ? 1 : 0;

  for (let i = start; i < rows.length; i += 1) {
    const row = rows[i];
    const originalUrl = row[hasHeader ? urlColumn : 0] ?? '';
    if (!originalUrl) {
      skipped += 1;
      continue;
    }
    const column = (name: string, fallback: number) => row[hasHeader ? header.indexOf(name) : fallback] ?? '';
    try {
      payloads.push({
        original_url: normalizeUrl(originalUrl),
        title: column('title', 1) || null,
        expires_at: column('expires_at', 2) || null,
        max_clicks: parseClickLimit(column('max_clicks', 3)),
      });
    } catch (error) {
      throw new Error(`CSV row ${i + 1}: ${error instanceof Error ? error.message : 'Invalid link.'}`);
    }
  }
  return { payloads, skipped };
}

export function serializeCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((row) => row.map((value) => {
    let text = String(value ?? '');
    // Quoting alone does not prevent spreadsheet formulas from executing.
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
}

export function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>): void {
  const url = URL.createObjectURL(new Blob([serializeCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
