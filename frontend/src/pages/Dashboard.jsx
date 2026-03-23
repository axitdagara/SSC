import React, { useState, useEffect } from 'react';
import { dashboardService, notificationService } from '../utils/api';
import styles from './dashboard.module.css';

export function DashboardPage() {
  const [overview, setOverview] = useState(null);
  const [featured, setFeatured] = useState([]);
  const [recent, setRecent] = useState([]);
  const [topStats, setTopStats] = useState(null);
  const [chartData, setChartData] = useState({ top_players_runs: [], recent_match_trend: [] });
  const [teamInsights, setTeamInsights] = useState(null);
  const [funds, setFunds] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);

        await notificationService.checkExpiry().catch(() => null);

        console.log('📊 Fetching dashboard data...');
        const [
          overviewRes,
          featuredRes,
          recentRes,
          topStatsRes,
          chartsRes,
          teamInsightsRes,
          fundsRes,
          notificationsRes,
        ] = await Promise.all([
          dashboardService.getExtendedOverview().catch(err => {
            console.error('❌ getExtendedOverview failed:', err.response?.status, err.response?.data);
            throw err;
          }),
          dashboardService.getFeaturedPlayers().catch(err => {
            console.error('❌ getFeaturedPlayers failed:', err.response?.status, err.response?.data);
            throw err;
          }),
          dashboardService.getRecentPlayers().catch(err => {
            console.error('❌ getRecentPlayers failed:', err.response?.status, err.response?.data);
            throw err;
          }),
          dashboardService.getTopStats().catch(err => {
            console.error('❌ getTopStats failed:', err.response?.status, err.response?.data);
            throw err;
          }),
          dashboardService.getCharts().catch(err => {
            console.error('❌ getCharts failed:', err.response?.status, err.response?.data);
            throw err;
          }),
          dashboardService.getTeamInsights().catch(err => {
            console.error('❌ getTeamInsights failed:', err.response?.status, err.response?.data);
            throw err;
          }),
          dashboardService.getFundsSummary().catch(err => {
            console.error('❌ getFundsSummary failed:', err.response?.status, err.response?.data);
            throw err;
          }),
          notificationService.getMine().catch(err => {
            console.error('❌ getMine notifications failed:', err.response?.status, err.response?.data);
            throw err;
          }),
        ]);

        console.log('✅ All dashboard data loaded successfully');
        setOverview(overviewRes.data);
        setFeatured(featuredRes.data || []);
        setRecent(recentRes.data || []);
        setTopStats(topStatsRes.data);
        setChartData(chartsRes.data || { top_players_runs: [], recent_match_trend: [] });
        setTeamInsights(teamInsightsRes.data || null);
        setFunds(fundsRes.data || null);
        setNotifications(notificationsRes.data || []);
      } catch (error) {
        console.error('❌ Failed to load dashboard:', error);
        const errorMsg = error.response?.data?.detail || error.message || 'Error loading dashboard. Please try again.';
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  const topRuns = chartData.top_players_runs || [];
  const recentTrend = chartData.recent_match_trend || [];
  const maxRuns = Math.max(...topRuns.map((item) => item.runs), 1);
  const maxTrendRuns = Math.max(...recentTrend.map((item) => item.runs), 1);

  const markNotificationRead = async (id) => {
    try {
      await notificationService.markRead(id);
      setNotifications((prev) => prev.map((item) => (
        item.id === id ? { ...item, is_read: true } : item
      )));
    } catch {
      // Ignore user-side marking errors to keep dashboard responsive.
    }
  };

  return (
    <div className={styles.dashboard}>
      <div className={styles.container}>
        <div className={styles.pageHead}>
          <h1>Cricket Intelligence Dashboard</h1>
          <p>Real-time player metrics, AI performance pulse, finance health, and notifications.</p>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <h3>Total Players</h3>
            <p className={styles.statValue}>{overview?.total_players || 0}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Premium Members</h3>
            <p className={styles.statValue}>{overview?.premium_players || 0}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Total Matches</h3>
            <p className={styles.statValue}>{overview?.total_matches || 0}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Total Runs</h3>
            <p className={styles.statValue}>{overview?.total_runs || 0}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Total Wickets</h3>
            <p className={styles.statValue}>{overview?.total_wickets || 0}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Avg Runs / Match</h3>
            <p className={styles.statValue}>{overview?.avg_runs_per_match || 0}</p>
          </div>
        </div>

        <div className={styles.analyticsGrid}>
          <section className={styles.panel}>
            <h2>Stats Charts</h2>
            <div className={styles.chartColumns}>
              <div>
                <h4>Top Players by Runs</h4>
                <div className={styles.bars}>
                  {topRuns.length === 0 ? (
                    <p className={styles.empty}>No run data available yet.</p>
                  ) : (
                    topRuns.map((item) => (
                      <div key={item.name} className={styles.barRow}>
                        <span>{item.name}</span>
                        <div className={styles.barTrack}>
                          <div
                            className={styles.barFill}
                            style={{ width: `${(item.runs / maxRuns) * 100}%` }}
                          />
                        </div>
                        <strong>{item.runs}</strong>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h4>Recent Match Runs Trend</h4>
                <div className={styles.trendGrid}>
                  {recentTrend.length === 0 ? (
                    <p className={styles.empty}>No match logs yet.</p>
                  ) : (
                    recentTrend.map((item, index) => (
                      <div key={`${item.label}-${index}`} className={styles.trendItem}>
                        <div
                          className={styles.trendBar}
                          style={{ height: `${Math.max(8, (item.runs / maxTrendRuns) * 110)}px` }}
                          title={`${item.runs} runs, ${item.wickets} wickets, rating ${item.rating}`}
                        />
                        <small>{item.label}</small>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className={styles.panel}>
            <h2>AI Team Performance Pulse</h2>
            {teamInsights ? (
              <>
                <div className={styles.insightHeadline}>
                  <span>Form: {teamInsights.team_form}</span>
                  <strong>Confidence {teamInsights.confidence_score}%</strong>
                </div>
                <ul className={styles.insightsList}>
                  {(teamInsights.insights || []).map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className={styles.empty}>No AI insights available.</p>
            )}
          </section>
        </div>

        {topStats && (
          <div className={styles.topStatsSection}>
            <h2>Top Performance Highlights</h2>
            <div className={styles.topStatsGrid}>
              <div className={styles.topStatCard}>
                <h4>Top Scorer</h4>
                <p>{topStats.top_scorer?.name || 'N/A'}</p>
                <span className={styles.badge}>{topStats.top_scorer?.runs} runs</span>
              </div>
              <div className={styles.topStatCard}>
                <h4>Top Wicket Taker</h4>
                <p>{topStats.top_wicket_taker?.name || 'N/A'}</p>
                <span className={styles.badge}>{topStats.top_wicket_taker?.wickets} wickets</span>
              </div>
              <div className={styles.topStatCardAlt}>
                <h4>Top Match Rating</h4>
                <p>{overview?.top_performance?.performance_rating || 0}</p>
                <span className={styles.badge}>Runs {overview?.top_performance?.runs_scored || 0}</span>
              </div>
            </div>
          </div>
        )}

        {funds && (
          <section className={styles.section}>
            <h2>Club Funds Snapshot</h2>
            <div className={styles.fundsGrid}>
              <div className={styles.fundCard}>
                <span>Total Collected</span>
                <strong>Rs {Number(funds.total_collected || 0).toFixed(2)}</strong>
              </div>
              <div className={styles.fundCard}>
                <span>Guest Fund Spent</span>
                <strong>Rs {Number(funds.guest_fund_spent || 0).toFixed(2)}</strong>
              </div>
              <div className={styles.fundCard}>
                <span>Funds Remaining</span>
                <strong>Rs {Number(funds.funds_remaining || 0).toFixed(2)}</strong>
              </div>
            </div>
          </section>
        )}

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Notifications</h2>
            <span>{notifications.filter((item) => !item.is_read).length} unread</span>
          </div>
          <div className={styles.notificationList}>
            {notifications.length === 0 ? (
              <p className={styles.empty}>No notifications yet.</p>
            ) : (
              notifications.slice(0, 6).map((item) => (
                <div key={item.id} className={`${styles.noticeItem} ${item.is_read ? styles.noticeRead : ''}`}>
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.message}</p>
                    <small>{new Date(item.created_at).toLocaleString()}</small>
                  </div>
                  {!item.is_read && (
                    <button onClick={() => markNotificationRead(item.id)}>
                      Mark Read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className={styles.section}>
          <h2>Featured Premium Players</h2>
          <div className={styles.playersList}>
            {featured.length > 0 ? (
              featured.map((player) => (
                <div key={player.id} className={styles.playerCard}>
                  <div className={styles.playerInfo}>
                    <h3>{player.name}</h3>
                    <p className={styles.premium}>Premium Member</p>
                    <div className={styles.stats}>
                      <span>Runs: {player.runs}</span>
                      <span>Matches: {player.matches}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p>No premium players yet</p>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <h2>Recently Joined Players</h2>
          <div className={styles.playersList}>
            {recent.length > 0 ? (
              recent.map((player) => (
                <div key={player.id} className={styles.playerCard}>
                  <div className={styles.playerInfo}>
                    <h3>{player.name}</h3>
                    <p className={styles.email}>{player.email}</p>
                    <p className={styles.joinDate}>
                      Joined: {new Date(player.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p>No recent players</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
