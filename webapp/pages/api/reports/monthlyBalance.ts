import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabaseDetailed } from '../../../lib/mongodb';
import { getMonthlyBalanceReportDetailed } from '../../../lib/toshlSync';

function formatServerTiming(metrics: Array<{ name: string; duration: number; description?: string }>) {
  return metrics
    .map(metric =>
      `${metric.name};dur=${metric.duration}${metric.description ? `;desc="${metric.description}"` : ''}`
    )
    .join(', ');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const requestStartedAt = Date.now();
    const requestId = `mbr_${Math.random().toString(36).slice(2, 10)}`;
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const connection = await connectToDatabaseDetailed();
    const { report, diagnostics } = await getMonthlyBalanceReportDetailed(connection.db, { from, to });
    const totalMs = Date.now() - requestStartedAt;

    const serverTiming = formatServerTiming([
      { name: 'db_connect', duration: connection.connectMs, description: connection.cacheHit ? 'mongo_cache_hit' : 'mongo_connect' },
      { name: 'mongo_aggregate', duration: diagnostics.mongoAggregateMs, description: 'monthly_balance_aggregate' },
      { name: 'post_process', duration: diagnostics.postProcessMs, description: 'monthly_balance_post_process' },
      { name: 'total', duration: totalMs, description: 'monthly_balance_total' }
    ]);

    res.setHeader('Server-Timing', serverTiming);
    res.setHeader('X-Report-Request-Id', requestId);

    console.info('[monthly-balance-timing]', JSON.stringify({
      requestId,
      from: diagnostics.from,
      to: diagnostics.to,
      totalMs,
      dbConnectMs: connection.connectMs,
      mongoCacheHit: connection.cacheHit,
      mongoAggregateMs: diagnostics.mongoAggregateMs,
      postProcessMs: diagnostics.postProcessMs,
      monthlyRowCount: diagnostics.monthlyRowCount
    }));

    return res.status(200).json(report);
  } catch (error) {
    console.error('Error building monthly balance report:', error);
    return res.status(500).json({
      error: 'Failed to build monthly balance report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
