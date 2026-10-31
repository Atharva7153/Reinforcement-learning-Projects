import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bot, Flag, Ban, Flame, Waves, Snowflake, Orbit, Footprints, ShieldAlert, Zap } from 'lucide-react';
import { playClickSound } from '../utils/sound';

const TILES = [
  {
    name: 'Agent (Start Position)',
    badge: 'State S0',
    color: '#0066ff',
    bg: '#eff5ff',
    border: '#c3d9ff',
    icon: Bot,
    impact: 'Starting Point',
    description: 'The autonomous reinforcement learning agent. In each step, the agent observes its current state s and selects action a ∈ {up, down, left, right} using an ε-greedy policy (exploring randomly with probability ε, or picking the highest Q-value).',
    behavior: 'Moves across the grid, receives rewards/penalties, and executes Bellman updates to improve its Q-table.',
  },
  {
    name: 'Goal State',
    badge: 'Terminal Target',
    color: '#00c853',
    bg: '#edfff5',
    border: '#b3f0cf',
    icon: Flag,
    impact: '+100 Reward (Terminal)',
    description: 'The desired objective for the agent. When the agent moves into the Goal cell, the episode immediately terminates successfully (done = True) and receives a large positive reward (+100).',
    behavior: 'This high terminal reward creates a value gradient that propagates backwards into surrounding states through TD learning.',
  },
  {
    name: 'Wall / Obstacle',
    badge: 'Impassable Barrier',
    color: '#ff1744',
    bg: '#fff0f0',
    border: '#ffc0c0',
    icon: Ban,
    impact: '-5 Penalty (Bounce)',
    description: 'Solid physical obstacles such as walls or labyrinth blocks. The agent cannot enter these cells.',
    behavior: 'Attempting to move into a wall keeps the agent in its current position and applies a wall penalty (-5). The agent learns to navigate around barriers.',
  },
  {
    name: 'Cliff / Lava',
    badge: 'Deadly Hazard',
    color: '#e65100',
    bg: '#fff3e0',
    border: '#ffb74d',
    icon: Flame,
    impact: '-50 Penalty (Terminal Drop)',
    description: 'A perilous drop or lava pit (from Sutton & Barto classic Cliff Walking). Falling into a cliff immediately terminates the episode with a heavy penalty.',
    behavior: 'Teaches risk aversion! During high exploration (large ε), the agent avoids taking paths directly adjacent to cliffs to prevent catastrophic falls.',
  },
  {
    name: 'Mud / Swamp',
    badge: 'Frictional Sludge',
    color: '#8d6e63',
    bg: '#efebe9',
    border: '#bcaaa4',
    icon: Waves,
    impact: '-5 Extra Step Cost',
    description: 'Sticky terrain that slows down movement and drains reward. Stepping into mud does not end the episode, but incurs an extra penalty.',
    behavior: 'The agent calculates trade-offs: is it worth detouring around the mud, or taking the penalty if it is the only short passage to the goal?',
  },
  {
    name: 'Ice / Slippery Surface',
    badge: 'Stochastic Transition',
    color: '#00838f',
    bg: '#e0f7fa',
    border: '#80deea',
    icon: Snowflake,
    impact: '30% Random Slip',
    description: 'Zero-friction ice sheet. When stepping on ice, there is a configurable probability (default 30%) that the agent slips in a perpendicular direction instead of the intended action.',
    behavior: 'Models real-world environmental noise and uncertainty. Demonstrates how reinforcement learning algorithms handle non-deterministic Markov Decision Processes (MDPs).',
  },
  {
    name: 'Portal / Wormhole',
    badge: 'Quantum Warp',
    color: '#6a1b9a',
    bg: '#f3e5f5',
    border: '#ce93d8',
    icon: Orbit,
    impact: 'Instant Teleport',
    description: 'Paired quantum gates that instantaneously teleport the agent across the grid at zero extra step cost.',
    behavior: 'Allows non-Euclidean shortcuts. The Q-learning algorithm discovers that stepping onto Portal 1 warps directly near the goal, drastically reducing total steps.',
  },
  {
    name: 'Empty Walkable Tile',
    badge: 'Open Ground',
    color: '#6b6b6b',
    bg: '#f7f7f5',
    border: '#e5e5e5',
    icon: Footprints,
    impact: '-1 Step Cost',
    description: 'Standard open cell. Applying a small negative penalty (-1) per step incentivizes the agent to find the shortest, most efficient route to the goal rather than wandering aimlessly.',
    behavior: 'Shapes optimal path planning and prevents infinite loops.',
  },
];

export default function TileGuideModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const handleClose = () => {
    playClickSound();
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6"
        style={{
          background: 'rgba(10, 10, 10, 0.65)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 280 }}
          className="relative max-w-3xl w-full max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-neutral-200"
        >
          {/* Header */}
          <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-white sticky top-0 z-10">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                <h2 className="text-xl font-black text-neutral-900 tracking-tight">
                  Tile & Mechanics Guide
                </h2>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5 font-medium">
                Comprehensive breakdown of grid elements, transition dynamics, and reward shaping.
              </p>
            </div>

            <button
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tile Grid Cards */}
          <div className="p-6 overflow-y-auto space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TILES.map((tile) => {
                const Icon = tile.icon;
                return (
                  <div
                    key={tile.name}
                    className="p-4 rounded-2xl border transition-all hover:shadow-sm"
                    style={{
                      backgroundColor: tile.bg,
                      borderColor: tile.border,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                          style={{ backgroundColor: tile.color, color: 'white' }}
                        >
                          <Icon size={18} />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-neutral-900 leading-tight">
                            {tile.name}
                          </h3>
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider font-mono inline-block mt-0.5"
                            style={{ color: tile.color }}
                          >
                            {tile.badge}
                          </span>
                        </div>
                      </div>

                      <span
                        className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.85)',
                          color: tile.color,
                          border: `1px solid ${tile.border}`,
                        }}
                      >
                        {tile.impact}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-700 leading-relaxed mb-2">
                      {tile.description}
                    </p>

                    <div className="text-[11px] font-medium text-neutral-600 bg-white/70 rounded-xl p-2.5 border border-black/5">
                      <strong className="text-neutral-900">RL Impact: </strong>
                      {tile.behavior}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Educational Pro-Tip Box */}
            <div className="p-4 rounded-2xl bg-neutral-900 text-white flex items-start gap-3 mt-4">
              <Zap size={20} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-1">
                  Pro-Tip: Designing Challenging MDPs
                </h4>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Combine <strong className="text-white">Cliffs</strong> with <strong className="text-cyan-400">Ice</strong> to observe how stochastic slip forces the agent to choose safe, wider detours rather than hugging cliff edges. Use <strong className="text-purple-400">Portals</strong> to see the agent learn non-linear wormhole shortcuts across distant quadrants of up to 20×20 grids!
                </p>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-neutral-100 bg-neutral-50 flex justify-end">
            <button
              onClick={handleClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-neutral-900 text-white hover:bg-black transition-all shadow-sm active:scale-95"
            >
              Got it, Let's Build
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
