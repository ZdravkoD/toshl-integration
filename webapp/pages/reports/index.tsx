import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import styles from '../../styles/Report.module.css';

const reports = [
  {
    title: 'Monthly Balance',
    description: 'Cumulative net balance by month with transfers shown separately from net movement.',
    href: '/reports/monthly-balance',
    status: 'Live',
    tag: 'Balance'
  },
  {
    title: 'Category Spend Trend',
    description: 'Track monthly expense trends for your top spending categories and inspect category mix by month.',
    href: '/reports/category-spend-trend',
    status: 'Live',
    tag: 'Expenses'
  },
  {
    title: 'Merchant Spend Report',
    description: 'Rank merchants by spend, volume, and average ticket size to see where money is actually going.',
    status: 'Planned',
    tag: 'Merchants'
  },
  {
    title: 'Recurring Charges Detector',
    description: 'Identify likely subscriptions and repeating bills based on cadence and amount stability.',
    status: 'Planned',
    tag: 'Recurring'
  },
  {
    title: 'Large Transaction / Outlier Report',
    description: 'Surface unusually large transactions relative to their merchant or category history.',
    status: 'Planned',
    tag: 'Outliers'
  },
  {
    title: 'Income Trend By Category',
    description: 'Compare inflow trends across salary, reimbursements, refunds, and other income categories.',
    status: 'Planned',
    tag: 'Income'
  }
];

export default function ReportsPage() {
  const router = useRouter();

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <div>
            <div className={styles.eyebrow}>Report Selector</div>
            <h1 className={styles.title}>Reports</h1>
            <p className={styles.subtitle}>
              Choose a report view based on what you want to understand: balances, category drift, merchants, recurring charges, or outliers.
            </p>
          </div>

          <div className={styles.actionsRow}>
            <button className={styles.ghostButton} onClick={() => router.push('/')}>
              Back To Home
            </button>
            <button className={styles.primaryButton} onClick={() => router.push('/reports/category-spend-trend')}>
              Open Category Spend Trend
            </button>
          </div>
        </div>

        <div className={styles.selectorGrid}>
          {reports.map((report) => {
            const isLive = report.status === 'Live';

            return (
              <div
                key={report.title}
                className={`${styles.selectorCard} ${!isLive ? styles.selectorCardMuted : ''}`}
              >
                <div>
                  <div className={styles.selectorTitleRow}>
                    <h2 className={styles.selectorTitle}>{report.title}</h2>
                    <div className={isLive ? styles.selectorChip : styles.selectorChipMuted}>
                      {report.status}
                    </div>
                  </div>
                  <p className={styles.selectorDescription}>{report.description}</p>
                </div>

                <div className={styles.selectorMeta}>
                  <div className={styles.selectorChipMuted}>{report.tag}</div>
                </div>

                <div className={styles.selectorActions}>
                  {isLive ? (
                    <button className={styles.primaryButton} onClick={() => router.push(report.href!)}>
                      Open Report
                    </button>
                  ) : (
                    <button className={styles.ghostButton} disabled>
                      Coming Soon
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {}
  };
};
