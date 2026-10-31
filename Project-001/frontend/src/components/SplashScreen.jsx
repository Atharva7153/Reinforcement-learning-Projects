import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Play, BookOpen, Cpu, Shield, Zap, Compass, Volume2, ArrowRight } from 'lucide-react';
import { playClickSound, playGoalSound } from '../utils/sound';

export default function SplashScreen({ isOpen, onClose, onOpenGuide }) {
  if (!isOpen) return null;

  const handleEnter = () => {
    playClickSound();
    setTimeout(() => playGoalSound(), 80);
    onClose();
  };

  const handleGuideClick = () => {
    playClickSound();
    onClose();
    if (onOpenGuide) onOpenGuide();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
        style={{
          background: 'radial-gradient(ellipse at 50% 20%, #1a1a1e 0%, #08080a 70%, #000000 100%)',
          backdropFilter: 'blur(16px)',
          overflowY: 'auto',
        }}
      >
        {/* Subtle background neural grid pattern */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: '36px 36px',
          }}
        />

        <motion.div
          initial={{ scale: 0.92, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: -20, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 260 }}
          className="relative max-w-2xl w-full my-auto rounded-3xl p-8 md:p-12 text-white shadow-2xl"
          style={{
            background: 'rgba(18, 18, 22, 0.85)',
            border: '1.5px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 40px rgba(0, 102, 255, 0.15)',
          }}
        >
          {/* Top Badge */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-white/10 text-cyan-400 border border-white/10">
              <Sparkles size={13} className="text-cyan-400" />
              <span>Reinforcement Learning 2.0</span>
            </div>
            <span className="text-xs font-mono text-neutral-400">Markov Decision Process</span>
          </div>

          {/* Cinematic Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight mb-4">
            RL PLAYGROUND
          </h1>
          <p className="text-sm md:text-base text-neutral-300 leading-relaxed font-normal mb-8">
            An interactive tabular reinforcement learning laboratory. Construct custom stochastic environments up to <strong className="text-white">20×20</strong>, watch the agent learn optimal policies in real-time via <strong className="text-cyan-400">Bellman updates</strong>, and inspect Q-values dynamically.
          </p>

          {/* Interactive Bellman Optimality Formula Card */}
          <div
            className="rounded-2xl p-4 md:p-5 mb-8 font-mono text-xs md:text-sm text-neutral-200 border"
            style={{
              background: 'rgba(0, 0, 0, 0.55)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
            }}
          >
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/10 text-[11px] font-sans font-bold uppercase tracking-wider text-neutral-400">
              <span>Bellman Equation Update Rule</span>
              <span className="text-cyan-400">Q-Learning</span>
            </div>
            <div className="text-center py-2 text-cyan-300 font-bold tracking-wide overflow-x-auto whitespace-nowrap text-xs md:text-sm">
              Q(s, a) ← Q(s, a) + α [ R + γ max Q(s', a') - Q(s, a) ]
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 mt-2 border-t border-white/5 text-[10px] text-neutral-400 text-center font-sans">
              <div><strong className="text-white">α</strong> Learning Rate</div>
              <div><strong className="text-white">γ</strong> Discount Factor</div>
              <div><strong className="text-white">ε</strong> Exploration</div>
              <div><strong className="text-white">R</strong> Tile Reward</div>
            </div>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            {[
              { icon: Cpu, label: 'Dynamic 20×20 Worlds', sub: 'Custom CSS Grid' },
              { icon: Zap, label: 'Real-Time Policy Stream', sub: 'FastAPI WebSockets' },
              { icon: Shield, label: 'Stochastic Hazards', sub: 'Mud, Ice, Cliffs, Portals' },
              { icon: Compass, label: 'Scalable Policy Arrows', sub: 'Vector Q-Value Fields' },
              { icon: BookOpen, label: 'Interactive Replayer', sub: 'Rewind Past Episodes' },
              { icon: Volume2, label: 'Web Audio Synthesis', sub: 'Tactile Soundscape' },
            ].map(({ icon: Icon, label, sub }) => (
              <div
                key={label}
                className="p-3 rounded-xl bg-white/[0.04] border border-white/5 flex flex-col gap-1"
              >
                <Icon size={16} className="text-cyan-400" />
                <span className="text-xs font-bold text-white leading-tight mt-1">{label}</span>
                <span className="text-[10px] text-neutral-400 font-sans">{sub}</span>
              </div>
            ))}
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={handleEnter}
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold bg-white text-black hover:bg-neutral-200 transition-all shadow-lg shadow-white/20 active:scale-[0.98]"
            >
              <Play size={16} fill="black" />
              <span>Enter Playground</span>
              <ArrowRight size={15} />
            </button>

            <button
              onClick={handleGuideClick}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-all active:scale-[0.98]"
            >
              <BookOpen size={16} />
              <span>Tile Guide</span>
            </button>
          </div>

          {/* Footer note */}
          <p className="text-center text-[11px] text-neutral-400 mt-6 font-mono">
            Tabular Q-Learning Engine · Fully Responsive · Zero External Audio Assets
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
