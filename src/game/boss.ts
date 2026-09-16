import { sfx } from './audio';
import type { Game } from './game';
import { GROUND_Y } from './level';
import type { StageData } from './level';
import { drawFortress, px } from './sprites';
import { GRAVITY, VIEW_H, VIEW_W, clamp, overlap } from './types';
import type { Boss, BossKind, BossPart } from './types';

type C2D = CanvasRenderingContext2D;
const R = (n: number) => Math.round(n);
const TAU = Math.PI * 2;

interface BossDef {
  w: number;
  h: number;
  wallGap: number;      // >0: 玩家不能越过 boss.x - gap（墙型 Boss）
  bodyDamage: boolean;  // 本体可直接受伤
  hasCore: boolean;     // 有需要“开启”才能受伤的核心
  shareHp: boolean;     // 部件共享总血量
  sumParts: boolean;    // 总血量 = 各部件血量之和
  hull: boolean;        // 本体是装甲（挡子弹但不受伤）
}

const DEFS: Record<BossKind, BossDef> = {
  fortress: { w: 190, h: 176, wallGap: 42, bodyDamage: false, hasCore: true, shareHp: false, sumParts: false, hull: true },
  tank:     { w: 110, h: 56,  wallGap: 0,  bodyDamage: true,  hasCore: false, shareHp: false, sumParts: false, hull: false },
  heli:     { w: 92,  h: 40,  wallGap: 0,  bodyDamage: true,  hasCore: false, shareHp: false, sumParts: false, hull: false },
  mech:     { w: 60,  h: 80,  wallGap: 0,  bodyDamage: true,  hasCore: false, shareHp: false, sumParts: false, hull: false },
  spider:   { w: 70,  h: 44,  wallGap: 0,  bodyDamage: true,  hasCore: false, shareHp: false, sumParts: false, hull: false },
  golem:    { w: 150, h: 176, wallGap: 26, bodyDamage: false, hasCore: false, shareHp: false, sumParts: true,  hull: true },
  twins:    { w: 26,  h: 26,  wallGap: 0,  bodyDamage: false, hasCore: false, shareHp: true,  sumParts: false, hull: false },
  gunship:  { w: 200, h: 70,  wallGap: 0,  bodyDamage: false, hasCore: true,  shareHp: false, sumParts: false, hull: true },
  train:    { w: 220, h: 70,  wallGap: 0,  bodyDamage: false, hasCore: true,  shareHp: false, sumParts: false, hull: true },
  heart:    { w: 190, h: 176, wallGap: 42, bodyDamage: false, hasCore: true,  shareHp: false, sumParts: false, hull: true },
};

const part = (ox: number, oy: number, w: number, h: number, hp: number, timer: number): BossPart => ({
  ox, oy, w, h, hp, maxHp: hp, alive: true, timer, flash: 0,
});

/* ------------------------------------------------------------------ */
/* 创建                                                                */
/* ------------------------------------------------------------------ */

export function makeBoss(stage: StageData): Boss {
  const kind = stage.boss;
  const d = DEFS[kind];
  const b: Boss = {
    kind, name: stage.bossName,
    x: 3600, y: 52, vx: 0, vy: 0, w: d.w, h: d.h,
    hp: stage.bossHp, maxHp: stage.bossHp,
    parts: [], coreOpen: false, timer: 120, phase: 0, hurt: 0, dying: 0,
    spawnTimer: 260, anim: 0, beamY: 0, beamT: 0, beamCharge: 0, beamIdx: -1,
    dir: -1, onGround: false, ang: 0, radius: 60,
  };
  switch (kind) {
    case 'fortress':
      b.parts = [part(24, 42, 32, 28, 12, 90), part(24, 142, 32, 28, 12, 165)];
      break;
    case 'tank':
      b.x = 3640; b.y = GROUND_Y - d.h; b.vx = -1; b.timer = 80;
      break;
    case 'heli':
      b.x = 3560; b.y = 60; b.timer = 150;
      break;
    case 'mech':
      b.x = 3660; b.y = GROUND_Y - d.h - 40; b.timer = 90;
      break;
    case 'spider':
      b.x = 3600; b.y = 4; b.timer = 170;
      break;
    case 'golem':
      b.x = 3640; b.y = 52;
      b.parts = [part(28, 74, 26, 22, 16, 0), part(28, 116, 26, 22, 16, 0), part(28, 164, 26, 22, 16, 0)];
      b.hp = b.maxHp = 48;
      break;
    case 'twins':
      b.x = 3560; b.y = 110;
      b.parts = [part(60, 0, 26, 26, 1, 40), part(-60, 0, 26, 26, 1, 90)];
      break;
    case 'gunship':
      b.x = 3560; b.y = 26;
      b.parts = [part(34, 64, 28, 22, 14, 60), part(100, 64, 28, 22, 14, 120), part(166, 64, 28, 22, 14, 180)];
      break;
    case 'train':
      b.x = 3570; b.y = GROUND_Y - d.h; b.vx = -0.6; b.timer = 150;
      b.parts = [part(56, 10, 30, 26, 16, 60), part(124, 10, 30, 26, 16, 130), part(192, 10, 30, 26, 16, 200)];
      break;
    case 'heart':
      b.parts = [part(34, 52, 36, 30, 18, 80), part(34, 142, 36, 30, 18, 170)];
      break;
  }
  return b;
}

/** 玩家可到达的最右侧（墙型 Boss 会阻挡） */
export function bossWallX(b: Boss, playerW: number): number | null {
  const gap = DEFS[b.kind].wallGap;
  return gap > 0 ? b.x - playerW - gap : null;
}

function coreRect(b: Boss): { x: number; y: number; w: number; h: number } | null {
  switch (b.kind) {
    case 'fortress': return { x: b.x + 8, y: b.y + 68, w: 44, h: 48 };
    case 'heart':    return { x: b.x + 16, y: b.y + 70, w: 48, h: 52 };
    case 'gunship':  return { x: b.x + 80, y: b.y + 44, w: 40, h: 24 };
    case 'train':    return { x: b.x + 3, y: b.y + 25, w: 30, h: 30 };
    default: return null;
  }
}

function bounds(b: Boss) {
  if (b.kind === 'twins') return { x: b.x - 70, y: b.y - 70, w: 140, h: 140 };
  return { x: b.x, y: b.y, w: b.w, h: b.h };
}

