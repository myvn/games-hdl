import type { BossKind, EnemyType, ItemKind, Platform, Theme } from './types';

export const LEVEL_W = 3840;
export const GROUND_Y = 228;
export const BOSS_X = 3600;

export interface SpawnDef {
  x: number;
  y: number;
  type: EnemyType;
  dir?: number;
  drop?: ItemKind;
}

export interface StageData {
  id: number;
  name: string;
  sub: string;
  theme: Theme;
  platforms: Platform[];
  spawns: SpawnDef[];
  boss: BossKind;
  bossName: string;
  bossHp: number;
}

/* ------------------------------------------------------------------ */
/* 通用 Boss 竞技场                                                    */
/* ------------------------------------------------------------------ */
function arena(natural: boolean): Platform[] {
  const walk: Platform['style'] = natural ? 'bridge' : 'metal';
  return [
    { x: 3106, y: GROUND_Y, w: 780, h: 60, style: natural ? 'rock' : 'metal' },
    { x: 3200, y: 180, w: 80, h: 8, oneway: true, style: walk },
    { x: 3340, y: 138, w: 80, h: 8, oneway: true, style: walk },
    { x: 3790, y: 20, w: 90, h: 208, style: 'metal' },
  ];
}

/* ------------------------------------------------------------------ */
/* 手工关卡 1：丛林                                                    */
/* ------------------------------------------------------------------ */
const S1_PLATFORMS: Platform[] = [
  { x: -40, y: GROUND_Y, w: 660, h: 60, style: 'rock' },
  { x: 170, y: 182, w: 86, h: 8, oneway: true, style: 'bridge' },
  { x: 300, y: 138, w: 72, h: 8, oneway: true, style: 'bridge' },
  { x: 460, y: 182, w: 96, h: 8, oneway: true, style: 'rock' },
  { x: 686, y: GROUND_Y, w: 494, h: 60, style: 'rock' },
  { x: 800, y: 180, w: 78, h: 8, oneway: true, style: 'bridge' },
  { x: 890, y: 190, w: 62, h: 38, style: 'crate' },
  { x: 990, y: 146, w: 96, h: 8, oneway: true, style: 'bridge' },
  { x: 1244, y: GROUND_Y, w: 658, h: 60, style: 'rock' },
  { x: 1400, y: 196, w: 70, h: 32, style: 'crate' },
  { x: 1470, y: 164, w: 74, h: 64, style: 'crate' },
  { x: 1600, y: 142, w: 104, h: 8, oneway: true, style: 'bridge' },
  { x: 1790, y: 182, w: 86, h: 8, oneway: true, style: 'rock' },
  { x: 1910, y: 190, w: 80, h: 8, oneway: true, style: 'bridge' },
  { x: 1992, y: GROUND_Y, w: 508, h: 60, style: 'rock' },
  { x: 2090, y: 180, w: 92, h: 8, oneway: true, style: 'bridge' },
  { x: 2230, y: 140, w: 92, h: 8, oneway: true, style: 'bridge' },
  { x: 2378, y: 182, w: 84, h: 8, oneway: true, style: 'rock' },
  { x: 2566, y: GROUND_Y, w: 540, h: 60, style: 'rock' },
  { x: 2700, y: 182, w: 66, h: 46, style: 'metal' },
  { x: 2790, y: 140, w: 90, h: 8, oneway: true, style: 'bridge' },
  { x: 2900, y: 146, w: 60, h: 82, style: 'metal' },
  ...arena(true),
];

