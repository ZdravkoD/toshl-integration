import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import styles from '../../styles/Report.module.css';

interface MonthlyBalanceRow {
  month: string;
  income: number;
  expense: number;
  transfer: number;
  net: number;
  balance: number;
}

interface ReportResponse {
  currency: string;
  from: string;
  to: string;
  currentBalance: number;
  bestMonth: string | null;
  worstMonth: string | null;
  rows: MonthlyBalanceRow[];
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2
});

const compactFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0
});

function formatSignedCurrency(value: number) {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${currencyFormatter.format(value)}`;
}

export default function MonthlyBalanceReportPage() {
  const router = useRouter();
  const [from, setFrom] = useState('2025-01-01');
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReport = async (nextFrom = from, nextTo = to) => {
    setLoading(true);
    setError('');

    try {
      const searchParams = new URLSearchParams({
        from: nextFrom,
        to: nextTo
      });
      const response = await fetch(`/api/reports/monthlyBalance?${searchParams.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to load monthly balance report');
        return;
      }

      setReport(data);
      setActiveMonth(data.rows?.length ? data.rows[data.rows.length - 1].month : null);
    } catch (_err) {
      setError('Network error: Failed to load monthly balance report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const chartRows = report?.rows || [];
  const activeRow = chartRows.find((row) => row.month === activeMonth) || chartRows[chartRows.length - 1] || null;

  const chartWidth = 1120;
  const chartHeight = 520;
  const chartPadding = { top: 28, right: 24, bottom: 84, left: 92 };
  const chartInnerWidth = chartWidth - chartPadding.left - chartPadding.right;
  const chartInnerHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const balanceValues = chartRows.map((row) => row.balance);
  const minBalance = balanceValues.length ? Math.min(...balanceValues, 0) : 0;
  const maxBalance = balanceValues.length ? Math.max(...balanceValues, 0) : 0;
  const balanceRange = maxBalance - minBalance || 1;
  const zeroY = chartPadding.top + ((maxBalance - 0) / balanceRange) * chartInnerHeight;
  const xStep = chartRows.length > 1 ? chartInnerWidth / (chartRows.length - 1) : 0;

  const points = chartRows.map((row, index) => {
    const x = chartPadding.left + (chartRows.length > 1 ? xStep * index : chartInnerWidth / 2);
    const y = chartPadding.top + ((maxBalance - row.balance) / balanceRange) * chartInnerHeight;
    return { ...row, x, y, index };
  });

  const areaPath = points.length
    ? [
        `M ${points[0].x} ${zeroY}`,
        ...points.map((point, index) => `${index === 0 ? 'L' : 'L'} ${point.x} ${point.y}`),
        `L ${points[points.length - 1].x} ${zeroY}`,
        'Z'
      ].join(' ')
    : '';

  const linePath = points.length
    ? points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
    : '';

  const gridLines = Array.from({ length: 6 }, (_, index) => {
    const value = minBalance + (balanceRange / 5) * index;
    const y = chartPadding.top + ((maxBalance - value) / balanceRange) * chartInnerHeight;
    return { value, y };
  });

  const netMagnitude = chartRows.length
    ? Math.max(...chartRows.map((row) => Math.abs(row.net)), 1)
    : 1;

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <div>
            <div className={styles.eyebrow}>Mongo-Backed Report</div>
            <h1 className={styles.title}>Monthly Balance</h1>
            <p className={styles.subtitle}>
              Cumulative net balance from zero. Transfers are shown separately and excluded from net.
            </p>
          </div>

          <button className={styles.ghostButton} onClick={() => router.push('/')}>
            Back To Home
          </button>
        </div>

        <div className={styles.filterCard}>
          <div className={styles.filterRow}>
            <label className={styles.label}>
              From
              <input
                className={styles.input}
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>

            <label className={styles.label}>
              To
              <input
                className={styles.input}
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>

            <button
              className={styles.primaryButton}
              onClick={() => fetchReport()}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh Report'}
            </button>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {report && (
          <>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Current Balance</div>
                <div className={styles.statValue}>{currencyFormatter.format(report.currentBalance)}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Best Month</div>
                <div className={styles.statValue}>{report.bestMonth || 'N/A'}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Worst Month</div>
                <div className={styles.statValue}>{report.worstMonth || 'N/A'}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Range</div>
                <div className={styles.statValueSmall}>{report.from} to {report.to}</div>
              </div>
            </div>

            {!!report.rows.length && (
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <div>
                    <div className={styles.chartTitle}>Cumulative Balance By Month</div>
                    <div className={styles.chartCaption}>
                      Hover a point to inspect month-level net and running balance.
                    </div>
                  </div>

                  {activeRow && (
                    <div className={styles.chartCallout}>
                      <div className={styles.chartCalloutMonth}>{activeRow.month}</div>
                      <div className={styles.chartCalloutValue}>
                        Balance {currencyFormatter.format(activeRow.balance)}
                      </div>
                      <div className={activeRow.net >= 0 ? styles.positive : styles.negative}>
                        Net {formatSignedCurrency(activeRow.net)}
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.chartFrame}>
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className={styles.chartSvg}
                    role="img"
                    aria-label="Monthly cumulative balance chart"
                  >
                    <defs>
                      <linearGradient id="balanceAreaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0f766e" stopOpacity="0.32" />
                        <stop offset="100%" stopColor="#0f766e" stopOpacity="0.03" />
                      </linearGradient>
                    </defs>

                    {gridLines.map((line) => (
                      <g key={line.y}>
                        <line
                          x1={chartPadding.left}
                          x2={chartWidth - chartPadding.right}
                          y1={line.y}
                          y2={line.y}
                          className={styles.chartGrid}
                        />
                        <text
                          x={chartPadding.left - 16}
                          y={line.y + 4}
                          textAnchor="end"
                          className={styles.chartAxisLabel}
                        >
                          {compactFormatter.format(line.value)}
                        </text>
                      </g>
                    ))}

                    <line
                      x1={chartPadding.left}
                      x2={chartWidth - chartPadding.right}
                      y1={zeroY}
                      y2={zeroY}
                      className={styles.chartZero}
                    />

                    {points.map((point) => {
                      const barHeight = Math.max(12, (Math.abs(point.net) / netMagnitude) * 84);
                      const barY = point.net >= 0 ? zeroY - barHeight : zeroY;

                      return (
                        <g key={point.month}>
                          <line
                            x1={point.x}
                            x2={point.x}
                            y1={chartPadding.top}
                            y2={chartHeight - chartPadding.bottom}
                            className={activeRow?.month === point.month ? styles.chartGuideActive : styles.chartGuide}
                          />
                          <rect
                            x={point.x - 14}
                            y={barY}
                            width={28}
                            height={barHeight}
                            rx={10}
                            className={point.net >= 0 ? styles.netBarPositive : styles.netBarNegative}
                          />
                          <text
                            x={point.x}
                            y={chartHeight - chartPadding.bottom + 28}
                            textAnchor="end"
                            transform={`rotate(-32 ${point.x} ${chartHeight - chartPadding.bottom + 28})`}
                            className={styles.chartAxisLabel}
                          >
                            {point.month}
                          </text>
                        </g>
                      );
                    })}

                    {areaPath && <path d={areaPath} fill="url(#balanceAreaFill)" />}
                    {linePath && <path d={linePath} className={styles.chartLine} />}

                    {points.map((point) => (
                      <g key={`${point.month}-point`}>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={activeRow?.month === point.month ? 10 : 6}
                          className={activeRow?.month === point.month ? styles.chartPointActive : styles.chartPoint}
                        />
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={20}
                          className={styles.chartHitArea}
                          onMouseEnter={() => setActiveMonth(point.month)}
                          onClick={() => setActiveMonth(point.month)}
                        />
                      </g>
                    ))}
                  </svg>
                </div>
              </div>
            )}

            <div className={styles.tableCard}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Income</th>
                    <th>Expense</th>
                    <th>Transfer</th>
                    <th>Net</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.month}>
                      <td>{row.month}</td>
                      <td className={styles.positive}>{currencyFormatter.format(row.income)}</td>
                      <td className={styles.negative}>{currencyFormatter.format(row.expense)}</td>
                      <td className={row.transfer >= 0 ? styles.positive : styles.negative}>
                        {currencyFormatter.format(row.transfer)}
                      </td>
                      <td className={row.net >= 0 ? styles.positive : styles.negative}>
                        {formatSignedCurrency(row.net)}
                      </td>
                      <td className={row.balance >= 0 ? styles.positive : styles.negative}>
                        {currencyFormatter.format(row.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!report.rows.length && !loading && (
                <div className={styles.emptyState}>
                  No mirrored Toshl data was found for this range. Run a sync first.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
