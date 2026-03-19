import React, { useEffect, useMemo, useState } from 'react';
import { matchesService, playerService } from '../utils/api';
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
      const [matchRes, playerRes] = await Promise.all([
        matchesService.listMatches(),
        playerService.getAllPlayers(0, 200),
      ]);
      setMatches(matchRes.data || []);
      setPlayers((playerRes.data || []).filter((p) => p.role === 'player'));
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load match data');
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
      return;
    }

    setError('');
    setMessage('');

    try {
      await matchesService.setupTeams(selectedMatchId, {
        team_a_player_ids: teamAIds.map(Number),
        team_b_player_ids: teamBIds.map(Number),
      });
      setMessage('Teams saved');
      await fetchMatchDetail(selectedMatchId);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save teams');
    }
  };

  const handleStartMatch = async () => {
    if (!selectedMatchId) {
      return;
    }

    setError('');
    setMessage('');

    try {
      await matchesService.startMatch(selectedMatchId, { batting_team: ballForm.batting_team });
      setMessage('Match started');
      await fetchMatchDetail(selectedMatchId);
      setCurrentStep(3);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start match');
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
      const res = await matchesService.recordBall(selectedMatchId, {
        ...ballForm,
        innings: Number(ballForm.innings),
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

  const teamAOptions = players.filter((p) => !teamBIds.includes(String(p.id)));
  const teamBOptions = players.filter((p) => !teamAIds.includes(String(p.id)));
  const filteredTeamAOptions = teamAOptions.filter((p) =>
    p.name.toLowerCase().includes(teamASearch.toLowerCase())
  );
  const filteredTeamBOptions = teamBOptions.filter((p) =>
    p.name.toLowerCase().includes(teamBSearch.toLowerCase())
  );
  const selectedTeamAPlayers = players.filter((p) => teamAIds.includes(String(p.id)));
  const selectedTeamBPlayers = players.filter((p) => teamBIds.includes(String(p.id)));
  const reusableMatches = matches.filter((m) => m.id !== selectedMatchId);

  return (
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
              <input
                type="number"
                min="1"
                max="50"
                value={createForm.overs_per_innings}
                onChange={(e) => setCreateForm((p) => ({ ...p, overs_per_innings: e.target.value }))}
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
                  <strong>{match.title}</strong>
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
                    <div className={styles.teamHeaderRow}>
                      <label>Team A Players ({teamAIds.length})</label>
                      <div className={styles.teamActions}>
                        <button
                          type="button"
                          onClick={() =>
                            setTeamAIds((prev) =>
                              Array.from(new Set([...prev, ...filteredTeamAOptions.map((p) => String(p.id))]))
                            )
                          }
                        >
                          Select Visible
                        </button>
                        <button type="button" onClick={() => setTeamAIds([])}>Clear</button>
                      </div>
                    </div>
                    <input
                      className={styles.teamSearch}
                      placeholder="Search Team A players"
                      value={teamASearch}
                      onChange={(e) => setTeamASearch(e.target.value)}
                    />
                    <select
                      multiple
                      value={teamAIds}
                      onChange={(e) => setTeamAIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
                    >
                      {filteredTeamAOptions.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>

                    <div className={styles.selectedList}>
                      {selectedTeamAPlayers.map((p) => (
                        <button
                          key={`a-${p.id}`}
                          type="button"
                          className={styles.selectedChip}
                          onClick={() => setTeamAIds((prev) => prev.filter((id) => id !== String(p.id)))}
                        >
                          {p.name} x
                        </button>
                      ))}
                      {selectedTeamAPlayers.length === 0 && <span className={styles.note}>No players selected</span>}
                    </div>
                  </div>

                  <div className={styles.teamColumn}>
                    <div className={styles.teamHeaderRow}>
                      <label>Team B Players ({teamBIds.length})</label>
                      <div className={styles.teamActions}>
                        <button
                          type="button"
                          onClick={() =>
                            setTeamBIds((prev) =>
                              Array.from(new Set([...prev, ...filteredTeamBOptions.map((p) => String(p.id))]))
                            )
                          }
                        >
                          Select Visible
                        </button>
                        <button type="button" onClick={() => setTeamBIds([])}>Clear</button>
                      </div>
                    </div>
                    <input
                      className={styles.teamSearch}
                      placeholder="Search Team B players"
                      value={teamBSearch}
                      onChange={(e) => setTeamBSearch(e.target.value)}
                    />
                    <select
                      multiple
                      value={teamBIds}
                      onChange={(e) => setTeamBIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
                    >
                      {filteredTeamBOptions.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>

                    <div className={styles.selectedList}>
                      {selectedTeamBPlayers.map((p) => (
                        <button
                          key={`b-${p.id}`}
                          type="button"
                          className={styles.selectedChip}
                          onClick={() => setTeamBIds((prev) => prev.filter((id) => id !== String(p.id)))}
                        >
                          {p.name} x
                        </button>
                      ))}
                      {selectedTeamBPlayers.length === 0 && <span className={styles.note}>No players selected</span>}
                    </div>
                  </div>
                </div>

                <div className={styles.rowButtons}>
                  <button type="button" onClick={() => setCurrentStep(1)}>Back</button>
                  <button type="button" onClick={handleTeamSetup}>Save Teams</button>
                  <button type="button" onClick={handleStartMatch}>Start Match</button>
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
                <div className={styles.umpireGuide}>
                  <h3>Quick Guide</h3>
                  <div className={styles.guideGrid}>
                    <p><strong>Innings:</strong> 1 for first innings, 2 for second innings.</p>
                    <p><strong>Over/Ball:</strong> Auto-generated by system after each ball.</p>
                    <p><strong>Runs:</strong> Runs scored from bat on that ball.</p>
                    <p><strong>Extras:</strong> Extra runs (wide/no-ball/bye/leg bye).</p>
                    <p><strong>Wicket:</strong> Tick if wicket fell on this ball.</p>
                    <p><strong>Commentary:</strong> Short note like "Cover drive for four".</p>
                  </div>
                </div>

                <form onSubmit={handleBallSubmit}>
                  <div className={styles.formRow}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Innings</label>
                      <select
                        value={ballForm.innings}
                        onChange={(e) => setBallForm((p) => ({ ...p, innings: e.target.value }))}
                      >
                        {inningsOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
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
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Batting Team</label>
                      <select
                        value={ballForm.batting_team}
                        onChange={(e) => setBallForm((p) => ({ ...p, batting_team: e.target.value }))}
                      >
                        <option value="A">Batting Team A</option>
                        <option value="B">Batting Team B</option>
                      </select>
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

                <h3 className={styles.sectionTitle}>Live Scoreboard</h3>
                {!scoreboard && <p>Select a match to view live score.</p>}
                {scoreboard && (
                  <div className={styles.scoreboard}>
                    <h3>{selectedMatch?.match?.title}</h3>
                    <p>Innings: {scoreboard.current_innings}</p>
                    <p className={styles.bigScore}>
                      {scoreboard.total_runs}/{scoreboard.wickets}
                    </p>
                    <p>Overs: {scoreboard.overs_display}</p>
                    <p>
                      Batting Team: {scoreboard.batting_team === 'A' ? selectedMatch?.match?.team_a_name : selectedMatch?.match?.team_b_name}
                    </p>
                    <p>
                      {selectedMatch?.match?.team_a_name}: {scoreboard.team_a_runs} | {selectedMatch?.match?.team_b_name}: {scoreboard.team_b_runs}
                    </p>

                    {scoreboard.result_text && (
                      <p className={styles.resultBadge}>{scoreboard.result_text}</p>
                    )}

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
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