const S1_SPAWNS: SpawnDef[] = [
  { x: 300, y: GROUND_Y, type: 'runner' },
  { x: 430, y: GROUND_Y, type: 'runner' },
  { x: 330, y: 138, type: 'gunner' },
  { x: 545, y: GROUND_Y, type: 'runner' },
  { x: 600, y: 170, type: 'pod', drop: 'M' },
  { x: 760, y: GROUND_Y, type: 'runner' },
  { x: 860, y: GROUND_Y, type: 'gunner' },
  { x: 1030, y: 146, type: 'gunner' },
  { x: 1130, y: GROUND_Y, type: 'turret' },
  { x: 940, y: 92, type: 'flyer' },
  { x: 1150, y: 70, type: 'flyer' },
  { x: 1000, y: 60, type: 'pod', drop: 'H' },
  { x: 1320, y: GROUND_Y, type: 'runner' },
  { x: 1365, y: GROUND_Y, type: 'runner' },
  { x: 1490, y: 164, type: 'gunner' },
  { x: 1650, y: 142, type: 'gunner' },
  { x: 1600, y: 80, type: 'pod', drop: 'S' },
  { x: 1830, y: GROUND_Y, type: 'turret' },
  { x: 1875, y: GROUND_Y, type: 'runner' },
  { x: 2050, y: GROUND_Y, type: 'runner' },
  { x: 2130, y: 180, type: 'gunner' },
  { x: 2205, y: GROUND_Y, type: 'turret' },
  { x: 2270, y: 140, type: 'gunner' },
  { x: 2260, y: 62, type: 'flyer' },
  { x: 2340, y: GROUND_Y, type: 'runner' },
  { x: 2420, y: 176, type: 'pod', drop: 'L' },
  { x: 2470, y: GROUND_Y, type: 'runner' },
  { x: 2620, y: GROUND_Y, type: 'runner' },
  { x: 2710, y: 182, type: 'gunner' },
  { x: 2820, y: 140, type: 'gunner' },
  { x: 2910, y: 146, type: 'turret' },
  { x: 2990, y: GROUND_Y, type: 'runner' },
  { x: 3020, y: 72, type: 'flyer' },
  { x: 3060, y: GROUND_Y, type: 'runner' },
  { x: 3180, y: GROUND_Y, type: 'runner' },
  { x: 3230, y: 180, type: 'gunner' },
  { x: 3300, y: 64, type: 'pod', drop: 'B' },
  { x: 3350, y: 138, type: 'gunner' },
];

/* ------------------------------------------------------------------ */
/* 手工关卡 2：钢铁工厂                                                */
/* ------------------------------------------------------------------ */
const S2_PLATFORMS: Platform[] = [
  { x: -40, y: GROUND_Y, w: 700, h: 60, style: 'metal' },
  { x: 180, y: 176, w: 90, h: 8, oneway: true, style: 'metal' },
  { x: 320, y: 132, w: 86, h: 8, oneway: true, style: 'metal' },
  { x: 450, y: 170, w: 70, h: 58, style: 'crate' },
  { x: 550, y: 132, w: 90, h: 8, oneway: true, style: 'metal' },
  { x: 730, y: GROUND_Y, w: 520, h: 60, style: 'metal' },
  { x: 800, y: 184, w: 80, h: 8, oneway: true, style: 'metal' },
  { x: 910, y: 148, w: 80, h: 80, style: 'metal' },
  { x: 1020, y: 122, w: 100, h: 8, oneway: true, style: 'metal' },
  { x: 1140, y: 174, w: 80, h: 8, oneway: true, style: 'metal' },
  { x: 1310, y: GROUND_Y, w: 680, h: 60, style: 'metal' },
  { x: 1410, y: 182, w: 80, h: 46, style: 'crate' },
  { x: 1530, y: 140, w: 110, h: 8, oneway: true, style: 'metal' },
  { x: 1670, y: 106, w: 90, h: 8, oneway: true, style: 'metal' },
  { x: 1800, y: 160, w: 90, h: 68, style: 'metal' },
  { x: 2030, y: 186, w: 80, h: 8, oneway: true, style: 'metal' },
  { x: 2110, y: GROUND_Y, w: 460, h: 60, style: 'metal' },
  { x: 2200, y: 170, w: 90, h: 8, oneway: true, style: 'metal' },
  { x: 2320, y: 130, w: 90, h: 8, oneway: true, style: 'metal' },
  { x: 2450, y: 172, w: 70, h: 56, style: 'crate' },
  { x: 2630, y: GROUND_Y, w: 520, h: 60, style: 'metal' },
  { x: 2720, y: 180, w: 80, h: 8, oneway: true, style: 'metal' },
  { x: 2840, y: 136, w: 90, h: 8, oneway: true, style: 'metal' },
  { x: 2960, y: 174, w: 80, h: 54, style: 'metal' },
  ...arena(false),
];

