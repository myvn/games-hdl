import { useCallback, useEffect, useRef, useState } from 'react';
import TouchControls from './components/TouchControls';
import { isMuted, setMuted, sfx, unlockAudio } from './game/audio';
import { Game, WEAPON_CYCLE, WEAPON_NAMES } from './game/game';
import { STAGES } from './game/level';
import { VIEW_H, VIEW_W, emptyInput } from './game/types';
import type { HudSnapshot } from './game/types';

const SCALE = 2;

const KEYMAP: Record<string, keyof ReturnType<typeof emptyInput>> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  KeyJ: 'fire', KeyZ: 'fire', Space: 'fire',
  KeyK: 'jump', KeyX: 'jump', ShiftLeft: 'jump', ShiftRight: 'jump',
  KeyL: 'guard', KeyC: 'guard',
};

const BOSS_ICON: Record<string, string> = {
  fortress: '🏰', tank: '🚜', heli: '🚁', mech: '🤖', spider: '🕷️',
  golem: '🗿', twins: '☯️', gunship: '🛸', train: '🚂', heart: '👾',
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const inputRef = useRef(emptyInput());
  const pausedRef = useRef(false);

  const [hud, setHud] = useState<HudSnapshot>({
    phase: 'title',
    score: 0,
    lives: 99,
    weapon: 'S',
    stage: 1,
    stageName: '第一关 · 丛林前哨',
  });
  const [paused, setPaused] = useState(false);
  const [muted, setMutedState] = useState(false);

  const start = useCallback(() => {
    unlockAudio();
    sfx.start();
    pausedRef.current = false;
    setPaused(false);
    gameRef.current?.reset();
  }, []);

  const switchWeapon = useCallback(() => {
    unlockAudio();
    gameRef.current?.cycleWeapon();
  }, []);

  const selectStage = useCallback((stageIdx: number) => {
    unlockAudio();
    sfx.start();
    pausedRef.current = false;
    setPaused(false);
    const g = gameRef.current;
    if (!g) return;
    g.loadStage(stageIdx, false);
    g.phase = 'playing';
    g.pushHud();
  }, []);

  const togglePause = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.phase !== 'playing') return;
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  }, []);

  // ---- 游戏主循环 ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = VIEW_W * SCALE;
    canvas.height = VIEW_H * SCALE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const game = new Game();
    game.onHud = (h) => setHud({ ...h });
    gameRef.current = game;

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const STEP = 1 / 60;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25;
      acc += dt;
      let guard = 0;
      while (acc >= STEP && guard++ < 5) {
        if (!pausedRef.current) game.update(inputRef.current);
        acc -= STEP;
      }
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      game.draw(ctx);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---- 键盘 ----
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) {
        if (KEYMAP[e.code]) e.preventDefault();
        return;
      }
      const g = gameRef.current;
      if (e.code === 'KeyQ') {
        unlockAudio();
        g?.cycleWeapon();
        e.preventDefault();
        return;
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        togglePause();
        e.preventDefault();
        return;
      }
      if (e.code === 'KeyM') {
        const m = !isMuted();
        setMuted(m);
        setMutedState(m);
        return;
      }
      if ((e.code === 'Enter' || e.code === 'Space') && g && g.phase !== 'playing') {
        if (g.phase === 'title' || g.endTimer > 40) start();
        e.preventDefault();
      }
      const k = KEYMAP[e.code];
      if (k) {
        inputRef.current[k] = true;
        unlockAudio();
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = KEYMAP[e.code];
      if (k) {
        inputRef.current[k] = false;
        e.preventDefault();
      }
    };
    const blur = () => {
      const i = inputRef.current;
      i.left = i.right = i.up = i.down = i.fire = i.jump = i.guard = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [start, togglePause]);

  const overlay = hud.phase !== 'playing' || paused;

  return (
    <div className="relative min-h-screen w-full select-none overflow-x-hidden bg-[#05060e] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(255,110,60,0.20),transparent_55%),radial-gradient(ellipse_at_80%_110%,rgba(60,90,255,0.18),transparent_50%)]" />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
          backgroundSize: '38px 38px',
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1000px] flex-col items-center px-3 py-4 md:py-6">
        {/* 标题栏 */}
        <header className="mb-2 flex w-full items-end justify-between gap-3">
          <div className="leading-none">
            <h1
              className="font-mono text-2xl font-black tracking-[0.18em] text-transparent md:text-4xl [-webkit-text-stroke:1px_rgba(255,255,255,0.18)]"
              style={{
                backgroundImage: 'linear-gradient(180deg,#ffe066 0%,#ff8a3c 55%,#e0342a 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
              }}
            >
              魂斗罗
            </h1>
            <p className="mt-1 text-[10px] tracking-[0.3em] text-amber-200/70 md:text-xs">
              十关全程 · 十大首领 · 无限生命
            </p>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <button
              onClick={switchWeapon}
              className="rounded-md border border-fuchsia-400/40 bg-fuchsia-500/20 px-2.5 py-1.5 text-[11px] font-bold text-fuchsia-200 transition hover:bg-fuchsia-500/30 active:scale-95"
              title="按 Q 键切换武器"
            >
              🔫 切枪 (Q)
            </button>
            <button
              onClick={() => {
                const m = !isMuted();
                setMuted(m);
                setMutedState(m);
              }}
              className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] text-white/70 transition hover:bg-white/10"
            >
              {muted ? '🔇 静音' : '🔊 音效'}
            </button>
            <button
              onClick={togglePause}
              className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] text-white/70 transition hover:bg-white/10"
            >
              ⏸ 暂停
            </button>
          </div>
        </header>

        {/* 关卡选择条 */}
        <div className="mb-2 w-full rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-xs">
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[10px] font-bold tracking-widest text-amber-300">选关</span>
            {STAGES.map((stg, idx) => {
              const active = hud.stage === stg.id && hud.phase === 'playing';
              return (
                <button
                  key={stg.id}
                  onClick={() => selectStage(idx)}
                  title={`${stg.name} ${stg.sub} · 首领：${stg.bossName}`}
                  className={`rounded px-1.5 py-0.5 text-[11px] font-bold transition ${
                    active
                      ? 'border border-amber-300/80 bg-amber-400 text-black shadow'
                      : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/15'
                  }`}
                >
                  {BOSS_ICON[stg.boss]} {stg.id}·{stg.sub}
                </button>
              );
            })}
          </div>
        </div>

        {/* 画面 */}
        <div className="relative w-full rounded-xl border border-white/10 bg-black p-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_60px_-20px_rgba(255,120,50,0.45)] md:p-2">
          <div className="relative overflow-hidden rounded-lg">
            <canvas
              ref={canvasRef}
              className="block h-auto w-full touch-none select-none bg-[#120c2c]"
              style={{ imageRendering: 'pixelated', aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
            />

            {overlay && (
              <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-black/65 px-4 backdrop-blur-[2px]">
                {paused && hud.phase === 'playing' && (
                  <div className="text-center">
                    <p className="text-2xl font-black tracking-[0.3em] text-amber-300">游戏暂停</p>
                    <button
                      onClick={togglePause}
                      className="mt-4 rounded-md bg-amber-400 px-5 py-2 text-sm font-bold text-black hover:bg-amber-300"
                    >
                      继续游戏 (P)
                    </button>
                  </div>
                )}

                {hud.phase === 'title' && (
                  <div className="max-w-lg py-3 text-center">
                    <p className="text-[10px] tracking-[0.4em] text-sky-300/80">一九八七 · 街机风格</p>
                    <h2
                      className="mt-1 text-4xl font-black tracking-[0.2em] text-transparent md:text-5xl"
                      style={{
                        backgroundImage: 'linear-gradient(180deg,#fff 0%,#ffd24a 40%,#e33b30 100%)',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                      }}
                    >
                      魂斗罗
                    </h2>
                    <p className="mt-1 text-xs text-white/70">十道防线 · 每关一位独一无二的首领</p>
                    <p className="mt-1 text-[11px] text-amber-300/90">按 Q 键自由切换 5 种武器 · L 键举盾出刀 · 可二段跳</p>
                    <button
                      onClick={start}
                      className="mt-4 animate-pulse rounded-md border-2 border-amber-300/60 bg-gradient-to-b from-amber-400 to-orange-600 px-8 py-2.5 text-base font-black tracking-widest text-black shadow-lg shadow-orange-900/50 hover:brightness-110"
                    >
                      开始游戏 ▶
                    </button>
                    <div className="mt-3 grid grid-cols-2 gap-1 text-[10px] sm:grid-cols-5">
                      {STAGES.map((stg, idx) => (
                        <button
                          key={stg.id}
                          onClick={() => selectStage(idx)}
                          className="rounded border border-white/15 bg-white/10 px-1.5 py-1 font-bold hover:bg-white/20"
                        >
                          {BOSS_ICON[stg.boss]} {stg.name}
                          <span className="block font-normal text-white/60">{stg.sub}</span>
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-white/45">按 回车 / 空格 开始</p>
                  </div>
                )}

                {hud.phase === 'gameover' && (
                  <div className="text-center">
                    <h2 className="text-4xl font-black tracking-[0.15em] text-red-500 drop-shadow-[0_2px_0_rgba(0,0,0,0.6)]">
                      游戏结束
                    </h2>
                    <p className="mt-2 text-sm text-white/80">
                      最终得分 <span className="text-amber-300">{hud.score}</span>
                    </p>
                    <button
                      onClick={start}
                      className="mt-5 rounded-md border-2 border-white/30 bg-white/10 px-6 py-2 text-sm font-bold tracking-widest hover:bg-white/20"
                    >
                      再来一次 (回车)
                    </button>
                  </div>
                )}

                {hud.phase === 'win' && (
                  <div className="max-w-md text-center">
                    <p className="text-xs tracking-widest text-emerald-300">十关全部通关！</p>
                    <h2
                      className="mt-1 text-4xl font-black tracking-[0.2em] text-transparent"
                      style={{
                        backgroundImage: 'linear-gradient(180deg,#fff 0%,#7CF77C 60%,#17a34a 100%)',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                      }}
                    >
                      任务完成
                    </h2>
                    <p className="mt-2 text-sm text-white/80">
                      异形心脏已被摧毁，地球得救了！最终得分{' '}
                      <span className="font-bold text-amber-300">{hud.score}</span>
                    </p>
                    <button
                      onClick={start}
                      className="mt-5 rounded-md border-2 border-emerald-300/50 bg-emerald-500/20 px-6 py-2.5 text-sm font-bold tracking-widest hover:bg-emerald-500/30"
                    >
                      重新通关 (回车)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <TouchControls input={inputRef} onAny={unlockAudio} onSwitchWeapon={switchWeapon} />

        {/* 武器栏 */}
        <div className="mt-3 flex w-full flex-wrap items-center justify-between gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] p-2 text-xs">
          <span className="text-[11px] font-bold text-amber-300">武器库（Q 键轮换）</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {WEAPON_CYCLE.map((w) => {
              const active = hud.weapon === w;
              return (
                <button
                  key={w}
                  onClick={() => gameRef.current?.setWeapon(w)}
                  className={`rounded border px-2 py-0.5 text-[10px] font-bold transition ${
                    active
                      ? 'border-amber-300 bg-amber-400 text-black shadow'
                      : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/15'
                  }`}
                >
                  {w} {WEAPON_NAMES[w]}
                </button>
              );
            })}
          </div>
        </div>

        {/* 帮助 */}
        <div className="mt-3 grid w-full grid-cols-2 gap-2 text-[11px] text-white/60 md:grid-cols-4">
          <Card title="移动 / 瞄准" body="← → 移动，↑ 上射，↓ 卧倒，空中 ↓ 下射，↓+跳 穿越吊桥" />
          <Card title="射击 / 跳跃" body="J / Z / 空格 射击；K / X / Shift 跳跃，空中可再跳一次" />
          <Card title="护盾 · 近战刀" body="按住 L / C 举盾格挡子弹，敌人贴身时自动出刀斩杀" />
          <Card title="武器切换" body="Q 键轮换：散弹枪 → 追踪导弹 → 重机枪 → 激光炮 → 突击步枪" />
        </div>

        {/* 首领图鉴 */}
        <div className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.02] p-2">
          <p className="mb-1.5 text-[11px] font-bold text-amber-300">首领图鉴</p>
          <div className="grid grid-cols-2 gap-1 text-[10px] text-white/60 sm:grid-cols-5">
            {STAGES.map((stg) => (
              <div key={stg.id} className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-1">
                <span className="text-white/90">{BOSS_ICON[stg.boss]} {stg.bossName}</span>
                <span className="block text-white/40">{stg.name} · {stg.sub}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-3 pb-2 text-center text-[10px] text-white/30">
          Q 切枪 · P 暂停 · M 静音 · L 举盾出刀 · 二段跳 · 致敬 KONAMI 1987《魂斗罗》
        </p>
      </div>
    </div>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
      <p className="mb-1 text-[10px] font-bold tracking-widest text-amber-300/80">{title}</p>
      <p className="leading-snug text-white/55">{body}</p>
    </div>
  );
}
