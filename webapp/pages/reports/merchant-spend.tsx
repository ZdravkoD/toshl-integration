import { useEffect, useMemo, useState } from 'react';
import type { GetServerSideProps } from 'next';
import type { EChartsOption } from 'echarts';
import { useRouter } from 'next/router';
import ReportChart from '../../components/ReportChart';
import styles from '../../styles/Report.module.css';

interface MerchantSpendRow {
  merchant: string;
  spend: number;
  transactions: number;
  averageTicket: number;
  latestDate: string | null;
  monthlyTotals: Array<{
    month: string;
    amount: number;
  }>;
}

interface MerchantSpendResponse {
  currency: string;
  from: string;
  to: string;
  totalSpend: number;
  merchantCount: number;
  topMerchant: string | null;
  rows: MerchantSpendRow[];
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2
});

export default function MerchantSpendReportPage() {
  const router = useRouter();
  const [from, setFrom] = useState('2025-01-01');
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<MerchantSpendResponse | null>(null);
  const [activeMerchant, setActiveMerchant] = useState<string | null>(null);
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
      const response = await fetch(`/api/reports/merchantSpend?${searchParams.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to load merchant spend report');
        return;
      }

      setReport(data);
      setActiveMerchant(data.rows?.[0]?.merchant || null);
    } catch (_err) {
      setError('Network error: Failed to load merchant spend report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const rows = report?.rows || [];
  const activeRow = rows.find((row) => row.merchant === activeMerchant) || rows[0] || null;
  const chartOption = useMemo<EChartsOption>(() => ({
    animationDuration: 400,
    grid: {
      top: 28,
      right: 24,
      bottom: 24,
      left: 180
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
          `<div>Spend ${currencyFormatter.format(row.spend)}</div>`,
          `<div>Transactions ${row.transactions}</div>`,
          `<div>Average ${currencyFormatter.format(row.averageTicket)}</div>`
        ].join('');
      }
    },
    xAxis: {
      type: 'value',
      axisLabel: {
        color: '#5f6c76',
        formatter: (value: number) => currencyFormatter.format(value)
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(31, 41, 51, 0.12)'
        }
      }
    },
    yAxis: {
      type: 'category',
      data: rows.map((row) => row.merchant).reverse(),
      axisLabel: {
        color: '#5f6c76'
      },
      axisTick: {
        show: false
      },
      axisLine: {
        show: false
      }
    },
    series: [{
      name: 'Spend',
      type: 'bar',
      data: rows.map((row) => row.spend).reverse(),
      barWidth: 20,
      itemStyle: {
        borderRadius: [0, 12, 12, 0],
        color: '#0f766e'
      }
    }]
  }), [rows]);

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <div>
            <h1 className={styles.title}>Merchant Spend</h1>
            <p className={styles.subtitle}>
              Rank merchants by total expense, transaction count, and average ticket size to see where spending concentrates.
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
              <input className={styles.input} type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label className={styles.label}>
              To
              <input className={styles.input} type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </label>
            <button className={styles.primaryButton} onClick={() => fetchReport()} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh Report'}
            </button>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {report && (
          <>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Tracked Spend</div>
                <div className={styles.statValue}>{currencyFormatter.format(report.totalSpend)}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Merchant Count</div>
                <div className={styles.statValue}>{report.merchantCount}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Top Merchant</div>
                <div className={styles.statValue}>{report.topMerchant || 'N/A'}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Range</div>
                <div className={styles.statValueSmall}>{report.from} to {report.to}</div>
              </div>
            </div>

            {!!rows.length && (
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <div>
                    <div className={styles.chartTitle}>Top Merchants By Spend</div>
                    <div className={styles.chartCaption}>
                      Hover a merchant bar to inspect spend, transaction volume, and average ticket.
                    </div>
                  </div>

                  {activeRow && (
                    <div className={styles.chartCallout}>
                      <div className={styles.chartCalloutMonth}>{activeRow.merchant}</div>
                      <div className={styles.chartCalloutValue}>{currencyFormatter.format(activeRow.spend)}</div>
                      <div className={styles.calloutList}>
                        <div className={styles.calloutListRow}>
                          <span className={styles.calloutLabel}>Transactions</span>
                          <span>{activeRow.transactions}</span>
                        </div>
                        <div className={styles.calloutListRow}>
                          <span className={styles.calloutLabel}>Average Ticket</span>
                          <span>{currencyFormatter.format(activeRow.averageTicket)}</span>
                        </div>
                        <div className={styles.calloutListRow}>
                          <span className={styles.calloutLabel}>Last Seen</span>
                          <span>{activeRow.latestDate || 'N/A'}</span>
                        </div>
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
                        const merchant = rows[rows.length - 1 - Number(event.dataIndex || 0)]?.merchant;
                        if (merchant) {
                          setActiveMerchant(merchant);
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
                    <th>Spend</th>
                    <th>Transactions</th>
                    <th>Average Ticket</th>
                    <th>Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.merchant}>
                      <td>{row.merchant}</td>
                      <td className={styles.negative}>{currencyFormatter.format(row.spend)}</td>
                      <td>{row.transactions}</td>
                      <td>{currencyFormatter.format(row.averageTicket)}</td>
                      <td>{row.latestDate || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!rows.length && !loading && (
                <div className={styles.emptyState}>
                  No merchant expense data was found for this range.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });
