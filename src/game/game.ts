import { sfx } from './audio';
import { bossTargets, bossWallX, damageBossAt, drawBoss, makeBoss, updateBoss } from './boss';
import { LEVEL_W, STAGES } from './level';
import type { StageData } from './level';
import * as S from './sprites';
import {
  GRAVITY, JUMP_V, MAX_FALL, RUN_SPEED, VIEW_H, VIEW_W, clamp, emptyInput, overlap,
} from './types';
import type {
  Boss, Bullet, Enemy, HudSnapshot, InputState, Item, Particle, Phase, Player, WeaponKind,
} from './types';

const CAM_MAX = LEVEL_W - VIEW_W;

export const WEAPON_CYCLE: WeaponKind[] = ['S', 'H', 'M', 'L', 'N'];

export const WEAPON_NAMES: Record<WeaponKind, string> = {
  S: '散弹枪',
  H: '追踪导弹',
  M: '重机枪',
  L: '激光炮',
  N: '突击步枪',
};

const WEAPON: Record<WeaponKind, { cd: number; speed: number; r: number; dmg: number; pierce?: boolean }> = {
  N: { cd: 4, speed: 7.4, r: 2.4, dmg: 1, pierce: true },
  M: { cd: 2, speed: 8.4, r: 2.2, dmg: 1, pierce: true },
  S: { cd: 6, speed: 7.2, r: 3, dmg: 1, pierce: true },
  L: { cd: 7, speed: 10.6, r: 2.6, dmg: 3, pierce: true },
  H: { cd: 17, speed: 4.6, r: 3.6, dmg: 3, pierce: false },
};

export const INFINITE_LIVES = true;
const BULLET_LIFE = 260;
const MELEE_RANGE = 20;
const GUARD_SLOW = 0.55;

const SCORE: Record<string, number> = { runner: 100, gunner: 200, turret: 500, flyer: 300, pod: 150 };

export class Game {
  phase: Phase = 'title';
  stageIndex = 0;
  t = 0;
  frame = 0;
  camX = 0;
  camTarget = 0;
  shake = 0;
  score = 0;
  lives = INFINITE_LIVES ? 99 : 3;
  player: Player = this.makePlayer(60, 204);
  bullets: Bullet[] = [];
  ebullets: Bullet[] = [];
  enemies: Enemy[] = [];
  items: Item[] = [];
  parts: Particle[] = [];
  spawned = new Set<number>();
  boss: Boss | null = null;
  respawnTimer = 0;
  endTimer = 0;
  msg: string | null = null;
  msgT = 0;
  warnFlash = 0;
  lastGuardInput = false;
  stageClearTimer = 0;
  onHud: (h: HudSnapshot) => void = () => {};

  constructor() {
    this.player.invuln = 0;
  }

  get currentStage(): StageData {
    return STAGES[this.stageIndex] ?? STAGES[0];
  }

  solidAt(x: number, y: number): boolean {
    for (const p of this.currentStage.platforms) {
      if (p.oneway) continue;
      if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return true;
    }
    return false;
  }

  groundAt(x: number, y: number): boolean {
    for (const p of this.currentStage.platforms) {
      if (x >= p.x && x <= p.x + p.w && y >= p.y - 2 && y <= p.y + Math.max(6, p.h)) return true;
    }
    return false;
  }

  makePlayer(x: number, y: number, keepWeapon?: WeaponKind): Player {
    return {
      x, y, w: 12, h: 24, vx: 0, vy: 0, facing: 1,
      onGround: true, prone: false, alive: true, invuln: 110, fireCd: 0,
      weapon: keepWeapon ?? 'S', anim: 0, aimX: 1, aimY: 0, shootFlash: 0, dropThrough: 0,
      barrier: 0, jumpLatch: false, fireLatch: false, lastSafeX: x,
      airJumps: 1, guard: false, knifeCd: 0, knifeFlash: 0,
    };
  }

  cycleWeapon() {
    if (this.phase !== 'playing' || !this.player.alive) return;
    const idx = WEAPON_CYCLE.indexOf(this.player.weapon);
    this.setWeapon(WEAPON_CYCLE[(idx + 1) % WEAPON_CYCLE.length]);
  }

  setWeapon(w: WeaponKind) {
    if (this.phase !== 'playing') return;
    this.player.weapon = w;
    sfx.power();
    this.setMsg(`切换武器：${WEAPON_NAMES[w]}`, 70);
    this.pushHud();
  }

  reset() {
    this.stageIndex = 0;
    this.score = 0;
    this.lives = INFINITE_LIVES ? 99 : 3;
    this.loadStage(0, false);
    this.phase = 'playing';
    this.pushHud();
  }

  loadStage(idx: number, keepScore = true) {
    this.stageIndex = Math.max(0, Math.min(STAGES.length - 1, idx));
    const stg = this.currentStage;
    this.t = 0;
    this.frame = 0;
    this.camX = 0;
    this.camTarget = 0;
    this.shake = 0;
    if (!keepScore) this.score = 0;
    const prevW = this.player?.weapon ?? 'S';
    this.player = this.makePlayer(60, 190, prevW);
    this.bullets = [];
    this.ebullets = [];
    this.enemies = [];
    this.items = [];
    this.parts = [];
    this.spawned = new Set();
    this.boss = null;
    this.respawnTimer = 0;
    this.endTimer = 0;
    this.warnFlash = 0;
    this.stageClearTimer = 0;
    this.setMsg(`${stg.name}  ${stg.sub}`, 140);
    this.pushHud();
  }

  onBossDefeated() {
    this.score += 10000;
    if (this.stageIndex < STAGES.length - 1) {
      this.stageClearTimer = 180;
      this.setMsg(`${this.currentStage.name} 突破！`, 180);
      sfx.win();
    } else {
      this.phase = 'win';
      this.endTimer = 0;
      sfx.win();
      this.pushHud();
    }
  }

  setMsg(m: string, frames: number) {
    this.msg = m;
    this.msgT = frames;
  }

  pushHud() {
    const stg = this.currentStage;
    this.onHud({
      phase: this.phase,
      score: this.score,
      lives: this.lives,
      weapon: this.player.weapon,
      stage: stg.id,
      stageName: `${stg.name} · ${stg.sub}`,
    });
  }

  /* ---------------- physics helpers ---------------- */

  private moveX(e: { x: number; y: number; w: number; h: number; vx: number }, dx: number) {
    e.x += dx;
    for (const p of this.currentStage.platforms) {
      if (p.oneway) continue;
      if (overlap(e.x, e.y, e.w, e.h, p.x, p.y, p.w, p.h)) {
        if (dx > 0) e.x = p.x - e.w;
        else if (dx < 0) e.x = p.x + p.w;
        e.vx = 0;
      }
    }
  }

  private moveY(
    e: { x: number; y: number; w: number; h: number; vy: number; onGround: boolean },
    dy: number,
    oneway = true,
  ) {
    const prevBottom = e.y + e.h;
    e.y += dy;
    e.onGround = false;
    for (const p of this.currentStage.platforms) {
      if (!overlap(e.x, e.y, e.w, e.h, p.x, p.y, p.w, p.h)) continue;
      if (p.oneway) {
        if (dy >= 0 && oneway && prevBottom <= p.y + 3) {
          e.y = p.y - e.h;
          e.vy = 0;
          e.onGround = true;
        }
      } else if (dy > 0) {
        e.y = p.y - e.h;
        e.vy = 0;
        e.onGround = true;
      } else if (dy < 0) {
        e.y = p.y + p.h;
        e.vy = 0;
      }
    }
  }

  /* ---------------- fx ---------------- */

  burst(x: number, y: number, n: number, colors: string[], spd = 3, grav = 0.12, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = spd * (0.35 + Math.random() * 0.9);
      this.parts.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 0.6,
        life: 18 + Math.random() * 22,
        max: 40,
        size: size * (0.5 + Math.random()),
        color: colors[(Math.random() * colors.length) | 0],
        grav,
      });
    }
  }

  explosion(x: number, y: number, big = false) {
    this.burst(x, y, big ? 34 : 16, ['#fff3b0', '#ffb43c', '#ff6a2a', '#e03020'], big ? 4.4 : 2.8, 0.1, big ? 4 : 3);
    this.burst(x, y, big ? 12 : 6, ['#6b6b74', '#3a3a44'], big ? 2 : 1.3, -0.03, big ? 5 : 3);
    this.shake = Math.max(this.shake, big ? 9 : 4);
    sfx.explode(big);
  }

  /* ---------------- shooting ---------------- */

  private nearestTarget(x: number, y: number, range: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestD = range * range;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
      const d = (ex - x) ** 2 + (ey - y) ** 2;
      if (d < bestD) { bestD = d; best = { x: ex, y: ey }; }
    }
    if (this.boss) {
      for (const t of bossTargets(this.boss)) {
        const d = (t.x - x) ** 2 + (t.y - y) ** 2;
        if (d < bestD) { bestD = d; best = t; }
      }
    }
    return best;
  }

  private firePlayer() {
    const p = this.player;
    const cfg = WEAPON[p.weapon];
    let mx: number, my: number;
    const cx = p.x + p.w / 2;
    if (p.prone) {
      mx = cx + p.facing * 20;
      my = p.y + 8;
    } else if (!p.onGround) {
      mx = cx + p.aimX * 10;
      my = p.y + 12 + p.aimY * 10;
    } else {
      mx = cx + p.aimX * 15 + p.facing * 2;
      my = p.y + 11 + p.aimY * 13;
    }
    const base = Math.atan2(p.aimY, p.aimX);

    if (p.weapon === 'H') {
      const tgt = this.nearestTarget(mx, my, 320);
      const a = tgt ? Math.atan2(tgt.y - my, tgt.x - mx) : base;
      this.bullets.push({
        x: mx, y: my,
        vx: Math.cos(a) * cfg.speed,
        vy: Math.sin(a) * cfg.speed,
        r: cfg.r, dmg: cfg.dmg, life: BULLET_LIFE + 60, pierce: false, kind: 'H',
      });
      sfx.missileLaunch();
      if (tgt) sfx.lock();
    } else {
      const perp = base + Math.PI / 2;
      const px2 = Math.cos(perp), py2 = Math.sin(perp);
      let offsets: { spread: number; along: number }[];
      if (p.weapon === 'S') {
        offsets = [-0.34, -0.17, 0, 0.17, 0.34, -0.5, 0.5].map((s) => ({ spread: s, along: 0 }));
      } else if (p.weapon === 'M') {
        offsets = [-3, 0, 3].map((al) => ({ spread: 0, along: al }));
      } else if (p.weapon === 'N') {
        offsets = [-2.4, 2.4].map((al) => ({ spread: 0, along: al }));
      } else {
        offsets = [-2.6, 2.6].map((al) => ({ spread: 0, along: al }));
      }
      for (const o of offsets) {
        const a = base + o.spread;
        this.bullets.push({
          x: mx + px2 * o.along, y: my + py2 * o.along,
          vx: Math.cos(a) * cfg.speed,
          vy: Math.sin(a) * cfg.speed,
          r: cfg.r, dmg: cfg.dmg, life: BULLET_LIFE, pierce: cfg.pierce, kind: p.weapon,
        });
      }
      sfx.shoot(p.weapon);
    }
    p.shootFlash = 4;
    p.fireCd = cfg.cd;
    this.burst(mx, my, 2, ['#fff6c0', '#ffbb44'], 1.2, 0.02, 2);
  }

  enemyShot(x: number, y: number, speed: number, spread = 0, kind: 'enemy' | 'boss' = 'enemy') {
    const p = this.player;
    const a = Math.atan2(p.y + p.h / 2 - y, p.x + p.w / 2 - x) + spread;
    this.ebullets.push({
      x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      r: kind === 'boss' ? 4 : 3, dmg: 1, life: 320, kind,
    });
    sfx.enemyShot();
  }

  /* ---------------- entities ---------------- */

  private spawnEnemies() {
    const spawns = this.currentStage.spawns;
    for (let i = 0; i < spawns.length; i++) {
      if (this.spawned.has(i)) continue;
      const s = spawns[i];
      if (s.x > this.camX + VIEW_W + 60 || s.x < this.camX - 120) continue;
      this.spawned.add(i);
      const dir = s.dir ?? -1;
      const mk = (w: number, h: number, hp: number): Enemy => ({
        type: s.type, x: s.x, y: s.y - h, w, h, vx: 0, vy: 0, hp, dir,
        timer: 20 + Math.random() * 60, anim: Math.random() * 3, onGround: false,
        hurt: 0, base: s.y, drop: s.drop,
      });
      if (s.type === 'runner') this.enemies.push(mk(12, 22, 1));
      else if (s.type === 'gunner') this.enemies.push(mk(12, 22, 3));
      else if (s.type === 'turret') this.enemies.push(mk(24, 16, 8));
      else if (s.type === 'flyer') this.enemies.push(mk(18, 12, 2));
      else this.enemies.push(mk(22, 14, 1));
    }
  }

  private killEnemy(e: Enemy, scoreIt = true) {
    e.dead = true;
    this.explosion(e.x + e.w / 2, e.y + e.h / 2, e.type === 'turret');
    if (scoreIt) this.score += SCORE[e.type] ?? 100;
    if (e.type === 'pod' && e.drop) {
      this.items.push({ x: e.x + e.w / 2 - 8, y: e.y, vy: 0, kind: e.drop, t: 0 });
      sfx.power();
    }
  }

  private updateEnemies() {
    const p = this.player;
    const pcx = p.x + p.w / 2;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.anim += 1 / 60;
      e.timer--;
      if (e.hurt > 0) e.hurt--;

      if (e.type === 'runner') {
        e.dir = pcx < e.x ? -1 : 1;
        e.vx = e.dir * 1.45;
        e.vy = Math.min(MAX_FALL, e.vy + GRAVITY);
        const bx = e.x;
        this.moveX(e, e.vx);
        this.moveY(e, e.vy);
        const blocked = Math.abs(e.x - bx) < 0.4;
        const edge = e.onGround && !this.groundAt(e.x + e.w / 2 + e.dir * 16, e.y + e.h + 6);
        if (e.onGround && (blocked || edge || (e.timer < 0 && Math.random() < 0.02))) {
          e.vy = -7;
          e.onGround = false;
          if (e.timer < 0) e.timer = 90;
        }
      } else if (e.type === 'gunner') {
        e.dir = pcx < e.x ? -1 : 1;
        e.vy = Math.min(MAX_FALL, e.vy + GRAVITY);
        this.moveY(e, e.vy);
        if (e.timer <= 0) {
          const near = Math.abs(pcx - e.x) < VIEW_W * 0.75;
          if (near) {
            this.enemyShot(e.x + e.w / 2 + e.dir * 10, e.y + 9, 2.7);
            e.timer = 70 + Math.random() * 60;
          } else e.timer = 30;
        }
      } else if (e.type === 'turret') {
        if (e.timer <= 0) {
          const near = Math.abs(pcx - e.x) < VIEW_W * 0.7;
          if (near) {
            for (let k = -1; k <= 1; k++) this.enemyShot(e.x + e.w / 2, e.y + 4, 2.9, k * 0.22);
            e.timer = 115 + Math.random() * 40;
          } else e.timer = 30;
        }
      } else if (e.type === 'flyer') {
        e.x += e.vx || (e.vx = -1.6);
        e.y = e.base + Math.sin(e.anim * 2.4) * 26;
        if (e.timer <= 0 && Math.abs(pcx - e.x) < 180) {
          this.enemyShot(e.x + e.w / 2, e.y + e.h, 2.6);
          e.timer = 120 + Math.random() * 80;
        }
        if (e.x < this.camX - 60) e.dead = true;
      } else if (e.type === 'pod') {
        e.x += e.vx || (e.vx = -1.15);
        e.y = e.base - e.h + Math.sin(e.anim * 3) * 12;
        if (e.x < this.camX - 50) e.dead = true;
      }

      if (e.type !== 'pod' && p.alive && !p.guard && overlap(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) {
        this.hurtPlayer();
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead && e.y < VIEW_H + 80 && e.x > this.camX - 200);
  }

  /* ---------------- player damage ---------------- */

  hurtPlayer(unblockable = false) {
    const p = this.player;
    if (!p.alive || p.invuln > 0 || this.phase !== 'playing') return;
    if (!unblockable && p.guard) return;
    if (p.barrier > 0) return;
    p.alive = false;
    p.prone = false;
    if (!INFINITE_LIVES) this.lives -= 1;
    this.respawnTimer = 80;
    this.explosion(p.x + p.w / 2, p.y + p.h / 2);
    this.burst(p.x + p.w / 2, p.y + p.h / 2, 14, ['#f6c193', '#e33b30', '#2f57c8'], 3.2, 0.14, 3);
    this.shake = 7;
    sfx.death();
    this.pushHud();
  }

  private respawn() {
    const p = this.player;
    const x = clamp(p.lastSafeX, this.camX + 40, this.camX + VIEW_W - 80);
    const np = this.makePlayer(x, -28, p.weapon);
    np.vy = 2;
    np.invuln = 130;
    np.lastSafeX = x;
    this.player = np;
    this.pushHud();
  }

  /* ---------------- main update ---------------- */

  update(inp: InputState) {
    this.t += 1 / 60;
    this.frame++;
    if (this.msgT > 0) this.msgT--;
    else this.msg = null;
    if (this.shake > 0) this.shake *= 0.86;
    if (this.warnFlash > 0) this.warnFlash--;

    if (this.stageClearTimer > 0) {
      this.stageClearTimer--;
      this.updateParticles();
      if (this.stageClearTimer === 0) {
        this.loadStage(this.stageIndex + 1, true);
        sfx.start();
      }
      return;
    }

    if (this.phase !== 'playing') {
      this.updateParticles();
      if (this.phase === 'win' || this.phase === 'gameover') this.endTimer++;
      return;
    }

    const p = this.player;

    if (!p.alive) {
      this.respawnTimer--;
      if (this.respawnTimer <= 0) {
        if (this.lives < 0 && !INFINITE_LIVES) {
          this.phase = 'gameover';
          sfx.gameover();
          this.pushHud();
        } else this.respawn();
      }
    } else {
      this.updatePlayer(inp);
    }

    this.spawnEnemies();
    this.updateEnemies();
    updateBoss(this);
    this.updateBullets();
    this.updateItems();
    this.updateParticles();
    this.updateCamera();

    if (!this.boss && this.camX > CAM_MAX - 80) {
      this.boss = makeBoss(this.currentStage);
      this.setMsg(`警告！！ ${this.currentStage.bossName} 出现`, 140);
      this.warnFlash = 90;
      sfx.explode(true);
    }
  }

  private updatePlayer(inp: InputState) {
    const p = this.player;
    this.lastGuardInput = inp.guard;
    p.anim += 1 / 60;
    if (p.invuln > 0) p.invuln--;
    if (p.barrier > 0) p.barrier--;
    if (p.shootFlash > 0) p.shootFlash--;
    if (p.fireCd > 0) p.fireCd--;
    if (p.dropThrough > 0) p.dropThrough--;

    const wantProne = inp.down && p.onGround;
    if (wantProne && !p.prone) {
      p.prone = true;
      p.y += 14;
      p.h = 10;
    } else if (!wantProne && p.prone) {
      p.prone = false;
      p.y -= 14;
      p.h = 24;
    }

    let dir = 0;
    if (inp.left) dir -= 1;
    if (inp.right) dir += 1;
    if (dir !== 0) p.facing = dir;
    const guardActive = inp.guard && !p.prone;
    p.vx = p.prone ? 0 : dir * RUN_SPEED * (guardActive ? GUARD_SLOW : 1);

    if (inp.jump && !p.jumpLatch) {
      if (p.onGround) {
        if (inp.down) {
          if (p.prone) { p.prone = false; p.h = 24; p.y -= 14; }
          p.dropThrough = 10;
          p.y += 2;
          p.vy = 1;
          p.onGround = false;
        } else {
          p.vy = JUMP_V;
          p.onGround = false;
          p.prone = false;
          p.airJumps = 1;
          if (p.h === 10) {
            p.h = 24;
            p.y -= 14;
          }
          sfx.jump();
        }
      } else if (p.airJumps > 0) {
        p.airJumps--;
        p.vy = JUMP_V * 0.92;
        p.anim = 0;
        sfx.jump();
        this.burst(p.x + p.w / 2, p.y + p.h, 8, ['#ffffff', '#bfe9ff'], 1.8, -0.02, 2);
      }
    }
    p.jumpLatch = inp.jump;
    if (!inp.jump && p.vy < -2.4) p.vy = -2.4;

    p.vy = Math.min(MAX_FALL, p.vy + GRAVITY);
    this.moveX(p, p.vx);
    this.moveY(p, p.vy, p.dropThrough <= 0);
    if (p.onGround) p.airJumps = 1;

    let rightWall = this.camX + VIEW_W - p.w - 3;
    if (this.boss) {
      const bw = bossWallX(this.boss, p.w);
      if (bw !== null) rightWall = Math.min(rightWall, bw);
    }
    p.x = clamp(p.x, this.camX + 3, rightWall);
    if (p.onGround) p.lastSafeX = p.x;

    let ax = p.facing;
    let ay = 0;
    if (inp.up && dir !== 0) { ax = dir; ay = -1; }
    else if (inp.up) { ax = 0; ay = -1; }
    else if (inp.down && !p.onGround && dir !== 0) { ax = dir; ay = 1; }
    else if (inp.down && !p.onGround) { ax = 0; ay = 1; }
    const len = Math.hypot(ax, ay) || 1;
    p.aimX = ax / len;
    p.aimY = ay / len;

    if (inp.fire && !guardActive && p.fireCd <= 0) this.firePlayer();

    if (p.y > VIEW_H + 12) this.hurtPlayer(true);

    this.updateGuard();
  }

  private updateGuard() {
    const p = this.player;
    p.guard = false;
    if (this.lastGuardInput && p.alive && !p.prone) p.guard = true;
    if (p.knifeCd > 0) p.knifeCd--;
    if (p.knifeFlash > 0) p.knifeFlash--;
    if (!p.guard) return;

    for (const b of this.ebullets) {
      if (b.life <= 0) continue;
      const dx = b.x - (p.x + p.w / 2);
      const dy = b.y - (p.y + p.h / 2);
      if (Math.abs(dx) < 22 && Math.abs(dy) < 18 && Math.sign(dx || p.facing) === Math.sign(p.facing)) {
        b.life = 0;
        p.knifeFlash = Math.max(p.knifeFlash, 5);
        this.burst(b.x, b.y, 5, ['#bfe9ff', '#ffffff', '#8fd6ff'], 2.2, 0.02, 2);
        sfx.guardBlock();
      }
    }

    if (p.knifeCd > 0) return;
    const fx = p.facing >= 0 ? p.x + p.w : p.x - MELEE_RANGE;
    const fbox = { x: fx, y: p.y - 4, w: MELEE_RANGE, h: p.h + 8 };
    let hit = false;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (overlap(fbox.x, fbox.y, fbox.w, fbox.h, e.x, e.y, e.w, e.h)) {
        e.hp -= 9;
        e.hurt = 8;
        if (e.hp <= 0) this.killEnemy(e);
        hit = true;
      }
    }
    if (this.boss && damageBossAt(this, fbox.x, fbox.y, fbox.w, fbox.h, 2)) hit = true;
    if (hit) {
      p.knifeCd = 14;
      p.knifeFlash = 8;
      this.burst(fx + MELEE_RANGE * 0.5, p.y + p.h / 2, 6, ['#ffffff', '#e6f4ff'], 2.6, 0.02, 2);
      sfx.slash();
    }
  }

  private splashDamage(x: number, y: number, radius: number, dmg: number) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
      if ((ex - x) ** 2 + (ey - y) ** 2 <= radius * radius) {
        e.hp -= dmg;
        e.hurt = 8;
        if (e.hp <= 0) this.killEnemy(e);
      }
    }
  }

  private updateBullets() {
    const cam = this.camX;
    for (const b of this.bullets) {
      if (b.kind === 'H') {
        const tgt = this.nearestTarget(b.x, b.y, 260);
        if (tgt) {
          const desired = Math.atan2(tgt.y - b.y, tgt.x - b.x);
          const cur = Math.atan2(b.vy, b.vx);
          let diff = desired - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turn = clamp(diff, -0.16, 0.16);
          const na = cur + turn;
          const spd = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(na) * spd;
          b.vy = Math.sin(na) * spd;
        }
        if (this.frame % 2 === 0) {
          this.burst(b.x - b.vx * 0.5, b.y - b.vy * 0.5, 1, ['#ffb43c', '#ff6a2a'], 0.6, -0.01, 2);
        }
      }
      b.x += b.vx;
      b.y += b.vy;
      b.life--;
      if (b.pcd && b.pcd > 0) {
        b.pcd--;
      } else {
        if (this.boss && damageBossAt(this, b.x - 2, b.y - 2, 4, 4, b.dmg)) {
          if (b.pierce) b.pcd = 9;
          else b.life = 0;
          if (b.kind === 'H') { this.explosion(b.x, b.y, false); this.splashDamage(b.x, b.y, 30, 2); }
        }
        for (const e of this.enemies) {
          if (e.dead || b.life <= 0 || (b.pcd ?? 0) > 0) continue;
          if (overlap(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2, e.x, e.y, e.w, e.h)) {
            e.hp -= b.dmg;
            e.hurt = 8;
            sfx.hit();
            this.burst(b.x, b.y, 3, ['#ffffff', '#ffd76a'], 1.8, 0.05, 2);
            if (e.hp <= 0) this.killEnemy(e);
            if (b.pierce) { b.pcd = 9; break; }
            b.life = 0;
            if (b.kind === 'H') { this.explosion(b.x, b.y, false); this.splashDamage(b.x, b.y, 30, 2); }
            break;
          }
        }
      }
      if (b.x < cam - 30 || b.x > cam + VIEW_W + 30 || b.y < -40 || b.y > VIEW_H + 40) b.life = 0;
      if (b.life > 0 && !b.pierce && this.solidAt(b.x, b.y)) {
        b.life = 0;
        if (b.kind === 'H') { this.explosion(b.x, b.y, false); this.splashDamage(b.x, b.y, 30, 2); }
        else this.burst(b.x, b.y, 3, ['#cfd6e6', '#8a93a8'], 1.6, 0.08, 2);
      } else if (b.life > 0 && b.pierce && this.frame % 4 === 0 && this.solidAt(b.x, b.y)) {
        this.burst(b.x, b.y, 1, ['#cfd6e6'], 1, 0.08, 2);
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);

    const p = this.player;
    for (const b of this.ebullets) {
      if (b.life <= 0) continue;
      if (b.grav) b.vy += b.grav;
      b.x += b.vx;
      b.y += b.vy;
      b.life--;
      if (b.x < cam - 40 || b.x > cam + VIEW_W + 40 || b.y < -40 || b.y > VIEW_H + 40) b.life = 0;
      if (b.life > 0 && this.solidAt(b.x, b.y)) {
        b.life = 0;
        if (b.grav) this.explosion(b.x, b.y - 4, false);
        else this.burst(b.x, b.y, 3, ['#ffd08a', '#ff8a3c'], 1.4, 0.08, 2);
      }
    }

    // 我方子弹与敌方子弹对消
    for (const pb of this.bullets) {
      if (pb.life <= 0) continue;
      for (const eb of this.ebullets) {
        if (eb.life <= 0) continue;
        const dx = pb.x - eb.x;
        const dy = pb.y - eb.y;
        if (dx * dx + dy * dy < 100) {
          pb.life = 0;
          eb.life = 0;
          this.burst((pb.x + eb.x) * 0.5, (pb.y + eb.y) * 0.5, 5,
            ['#ffffff', '#ffd76a', '#ffb43c', '#ff6a2a'], 2.2, 0.06, 2);
          sfx.hit();
          break;
        }
      }
    }

    this.bullets = this.bullets.filter((b) => b.life > 0);
    this.ebullets = this.ebullets.filter((b) => b.life > 0);

    for (const b of this.ebullets) {
      if (!p.alive) break;
      if (overlap(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2, p.x, p.y, p.w, p.h)) {
        if (p.barrier > 0 || p.invuln > 0) {
          b.life = 0;
          this.burst(b.x, b.y, 4, ['#9be7ff', '#ffffff'], 2, 0.03, 2);
        } else {
          b.life = 0;
          this.hurtPlayer();
        }
      }
    }
    this.ebullets = this.ebullets.filter((b) => b.life > 0);
  }

  private updateItems() {
    const p = this.player;
    for (const it of this.items) {
      it.t += 1 / 60;
      it.vy = Math.min(4, it.vy + 0.22);
      const box = { x: it.x, y: it.y, w: 16, h: 16, vy: it.vy, onGround: false };
      this.moveY(box, it.vy);
      it.y = box.y;
      it.vy = box.vy;
      if (p.alive && overlap(p.x, p.y, p.w, p.h, it.x, it.y, 16, 16)) {
        it.t = -999;
        if (it.kind === 'B') {
          p.barrier = 600;
          this.setMsg('获得护罩！', 70);
        } else {
          p.weapon = it.kind as WeaponKind;
          this.setMsg(`获得武器：${WEAPON_NAMES[p.weapon]}`, 70);
        }
        this.score += 300;
        sfx.power();
        this.burst(it.x + 8, it.y + 8, 10, ['#ffffff', '#ffe066', '#9be7ff'], 2.6, 0.02, 3);
        this.pushHud();
      }
    }
    this.items = this.items.filter((i) => i.t > -100 && i.x > this.camX - 60 && i.y < VIEW_H + 40);
  }

  private updateParticles() {
    for (const q of this.parts) {
      q.x += q.vx;
      q.y += q.vy;
      q.vy += q.grav;
      q.vx *= 0.99;
      q.life--;
    }
    this.parts = this.parts.filter((q) => q.life > 0);
  }

  private updateCamera() {
    const p = this.player;
    const target = clamp(p.x - VIEW_W * 0.38, 0, CAM_MAX);
    if (target > this.camTarget) this.camTarget = target;
    this.camX += (this.camTarget - this.camX) * 0.12;
    if (this.camX > CAM_MAX) this.camX = CAM_MAX;
  }

  /* ---------------- render ---------------- */

  draw(ctx: CanvasRenderingContext2D) {
    const camX = Math.round(this.camX);
    ctx.save();
    if (this.shake > 0.3) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    const stg = this.currentStage;
    S.drawBackground(ctx, camX, this.t, stg.theme);

    const grass = S.themeGrass(stg.theme);
    for (const p of stg.platforms) S.drawPlatform(ctx, p, camX, grass);

    for (const it of this.items) S.drawItem(ctx, it, camX, this.t);

    const p = this.player;
    for (const e of this.enemies) {
      let ang = 0;
      if (e.type === 'turret') {
        const dx = p.x + p.w / 2 - (e.x + e.w / 2);
        const dy = Math.min(-2, p.y + p.h / 2 - (e.y + 4));
        ang = Math.atan2(dy, dx);
      }
      S.drawEnemy(ctx, e, camX, this.t, ang);
    }

    if (this.boss) drawBoss(ctx, this.boss, camX, this.t, p);

    S.drawHero(ctx, p, camX, this.t);

    for (const b of this.bullets) S.drawBullet(ctx, b, camX);
    for (const b of this.ebullets) S.drawBullet(ctx, b, camX);

    for (const q of this.parts) {
      const a = Math.min(1, q.life / 14);
      ctx.globalAlpha = a;
      S.px(ctx, q.x - camX - q.size / 2, q.y - q.size / 2, q.size, q.size, q.color);
    }
    ctx.globalAlpha = 1;

    if (this.warnFlash > 0 && Math.floor(this.frame / 6) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,60,40,0.14)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    ctx.restore();

    const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 90, VIEW_W / 2, VIEW_H / 2, 320);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = 'rgba(0,0,0,0.055)';
    for (let y = 0; y < VIEW_H; y += 3) ctx.fillRect(0, y, VIEW_W, 1);

    S.drawHud(ctx, {
      score: this.score,
      lives: this.lives,
      weapon: this.player.weapon,
      boss: this.boss && this.boss.dying === 0 ? this.boss : null,
      bossName: stg.bossName,
      msg: this.msg,
      msgT: this.msgT,
      stage: stg.id,
    });
  }
}

export const makeInput = emptyInput;
