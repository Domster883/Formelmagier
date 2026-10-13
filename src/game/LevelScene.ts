/**
 * Begehbare Karte eines Levels (Top-down, Kachel-Raster).
 * Steuerung: Pfeiltasten/WASD bewegen, E/Leertaste/Enter interagieren,
 * Mausklick/Tippen läuft zum Ziel.
 */
import Phaser from 'phaser';
import type { Encounter, LevelData } from '../content/types';
import { isModalOpen } from '../ui/dom';
import { game } from './state';
import { makeTextures, TILE } from './textures';

export type EntityRef =
  | { type: 'mentor' }
  | { type: 'merchant' }
  | { type: 'encounter'; encounter: Encounter }
  | { type: 'gate' };

export interface SceneHooks {
  interact: (e: EntityRef) => void;
  status: (text: string) => void;
}

interface Entity {
  ref: EntityRef;
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Image;
  badge?: Phaser.GameObjects.Image;
}

const BLOCKING = new Set(['wall', 'water', 'tree', 'shelf']);

export class LevelScene extends Phaser.Scene {
  static hooks: SceneHooks = { interact: () => {}, status: () => {} };

  private level!: LevelData;
  private grid: string[] = [];
  private tiles: Phaser.GameObjects.Image[][] = [];
  private entities: Entity[] = [];
  private player!: Phaser.GameObjects.Image;
  private px = 0;
  private py = 0;
  private moving = false;
  private path: { x: number; y: number }[] = [];
  private pathTarget: Entity | null = null;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private prompt!: Phaser.GameObjects.Text;
  private lastStatus = '';

  constructor() {
    super('level');
  }

  init(data: { level: LevelData }) {
    this.level = data.level;
    this.entities = [];
    this.tiles = [];
    this.path = [];
    this.pathTarget = null;
    this.moving = false;
  }

  create() {
    makeTextures(this);
    const lv = this.level;
    this.grid = lv.map;
    const markers = new Set([lv.mentor.marker, lv.merchant.marker, 'P', ...lv.encounters.map((e) => e.marker)]);

    for (let y = 0; y < this.grid.length; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < this.grid[y].length; x++) {
        const ch = this.grid[y][x];
        let kind = lv.legend[ch];
        if (markers.has(ch)) kind = this.neighbourFloor(x, y);
        if (kind === 'gate') kind = this.gateOpen() ? 'gateOpen' : 'gate';
        this.tiles[y][x] = this.add.image(x * TILE, y * TILE, kind ?? 'floor').setOrigin(0);
        if (ch === 'P') {
          this.px = x;
          this.py = y;
        }
      }
    }

