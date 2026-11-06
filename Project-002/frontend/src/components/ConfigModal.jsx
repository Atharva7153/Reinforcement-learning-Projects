import React, { useState } from 'react';
import { X, Save, Sliders, Check } from 'lucide-react';

export default function ConfigModal({ isOpen, onClose, config, hyperparams, onSave }) {
  if (!isOpen) return null;

  const [formData, setFormData] = useState({
    track_length: config?.track_length ?? 100.0,
    initial_distance: config?.initial_distance ?? 85.0,
    initial_velocity: config?.initial_velocity ?? 14.0,
    target_min_dist: config?.target_min_dist ?? 1.0,
    target_max_dist: config?.target_max_dist ?? 4.0,
    brake_accel: config?.brake_accel ?? -5.0,
    accel_rate: config?.accel_rate ?? 2.5,
    randomize_init: config?.randomize_init ?? true,
    learning_rate: hyperparams?.learning_rate ?? 0.15,
    discount_factor: hyperparams?.discount_factor ?? 0.98,
    epsilon_decay: hyperparams?.epsilon_decay ?? 0.996
  });

  const handleChange = (key, val) => {
    setFormData(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = () => {
    onSave({
      config: {
        track_length: Number(formData.track_length),
        initial_distance: Number(formData.initial_distance),
        initial_velocity: Number(formData.initial_velocity),
        target_min_dist: Number(formData.target_min_dist),
        target_max_dist: Number(formData.target_max_dist),
        brake_accel: Number(formData.brake_accel),
        accel_rate: Number(formData.accel_rate),
        drag_accel: -0.3,
        dt: 0.1,
        max_steps: 150,
        randomize_init: Boolean(formData.randomize_init)
      },
      hyperparams: {
        learning_rate: Number(formData.learning_rate),
        discount_factor: Number(formData.discount_factor),
        epsilon: hyperparams?.epsilon ?? 1.0,
        epsilon_min: 0.05,
        epsilon_decay: Number(formData.epsilon_decay)
      }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200/80 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Physics & Agent Configuration</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Section 1: Physics Environment */}
          <div>
            <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wider mb-2.5 text-indigo-600">
              Car Physics & Track Geometry
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-600 font-medium block mb-1">Track Length (m)</label>
                <input
                  type="number"
                  min="50"
                  max="200"
                  value={formData.track_length}
                  onChange={e => handleChange('track_length', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-slate-600 font-medium block mb-1">Initial Speed (m/s)</label>
                <input
                  type="number"
                  step="0.5"
                  min="5"
                  max="25"
                  value={formData.initial_velocity}
                  onChange={e => handleChange('initial_velocity', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-slate-600 font-medium block mb-1">Braking Decel (m/s²)</label>
                <input
                  type="number"
                  step="0.5"
                  min="-10"
                  max="-2"
                  value={formData.brake_accel}
                  onChange={e => handleChange('brake_accel', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-slate-600 font-medium block mb-1">Engine Accel (m/s²)</label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="6"
                  value={formData.accel_rate}
                  onChange={e => handleChange('accel_rate', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-slate-600 font-medium block mb-1">Target Stop Min (m)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="2.5"
                  value={formData.target_min_dist}
                  onChange={e => handleChange('target_min_dist', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-slate-600 font-medium block mb-1">Target Stop Max (m)</label>
                <input
                  type="number"
                  step="0.5"
                  min="2.5"
                  max="6.0"
                  value={formData.target_max_dist}
                  onChange={e => handleChange('target_max_dist', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                id="randomize"
                checked={formData.randomize_init}
                onChange={e => handleChange('randomize_init', e.target.checked)}
                className="h-4 w-4 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="randomize" className="text-slate-700 font-medium cursor-pointer">
                Randomize starting distance & speed per episode (generalization)
              </label>
            </div>
          </div>

          {/* Section 2: Q-Learning Hyperparameters */}
          <div className="pt-2 border-t border-slate-100">
            <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wider mb-2.5 text-indigo-600">
              Q-Learning Hyperparameters
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-slate-600 font-medium block mb-1">Learning Rate (α)</label>
                <input
                  type="number"
                  step="0.02"
                  min="0.01"
                  max="0.9"
                  value={formData.learning_rate}
                  onChange={e => handleChange('learning_rate', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-slate-600 font-medium block mb-1">Discount (γ)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.5"
                  max="0.999"
                  value={formData.discount_factor}
                  onChange={e => handleChange('discount_factor', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-slate-600 font-medium block mb-1">Epsilon Decay</label>
                <input
                  type="number"
                  step="0.001"
                  min="0.95"
                  max="0.9999"
                  value={formData.epsilon_decay}
                  onChange={e => handleChange('epsilon_decay', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm shadow-indigo-200 transition-all"
          >
            <Save className="h-4 w-4" />
            <span>Apply Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
}
