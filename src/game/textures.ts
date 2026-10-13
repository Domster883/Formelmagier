/** Platzhalter-Pixel-Art: alle Texturen werden zur Laufzeit gezeichnet (austauschbar). */
import Phaser from 'phaser';

export const TILE = 32;

type Draw = (g: Phaser.GameObjects.Graphics) => void;

function make(scene: Phaser.Scene, key: string, draw: Draw, w = TILE, hgt = TILE) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, hgt);
  g.destroy();
}

const px = (g: Phaser.GameObjects.Graphics, color: number, x: number, y: number, w = 1, h = 1) => {
  g.fillStyle(color, 1);
  g.fillRect(x * 2, y * 2, w * 2, h * 2);
};

export function makeTextures(scene: Phaser.Scene) {
  // --- Boden & Wände -------------------------------------------------------
  make(scene, 'floor', (g) => {
    g.fillStyle(0x3b3550).fillRect(0, 0, TILE, TILE);
    g.fillStyle(0x433c5b).fillRect(0, 0, 15, 15).fillRect(16, 16, 16, 16);
    g.lineStyle(1, 0x2c2740).strokeRect(0, 0, TILE, TILE);
  });
  make(scene, 'grass', (g) => {
    g.fillStyle(0x3f7a3a).fillRect(0, 0, TILE, TILE);
    for (const [x, y] of [[3, 4], [10, 2], [6, 11], [13, 9], [2, 14], [11, 14]]) px(g, 0x4f9346, x, y, 1, 2);
  });
  make(scene, 'wall', (g) => {
    g.fillStyle(0x5a5470).fillRect(0, 0, TILE, TILE);
    g.fillStyle(0x6e6888);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) g.fillRect(c * 16 + (r % 2) * 8 + 1, r * 8 + 1, 14, 6);
  });
  make(scene, 'water', (g) => {
    g.fillStyle(0x2a5d9c).fillRect(0, 0, TILE, TILE);
    px(g, 0x6fa6e0, 2, 4, 4, 1);
    px(g, 0x6fa6e0, 9, 10, 5, 1);
  });
  make(scene, 'tree', (g) => {
    g.fillStyle(0x3f7a3a).fillRect(0, 0, TILE, TILE);
    px(g, 0x6b4a2b, 7, 10, 2, 5);
    g.fillStyle(0x2b5e2a).fillCircle(16, 12, 11);
    g.fillStyle(0x3d8a3a).fillCircle(13, 9, 5);
  });
  make(scene, 'shelf', (g) => {
    g.fillStyle(0x5b3b22).fillRect(0, 0, TILE, TILE);
    const colors = [0xb03a2e, 0x2e86c1, 0xd4ac0d, 0x229954, 0x8e44ad];
    for (let r = 0; r < 3; r++) {
      g.fillStyle(0x3d2716).fillRect(0, r * 10 + 9, TILE, 2);
      for (let c = 0; c < 6; c++) {
        g.fillStyle(colors[(r * 6 + c) % colors.length]).fillRect(2 + c * 5, r * 10 + 1, 4, 8);
      }
    }
  });
  make(scene, 'door', (g) => {
    g.fillStyle(0x3b3550).fillRect(0, 0, TILE, TILE);
    g.fillStyle(0x8a5a2b).fillRect(4, 0, 24, TILE);
    g.fillStyle(0x6b431f).fillRect(15, 0, 2, TILE);
  });
  make(scene, 'gate', (g) => {
    g.fillStyle(0x2c2740).fillRect(0, 0, TILE, TILE);
    g.fillStyle(0x9a9ab0);
    for (let i = 0; i < 5; i++) g.fillRect(2 + i * 6, 0, 3, TILE);
    g.fillRect(0, 6, TILE, 3).fillRect(0, 22, TILE, 3);
    g.fillStyle(0xe74c3c).fillCircle(16, 16, 4);
  });
  make(scene, 'gateOpen', (g) => {
    g.fillStyle(0x3b3550).fillRect(0, 0, TILE, TILE);
    g.fillStyle(0x9a9ab0).fillRect(0, 0, 3, TILE).fillRect(29, 0, 3, TILE);
  });

  // --- Figuren -------------------------------------------------------------
  const wizard = (robe: number, hat: number, beard = false) => (g: Phaser.GameObjects.Graphics) => {
    // Hut
    g.fillStyle(hat).fillTriangle(16, 0, 8, 11, 24, 11);
    g.fillStyle(0xf1c40f).fillRect(14, 4, 3, 3);
    g.fillStyle(hat).fillRect(6, 10, 20, 3);
    // Gesicht
    g.fillStyle(0xf5cba7).fillRect(11, 13, 10, 7);
    g.fillStyle(0x1b1b1b).fillRect(13, 15, 2, 2).fillRect(18, 15, 2, 2);
    if (beard) g.fillStyle(0xecf0f1).fillTriangle(10, 18, 22, 18, 16, 26);
    // Robe
    g.fillStyle(robe).fillTriangle(16, 18, 6, 31, 26, 31);
    g.fillRect(10, 20, 12, 11);
    g.fillStyle(0x000000, 0.25).fillRect(15, 21, 2, 10);
  };
  make(scene, 'player', wizard(0x6c3fb5, 0x4a2a8a));
  make(scene, 'mentor', wizard(0x1f6f8b, 0x14495c, true));
  make(scene, 'merchant', (g) => {
    g.fillStyle(0x8a5a2b).fillRect(8, 3, 16, 6);
    g.fillStyle(0xf5cba7).fillRect(10, 9, 12, 9);
    g.fillStyle(0x1b1b1b).fillRect(12, 12, 2, 2).fillRect(18, 12, 2, 2);
    g.fillStyle(0xc0392b).fillRect(7, 18, 18, 13);
    g.fillStyle(0xf1c40f).fillCircle(26, 26, 5);
    g.fillStyle(0xb7950b).fillCircle(26, 26, 2);
  });
  make(scene, 'crystal', (g) => {
    g.fillStyle(0x000000, 0.25).fillEllipse(16, 29, 20, 5);
    g.fillStyle(0x48c9e0).fillTriangle(16, 2, 6, 14, 26, 14);
    g.fillStyle(0x2492b0).fillTriangle(6, 14, 26, 14, 16, 28);
    g.fillStyle(0xd6f6ff).fillTriangle(16, 4, 11, 13, 16, 13);
  });
  make(scene, 'monster', (g) => {
    g.fillStyle(0x000000, 0.25).fillEllipse(16, 29, 22, 5);
    g.fillStyle(0x5fbf4f).fillEllipse(16, 19, 24, 20);
    g.fillTriangle(6, 12, 9, 2, 13, 11).fillTriangle(26, 12, 23, 2, 19, 11);
    g.fillStyle(0xffffff).fillCircle(11, 17, 4).fillCircle(21, 17, 4);
    g.fillStyle(0x000000).fillCircle(12, 18, 2).fillCircle(20, 18, 2);
    g.fillStyle(0x2d5a25).fillRect(11, 24, 10, 2);
  });
  make(scene, 'boss', (g) => {
    g.fillStyle(0x000000, 0.3).fillEllipse(16, 30, 30, 5);
    g.fillStyle(0x7f7466).fillRect(5, 6, 22, 22);
    g.fillStyle(0x6a6054).fillRect(1, 10, 5, 14).fillRect(26, 10, 5, 14);
    g.fillStyle(0x9b8f80).fillRect(9, 2, 14, 8);
    g.fillStyle(0xe74c3c).fillRect(11, 5, 3, 3).fillRect(18, 5, 3, 3);
    g.fillStyle(0xf4e9d8).fillRect(8, 13, 16, 10);
    g.fillStyle(0x34495e);
    for (let i = 0; i < 4; i++) g.fillRect(10, 15 + i * 2, 12 - (i % 2) * 4, 1);
  });
  make(scene, 'done', (g) => {
    g.fillStyle(0x27ae60).fillCircle(16, 16, 9);
    g.lineStyle(3, 0xffffff).beginPath().moveTo(11, 16).lineTo(15, 20).lineTo(22, 11).strokePath();
  });
  make(scene, 'locked', (g) => {
    g.fillStyle(0x000000, 0.45).fillCircle(16, 16, 9);
    g.lineStyle(2, 0xf5f5f5).strokeCircle(16, 13, 4);
    g.fillStyle(0xf5f5f5).fillRect(11, 14, 10, 8);
  });
  make(scene, 'sparkle', (g) => {
    g.fillStyle(0xfff3a0).fillRect(3, 0, 2, 8).fillRect(0, 3, 8, 2);
  }, 8, 8);
}
