import { useEffect, useState } from 'react';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import styles from '../../styles/Report.module.css';

interface CategorySeries {
  category: string;
  total: number;
  averageMonthly: number;
}

interface CategorySpendRow {
  month: string;
  total: number;
  values: Array<{
    category: string;
    amount: number;
  }>;
}

interface CategorySpendTrendResponse {
  currency: string;
  from: string;
  to: string;
  totalSpend: number;
  averageMonthlySpend: number;
  topCategory: string | null;
  highestMonth: string | null;
  categories: CategorySeries[];
  rows: CategorySpendRow[];
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2
});

const compactFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0
});

const palette = ['#0f766e', '#c2410c', '#1d4ed8', '#7c3aed', '#b45309', '#475569'];

export default function CategorySpendTrendReportPage() {
  const router = useRouter();
  const [from, setFrom] = useState('2025-01-01');
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<CategorySpendTrendResponse | null>(null);
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
      const response = await fetch(`/api/reports/categorySpendTrend?${searchParams.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to load category spend trend report');
        return;
      }

      setReport(data);
      setActiveMonth(data.rows?.length ? data.rows[data.rows.length - 1].month : null);
    } catch (_err) {
      setError('Network error: Failed to load category spend trend report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const chartRows = report?.rows || [];
  const series = report?.categories || [];
  const activeRow = chartRows.find((row) => row.month === activeMonth) || chartRows[chartRows.length - 1] || null;
  const chartWidth = 1120;
  const chartHeight = 520;
  const chartPadding = { top: 28, right: 24, bottom: 84, left: 92 };
  const chartInnerWidth = chartWidth - chartPadding.left - chartPadding.right;
  const chartInnerHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const maxAmount = Math.max(
    ...chartRows.flatMap((row) => row.values.map((value) => value.amount)),
    0
  );
  const yMax = maxAmount > 0 ? maxAmount * 1.12 : 1;
  const xStep = chartRows.length > 1 ? chartInnerWidth / (chartRows.length - 1) : 0;

  const monthPoints = chartRows.map((row, index) => {
    const x = chartPadding.left + (chartRows.length > 1 ? xStep * index : chartInnerWidth / 2);
    const previousX = index === 0 ? chartPadding.left : chartPadding.left + xStep * (index - 1);
    const nextX = index === chartRows.length - 1 ? chartWidth - chartPadding.right : chartPadding.left + xStep * (index + 1);
    const hitStartX = index === 0 ? chartPadding.left : x - (x - previousX) / 2;
    const hitEndX = index === chartRows.length - 1 ? chartWidth - chartPadding.right : x + (nextX - x) / 2;

    return {
      month: row.month,
      x,
      hitStartX,
      hitEndX
    };
  });

  const seriesWithColor = series.map((item, index) => ({
    ...item,
    color: palette[index % palette.length]
  }));

  const seriesPaths = seriesWithColor.map((item) => {
    const points = chartRows.map((row, index) => {
      const value = row.values.find((entry) => entry.category === item.category)?.amount || 0;
      const x = chartPadding.left + (chartRows.length > 1 ? xStep * index : chartInnerWidth / 2);
      const y = chartPadding.top + ((yMax - value) / yMax) * chartInnerHeight;
      return { month: row.month, x, y, value };
    });

    return {
      ...item,
      points,
      path: points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
    };
  });

  const gridLines = Array.from({ length: 6 }, (_, index) => {
    const value = (yMax / 5) * index;
    const y = chartPadding.top + ((yMax - value) / yMax) * chartInnerHeight;
    return { value, y };
  });

  const activeValues = activeRow
    ? [...activeRow.values].sort((left, right) => right.amount - left.amount)
    : [];

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <div>
            <div className={styles.eyebrow}>Mongo-Backed Report</div>
            <h1 className={styles.title}>Category Spend Trend</h1>
            <p className={styles.subtitle}>
              Compare monthly expense movement across your biggest categories and inspect which categories dominate each month.
            </p>
          </div>

          <div className={styles.actionsRow}>
            <button className={styles.ghostButton} onClick={() => router.push('/reports')}>
              All Reports
            </button>
            <button className={styles.ghostButton} onClick={() => router.push('/')}>
              Back To Home
            </button>
          </div>
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
                <div className={styles.statLabel}>Total Spend</div>
                <div className={styles.statValue}>{currencyFormatter.format(report.totalSpend)}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Average Monthly Spend</div>
                <div className={styles.statValue}>{currencyFormatter.format(report.averageMonthlySpend)}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Top Category</div>
                <div className={styles.statValue}>{report.topCategory || 'N/A'}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Highest Spend Month</div>
                <div className={styles.statValueSmall}>{report.highestMonth || 'N/A'}</div>
              </div>
            </div>

            {!!report.rows.length && !!report.categories.length && (
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <div>
                    <div className={styles.chartTitle}>Top Category Lines By Month</div>
                    <div className={styles.chartCaption}>
                      Hover anywhere in a month column to compare the leading expense categories for that month.
                    </div>
                  </div>

                  {activeRow && (
                    <div className={styles.chartCallout}>
                      <div className={styles.chartCalloutMonth}>{activeRow.month}</div>
                      <div className={styles.chartCalloutValue}>
                        Total {currencyFormatter.format(activeRow.total)}
                      </div>
                      <div className={styles.calloutList}>
                        {activeValues.slice(0, 5).map((value) => (
                          <div key={`${activeRow.month}-${value.category}`} className={styles.calloutListRow}>
                            <span className={styles.calloutLabel}>{value.category}</span>
                            <span>{currencyFormatter.format(value.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.chartLegend}>
                  {seriesWithColor.map((item) => (
                    <div key={item.category} className={styles.legendItem}>
                      <span className={styles.legendSwatch} style={{ backgroundColor: item.color }} />
                      <span>{item.category}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.chartFrame}>
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className={styles.chartSvg}
                    role="img"
                    aria-label="Category spend trend chart"
                  >
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

                    {monthPoints.map((point) => (
                      <g key={point.month}>
                        <line
                          x1={point.x}
                          x2={point.x}
                          y1={chartPadding.top}
                          y2={chartHeight - chartPadding.bottom}
                          className={activeRow?.month === point.month ? styles.chartGuideActive : styles.chartGuide}
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
                    ))}

                    {seriesPaths.map((item) => (
                      <g key={item.category}>
                        <path
                          d={item.path}
                          className={styles.chartLine}
                          style={{ stroke: item.color, strokeWidth: 3.2 }}
                        />
                        {item.points.map((point) => (
                          <circle
                            key={`${item.category}-${point.month}`}
                            cx={point.x}
                            cy={point.y}
                            r={activeRow?.month === point.month ? 6 : 4}
                            className={styles.chartPoint}
                            style={{ fill: item.color }}
                          />
                        ))}
                      </g>
                    ))}

                    {monthPoints.map((point) => (
                      <rect
                        key={`${point.month}-hit`}
                        x={point.hitStartX}
                        y={chartPadding.top}
                        width={point.hitEndX - point.hitStartX}
                        height={chartInnerHeight}
                        className={styles.chartHitArea}
                        onMouseEnter={() => setActiveMonth(point.month)}
                        onMouseMove={() => setActiveMonth(point.month)}
                        onClick={() => setActiveMonth(point.month)}
                      />
                    ))}
                  </svg>
                </div>
              </div>
            )}

            <div className={styles.tableCard}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Total Spend</th>
                    <th>Average / Month</th>
                  </tr>
                </thead>
                <tbody>
                  {report.categories.map((category) => (
                    <tr key={category.category}>
                      <td>{category.category}</td>
                      <td className={styles.negative}>{currencyFormatter.format(category.total)}</td>
                      <td>{currencyFormatter.format(category.averageMonthly)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!report.rows.length && !loading && (
                <div className={styles.emptyState}>
                  No mirrored expense data was found for this range. Run a sync first.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {}
  };
};
