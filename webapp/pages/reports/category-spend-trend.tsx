import { useEffect, useMemo, useState } from 'react';
import type { GetServerSideProps } from 'next';
import type { EChartsOption } from 'echarts';
import { useRouter } from 'next/router';
import ReportChart from '../../components/ReportChart';
import styles from '../../styles/Report.module.css';

interface CategorySeries {
  category: string;
  total: number;
  averageMonthly: number;
}

interface CategorySpendValue {
  category: string;
  amount: number;
}

interface CategorySpendRow {
  month: string;
  total: number;
  values: CategorySpendValue[];
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

const palette = ['#0f766e', '#c2410c', '#1d4ed8', '#7c3aed', '#b45309', '#475569'];

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export default function CategorySpendTrendReportPage() {
  const router = useRouter();
  const [from, setFrom] = useState('2025-01-01');
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<CategorySpendTrendResponse | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [yAxisMode, setYAxisMode] = useState<'linear' | 'exponential'>('linear');
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
      setSelectedCategories((data.categories || []).map((item: CategorySeries) => item.category));
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
  const allSeries = (report?.categories || []).map((item, index) => ({
    ...item,
    color: palette[index % palette.length]
  }));
  const selectedCategorySet = new Set(selectedCategories);
  const filteredSeries = allSeries.filter((item) => selectedCategorySet.has(item.category));
  const filteredRows = chartRows.map((row) => {
    const values = row.values.filter((value) => selectedCategorySet.has(value.category));
    return {
      ...row,
      values,
      total: roundCurrency(values.reduce((sum, value) => sum + value.amount, 0))
    };
  });
  const activeRow = filteredRows.find((row) => row.month === activeMonth) || filteredRows[filteredRows.length - 1] || null;
  const visibleTotalSpend = roundCurrency(filteredRows.reduce((sum, row) => sum + row.total, 0));
  const visibleAverageMonthlySpend = filteredRows.length ? roundCurrency(visibleTotalSpend / filteredRows.length) : 0;
  const visibleTopCategory = filteredSeries[0]?.category || null;
  const visibleHighestMonth = filteredRows.reduce<CategorySpendRow | null>((best, row) => {
    if (!best || row.total > best.total) {
      return row;
    }
    return best;
  }, null);

  const transformValue = (value: number) => yAxisMode === 'exponential' ? Math.log1p(value) : value;
  const inverseTransformValue = (value: number) => yAxisMode === 'exponential' ? Math.expm1(value) : value;
  const maxAmount = Math.max(
    ...filteredRows.flatMap((row) => row.values.map((value) => value.amount)),
    0
  );
  const displayMaxAmount = maxAmount > 0 ? maxAmount * 1.12 : 1;
  const scaledMax = Math.max(transformValue(displayMaxAmount), 1);

  const chartOption = useMemo<EChartsOption>(() => {
    return {
      animationDuration: 400,
      color: filteredSeries.map((item) => item.color),
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
          const items = (Array.isArray(params) ? params : [params])
            .filter((item: any) => item.seriesName && item.data != null);
          const month = items[0]?.axisValueLabel || items[0]?.name || '';
          const total = items.reduce((sum: number, item: any) => sum + Number(item.data?.rawAmount ?? 0), 0);
          const lines = items
            .sort((left: any, right: any) => Number(right.data?.rawAmount ?? 0) - Number(left.data?.rawAmount ?? 0))
            .slice(0, 5)
            .map((item: any) => {
              const color = item.color || '#ffffff';
              return `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;"><span style="display:inline-flex;align-items:center;gap:8px;"><span style="width:9px;height:9px;border-radius:999px;background:${color};display:inline-block;"></span>${item.seriesName}</span><span>${currencyFormatter.format(Number(item.data?.rawAmount ?? 0))}</span></div>`;
            });

          return [`<div>${month}</div>`, `<div>Total ${currencyFormatter.format(total)}</div>`, ...lines].join('');
        }
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: filteredRows.map((row) => row.month),
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
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#5f6c76',
          formatter: (value: number) => currencyFormatter.format(inverseTransformValue(value))
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(31, 41, 51, 0.12)'
          }
        }
      },
      series: filteredSeries.map((item) => ({
        name: item.category,
        type: 'line',
        smooth: false,
        connectNulls: false,
        symbol: 'circle',
        symbolSize: 8,
        showSymbol: true,
        data: filteredRows.map((row) => {
          const amount = row.values.find((entry) => entry.category === item.category)?.amount || 0;
          return {
            value: transformValue(amount),
            rawAmount: amount
          };
        }),
        lineStyle: {
          width: 3,
          color: item.color
        },
        itemStyle: {
          color: item.color,
          borderColor: '#ffffff',
          borderWidth: 2
        }
      }))
    };
  }, [filteredRows, filteredSeries, inverseTransformValue, transformValue]);

  const activeValues = activeRow
    ? [...activeRow.values].sort((left, right) => right.amount - left.amount)
    : [];

  const toggleCategory = (category: string) => {
    setSelectedCategories((current) => (
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category]
    ));
  };

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <div>
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
                <div className={styles.statLabel}>Visible Spend</div>
                <div className={styles.statValue}>{currencyFormatter.format(visibleTotalSpend)}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Visible Average / Month</div>
                <div className={styles.statValue}>{currencyFormatter.format(visibleAverageMonthlySpend)}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Top Visible Category</div>
                <div className={styles.statValue}>{visibleTopCategory || 'N/A'}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Highest Visible Month</div>
                <div className={styles.statValueSmall}>{visibleHighestMonth?.month || 'N/A'}</div>
              </div>
            </div>

            {!!report.rows.length && !!report.categories.length && (
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <div>
                    <div className={styles.chartTitle}>Top Category Lines By Month</div>
                    <div className={styles.chartCaption}>
                      Filter categories below, then hover the chart to compare the visible series.
                    </div>
                  </div>

                  {activeRow && (
                    <div className={styles.chartCallout}>
                      <div className={styles.chartCalloutMonth}>{activeRow.month}</div>
                      <div className={styles.chartCalloutValue}>
                        Visible {currencyFormatter.format(activeRow.total)}
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

                <div className={styles.chartToolbar}>
                  <div className={styles.chartLegend}>
                    {allSeries.map((item) => {
                      const isSelected = selectedCategorySet.has(item.category);

                      return (
                        <button
                          key={item.category}
                          type="button"
                          className={isSelected ? styles.legendToggleActive : styles.legendToggle}
                          onClick={() => toggleCategory(item.category)}
                        >
                          <span className={styles.legendSwatch} style={{ backgroundColor: item.color }} />
                          <span>{item.category}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className={styles.chartControlRow}>
                    <div className={styles.controlGroup}>
                      <button
                        type="button"
                        className={styles.ghostButton}
                        onClick={() => setSelectedCategories(allSeries.map((item) => item.category))}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        className={styles.ghostButton}
                        onClick={() => setSelectedCategories([])}
                      >
                        Clear
                      </button>
                    </div>

                    <div className={styles.segmentedControl} aria-label="Y-axis scale">
                      <button
                        type="button"
                        className={yAxisMode === 'linear' ? styles.segmentedControlActive : styles.segmentedControlButton}
                        onClick={() => setYAxisMode('linear')}
                      >
                        Linear
                      </button>
                      <button
                        type="button"
                        className={yAxisMode === 'exponential' ? styles.segmentedControlActive : styles.segmentedControlButton}
                        onClick={() => setYAxisMode('exponential')}
                      >
                        Exponential
                      </button>
                    </div>
                  </div>
                </div>

                {!!filteredSeries.length ? (
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
                          if (filteredRows.length) {
                            setActiveMonth(filteredRows[filteredRows.length - 1].month);
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    Select at least one category to render the trend chart.
                  </div>
                )}
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
                  {filteredSeries.map((category) => (
                    <tr key={category.category}>
                      <td>{category.category}</td>
                      <td className={styles.negative}>{currencyFormatter.format(category.total)}</td>
                      <td>{currencyFormatter.format(category.averageMonthly)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!filteredSeries.length && !loading && (
                <div className={styles.emptyState}>
                  No categories are selected. Use the chips above to choose which lines to display.
                </div>
              )}

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