/** 追踪导弹的目标点 */
export function bossTargets(b: Boss): { x: number; y: number }[] {
  if (b.dying > 0) return [];
  const alive = b.parts.filter((c) => c.alive);
  if (alive.length) return alive.map((c) => ({ x: b.x + c.ox, y: b.y + c.oy }));
  const cr = coreRect(b);
  if (cr) return [{ x: cr.x + cr.w / 2, y: cr.y + cr.h / 2 }];
  return [{ x: b.x + b.w / 2, y: b.y + b.h / 2 }];
}

/* ------------------------------------------------------------------ */
/* 受伤                                                                */
/* ------------------------------------------------------------------ */

function coreDamage(g: Game, b: Boss, dmg: number, x: number, y: number) {
  b.hp -= dmg;
  b.hurt = 5;
  g.score += 60;
  g.burst(x, y, 5, ['#ffffff', '#ffd76a', '#ff7a2a'], 2.4, 0.04, 3);
  sfx.bossHurt();
  if (b.hp <= 0) {
    b.hp = 0;
    b.dying = 150;
    g.shake = 12;
  }
}

/** 对 Boss 的矩形区域造成伤害。返回是否命中任何东西（含装甲）。 */
export function damageBossAt(g: Game, rx: number, ry: number, rw: number, rh: number, dmg: number): boolean {
  const b = g.boss;
  if (!b || b.dying > 0) return false;
  const d = DEFS[b.kind];

  for (const c of b.parts) {
    if (!c.alive) continue;
    const cx = b.x + c.ox - c.w / 2;
    const cy = b.y + c.oy - c.h / 2;
    if (!overlap(rx, ry, rw, rh, cx, cy, c.w, c.h)) continue;
    c.flash = 6;
    if (d.shareHp) {
      coreDamage(g, b, dmg, rx, ry);
    } else {
      c.hp -= dmg;
      g.burst(rx, ry, 3, ['#fff3b0', '#ffb43c'], 2, 0.05, 2);
      sfx.bossHurt();
      if (c.hp <= 0) {
        c.hp = 0;
        c.alive = false;
        if (b.kind === 'golem' && b.parts[b.beamIdx] === c) {
          b.beamCharge = 0;
          b.beamT = 0;
          b.beamIdx = -1;
        }
        g.explosion(b.x + c.ox, b.y + c.oy, true);
        g.score += 1500;
      }
    }
    return true;
  }

  const cr = coreRect(b);
  if (cr && overlap(rx, ry, rw, rh, cr.x, cr.y, cr.w, cr.h)) {
    if (b.coreOpen) coreDamage(g, b, dmg, rx, ry);
    else {
      g.burst(rx, ry, 3, ['#cfd6e6', '#8a93a8'], 2, 0.06, 2);
      sfx.hit();
    }
    return true;
  }

  const bb = bounds(b);
  if (d.bodyDamage && overlap(rx, ry, rw, rh, bb.x, bb.y, bb.w, bb.h)) {
    coreDamage(g, b, dmg, rx, ry);
    return true;
  }
  if (d.hull) {
    // Keep armor behind exposed weak points so projectiles reach them first.
    const inset = b.kind === 'fortress' || b.kind === 'heart' || b.kind === 'golem' ? 48 : 0;
    const hx = b.x + inset;
    const hw = b.w - inset;
    if (overlap(rx, ry, rw, rh, hx, b.y, hw, b.h)) {
      g.burst(rx, ry, 2, ['#cfd6e6', '#8a93a8'], 1.6, 0.06, 2);
      return true;
    }
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* 行为                                                                */
/* ------------------------------------------------------------------ */

function shoot(g: Game, x: number, y: number, ang: number, speed: number, grav = 0, r = 4) {
  g.ebullets.push({
    x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
    r, dmg: 1, life: 340, kind: 'boss', grav,
  });
}

function aimAng(g: Game, x: number, y: number): number {
  const p = g.player;
  return Math.atan2(p.y + p.h / 2 - y, p.x + p.w / 2 - x);
}

function contact(g: Game, x: number, y: number, w: number, h: number) {
  const p = g.player;
  if (p.alive && overlap(p.x, p.y, p.w, p.h, x, y, w, h)) g.hurtPlayer();
}

function spawnRunner(g: Game, fromLeft = true) {
  g.enemies.push({
    type: 'runner', x: fromLeft ? g.camX + 10 : g.camX + VIEW_W - 30, y: 200, w: 12, h: 22,
    vx: 0, vy: 0, hp: 1, dir: fromLeft ? 1 : -1, timer: 40, anim: 0, onGround: false, hurt: 0, base: GROUND_Y,
  });
}

function spawnFlyer(g: Game) {
  g.enemies.push({
    type: 'flyer', x: g.camX + VIEW_W + 10, y: 70, w: 18, h: 12,
    vx: -1.6, vy: 0, hp: 2, dir: -1, timer: 60, anim: 0, onGround: false, hurt: 0, base: 70 + Math.random() * 40,
  });
}

export function updateBoss(g: Game) {
  const b = g.boss;
  if (!b) return;
  if (b.hurt > 0) b.hurt--;
  b.anim += 1 / 60;
  for (const c of b.parts) if (c.flash > 0) c.flash--;

  if (b.dying > 0) {
    b.dying--;
    const bb = bounds(b);
    if (b.dying % 7 === 0) {
      g.explosion(bb.x + Math.random() * bb.w, bb.y + Math.random() * bb.h, Math.random() < 0.3);
    }
    if (b.dying === 0) {
      g.explosion(bb.x + bb.w / 2, bb.y + bb.h / 2, true);
      g.explosion(bb.x + bb.w * 0.3, bb.y + bb.h * 0.3, true);
      g.onBossDefeated();
    }
    return;
  }

  const camX = g.camX;
  const p = g.player;

  switch (b.kind) {
    /* ---------------- 哨戒要塞 ---------------- */
    case 'fortress': {
      const alive = b.parts.filter((c) => c.alive);
      for (const c of b.parts) {
        if (!c.alive) continue;
        c.timer--;
        if (c.timer <= 0 && p.alive) {
          c.flash = 8;
          const sx = b.x + c.ox - 34, sy = b.y + c.oy;
          for (let k = -1; k <= 1; k++) shoot(g, sx, sy, aimAng(g, sx, sy) + k * 0.18, 2.9);
          sfx.enemyShot();
          c.timer = 105 + Math.random() * 55;
        }
      }
      b.timer--;
      if (alive.length === 0) {
        b.coreOpen = true;
        if (b.timer <= 0) {
          for (let k = 0; k < 7; k++) shoot(g, b.x + 22, b.y + 92, Math.PI * 0.62 + (k / 6) * Math.PI * 0.76, 2.7);
          sfx.enemyShot();
          b.timer = 80;
        }
      } else if (b.timer <= 0) {
        b.coreOpen = !b.coreOpen;
        b.timer = b.coreOpen ? 190 : 130;
        if (b.coreOpen) {
          for (let k = 0; k < 5; k++) shoot(g, b.x + 22, b.y + 92, aimAng(g, b.x + 22, b.y + 92) + (k - 2) * 0.2, 2.6);
          sfx.enemyShot();
        }
      }
      if (--b.spawnTimer <= 0) { b.spawnTimer = 280; spawnRunner(g); }
      break;
    }

    /* ---------------- 重型战车 ---------------- */
    case 'tank': {
      const minX = camX + 150, maxX = 3790 - b.w;
      if (b.phase === 1) {
        b.x += b.vx;
        b.timer--;
        if (b.timer <= 0 || b.x <= minX || b.x >= maxX) {
          b.phase = 0; b.timer = 90; b.vx = b.vx > 0 ? -1 : 1;
          g.shake = 5;
        }
        if (g.frame % 4 === 0) g.burst(b.x + (b.vx > 0 ? 0 : b.w), b.y + b.h - 4, 2, ['#8a7a5a', '#5a4a3a'], 1.2, -0.02, 3);
      } else {
        b.x += b.vx;
        if (b.x < minX) { b.x = minX; b.vx = 1; }
        if (b.x > maxX) { b.x = maxX; b.vx = -1; }
        b.timer--;
        if (b.timer <= 0) {
          const r = Math.random();
          const tx = b.x + b.w / 2, ty = b.y - 6;
          if (r < 0.3) {
            b.phase = 1; b.vx = (p.x < b.x ? -1 : 1) * 3.4; b.timer = 60;
            sfx.missileLaunch();
          } else if (r < 0.7) {
            for (const k of [-0.12, 0.12]) shoot(g, tx, ty, aimAng(g, tx, ty) - 0.6 + k, 4.6, 0.12, 5);
            sfx.enemyShot();
            b.timer = 95;
          } else {
            for (let k = 0; k < 4; k++) shoot(g, tx - 20, ty + 8, aimAng(g, tx, ty) + (k - 1.5) * 0.09, 3.2);
            sfx.enemyShot();
            b.timer = 110;
          }
        }
      }
      if (g.frame % 10 === 0) g.burst(b.x + b.w - 6, b.y + 6, 1, ['#6b6b74', '#3a3a44'], 0.6, -0.04, 3);
      contact(g, b.x, b.y, b.w, b.h);
      break;
    }

    /* ---------------- 武装直升机 ---------------- */
    case 'heli': {
      const targetX = clamp(p.x + p.w / 2 + b.dir * 110 - b.w / 2, camX + 20, camX + VIEW_W - b.w - 20);
      b.x += (targetX - b.x) * 0.03;
      b.y = 52 + Math.sin(b.anim * 1.7) * 20;
      b.timer--;
      if (b.timer <= 0) { b.dir *= -1; b.timer = 150 + Math.random() * 60; }
      b.phase++;
      const cx = b.x + b.w / 2, by = b.y + b.h;
      if (b.phase % 75 === 0) { shoot(g, cx, by, Math.PI / 2, 1.2, 0.14, 5); sfx.enemyShot(); }
      if (b.phase % 130 === 60) {
        for (let k = -1; k <= 1; k++) shoot(g, b.x + 10, b.y + 30, aimAng(g, b.x + 10, b.y + 30) + k * 0.15, 3.0);
        sfx.enemyShot();
      }
      if (b.hp < b.maxHp * 0.5 && b.phase % 130 === 100) {
        for (let k = -1; k <= 1; k++) shoot(g, cx, by, Math.PI / 2 + k * 0.35, 1.6, 0.14, 5);
        sfx.enemyShot();
      }
      contact(g, b.x + 6, b.y + 8, b.w - 20, b.h - 12);
      break;
    }

    /* ---------------- 巨型机甲 ---------------- */
    case 'mech': {
      if (!b.onGround) {
        b.vy = Math.min(9, b.vy + GRAVITY);
        b.y += b.vy;
        b.x += b.vx;
        if (b.y >= GROUND_Y - b.h) {
          b.y = GROUND_Y - b.h; b.onGround = true; b.vy = 0; b.vx = 0;
          g.shake = 10; sfx.explode(true);
          shoot(g, b.x, GROUND_Y - 6, Math.PI, 3.4, 0, 6);
          shoot(g, b.x + b.w, GROUND_Y - 6, 0, 3.4, 0, 6);
          g.burst(b.x + b.w / 2, GROUND_Y, 14, ['#8a7a5a', '#5a4a3a', '#cfc6b0'], 3, 0.1, 3);
        }
      } else {
        b.dir = p.x < b.x ? -1 : 1;
        b.x += b.dir * 0.7;
        b.timer--;
        if (b.timer <= 0) {
          if (Math.random() < 0.45) {
            b.vy = -9.5; b.vx = b.dir * 2.4; b.onGround = false; b.timer = 120;
            sfx.jump();
          } else {
            const sx = b.x + b.w / 2 + b.dir * 22, sy = b.y + 30;
            for (let k = -1; k <= 1; k++) shoot(g, sx, sy, aimAng(g, sx, sy) + k * 0.2, 3.1);
            sfx.enemyShot();
            b.timer = 85;
          }
        }
      }
      b.x = clamp(b.x, camX + 40, 3790 - b.w);
      contact(g, b.x + 8, b.y, b.w - 16, b.h);
      break;
    }

    /* ---------------- 猎杀蛛 ---------------- */
    case 'spider': {
      const restY = 4;
      if (b.phase === 0) {
        const tx = clamp(p.x + p.w / 2 - b.w / 2, camX + 30, camX + VIEW_W - b.w - 30);
        b.x += (tx - b.x) * 0.02;
        b.y = restY + Math.sin(b.anim * 3) * 4;
        b.timer--;
        if (b.timer <= 0) { b.phase = 1; b.vy = 1; sfx.lock(); }
        else if (b.timer % 100 === 50) {
          const cx = b.x + b.w / 2, by = b.y + b.h;
          for (const k of [-0.7, -0.35, 0, 0.35, 0.7]) shoot(g, cx, by, Math.PI / 2 + k, 2.4, 0.03, 4);
          sfx.enemyShot();
        }
      } else if (b.phase === 1) {
        b.vy = Math.min(10, b.vy + 0.6);
        b.y += b.vy;
        if (b.y >= GROUND_Y - b.h) {
          b.y = GROUND_Y - b.h; b.phase = 2; b.timer = 35;
          g.shake = 6; sfx.explode(false);
          g.burst(b.x + b.w / 2, GROUND_Y, 10, ['#8a7a5a', '#5a4a3a'], 2.4, 0.1, 3);
        }
      } else if (b.phase === 2) {
        b.timer--;
        if (b.timer <= 0) b.phase = 3;
      } else {
        b.y -= 3;
        if (b.y <= restY) { b.y = restY; b.phase = 0; b.timer = 150 + Math.random() * 60; }
      }
      if (--b.spawnTimer <= 0) { b.spawnTimer = 260; spawnRunner(g); }
      contact(g, b.x + 6, b.y + 6, b.w - 12, b.h - 8);
      break;
    }

    /* ---------------- 熔岩图腾 ---------------- */
    case 'golem': {
      const alive = b.parts.filter((c) => c.alive);
      b.hp = alive.reduce((s, c) => s + c.hp, 0);
      if (alive.length === 0) { b.dying = 150; g.shake = 12; return; }
      if (b.beamCharge > 0) {
        b.beamCharge--;
        if (b.beamCharge === 0) { b.beamT = 36; sfx.missileLaunch(); g.shake = 4; }
      } else if (b.beamT > 0) {
        b.beamT--;
        const x0 = camX - 10, x1 = b.x + 28;
        if (p.alive && overlap(p.x, p.y, p.w, p.h, x0, b.beamY - 5, x1 - x0, 10)) g.hurtPlayer(true);
        if (b.beamT === 0) b.beamIdx = -1;
      } else {
        b.timer--;
        if (b.timer <= 0) {
          const eye = alive[Math.floor(Math.random() * alive.length)];
          b.beamY = b.y + eye.oy;
          b.beamIdx = b.parts.indexOf(eye);
          b.beamCharge = 50;
          b.timer = 100 + Math.random() * 40;
          sfx.lock();
        } else if (b.timer % 60 === 30) {
          const mx = b.x + 30, my = b.y + 34;
          for (let k = -1; k <= 1; k++) shoot(g, mx, my, aimAng(g, mx, my) + k * 0.16, 2.8);
          sfx.enemyShot();
        }
      }
      break;
    }

    /* ---------------- 双子浮游炮 ---------------- */
    case 'twins': {
      const speed = b.hp < b.maxHp * 0.5 ? 0.055 : 0.032;
      b.ang += speed;
      b.spawnTimer--;
      if (b.spawnTimer <= 0) { b.spawnTimer = 220; b.timer = 45; b.dir = 1; sfx.lock(); }
      if (b.timer > 0) b.timer--;
      if (b.timer > 0 && b.dir === 1) {
        b.x += (p.x + p.w / 2 - b.x) * 0.08;
        b.y += (p.y + p.h / 2 - b.y) * 0.08;
        b.radius += (28 - b.radius) * 0.1;
      } else {
        b.dir = 0;
        const tx = camX + 250 + Math.sin(b.anim * 0.7) * 130;
        const ty = 100 + Math.cos(b.anim * 0.9) * 34;
        b.x += (tx - b.x) * 0.03;
        b.y += (ty - b.y) * 0.03;
        b.radius += (60 - b.radius) * 0.05;
      }
      b.x = clamp(b.x, camX + 40, camX + VIEW_W - 40);
      b.y = clamp(b.y, 40, 200);
      b.parts[0].ox = Math.cos(b.ang) * b.radius;
      b.parts[0].oy = Math.sin(b.ang) * b.radius;
      b.parts[1].ox = -b.parts[0].ox;
      b.parts[1].oy = -b.parts[0].oy;
      for (const c of b.parts) {
        c.timer--;
        if (c.timer <= 0) {
          const sx = b.x + c.ox, sy = b.y + c.oy;
          shoot(g, sx, sy, aimAng(g, sx, sy), 2.9);
          sfx.enemyShot();
          c.flash = 6;
          c.timer = 90 + Math.random() * 40;
        }
        contact(g, b.x + c.ox - 12, b.y + c.oy - 12, 24, 24);
      }
      break;
    }

    /* ---------------- 装甲飞艇 ---------------- */
    case 'gunship': {
      b.x = camX + 140 + Math.sin(b.anim * 0.5) * 90;
      b.y = 26 + Math.sin(b.anim * 1.1) * 8;
      const alive = b.parts.filter((c) => c.alive);
      for (const c of b.parts) {
        if (!c.alive) continue;
        c.timer--;
        if (c.timer <= 0 && p.alive) {
          const sx = b.x + c.ox, sy = b.y + c.oy + 10;
          shoot(g, sx, sy, aimAng(g, sx, sy), 3.0);
          shoot(g, sx, sy, aimAng(g, sx, sy) + 0.25, 3.0);
          sfx.enemyShot();
          c.flash = 6;
          c.timer = 100 + Math.random() * 40;
        }
      }
      if (alive.length === 0) {
        b.coreOpen = true;
        b.timer--;
        if (b.timer <= 0) {
          for (let k = -1; k <= 1; k++) shoot(g, b.x + 100, b.y + 68, Math.PI / 2 + k * 0.3, 1.5, 0.13, 5);
          sfx.enemyShot();
          b.timer = 70;
        }
      }
      if (--b.spawnTimer <= 0) { b.spawnTimer = 230; spawnFlyer(g); }
      break;
    }

    /* ---------------- 装甲列车 ---------------- */
    case 'train': {
      const minX = camX + 110, maxX = 3790 - b.w;
      b.x += b.vx;
      if (b.x < minX) { b.x = minX; b.vx = 0.55; }
      if (b.x > maxX) { b.x = maxX; b.vx = -0.55; }
      const alive = b.parts.filter((c) => c.alive);
      for (const c of b.parts) {
        if (!c.alive) continue;
        c.timer--;
        if (c.timer <= 0 && p.alive) {
          const sx = b.x + c.ox, sy = b.y + c.oy - 10;
          for (const k of [-0.12, 0.12]) shoot(g, sx, sy, aimAng(g, sx, sy) + k, 3.0);
          sfx.enemyShot();
          c.flash = 6;
          c.timer = 110 + Math.random() * 40;
        }
      }
      b.timer--;
      if (b.timer <= 0) {
        shoot(g, b.x - 4, GROUND_Y - 6, Math.PI, 3.2, 0, 6);
        sfx.explode(false);
        g.shake = 4;
        b.timer = alive.length ? 170 : 110;
      }
      if (alive.length === 0) {
        b.coreOpen = true;
        if (b.timer % 90 === 45) {
          for (let k = -2; k <= 2; k++) shoot(g, b.x + 18, b.y + 40, Math.PI + k * 0.22, 2.8);
          sfx.enemyShot();
        }
      }
      if (g.frame % 6 === 0) g.burst(b.x + 42, b.y - 12, 1, ['#8a8a94', '#5a5a64', '#c8c8d0'], 0.7, -0.04, 4);
      contact(g, b.x, b.y + 10, b.w, b.h - 10);
      break;
    }

    /* ---------------- 异形心脏 ---------------- */
    case 'heart': {
      const alive = b.parts.filter((c) => c.alive);
      for (const c of b.parts) {
        if (!c.alive) continue;
        c.timer--;
        if (c.timer <= 0 && p.alive) {
          const sx = b.x + c.ox - 18, sy = b.y + c.oy;
          for (let k = -1; k <= 1; k++) shoot(g, sx, sy, aimAng(g, sx, sy) + k * 0.2, 2.6, 0.04, 4);
          sfx.enemyShot();
          c.flash = 8;
          c.timer = 110 + Math.random() * 50;
        }
      }
      b.timer--;
      const cx = b.x + 40, cy = b.y + 96;
      if (alive.length === 0) {
        b.coreOpen = true;
        if (b.timer <= 0) {
          for (let k = 0; k < 9; k++) shoot(g, cx, cy, Math.PI * 0.55 + (k / 8) * Math.PI * 0.9, 2.5);
          sfx.enemyShot();
          b.timer = 70;
        }
      } else if (b.timer <= 0) {
        b.coreOpen = !b.coreOpen;
        b.timer = b.coreOpen ? 150 : 110;
        if (b.coreOpen) {
          for (let k = -1; k <= 1; k++) shoot(g, cx, cy, aimAng(g, cx, cy) + k * 0.25, 2.6);
          sfx.enemyShot();
        }
      }
      if (--b.spawnTimer <= 0) { b.spawnTimer = 210; spawnFlyer(g); }
      break;
    }
  }
}

/* ------------------------------------------------------------------ */
/* 绘制                                                                */
/* ------------------------------------------------------------------ */

function turretDome(ctx: C2D, cx: number, cy: number, aim: number, alive: boolean, flash: number, col: string) {
  if (!alive) {
    px(ctx, cx - 14, cy - 10, 28, 20, '#20242f');
    px(ctx, cx - 10, cy - 5, 20, 10, '#141821');
    return;
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(aim);
  px(ctx, 0, -3, 22, 6, '#3c4353');
  px(ctx, 18, -4, 6, 8, '#2a2f3c');
  ctx.restore();
  ctx.fillStyle = flash > 0 ? '#fff0a8' : col;
  ctx.beginPath();
  ctx.arc(cx, cy, 11, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#20242f';
  ctx.beginPath();
  ctx.arc(cx - 3, cy - 2, 3, 0, TAU);
  ctx.fill();
}

export function drawBoss(ctx: C2D, b: Boss, camX: number, t: number, player: { x: number; y: number }) {
  const x = R(b.x - camX);
  const y = R(b.y);
  const pax = player.x - camX;
  const pay = player.y;
  const aimTo = (cx: number, cy: number) => Math.atan2(pay + 12 - cy, pax + 6 - cx);
  ctx.save();
  if (b.hurt > 0 && Math.floor(t * 30) % 2 === 0) ctx.globalAlpha = 0.75;

  switch (b.kind) {
    case 'fortress':
      ctx.restore();
      drawFortress(ctx, { x: b.x, y: b.y, hurt: b.hurt, coreOpen: b.coreOpen, cannons: b.parts }, camX, t);
      return;

    case 'tank': {
      const w = b.w;
      // 履带
      px(ctx, x, y + 34, w, 22, '#2a2e3a');
      const off = Math.floor((b.anim * 60 * Math.abs(b.vx)) % 10);
      for (let i = -10; i < w; i += 10) px(ctx, x + i + off, y + 36, 6, 18, '#4a5060');
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = '#6b7385';
        ctx.beginPath(); ctx.arc(x + 14 + i * 20, y + 46, 7, 0, TAU); ctx.fill();
        ctx.fillStyle = '#2a2e3a';
        ctx.beginPath(); ctx.arc(x + 14 + i * 20, y + 46, 3, 0, TAU); ctx.fill();
      }
      // 车体
      px(ctx, x + 4, y + 18, w - 8, 18, '#5a6a4a');
      px(ctx, x + 4, y + 18, w - 8, 3, '#8a9a6a');
      px(ctx, x + 2, y + 30, w - 4, 6, '#3a4a2a');
      px(ctx, x + w - 10, y + 6, 8, 12, '#3a4150');
      // 炮塔
      px(ctx, x + 34, y + 2, 40, 18, '#6d7d55');
      px(ctx, x + 34, y + 2, 40, 3, '#9aaa7a');
      ctx.fillStyle = b.phase === 1 ? '#ff4a3c' : '#c9414b';
      ctx.beginPath(); ctx.arc(x + 62, y + 8, 3, 0, TAU); ctx.fill();
      ctx.save();
      ctx.translate(x + 52, y + 10);
      ctx.rotate(aimTo(x + 52, y + 10));
      px(ctx, 0, -3, 46, 6, '#3d4656');
      px(ctx, 40, -4, 8, 8, '#2a2f3c');
      ctx.restore();
      break;
    }

    case 'heli': {
      const w = b.w;
      // 尾梁 & 尾翼
      px(ctx, x + 56, y + 18, 36, 6, '#4c5566');
      px(ctx, x + 86, y + 4, 6, 20, '#5c667a');
      const tr = Math.abs(Math.sin(t * 40)) * 14 + 2;
      px(ctx, x + 89 - tr / 2, y + 3, tr, 2, '#9aa3b8');
      // 机身
      ctx.fillStyle = '#4c5566';
      ctx.beginPath(); ctx.ellipse(x + 34, y + 22, 34, 14, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5c667a';
      ctx.beginPath(); ctx.ellipse(x + 34, y + 18, 30, 8, 0, 0, TAU); ctx.fill();
      // 座舱
      ctx.fillStyle = '#8fd6ff';
      ctx.beginPath(); ctx.ellipse(x + 12, y + 20, 11, 8, 0, 0, TAU); ctx.fill();
      px(ctx, x + 4, y + 16, 6, 3, '#ffffff');
      // 机炮 & 火箭巢
      px(ctx, x + 2, y + 28, 18, 4, '#2f3340');
      px(ctx, x + 18, y + 32, 26, 6, '#3a4150');
      px(ctx, x + 20, y + 33, 4, 4, '#ff7a3c');
      px(ctx, x + 28, y + 33, 4, 4, '#ff7a3c');
      px(ctx, x + 36, y + 33, 4, 4, '#ff7a3c');
      // 滑橇
      px(ctx, x + 10, y + 38, 50, 2, '#8e97ad');
      px(ctx, x + 16, y + 34, 2, 5, '#8e97ad');
      px(ctx, x + 50, y + 34, 2, 5, '#8e97ad');
      // 主旋翼
      px(ctx, x + 32, y + 2, 4, 8, '#5c667a');
      const rw = Math.abs(Math.cos(t * 30)) * (w + 10) + 10;
      px(ctx, x + 34 - rw / 2, y - 1, rw, 3, 'rgba(200,210,230,0.85)');
      break;
    }

    case 'mech': {
      const w = b.w;
      const walk = b.onGround ? Math.sin(b.anim * 8) : 0;
      // 腿
      const leg = (hx: number, ang: number, col: string) => {
        ctx.save();
        ctx.translate(hx, y + 52);
        ctx.rotate(ang);
        px(ctx, -5, 0, 10, 20, col);
        ctx.translate(0, 20);
        ctx.rotate(-ang * 1.6);
        px(ctx, -5, 0, 10, 12, col);
        px(ctx, -9, 10, 18, 5, '#2a2f3c');
        ctx.restore();
      };
      leg(x + 20, walk * 0.4, '#3d4656');
      leg(x + 40, -walk * 0.4, '#4a5466');
      // 躯干
      px(ctx, x + 6, y + 20, w - 12, 34, '#5b6577');
      px(ctx, x + 10, y + 24, w - 20, 22, '#7a8699');
      px(ctx, x + 14, y + 30, 6, 6, '#2a2f3c');
      px(ctx, x + 40, y + 30, 6, 6, '#2a2f3c');
      // 肩炮
      px(ctx, x - 6, y + 16, 16, 14, '#3a4150');
      px(ctx, x + w - 10, y + 16, 16, 14, '#3a4150');
      px(ctx, x - 12, y + 20, 10, 5, '#2a2f3c');
      px(ctx, x + w + 2, y + 20, 10, 5, '#2a2f3c');
      // 头 & 面甲
      px(ctx, x + 14, y + 2, 32, 18, '#6b7686');
      px(ctx, x + 12, y + 8, 36, 8, '#1d2232');
      const ex = x + 14 + ((Math.sin(t * 6) + 1) / 2) * 30;
      px(ctx, ex, y + 10, 5, 4, '#ff4a3c');
      break;
    }

    case 'spider': {
      const cx = x + b.w / 2;
      // 蛛丝
      ctx.strokeStyle = 'rgba(230,230,245,0.75)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, y + 10); ctx.stroke();
      // 腿
      ctx.strokeStyle = '#2c1f3a';
      ctx.lineWidth = 3;
      for (let s = -1; s <= 1; s += 2) {
        for (let i = 0; i < 4; i++) {
          const base = (i - 1.5) * 0.35;
          const wig = Math.sin(b.anim * (b.phase === 1 ? 20 : 6) + i) * 0.25;
          const a1 = -Math.PI / 2 + s * (0.9 + base) + wig;
          const jx = cx + 10 * s + Math.cos(a1) * 18;
          const jy = y + 22 + Math.sin(a1) * 18;
          ctx.beginPath();
          ctx.moveTo(cx + 10 * s, y + 22);
          ctx.lineTo(jx, jy);
          ctx.lineTo(jx + s * 14, jy + 22);
          ctx.stroke();
        }
      }
      // 腹部
      ctx.fillStyle = '#2c1f3a';
      ctx.beginPath(); ctx.ellipse(cx + 12, y + 22, 24, 18, 0, 0, TAU); ctx.fill();
      px(ctx, cx + 8, y + 12, 8, 6, '#e0342a');
      px(ctx, cx + 8, y + 26, 8, 6, '#e0342a');
      px(ctx, cx + 10, y + 18, 4, 8, '#e0342a');
      // 头
      ctx.fillStyle = '#3a2a4a';
      ctx.beginPath(); ctx.arc(cx - 16, y + 26, 12, 0, TAU); ctx.fill();
      for (let i = 0; i < 4; i++) px(ctx, cx - 26 + (i % 2) * 8, y + 20 + Math.floor(i / 2) * 6, 3, 3, '#ff5a3c');
      px(ctx, cx - 30, y + 32, 4, 8, '#1d1226');
      px(ctx, cx - 20, y + 34, 4, 8, '#1d1226');
      break;
    }

    case 'golem': {
      const w = b.w, h = b.h;
      px(ctx, x, y, w, h, '#4a3428');
      px(ctx, x, y, w, 5, '#7a5a44');
      for (let i = 0; i < h; i += 22) px(ctx, x + 4, y + i + 16, w - 8, 3, '#2e2018');
      // 裂纹发光
      const gl = 0.5 + 0.4 * Math.sin(t * 5);
      ctx.strokeStyle = `rgba(255,122,42,${gl})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 60, y + 10); ctx.lineTo(x + 70, y + 50); ctx.lineTo(x + 58, y + 90);
      ctx.moveTo(x + 110, y + 30); ctx.lineTo(x + 100, y + 80); ctx.lineTo(x + 116, y + 140);
      ctx.stroke();
      // 头部与嘴
      px(ctx, x + 10, y + 14, 44, 40, '#5a3e2e');
      px(ctx, x + 16, y + 30, 32, 10, '#1a0e08');
      for (let i = 0; i < 4; i++) px(ctx, x + 18 + i * 8, y + 30, 4, 4, '#e8d8b8');
      // 宝石（部件）
      b.parts.forEach((c, i) => {
        const gx = x + c.ox, gy = y + c.oy;
        px(ctx, gx - 18, gy - 16, 36, 32, '#3a2820');
        ctx.fillStyle = !c.alive ? '#1a1a1a' : b.beamIdx === i && b.beamCharge > 0 ? (Math.floor(t * 20) % 2 ? '#fff3b0' : '#ff9a3c') : c.flash > 0 ? '#ffffff' : '#ff5a3c';
        ctx.beginPath();
        ctx.moveTo(gx, gy - 12); ctx.lineTo(gx + 12, gy); ctx.lineTo(gx, gy + 12); ctx.lineTo(gx - 12, gy);
        ctx.closePath(); ctx.fill();
        if (c.alive) { px(ctx, gx - 3, gy - 6, 3, 5, 'rgba(255,255,255,0.7)'); }
      });
      // 光束
      if (b.beamT > 0) {
        const by = b.beamY;
        const x1 = x + 28;
        const grd = ctx.createLinearGradient(0, by - 12, 0, by + 12);
        grd.addColorStop(0, 'rgba(255,120,40,0)');
        grd.addColorStop(0.5, 'rgba(255,160,60,0.7)');
        grd.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(-10, by - 12, x1 + 10, 24);
        ctx.fillStyle = '#fff6c0';
        ctx.fillRect(-10, by - 3, x1 + 10, 6);
      } else if (b.beamCharge > 0 && b.beamIdx >= 0) {
        const c = b.parts[b.beamIdx];
        ctx.strokeStyle = `rgba(255,200,120,${0.3 + 0.5 * Math.sin(t * 25)})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x + c.ox, y + c.oy, 18 - b.beamCharge * 0.2, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,160,60,0.25)';
        ctx.beginPath(); ctx.moveTo(-10, b.beamY); ctx.lineTo(x + 28, b.beamY); ctx.stroke();
      }
      break;
    }

    case 'twins': {
      const p0 = { x: x + b.parts[0].ox, y: y + b.parts[0].oy };
      const p1 = { x: x + b.parts[1].ox, y: y + b.parts[1].oy };
      // 电弧
      ctx.strokeStyle = `rgba(155,231,255,${0.5 + 0.4 * Math.sin(t * 30)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < 6; i++) {
        const f = i / 6;
        ctx.lineTo(p0.x + (p1.x - p0.x) * f + (Math.random() - 0.5) * 12, p0.y + (p1.y - p0.y) * f + (Math.random() - 0.5) * 12);
      }
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      const orb = (o: { x: number; y: number }, col: string, col2: string, flash: number) => {
        const g = ctx.createRadialGradient(o.x - 4, o.y - 4, 2, o.x, o.y, 16);
        g.addColorStop(0, flash > 0 ? '#ffffff' : '#ffffff');
        g.addColorStop(0.35, col);
        g.addColorStop(1, col2);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(o.x, o.y, 13, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(o.x, o.y, 16, t * 3, t * 3 + Math.PI * 1.2); ctx.stroke();
      };
      orb(p0, '#ffb43c', '#a03a10', b.parts[0].flash);
      orb(p1, '#63e0ff', '#103a80', b.parts[1].flash);
      break;
    }

    case 'gunship': {
      const w = b.w;
      // 尾翼
      px(ctx, x + w - 24, y + 4, 24, 12, '#6a7386');
      px(ctx, x + w - 24, y + 40, 24, 12, '#6a7386');
      px(ctx, x + w - 12, y - 6, 8, 66, '#5a6376');
      // 气囊
      ctx.fillStyle = '#5a6376';
      ctx.beginPath(); ctx.ellipse(x + w / 2, y + 28, w / 2, 26, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6f7a90';
      ctx.beginPath(); ctx.ellipse(x + w / 2, y + 20, w / 2 - 10, 12, 0, 0, TAU); ctx.fill();
      for (let i = 20; i < w - 20; i += 30) px(ctx, x + i, y + 6, 2, 44, 'rgba(0,0,0,0.18)');
      px(ctx, x + 60, y + 24, 80, 6, '#c9414b');
      // 吊舱
      px(ctx, x + 56, y + 50, 88, 16, '#3a4150');
      px(ctx, x + 56, y + 50, 88, 3, '#6d7789');
      for (let i = 0; i < 6; i++) px(ctx, x + 62 + i * 14, y + 55, 6, 5, Math.sin(t * 2 + i) > 0 ? '#ffd35c' : '#8a6a2a');
      // 螺旋桨
      const rr = Math.abs(Math.sin(t * 30)) * 20 + 3;
      px(ctx, x + w - 4, y + 28 - rr / 2, 3, rr, '#c8d0e0');
      // 核心
      const cr = coreRect(b);
      if (cr) {
        const cx = cr.x - camX + cr.w / 2, cy = cr.y + cr.h / 2;
        px(ctx, cr.x - camX, cr.y, cr.w, cr.h, '#2b3040');
        if (b.coreOpen) {
          const gl = ctx.createRadialGradient(cx, cy, 2, cx, cy, 16);
          gl.addColorStop(0, '#fff7c2'); gl.addColorStop(0.5, '#ffb23c'); gl.addColorStop(1, 'rgba(255,60,30,0.1)');
          ctx.fillStyle = gl;
          ctx.beginPath(); ctx.arc(cx, cy, 12 + Math.sin(t * 12), 0, TAU); ctx.fill();
        } else {
          for (let i = 0; i < 3; i++) px(ctx, cr.x - camX + 4, cr.y + 4 + i * 7, cr.w - 8, 3, '#4c5568');
        }
      }
      // 炮塔
      for (const c of b.parts) turretDome(ctx, x + c.ox, y + c.oy, aimTo(x + c.ox, y + c.oy), c.alive, c.flash, '#8b93a8');
      break;
    }

    case 'train': {
      const w = b.w, h = b.h;
      // 车轮
      const nWheels = Math.floor((w - 20) / 36);
      for (let i = 0; i < nWheels; i++) {
        const wx = x + 20 + i * 36, wy = y + h - 8;
        ctx.fillStyle = '#3a3f4c';
        ctx.beginPath(); ctx.arc(wx, wy, 9, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#9aa3b8';
        ctx.lineWidth = 2;
        const ra = b.anim * 6;
        ctx.beginPath(); ctx.moveTo(wx - Math.cos(ra) * 7, wy - Math.sin(ra) * 7); ctx.lineTo(wx + Math.cos(ra) * 7, wy + Math.sin(ra) * 7); ctx.stroke();
      }
      // 车身
      px(ctx, x + 60, y + 14, w - 60, 44, '#4a5163');
      px(ctx, x + 60, y + 14, w - 60, 4, '#7c8699');
      for (let i = 70; i < w; i += 26) px(ctx, x + i, y + 22, 2, 30, '#2a2f3d');
      px(ctx, x + 64, y + 40, w - 68, 6, '#c9414b');
      // 车头
      px(ctx, x + 4, y + 6, 60, 52, '#3a4150');
      px(ctx, x + 4, y + 6, 60, 4, '#6d7789');
      px(ctx, x + 36, y - 14, 14, 24, '#2a2f3c');
      px(ctx, x + 34, y - 16, 18, 4, '#4a5163');
      ctx.fillStyle = '#2a2f3c';
      ctx.beginPath(); ctx.moveTo(x + 4, y + 40); ctx.lineTo(x - 14, y + 62); ctx.lineTo(x + 4, y + 62); ctx.closePath(); ctx.fill();
      px(ctx, x + 8, y + 12, 10, 8, '#ffd35c');
      // 核心（锅炉）
      const cr = coreRect(b);
      if (cr) {
        const cx = cr.x - camX + cr.w / 2, cy = cr.y + cr.h / 2;
        ctx.fillStyle = '#20242f';
        ctx.beginPath(); ctx.arc(cx, cy, 14, 0, TAU); ctx.fill();
        if (b.coreOpen) {
          const gl = ctx.createRadialGradient(cx, cy, 2, cx, cy, 14);
          gl.addColorStop(0, '#fff7c2'); gl.addColorStop(0.5, '#ff8a3c'); gl.addColorStop(1, 'rgba(255,60,30,0.1)');
          ctx.fillStyle = gl;
          ctx.beginPath(); ctx.arc(cx, cy, 11 + Math.sin(t * 12), 0, TAU); ctx.fill();
        } else {
          ctx.fillStyle = '#4c5568';
          ctx.beginPath(); ctx.arc(cx, cy, 10, 0, TAU); ctx.fill();
          px(ctx, cx - 8, cy - 1, 16, 2, '#2b3040');
          px(ctx, cx - 1, cy - 8, 2, 16, '#2b3040');
        }
      }
      // 炮塔
      for (const c of b.parts) turretDome(ctx, x + c.ox, y + c.oy, aimTo(x + c.ox, y + c.oy), c.alive, c.flash, '#7d8aa0');
      break;
    }

    case 'heart': {
      const w = b.w, h = b.h;
      void w;
      const pulse = 0.5 + 0.5 * Math.sin(t * 6);
      // 肉壁
      px(ctx, x + 40, y, w - 40, h, '#5a1a2a');
      px(ctx, x + 6, y + 4, 44, h - 8, '#7a2436');
      ctx.fillStyle = '#4a1020';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath(); ctx.arc(x + 60 + i * 24, y + 20 + (i % 2) * 120, 16, 0, TAU); ctx.fill();
      }
      // 血管
      ctx.strokeStyle = `rgba(255,90,110,${0.45 + pulse * 0.4})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 40, y + 96); ctx.quadraticCurveTo(x + 90, y + 60, x + 150, y + 40);
      ctx.moveTo(x + 40, y + 96); ctx.quadraticCurveTo(x + 100, y + 130, x + 160, y + 150);
      ctx.moveTo(x + 40, y + 96); ctx.lineTo(x + 190, y + 96);
      ctx.stroke();
      // 嘴（部件）
      for (const c of b.parts) {
        const mx = x + c.ox, my = y + c.oy;
        if (!c.alive) {
          px(ctx, mx - 18, my - 15, 36, 30, '#2a0a12');
          continue;
        }
        const open = c.flash > 0 ? 12 : 6 + pulse * 4;
        ctx.fillStyle = '#9a2a44';
        ctx.beginPath(); ctx.ellipse(mx, my, 20, 16, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1a0408';
        ctx.beginPath(); ctx.ellipse(mx - 4, my, 12, open, 0, 0, TAU); ctx.fill();
        for (let i = 0; i < 4; i++) {
          px(ctx, mx - 12 + i * 6, my - open, 3, 4, '#f0e0c0');
          px(ctx, mx - 12 + i * 6, my + open - 4, 3, 4, '#f0e0c0');
        }
      }
      // 心脏核心
      const cr = coreRect(b)!;
      const cx = cr.x - camX + cr.w / 2, cy = cr.y + cr.h / 2;
      const s = 1 + pulse * 0.12;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(s, s);
      ctx.fillStyle = b.coreOpen ? '#ff4a5c' : '#5a1a2a';
      ctx.beginPath();
      ctx.moveTo(0, 18);
      ctx.bezierCurveTo(-26, -4, -14, -26, 0, -12);
      ctx.bezierCurveTo(14, -26, 26, -4, 0, 18);
      ctx.fill();
      if (b.coreOpen) {
        ctx.fillStyle = `rgba(255,240,200,${0.5 + pulse * 0.4})`;
        ctx.beginPath(); ctx.arc(-4, -6, 5, 0, TAU); ctx.fill();
      } else {
        ctx.strokeStyle = '#8a3a4a';
        ctx.lineWidth = 3;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-20, i * 8); ctx.lineTo(20, i * 8 + 4); ctx.stroke(); }
      }
      ctx.restore();
      break;
    }
  }
  ctx.restore();
  void VIEW_H;
}