const S2_SPAWNS: SpawnDef[] = [
  { x: 280, y: GROUND_Y, type: 'runner' },
  { x: 360, y: 132, type: 'gunner' },
  { x: 490, y: 170, type: 'turret' },
  { x: 570, y: 132, type: 'gunner' },
  { x: 620, y: 80, type: 'pod', drop: 'H' },
  { x: 790, y: GROUND_Y, type: 'runner' },
  { x: 880, y: GROUND_Y, type: 'runner' },
  { x: 950, y: 148, type: 'turret' },
  { x: 1060, y: 122, type: 'gunner' },
  { x: 980, y: 70, type: 'flyer' },
  { x: 1190, y: 64, type: 'flyer' },
  { x: 1210, y: 174, type: 'gunner' },
  { x: 1250, y: 90, type: 'pod', drop: 'S' },
  { x: 1390, y: GROUND_Y, type: 'runner' },
  { x: 1450, y: 182, type: 'turret' },
  { x: 1580, y: 140, type: 'gunner' },
  { x: 1690, y: 106, type: 'gunner' },
  { x: 1820, y: 160, type: 'turret' },
  { x: 1750, y: 80, type: 'pod', drop: 'L' },
  { x: 2180, y: GROUND_Y, type: 'runner' },
  { x: 2240, y: 170, type: 'gunner' },
  { x: 2350, y: 130, type: 'turret' },
  { x: 2310, y: 60, type: 'flyer' },
  { x: 2470, y: 172, type: 'gunner' },
  { x: 2510, y: 90, type: 'pod', drop: 'M' },
  { x: 2680, y: GROUND_Y, type: 'runner' },
  { x: 2750, y: 180, type: 'gunner' },
  { x: 2880, y: 136, type: 'turret' },
  { x: 2980, y: 174, type: 'gunner' },
  { x: 3040, y: 70, type: 'flyer' },
  { x: 3080, y: GROUND_Y, type: 'runner' },
  { x: 3220, y: 180, type: 'gunner' },
  { x: 3370, y: 138, type: 'gunner' },
  { x: 3300, y: 60, type: 'pod', drop: 'B' },
];

/* ------------------------------------------------------------------ */
/* 手工关卡 10：异形巢穴                                               */
/* ------------------------------------------------------------------ */
const S10_PLATFORMS: Platform[] = [
  { x: -40, y: GROUND_Y, w: 640, h: 60, style: 'rock' },
  { x: 160, y: 184, w: 90, h: 8, oneway: true, style: 'rock' },
  { x: 280, y: 140, w: 80, h: 8, oneway: true, style: 'rock' },
  { x: 420, y: 180, w: 80, h: 8, oneway: true, style: 'bridge' },
  { x: 530, y: 144, w: 80, h: 8, oneway: true, style: 'rock' },
  { x: 690, y: GROUND_Y, w: 480, h: 60, style: 'rock' },
  { x: 790, y: 176, w: 76, h: 8, oneway: true, style: 'rock' },
  { x: 900, y: 136, w: 86, h: 8, oneway: true, style: 'bridge' },
  { x: 1020, y: 168, w: 70, h: 60, style: 'crate' },
  { x: 1120, y: 130, w: 80, h: 8, oneway: true, style: 'rock' },
  { x: 1250, y: GROUND_Y, w: 660, h: 60, style: 'rock' },
  { x: 1370, y: 182, w: 76, h: 46, style: 'crate' },
  { x: 1480, y: 146, w: 80, h: 82, style: 'rock' },
  { x: 1610, y: 118, w: 90, h: 8, oneway: true, style: 'bridge' },
  { x: 1740, y: 160, w: 80, h: 8, oneway: true, style: 'rock' },
  { x: 1880, y: 184, w: 80, h: 8, oneway: true, style: 'bridge' },
  { x: 1980, y: GROUND_Y, w: 520, h: 60, style: 'rock' },
  { x: 2080, y: 174, w: 84, h: 8, oneway: true, style: 'rock' },
  { x: 2210, y: 134, w: 84, h: 8, oneway: true, style: 'bridge' },
  { x: 2340, y: 170, w: 70, h: 58, style: 'crate' },
  { x: 2560, y: GROUND_Y, w: 540, h: 60, style: 'rock' },
  { x: 2660, y: 178, w: 76, h: 50, style: 'rock' },
  { x: 2770, y: 136, w: 90, h: 8, oneway: true, style: 'bridge' },
  { x: 2890, y: 150, w: 80, h: 78, style: 'metal' },
  ...arena(true),
];

