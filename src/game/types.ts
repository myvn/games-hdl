export const VIEW_W = 480;
export const VIEW_H = 270;

export const GRAVITY = 0.5;
export const MAX_FALL = 9;
export const RUN_SPEED = 2.5;
export const JUMP_V = -8.3;

export type Phase = 'title' | 'playing' | 'gameover' | 'win';
export type WeaponKind = 'N' | 'M' | 'S' | 'L' | 'H';
export type ItemKind = WeaponKind | 'B';

export type Theme =
  | 'jungle' | 'base' | 'snow' | 'city' | 'cave'
  | 'lava' | 'waterfall' | 'sky' | 'desert' | 'alien';

export type BossKind =
  | 'fortress' | 'tank' | 'heli' | 'mech' | 'spider'
  | 'golem' | 'twins' | 'gunship' | 'train' | 'heart';

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  fire: boolean;
  guard: boolean;
}

export const emptyInput = (): InputState => ({
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  fire: false,
  guard: false,
});

export interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  oneway?: boolean;
  style?: 'rock' | 'bridge' | 'metal' | 'crate';
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  pierce?: boolean;
  pcd?: number;
  grav?: number;
  kind: WeaponKind | 'enemy' | 'boss';
}

export type EnemyType = 'runner' | 'gunner' | 'turret' | 'flyer' | 'pod';

export interface Enemy {
  type: EnemyType;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  hp: number;
  dir: number;
  timer: number;
  anim: number;
  onGround: boolean;
  hurt: number;
  base: number;
  drop?: ItemKind;
  dead?: boolean;
}

export interface Item {
  x: number;
  y: number;
  vy: number;
  kind: ItemKind;
  t: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  grav: number;
}

/** A destructible / functional sub-part of a boss (ox,oy = centre offset). */
export interface BossPart {
  ox: number;
  oy: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  timer: number;
  flash: number;
}

export interface Boss {
  kind: BossKind;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  parts: BossPart[];
  coreOpen: boolean;
  timer: number;
  phase: number;
  hurt: number;
  dying: number;
  spawnTimer: number;
  anim: number;
  beamY: number;
  beamT: number;
  beamCharge: number;
  beamIdx: number;
  dir: number;
  onGround: boolean;
  ang: number;
  radius: number;
}

export interface Player {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  facing: number;
  onGround: boolean;
  prone: boolean;
  alive: boolean;
  invuln: number;
  fireCd: number;
  weapon: WeaponKind;
  anim: number;
  aimX: number;
  aimY: number;
  shootFlash: number;
  dropThrough: number;
  barrier: number;
  jumpLatch: boolean;
  fireLatch: boolean;
  lastSafeX: number;
  airJumps: number;
  guard: boolean;
  knifeCd: number;
  knifeFlash: number;
}

export interface HudSnapshot {
  phase: Phase;
  score: number;
  lives: number;
  weapon: WeaponKind;
  stage: number;
  stageName: string;
}

export function overlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
