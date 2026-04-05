import { useEffect, useMemo, useState } from 'react';
import type { GetServerSideProps } from 'next';
import type { EChartsOption } from 'echarts';
import { useRouter } from 'next/router';
import ReportChart from '../../components/ReportChart';
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

  const chartOption = useMemo<EChartsOption>(() => {
    return {
      animationDuration: 400,
      color: ['#0f766e', '#c2410c'],
      grid: {
        top: 28,
        right: 24,
        bottom: 88,
        left: 92
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: 'rgba(194, 65, 12, 0.28)',
            width: 1.5
          }
        },
        backgroundColor: 'rgba(20, 27, 35, 0.96)',
        borderWidth: 0,
        textStyle: {
          color: '#f8fafc'
        },
        formatter: (params: any) => {
          const items = Array.isArray(params) ? params : [params];
          const balance = items.find((item: any) => item.seriesName === 'Balance');
          const net = items.find((item: any) => item.seriesName === 'Net');
          const month = items[0]?.axisValueLabel || items[0]?.name || '';

          return [
            `<div>${month}</div>`,
            balance ? `<div>Balance ${currencyFormatter.format(Number(balance.data ?? 0))}</div>` : '',
            net ? `<div>Net ${formatSignedCurrency(Number(net.data ?? 0))}</div>` : ''
          ].join('');
        }
      },
      xAxis: {
        type: 'category',
        boundaryGap: true,
        data: chartRows.map((row) => row.month),
        axisTick: {
          show: false
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(31, 41, 51, 0.12)'
          }
        },
        axisLabel: {
          color: '#5f6c76',
          rotate: 32,
          margin: 18
        }
      },
      yAxis: [
        {
          type: 'value',
          name: 'Balance',
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
        {
          type: 'value',
          name: 'Net',
          axisLabel: {
            color: '#5f6c76',
            formatter: (value: number) => formatSignedCurrency(value)
          },
          splitLine: {
            show: false
          }
        }
      ],
      series: [
        {
          name: 'Net',
          type: 'bar',
          yAxisIndex: 1,
          data: chartRows.map((row) => row.net),
          barWidth: 28,
          itemStyle: {
            borderRadius: [10, 10, 10, 10],
            color: (params: any) => (
              Number(params.value) >= 0 ? 'rgba(4, 120, 87, 0.22)' : 'rgba(185, 28, 28, 0.2)'
            )
          },
          z: 1
        },
        {
          name: 'Balance',
          type: 'line',
          smooth: false,
          symbol: 'circle',
          symbolSize: 10,
          data: chartRows.map((row) => row.balance),
          lineStyle: {
            width: 4,
            color: '#0f766e'
          },
          itemStyle: {
            color: '#115e59',
            borderColor: '#ffffff',
            borderWidth: 3
          },
          areaStyle: {
            color: 'rgba(15, 118, 110, 0.16)'
          },
          z: 3,
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              color: 'rgba(194, 65, 12, 0.24)',
              type: 'dashed'
            },
            data: [{ yAxis: 0 }]
          }
        }
      ]
    };
  }, [chartRows]);

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <div>
            <h1 className={styles.title}>Monthly Balance</h1>
            <p className={styles.subtitle}>
              Cumulative net balance from zero. Transfers are shown separately and excluded from net.
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
                      Hover the chart to inspect month-level net and running balance.
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
                  <ReportChart
                    option={chartOption}
                    notMerge
                    lazyUpdate
                    style={{ height: 520, width: '100%' }}
                    onEvents={{
                      updateAxisPointer: (event: any) => {
                        const axisValue = event?.axesInfo?.[0]?.value;
                        if (typeof axisValue === 'string') {
                          setActiveMonth(axisValue);
                        }
                      },
                      mouseout: () => {
                        if (chartRows.length) {
                          setActiveMonth(chartRows[chartRows.length - 1].month);
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

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {}
  };
};
