// FlowerSpawner.js — Places the real cursed flower + fake decoys
import * as THREE from 'three';

export class FlowerSpawner {
  constructor(rand) {
    this.rand = rand;
    this.realFlower = null;
    this.fakeFlowers = [];
    this.allFlowers = [];
  }

  spawn(scene, rooms) {
    const validRooms = rooms.filter(r => r.center);
    if (validRooms.length === 0) return;

    // Pick room for real flower (not first room = spawn room)
    const roomIdx = 1 + Math.floor(this.rand() * (validRooms.length - 1));
    const realRoom = validRooms[roomIdx];
    this.realFlower = this._createFlower(scene, realRoom, true);

    // 0–2 fake flowers
    const fakeCount = Math.floor(this.rand() * 3);
    for (let i = 0; i < fakeCount; i++) {
      const idx = Math.floor(this.rand() * validRooms.length);
      const fakeRoom = validRooms[idx];
      if (fakeRoom !== realRoom) {
        const fake = this._createFlower(scene, fakeRoom, false);
        this.fakeFlowers.push(fake);
      }
    }

    this.allFlowers = [this.realFlower, ...this.fakeFlowers];
  }

  _createFlower(scene, room, isReal) {
    const group = new THREE.Group();
    const cx = room.center.x + (this.rand() - 0.5) * (room.w || 3);
    const cz = room.center.z + (this.rand() - 0.5) * (room.d || 3);

    // Stem
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 0.4, 8),
      new THREE.MeshLambertMaterial({ color: 0x2d5a1b, emissive: 0x0a2008, emissiveIntensity: 0.3 })
    );
    stem.position.y = 0.2;
    group.add(stem);

    // Petals
    const petalColor = isReal ? 0x9900cc : 0xcc0044;
    const petalMat = new THREE.MeshLambertMaterial({
      color: petalColor,
      emissive: petalColor,
      emissiveIntensity: 0.6,
      transparent: true, opacity: 0.9
    });
    for (let p = 0; p < 6; p++) {
      const angle = (p / 6) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), petalMat);
      petal.scale.set(0.5, 0.3, 1);
      petal.position.set(Math.cos(angle) * 0.15, 0.42, Math.sin(angle) * 0.15);
      petal.rotation.y = angle;
      group.add(petal);
    }

    // Center
    const center = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 1.0 })
    );
    center.position.y = 0.43;
    group.add(center);

    // Glow light
    const light = new THREE.PointLight(isReal ? 0xaa00ff : 0xff0066, 0.8, 3);
    light.position.y = 0.5;
    group.add(light);

    group.position.set(cx, 0, cz);
    group.userData.isReal = isReal;
    group.userData.isFlower = true;
    group.userData.roomCenter = room.center.clone();
    scene.add(group);
    return group;
  }

  checkPickup(playerPos, threshold = 1.5) {
    for (const flower of this.allFlowers) {
      if (!flower.parent) continue;
      const d = playerPos.distanceTo(flower.position);
      if (d < threshold) return flower;
    }
    return null;
  }

  removeFlower(flower, scene) {
    scene.remove(flower);
  }

  update(time) {
    this.allFlowers.forEach(f => {
      if (!f.parent) return;
      f.rotation.y = time * 0.8;
      f.position.y = Math.sin(time * 1.5) * 0.05;
      // Pulse glow
      const light = f.children.find(c => c.isLight);
      if (light) light.intensity = 0.6 + Math.sin(time * 3) * 0.3;
    });
  }
}
