// StoryFragments.js — Dynamic lore system with 4 arcs
import * as THREE from 'three';

const LORE_ARCS = {
  botanist: [
    { title: "Laboratory Notes — Day 1", body: "The specimen responds to darkness. Growth accelerates in shadow. I must understand why." },
    { title: "Laboratory Notes — Day 47", body: "It is not a plant. It breathes. I can hear it at night, whispering names I don't recognize." },
    { title: "Dr. Harrow's Letter", body: "Elara — I beg you not to come here. The flower I described is not what I believed. Leave this region immediately." },
    { title: "Torn Page", body: "...the flower does not contain the darkness. The flower IS the darkness, given a beautiful face so we would reach for it..." },
    { title: "Research Journal", body: "I found a way to contain it. The ritual requires a willing host. I will not let another die here. I will be the last." },
  ],
  ritual: [
    { title: "Ritual Instructions (burned)", body: "...the words must be spoken at moonrise... the circle of salt must not be broken... if the host doubts, the binding fails..." },
    { title: "Chalk Markings on Floor", body: "These symbols mean: Bind. Hold. Suffer. The person who drew these did so willingly." },
    { title: "Candle Record", body: "Seven candles. Seven nights. The seventh never stays lit. Something blows it out. Always from inside the circle." },
    { title: "Old Photograph", body: "[A photo of a man standing before this house, smiling. On the back: 'This is where I finish it. — Edmund Harrow, 1987']" },
  ],
  victims: [
    { title: "Scratched Wall Message", body: "I came looking for the flower. I found it. I picked it. Nothing happened. Then the door wouldn't open." },
    { title: "Child's Drawing", body: "[A crayon drawing of a house with a flower in the window. A tall figure stands behind the child. The child is smiling. The figure is not.] " },
    { title: "Phone Screen (cracked)", body: "Last voicemail: '...Mom I found the place from the story, it's real, there really IS a flower, I'm going to—' [Recording ends]" },
    { title: "Bloodstained Diary", body: "Day 1: This house is incredible. Day 3: Something follows me. Day 7: I understand now. The monster used to be a man. Like me." },
  ],
  truth: [
    { title: "Final Entry — Dr. Harrow", body: "The monsters are the previous seekers. Every person who entered and failed became one. I counted seven. There are seven monster forms. God forgive me." },
    { title: "Hidden Note Behind Mirror", body: "If you are reading this, you are still human. The flower is real. Pick it before Stage 4. After that — even the flower cannot save you." },
    { title: "The Confession", body: "The curse doesn't want the flower found. It needs believers. Every failed seeker feeds it. You are its hope. Disappoint it." },
    { title: "Edmund's Last Words", body: "I bound myself into the house. I became the warden. The monsters can be freed — by breaking the flower's curse. Please. Free them. Free me." },
  ]
};

export class StoryFragments {
  constructor(rand) {
    this.rand = rand;
    this.fragments = [];
    this.collected = new Set();
    this._buildPool();
  }

  _buildPool() {
    const allFragments = [];
    Object.entries(LORE_ARCS).forEach(([arc, entries]) => {
      entries.forEach((e, i) => allFragments.push({ ...e, arc, id: `${arc}_${i}` }));
    });
    // Shuffle and pick 5-7 per run
    for (let i = allFragments.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [allFragments[i], allFragments[j]] = [allFragments[j], allFragments[i]];
    }
    const count = 5 + Math.floor(this.rand() * 3);
    this.pool = allFragments.slice(0, count);
  }

  spawnInScene(scene, rooms) {
    const validRooms = rooms.filter(r => r.center);
    this.pool.forEach((frag, i) => {
      const room = validRooms[i % validRooms.length];
      const ox = (this.rand() - 0.5) * (room.w || 3) * 0.6;
      const oz = (this.rand() - 0.5) * (room.d || 3) * 0.6;
      const pos = room.center.clone().add(new THREE.Vector3(ox, -0.5, oz));

      // Visual: glowing note on floor
      const noteMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.02, 0.4),
        new THREE.MeshLambertMaterial({ color: 0xeeddbb, emissive: 0xaa8844, emissiveIntensity: 0.4 })
      );
      noteMesh.position.copy(pos);
      noteMesh.rotation.y = this.rand() * Math.PI;
      noteMesh.userData.isFragment = true;
      noteMesh.userData.fragment = frag;
      scene.add(noteMesh);
      this.fragments.push(noteMesh);
    });
  }

  checkPickup(playerPos, threshold = 1.8) {
    for (const mesh of this.fragments) {
      if (!mesh.parent) continue;
      if (this.collected.has(mesh.userData.fragment.id)) continue;
      if (playerPos.distanceTo(mesh.position) < threshold) return mesh;
    }
    return null;
  }

  collect(mesh) {
    const frag = mesh.userData.fragment;
    this.collected.add(frag.id);
    return frag;
  }

  isAllCollected() {
    return this.collected.size >= this.pool.length;
  }

  getCollectedCount() { return this.collected.size; }
  getTotalCount() { return this.pool.length; }
}