const S10_SPAWNS: SpawnDef[] = [
  { x: 270, y: GROUND_Y, type: 'runner' },
  { x: 330, y: 140, type: 'gunner' },
  { x: 440, y: 180, type: 'turret' },
  { x: 550, y: 144, type: 'gunner' },
  { x: 590, y: 70, type: 'flyer' },
  { x: 620, y: 170, type: 'pod', drop: 'H' },
  { x: 770, y: GROUND_Y, type: 'runner' },
  { x: 840, y: GROUND_Y, type: 'runner' },
  { x: 930, y: 136, type: 'gunner' },
  { x: 1040, y: 168, type: 'turret' },
  { x: 960, y: 60, type: 'flyer' },
  { x: 1140, y: 130, type: 'gunner' },
  { x: 1180, y: 70, type: 'flyer' },
  { x: 1220, y: 60, type: 'pod', drop: 'S' },
  { x: 1340, y: GROUND_Y, type: 'runner' },
  { x: 1400, y: 182, type: 'turret' },
  { x: 1510, y: 146, type: 'turret' },
  { x: 1630, y: 118, type: 'gunner' },
  { x: 1760, y: 160, type: 'gunner' },
  { x: 1700, y: 80, type: 'pod', drop: 'L' },
  { x: 2040, y: GROUND_Y, type: 'runner' },
  { x: 2120, y: 174, type: 'gunner' },
  { x: 2240, y: 134, type: 'turret' },
  { x: 2360, y: 170, type: 'turret' },
  { x: 2280, y: 60, type: 'flyer' },
  { x: 2470, y: 80, type: 'pod', drop: 'H' },
  { x: 2630, y: GROUND_Y, type: 'runner' },
  { x: 2700, y: 178, type: 'gunner' },
  { x: 2800, y: 136, type: 'gunner' },
  { x: 2920, y: 150, type: 'turret' },
  { x: 2980, y: 60, type: 'flyer' },
  { x: 3040, y: GROUND_Y, type: 'runner' },
  { x: 3230, y: 180, type: 'gunner' },
  { x: 3360, y: 138, type: 'gunner' },
  { x: 3300, y: 60, type: 'pod', drop: 'B' },
];

