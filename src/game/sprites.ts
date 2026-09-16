import { VIEW_H, VIEW_W } from './types';
import type { Enemy, Item, Platform, Player, Theme } from './types';

export const FONT_CN = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", "Hiragino Sans GB", sans-serif';

/** Structural view used by the fortress-style boss renderer (shared by 哨戒要塞). */
export interface FortressView {
  x: number;
  y: number;
  hurt: number;
  coreOpen: boolean;
  cannons: { ox: number; oy: number; alive: boolean; flash: number; hp: number }[];
}

type C2D = CanvasRenderingContext2D;

const R = (n: number) => Math.round(n);

export function px(ctx: C2D, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(R(x), R(y), Math.max(1, R(w)), Math.max(1, R(h)));
}

function limb(ctx: C2D, x: number, y: number, len: number, wide: number, ang: number, c: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = c;
  ctx.fillRect(0, -wide / 2, len, wide);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Background                                                          */
/* ------------------------------------------------------------------ */

const STARS: { x: number; y: number; s: number }[] = [];
for (let i = 0; i < 90; i++) {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.6789;
  STARS.push({ x: (a - Math.floor(a)) * 1600, y: (b - Math.floor(b)) * 130, s: i % 7 === 0 ? 2 : 1 });
}

function ridge(ctx: C2D, off: number, baseY: number, amp: number, seed: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-10, VIEW_H);
  for (let x = -10; x <= VIEW_W + 10; x += 6) {
    const wx = x + off;
    const h =
      Math.sin(wx * 0.0102 + seed) * amp +
      Math.sin(wx * 0.0271 + seed * 2.3) * amp * 0.45 +
      Math.sin(wx * 0.061 + seed * 4.1) * amp * 0.18;
    ctx.lineTo(x, baseY - h);
  }
  ctx.lineTo(VIEW_W + 10, VIEW_H);
  ctx.closePath();
  ctx.fill();
}

function palm(ctx: C2D, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + 3 * s, y - 22 * s, x + 1 * s, y - 42 * s);
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI * 0.92 + i * 0.44;
    ctx.lineWidth = 2.4 * s;
    ctx.beginPath();
    ctx.moveTo(x + s, y - 42 * s);
    ctx.quadraticCurveTo(
      x + s + Math.cos(a) * 16 * s,
      y - 42 * s + Math.sin(a) * 14 * s,
      x + s + Math.cos(a) * 26 * s,
      y - 40 * s + Math.sin(a) * 6 * s + 8 * s,
    );
    ctx.stroke();
  }
}

