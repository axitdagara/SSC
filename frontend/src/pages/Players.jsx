import React, { useState, useEffect } from 'react';
import { playerService } from '../utils/api';
import { Link } from 'react-router-dom';
import { PlayersPageSkeleton } from '../components/Skeleton';
import styles from './players.module.css';

export function PlayersPage() {
  const [players, setPLayers] = useState([]);
  const [search, setSearch] = useState('');
  const [premiumFilter, setPremiumFilter] = useState('all');
  const [sortBy, setSortBy] = useState('runs');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const response = await playerService.getAllPlayers();
        setPLayers(response.data);
      } catch (error) {
        console.error('Failed to load players:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
  }, []);

  const filteredPlayers = players
    .filter((player) => {
      const searchValue = search.trim().toLowerCase();
      if (!searchValue) return true;
      return (
        player.name.toLowerCase().includes(searchValue)
        || player.email.toLowerCase().includes(searchValue)
      );
    })
    .filter((player) => {
      if (premiumFilter === 'premium') return player.is_premium;
      if (premiumFilter === 'regular') return !player.is_premium;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'matches') return b.matches - a.matches;
      if (sortBy === 'wickets') return b.wickets - a.wickets;
      return b.runs - a.runs;
    });

  if (loading) return <PlayersPageSkeleton />;

  return (
    <div className={styles.playersPage}>
      <div className={styles.container}>
        <h1>🏏 All Players</h1>

        <div className={styles.controls}>
          <input
            type="text"
            placeholder="Search by player name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={premiumFilter} onChange={(e) => setPremiumFilter(e.target.value)}>
            <option value="all">All Players</option>
            <option value="premium">Premium Only</option>
            <option value="regular">Regular Only</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="runs">Sort by Runs</option>
            <option value="matches">Sort by Matches</option>
            <option value="wickets">Sort by Wickets</option>
          </select>
        </div>

        <div className={styles.playersList}>
          {filteredPlayers.length > 0 ? (
            filteredPlayers.map((player) => (
              <Link key={player.id} to={`/player/${player.id}`} className={styles.playerCard}>
                <div className={styles.playerHeader}>
                  <h3>{player.name}</h3>
                  {player.is_premium && <span className={styles.premiumBadge}>⭐ Premium</span>}
                </div>

                <div className={styles.stats}>
                  <div className={styles.stat}>
                    <span className={styles.label}>Runs</span>
                    <span className={styles.value}>{player.runs}</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.label}>Matches</span>
                    <span className={styles.value}>{player.matches}</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.label}>Wickets</span>
                    <span className={styles.value}>{player.wickets}</span>
                  </div>
                </div>

                <div className={styles.footer}>
                  <span className={styles.email}>{player.email}</span>
                </div>
              </Link>
            ))
          ) : (
            <p className={styles.noPlayers}>No players match the selected filters</p>
          )}
        </div>
      </div>
    </div>
  );
}
