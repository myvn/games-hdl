import { useRef } from 'react';
import type { InputState } from '../game/types';

interface Props {
  input: React.RefObject<InputState>;
  onAny?: () => void;
  onSwitchWeapon?: () => void;
}

export default function TouchControls({ input, onAny, onSwitchWeapon }: Props) {
  const padRef = useRef<HTMLDivElement>(null);
  const activeId = useRef<number | null>(null);

  const clearDir = () => {
    const i = input.current;
    i.left = i.right = i.up = i.down = false;
  };

  const applyDir = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = clientX - (r.left + r.width / 2);
    const dy = clientY - (r.top + r.height / 2);
    const dist = Math.hypot(dx, dy);
    const i = input.current;
    if (dist < r.width * 0.16) {
      clearDir();
      return;
    }
    const a = Math.atan2(dy, dx);
    const deg = ((a * 180) / Math.PI + 360) % 360;
    i.right = deg < 67.5 || deg > 292.5;
    i.left = deg > 112.5 && deg < 247.5;
    i.up = deg > 202.5 && deg < 337.5;
    i.down = deg > 22.5 && deg < 157.5;
  };

  const padDown = (e: React.PointerEvent) => {
    e.preventDefault();
    onAny?.();
    activeId.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    applyDir(e.clientX, e.clientY);
  };
  const padMove = (e: React.PointerEvent) => {
    if (activeId.current !== e.pointerId) return;
    e.preventDefault();
    applyDir(e.clientX, e.clientY);
  };
  const padUp = (e: React.PointerEvent) => {
    if (activeId.current !== e.pointerId) return;
    activeId.current = null;
    clearDir();
  };

  const btn = (key: 'fire' | 'jump' | 'guard', label: string, sub: string, cls: string) => (
    <button
      className={`select-none touch-none rounded-full border-2 font-black tracking-tight shadow-lg active:scale-95 active:brightness-125 transition-transform ${cls}`}
      onPointerDown={(e) => {
        e.preventDefault();
        onAny?.();
        input.current[key] = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerUp={() => { input.current[key] = false; }}
      onPointerCancel={() => { input.current[key] = false; }}
      onPointerLeave={() => { input.current[key] = false; }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="block text-lg leading-none">{label}</span>
      <span className="block text-[9px] font-bold opacity-70">{sub}</span>
    </button>
  );

  return (
    <div className="mt-4 flex w-full items-center justify-between gap-2 px-1 md:hidden">
      <div
        ref={padRef}
        onPointerDown={padDown}
        onPointerMove={padMove}
        onPointerUp={padUp}
        onPointerCancel={padUp}
        onContextMenu={(e) => e.preventDefault()}
        className="relative h-34 w-34 touch-none select-none rounded-full border-2 border-white/15 bg-gradient-to-b from-slate-800/80 to-slate-900/90 shadow-[inset_0_2px_12px_rgba(0,0,0,0.6)]"
      >
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-10 w-10 rounded-full border border-white/20 bg-white/5" />
        </div>
        <span className="pointer-events-none absolute left-1/2 top-1.5 -translate-x-1/2 text-xs text-white/50">▲</span>
        <span className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 text-xs text-white/50">▼</span>
        <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-white/50">◀</span>
        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-white/50">▶</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Quick weapon switch button for mobile */}
        <button
          className="h-[52px] w-[52px] select-none touch-none rounded-full border-2 border-fuchsia-300/40 bg-gradient-to-b from-fuchsia-500 to-purple-800 font-black tracking-tight text-white shadow-lg active:scale-95 active:brightness-125 transition-transform"
          onPointerDown={(e) => {
            e.preventDefault();
            onAny?.();
            onSwitchWeapon?.();
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className="block text-base leading-none">Q</span>
          <span className="block text-[8px] font-bold opacity-80">切枪</span>
        </button>
        {btn('guard', 'L', '盾/刀', 'h-[54px] w-[54px] border-cyan-300/40 bg-gradient-to-b from-cyan-500 to-blue-700 text-white')}
        {btn('fire', 'B', '射击', 'h-[62px] w-[62px] border-amber-300/40 bg-gradient-to-b from-amber-500 to-orange-700 text-white')}
        {btn('jump', 'A', '跳跃', 'h-[62px] w-[62px] border-sky-300/40 bg-gradient-to-b from-sky-500 to-indigo-700 text-white')}
      </div>
    </div>
  );
}