function bushTree(ctx: C2D, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(R(x - 2 * s), R(y - 26 * s), R(4 * s), R(26 * s));
  const blobs = [
    [0, -32, 15], [-12, -26, 11], [12, -27, 12], [-6, -40, 10], [8, -39, 9],
  ];
  for (const [bx, by, br] of blobs) {
    ctx.beginPath();
    ctx.arc(x + bx * s, y + by * s, br * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

interface Pal {
  sky: [string, string, string, string, string];
  ridge1: string;
  ridge2: string;
  mid: string;
  near: string;
  sil: 'jungle' | 'industrial' | 'tendril' | 'pine' | 'city' | 'cave' | 'lava' | 'sky' | 'desert';
  grass: [string, string];
  moon: string;
  fx?: 'snow' | 'ember' | 'water' | 'spore' | 'sand';
}

const PALS: Record<Theme, Pal> = {
  jungle: { sky: ['#120c2c', '#2b1546', '#6d2a4d', '#bd4d3f', '#f0913f'], ridge1: '#301a45', ridge2: '#3d1f46', mid: '#24123a', near: '#150a24', sil: 'jungle', grass: ['#2f7a38', '#48a84b'], moon: '#ffe7bd' },
  base: { sky: ['#0a1020', '#15203b', '#253556', '#3a4e76', '#ff6a3c'], ridge1: '#18243c', ridge2: '#1f2e4c', mid: '#16233a', near: '#0c1424', sil: 'industrial', grass: ['#3a4a5a', '#5a6a7a'], moon: '#dfe8ff' },
  snow: { sky: ['#0b1630', '#16305a', '#3a6a9a', '#8fb7d9', '#e8f4ff'], ridge1: '#c9dcee', ridge2: '#9ab8d6', mid: '#1c3352', near: '#0e1f36', sil: 'pine', grass: ['#dfe9f5', '#ffffff'], moon: '#f4f8ff', fx: 'snow' },
  city: { sky: ['#05060f', '#0e1230', '#2a1c4a', '#5a2a52', '#ff8a4a'], ridge1: '#141a33', ridge2: '#1a2140', mid: '#0f1328', near: '#07091a', sil: 'city', grass: ['#4b4f5a', '#6c717d'], moon: '#ffe0b0' },
  cave: { sky: ['#050508', '#0b0c14', '#131625', '#1c2133', '#2c3550'], ridge1: '#0f1220', ridge2: '#151a2c', mid: '#0a0d18', near: '#06080f', sil: 'cave', grass: ['#3a5a6a', '#5c8c9c'], moon: '#9ad9ff', fx: 'spore' },
  lava: { sky: ['#1a0604', '#3a0c06', '#6d1a0a', '#a83814', '#ff7a2a'], ridge1: '#2a0a06', ridge2: '#3d100a', mid: '#200705', near: '#120403', sil: 'lava', grass: ['#5a2a1a', '#8a3a1a'], moon: '#ffb070', fx: 'ember' },
  waterfall: { sky: ['#0a1a2a', '#123a4a', '#1f6a6a', '#4aa08a', '#bfe8c8'], ridge1: '#0f3a44', ridge2: '#155050', mid: '#0c2a30', near: '#061a1e', sil: 'jungle', grass: ['#2f8a58', '#5ac878'], moon: '#e8fff4', fx: 'water' },
  sky: { sky: ['#0d1a4a', '#1e3c8a', '#3f74c8', '#8fbcf0', '#ffd9a8'], ridge1: '#ffffff', ridge2: '#e6eefc', mid: '#c8d8f4', near: '#a8bfe8', sil: 'sky', grass: ['#6a7a90', '#9aa8bc'], moon: '#fff6dc' },
  desert: { sky: ['#1a0a1e', '#4a1a30', '#9a3a2a', '#e08a3a', '#ffd070'], ridge1: '#5a2a24', ridge2: '#7a3a2a', mid: '#3a1a18', near: '#22100e', sil: 'desert', grass: ['#c89a4a', '#e8c070'], moon: '#fff0c0', fx: 'sand' },
  alien: { sky: ['#0c051a', '#240838', '#56104c', '#991f58', '#ff3b7a'], ridge1: '#380e3b', ridge2: '#481347', mid: '#2d0833', near: '#17031c', sil: 'tendril', grass: ['#7a2a7a', '#c04ab0'], moon: '#ffc0e8', fx: 'spore' },
};

export function themeGrass(theme: Theme): [string, string] {
  return PALS[theme].grass;
}

export function drawBackground(ctx: C2D, camX: number, t: number, theme: Theme = 'jungle') {
  const pal = PALS[theme];
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  const stops = [0, 0.32, 0.58, 0.8, 0.97];
  pal.sky.forEach((c, i) => g.addColorStop(stops[i], c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // stars
  if (theme !== 'sky' && theme !== 'snow') {
    const so = camX * 0.08;
    for (const s of STARS) {
      const x = ((s.x - so) % 1600 + 1600) % 1600;
      if (x > VIEW_W) continue;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + s.x));
      ctx.globalAlpha = tw * (1 - s.y / 190);
      px(ctx, x, s.y, s.s, s.s, '#ffe9c9');
    }
    ctx.globalAlpha = 1;
  }

  // moon / sun
  if (theme !== 'cave') {
    const mx = 372 - camX * 0.05;
    const my = 46;
    const grd = ctx.createRadialGradient(mx, my, 6, mx, my, 46);
    grd.addColorStop(0, 'rgba(255,224,170,0.40)');
    grd.addColorStop(1, 'rgba(255,224,170,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(mx - 50, my - 50, 100, 100);
    ctx.fillStyle = pal.moon;
    ctx.beginPath();
    ctx.arc(mx, my, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,90,70,0.35)';
    [[-7, -5, 4], [5, 3, 5], [-2, 9, 3], [9, -8, 2.4]].forEach(([a, b, r]) => {
      ctx.beginPath();
      ctx.arc(mx + a, my + b, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawSilhouettes(ctx, camX, t, pal);
  drawWeather(ctx, camX, t, pal);
}

function drawWeather(ctx: C2D, camX: number, t: number, pal: Pal) {
  if (!pal.fx) return;
  for (let i = 0; i < 40; i++) {
    const sx = (i * 137.3) % 1;
    const sy = (i * 71.7) % 1;
    let x: number, y: number, c: string, s = 2;
    if (pal.fx === 'snow') {
      x = ((sx * 520 + Math.sin(t + i) * 12 - camX * 0.3) % 520 + 520) % 520 - 20;
      y = ((sy * 270 + t * (18 + sx * 20)) % 270);
      c = 'rgba(255,255,255,0.8)';
    } else if (pal.fx === 'ember') {
      x = ((sx * 520 + Math.sin(t * 1.5 + i) * 10 - camX * 0.3) % 520 + 520) % 520 - 20;
      y = 270 - ((sy * 270 + t * (14 + sx * 26)) % 270);
      c = i % 3 === 0 ? '#ffd070' : '#ff7a2a';
    } else if (pal.fx === 'spore') {
      x = ((sx * 520 + Math.sin(t * 0.8 + i) * 16 - camX * 0.25) % 520 + 520) % 520 - 20;
      y = 270 - ((sy * 270 + t * (6 + sx * 10)) % 270);
      c = 'rgba(180,255,220,0.55)';
      s = 1 + (i % 2);
    } else if (pal.fx === 'sand') {
      x = ((sx * 520 + t * (60 + sx * 60) - camX * 0.5) % 520 + 520) % 520 - 20;
      y = 120 + ((sy * 150 + Math.sin(t * 2 + i) * 6) % 150);
      c = 'rgba(255,220,150,0.45)';
      s = 3;
      px(ctx, x, y, s * 2, 1, c);
      continue;
    } else {
      // water mist streaks
      x = ((sx * 520 - camX * 0.6) % 520 + 520) % 520 - 20;
      y = ((sy * 270 + t * 90) % 270);
      c = 'rgba(220,255,255,0.35)';
      px(ctx, x, y, 1, 8, c);
      continue;
    }
    px(ctx, x, y, s, s, c);
  }
}

function drawSilhouettes(ctx: C2D, camX: number, t: number, pal: Pal) {
  const theme = pal.sil;
  if (theme === 'industrial') {
    ridge(ctx, camX * 0.12, 196, 46, 1.2, pal.ridge1);
    ridge(ctx, camX * 0.24, 208, 30, 4.7, pal.ridge2);
    const midOff = camX * 0.45;
    const step = 90;
    const start = Math.floor(midOff / step) - 1;
    for (let i = start; i < start + Math.ceil(VIEW_W / step) + 3; i++) {
      const x = i * step - midOff;
      px(ctx, x, 140, 36, 100, '#16233a');
      px(ctx, x + 4, 136, 28, 6, '#283c5e');
      px(ctx, x + 16, 108, 4, 28, '#283c5e');
    }
    const nearOff = camX * 0.72;
    const s2 = 70;
    const st2 = Math.floor(nearOff / s2) - 1;
    for (let i = st2; i < st2 + Math.ceil(VIEW_W / s2) + 3; i++) {
      const x = i * s2 - nearOff;
      px(ctx, x, 160, 48, 110, pal.near);
      px(ctx, x + 10, 150, 4, 20, '#192842');
      px(ctx, x + 34, 150, 4, 20, '#192842');
    }
    return;
  }

  if (theme === 'tendril') {
    ridge(ctx, camX * 0.12, 196, 46, 1.2, pal.ridge1);
    ridge(ctx, camX * 0.24, 208, 30, 4.7, pal.ridge2);
    const midOff = camX * 0.45;
    const step = 82;
    const start = Math.floor(midOff / step) - 1;
    for (let i = start; i < start + Math.ceil(VIEW_W / step) + 3; i++) {
      const x = i * step - midOff;
      ctx.fillStyle = pal.mid;
      ctx.beginPath();
      ctx.moveTo(x, 240);
      ctx.quadraticCurveTo(x + 10 + Math.sin(t + i) * 3, 160, x + 4, 120);
      ctx.quadraticCurveTo(x - 2, 160, x + 18, 240);
      ctx.fill();
    }
    const nearOff = camX * 0.72;
    const s2 = 64;
    const st2 = Math.floor(nearOff / s2) - 1;
    for (let i = st2; i < st2 + Math.ceil(VIEW_W / s2) + 3; i++) {
      const x = i * s2 - nearOff;
      ctx.fillStyle = pal.near;
      ctx.beginPath();
      ctx.arc(x + 14, 210, 24, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  if (theme === 'pine') {
    ridge(ctx, camX * 0.1, 190, 50, 2.2, pal.ridge1);
    ridge(ctx, camX * 0.22, 206, 32, 5.1, pal.ridge2);
    const tree = (x: number, y: number, s: number, c: string) => {
      ctx.fillStyle = c;
      for (let k = 0; k < 3; k++) {
        const w = (26 - k * 6) * s, h = 18 * s;
        const ty = y - k * 12 * s;
        ctx.beginPath();
        ctx.moveTo(x, ty - h);
        ctx.lineTo(x - w / 2, ty);
        ctx.lineTo(x + w / 2, ty);
        ctx.closePath();
        ctx.fill();
      }
      px(ctx, x - 2 * s, y, 4 * s, 8 * s, c);
    };
    const midOff = camX * 0.45;
    for (let i = Math.floor(midOff / 70) - 1; i < Math.floor(midOff / 70) + 9; i++) {
      const r1 = Math.abs(Math.sin(i * 33.7));
      tree(i * 70 - midOff, 232 - r1 * 8, 0.9 + r1 * 0.3, pal.mid);
    }
    const nearOff = camX * 0.72;
    for (let i = Math.floor(nearOff / 54) - 1; i < Math.floor(nearOff / 54) + 11; i++) {
      const r1 = Math.abs(Math.sin(i * 91.3));
      tree(i * 54 - nearOff, 262, 1.2 + r1 * 0.4, pal.near);
    }
    return;
  }

  if (theme === 'city') {
    ridge(ctx, camX * 0.1, 200, 30, 2.2, pal.ridge1);
    const midOff = camX * 0.4;
    for (let i = Math.floor(midOff / 60) - 1; i < Math.floor(midOff / 60) + 10; i++) {
      const r1 = Math.abs(Math.sin(i * 45.1));
      const h = 60 + r1 * 90;
      const x = i * 60 - midOff;
      px(ctx, x, 236 - h, 44, h, pal.mid);
      for (let wy = 0; wy < h - 10; wy += 10) {
        for (let wx = 4; wx < 40; wx += 10) {
          if (Math.sin(i * 7 + wy * 0.3 + wx) > 0.2) px(ctx, x + wx, 240 - h + wy, 4, 5, 'rgba(255,220,140,0.55)');
        }
      }
    }
    const nearOff = camX * 0.7;
    for (let i = Math.floor(nearOff / 90) - 1; i < Math.floor(nearOff / 90) + 7; i++) {
      const r1 = Math.abs(Math.sin(i * 19.7));
      const h = 90 + r1 * 80;
      const x = i * 90 - nearOff;
      px(ctx, x, 270 - h, 64, h, pal.near);
      px(ctx, x + 28, 262 - h, 6, 10, pal.near);
      if (i % 2 === 0) px(ctx, x + 30, 258 - h, 2, 2, Math.floor(t * 2) % 2 ? '#ff4a4a' : '#5a1a1a');
    }
    return;
  }

  if (theme === 'cave') {
    // stalactites from ceiling
    const off = camX * 0.3;
    ctx.fillStyle = pal.ridge2;
    for (let i = Math.floor(off / 40) - 1; i < Math.floor(off / 40) + 14; i++) {
      const r1 = Math.abs(Math.sin(i * 12.9));
      const x = i * 40 - off;
      ctx.beginPath();
      ctx.moveTo(x - 14, 0);
      ctx.lineTo(x + 14, 0);
      ctx.lineTo(x, 30 + r1 * 60);
      ctx.closePath();
      ctx.fill();
    }
    ridge(ctx, camX * 0.15, 200, 40, 3.3, pal.ridge1);
    const nearOff = camX * 0.6;
    for (let i = Math.floor(nearOff / 80) - 1; i < Math.floor(nearOff / 80) + 8; i++) {
      const x = i * 80 - nearOff;
      const r1 = Math.abs(Math.sin(i * 77.7));
      ctx.fillStyle = pal.near;
      ctx.beginPath();
      ctx.arc(x + 20, 246, 28 + r1 * 14, 0, Math.PI * 2);
      ctx.fill();
      // glowing crystals
      const gl = 0.5 + 0.4 * Math.sin(t * 3 + i);
      px(ctx, x + 6, 214 - r1 * 10, 3, 10, `rgba(120,220,255,${gl})`);
      px(ctx, x + 12, 210 - r1 * 10, 2, 14, `rgba(120,220,255,${gl})`);
    }
    return;
  }

  if (theme === 'lava') {
    ridge(ctx, camX * 0.12, 190, 50, 1.9, pal.ridge1);
    ridge(ctx, camX * 0.24, 206, 34, 4.2, pal.ridge2);
    const midOff = camX * 0.45;
    for (let i = Math.floor(midOff / 76) - 1; i < Math.floor(midOff / 76) + 9; i++) {
      const x = i * 76 - midOff;
      const r1 = Math.abs(Math.sin(i * 31.1));
      ctx.fillStyle = pal.mid;
      ctx.beginPath();
      ctx.moveTo(x - 16, 240);
      ctx.lineTo(x + 2, 150 - r1 * 50);
      ctx.lineTo(x + 20, 240);
      ctx.closePath();
      ctx.fill();
    }
    // lava glow pools
    const nearOff = camX * 0.72;
    for (let i = Math.floor(nearOff / 120) - 1; i < Math.floor(nearOff / 120) + 6; i++) {
      const x = i * 120 - nearOff;
      const gl = 0.5 + 0.3 * Math.sin(t * 4 + i);
      ctx.fillStyle = `rgba(255,120,40,${gl})`;
      ctx.fillRect(x, 246, 70, 6);
      ctx.fillStyle = pal.near;
      ctx.fillRect(x + 70, 240, 50, 30);
    }
    return;
  }

  if (theme === 'sky') {
    // cloud layers
    const cloud = (x: number, y: number, s: number, c: string) => {
      ctx.fillStyle = c;
      [[0, 0, 22], [-20, 6, 16], [22, 6, 18], [8, -8, 14], [-8, -6, 12]].forEach(([a, b, r]) => {
        ctx.beginPath();
        ctx.arc(x + a * s, y + b * s, r * s, 0, Math.PI * 2);
        ctx.fill();
      });
    };
    const far = camX * 0.15;
    for (let i = Math.floor(far / 140) - 1; i < Math.floor(far / 140) + 6; i++) {
      cloud(i * 140 - far + 30, 120 + Math.abs(Math.sin(i * 3.3)) * 30, 0.8, 'rgba(255,255,255,0.35)');
    }
    const mid = camX * 0.4;
    for (let i = Math.floor(mid / 170) - 1; i < Math.floor(mid / 170) + 5; i++) {
      cloud(i * 170 - mid + 60, 180 + Math.abs(Math.sin(i * 7.1)) * 30, 1.2, pal.mid);
    }
    const near = camX * 0.7;
    for (let i = Math.floor(near / 200) - 1; i < Math.floor(near / 200) + 5; i++) {
      cloud(i * 200 - near + 40, 262, 1.8, pal.near);
    }
    return;
  }

  if (theme === 'desert') {
    ridge(ctx, camX * 0.1, 200, 22, 1.4, pal.ridge1);
    ridge(ctx, camX * 0.25, 214, 18, 3.9, pal.ridge2);
    const midOff = camX * 0.45;
    for (let i = Math.floor(midOff / 110) - 1; i < Math.floor(midOff / 110) + 7; i++) {
      const x = i * 110 - midOff;
      // cactus
      px(ctx, x, 200, 6, 36, pal.mid);
      px(ctx, x - 8, 210, 8, 4, pal.mid);
      px(ctx, x - 8, 200, 4, 14, pal.mid);
      px(ctx, x + 6, 206, 8, 4, pal.mid);
      px(ctx, x + 10, 196, 4, 14, pal.mid);
    }
    ridge(ctx, camX * 0.7, 250, 14, 6.6, pal.near);
    return;
  }

  // jungle (default)
  ridge(ctx, camX * 0.12, 196, 46, 1.2, pal.ridge1);
  ridge(ctx, camX * 0.24, 208, 30, 4.7, pal.ridge2);
  const midOff = camX * 0.45;
  const step = 78;
  const start = Math.floor(midOff / step) - 1;
  for (let i = start; i < start + Math.ceil(VIEW_W / step) + 3; i++) {
    const x = i * step - midOff;
    const r1 = Math.abs(Math.sin(i * 33.7)) % 1;
    const y = 232 - r1 * 10;
    if (i % 2 === 0) palm(ctx, x, y, 0.85 + r1 * 0.3, pal.mid);
    else bushTree(ctx, x, y, 0.8 + r1 * 0.35, pal.mid);
  }
  const nearOff = camX * 0.72;
  const s2 = 56;
  const st2 = Math.floor(nearOff / s2) - 1;
  for (let i = st2; i < st2 + Math.ceil(VIEW_W / s2) + 3; i++) {
    const x = i * s2 - nearOff;
    const r1 = Math.abs(Math.sin(i * 91.3)) % 1;
    if (i % 3 === 0) palm(ctx, x, 262, 1.1 + r1 * 0.3, pal.near);
    else bushTree(ctx, x, 266, 1.0 + r1 * 0.4, pal.near);
  }
}

/* ------------------------------------------------------------------ */
/* Terrain                                                             */
/* ------------------------------------------------------------------ */

export function drawPlatform(ctx: C2D, p: Platform, camX: number, grass?: [string, string]) {
  const x = p.x - camX;
  if (x > VIEW_W + 20 || x + p.w < -20) return;
  const y = p.y;
  const style = p.style ?? 'rock';

  if (style === 'bridge') {
    px(ctx, x, y + 2, p.w, 5, '#6b4526');
    for (let i = 0; i < p.w; i += 9) px(ctx, x + i, y + 2, 1, 5, '#432a16');
    px(ctx, x, y, p.w, 2, '#8a5c34');
    px(ctx, x, y + 7, p.w, 1, '#2c1a0d');
    // rope hangers
    px(ctx, x + 1, y - 6, 1, 6, '#5d4020');
    px(ctx, x + p.w - 2, y - 6, 1, 6, '#5d4020');
    return;
  }

  if (style === 'metal') {
    px(ctx, x, y, p.w, p.h, '#4a5062');
    px(ctx, x, y, p.w, 2, '#8e97ad');
    px(ctx, x, y + 2, p.w, 2, '#5f677c');
    px(ctx, x, y + p.h - 2, p.w, 2, '#242836');
    for (let i = 6; i < p.w - 4; i += 16) {
      px(ctx, x + i, y + 6, 2, 2, '#8e97ad');
      if (p.h > 20) px(ctx, x + i, y + p.h - 10, 2, 2, '#2c3140');
    }
    for (let i = 20; i < p.w; i += 40) px(ctx, x + i, y + 4, 1, p.h - 6, '#39404f');
    if (p.h > 16) {
      ctx.fillStyle = 'rgba(255,120,60,0.10)';
      ctx.fillRect(R(x), R(y + 4), R(p.w), R(p.h - 6));
    }
    return;
  }

  if (style === 'crate') {
    px(ctx, x, y, p.w, p.h, '#5d6640');
    px(ctx, x, y, p.w, 2, '#8d9862');
    px(ctx, x + 1, y + 3, p.w - 2, p.h - 5, '#4a5233');
    ctx.strokeStyle = '#8d9862';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(R(x) + 2.5, R(y) + 4.5);
    ctx.lineTo(R(x + p.w) - 2.5, R(y + p.h) - 2.5);
    ctx.moveTo(R(x + p.w) - 2.5, R(y) + 4.5);
    ctx.lineTo(R(x) + 2.5, R(y + p.h) - 2.5);
    ctx.stroke();
    px(ctx, x, y + p.h - 2, p.w, 2, '#222819');
    return;
  }

  // rock / earth
  px(ctx, x, y, p.w, p.h, '#4c3a2a');
  px(ctx, x, y + 4, p.w, p.h - 4, '#3c2d20');
  // grass cap (theme tinted)
  const g0 = grass?.[0] ?? '#2f7a38';
  const g1 = grass?.[1] ?? '#48a84b';
  px(ctx, x, y, p.w, 4, g0);
  px(ctx, x, y, p.w, 2, g1);
  for (let i = 0; i < p.w; i += 5) {
    const h = 2 + ((i * 7919) % 3);
    px(ctx, x + i, y + 4, 2, h, g0);
  }
  // speckles
  for (let i = 3; i < p.w; i += 11) {
    const oy = 8 + ((i * 131) % Math.max(4, p.h - 12));
    px(ctx, x + i, y + oy, 2, 2, '#5b452f');
    px(ctx, x + i + 4, y + oy + 5, 1, 1, '#2b2016');
  }
  if (p.h > 16) px(ctx, x, y + p.h - 3, p.w, 3, '#241a11');
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

const HERO = {
  skin: '#f6c193',
  skinDark: '#cf9163',
  band: '#e33b30',
  hair: '#2d2018',
  vest: '#f4efe2',
  pants: '#2f57c8',
  pantsDark: '#21409a',
  boot: '#2a2631',
  gun: '#cfd4de',
};

function heroStanding(ctx: C2D, p: Player, t: number) {
  const running = Math.abs(p.vx) > 0.2 && p.onGround;
  const phase = running ? Math.sin(p.anim * 11) : 0;
  const bob = running ? (Math.abs(Math.sin(p.anim * 11)) > 0.75 ? 1 : 0) : 0;
  const ang = Math.atan2(p.aimY, Math.abs(p.aimX) < 0.01 ? 0.0001 : Math.abs(p.aimX));
  const up = p.aimY < -0.9;

  // legs
  const hipX = 6, hipY = 15 + bob;
  limb(ctx, hipX, hipY, 9, 4, Math.PI / 2 - phase * 0.55, HERO.pantsDark);
  limb(ctx, hipX, hipY, 9, 4, Math.PI / 2 + phase * 0.55, HERO.pants);
  // boots
  const f1 = Math.PI / 2 - phase * 0.55, f2 = Math.PI / 2 + phase * 0.55;
  px(ctx, hipX + Math.cos(f1) * 9 - 2, hipY + Math.sin(f1) * 9 - 1, 5, 3, HERO.boot);
  px(ctx, hipX + Math.cos(f2) * 9 - 2, hipY + Math.sin(f2) * 9 - 1, 5, 3, HERO.boot);

  // torso
  px(ctx, 3, 7 + bob, 7, 9, HERO.vest);
  px(ctx, 3, 7 + bob, 2, 9, '#d9d2c1');
  px(ctx, 3, 14 + bob, 7, 2, '#7a5b34'); // belt
  // bandolier
  ctx.save();
  ctx.translate(6.5, 11 + bob);
  ctx.rotate(-0.7);
  px(ctx, -1, -5, 2, 10, '#8a6430');
  ctx.restore();

  // back arm
  limb(ctx, 4, 9 + bob, 6, 3, ang + 0.5, HERO.skinDark);

  // head
  const hy = bob;
  px(ctx, 3, 1 + hy, 7, 7, HERO.skin);
  px(ctx, 3, 1 + hy, 3, 7, '#e0a97b');
  px(ctx, 2, 1 + hy, 9, 2, HERO.band);
  px(ctx, 2, 3 + hy, 2, 4, HERO.hair);
  px(ctx, 8, 4 + hy, 1, 2, '#2a1d14'); // eye
  // headband tails
  px(ctx, -1, 2 + hy, 3, 1, HERO.band);
  px(ctx, -2, 4 + hy, 3, 1, HERO.band);

  // front arm + rifle
  const sx = 7, sy = 10 + bob;
  const aw = up ? -Math.PI / 2 : ang;
  limb(ctx, sx, sy, 7, 3, aw, HERO.skin);
  const gx = sx + Math.cos(aw) * 7;
  const gy = sy + Math.sin(aw) * 7;
  limb(ctx, gx, gy, 9, 3, aw, HERO.gun);
  limb(ctx, gx, gy, 4, 4, aw, '#8d94a3');
  if (p.shootFlash > 0) {
    const fx = gx + Math.cos(aw) * 10;
    const fy = gy + Math.sin(aw) * 10;
    ctx.fillStyle = '#fff6b0';
    ctx.beginPath();
    ctx.arc(fx, fy, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,170,40,0.75)';
    ctx.beginPath();
    ctx.arc(fx, fy, 5.2, 0, Math.PI * 2);
    ctx.fill();
  }
  void t;
}

function heroProne(ctx: C2D, p: Player) {
  // hitbox is 12 x 10 ; draw a lying soldier
  px(ctx, -3, 4, 12, 5, HERO.pants);
  px(ctx, -3, 4, 5, 5, HERO.pantsDark);
  px(ctx, -5, 6, 3, 3, HERO.boot);
  px(ctx, 6, 3, 7, 6, HERO.vest);
  px(ctx, 10, 1, 6, 6, HERO.skin);
  px(ctx, 10, 1, 7, 2, HERO.band);
  px(ctx, 8, 1, 3, 1, HERO.band);
  px(ctx, 14, 4, 1, 1, '#2a1d14');
  px(ctx, 12, 7, 10, 2, HERO.gun);
  px(ctx, 11, 6, 3, 3, '#8d94a3');
  if (p.shootFlash > 0) {
    ctx.fillStyle = '#fff6b0';
    ctx.beginPath();
    ctx.arc(24, 8, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function heroAir(ctx: C2D, p: Player, t: number) {
  // tucked somersault
  ctx.save();
  ctx.translate(6, 12);
  ctx.rotate(p.anim * 13 * (p.facing >= 0 ? 1 : -1));
  px(ctx, -5, -4, 9, 9, HERO.pants);
  px(ctx, -5, -4, 9, 4, HERO.vest);
  px(ctx, 1, -7, 6, 6, HERO.skin);
  px(ctx, 1, -7, 7, 2, HERO.band);
  px(ctx, -1, -7, 3, 1, HERO.band);
  px(ctx, -6, 3, 5, 3, HERO.boot);
  px(ctx, 0, 4, 5, 3, HERO.boot);
  px(ctx, 3, -2, 8, 2, HERO.gun);
  ctx.restore();
  void t;
}

export function drawHero(ctx: C2D, p: Player, camX: number, t: number) {
  if (!p.alive) return;
  ctx.save();
  if (p.invuln > 0 && Math.floor(t * 24) % 2 === 0) ctx.globalAlpha = 0.35;
  ctx.translate(R(p.x - camX + p.w / 2), R(p.y));
  ctx.scale(p.facing >= 0 ? 1 : -1, 1);
  ctx.translate(-p.w / 2, 0);
  if (p.prone) heroProne(ctx, p);
  else if (!p.onGround) heroAir(ctx, p, t);
  else heroStanding(ctx, p, t);
  ctx.restore();

  if (p.barrier > 0) {
    const a = 0.35 + 0.25 * Math.sin(t * 14);
    ctx.strokeStyle = `rgba(120,220,255,${p.barrier < 90 && Math.floor(t * 12) % 2 === 0 ? a * 0.3 : a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x - camX + p.w / 2, p.y + p.h / 2, 16, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (p.guard) {
    const sx = R(p.x - camX + p.w / 2 + p.facing * 8);
    const sy = R(p.y + p.h / 2);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(p.facing >= 0 ? 1 : -1, 1);
    // shield / blade panel
    const glow = 0.55 + 0.25 * Math.sin(t * 10);
    ctx.fillStyle = `rgba(150,220,255,${0.22 + glow * 0.15})`;
    ctx.beginPath();
    ctx.ellipse(4, 0, 11, 15, 0, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(210,240,255,${0.7 + glow * 0.3})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(4, 0, 11, 15, 0, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    px(ctx, 6, -2, 2, 4, '#eaf7ff');
    ctx.restore();

    if (p.knifeFlash > 0) {
      const k = p.knifeFlash / 8;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(p.facing >= 0 ? 1 : -1, 1);
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * k})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(4, 0, 17, -0.9, 0.9);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */
/* Enemies                                                             */
/* ------------------------------------------------------------------ */

const ENE = {
  skin: '#e6a877',
  suit: '#c4382f',
  suitDark: '#8f241f',
  helm: '#6d4a2b',
  boot: '#33262a',
  gun: '#2f3340',
};

function drawFoot(ctx: C2D, e: Enemy, camX: number, t: number) {
  const running = e.type === 'runner';
  const phase = running ? Math.sin(e.anim * 10) : 0;
  const flash = e.hurt > 4;
  const C = (c: string) => (flash ? '#ffffff' : c);
  ctx.save();
  ctx.translate(R(e.x - camX + e.w / 2), R(e.y));
  ctx.scale(e.dir >= 0 ? 1 : -1, 1);
  ctx.translate(-e.w / 2, 0);

  const hipX = 6, hipY = 14;
  limb(ctx, hipX, hipY, 8, 4, Math.PI / 2 - phase * 0.6, C(ENE.suitDark));
  limb(ctx, hipX, hipY, 8, 4, Math.PI / 2 + phase * 0.6, C(ENE.suit));
  const f1 = Math.PI / 2 - phase * 0.6;
  const f2 = Math.PI / 2 + phase * 0.6;
  px(ctx, hipX + Math.cos(f1) * 8 - 2, hipY + Math.sin(f1) * 8 - 1, 5, 3, C(ENE.boot));
  px(ctx, hipX + Math.cos(f2) * 8 - 2, hipY + Math.sin(f2) * 8 - 1, 5, 3, C(ENE.boot));
  px(ctx, 3, 6, 7, 9, C(ENE.suit));
  px(ctx, 3, 13, 7, 2, C('#4a3324'));
  px(ctx, 3, 0, 7, 7, C(ENE.skin));
  px(ctx, 2, -1, 9, 4, C(ENE.helm));
  px(ctx, 2, 2, 9, 1, C('#4a3320'));
  if (!flash) px(ctx, 8, 4, 1, 1, '#241812');
  // arms + rifle
  const aimAng = e.type === 'gunner' && e.timer > 40 ? -0.25 : 0;
  limb(ctx, 7, 9, 6, 3, aimAng, C(ENE.skin));
  limb(ctx, 7 + Math.cos(aimAng) * 6, 9 + Math.sin(aimAng) * 6, 10, 3, aimAng, C(ENE.gun));
  ctx.restore();
  void t;
}

function drawTurret(ctx: C2D, e: Enemy, camX: number, aimAng: number) {
  const x = e.x - camX + e.w / 2;
  const y = e.y + e.h;
  px(ctx, x - 12, y - 7, 24, 7, '#4b5163');
  px(ctx, x - 12, y - 7, 24, 2, '#79839b');
  px(ctx, x - 9, y - 3, 3, 3, '#2a2f3c');
  px(ctx, x + 6, y - 3, 3, 3, '#2a2f3c');
  ctx.save();
  ctx.translate(x, y - 8);
  ctx.rotate(aimAng);
  px(ctx, 0, -2.5, 16, 5, '#5c6478');
  px(ctx, 12, -3.5, 5, 7, '#3b4152');
  ctx.restore();
  ctx.fillStyle = e.hurt > 0 ? '#fff' : '#8b93a8';
  ctx.beginPath();
  ctx.arc(x, y - 8, 7, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9414b';
  ctx.beginPath();
  ctx.arc(x, y - 9, 2.4, 0, Math.PI * 2);
  ctx.fill();
  px(ctx, x - 7, y - 8, 14, 1, '#2b3040');
}

function drawFlyer(ctx: C2D, e: Enemy, camX: number, t: number) {
  const x = e.x - camX + e.w / 2;
  const y = e.y + e.h / 2;
  ctx.save();
  ctx.translate(R(x), R(y));
  // rotor
  const rw = Math.abs(Math.cos(t * 26)) * 16 + 4;
  px(ctx, -rw / 2, -9, rw, 2, '#9aa3b8');
  px(ctx, -1, -9, 2, 4, '#5c6478');
  // body
  ctx.fillStyle = e.hurt > 0 ? '#ffffff' : '#7d3a3a';
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  px(ctx, -9, -1, 18, 2, '#4b2222');
  ctx.fillStyle = '#ffd35c';
  ctx.beginPath();
  ctx.arc(3, -1, 2.2, 0, Math.PI * 2);
  ctx.fill();
  px(ctx, -4, 5, 8, 2, '#3a3a48');
  ctx.restore();
}

function drawPod(ctx: C2D, e: Enemy, camX: number, t: number) {
  const x = e.x - camX + e.w / 2;
  const y = e.y + e.h / 2;
  ctx.save();
  ctx.translate(R(x), R(y));
  const pulse = 0.5 + 0.5 * Math.sin(t * 8);
  ctx.fillStyle = `rgba(255,220,90,${0.18 + pulse * 0.22})`;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = e.hurt > 0 ? '#fff' : '#d9dee9';
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  px(ctx, -11, -1, 22, 2, '#7c8496');
  px(ctx, -4, -6, 8, 3, '#ffd35c');
  ctx.fillStyle = '#e8533a';
  ctx.beginPath();
  ctx.arc(0, 1, 3, 0, Math.PI * 2);
  ctx.fill();
  // little wings
  px(ctx, -15, -2, 5, 3, '#9aa3b8');
  px(ctx, 10, -2, 5, 3, '#9aa3b8');
  ctx.restore();
}

export function drawEnemy(ctx: C2D, e: Enemy, camX: number, t: number, aimAng = 0) {
  if (e.type === 'runner' || e.type === 'gunner') drawFoot(ctx, e, camX, t);
  else if (e.type === 'turret') drawTurret(ctx, e, camX, aimAng);
  else if (e.type === 'flyer') drawFlyer(ctx, e, camX, t);
  else drawPod(ctx, e, camX, t);
}

/* ------------------------------------------------------------------ */
/* Boss                                                                */
/* ------------------------------------------------------------------ */

export function drawFortress(ctx: C2D, b: FortressView, camX: number, t: number) {
  const x = R(b.x - camX);
  const y = R(b.y);
  const W = 190, H = 176;
  ctx.save();
  if (b.hurt > 0 && Math.floor(t * 30) % 2 === 0) ctx.globalAlpha = 0.85;

  // rear tower
  px(ctx, x + 40, y, W - 40, H, '#3f4657');
  px(ctx, x + 40, y, W - 40, 6, '#7c8699');
  px(ctx, x + 46, y + 8, W - 52, H - 16, '#333949');
  for (let i = 0; i < H - 26; i += 18) px(ctx, x + 48, y + 12 + i, W - 56, 2, '#2a2f3d');
  for (let i = 0; i < W - 60; i += 22) {
    px(ctx, x + 50 + i, y + 8, 3, 3, '#6d7789');
    px(ctx, x + 50 + i, y + H - 14, 3, 3, '#6d7789');
  }
  // antenna + beacon
  px(ctx, x + 150, y - 20, 3, 20, '#7c8699');
  ctx.fillStyle = Math.floor(t * 3) % 2 === 0 ? '#ff5a3c' : '#5c2a24';
  ctx.beginPath();
  ctx.arc(x + 151, y - 23, 3.4, 0, Math.PI * 2);
  ctx.fill();

  // front armour column
  px(ctx, x + 6, y + 4, 44, H - 8, '#4a5164');
  px(ctx, x + 6, y + 4, 44, 4, '#8d97ad');
  px(ctx, x + 6, y + H - 8, 44, 4, '#242938');
  px(ctx, x + 8, y + 12, 3, H - 24, '#606a80');

  // glowing vents
  const pulse = 0.45 + 0.35 * Math.sin(t * 5);
  ctx.fillStyle = `rgba(255,120,40,${pulse})`;
  ctx.fillRect(x + 56, y + H - 30, 28, 8);
  ctx.fillRect(x + W - 44, y + H - 30, 28, 8);

  // cannons
  for (const c of b.cannons) {
    const cx = x + c.ox;
    const cy = y + c.oy;
    if (!c.alive) {
      px(ctx, cx - 14, cy - 12, 28, 24, '#20242f');
      px(ctx, cx - 10, cy - 6, 20, 12, '#141821');
      ctx.fillStyle = `rgba(255,90,30,${0.2 + 0.2 * Math.sin(t * 9 + c.oy)})`;
      ctx.fillRect(cx - 8, cy - 4, 16, 8);
      continue;
    }
    px(ctx, cx - 16, cy - 14, 32, 28, '#556076');
    px(ctx, cx - 16, cy - 14, 32, 3, '#8f9bb3');
    px(ctx, cx - 12, cy - 9, 24, 18, '#3c4353');
    ctx.fillStyle = c.flash > 0 ? '#fff0a8' : '#e0473c';
    ctx.beginPath();
    ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20242f';
    ctx.beginPath();
    ctx.arc(cx - 2, cy, 2.6, 0, Math.PI * 2);
    ctx.fill();
    px(ctx, cx - 30, cy - 5, 16, 10, '#6b768c');
    px(ctx, cx - 34, cy - 6, 6, 12, '#454e60');
    // damage marks
    if (c.hp < 9) px(ctx, cx - 10, cy - 12, 8, 4, '#20242f');
  }

  // core
  const coreX = x + 30;
  const coreY = y + 92;
  px(ctx, coreX - 23, coreY - 25, 46, 50, '#2b3040');
  px(ctx, coreX - 23, coreY - 25, 46, 3, '#69738a');
  px(ctx, coreX - 23, coreY + 22, 46, 3, '#1b1f2c');
  if (b.coreOpen) {
    const gl = ctx.createRadialGradient(coreX, coreY, 2, coreX, coreY, 22);
    gl.addColorStop(0, '#fff7c2');
    gl.addColorStop(0.4, '#ffb23c');
    gl.addColorStop(1, 'rgba(255,60,30,0.15)');
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(coreX, coreY, 17 + Math.sin(t * 12) * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(coreX, coreY, 5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    px(ctx, coreX - 18, coreY - 20, 36, 40, '#4c5568');
    for (let i = 0; i < 5; i++) px(ctx, coreX - 18, coreY - 18 + i * 9, 36, 3, '#343b4b');
    px(ctx, coreX - 18, coreY - 2, 36, 4, '#1d2130');
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Items / bullets / fx                                                */
/* ------------------------------------------------------------------ */

const ITEM_COLOR: Record<string, string> = {
  M: '#ffc83d',
  S: '#ff7a3d',
  L: '#63e0ff',
  B: '#9df06a',
  N: '#dddddd',
  H: '#ff6ad0',
};

export function drawItem(ctx: C2D, it: Item, camX: number, t: number) {
  const x = R(it.x - camX);
  const y = R(it.y);
  const bob = Math.sin(t * 6) * 1.5;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.fillStyle = `rgba(255,255,255,${0.12 + 0.1 * Math.sin(t * 9)})`;
  ctx.beginPath();
  ctx.arc(8, 8, 13, 0, Math.PI * 2);
  ctx.fill();
  px(ctx, 0, 0, 16, 16, '#1d2232');
  px(ctx, 1, 1, 14, 14, ITEM_COLOR[it.kind] ?? '#fff');
  px(ctx, 1, 1, 14, 3, 'rgba(255,255,255,0.55)');
  px(ctx, 1, 12, 14, 3, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = '#1d2232';
  ctx.font = 'bold 11px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(it.kind, 8, 9);
  ctx.restore();
}

export function drawBullet(
  ctx: C2D,
  b: { x: number; y: number; vx: number; vy: number; r: number; kind: string },
  camX: number,
) {
  const x = b.x - camX;
  const y = b.y;
  if (b.kind === 'H') {
    const ang = Math.atan2(b.vy, b.vx);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    // flame trail
    ctx.fillStyle = 'rgba(255,160,60,0.55)';
    ctx.beginPath();
    ctx.moveTo(-6, -2.4);
    ctx.lineTo(-16 - Math.random() * 6, 0);
    ctx.lineTo(-6, 2.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath();
    ctx.moveTo(-6, -1.4);
    ctx.lineTo(-11, 0);
    ctx.lineTo(-6, 1.4);
    ctx.closePath();
    ctx.fill();
    // body
    px(ctx, -6, -2.5, 12, 5, '#e6e9f0');
    ctx.fillStyle = '#ff6ad0';
    ctx.beginPath();
    ctx.moveTo(6, -2.5);
    ctx.lineTo(10, 0);
    ctx.lineTo(6, 2.5);
    ctx.closePath();
    ctx.fill();
    px(ctx, -8, -3.4, 4, 2.2, '#9aa3b8');
    px(ctx, -8, 1.2, 4, 2.2, '#9aa3b8');
    ctx.restore();
    return;
  }
  if (b.kind === 'L') {
    const ang = Math.atan2(b.vy, b.vx);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(99,224,255,0.45)';
    ctx.fillRect(-14, -3, 22, 6);
    ctx.fillStyle = '#63e0ff';
    ctx.fillRect(-12, -1.5, 20, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-4, -1, 12, 2);
    ctx.restore();
    return;
  }
  if (b.kind === 'enemy' || b.kind === 'boss') {
    ctx.fillStyle = b.kind === 'boss' ? 'rgba(255,110,60,0.35)' : 'rgba(255,190,60,0.3)';
    ctx.beginPath();
    ctx.arc(x, y, b.r + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = b.kind === 'boss' ? '#ff6a3c' : '#ffcc45';
    ctx.beginPath();
    ctx.arc(x, y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff4c9';
    ctx.beginPath();
    ctx.arc(x - b.vx * 0.2, y - b.vy * 0.2, b.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const col = b.kind === 'S' ? '#ff9a3c' : b.kind === 'M' ? '#ffe066' : '#ffffff';
  ctx.fillStyle = 'rgba(255,240,170,0.35)';
  ctx.beginPath();
  ctx.arc(x, y, b.r + 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(x, y, b.r, 0, Math.PI * 2);
  ctx.fill();
}

/* ------------------------------------------------------------------ */
/* HUD                                                                 */
/* ------------------------------------------------------------------ */

function headIcon(ctx: C2D, x: number, y: number) {
  px(ctx, x + 1, y + 2, 7, 6, HERO.skin);
  px(ctx, x, y + 1, 9, 2, HERO.band);
  px(ctx, x - 2, y + 2, 2, 1, HERO.band);
  px(ctx, x + 6, y + 5, 1, 1, '#2a1d14');
}

const WEAPON_CN: Record<string, string> = { N: '步枪', M: '机枪', S: '散弹', L: '激光', H: '导弹' };

export function drawHud(
  ctx: C2D,
  opts: {
    score: number;
    lives: number;
    weapon: string;
    boss: { hp: number; maxHp: number } | null;
    bossName?: string;
    msg: string | null;
    msgT: number;
    stage?: number;
  },
) {
  ctx.save();
  ctx.font = `bold 10px ${FONT_CN}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  ctx.fillStyle = 'rgba(8,8,20,0.45)';
  ctx.fillRect(0, 0, VIEW_W, 16);

  ctx.fillStyle = '#ffe066';
  ctx.fillText('得分', 6, 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(opts.score).padStart(6, '0'), 32, 3);

  // 关卡
  ctx.fillStyle = '#78d4ff';
  ctx.fillText(`第${opts.stage ?? 1}关`, 84, 3);

  if (opts.lives < 0 || opts.lives > 50) {
    headIcon(ctx, 126, 3);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 11px ${FONT_CN}`;
    ctx.fillText('× ∞', 138, 2);
    ctx.font = `bold 10px ${FONT_CN}`;
  } else {
    for (let i = 0; i < Math.max(0, opts.lives); i++) headIcon(ctx, 126 + i * 13, 3);
  }

  ctx.fillStyle = '#9fd8ff';
  ctx.fillText('武器', VIEW_W - 84, 3);
  const wc: Record<string, string> = { N: '#ffffff', M: '#ffc83d', S: '#ff7a3d', L: '#63e0ff', H: '#ff6ad0' };
  px(ctx, VIEW_W - 58, 2, 13, 12, '#1d2232');
  px(ctx, VIEW_W - 57, 3, 11, 10, wc[opts.weapon] ?? '#fff');
  ctx.fillStyle = '#1d2232';
  ctx.textAlign = 'center';
  ctx.fillText(opts.weapon, VIEW_W - 51, 3);
  ctx.textAlign = 'left';
  ctx.fillStyle = wc[opts.weapon] ?? '#fff';
  ctx.fillText(WEAPON_CN[opts.weapon] ?? '', VIEW_W - 42, 3);

  if (opts.boss) {
    const w = 180;
    const x = (VIEW_W - w) / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - 2, 20, w + 4, 10);
    ctx.fillStyle = '#4a1a1a';
    ctx.fillRect(x, 22, w, 6);
    const p = Math.max(0, opts.boss.hp / opts.boss.maxHp);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#ff3b2f');
    g.addColorStop(1, '#ffb03a');
    ctx.fillStyle = g;
    ctx.fillRect(x, 22, w * p, 6);
    ctx.fillStyle = '#ffd7a8';
    ctx.textAlign = 'center';
    ctx.font = `bold 9px ${FONT_CN}`;
    ctx.fillText(opts.bossName ?? '首领', VIEW_W / 2, 31);
  }

  if (opts.msg) {
    ctx.textAlign = 'center';
    ctx.font = `bold 14px ${FONT_CN}`;
    const a = Math.min(1, opts.msgT / 20);
    ctx.fillStyle = `rgba(0,0,0,${0.55 * a})`;
    ctx.fillRect(0, 106, VIEW_W, 28);
    ctx.fillStyle = `rgba(255,224,102,${a})`;
    ctx.fillText(opts.msg, VIEW_W / 2, 111);
  }
  ctx.restore();
}
