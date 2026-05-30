// FurnitureGen.js — Procedural furniture placement per room type
import * as THREE from 'three';

function makeTex(color, roughness = 0.8) {
  const mat = new THREE.MeshLambertMaterial({ color });
  return mat;
}

const FURNITURE = {
  bedroom: [
    { name: 'bed', fn: makeBed },
    { name: 'nightstand', fn: makeBox },
    { name: 'wardrobe', fn: makeWardrobe },
  ],
  bathroom: [
    { name: 'bathtub', fn: makeBathtub },
    { name: 'toilet', fn: makeToilet },
  ],
  kitchen: [
    { name: 'table', fn: makeTable },
    { name: 'cabinet', fn: makeCabinet },
  ],
  hallway: [
    { name: 'lamp', fn: makeLamp },
  ],
  study: [
    { name: 'desk', fn: makeDesk },
    { name: 'bookshelf', fn: makeBookshelf },
    { name: 'chair', fn: makeChair },
  ],
  storage: [
    { name: 'crate', fn: makeBox },
    { name: 'shelf', fn: makeShelf },
  ],
  ritual: [
    { name: 'altar', fn: makeAltar },
    { name: 'candle', fn: makeCandle },
  ],
  hidden: [
    { name: 'chest', fn: makeBox },
  ],
};

function makeBox(size = [0.6, 0.6, 0.6], color = 0x4a3828) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), makeTex(color));
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return g;
}
function makeBed() {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 3.5), makeTex(0x3a2010));
  frame.position.y = 0.2; frame.castShadow = true;
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 3.3), makeTex(0x9a8878));
  mattress.position.y = 0.55;
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 0.6), makeTex(0xc8b8a8));
  pillow.position.set(0, 0.73, -1.3);
  g.add(frame, mattress, pillow);
  return g;
}
function makeWardrobe() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.4, 0.6), makeTex(0x2a1a0a));
  body.position.y = 1.2; body.castShadow = true;
  g.add(body);
  return g;
}
function makeBathtub() {
  const g = new THREE.Group();
  const tub = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 0.9), makeTex(0xccbbaa));
  tub.position.y = 0.3;
  const inner = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.65), makeTex(0x111111));
  inner.position.set(0, 0.5, 0);
  g.add(tub, inner);
  return g;
}
function makeToilet() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.5, 8), makeTex(0xccbbaa));
  base.position.y = 0.25;
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.2), makeTex(0xccbbaa));
  tank.position.set(0, 0.65, -0.25);
  g.add(base, tank);
  return g;
}
function makeTable() {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.8), makeTex(0x3a2010));
  top.position.y = 0.75;
  for (let x of [-0.6, 0.6]) for (let z of [-0.3, 0.3]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.08), makeTex(0x2a1808));
    leg.position.set(x, 0.37, z); g.add(leg);
  }
  g.add(top); return g;
}
function makeChair() {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), makeTex(0x3a2010));
  seat.position.y = 0.45;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.06), makeTex(0x3a2010));
  back.position.set(0, 0.75, -0.22);
  g.add(seat, back); return g;
}
function makeDesk() {
  const g = makeTable();
  const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.05), makeTex(0x111111));
  monitor.position.set(0, 1.1, -0.3);
  g.add(monitor); return g;
}
function makeBookshelf() {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.3), makeTex(0x2a1808));
  frame.position.y = 1.1;
  for (let shelf = 0; shelf < 4; shelf++) {
    const books = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 0.2), makeTex(0x4a3020 + shelf * 0x111111));
    books.position.set(0, 0.25 + shelf * 0.52, 0);
    g.add(books);
  }
  g.add(frame); return g;
}
function makeCabinet() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.0, 0.5), makeTex(0x2a1808));
  body.position.y = 1.0; body.castShadow = true;
  g.add(body); return g;
}
function makeShelf() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.3), makeTex(0x2a1808));
    s.position.y = 0.5 + i * 0.6;
    g.add(s);
  }
  return g;
}
function makeLamp() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.5, 8), makeTex(0x1a1008));
  pole.position.y = 0.75;
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.4, 8, 1, true), makeTex(0x8a6820));
  shade.position.y = 1.7;
  const light = new THREE.PointLight(0xff9944, 0.3, 4);
  light.position.y = 1.5;
  g.add(pole, shade, light); return g;
}
function makeAltar() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 1), makeTex(0x1a0a06));
  base.position.y = 0.4; base.castShadow = true;
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.9), makeTex(0x3a0000));
  cloth.position.y = 0.82;
  g.add(base, cloth); return g;
}
function makeCandle() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6), makeTex(0xeedebc));
  body.position.y = 0.15;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 6), makeTex(0xff8844));
  flame.position.y = 0.34;
  const light = new THREE.PointLight(0xff6622, 0.5, 2);
  light.position.y = 0.35;
  g.add(body, flame, light); return g;
}

export class FurnitureGen {
  constructor(rand) {
    this.rand = rand;
  }

  populateRoom(scene, room) {
    const items = FURNITURE[room.type] || FURNITURE.storage;
    const count = 1 + Math.floor(this.rand() * items.length);
    for (let i = 0; i < count; i++) {
      const item = items[Math.floor(this.rand() * items.length)];
      const group = item.fn();
      const px = room.x + 1 + this.rand() * (room.w - 2);
      const pz = room.z + 1 + this.rand() * (room.d - 2);
      group.position.set(px, 0, pz);
      group.rotation.y = this.rand() * Math.PI * 2;
      scene.add(group);
    }
  }
}
