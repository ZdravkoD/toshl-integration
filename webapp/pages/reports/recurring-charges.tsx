import { useEffect, useMemo, useState } from 'react';
import type { GetServerSideProps } from 'next';
import type { EChartsOption } from 'echarts';
import { useRouter } from 'next/router';
import ReportChart from '../../components/ReportChart';
import styles from '../../styles/Report.module.css';

interface RecurringChargeRow {
  merchant: string;
  category: string;
  averageAmount: number;
  latestAmount: number;
  transactions: number;
  intervalDays: number | null;
  stabilityScore: number;
  lastChargedAt: string | null;
}

interface RecurringChargesResponse {
  currency: string;
  from: string;
  to: string;
  recurringCount: number;
  strongestMatch: string | null;
  rows: RecurringChargeRow[];
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2
});

export default function RecurringChargesReportPage() {
  const router = useRouter();
  const [from, setFrom] = useState('2025-01-01');
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<RecurringChargesResponse | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReport = async (nextFrom = from, nextTo = to) => {
    setLoading(true);
    setError('');
    try {
      const searchParams = new URLSearchParams({ from: nextFrom, to: nextTo });
      const response = await fetch(`/api/reports/recurringCharges?${searchParams.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to load recurring charges report');
        return;
      }
      setReport(data);
      setActiveKey(data.rows?.[0] ? `${data.rows[0].merchant}__${data.rows[0].category}` : null);
    } catch (_err) {
      setError('Network error: Failed to load recurring charges report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const rows = report?.rows || [];
  const activeRow = rows.find((row) => `${row.merchant}__${row.category}` === activeKey) || rows[0] || null;
  const chartOption = useMemo<EChartsOption>(() => ({
    animationDuration: 400,
    grid: {
      top: 28,
      right: 24,
      bottom: 72,
      left: 92
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(20, 27, 35, 0.96)',
      borderWidth: 0,
      textStyle: {
        color: '#f8fafc'
      },
      formatter: (params: any) => {
        const row = rows[params.dataIndex];
        if (!row) {
          return '';
        }
        return [
          `<div>${row.merchant}</div>`,
          `<div>${row.category}</div>`,
          `<div>Avg ${currencyFormatter.format(row.averageAmount)}</div>`,
          `<div>Interval ${row.intervalDays ?? 'N/A'} days</div>`,
          `<div>Stability ${(row.stabilityScore * 100).toFixed(0)}%</div>`
        ].join('');
      }
    },
    xAxis: {
      type: 'value',
      name: 'Interval Days',
      nameLocation: 'middle',
      nameGap: 42,
      axisLabel: { color: '#5f6c76' },
      splitLine: { lineStyle: { color: 'rgba(31, 41, 51, 0.12)' } }
    },
    yAxis: {
      type: 'value',
      name: 'Average Amount',
      axisLabel: {
        color: '#5f6c76',
        formatter: (value: number) => currencyFormatter.format(value)
      },
      splitLine: { lineStyle: { color: 'rgba(31, 41, 51, 0.12)' } }
    },
    visualMap: {
      min: 0.35,
      max: 1,
      dimension: 3,
      show: false,
      inRange: {
        color: ['#b45309', '#0f766e']
      }
    },
    series: [{
      type: 'scatter',
      symbolSize: (value: number[]) => 12 + value[2] * 4,
      data: rows.map((row) => [
        row.intervalDays ?? 0,
        row.averageAmount,
        row.transactions,
        row.stabilityScore
      ]),
      itemStyle: {
        opacity: 0.86,
        borderColor: '#ffffff',
        borderWidth: 2
      }
    }]
  }), [rows]);

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <div>
            <h1 className={styles.title}>Recurring Charges</h1>
            <p className={styles.subtitle}>
              Detect likely subscriptions and repeating bills based on cadence consistency, amount stability, and repeat count.
            </p>
          </div>
          <div className={styles.actionsRow}>
            <button className={styles.ghostButton} onClick={() => router.push('/reports')}>All Reports</button>
            <button className={styles.ghostButton} onClick={() => router.push('/')}>Back To Home</button>
          </div>
        </div>

        <div className={styles.filterCard}>
          <div className={styles.filterRow}>
            <label className={styles.label}>From<input className={styles.input} type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
            <label className={styles.label}>To<input className={styles.input} type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
            <button className={styles.primaryButton} onClick={() => fetchReport()} disabled={loading}>{loading ? 'Loading...' : 'Refresh Report'}</button>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {report && (
          <>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}><div className={styles.statLabel}>Recurring Candidates</div><div className={styles.statValue}>{report.recurringCount}</div></div>
              <div className={styles.statCard}><div className={styles.statLabel}>Strongest Match</div><div className={styles.statValue}>{report.strongestMatch || 'N/A'}</div></div>
              <div className={styles.statCard}><div className={styles.statLabel}>Best Stability</div><div className={styles.statValue}>{rows[0] ? `${Math.round(rows[0].stabilityScore * 100)}%` : 'N/A'}</div></div>
              <div className={styles.statCard}><div className={styles.statLabel}>Range</div><div className={styles.statValueSmall}>{report.from} to {report.to}</div></div>
            </div>

            {!!rows.length && (
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <div>
                    <div className={styles.chartTitle}>Cadence vs Amount</div>
                    <div className={styles.chartCaption}>Bubble size reflects repeat count. Hover a point to inspect interval, amount, and stability.</div>
                  </div>
                  {activeRow && (
                    <div className={styles.chartCallout}>
                      <div className={styles.chartCalloutMonth}>{activeRow.merchant}</div>
                      <div className={styles.chartCalloutValue}>{currencyFormatter.format(activeRow.averageAmount)}</div>
                      <div className={styles.calloutList}>
                        <div className={styles.calloutListRow}><span className={styles.calloutLabel}>Category</span><span>{activeRow.category}</span></div>
                        <div className={styles.calloutListRow}><span className={styles.calloutLabel}>Interval</span><span>{activeRow.intervalDays ?? 'N/A'} days</span></div>
                        <div className={styles.calloutListRow}><span className={styles.calloutLabel}>Stability</span><span>{Math.round(activeRow.stabilityScore * 100)}%</span></div>
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.chartFrame}>
                  <ReportChart
                    option={chartOption}
                    notMerge
                    lazyUpdate
                    style={{ height: 520, width: '100%' }}
                    onEvents={{
                      mouseover: (event: any) => {
                        const row = rows[Number(event.dataIndex || 0)];
                        if (row) {
                          setActiveKey(`${row.merchant}__${row.category}`);
                        }
                      }
                    }}
                  />
                </div>
              </div>
            )}

            <div className={styles.tableCard}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Merchant</th>
                    <th>Category</th>
                    <th>Average</th>
                    <th>Latest</th>
                    <th>Transactions</th>
                    <th>Interval</th>
                    <th>Stability</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.merchant}-${row.category}`}>
                      <td>{row.merchant}</td>
                      <td>{row.category}</td>
                      <td>{currencyFormatter.format(row.averageAmount)}</td>
                      <td>{currencyFormatter.format(row.latestAmount)}</td>
                      <td>{row.transactions}</td>
                      <td>{row.intervalDays ?? 'N/A'} days</td>
                      <td>{Math.round(row.stabilityScore * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && !loading && <div className={styles.emptyState}>No recurring candidates were found for this range.</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });
