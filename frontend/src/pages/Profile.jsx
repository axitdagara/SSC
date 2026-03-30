import React, { useState, useEffect } from 'react';
import { playerService, performanceService, premiumService, adminService } from '../utils/api';
import { useParams } from 'react-router-dom';
import { ProfilePageSkeleton } from '../components/Skeleton';
import styles from './profile.module.css';

export function ProfilePage() {
  const { playerId } = useParams();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [aiInsights, setAiInsights] = useState(null);
  const [aiRefreshing, setAiRefreshing] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [editingStats, setEditingStats] = useState(false);
  const [statsForm, setStatsForm] = useState({
    runs: 0,
    matches: 0,
    wickets: 0,
    centuries: 0,
    half_centuries: 0,
    highest_score: 0,
  });

  const fetchData = async () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('user'));
      let profileId = playerId || currentUser?.id;
      const isOwn = !playerId || String(playerId) === String(currentUser?.id);
      setIsOwnProfile(isOwn);

      let playerRes;
      let statsRes;
      let aiRes;
      let chatRes;

      if (isOwn) {
        // Always resolve own profile from backend identity instead of localStorage id.
        playerRes = await playerService.getCurrentPlayer();
        if (playerRes?.data?.id !== undefined && playerRes?.data?.id !== null) {
          profileId = playerRes.data.id;
          localStorage.setItem('user', JSON.stringify(playerRes.data));
          window.dispatchEvent(new Event('authchange'));
        }

        [statsRes, aiRes, chatRes] = await Promise.all([
          performanceService.getPlayerStats(profileId),
          performanceService.getAiInsights(profileId),
          adminService.getMyChat(),
        ]);
      } else {
        [playerRes, statsRes, aiRes] = await Promise.all([
          playerService.getPlayer(profileId),
          performanceService.getPlayerStats(profileId),
          performanceService.getAiInsights(profileId),
        ]);
      }

      setUser(playerRes.data);
      setStats(statsRes.data);
      setAiInsights(aiRes.data || null);

      if (isOwn && chatRes?.data) {
        setChatMessages(chatRes.data);
      }

      if (statsRes.data) {
        setStatsForm({
          runs: statsRes.data.runs || 0,
          matches: statsRes.data.matches || 0,
          wickets: statsRes.data.wickets || 0,
          centuries: statsRes.data.centuries || 0,
          half_centuries: statsRes.data.half_centuries || 0,
          highest_score: statsRes.data.highest_score || 0,
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [playerId]);

  const handleUpgradePremium = async () => {
    try {
      await premiumService.upgradePremium(30);
      alert('Premium request sent to admin. You will be upgraded after approval.');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to send premium request');
    }
  };

  const handleStatsSave = async () => {
    try {
      await playerService.updateCareerStats({
        runs: Number(statsForm.runs),
        matches: Number(statsForm.matches),
        wickets: Number(statsForm.wickets),
        centuries: Number(statsForm.centuries),
        half_centuries: Number(statsForm.half_centuries),
        highest_score: Number(statsForm.highest_score),
      });
      setEditingStats(false);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to save career stats');
    }
  };

  const handleSendToAdmin = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    try {
      await adminService.sendPlayerMessage(chatInput.trim());
      setChatInput('');
      const chatRes = await adminService.getMyChat();
      setChatMessages(chatRes.data || []);
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to send message to admin');
    }
  };

  const refreshAiInsights = async () => {
    try {
      if (!user?.id) return;
      setAiRefreshing(true);
      const aiRes = await performanceService.getAiInsights(user.id, true);
      setAiInsights(aiRes.data || null);
    } catch (error) {
      console.error('Failed to refresh AI insights:', error);
    } finally {
      setAiRefreshing(false);
    }
  };

  if (loading) return <ProfilePageSkeleton />;

  return (
    <div className={styles.profilePage}>
      <div className={styles.container}>
        {user && (
          <>
            <div className={styles.profileHeader}>
              <div className={styles.profileInfo}>
                <h1>{user.name}</h1>
                {user.is_premium && <span className={styles.premiumBadge}>⭐ Premium Member</span>}
                <p className={styles.email}>{user.email}</p>
                {user.bio && <p className={styles.bio}>{user.bio}</p>}
              </div>

              {isOwnProfile && !user.is_premium && (
                <button className={styles.premiumBtn} onClick={handleUpgradePremium}>
                  🚀 Request Premium - Rs 1000/month
                </button>
              )}
            </div>

            {stats && (
              <div className={styles.statsSection}>
                <div className={styles.sectionHeader}>
                  <h2>Career Statistics</h2>
                  {isOwnProfile && (
                    <button className={styles.inlineBtn} onClick={() => setEditingStats((prev) => !prev)}>
                      {editingStats ? 'Cancel' : 'Edit Stats'}
                    </button>
                  )}
                </div>
                <div className={styles.statsGrid}>
                  {[
                    ['runs', 'Total Runs'],
                    ['matches', 'Matches'],
                    ['wickets', 'Wickets'],
                    ['centuries', 'Centuries'],
                    ['half_centuries', 'Half-Centuries'],
                    ['highest_score', 'Highest Score'],
                  ].map(([key, label]) => (
                    <div className={styles.statBox} key={key}>
                      <span className={styles.statLabel}>{label}</span>
                      {editingStats ? (
                        <input
                          type="number"
                          min="0"
                          value={statsForm[key]}
                          onChange={(e) => setStatsForm((prev) => ({ ...prev, [key]: e.target.value }))}
                        />
                      ) : (
                        <span className={styles.statValue}>{stats[key]}</span>
                      )}
                    </div>
                  ))}
                  <div className={styles.statBox}>
                    <span className={styles.statLabel}>Average Runs</span>
                    <span className={styles.statValue}>{stats.average_runs}</span>
                  </div>
                </div>
                {editingStats && (
                  <div className={styles.saveRow}>
                    <button className={styles.saveBtn} onClick={handleStatsSave}>Save Career Stats</button>
                  </div>
                )}
              </div>
            )}

            {aiInsights && (
              <div className={styles.aiSection}>
                <div className={styles.sectionHeader}>
                  <h2>AI-Based Performance Insights</h2>
                  <button className={styles.inlineBtn} onClick={refreshAiInsights} disabled={aiRefreshing}>
                    {aiRefreshing ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
                <div className={styles.aiGrid}>
                  <div className={styles.aiCard}>
                    <span>Player</span>
                    <strong>{aiInsights.player_name || user?.name || 'Player'}</strong>
                  </div>
                  <div className={styles.aiCard}>
                    <span>Matches Analyzed</span>
                    <strong>{aiInsights.matches_analyzed || 0}</strong>
                  </div>
                  <div className={styles.aiCard}>
                    <span>Generated At</span>
                    <strong>{aiInsights.timestamp ? new Date(aiInsights.timestamp).toLocaleDateString() : '-'}</strong>
                  </div>
                </div>
                <div className={styles.aiTextBlock}>
                  {(String(aiInsights.insights || '')
                    .replace(/\*\*/g, '')
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .slice(0, 8)
                  ).map((line, idx) => (
                    <p key={idx}>{line}</p>
                  ))}
                </div>
              </div>
            )}

            {isOwnProfile && (
              <div className={styles.chatSection}>
                <h2>Admin Support Chat</h2>
                <div className={styles.chatMessages}>
                  {chatMessages.length === 0 ? (
                    <p>No messages yet. Ask admin anything about your account.</p>
                  ) : (
                    chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={msg.sender_role === 'admin' ? styles.chatAdmin : styles.chatPlayer}
                      >
                        <span>{msg.message}</span>
                        <small>{new Date(msg.created_at).toLocaleString()}</small>
                      </div>
                    ))
                  )}
                </div>
                <form className={styles.chatForm} onSubmit={handleSendToAdmin}>
                  <input
                    type="text"
                    placeholder="Type a message to admin..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                  />
                  <button type="submit">Send</button>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