/* ------------------------------------------------------------------ */
/* 程序化关卡生成器（保证跳跃可达：坑宽 ≤ 66，台阶落差 ≤ 48）           */
/* ------------------------------------------------------------------ */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function genLayout(seed: number, diff: number, natural: boolean): { platforms: Platform[]; spawns: SpawnDef[] } {
  const rnd = mulberry32(seed);
  const R = (a: number, b: number) => a + rnd() * (b - a);
  const RI = (a: number, b: number) => Math.floor(R(a, b + 1));
  const ground: Platform['style'] = natural ? 'rock' : 'metal';
  const walk: Platform['style'] = natural ? 'bridge' : 'metal';
  const platforms: Platform[] = [];
  const spawns: SpawnDef[] = [];
  const drops: ItemKind[] = ['S', 'H', 'M', 'L', 'B', 'H', 'S', 'L'];
  let dropI = 0;
  let x = -40;
  let first = true;
  let sec = 0;

  while (x < 3106) {
    let w = RI(440, 640);
    if (x + w > 3106 - 300) w = 3106 - x;
    platforms.push({ x, y: GROUND_Y, w, h: 60, style: ground });
    const sx = first ? x + 260 : x + 40;
    const ex = x + w - 30;

    // 平台链
    let px = sx + RI(0, 40);
    let lastY = GROUND_Y;
    let lastEnd = px;
    while (px + 70 < ex - 20) {
      const pw = RI(70, 100);
      let py: number;
      if (lastY <= 150 && rnd() < 0.5) py = RI(176, 186);
      else if (lastY >= 176 && px - lastEnd < 110 && rnd() < 0.6) py = RI(132, 146);
      else py = RI(176, 186);
      const solid = rnd() < 0.22 && py >= 176;
      if (solid) platforms.push({ x: px, y: py, w: Math.min(pw, 76), h: GROUND_Y - py, style: 'crate' });
      else platforms.push({ x: px, y: py, w: pw, h: 8, oneway: true, style: walk });
      if (rnd() < 0.5 + diff * 0.05) {
        spawns.push({ x: px + pw / 2, y: py, type: solid && rnd() < 0.5 ? 'turret' : 'gunner' });
      }
      lastY = py;
      lastEnd = px + pw;
      px += pw + RI(50, 120);
    }

    // 地面敌人
    const nRun = RI(1, 2 + Math.floor(diff / 2));
    for (let i = 0; i < nRun; i++) spawns.push({ x: RI(sx + 20, ex), y: GROUND_Y, type: 'runner' });
    if (rnd() < 0.35 + diff * 0.06) spawns.push({ x: RI(sx + 60, ex), y: GROUND_Y, type: 'turret' });
    const nFly = rnd() < 0.5 + diff * 0.05 ? RI(1, 1 + Math.floor(diff / 3)) : 0;
    for (let i = 0; i < nFly; i++) spawns.push({ x: RI(sx, ex), y: RI(60, 95), type: 'flyer' });
    if (sec % 2 === 0) {
      spawns.push({ x: RI(sx + 80, ex), y: RI(70, 170), type: 'pod', drop: drops[dropI++ % drops.length] });
    }

    first = false;
    sec++;
    x += w;
    if (x >= 3106) break;
    x += RI(56, 66);
  }

  // Boss 区前的护罩补给
  spawns.push({ x: 3300, y: 60, type: 'pod', drop: 'B' });
  spawns.push({ x: 3230, y: 180, type: 'gunner' });
  platforms.push(...arena(natural));
  return { platforms, spawns };
}

/* ------------------------------------------------------------------ */
/* 全部 10 关                                                          */
/* ------------------------------------------------------------------ */
function mk(
  id: number, sub: string, theme: Theme, boss: BossKind, bossName: string, bossHp: number,
  layout: { platforms: Platform[]; spawns: SpawnDef[] },
): StageData {
  const cn = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][id - 1];
  return { id, name: `第${cn}关`, sub, theme, boss, bossName, bossHp, platforms: layout.platforms, spawns: layout.spawns };
}

export const STAGES: StageData[] = [
  mk(1, '丛林前哨', 'jungle', 'fortress', '哨戒要塞', 44, { platforms: S1_PLATFORMS, spawns: S1_SPAWNS }),
  mk(2, '钢铁工厂', 'base', 'tank', '重型战车·铁犀', 72, { platforms: S2_PLATFORMS, spawns: S2_SPAWNS }),
  mk(3, '雪原基地', 'snow', 'heli', '武装直升机·暴风雪', 66, genLayout(303, 2, true)),
  mk(4, '废弃都市', 'city', 'mech', '巨型机甲·泰坦', 88, genLayout(404, 3, false)),
  mk(5, '地下洞窟', 'cave', 'spider', '猎杀蛛·黑寡妇', 80, genLayout(505, 4, true)),
  mk(6, '熔岩要塞', 'lava', 'golem', '熔岩图腾·火眼', 48, genLayout(606, 5, false)),
  mk(7, '瀑布峡谷', 'waterfall', 'twins', '双子浮游炮·阴阳', 100, genLayout(707, 6, true)),
  mk(8, '天空航母', 'sky', 'gunship', '装甲飞艇·雷云', 64, genLayout(808, 7, false)),
  mk(9, '荒漠铁路', 'desert', 'train', '装甲列车·钢蟒', 76, genLayout(909, 8, false)),
  mk(10, '异形巢穴', 'alien', 'heart', '异形心脏·戈尔冈', 110, { platforms: S10_PLATFORMS, spawns: S10_SPAWNS }),
];
