import React, { useState, useEffect, useRef } from 'react';
import { History, Play, Pause, SkipBack, SkipForward, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { getEpisodeDetail } from '../services/api';

export default function EpisodeHistory({
  sessionId, currentEpisode, isTraining,
  onStartReplay, onStopReplay,
  isReplayMode, replayStepIndex, onStepChange,
  isReplayPlaying = false, onTogglePlay = null,
  replaySpeed = 200, onSpeedChange = null,
  externalTargetEpisode = null,
}) {
  const [targetEpisode, setTargetEpisode] = useState('');
  const [epData, setEpData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (externalTargetEpisode && externalTargetEpisode >= 1 && externalTargetEpisode !== Number(targetEpisode)) {
      setTargetEpisode(String(externalTargetEpisode));
      loadEpisode(externalTargetEpisode, false);
    }
  }, [externalTargetEpisode]);

  const loadEpisode = async (n, autoPlay = false) => {
    if (!sessionId || !n || n < 1) return;
    setLoading(true);
    try {
      const data = await getEpisodeDetail(sessionId, n);
      setEpData(data);
      if (onStartReplay) onStartReplay(data.path, data.trajectory, n);
      // Auto-scroll to top grid
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (autoPlay && onTogglePlay) {
        setTimeout(() => {
          onTogglePlay(false);
        }, 400);
      }
    } catch {
      setEpData(null);
    } finally { setLoading(false); }
  };

  const handleExit = () => {
    setEpData(null);
    if (onStopReplay) onStopReplay();
  };

  const maxSteps = epData?.path ? epData.path.length - 1 : 0;
  const stepData = epData?.trajectory?.[replayStepIndex - 1];

  const QUICK_JUMPS = [1, 10, 50, 100, 250, 500].filter(n => n <= (currentEpisode || 0));

  return (
    <div className="card">
      <div className="card-section" style={{ borderBottom: '1.5px solid #e5e5e5', paddingBottom: 14 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={15} color="#6b6b6b" />
            <span className="section-title" style={{ marginBottom: 0 }}>Episode History & Replay</span>
          </div>
          {isReplayMode && (
            <button onClick={handleExit} type="button"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 7, fontSize: 12,
                fontWeight: 600, border: '1.5px solid #ffc0c0',
                background: '#fff0f0', color: '#cc0000', cursor: 'pointer',
              }}>
              <X size={12} /> Exit Replay
            </button>
          )}
        </div>
      </div>

      <div className="card-section">
        {/* Input + Inspect & Play buttons */}
        <div className="flex flex-wrap sm:flex-nowrap gap-2 mb-2.5">
          <div
            className="flex-1 min-w-[120px]"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              border: '1.5px solid #e5e5e5', borderRadius: 10, padding: '0 12px',
              background: '#fafafa',
            }}
          >
            <span style={{ fontSize: 12, color: '#bbb', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>Ep #</span>
            <input
              type="number" min={1} max={currentEpisode || 1}
              value={targetEpisode}
              onChange={e => setTargetEpisode(e.target.value)}
              placeholder={currentEpisode > 0 ? `1 – ${currentEpisode}` : 'Train first'}
              disabled={isTraining}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 700, color: '#0a0a0a',
                padding: '9px 0', width: '100%', minWidth: 40,
              }}
            />
          </div>
          <button
            type="button"
            disabled={isTraining || !currentEpisode || !targetEpisode || Number(targetEpisode) < 1 || Number(targetEpisode) > currentEpisode || loading}
            onClick={() => loadEpisode(Number(targetEpisode), false)}
            className="btn btn-white flex-1 sm:flex-none"
            style={{ fontSize: 12, padding: '8px 12px' }}
          >
            {loading ? 'Loading…' : 'Inspect'}
          </button>
          <button
            type="button"
            disabled={isTraining || !currentEpisode || !targetEpisode || Number(targetEpisode) < 1 || Number(targetEpisode) > currentEpisode || loading}
            onClick={() => loadEpisode(Number(targetEpisode), true)}
            className="btn btn-black flex-1 sm:flex-none"
            style={{ fontSize: 12, padding: '8px 14px' }}
          >
            <Play size={12} fill="white" />
            Play Replay
          </button>
        </div>

        {/* Quick-jump pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: '#bbb', fontWeight: 600, alignSelf: 'center' }}>Jump:</span>
          {QUICK_JUMPS.map(n => (
            <button key={n} type="button" disabled={isTraining}
              onClick={() => { setTargetEpisode(String(n)); loadEpisode(n, false); }}
              style={{
                padding: '4px 10px', borderRadius: 7, fontSize: 11,
                fontWeight: 700, fontFamily: 'JetBrains Mono',
                border: '1.5px solid #e5e5e5', background: 'white',
                color: '#6b6b6b', cursor: 'pointer', transition: 'all 0.12s',
              }}>
              #{n}
            </button>
          ))}
          {currentEpisode > 0 && !QUICK_JUMPS.includes(currentEpisode) && (
            <button type="button" disabled={isTraining}
              onClick={() => { setTargetEpisode(String(currentEpisode)); loadEpisode(currentEpisode, false); }}
              style={{
                padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                fontFamily: 'JetBrains Mono', border: '1.5px solid #b35c00',
                background: '#fff8e8', color: '#b35c00', cursor: 'pointer',
              }}>
              Latest #{currentEpisode}
            </button>
          )}
        </div>

        {/* Episode summary + replay */}
        {epData && (
          <div style={{
            marginTop: 14, padding: 16, borderRadius: 12,
            border: '1.5px solid #e5e5e5', background: '#fafafa',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: '#0a0a0a' }}>
                Episode #{epData.episode}
              </span>
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700,
                color: epData.reached_goal ? '#00843d' : '#cc0000',
              }}>
                {epData.reached_goal
                  ? <><CheckCircle size={14} /> Goal Reached</>
                  : <><AlertTriangle size={14} /> Timeout</>}
              </span>
            </div>

            {/* Mini stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'Reward', value: epData.total_reward, color: epData.total_reward > 0 ? '#00843d' : '#cc0000' },
                { label: 'Steps', value: epData.steps, color: '#0a0a0a' },
                { label: 'ε', value: epData.epsilon, color: '#b35c00' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  padding: '10px 12px', borderRadius: 10, background: 'white',
                  border: '1.5px solid #e5e5e5', textAlign: 'center',
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{label}</span>
                  <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 800, fontSize: 18, color }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Scrubber */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: 'JetBrains Mono', color: '#6b6b6b', marginBottom: 6 }}>
                <span>Step {replayStepIndex} of {maxSteps}</span>
                {stepData && (
                  <span style={{ color: '#ff8f00', fontWeight: 700 }}>
                    {stepData.action.toUpperCase()} → {stepData.reward}
                  </span>
                )}
              </div>
              <input type="range" min={0} max={maxSteps}
                value={replayStepIndex}
                onChange={e => onStepChange(Number(e.target.value))} />
            </div>

            {/* Playback controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => onStepChange(0)} type="button" className="btn btn-ghost btn-sm" title="Reset to start">
                  <SkipBack size={13} />
                </button>
                <button
                  onClick={() => {
                    if (onTogglePlay) onTogglePlay(true);
                  }}
                  type="button"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 8, border: 'none',
                    background: '#ff8f00', color: 'white', fontWeight: 700, fontSize: 12,
                    cursor: 'pointer', boxShadow: '0 2px 8px rgba(255,143,0,0.3)',
                  }}>
                  {isReplayPlaying ? <Pause size={13} fill="white" /> : <Play size={13} fill="white" />}
                  {isReplayPlaying ? 'Pause' : 'Play Path'}
                </button>
                <button onClick={() => onStepChange(p => Math.min(maxSteps, p + 1))} type="button" className="btn btn-ghost btn-sm" title="Next step">
                  <SkipForward size={13} />
                </button>
              </div>

              {/* Speed */}
              <div style={{ display: 'flex', gap: 4, fontSize: 11, fontFamily: 'JetBrains Mono' }}>
                {[{ label: 'Fast', ms: 80 }, { label: '1×', ms: 200 }, { label: 'Slow', ms: 500 }].map(({ label, ms }) => (
                  <button key={ms} onClick={() => onSpeedChange && onSpeedChange(ms)} type="button"
                    style={{
                      padding: '5px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      border: '1.5px solid', cursor: 'pointer',
                      borderColor: replaySpeed === ms ? '#0a0a0a' : '#e5e5e5',
                      background: replaySpeed === ms ? '#0a0a0a' : 'white',
                      color: replaySpeed === ms ? 'white' : '#6b6b6b',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
