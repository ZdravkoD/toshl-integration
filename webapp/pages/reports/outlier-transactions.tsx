import { useEffect, useMemo, useState } from 'react';
import type { GetServerSideProps } from 'next';
import type { EChartsOption } from 'echarts';
import { useRouter } from 'next/router';
import ReportChart from '../../components/ReportChart';
import styles from '../../styles/Report.module.css';

interface OutlierTransactionRow {
  toshlId: string;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  baselineAmount: number;
  deviationRatio: number;
}

interface OutlierTransactionsResponse {
  currency: string;
  from: string;
  to: string;
  outlierCount: number;
  highestDeviation: number | null;
  rows: OutlierTransactionRow[];
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2
});

export default function OutlierTransactionsReportPage() {
  const router = useRouter();
  const [from, setFrom] = useState('2025-01-01');
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<OutlierTransactionsResponse | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReport = async (nextFrom = from, nextTo = to) => {
    setLoading(true);
    setError('');
    try {
      const searchParams = new URLSearchParams({ from: nextFrom, to: nextTo });
      const response = await fetch(`/api/reports/outlierTransactions?${searchParams.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to load outlier transactions report');
        return;
      }
      setReport(data);
      setActiveId(data.rows?.[0]?.toshlId || null);
    } catch (_err) {
      setError('Network error: Failed to load outlier transactions report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const rows = report?.rows || [];
  const activeRow = rows.find((row) => row.toshlId === activeId) || rows[0] || null;
  const chartLimit = Math.max(
    ...rows.flatMap((row) => [row.amount, row.baselineAmount]),
    1
  ) * 1.12;
  const chartOption = useMemo<EChartsOption>(() => ({
    animationDuration: 400,
    grid: { top: 28, right: 24, bottom: 72, left: 92 },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(20, 27, 35, 0.96)',
      borderWidth: 0,
      textStyle: { color: '#f8fafc' },
      formatter: (params: any) => {
        const row = rows[params.dataIndex];
        if (!row) {
          return '';
        }
        return [
          `<div>${row.merchant}</div>`,
          `<div>${row.category}</div>`,
          `<div>Actual ${currencyFormatter.format(row.amount)}</div>`,
          `<div>Baseline ${currencyFormatter.format(row.baselineAmount)}</div>`,
          `<div>${row.deviationRatio.toFixed(2)}x baseline</div>`
        ].join('');
      }
    },
    xAxis: {
      type: 'value',
      name: 'Baseline Amount',
      min: 0,
      max: chartLimit,
      nameLocation: 'middle',
      nameGap: 42,
      axisLabel: { color: '#5f6c76', formatter: (value: number) => currencyFormatter.format(value) },
      splitLine: { lineStyle: { color: 'rgba(31, 41, 51, 0.12)' } }
    },
    yAxis: {
      type: 'value',
      name: 'Actual Amount',
      min: 0,
      max: chartLimit,
      axisLabel: { color: '#5f6c76', formatter: (value: number) => currencyFormatter.format(value) },
      splitLine: { lineStyle: { color: 'rgba(31, 41, 51, 0.12)' } }
    },
    series: [
      {
        type: 'line',
        data: [
          [0, 0],
          [chartLimit, chartLimit]
        ],
        symbol: 'none',
        silent: true,
        lineStyle: {
          color: 'rgba(15, 118, 110, 0.28)',
          type: 'dashed',
          width: 2
        },
        z: 1
      },
      {
        type: 'scatter',
        symbolSize: (value: number[]) => Math.min(34, Math.max(12, 10 + value[2] * 1.2)),
        data: rows.map((row) => [row.baselineAmount, row.amount, row.deviationRatio]),
        itemStyle: {
          color: '#c2410c',
          opacity: 0.82,
          borderColor: '#ffffff',
          borderWidth: 2
        },
        z: 3
      }
    ]
  }), [chartLimit, rows]);

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <div>
            <h1 className={styles.title}>Outlier Transactions</h1>
            <p className={styles.subtitle}>
              Surface unusually large transactions relative to the merchant’s own historical baseline.
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
              <div className={styles.statCard}><div className={styles.statLabel}>Outliers</div><div className={styles.statValue}>{report.outlierCount}</div></div>
              <div className={styles.statCard}><div className={styles.statLabel}>Highest Deviation</div><div className={styles.statValue}>{report.highestDeviation ? `${report.highestDeviation.toFixed(2)}x` : 'N/A'}</div></div>
              <div className={styles.statCard}><div className={styles.statLabel}>Largest Transaction</div><div className={styles.statValue}>{rows[0] ? currencyFormatter.format(rows[0].amount) : 'N/A'}</div></div>
              <div className={styles.statCard}><div className={styles.statLabel}>Range</div><div className={styles.statValueSmall}>{report.from} to {report.to}</div></div>
            </div>

            {!!rows.length && (
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <div>
                    <div className={styles.chartTitle}>Actual vs Baseline</div>
                    <div className={styles.chartCaption}>Points above the diagonal represent transactions that materially exceed the usual merchant baseline.</div>
                  </div>
                  {activeRow && (
                    <div className={styles.chartCallout}>
                      <div className={styles.chartCalloutMonth}>{activeRow.merchant}</div>
                      <div className={styles.chartCalloutValue}>{currencyFormatter.format(activeRow.amount)}</div>
                      <div className={styles.calloutList}>
                        <div className={styles.calloutListRow}><span className={styles.calloutLabel}>Baseline</span><span>{currencyFormatter.format(activeRow.baselineAmount)}</span></div>
                        <div className={styles.calloutListRow}><span className={styles.calloutLabel}>Deviation</span><span>{activeRow.deviationRatio.toFixed(2)}x</span></div>
                        <div className={styles.calloutListRow}><span className={styles.calloutLabel}>Date</span><span>{activeRow.date}</span></div>
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
                          setActiveId(row.toshlId);
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
                    <th>Date</th>
                    <th>Merchant</th>
                    <th>Category</th>
                    <th>Actual</th>
                    <th>Baseline</th>
                    <th>Deviation</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.toshlId}>
                      <td>{row.date}</td>
                      <td>{row.merchant}</td>
                      <td>{row.category}</td>
                      <td className={styles.negative}>{currencyFormatter.format(row.amount)}</td>
                      <td>{currencyFormatter.format(row.baselineAmount)}</td>
                      <td>{row.deviationRatio.toFixed(2)}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && !loading && <div className={styles.emptyState}>No outlier transactions were found for this range.</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });
