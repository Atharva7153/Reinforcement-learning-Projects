import React, { useRef, useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { ShieldCheck, AlertTriangle, Flame, Zap, Pause, ArrowRight } from 'lucide-react';

function safeRoundRect(ctx, x, y, width, height, radii) {
  if (typeof ctx.roundRect === 'function') {
    try {
      ctx.roundRect(x, y, width, height, radii);
      return;
    } catch (e) {
      // fallback
    }
  }
  const r = typeof radii === 'number' ? radii : 6;
  ctx.rect(x, y, width, height);
}

export default function CarSimulationCanvas({
  telemetry,
  config,
  stats,
  isTraining,
  mode
}) {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const particlesRef = useRef([]);
  const roadDashOffsetRef = useRef(0);
  const prevOutcomeRef = useRef(null);

  // Trigger celebration or crash effect on outcome change
  useEffect(() => {
    if (telemetry?.outcome && telemetry.outcome !== prevOutcomeRef.current) {
      if (telemetry.outcome === 'SUCCESS') {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6, x: 0.75 },
          colors: ['#10B981', '#34D399', '#6EE7B7', '#3B82F6']
        });
      } else if (telemetry.outcome === 'CRASH') {
        // Spawn crash sparks
        for (let i = 0; i < 30; i++) {
          particlesRef.current.push({
            x: 0.92,
            y: 0.5,
            vx: (Math.random() - 0.7) * 8,
            vy: (Math.random() - 0.5) * 8,
            color: Math.random() > 0.5 ? '#EF4444' : '#F59E0B',
            radius: Math.random() * 3 + 2,
            life: 1.0,
            decay: Math.random() * 0.03 + 0.02
          });
        }
      }
      prevOutcomeRef.current = telemetry.outcome;
    }
  }, [telemetry?.outcome]);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Handle high DPI
      const dpr = window.devicePixelRatio || 1;

      // Clear Canvas
      ctx.clearRect(0, 0, width, height);

      const trackLength = config?.track_length || 100.0;
      const currentDist = telemetry ? Math.max(0, telemetry.distance) : 85.0;
      const currentVel = telemetry ? telemetry.velocity : 12.0;
      const action = telemetry ? telemetry.action : 2; // 0=Brake, 1=Accel, 2=Maintain

      // Road geometry
      const roadTop = height * 0.28;
      const roadHeight = height * 0.44;
      const roadBottom = roadTop + roadHeight;
      const wallWidth = 24;
      const trackRight = width - wallWidth - 16;
      const trackLeft = 32;
      const usableTrackWidth = trackRight - trackLeft;

      // Calculate car position along track
      // Distance is meters to wall: at d = trackLength, car is at trackLeft. At d = 0, car bumper hits wall.
      const carProgress = Math.max(0, Math.min(1, (trackLength - currentDist) / trackLength));
      const carFrontX = trackLeft + carProgress * usableTrackWidth;
      const carLength = 68;
      const carWidth = 32;
      const carRearX = carFrontX - carLength;
      const carY = roadTop + roadHeight / 2 - carWidth / 2;

      // ── 1. Draw Road Background & Curbs ──────────────────────────────────
      // Top curb (red and white safety curb)
      const curbHeight = 8;
      const curbSegments = 24;
      const segWidth = width / curbSegments;
      for (let i = 0; i < curbSegments; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#DC2626' : '#FFFFFF';
        ctx.fillRect(i * segWidth, roadTop - curbHeight, segWidth, curbHeight);
        ctx.fillRect(i * segWidth, roadBottom, segWidth, curbHeight);
      }

      // Asphalt surface
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, roadTop, width, roadHeight);

      // Subtle asphalt texture lines
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, roadTop + roadHeight * 0.25);
      ctx.lineTo(width, roadTop + roadHeight * 0.25);
      ctx.moveTo(0, roadTop + roadHeight * 0.75);
      ctx.lineTo(width, roadTop + roadHeight * 0.75);
      ctx.stroke();

      // Animated Road Center Dash Lines
      if (currentVel > 0.1 && telemetry?.outcome === 'RUNNING') {
        roadDashOffsetRef.current = (roadDashOffsetRef.current + currentVel * 0.6) % 36;
      }
      ctx.save();
      ctx.setLineDash([20, 16]);
      ctx.lineDashOffset = -roadDashOffsetRef.current;
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, roadTop + roadHeight / 2);
      ctx.lineTo(trackRight, roadTop + roadHeight / 2);
      ctx.stroke();
      ctx.restore();

      // ── 2. Distance Ticks & Metric Scale ─────────────────────────────────
      ctx.fillStyle = '#64748B';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';

      const majorTicks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      majorTicks.forEach(meters => {
        const tickProgress = (trackLength - meters) / trackLength;
        const tickX = trackLeft + tickProgress * usableTrackWidth;

        // Tick mark
        ctx.fillStyle = meters === 0 ? '#DC2626' : '#94A3B8';
        ctx.fillRect(tickX - 0.5, roadBottom + curbHeight + 2, 1, 6);

        // Tick text
        ctx.fillStyle = meters === 0 ? '#DC2626' : '#64748B';
        ctx.fillText(`${meters}m`, tickX, roadBottom + curbHeight + 18);
      });

      // ── 3. Safe Target Stopping Zone ─────────────────────────────────────
      // Stop zone from target_min_dist to target_max_dist before wall
      const targetMin = config?.target_min_dist || 1.0;
      const targetMax = config?.target_max_dist || 4.0;
      const targetMinX = trackRight - (targetMax / trackLength) * usableTrackWidth;
      const targetMaxX = trackRight - (targetMin / trackLength) * usableTrackWidth;
      const targetZoneWidth = Math.max(8, targetMaxX - targetMinX);

      // Safe zone glowing background
      ctx.save();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
      ctx.fillRect(targetMinX, roadTop, targetZoneWidth, roadHeight);

      // Safe zone border & stripes
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      ctx.strokeRect(targetMinX, roadTop, targetZoneWidth, roadHeight);

      // Diagonal hazard hatching for safe zone
      ctx.beginPath();
      for (let x = targetMinX; x < targetMaxX + roadHeight; x += 14) {
        ctx.moveTo(Math.max(targetMinX, x), roadTop);
        ctx.lineTo(Math.min(targetMaxX, x - roadHeight), roadBottom);
      }
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Safe Zone Marker Tag on top
      ctx.fillStyle = '#059669';
      ctx.font = 'bold 9px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TARGET STOP ZONE [1.0m - 4.0m]', targetMinX + targetZoneWidth / 2, roadTop - curbHeight - 6);
      ctx.restore();

      // ── 4. The Wall / Impact Barrier ────────────────────────────────────
      const wallX = trackRight;
      const wallY = roadTop - 12;
      const wallH = roadHeight + 24;

      // Barrier shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(wallX + wallWidth, wallY + 4, 8, wallH);

      // Yellow & black hazard stripes
      ctx.save();
      ctx.fillStyle = '#EAB308';
      ctx.fillRect(wallX, wallY, wallWidth, wallH);

      ctx.fillStyle = '#18181B';
      const stripeW = 8;
      for (let y = wallY - wallWidth; y < wallY + wallH; y += stripeW * 2) {
        ctx.beginPath();
        ctx.moveTo(wallX, y);
        ctx.lineTo(wallX + wallWidth, y + wallWidth);
        ctx.lineTo(wallX + wallWidth, y + wallWidth + stripeW);
        ctx.lineTo(wallX, y + stripeW);
        ctx.closePath();
        ctx.fill();
      }

      // Barrier frame border
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.strokeRect(wallX, wallY, wallWidth, wallH);

      // Flashing warning beacon on top of the barrier
      const blink = Math.sin(Date.now() / 150) > 0;
      ctx.fillStyle = blink ? '#EF4444' : '#7F1D1D';
      ctx.beginPath();
      ctx.arc(wallX + wallWidth / 2, wallY - 6, 5, 0, Math.PI * 2);
      ctx.fill();
      if (blink) {
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#FCA5A5';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.restore();

      // ── 5. LIDAR / Radar Sensor Ray ─────────────────────────────────────
      if (carFrontX < wallX && telemetry?.outcome !== 'CRASH') {
        const radarDist = Math.max(0, currentDist);
        const rayEndX = wallX;
        const rayY = carY + carWidth / 2;

        let rayColor = '#10B981'; // Green: Safe (> 25m)
        let rayAlpha = 0.5;
        if (radarDist <= 10.0) {
          rayColor = '#EF4444'; // Red: Collision Danger (< 10m)
          rayAlpha = 0.85;
        } else if (radarDist <= 25.0) {
          rayColor = '#F59E0B'; // Amber: Caution (10 - 25m)
          rayAlpha = 0.65;
        }

        ctx.save();
        // Radar Cone / Beam
        const grad = ctx.createLinearGradient(carFrontX, rayY, rayEndX, rayY);
        grad.addColorStop(0, rayColor);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.9)');

        ctx.strokeStyle = grad;
        ctx.lineWidth = radarDist <= 10.0 ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(carFrontX, rayY);
        ctx.lineTo(rayEndX, rayY);
        ctx.stroke();

        // Pulsing radar ripple waves
        const ripplePhase = (Date.now() / 15) % 40;
        for (let r = ripplePhase; r < (rayEndX - carFrontX); r += 40) {
          ctx.strokeStyle = rayColor;
          ctx.lineWidth = 1.2;
          ctx.globalAlpha = Math.max(0, 1 - r / (rayEndX - carFrontX));
          ctx.beginPath();
          ctx.arc(carFrontX + r, rayY, 6 + (r / (rayEndX - carFrontX)) * 14, -Math.PI / 3, Math.PI / 3);
          ctx.stroke();
        }

        // Radar Distance Floating Badge
        ctx.globalAlpha = 1.0;
        const badgeX = Math.min(rayEndX - 40, (carFrontX + rayEndX) / 2);
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        safeRoundRect(ctx, badgeX - 28, rayY - 26, 56, 18, 4);
        ctx.fill();
        ctx.strokeStyle = rayColor;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${radarDist.toFixed(1)}m`, badgeX, rayY - 14);

        ctx.restore();
      }

      // ── 6. Exhaust Particles / Boost & Brake Smoke ───────────────────────
      if (action === 1 && currentVel > 0.5) {
        // Accelerate particles (cyan & lime nitrous sparks)
        particlesRef.current.push({
          x: (carRearX + 2) / width,
          y: (carY + carWidth / 2 + (Math.random() - 0.5) * 8) / height,
          vx: -(Math.random() * 4 + 2),
          vy: (Math.random() - 0.5) * 1.5,
          color: Math.random() > 0.5 ? '#06B6D4' : '#10B981',
          radius: Math.random() * 3 + 1.5,
          life: 0.9,
          decay: 0.04
        });
      } else if (action === 0 && currentVel > 1.0) {
        // Heavy braking tire smoke
        particlesRef.current.push({
          x: (carRearX + 10) / width,
          y: (carY + carWidth - 2) / height,
          vx: -(Math.random() * 2 + 1),
          vy: (Math.random() - 0.5) * 1,
          color: '#E2E8F0',
          radius: Math.random() * 4 + 2,
          life: 0.8,
          decay: 0.035
        });
        particlesRef.current.push({
          x: (carRearX + 10) / width,
          y: (carY + 2) / height,
          vx: -(Math.random() * 2 + 1),
          vy: (Math.random() - 0.5) * 1,
          color: '#E2E8F0',
          radius: Math.random() * 4 + 2,
          life: 0.8,
          decay: 0.035
        });
      }

      // Update & render active particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += (p.vx / width);
        p.y += (p.vy / height);
        p.life -= p.decay;

        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, p.radius * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // ── 7. Render 2D Sports Car ──────────────────────────────────────────
      ctx.save();

      // Car shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      safeRoundRect(ctx, carRearX + 4, carY + 4, carLength, carWidth, 8);
      ctx.fill();

      // Car Wheels (4 black rubber tires)
      ctx.fillStyle = '#0F172A';
      // Rear Left
      ctx.fillRect(carRearX + 10, carY - 3, 14, 5);
      // Rear Right
      ctx.fillRect(carRearX + 10, carY + carWidth - 2, 14, 5);
      // Front Left
      ctx.fillRect(carFrontX - 22, carY - 3, 14, 5);
      // Front Right
      ctx.fillRect(carFrontX - 22, carY + carWidth - 2, 14, 5);

      // Car Chassis Body (Modern aero gradient)
      const bodyGrad = ctx.createLinearGradient(carRearX, carY, carFrontX, carY);
      bodyGrad.addColorStop(0, '#3B82F6'); // Indigo / Blue metallic
      bodyGrad.addColorStop(0.5, '#2563EB');
      bodyGrad.addColorStop(1, '#1D4ED8');

      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      // Aerodynamic car contour
      safeRoundRect(ctx, carRearX, carY, carLength, carWidth, 8);
      ctx.fill();

      // Sleek side body contour lines
      ctx.strokeStyle = '#60A5FA';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(carRearX + 6, carY + 4);
      ctx.lineTo(carFrontX - 10, carY + 4);
      ctx.moveTo(carRearX + 6, carY + carWidth - 4);
      ctx.lineTo(carFrontX - 10, carY + carWidth - 4);
      ctx.stroke();

      // Cockpit / Windshield (Tinted glass)
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      safeRoundRect(ctx, carRearX + 22, carY + 5, 24, carWidth - 10, 4);
      ctx.fill();

      // Glass reflection highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.moveTo(carRearX + 24, carY + 7);
      ctx.lineTo(carRearX + 38, carY + 7);
      ctx.lineTo(carRearX + 34, carY + carWidth - 7);
      ctx.lineTo(carRearX + 24, carY + carWidth - 7);
      ctx.closePath();
      ctx.fill();

      // Dynamic Headlights Beam
      ctx.save();
      const headGrad = ctx.createLinearGradient(carFrontX, carY, carFrontX + 50, carY);
      headGrad.addColorStop(0, 'rgba(254, 240, 138, 0.55)');
      headGrad.addColorStop(1, 'rgba(254, 240, 138, 0.0)');
      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.moveTo(carFrontX, carY + 3);
      ctx.lineTo(carFrontX + 50, carY - 8);
      ctx.lineTo(carFrontX + 50, carY + carWidth + 8);
      ctx.lineTo(carFrontX, carY + carWidth - 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Dynamic Tail Brake Lights
      const isBraking = action === 0;
      ctx.save();
      if (isBraking) {
        // Glowing hot red brake lights flare!
        ctx.shadowColor = '#F43F5E';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#FF1744';
        ctx.fillRect(carRearX - 2, carY + 2, 4, 7);
        ctx.fillRect(carRearX - 2, carY + carWidth - 9, 4, 7);

        // Rear brake halo glow
        ctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
        ctx.beginPath();
        ctx.arc(carRearX - 4, carY + carWidth / 2, 18, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Normal dim tail lights
        ctx.fillStyle = '#991B1B';
        ctx.fillRect(carRearX, carY + 3, 3, 5);
        ctx.fillRect(carRearX, carY + carWidth - 8, 3, 5);
      }
      ctx.restore();

      // Car AI Roof Radar Beacon
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.arc(carRearX + carLength / 2, carY + carWidth / 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();

      // ── 8. Outcome Overlay Banner ────────────────────────────────────────
      if (telemetry?.outcome && telemetry.outcome !== 'RUNNING') {
        const out = telemetry.outcome;
        let bannerBg = 'rgba(16, 185, 129, 0.92)';
        let bannerBorder = '#059669';
        let bannerText = '✓ SAFE STOP ACHIEVED!';
        let subText = `Stopped precisely at ${currentDist.toFixed(2)}m from the wall`;

        if (out === 'CRASH') {
          bannerBg = 'rgba(239, 68, 68, 0.95)';
          bannerBorder = '#B91C1C';
          bannerText = '💥 COLLISION WITH BARRIER!';
          subText = `Impact velocity: ${(currentVel * 3.6).toFixed(1)} km/h`;
        } else if (out === 'STALLED') {
          bannerBg = 'rgba(245, 158, 11, 0.92)';
          bannerBorder = '#D97706';
          bannerText = '⚠️ STOPPED TOO EARLY (STALLED)';
          subText = `Stopped ${currentDist.toFixed(2)}m away - safe zone is 1.0m to 4.0m`;
        } else if (out === 'TIMEOUT') {
          bannerBg = 'rgba(100, 116, 139, 0.92)';
          bannerBorder = '#475569';
          bannerText = '⏱️ STEP TIMEOUT REACHED';
          subText = 'Episode limit reached before stopping';
        }

        ctx.save();
        const bannerW = 340;
        const bannerH = 54;
        const bX = width / 2 - bannerW / 2;
        const bY = 16;

        ctx.fillStyle = bannerBg;
        ctx.beginPath();
        safeRoundRect(ctx, bX, bY, bannerW, bannerH, 12);
        ctx.fill();
        ctx.strokeStyle = bannerBorder;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(bannerText, width / 2, bY + 22);

        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(subText, width / 2, bY + 42);
        ctx.restore();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [telemetry, config]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      {/* Top Track Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2 font-medium text-slate-700">
          <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-emerald-100"></span>
          <span className="font-semibold text-slate-900">2D Physics Telemetry Track</span>
          <span className="rounded bg-slate-200/70 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
            {config?.track_length || 100}m Total Length
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-500"></span>
            <span className="text-slate-500">Wall Barrier: 0.0m</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
            <span className="text-slate-500">Safe Target: 1.0m – 4.0m</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-slate-500">
            <span>Mode:</span>
            <span className="font-semibold uppercase text-indigo-600">{mode}</span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={960}
        height={260}
        className="w-full bg-slate-900/5 block"
        style={{ height: '260px' }}
      />
    </div>
  );
}
