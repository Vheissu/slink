import { Chart, registerables } from 'chart.js';
import { ApiService, AnalyticsResponseDto, AnalyticsSeriesPoint, LinkStatsDto } from '../../services/api';
import { AuthService } from '../../services/auth';

import { LatestRequest } from '../../utils/latest-request';
import { downloadCsv } from '../../utils/csv';
import { quickDateRange, QuickRange } from '../../utils/date-range';

Chart.register(...registerables);

export class AnalyticsPage {
  static inject = [ApiService, AuthService];
  queryInput = '';
  fromDate = '';
  toDate = '';
  includeBots = false;
  stats: LinkStatsDto | null = null;
  scope: AnalyticsResponseDto['scope'] | null = null;
  range: AnalyticsResponseDto['range'] | null = null;
  series: AnalyticsSeriesPoint[] = [];
  isLoading = true;
  error = '';
  hasToken = false;
  activeRange: QuickRange | null = '30d';
  chartCanvas?: HTMLCanvasElement;
  chart?: Chart;
  private statsRequest = new LatestRequest();

  constructor(private api: ApiService, private auth: AuthService) {}

  binding() {
    this.hasToken = this.auth.hasToken();
  }

  attached() {
    if (!this.hasToken) {
      this.isLoading = false;
      return;
    }
    this.applyQuickRange('30d');
    void this.fetchStats();
  }

  detaching() {
    this.statsRequest.cancel();
    this.destroyChart();
  }

  async fetchStats() {
    const isCurrent = this.statsRequest.start();
    this.isLoading = true;
    this.error = '';
    try {
      if (this.fromDate && this.toDate && this.fromDate > this.toDate) {
        throw new Error('The end date must be on or after the start date.');
      }
      const response = await this.api.getAnalytics({
        query: this.queryInput.trim() || null,
        from: this.fromDate || null,
        to: this.toDate || null,
        include_bots: this.includeBots,
      });
      if (!isCurrent()) return;
      this.stats = response.stats;
      this.scope = response.scope;
      this.range = response.range;
      this.series = response.series ?? [];
      this.renderChart();
    } catch (err) {
      if (!isCurrent()) return;
      this.error = err instanceof Error ? err.message : 'Failed to load analytics';
      this.stats = null;
      this.scope = null;
      this.range = null;
      this.series = [];
      this.destroyChart();
    } finally {
      if (isCurrent()) this.isLoading = false;
    }
  }

  clearQuery() {
    this.queryInput = '';
    return this.fetchStats();
  }

  async applyQuickRangeAndFetch(range: QuickRange) {
    this.applyQuickRange(range);
    await this.fetchStats();
  }

  applyQuickRange(range: QuickRange) {
    this.activeRange = range;
    const dates = quickDateRange(range);
    this.fromDate = dates.from;
    this.toDate = dates.to;
  }

  async applyCustomRange() {
    this.activeRange = null;
    await this.fetchStats();
  }

  exportCsv() {
    if (this.isLoading || !this.stats || !this.range) {
      return;
    }

    const rows: string[][] = [];
    rows.push(['Analytics export']);
    rows.push(['Range', this.range.from, this.range.to]);
    rows.push(['Include bots', this.range.include_bots ? 'yes' : 'no']);
    rows.push([]);

    rows.push(['Series']);
    rows.push(['label', 'total']);
    this.series.forEach((point) => rows.push([point.label, String(point.total)]));
    rows.push([]);

    rows.push(['Top countries']);
    rows.push(['country', 'total']);
    this.stats.by_country.forEach((item) => rows.push([item.country, String(item.total)]));
    rows.push([]);

    rows.push(['Top devices']);
    rows.push(['device', 'total']);
    this.stats.by_device.forEach((item) => rows.push([item.device_type, String(item.total)]));
    rows.push([]);

    rows.push(['Top browsers']);
    rows.push(['browser', 'total']);
    this.stats.by_browser.forEach((item) => rows.push([item.browser, String(item.total)]));
    rows.push([]);

    rows.push(['Top referrers']);
    rows.push(['referrer', 'total']);
    this.stats.by_referrer.forEach((item) => rows.push([item.referer, String(item.total)]));

    downloadCsv('slink-analytics.csv', rows);
  }

  exportPdf() {
    if (this.isLoading || !this.stats || !this.range) {
      return;
    }

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      this.error = 'Your browser blocked the print window. Allow pop-ups and try again.';
      return;
    }

    const scopeText = this.scope?.mode === 'filtered' ? `Filtered: ${this.scope.query}` : 'Global analytics';
    const safeScope = this.escapeHtml(scopeText);
    const safeFrom = this.escapeHtml(this.range.from);
    const safeTo = this.escapeHtml(this.range.to);
    const html = `
      <html>
        <head>
          <title>Slink Analytics</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { margin-bottom: 4px; }
            h2 { margin-top: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Slink Analytics</h1>
          <p>${safeScope}</p>
          <p>Range: ${safeFrom} to ${safeTo}</p>
          <p>Include bots: ${this.range.include_bots ? 'yes' : 'no'}</p>

          <h2>Totals</h2>
          <p>Total clicks: ${this.stats.total}</p>

          <h2>Top countries</h2>
          ${this.renderTable(['Country', 'Total'], this.stats.by_country.map((item) => [item.country, item.total]))}

          <h2>Top devices</h2>
          ${this.renderTable(['Device', 'Total'], this.stats.by_device.map((item) => [item.device_type, item.total]))}

          <h2>Top browsers</h2>
          ${this.renderTable(['Browser', 'Total'], this.stats.by_browser.map((item) => [item.browser, item.total]))}

          <h2>Top referrers</h2>
          ${this.renderTable(['Referrer', 'Total'], this.stats.by_referrer.map((item) => [item.referer, item.total]))}
        </body>
      </html>
    `;

    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  private renderTable(headers: string[], rows: Array<[string, number]>) {
    const head = headers.map((h) => `<th>${this.escapeHtml(h)}</th>`).join('');
    const body = rows
      .map(
        (row) =>
          `<tr><td>${this.escapeHtml(row[0] ?? '')}</td><td>${this.escapeHtml(row[1] ?? 0)}</td></tr>`,
      )
      .join('');
    return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  private escapeHtml(value: unknown) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private renderChart() {
    if (!this.chartCanvas) {
      return;
    }

    const labels = this.series.map((point) => point.label);
    const values = this.series.map((point) => point.total);

    if (this.chart) {
      this.chart.data.labels = labels;
      this.chart.data.datasets[0].data = values;
      this.chart.update();
      return;
    }

    this.chart = new Chart(this.chartCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Clicks',
            data: values,
            borderColor: '#c24718',
            backgroundColor: 'rgba(194, 71, 24, 0.10)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxTicksLimit: 6, color: '#6b7178' },
          },
          y: {
            grid: { color: '#eef0f2' },
            ticks: { color: '#6b7178', precision: 0 },
          },
        },
      },
    });
  }

  private destroyChart() {
    this.chart?.destroy();
    this.chart = undefined;
  }
}
