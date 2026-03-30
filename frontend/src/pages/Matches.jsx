import React, { useEffect, useMemo, useState } from 'react';
import { matchesService, playerService } from '../utils/api';
import { MatchesPageSkeleton } from '../components/Skeleton';
import styles from './matches.module.css';

export function MatchesPage() {
  const inningsOptions = [1, 2];
  const runOptions = [0, 1, 2, 3, 4, 5, 6];
  const wicketTypeOptions = ['bowled', 'caught', 'lbw', 'run out', 'stumped', 'hit wicket', 'retired out'];

  const [currentStep, setCurrentStep] = useState(1);
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [scoreboard, setScoreboard] = useState(null);
  const [showPastOvers, setShowPastOvers] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [createForm, setCreateForm] = useState({
    title: '',
    team_a_name: 'Team A',
    team_b_name: 'Team B',
    overs_per_innings: 20,
  });

  const [teamAIds, setTeamAIds] = useState([]);
  const [teamBIds, setTeamBIds] = useState([]);
  const [teamASearch, setTeamASearch] = useState('');
  const [teamBSearch, setTeamBSearch] = useState('');
  const [teamSource, setTeamSource] = useState('new');
  const [previousMatchId, setPreviousMatchId] = useState('');

  const [ballForm, setBallForm] = useState({
    innings: 1,
    over_number: 1,
    ball_number: 1,
    batting_team: 'A',
    striker_id: '',
    bowler_id: '',
    runs_off_bat: 0,
    extras: 0,
    extra_type: '',
    is_wicket: false,
    wicket_type: '',
    commentary: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showUmpireGuide, setShowUmpireGuide] = useState(true);
  const [showMatchHistory, setShowMatchHistory] = useState(false);
  const [matchHistoryData, setMatchHistoryData] = useState([]);

  // Helper function to extract error message from various error formats
  const getErrorMessage = (err) => {
    if (!err) return 'An unknown error occurred';
    
    // If it's an axios error with response data
    if (err.response?.data) {
      const data = err.response.data;
      
      // Check for detail field (common pattern)
      if (typeof data.detail === 'string') return data.detail;
      if (typeof data.detail === 'object' && data.detail?.msg) return data.detail.msg;
      
      // Check for message field
      if (typeof data.message === 'string') return data.message;
      
      // Check for array of validation errors (Pydantic)
      if (Array.isArray(data)) {
        return data.map(e => e.msg || e.detail || JSON.stringify(e)).join('; ');
      }
      
      // If data is an object with msg field
      if (typeof data.msg === 'string') return data.msg;
      
      // Try to stringify if it's an object
      if (typeof data === 'object') {
        try {
          return JSON.stringify(data);
        } catch (e) {
          return 'Invalid server response';
        }
      }
    }
    
    // Use error message
    if (typeof err.message === 'string') return err.message;
    
    // Fallback
    return 'An error occurred';
  };

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (_err) {
      return {};
    }
  }, []);

  const canCreateMatch = !!user?.is_premium || user?.role === 'admin';

  const fetchBase = async () => {
    try {
      setInitialLoading(true);
      const [matchRes, playerRes] = await Promise.all([
        matchesService.listMatches(),
        playerService.getAllPlayers(0, 200),
      ]);
      setMatches(matchRes.data || []);
      setPlayers((playerRes.data || []).filter((p) => p.role === 'player'));
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load match data');
    } finally {
      setInitialLoading(false);
    }
  };

  const fetchMatchDetail = async (matchId) => {
    if (!matchId) {
      setSelectedMatch(null);
      setScoreboard(null);
      setShowPastOvers(false);
      return;
    }

    try {
      const detailRes = await matchesService.getMatch(matchId);
      const inningsToShow = detailRes.data?.match?.current_innings || 1;
      const scoreRes = await matchesService.getScoreboard(matchId, inningsToShow);
      setSelectedMatch(detailRes.data);
      setScoreboard(scoreRes.data);

      setTeamAIds((detailRes.data?.team_a_players || []).map((p) => String(p.user_id)));
      setTeamBIds((detailRes.data?.team_b_players || []).map((p) => String(p.user_id)));

      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load selected match');
    }
  };

  useEffect(() => {
    fetchBase();
  }, []);

  useEffect(() => {
    fetchMatchDetail(selectedMatchId);
  }, [selectedMatchId]);

  useEffect(() => {
    if (!selectedMatchId || currentStep !== 3) {
      return;
    }

    const timer = setInterval(() => {
      const inningsToShow = selectedMatch?.match?.current_innings || 1;
      matchesService
        .getScoreboard(selectedMatchId, inningsToShow)
        .then((res) => setScoreboard(res.data))
        .catch(() => null);
    }, 2000);

    return () => clearInterval(timer);
  }, [selectedMatchId, currentStep, selectedMatch]);

  const handleSelectMatch = (match) => {
    setSelectedMatchId(match.id);
    setShowPastOvers(false);
    setCurrentStep(match.status === 'setup' ? 2 : 3);
  };

  const handleCreateMatch = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      const payload = {
        ...createForm,
        overs_per_innings: Number(createForm.overs_per_innings),
      };
      const res = await matchesService.createMatch(payload);
      setMessage('Match created successfully');
      setCreateForm({ title: '', team_a_name: 'Team A', team_b_name: 'Team B', overs_per_innings: 20 });
      await fetchBase();
      setSelectedMatchId(res.data.id);
      setCurrentStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create match');
    }
  };

  const handleApplyPreviousTeams = async () => {
    if (!previousMatchId) {
      setError('Select a previous match first');
      return;
    }

    try {
      const detailRes = await matchesService.getMatch(Number(previousMatchId));
      const prevTeamA = (detailRes.data?.team_a_players || []).map((p) => String(p.user_id));
      const prevTeamB = (detailRes.data?.team_b_players || []).map((p) => String(p.user_id));

      if (prevTeamA.length === 0 && prevTeamB.length === 0) {
        setError('Selected match has no teams configured');
        return;
      }

      setTeamAIds(prevTeamA);
      setTeamBIds(prevTeamB);
      setMessage('Previous teams loaded. Save teams to apply to this match.');
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load previous match teams');
    }
  };

  const handleTeamSetup = async () => {
    if (!selectedMatchId) {
      setError('No match selected');
      return;
    }

    if (teamAIds.length === 0 || teamBIds.length === 0) {
      setError('Please select at least one player for each team');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      // Send player IDs as-is (they are Firebase UIDs from the player objects)
      const payload = {
        team_a_player_ids: teamAIds,
        team_b_player_ids: teamBIds,
      };
      
      console.log('Team A IDs:', teamAIds);
      console.log('Team B IDs:', teamBIds);
      console.log('Team setup payload:', payload);
      await matchesService.setupTeams(selectedMatchId, payload);
      setMessage('Teams saved successfully!');
      
      // Refresh match details
      try {
        await fetchMatchDetail(selectedMatchId);
      } catch (detailErr) {
        console.error('Error refreshing match details:', detailErr);
        // Don't show error for refresh failures, just continue
      }
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      console.error('Team setup error:', err);
      setError(String(errorMsg)); // Ensure it's always a string
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartMatch = async () => {
    if (!selectedMatchId) {
      setError('No match selected');
      return;
    }

    if (teamAIds.length === 0 || teamBIds.length === 0) {
      setError('Please select at least one player for each team and click "Save Teams" first');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      // Send player IDs as-is (they are Firebase UIDs from the player objects)
      const payload = {
        team_a_player_ids: teamAIds,
        team_b_player_ids: teamBIds,
      };
      
      console.log('Start match payload:', payload);
      
      // First, ensure teams are saved
      await matchesService.setupTeams(selectedMatchId, payload);
      console.log('Teams saved, starting match...');

      // Then start the match
      await matchesService.startMatch(selectedMatchId, { batting_team: ballForm.batting_team });
      
      setMessage('Match started successfully!');
      
      // Refresh match details
      try {
        await fetchMatchDetail(selectedMatchId);
        setCurrentStep(3);
      } catch (detailErr) {
        console.error('Error refreshing match details:', detailErr);
        // Still move to step 3 even if refresh fails
        setCurrentStep(3);
      }
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      console.error('Start match error:', err);
      setError(String(errorMsg)); // Ensure it's always a string
    } finally {
      setIsLoading(false);
    }
  };

  const handleBallSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMatchId) {
      return;
    }

    setError('');
    setMessage('');

    try {
      // Use current_innings from the match instead of manual ballForm.innings
      const currentInnings = selectedMatch?.match?.current_innings || 1;
      
      const res = await matchesService.recordBall(selectedMatchId, {
        ...ballForm,
        innings: Number(currentInnings),
        over_number: Number(ballForm.over_number),
        ball_number: Number(ballForm.ball_number),
        striker_id: ballForm.striker_id ? Number(ballForm.striker_id) : null,
        bowler_id: ballForm.bowler_id ? Number(ballForm.bowler_id) : null,
        runs_off_bat: Number(ballForm.runs_off_bat),
        extras: Number(ballForm.extras),
        extra_type: ballForm.extra_type || null,
        wicket_type: ballForm.wicket_type || null,
        commentary: ballForm.commentary || null,
      });

      setMessage('Ball updated');
      await fetchMatchDetail(selectedMatchId);

      const nextOver = res.data?.next_ball?.over_number;
      const nextBall = res.data?.next_ball?.ball_number;
      const nextInnings = res.data?.next_ball?.innings;
      const nextBattingTeam = res.data?.next_ball?.batting_team;

      if (res.data?.innings_over && !res.data?.match_completed) {
        setMessage('Innings over: all players are out. Switched to next innings.');
      }

      if (res.data?.match_completed) {
        setMessage('Match completed: all players are out in current innings.');
      }

      setBallForm((prev) => ({
        ...prev,
        innings: nextInnings || prev.innings,
        batting_team: nextBattingTeam || prev.batting_team,
        over_number: nextOver || prev.over_number,
        ball_number: nextBall || prev.ball_number,
        commentary: '',
        is_wicket: false,
        wicket_type: '',
        runs_off_bat: 0,
        extras: 0,
      }));
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not record ball');
    }
  };

  const teamAOptions = players.filter((p) => !teamBIds.includes(String(p.id)) && !teamAIds.includes(String(p.id)));
  const teamBOptions = players.filter((p) => !teamAIds.includes(String(p.id)) && !teamBIds.includes(String(p.id)));
  const filteredTeamAOptions = teamAOptions.filter((p) =>
    p.name.toLowerCase().includes(teamASearch.toLowerCase())
  );
  const filteredTeamBOptions = teamBOptions.filter((p) =>
    p.name.toLowerCase().includes(teamBSearch.toLowerCase())
  );
  const selectedTeamAPlayers = players.filter((p) => teamAIds.includes(String(p.id)));
  const selectedTeamBPlayers = players.filter((p) => teamBIds.includes(String(p.id)));
  const reusableMatches = matches.filter((m) => m.id !== selectedMatchId);
  const selectedMatchStatus = scoreboard?.match_status || selectedMatch?.match?.status || 'setup';
  const isLiveMatch = selectedMatchStatus === 'live';
  const isCompletedMatch = selectedMatchStatus === 'completed';
  const teamAName = selectedMatch?.match?.team_a_name;
  const teamBName = selectedMatch?.match?.team_b_name;
  const isTeamAWinner = Boolean(scoreboard?.winner_team) && scoreboard.winner_team === teamAName;
  const isTeamBWinner = Boolean(scoreboard?.winner_team) && scoreboard.winner_team === teamBName;

  const getMatchStatusLabel = (status) => {
    if (status === 'live') {
      return 'LIVE';
    }
    if (status === 'completed') {
      return 'COMPLETED';
    }
    return 'SETUP';
  };

  const handleShowMatchHistory = async () => {
    if (!selectedMatchId) return;
    
    try {
      // Fetch all ball events for the match
      const scoreRes = await matchesService.getScoreboard(selectedMatchId, 1);
      const allBalls = scoreRes.data?.all_balls || [];
      setMatchHistoryData(allBalls);
      setShowMatchHistory(true);
    } catch (err) {
      setError('Could not load match history');
    }
  };

  return (
    <>
      {initialLoading && <MatchesPageSkeleton />}
      {!initialLoading && (
        <div className={styles.page}>
      <div className={styles.container}>
        <h1>Live Match Center</h1>
        <p className={styles.subtitle}>Premium creators can set teams and track ball-by-ball scoring in real time.</p>

        <div className={styles.steps}>
          <button
            type="button"
            className={`${styles.stepBtn} ${currentStep === 1 ? styles.stepActive : ''}`}
            onClick={() => setCurrentStep(1)}
          >
            1. Match
          </button>
          <button
            type="button"
            className={`${styles.stepBtn} ${currentStep === 2 ? styles.stepActive : ''}`}
            onClick={() => selectedMatchId && setCurrentStep(2)}
            disabled={!selectedMatchId}
          >
            2. Teams
          </button>
          <button
            type="button"
            className={`${styles.stepBtn} ${currentStep === 3 ? styles.stepActive : ''}`}
            onClick={() => selectedMatchId && setCurrentStep(3)}
            disabled={!selectedMatchId}
          >
            3. Live Scoring
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.message}>{message}</div>}

        {currentStep === 1 && (
          <section className={styles.card}>
            <h2>Create Match</h2>
            {!canCreateMatch && <p className={styles.note}>Only premium players can create matches.</p>}
            <form onSubmit={handleCreateMatch}>
              <input
                placeholder="Match title"
                value={createForm.title}
                onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
                disabled={!canCreateMatch}
                required
              />
              <input
                placeholder="Team A name"
                value={createForm.team_a_name}
                onChange={(e) => setCreateForm((p) => ({ ...p, team_a_name: e.target.value }))}
                disabled={!canCreateMatch}
                required
              />
              <input
                placeholder="Team B name"
                value={createForm.team_b_name}
                onChange={(e) => setCreateForm((p) => ({ ...p, team_b_name: e.target.value }))}
                disabled={!canCreateMatch}
                required
              />
              <button type="submit" disabled={!canCreateMatch}>Create Match</button>
            </form>

            <h3 className={styles.sectionTitle}>All Matches</h3>
            <div className={styles.matchList}>
              {matches.map((match) => (
                <button
                  key={match.id}
                  className={`${styles.matchItem} ${selectedMatchId === match.id ? styles.active : ''}`}
                  onClick={() => handleSelectMatch(match)}
                >
                  <div className={styles.matchHeadRow}>
                    <strong>{match.title}</strong>
                    <span
                      className={`${styles.statusPill} ${
                        match.status === 'live'
                          ? styles.statusLive
                          : match.status === 'completed'
                          ? styles.statusCompleted
                          : styles.statusSetup
                      }`}
                    >
                      {getMatchStatusLabel(match.status)}
                    </span>
                  </div>
                  <span>{match.team_a_name} vs {match.team_b_name}</span>
                  <small>{match.status}</small>
                </button>
              ))}
              {matches.length === 0 && <p>No matches yet.</p>}
            </div>

            {selectedMatchId && (
              <div className={styles.rowButtons}>
                <button type="button" onClick={() => setCurrentStep(2)}>Continue to Team Setup</button>
              </div>
            )}
          </section>
        )}

        {currentStep === 2 && (
          <section className={styles.card}>
            <h2>Match Setup</h2>
            {!selectedMatch && <p>Select a match to setup teams and scoring.</p>}
            {selectedMatch && (
              <>
                <p className={styles.note}>{selectedMatch.match.team_a_name} vs {selectedMatch.match.team_b_name}</p>

                <div className={styles.teamSourceRow}>
                  <label>
                    <input
                      type="radio"
                      name="teamSource"
                      value="new"
                      checked={teamSource === 'new'}
                      onChange={() => setTeamSource('new')}
                    />
                    Create new teams
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="teamSource"
                      value="previous"
                      checked={teamSource === 'previous'}
                      onChange={() => setTeamSource('previous')}
                    />
                    Use previous match teams
                  </label>
                </div>

                {teamSource === 'previous' && (
                  <div className={styles.previousBox}>
                    <select
                      value={previousMatchId}
                      onChange={(e) => setPreviousMatchId(e.target.value)}
                    >
                      <option value="">Select previous match</option>
                      {reusableMatches.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title} ({m.team_a_name} vs {m.team_b_name})
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={handleApplyPreviousTeams}>Load Previous Teams</button>
                  </div>
                )}

                <div className={styles.teamSetup}>
                  <div className={styles.teamColumn}>
                    <div className={styles.teamBox}>
                      <div className={styles.teamBoxHeader}>
                        <h3>{selectedMatch.match.team_a_name}</h3>
                        <span className={styles.playerCount}>{teamAIds.length} selected</span>
                      </div>
                      
                      <input
                        className={styles.playerSearch}
                        placeholder={`Search ${selectedMatch.match.team_a_name} players...`}
                        value={teamASearch}
                        onChange={(e) => setTeamASearch(e.target.value)}
                      />

                      {/* Selected Players Section */}
                      {selectedTeamAPlayers.length > 0 && (
                        <div className={styles.selectedSection}>
                          <div className={styles.sectionLabel}>Selected Players</div>
                          <div className={styles.playerGrid}>
                            {selectedTeamAPlayers.map((p) => (
                              <div key={`a-${p.id}`} className={styles.playerCard + ' ' + styles.selected}>
                                <div className={styles.playerInfo}>
                                  <div className={styles.playerName}>{p.name}</div>
                                  <div className={styles.playerRole}>{p.role}</div>
                                </div>
                                <button
                                  type="button"
                                  className={styles.removeBtn}
                                  onClick={() => setTeamAIds((prev) => prev.filter((id) => id !== String(p.id)))}
                                  title="Remove from team"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Available Players Section */}
                      <div className={styles.availableSection}>
                        <div className={styles.sectionLabel}>Available Players</div>
                        {filteredTeamAOptions.length > 0 ? (
                          <div className={styles.playerGrid}>
                            {filteredTeamAOptions.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className={styles.playerCard}
                                onClick={() => setTeamAIds((prev) => [...prev, String(p.id)])}
                                title={`Add ${p.name} to ${selectedMatch.match.team_a_name}`}
                              >
                                <div className={styles.playerInfo}>
                                  <div className={styles.playerName}>{p.name}</div>
                                  <div className={styles.playerStats}>
                                    <span>🏃 {p.runs || 0}</span>
                                    <span>⚡ {p.matches || 0}</span>
                                  </div>
                                </div>
                                <div className={styles.addIcon}>+</div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className={styles.emptyState}>
                            {teamASearch ? 'No players matching your search' : 'All available players are already selected'}
                          </div>
                        )}
                      </div>

                      <div className={styles.teamActions}>
                        <button
                          type="button"
                          onClick={() =>
                            setTeamAIds((prev) =>
                              Array.from(new Set([...prev, ...filteredTeamAOptions.map((p) => String(p.id))]))
                            )
                          }
                          className={styles.actionBtn}
                          disabled={filteredTeamAOptions.length === 0}
                        >
                          ✓ Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setTeamAIds([])}
                          className={styles.actionBtn + ' ' + styles.secondary}
                          disabled={teamAIds.length === 0}
                        >
                          ✕ Clear
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className={styles.teamColumn}>
                    <div className={styles.teamBox}>
                      <div className={styles.teamBoxHeader}>
                        <h3>{selectedMatch.match.team_b_name}</h3>
                        <span className={styles.playerCount}>{teamBIds.length} selected</span>
                      </div>
                      
                      <input
                        className={styles.playerSearch}
                        placeholder={`Search ${selectedMatch.match.team_b_name} players...`}
                        value={teamBSearch}
                        onChange={(e) => setTeamBSearch(e.target.value)}
                      />

                      {/* Selected Players Section */}
                      {selectedTeamBPlayers.length > 0 && (
                        <div className={styles.selectedSection}>
                          <div className={styles.sectionLabel}>Selected Players</div>
                          <div className={styles.playerGrid}>
                            {selectedTeamBPlayers.map((p) => (
                              <div key={`b-${p.id}`} className={styles.playerCard + ' ' + styles.selected}>
                                <div className={styles.playerInfo}>
                                  <div className={styles.playerName}>{p.name}</div>
                                  <div className={styles.playerRole}>{p.role}</div>
                                </div>
                                <button
                                  type="button"
                                  className={styles.removeBtn}
                                  onClick={() => setTeamBIds((prev) => prev.filter((id) => id !== String(p.id)))}
                                  title="Remove from team"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Available Players Section */}
                      <div className={styles.availableSection}>
                        <div className={styles.sectionLabel}>Available Players</div>
                        {filteredTeamBOptions.length > 0 ? (
                          <div className={styles.playerGrid}>
                            {filteredTeamBOptions.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className={styles.playerCard}
                                onClick={() => setTeamBIds((prev) => [...prev, String(p.id)])}
                                title={`Add ${p.name} to ${selectedMatch.match.team_b_name}`}
                              >
                                <div className={styles.playerInfo}>
                                  <div className={styles.playerName}>{p.name}</div>
                                  <div className={styles.playerStats}>
                                    <span>🏃 {p.runs || 0}</span>
                                    <span>⚡ {p.matches || 0}</span>
                                  </div>
                                </div>
                                <div className={styles.addIcon}>+</div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className={styles.emptyState}>
                            {teamBSearch ? 'No players matching your search' : 'All available players are already selected'}
                          </div>
                        )}
                      </div>

                      <div className={styles.teamActions}>
                        <button
                          type="button"
                          onClick={() =>
                            setTeamBIds((prev) =>
                              Array.from(new Set([...prev, ...filteredTeamBOptions.map((p) => String(p.id))]))
                            )
                          }
                          className={styles.actionBtn}
                          disabled={filteredTeamBOptions.length === 0}
                        >
                          ✓ Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setTeamBIds([])}
                          className={styles.actionBtn + ' ' + styles.secondary}
                          disabled={teamBIds.length === 0}
                        >
                          ✕ Clear
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.rowButtons}>
                  <button type="button" onClick={() => setCurrentStep(1)}>Back</button>
                  <button 
                    type="button" 
                    onClick={handleTeamSetup}
                    disabled={teamAIds.length === 0 || teamBIds.length === 0 || isLoading}
                  >
                    {isLoading ? 'Processing...' : 'Save Teams'}
                  </button>
                  <button 
                    type="button" 
                    onClick={handleStartMatch}
                    disabled={teamAIds.length === 0 || teamBIds.length === 0 || isLoading}
                  >
                    {isLoading ? 'Starting...' : 'Start Match'}
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {currentStep === 3 && (
          <section className={styles.card}>
            <h2>Ball by Ball (Umpire Panel)</h2>
            {!selectedMatch && <p>Select a match from step 1 first.</p>}
            {selectedMatch && (
              <>
                {showUmpireGuide && (
                  <div className={styles.umpireGuide}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h3 style={{ margin: 0 }}>Quick Guide</h3>
                      <button 
                        type="button"
                        onClick={() => setShowUmpireGuide(false)}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '20px',
                          cursor: 'pointer',
                          color: '#305d57',
                          padding: '0 4px',
                          lineHeight: 1,
                        }}
                        title="Close guide"
                      >
                        ✕
                      </button>
                    </div>
                    <div className={styles.guideGrid}>
                      <p><strong>Batting Team:</strong> Select which team is batting in current innings.</p>
                      <p><strong>Innings:</strong> Auto-set based on match progress. Team A bats 1st, Team B bats in 2nd innings.</p>
                      <p><strong>Runs:</strong> Runs scored from bat on that ball.</p>
                      <p><strong>Extras:</strong> Extra runs (wide/no-ball/bye/leg bye).</p>
                      <p><strong>Wicket:</strong> Tick if wicket fell on this ball.</p>
                      <p><strong>Commentary:</strong> Short note like "Cover drive for four".</p>
                    </div>
                  </div>
                )}

                {!isCompletedMatch ? (
                  <>
                    <form onSubmit={handleBallSubmit}>
                      <div className={styles.formRow}>
                        <div className={styles.fieldGroup}>
                          <label className={styles.fieldLabel}>Batting Team</label>
                          <select
                            value={ballForm.batting_team}
                            onChange={(e) => {
                              const newTeam = e.target.value;
                              setBallForm((p) => ({ ...p, batting_team: newTeam }));
                            }}
                          >
                            <option value="A">{selectedMatch?.match?.team_a_name || 'Team A'} (Batting)</option>
                            <option value="B">{selectedMatch?.match?.team_b_name || 'Team B'} (Batting)</option>
                          </select>
                        </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Current Innings</label>
                      <input
                        type="number"
                        value={selectedMatch?.match?.current_innings || ballForm.innings}
                        readOnly
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Over Number</label>
                      <input
                        type="number"
                        min="1"
                        value={ballForm.over_number}
                        readOnly
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Ball Number (1-6)</label>
                      <input
                        type="number"
                        min="1"
                        max="6"
                        value={ballForm.ball_number}
                        readOnly
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Runs Off Bat</label>
                      <select
                        value={ballForm.runs_off_bat}
                        onChange={(e) => setBallForm((p) => ({ ...p, runs_off_bat: e.target.value }))}
                      >
                        {runOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Extras</label>
                      <select
                        value={ballForm.extras}
                        onChange={(e) => setBallForm((p) => ({ ...p, extras: e.target.value }))}
                      >
                        {runOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Extra Type</label>
                      <select
                        value={ballForm.extra_type}
                        onChange={(e) => setBallForm((p) => ({ ...p, extra_type: e.target.value }))}
                      >
                        <option value="">No Extra Type</option>
                        <option value="wide">Wide</option>
                        <option value="no_ball">No Ball</option>
                        <option value="bye">Bye</option>
                        <option value="leg_bye">Leg Bye</option>
                      </select>
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Wicket On This Ball?</label>
                      <label className={styles.wicketCheck}>
                        <input
                          type="checkbox"
                          checked={ballForm.is_wicket}
                          onChange={(e) => setBallForm((p) => ({ ...p, is_wicket: e.target.checked }))}
                        />
                        Yes, wicket fell
                      </label>
                    </div>
                  </div>

                  {ballForm.is_wicket && (
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Wicket Type</label>
                      <select
                        value={ballForm.wicket_type}
                        onChange={(e) => setBallForm((p) => ({ ...p, wicket_type: e.target.value }))}
                      >
                        <option value="">Select Wicket Type</option>
                        {wicketTypeOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Ball Commentary</label>
                    <input
                      placeholder="Short comment for this ball"
                      value={ballForm.commentary}
                      onChange={(e) => setBallForm((p) => ({ ...p, commentary: e.target.value }))}
                    />
                  </div>

                  <div className={styles.rowButtons}>
                    <button type="button" onClick={() => setCurrentStep(2)}>Back</button>
                    <button type="submit">Record Ball</button>
                  </div>
                </form>
                  </>
                ) : (
                  <p className={styles.completedHint}>
                    This match is completed. Live scoring inputs are now read-only.
                  </p>
                )}

                <h3 className={styles.sectionTitle}>Live Scoreboard</h3>
                {!scoreboard && <p>Select a match to view live score.</p>}
                {scoreboard && (
                  <div
                    className={`${styles.scoreboard} ${
                      isCompletedMatch
                        ? styles.scoreboardCompleted
                        : isLiveMatch
                        ? styles.scoreboardLive
                        : styles.scoreboardSetup
                    }`}
                  >
                    <div className={styles.scoreboardTop}>
                      <h3>{selectedMatch?.match?.title}</h3>
                      <span
                        className={`${styles.scoreboardStatus} ${
                          isCompletedMatch
                            ? styles.scoreboardStatusCompleted
                            : isLiveMatch
                            ? styles.scoreboardStatusLive
                            : styles.scoreboardStatusSetup
                        }`}
                      >
                        {getMatchStatusLabel(selectedMatchStatus)}
                      </span>
                    </div>

                    <div className={styles.teamTotalsRow}>
                      <div className={`${styles.teamTotalItem} ${isTeamAWinner ? styles.teamTotalWinner : ''}`}>
                        <span>
                          {teamAName}
                          {isTeamAWinner && <em className={styles.winnerTag}>Winner</em>}
                        </span>
                        <strong>{scoreboard.team_a_runs}</strong>
                      </div>
                      <div className={`${styles.teamTotalItem} ${isTeamBWinner ? styles.teamTotalWinner : ''}`}>
                        <span>
                          {teamBName}
                          {isTeamBWinner && <em className={styles.winnerTag}>Winner</em>}
                        </span>
                        <strong>{scoreboard.team_b_runs}</strong>
                      </div>
                    </div>

                    <div className={styles.scoreMainRow}>
                      <div className={styles.scoreMetaItem}>
                        <span className={styles.scoreMetaLabel}>Innings</span>
                        <strong className={styles.scoreMetaValue}>{scoreboard.current_innings}</strong>
                      </div>
                      <div className={styles.scoreMetaItem}>
                        <span className={styles.scoreMetaLabel}>Overs</span>
                        <strong className={styles.scoreMetaValue}>{scoreboard.overs_display}</strong>
                      </div>
                      <div className={styles.scoreMetaItemWide}>
                        <span className={styles.scoreMetaLabel}>Batting Team</span>
                        <strong className={styles.scoreMetaValue}>
                          {scoreboard.batting_team === 'A' ? selectedMatch?.match?.team_a_name : selectedMatch?.match?.team_b_name}
                        </strong>
                      </div>
                      <div className={styles.scoreNowCard}>
                        <span className={styles.scoreMetaLabel}>Current Score</span>
                        <p className={styles.bigScore}>
                          {scoreboard.total_runs}/{scoreboard.wickets}
                        </p>
                      </div>
                    </div>

                    {scoreboard.result_text && (
                      <p 
                        className={styles.resultBadge}
                        onClick={handleShowMatchHistory}
                        style={{ cursor: 'pointer' }}
                        title="Click to view match history"
                      >
                        {scoreboard.result_text}
                      </p>
                    )}

                    {!isCompletedMatch && (
                      <>
                        <h4>Current Over ({scoreboard.current_over_number})</h4>
                        <div className={styles.ballStrip}>
                          {scoreboard.current_over_balls.map((ball, idx) => (
                            <span key={`current-${ball}-${idx}`}>{ball}</span>
                          ))}
                          {scoreboard.current_over_balls.length === 0 && <span>No balls in current over yet</span>}
                        </div>

                        <div className={styles.overToggleRow}>
                          <button
                            type="button"
                            className={styles.toggleBtn}
                            onClick={() => setShowPastOvers((prev) => !prev)}
                            disabled={scoreboard.past_overs.length === 0}
                          >
                            {showPastOvers ? 'Hide Past Overs' : 'Show Past Overs'}
                          </button>
                        </div>

                        {showPastOvers && scoreboard.past_overs.length > 0 && (
                          <div className={styles.pastOversWrap}>
                            {scoreboard.past_overs.map((overText, idx) => (
                              <p key={`past-${idx}`} className={styles.overLine}>{overText}</p>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {showMatchHistory && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '800px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ margin: 0, color: '#173a36' }}>Match History</h2>
                <button 
                  onClick={() => setShowMatchHistory(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#305d57',
                  }}
                >
                  ✕
                </button>
              </div>

              <p style={{ color: '#476b67', marginBottom: '16px' }}>
                <strong>{selectedMatch?.match?.team_a_name} vs {selectedMatch?.match?.team_b_name}</strong>
              </p>

              {matchHistoryData && matchHistoryData.length > 0 ? (
                <div>
                  {Object.entries(
                    matchHistoryData.reduce((acc, ball) => {
                      const inning = `Innings ${ball.innings}`;
                      if (!acc[inning]) acc[inning] = [];
                      acc[inning].push(ball);
                      return acc;
                    }, {})
                  ).map(([inning, balls]) => (
                    <div key={inning} style={{ marginBottom: '20px' }}>
                      <h3 style={{ color: '#0f6f62', borderBottom: '2px solid #d0e8e3', paddingBottom: '8px' }}>
                        {inning}
                      </h3>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {balls.map((ball, idx) => (
                          <div 
                            key={idx}
                            style={{
                              background: '#f4faf8',
                              border: '1px solid #d0e8e3',
                              borderRadius: '8px',
                              padding: '12px',
                              fontSize: '13px',
                              color: '#1d4b45',
                            }}
                          >
                            <strong>Over {ball.over_number}.{ball.ball_number}</strong>
                            {' | '}
                            Batting: {ball.batting_team === 'A' ? selectedMatch?.match?.team_a_name : selectedMatch?.match?.team_b_name}
                            {' | '}
                            Runs: {ball.runs_off_bat} + {ball.extras || 0} extra
                            {ball.extra_type && ` (${ball.extra_type})`}
                            {ball.is_wicket && ' | ⚠️ WICKET'}
                            {ball.wicket_type && ` (${ball.wicket_type})`}
                            {ball.commentary && (
                              <>
                                <br />
                                <em>{ball.commentary}</em>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#567a74' }}>No ball data available for this match.</p>
              )}

              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <button 
                  onClick={() => setShowMatchHistory(false)}
                  style={{
                    background: '#0f6f62',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
      )}
    </>
  );
}