    // Figuren
    const place = (marker: string, ref: EntityRef, key: string) => {
      const pos = this.find(marker);
      if (!pos) return;
      const sprite = this.add.image(pos.x * TILE + TILE / 2, pos.y * TILE + TILE / 2, key).setDepth(2);
      const ent: Entity = { ref, x: pos.x, y: pos.y, sprite };
      this.entities.push(ent);
      if (ref.type === 'encounter' && ref.encounter.monster && ref.encounter.kind === 'monster') sprite.setTint(Phaser.Display.Color.HexStringToColor(ref.encounter.monster.color).color);
      if (ref.type !== 'merchant' && ref.type !== 'mentor') {
        this.tweens.add({ targets: sprite, y: sprite.y - 3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
    };
    place(lv.mentor.marker, { type: 'mentor' }, 'mentor');
    place(lv.merchant.marker, { type: 'merchant' }, 'merchant');
    for (const e of lv.encounters) place(e.marker, { type: 'encounter', encounter: e }, e.kind === 'crystal' ? 'crystal' : e.kind === 'boss' ? 'boss' : 'monster');

    // gespeicherte Position
    const saved = game.data.position[lv.id];
    if (saved && this.walkable(saved.x, saved.y)) {
      this.px = saved.x;
      this.py = saved.y;
    }
    this.player = this.add.image(this.px * TILE + TILE / 2, this.py * TILE + TILE / 2, 'player').setDepth(3);

    this.prompt = this.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '12px', color: '#fff8d0', backgroundColor: '#1a1626cc', padding: { x: 4, y: 2 } })
      .setDepth(10)
      .setOrigin(0.5, 1)
      .setVisible(false);

    const kb = this.input.keyboard!;
    const k = (code: number) => kb.addKey(code, false);
    const C = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: k(C.UP), down: k(C.DOWN), left: k(C.LEFT), right: k(C.RIGHT),
      w: k(C.W), a: k(C.A), s: k(C.S), d: k(C.D),
      e: k(C.E), space: k(C.SPACE), enter: k(C.ENTER),
    };

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (isModalOpen()) return;
      const tx = Math.floor(p.worldX / TILE);
      const ty = Math.floor(p.worldY / TILE);
      this.walkTo(tx, ty);
    });

    this.refreshMarkers();
    this.updatePrompt();
  }

  /** Nach Fortschritt aufrufen: Häkchen, Schlösser, Tor */
  refreshMarkers() {
    for (const ent of this.entities) {
      ent.badge?.destroy();
      ent.badge = undefined;
      if (ent.ref.type !== 'encounter') continue;
      const e = ent.ref.encounter;
      const lessonsHeard = game.data.lessons[this.level.id] ?? 0;
      let key: string | null = null;
      if (game.isEncounterDone(e.id)) key = 'done';
      else if (lessonsHeard < e.lesson || (e.kind === 'boss' && !this.gateOpen())) key = 'locked';
      if (key) ent.badge = this.add.image(ent.sprite.x + 11, ent.sprite.y - 11, key).setScale(0.6).setDepth(4);
      ent.sprite.setAlpha(game.isEncounterDone(e.id) ? 0.55 : 1);
    }
    const open = this.gateOpen();
    this.grid.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (this.level.legend[ch] === 'gate') this.tiles[y][x].setTexture(open ? 'gateOpen' : 'gate');
      }),
    );
    this.updatePrompt();
  }

  gateOpen(): boolean {
    return this.level.encounters.filter((e) => e.kind !== 'boss').every((e) => game.isEncounterDone(e.id));
  }

  private neighbourFloor(x: number, y: number): string {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const ch = this.grid[y + dy]?.[x + dx];
      const k = ch ? this.level.legend[ch] : undefined;
      if (k === 'floor' || k === 'grass') return k;
    }
    return 'floor';
  }

  private find(marker: string): { x: number; y: number } | null {
    for (let y = 0; y < this.grid.length; y++) {
      const x = this.grid[y].indexOf(marker);
      if (x >= 0) return { x, y };
    }
    return null;
  }

  private entityAt(x: number, y: number) {
    return this.entities.find((e) => e.x === x && e.y === y);
  }

  private walkable(x: number, y: number): boolean {
    const ch = this.grid[y]?.[x];
    if (ch === undefined) return false;
    const kind = this.level.legend[ch];
    if (kind && BLOCKING.has(kind)) return false;
    if (kind === 'gate' && !this.gateOpen()) return false;
    return !this.entityAt(x, y);
  }

  private adjacentEntity(): Entity | undefined {
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const e = this.entityAt(this.px + dx, this.py + dy);
      if (e) return e;
    }
    const gate = this.adjacentGate();
    return gate;
  }

  private adjacentGate(): Entity | undefined {
    if (this.gateOpen()) return undefined;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const ch = this.grid[this.py + dy]?.[this.px + dx];
      if (ch && this.level.legend[ch] === 'gate') return { ref: { type: 'gate' }, x: this.px + dx, y: this.py + dy, sprite: this.player };
    }
    return undefined;
  }

  private label(e: Entity): string {
    switch (e.ref.type) {
      case 'mentor':
        return this.level.mentor.name;
      case 'merchant':
        return this.level.merchant.name;
      case 'gate':
        return 'Versiegeltes Tor';
      case 'encounter':
        return e.ref.encounter.name;
    }
  }

  private updatePrompt() {
    const e = this.adjacentEntity();
    if (!e) {
      this.prompt.setVisible(false);
      this.setStatus('');
      return;
    }
    const verb = e.ref.type === 'encounter' ? (e.ref.encounter.kind === 'crystal' ? 'Untersuchen' : 'Kämpfen') : e.ref.type === 'gate' ? 'Ansehen' : 'Sprechen';
    this.prompt.setText(`[E] ${verb}: ${this.label(e)}`);
    this.prompt.setPosition(Phaser.Math.Clamp(this.player.x, 90, this.scale.width - 90), this.player.y - 18).setVisible(true);
    this.setStatus(`${this.label(e)} – E/Leertaste drücken oder anklicken`);
  }

  private setStatus(t: string) {
    if (t === this.lastStatus) return;
    this.lastStatus = t;
    LevelScene.hooks.status(t);
  }

  private step(dx: number, dy: number) {
    if (this.moving) return;
    this.player.setFlipX(dx < 0 ? true : dx > 0 ? false : this.player.flipX);
    const nx = this.px + dx;
    const ny = this.py + dy;
    if (!this.walkable(nx, ny)) return;
    this.moving = true;
    this.px = nx;
    this.py = ny;
    this.prompt.setVisible(false);
    this.tweens.add({
      targets: this.player,
      x: nx * TILE + TILE / 2,
      y: ny * TILE + TILE / 2,
      duration: 110,
      onComplete: () => {
        this.moving = false;
        game.data.position[this.level.id] = { x: this.px, y: this.py };
        this.updatePrompt();
        this.continuePath();
      },
    });
  }

  private walkTo(tx: number, ty: number) {
    const target = this.entityAt(tx, ty) ?? null;
    const isGate = this.level.legend[this.grid[ty]?.[tx] ?? ''] === 'gate' && !this.gateOpen();
    // direkt daneben? -> interagieren
    if ((target || isGate) && Math.abs(tx - this.px) + Math.abs(ty - this.py) === 1) {
      LevelScene.hooks.interact(target ? target.ref : { type: 'gate' });
      return;
    }
    const goals: { x: number; y: number }[] = [];
    if (target || isGate) {
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (this.walkable(tx + dx, ty + dy)) goals.push({ x: tx + dx, y: ty + dy });
    } else if (this.walkable(tx, ty)) goals.push({ x: tx, y: ty });
    const path = this.bfs(goals);
    if (!path) return;
    this.path = path;
    this.pathTarget = target ?? (isGate ? { ref: { type: 'gate' }, x: tx, y: ty, sprite: this.player } : null);
    this.continuePath();
  }

  private continuePath() {
    const next = this.path.shift();
    if (next) {
      this.step(next.x - this.px, next.y - this.py);
      return;
    }
    if (this.pathTarget) {
      const t = this.pathTarget;
      this.pathTarget = null;
      if (Math.abs(t.x - this.px) + Math.abs(t.y - this.py) === 1) LevelScene.hooks.interact(t.ref);
    }
  }

  private bfs(goals: { x: number; y: number }[]): { x: number; y: number }[] | null {
    if (!goals.length) return null;
    const key = (x: number, y: number) => `${x},${y}`;
    const goalSet = new Set(goals.map((g) => key(g.x, g.y)));
    const prev = new Map<string, string | null>([[key(this.px, this.py), null]]);
    const q: [number, number][] = [[this.px, this.py]];
    while (q.length) {
      const [x, y] = q.shift()!;
      if (goalSet.has(key(x, y))) {
        const path: { x: number; y: number }[] = [];
        let cur: string | null = key(x, y);
        while (cur && cur !== key(this.px, this.py)) {
          const [cx, cy] = cur.split(',').map(Number);
          path.unshift({ x: cx, y: cy });
          cur = prev.get(cur) ?? null;
        }
        return path;
      }
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = x + dx;
        const ny = y + dy;
        const k = key(nx, ny);
        if (prev.has(k) || !this.walkable(nx, ny)) continue;
        prev.set(k, key(x, y));
        q.push([nx, ny]);
      }
    }
    return null;
  }

  update() {
    const k = this.keys;
    const J = Phaser.Input.Keyboard.JustDown;
    if (isModalOpen() || document.activeElement?.tagName === 'INPUT') {
      // Tastendrücke im Dialog verwerfen, damit sie danach nichts auslösen
      Object.values(k).forEach((key) => J(key));
      return;
    }
    if (J(k.e) || J(k.space) || J(k.enter)) {
      const e = this.adjacentEntity();
      if (e) {
        this.path = [];
        LevelScene.hooks.interact(e.ref);
        return;
      }
    }
    if (this.moving) return;
    let dx = 0;
    let dy = 0;
    if (k.up.isDown || k.w.isDown) dy = -1;
    else if (k.down.isDown || k.s.isDown) dy = 1;
    else if (k.left.isDown || k.a.isDown) dx = -1;
    else if (k.right.isDown || k.d.isDown) dx = 1;
    if (dx || dy) {
      this.path = [];
      this.pathTarget = null;
      this.step(dx, dy);
    }
  }
}
