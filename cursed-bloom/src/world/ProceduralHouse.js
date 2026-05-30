// ProceduralHouse.js — Complete realistic 3D house: exterior + interior + yard
import * as THREE from 'three';

// ─── Constants ────────────────────────────────────────────────────────────────
const WT  = 0.25;  // wall thickness
const GH  = 3.2;   // ground floor ceiling height
const UH  = 3.0;   // upper floor ceiling height
const BH  = 2.8;   // basement height
const DW  = 1.0;   // door width
const DHT = 2.2;   // door height
const WW  = 1.0;   // window width
const WH  = 1.1;   // window height

// ─── Seeded RNG ───────────────────────────────────────────────────────────────
function mkRnd(seed) {
  let s = seed;
  return () => { s=(s*1664525+1013904223)&0xffffffff; return (s>>>0)/0xffffffff; };
}

// ─── House Styles ─────────────────────────────────────────────────────────────
const STYLES = [
  { name:'Victorian Mansion', extC:0x7a6648, roofC:0x160c04, trimC:0xd4c4a0, intWC:0xc8b898, flrC:0x5a4828, hasAttic:true  },
  { name:'Suburban Home',     extC:0xcca880, roofC:0x22140a, trimC:0xf0ece4, intWC:0xe4d8c4, flrC:0x7a6040, hasAttic:false },
  { name:'Farmhouse',         extC:0xc0aa88, roofC:0x2e1e0e, trimC:0xf4f0e8, intWC:0xd8ccb4, flrC:0x887050, hasAttic:true  },
  { name:'Modern Villa',      extC:0xdedad2, roofC:0x202020, trimC:0xffffff, intWC:0xf2eeea, flrC:0xa09080, hasAttic:false },
];

// ─── Material Factory ─────────────────────────────────────────────────────────
function TM(hex, rep=4, noiseAmt=0.1) {
  const cv=document.createElement('canvas'); cv.width=cv.height=256;
  const ctx=cv.getContext('2d');
  const r=(hex>>16)&255, g=(hex>>8)&255, b=hex&255;
  ctx.fillStyle=`rgb(${r},${g},${b})`; ctx.fillRect(0,0,256,256);
  for(let i=0;i<1200;i++){
    const v=Math.random()*noiseAmt;
    ctx.fillStyle=`rgba(0,0,0,${v})`; ctx.fillRect(Math.random()*256,Math.random()*256,3,3);
  }
  const t=new THREE.CanvasTexture(cv);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rep,rep);
  return new THREE.MeshLambertMaterial({map:t,color:hex});
}
function SM(c){return new THREE.MeshLambertMaterial({color:c});}
function GLASMAT(){return new THREE.MeshLambertMaterial({color:0x1a2a4a,transparent:true,opacity:0.5,side:THREE.DoubleSide});}

// ─── Geometry Helpers ─────────────────────────────────────────────────────────
function B(sc,w,h,d,x,y,z,m,sh=true){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  mesh.position.set(x,y,z);
  mesh.castShadow=sh; mesh.receiveShadow=true;
  sc.add(mesh); return mesh;
}

// ─── Main Class ───────────────────────────────────────────────────────────────
export class ProceduralHouse {
  constructor(seed) {
    this.seed=seed;
    this.rand=mkRnd(seed);
    this.style=STYLES[Math.floor(this.rand()*STYLES.length)];
    // House: 20m wide × 14m deep, centered at origin
    this.HW=10; this.HD=7;
    this.rooms=[];   // {name,center,w,d,floor,light}
    this.doors=[];   // {mesh,panel,isOpen,isFront,position}
    this._lights=[];
    this._frontDoorOpen=false;
    this._scene=null;
    this._initMats();
  }

  _initMats(){
    const s=this.style;
    this.M={
      extW:  TM(s.extC,3),
      intW:  TM(s.intWC,5),
      flr:   TM(s.flrC,6),
      flrB:  TM(0x181412,8),
      ceil:  TM(0xccc4b0,4),
      roof:  SM(s.roofC),
      trim:  SM(s.trimC),
      glass: GLASMAT(),
      door:  TM(0x4a3015,3),
      grnd:  TM(0x263318,12),
      conc:  TM(0x787060,5),
      stone: TM(0x585048,5),
      fence: SM(0x4a3a22),
      porch: TM(0x605a40,5),
      dkW:   TM(0x201810,4),
      fabric:TM(0x485060,4),
      white: SM(0xdddddd),
    };
  }

  buildGeometry(scene){
    this._scene=scene;
    // Sky sphere
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(150,16,8),
      new THREE.MeshLambertMaterial({color:0x04040e,side:THREE.BackSide})
    ));
    // Ground
    B(scene,400,0.1,400,0,-0.05,0,this.M.grnd,false);

    this._buildYard();
    this._buildExteriorShell();
    this._buildRoof();
    this._buildPorch();
    this._buildGroundFloor();
    this._buildUpperFloor();
    this._buildBasement();
    if(this.style.hasAttic) this._buildAttic();
    this._buildAllLighting();
  }

  // ── Yard: driveway, fence, trees ──────────────────────────────────────────
  _buildYard(){
    const sc=this._scene, {HW,HD}=this;

    // Driveway
    B(sc,4,0.06,24,HW*0.4,0.03,-HD-18,this.M.conc,false);

    // Stone path to front door
    for(let i=0;i<10;i++){
      const pz=-HD-i*1.1-0.8;
      B(sc,0.9+Math.random()*0.3,0.06,0.55+Math.random()*0.2,
        (Math.random()-0.5)*0.3,0.03,pz,this.M.stone,false);
    }

    // Fence (front perimeter)
    const FD=HD+16, FW=HW+6;
    // Front fence with gate gap
    B(sc,FW-1,1.1,0.1,-(FW+1)/2-0.5,0.55,-FD,this.M.fence);
    B(sc,FW-1,1.1,0.1, (FW+1)/2+0.5,0.55,-FD,this.M.fence);
    // Side fences
    B(sc,0.1,1.1,FD-HD,-FW,0.55,-(HD+(FD-HD)/2),this.M.fence);
    B(sc,0.1,1.1,FD-HD, FW,0.55,-(HD+(FD-HD)/2),this.M.fence);
    // Fence posts
    for(let fx=-FW;fx<=FW;fx+=2.2){
      if(Math.abs(fx)>1.8) B(sc,0.12,1.3,0.12,fx,0.65,-FD,this.M.fence);
    }
    for(let fz=-FD;fz<=-HD-0.5;fz+=2.2){
      B(sc,0.12,1.3,0.12,-FW,0.65,fz,this.M.fence);
      B(sc,0.12,1.3,0.12, FW,0.65,fz,this.M.fence);
    }

    // Trees
    const treePositions=[
      [-FW+2,0,-FD+3],[-FW+1,0,-HD-5],[-HW-2,0,-HD*0.6],
      [ FW-2,0,-FD+3],[ FW-1,0,-HD-5],[ HW+2,0,-HD*0.4],
      [-FW+4,0,-HD-10],[FW-4,0,-HD-10],[HW+3,0,HD*0.5],
      [-HW-3,0,HD*0.3],[-HW-2,0,HD*0.7],[HW+2,0,HD*0.6],
    ];
    treePositions.forEach(([tx,ty,tz])=>{
      const h=4+this.rand()*6;
      this._tree(tx,ty,tz,h);
    });

    // Garden beds
    B(sc,3,0.15,1,-HW-1.5,0.07,-HD+2,TM(0x2a2018,6),false);
    B(sc,3,0.15,1, HW+1.5,0.07,-HD+2,TM(0x2a2018,6),false);
    // Bushes beside porch
    [-2.5,2.5].forEach(bx=>{
      const bm=SM(0x1a3010);
      const bush=new THREE.Mesh(new THREE.SphereGeometry(0.6,7,5),bm);
      bush.position.set(bx,0.5,-HD-0.2); bush.castShadow=true;
      sc.add(bush);
    });

    // Mailbox
    B(sc,0.25,0.35,0.2,-FW+0.3,0.85,-FD+0.5,TM(0x333333,3));
    B(sc,0.06,0.8,0.06,-FW+0.3,0.4,-FD+0.5,TM(0x222222,3));

    // Outdoor lamp post at driveway
    B(sc,0.08,3.5,0.08,HW*0.4,1.75,-HD-14,SM(0x1a1810));
    const lampLight=new THREE.PointLight(0xffdd88,2.5,18);
    lampLight.position.set(HW*0.4,3.6,-HD-14);
    sc.add(lampLight); this._lights.push(lampLight);
  }

  _tree(x,y,z,h){
    const sc=this._scene;
    const tr=this.rand()*0.08+0.1;
    B(sc,tr*2,h,tr*2,x,y+h/2,z,TM(0x2a1808,3));
    const leafC=0x182010+Math.floor(this.rand()*0x050800);
    const lm=SM(leafC);
    for(let i=0;i<3;i++){
      const cone=new THREE.Mesh(
        new THREE.ConeGeometry((1.2-i*0.25)*(0.8+this.rand()*0.5),h*0.55*(1-i*0.1),8),lm);
      cone.position.set(x,y+h*0.4+i*h*0.15,z);
      cone.castShadow=true; sc.add(cone);
    }
  }

  // ── Exterior Shell ────────────────────────────────────────────────────────
  _buildExteriorShell(){
    const sc=this._scene, {HW,HD}=this;
    const h2=GH+UH, m=this.M.extW, tr=this.M.trim;

    // ── North wall (front) with door gap at x=0 ──
    const sideW=(HW-DW/2)-0.02;
    B(sc,sideW,GH,WT, -(DW/2+sideW/2), GH/2, -HD, m);  // left of door
    B(sc,sideW,GH,WT,  (DW/2+sideW/2), GH/2, -HD, m);  // right of door
    B(sc,DW+0.02,GH-DHT,WT, 0, DHT+(GH-DHT)/2, -HD, m);// above door
    B(sc,HW*2,UH,WT, 0, GH+UH/2, -HD, m);               // upper floor north

    // ── Other 3 walls (full height) ──
    B(sc,HW*2,h2,WT, 0,    h2/2,  HD, m); // south
    B(sc,WT,h2,HD*2, -HW,  h2/2,  0,  m); // west
    B(sc,WT,h2,HD*2,  HW,  h2/2,  0,  m); // east

    // ── Floor slabs ──
    B(sc,HW*2,0.15,HD*2, 0, GH,    0, this.M.ceil,false); // GF ceiling / UF floor
    B(sc,HW*2,0.15,HD*2, 0, GH+UH, 0, this.M.ceil,false); // UF ceiling

    // ── Corner trim ──
    [[-HW,-HD],[HW,-HD],[-HW,HD],[HW,HD]].forEach(([cx,cz])=>{
      B(sc,0.18,h2+0.1,0.18, cx,h2/2,cz, tr);
    });

    // ── Front door frame ──
    B(sc,DW+0.18,0.1,WT+0.1, 0, DHT,       -HD-0.02, tr); // top
    B(sc,0.09,DHT,WT+0.1, -DW/2-0.045, DHT/2, -HD-0.02, tr); // left
    B(sc,0.09,DHT,WT+0.1,  DW/2+0.045, DHT/2, -HD-0.02, tr); // right

    // ── Front door mesh (hinged at right side) ──
    const fDoorGrp=new THREE.Group();
    fDoorGrp.position.set(-DW/2, 0, -HD);
    const fDoorPnl=new THREE.Mesh(new THREE.BoxGeometry(DW-0.04,DHT,0.06),this.M.door);
    fDoorPnl.position.set(DW/2-0.02, DHT/2, 0);
    fDoorGrp.add(fDoorPnl);
    sc.add(fDoorGrp);
    this.doors.push({
      mesh:fDoorGrp, panel:fDoorPnl, isOpen:false, isFront:true,
      position:new THREE.Vector3(0,1.0,-HD)
    });

    // ── Windows (glass + frame overlays) ──
    // Ground floor
    this._win(-HW*0.62,GH*0.55,-HD,'z');
    this._win( HW*0.62,GH*0.55,-HD,'z');
    this._win(-HW*0.50,GH*0.55, HD,'z');
    this._win( HW*0.50,GH*0.55, HD,'z');
    this._win( 0.0,    GH*0.55, HD,'z');
    this._win(-HW, GH*0.50,-HD*0.4,'x');
    this._win(-HW, GH*0.50, HD*0.4,'x');
    this._win( HW, GH*0.50,-HD*0.4,'x');
    this._win( HW, GH*0.50, HD*0.4,'x');
    // Upper floor
    this._win(-HW*0.55,GH+UH*0.50,-HD,'z');
    this._win( HW*0.55,GH+UH*0.50,-HD,'z');
    this._win(-HW*0.50,GH+UH*0.50, HD,'z');
    this._win( HW*0.50,GH+UH*0.50, HD,'z');
    this._win(-HW, GH+UH*0.50, 0,'x');
    this._win( HW, GH+UH*0.50, 0,'x');

    this._frontDoorPos=new THREE.Vector3(0,1.0,-HD);
  }

  _win(wx,wy,wz,axis){
    const sc=this._scene, tr=this.M.trim, gl=this.M.glass;
    const ft=0.07;
    // Glass pane (sits on wall surface)
    const gd=axis==='z'?0.07:WW, gw=axis==='z'?WW:0.07;
    B(sc,gw,WH,gd,wx,wy,wz,gl,false);
    // Frame top/bottom
    const fw=axis==='z'?WW+ft*2:ft, fd=axis==='z'?ft:WW+ft*2;
    B(sc,fw,ft,fd,wx,wy+WH/2+ft/2,wz,tr,false);
    B(sc,fw,ft,fd,wx,wy-WH/2-ft/2,wz,tr,false);
    // Frame sides
    const sw=axis==='z'?ft:ft;
    B(sc,sw,WH+ft*2,fd,wx+(axis==='z'?-WW/2-ft/2:0),wy,wz+(axis==='z'?0:-WW/2-ft/2),tr,false);
    B(sc,sw,WH+ft*2,fd,wx+(axis==='z'? WW/2+ft/2:0),wy,wz+(axis==='z'?0: WW/2+ft/2),tr,false);
    // Sill
    B(sc,axis==='z'?WW+ft*2:0.15,0.06,axis==='z'?0.15:WW+ft*2,wx,wy-WH/2-0.04,wz,tr,false);
    // Interior soft glow (moon through window)
    const wl=new THREE.PointLight(0x3344aa,0.4,5);
    wl.position.set(wx+(axis==='z'?0:Math.sign(wx)*0.6),wy,wz+(axis==='z'?Math.sign(wz)*0.6:0));
    sc.add(wl);
  }

  // ── Roof ──────────────────────────────────────────────────────────────────
  _buildRoof(){
    const sc=this._scene, {HW,HD}=this;
    const m=this.M.roof, tr=this.M.trim;
    const yBase=GH+UH, RH=HW*0.55, ridgeZ=HD+0.6;
    const slope=Math.sqrt(HW*HW+RH*RH), ang=Math.atan2(RH,HW);

    // Left slope
    const lS=new THREE.Mesh(new THREE.BoxGeometry(slope,0.15,ridgeZ*2),m);
    lS.position.set(-HW/2,yBase+RH/2,0);
    lS.rotation.z=-(Math.PI/2-ang); lS.castShadow=true; sc.add(lS);

    // Right slope
    const rS=new THREE.Mesh(new THREE.BoxGeometry(slope,0.15,ridgeZ*2),m);
    rS.position.set(HW/2,yBase+RH/2,0);
    rS.rotation.z=(Math.PI/2-ang); rS.castShadow=true; sc.add(rS);

    // Ridge beam
    B(sc,0.2,0.2,ridgeZ*2, 0,yBase+RH,0, tr);

    // Gable ends (front + back)
    const gv=new Float32Array([-HW,0,0, HW,0,0, 0,RH,0]);
    const gi=new Uint16Array([0,1,2]);
    [-HD-0.13, HD+0.13].forEach((gz,i)=>{
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.BufferAttribute(gv.slice(),3));
      geo.setIndex(new THREE.BufferAttribute(gi.slice(),1));
      geo.computeVertexNormals();
      const g=new THREE.Mesh(geo,m);
      g.position.set(0,yBase,gz);
      if(i===1) g.rotation.y=Math.PI;
      g.castShadow=true; sc.add(g);
    });

    // Eave overhang
    B(sc,HW*2+1.2,0.12,ridgeZ*2+1.2, 0,yBase+0.06,0, tr,false);

    // Chimney
    const chX=(this.rand()>0.5?1:-1)*HW*0.3;
    B(sc,0.9,RH+1.8,0.9, chX,yBase+RH*0.5+0.9,0, this.M.stone);
    B(sc,1.1,0.2,1.1, chX,yBase+RH+1.9,0, this.M.stone);
  }

  // ── Porch ─────────────────────────────────────────────────────────────────
  _buildPorch(){
    const sc=this._scene, {HW,HD}=this;
    const pw=Math.min(HW*0.65,6), pd=2.8, ph=0.4;
    const m=this.M.porch, tr=this.M.trim;

    // Platform
    B(sc,pw*2,ph,pd, 0,ph/2,-HD-pd/2, m);
    // Steps
    for(let i=0;i<3;i++){
      B(sc,pw*2+i*0.3,0.15,0.4, 0,(i+1)*0.15,-HD-pd-i*0.4, this.M.stone);
    }
    // Porch roof
    B(sc,pw*2+0.8,0.15,pd+0.5, 0,ph+2.5,-HD-pd/2, this.M.roof);
    // Pillars
    const pilH=2.5;
    [-pw+0.3,pw-0.3].forEach(px=>{
      B(sc,0.22,pilH,0.22, px,ph+pilH/2,-HD-pd+0.3, tr);
      B(sc,0.22,pilH,0.22, px,ph+pilH/2,-HD-0.15,   tr);
    });
    // Railing
    B(sc,pw*2-0.6,0.09,0.07, 0,ph+0.9,-HD-pd+0.15, tr);
    [-pw+0.3,pw-0.3].forEach(px=>{
      B(sc,0.07,0.9,pd-0.15, px,ph+0.45,-HD-pd/2+0.07, tr);
    });
    // Porch light
    const pL=new THREE.PointLight(0xffcc77,3.0,12);
    pL.position.set(0,ph+2.3,-HD-0.6);
    sc.add(pL); this._lights.push(pL);
    // Light fixture
    B(sc,0.15,0.3,0.15, 0,ph+2.6,-HD-0.6, SM(0x111111),false);
  }

  // ── Ground Floor Interior ─────────────────────────────────────────────────
  _buildGroundFloor(){
    const sc=this._scene, {HW,HD}=this;
    const yB=0, iX1=-HW+WT, iX2=HW-WT, iZ1=-HD+WT, iZ2=HD-WT;

    // Divider positions
    const xL=-3.0, xR=3.5;
    const zMid=-1.8, zBack=2.5;

    // ── Partition walls ──
    // Front/back horizontal divider (z=zMid)
    this._iWall(yB,GH, iX1,zMid,xL,zMid,  -1);        // west section no door (connects to living via end)
    this._iWall(yB,GH, xL,zMid,xR,zMid,   0.5,'h');   // center - door foyer→back
    this._iWall(yB,GH, xR,zMid,iX2,zMid,  0.4,'h');   // east - door study→bath

    // Vertical dividers front section
    this._iWall(yB,GH, xL,iZ1,xL,zMid,    -1);         // foyer|storage left wall (no door - storage accesses from foyer)
    this._iWall(yB,GH, xR,iZ1,xR,zMid,    -1);         // foyer|study right wall (no door - study accesses from foyer end)
    // Foyer to storage door
    this._iWall(yB,GH, iX1,iZ1+3,xL,iZ1+3, 0.5,'h');  // storage inner wall with door

    // Vertical dividers back section
    this._iWall(yB,GH, xL,zMid,xL,iZ2,    0.4,'v');   // living|kitchen door
    this._iWall(yB,GH, xR,zMid,xR,iZ2,    0.4,'v');   // kitchen→bath | laundry

    // Back section horizontal splits
    this._iWall(yB,GH, xL,zBack,xR,zBack,  0.5,'h');  // kitchen|dining door
    this._iWall(yB,GH, xR,zBack,iX2,zBack, 0.5,'h');  // bath|laundry door

    // Staircase wall (partial wall in foyer to suggest stairwell)
    B(sc,0.2,GH,2.0, xL-0.1,yB+GH/2,zMid-1.0, this.M.intW);

    // Stairs to upper floor (inside foyer, back-left)
    this._stairs(sc, xL-0.7, yB, zMid-0.2, 2, GH, false);

    // Stairs to basement (inside storage room)
    this._stairs(sc, iX1+2, yB, iZ1+1.5, 1.5, GH, true);

    // ── Rooms ──
    const gfRooms=[
      {name:'foyer',       x1:xL,  x2:xR,  z1:iZ1,  z2:zMid,  lightC:0xcc9955, lightI:2.5},
      {name:'storage',     x1:iX1, x2:xL,  z1:iZ1,  z2:iZ1+3, lightC:0x887755, lightI:1.5},
      {name:'study',       x1:xR,  x2:iX2, z1:iZ1,  z2:zMid,  lightC:0xaa8840, lightI:2.0},
      {name:'living_room', x1:iX1, x2:xL,  z1:zMid, z2:iZ2,   lightC:0xcc9944, lightI:3.0},
      {name:'kitchen',     x1:xL,  x2:xR,  z1:zMid, z2:zBack,  lightC:0xddbb88, lightI:3.0},
      {name:'dining',      x1:xL,  x2:xR,  z1:zBack,z2:iZ2,   lightC:0xcc9944, lightI:2.5},
      {name:'bathroom_gf', x1:xR,  x2:iX2, z1:zMid, z2:zBack,  lightC:0xaabbcc, lightI:2.0},
      {name:'laundry',     x1:xR,  x2:iX2, z1:zBack,z2:iZ2,   lightC:0x8899aa, lightI:1.5},
    ];
    gfRooms.forEach(r=>{
      const cx=(r.x1+r.x2)/2, cz=(r.z1+r.z2)/2;
      const w=r.x2-r.x1, d=r.z2-r.z1;
      r.center=new THREE.Vector3(cx,1.7,cz); r.w=w; r.d=d; r.floor=0;
      const li=new THREE.PointLight(r.lightC,r.lightI,Math.max(w,d)+5);
      li.position.set(cx,yB+GH-0.5,cz);
      li.userData.isRoomLight=true; li.userData.baseIntensity=r.lightI;
      sc.add(li); r.light=li; this._lights.push(li);
      this.rooms.push(r);
      this._furnishRoom(r, yB);
    });
  }

  // ── Upper Floor Interior ──────────────────────────────────────────────────
  _buildUpperFloor(){
    const sc=this._scene, {HW,HD}=this;
    const yB=GH, iX1=-HW+WT, iX2=HW-WT, iZ1=-HD+WT, iZ2=HD-WT;

    const xLU=-2.5, xRU=3.0, zMidU=-1.5, zSplU=2.0;

    // Hallway / landing walls
    this._iWall(yB,UH, iX1,zMidU,xLU,zMidU,  0.4,'h'); // master|landing
    this._iWall(yB,UH, xLU,zMidU,xRU,zMidU,  -1);      // landing wall (open - landing area)
    this._iWall(yB,UH, xRU,zMidU,iX2,zMidU,  0.4,'h'); // bed3|bath

    // Vertical dividers
    this._iWall(yB,UH, xLU,iZ1,xLU,zMidU,    -1);      // master|landing left
    this._iWall(yB,UH, xRU,iZ1,xRU,zMidU,    -1);      // bed3|landing right
    this._iWall(yB,UH, xLU,zMidU,xLU,iZ2,    0.4,'v'); // landing|children's
    this._iWall(yB,UH, xRU,zMidU,xRU,iZ2,    0.4,'v'); // bath|library

    // Back horizontal splits
    this._iWall(yB,UH, iX1,zSplU,xLU,zSplU,  0.4,'h'); // master|bedroom2
    this._iWall(yB,UH, xLU,zSplU,xRU,zSplU,  0.4,'h'); // children's|library (or bath split)
    this._iWall(yB,UH, xRU,zSplU,iX2,zSplU,  0.4,'h'); // bath|library

    const ufRooms=[
      {name:'landing',     x1:xLU, x2:xRU, z1:iZ1,   z2:zMidU,  lightC:0xaa8844, lightI:2.0},
      {name:'master_bed',  x1:iX1, x2:xLU, z1:iZ1,   z2:zSplU,  lightC:0xbb9955, lightI:2.5},
      {name:'bedroom_2',   x1:iX1, x2:xLU, z1:zSplU, z2:iZ2,    lightC:0xaa8844, lightI:2.0},
      {name:'bathroom_uf', x1:xLU, x2:xRU, z1:zMidU, z2:zSplU,  lightC:0x99aabb, lightI:2.0},
      {name:'childrens',   x1:xLU, x2:xRU, z1:zSplU, z2:iZ2,    lightC:0xaa9955, lightI:1.8},
      {name:'bedroom_3',   x1:xRU, x2:iX2, z1:iZ1,   z2:zMidU,  lightC:0xaa8844, lightI:2.0},
      {name:'library',     x1:xRU, x2:iX2, z1:zMidU, z2:iZ2,    lightC:0x8877aa, lightI:1.8},
    ];
    ufRooms.forEach(r=>{
      const cx=(r.x1+r.x2)/2, cz=(r.z1+r.z2)/2;
      const w=r.x2-r.x1, d=r.z2-r.z1;
      r.center=new THREE.Vector3(cx,GH+1.7,cz); r.w=w; r.d=d; r.floor=1;
      const li=new THREE.PointLight(r.lightC,r.lightI,Math.max(w,d)+4);
      li.position.set(cx,yB+UH-0.5,cz);
      li.userData.isRoomLight=true; li.userData.baseIntensity=r.lightI;
      sc.add(li); r.light=li; this._lights.push(li);
      this.rooms.push(r);
      this._furnishRoom(r, yB);
    });
  }

  // ── Basement ──────────────────────────────────────────────────────────────
  _buildBasement(){
    const sc=this._scene, {HW,HD}=this;
    const yB=-BH;
    // Walls
    B(sc,HW*2,BH,WT, 0,yB+BH/2,-HD, this.M.stone);
    B(sc,HW*2,BH,WT, 0,yB+BH/2, HD, this.M.stone);
    B(sc,WT,BH,HD*2,-HW,yB+BH/2, 0, this.M.stone);
    B(sc,WT,BH,HD*2, HW,yB+BH/2, 0, this.M.stone);
    // Floor
    B(sc,HW*2,0.12,HD*2, 0,yB+0.06,0, this.M.flrB,false);
    // Support pillars
    [[-HW*0.5,-HD*0.4],[HW*0.5,-HD*0.4],[-HW*0.5,HD*0.4],[HW*0.5,HD*0.4]].forEach(([px,pz])=>{
      B(sc,0.45,BH,0.45,px,yB+BH/2,pz,this.M.stone);
    });
    // Central wall with door
    this._iWall(yB,BH, 0,-HD+0.3,0,HD-0.3, 0.5,'v');

    [{name:'utility_room',x1:-HW+0.3,x2:0,z1:-HD+0.3,z2:HD-0.3},
     {name:'dark_storage',x1:0,x2:HW-0.3,z1:-HD+0.3,z2:HD-0.3}].forEach(r=>{
      const cx=(r.x1+r.x2)/2, cz=(r.z1+r.z2)/2;
      r.center=new THREE.Vector3(cx,yB+1.7,cz);
      r.w=r.x2-r.x1; r.d=r.z2-r.z1; r.floor=-1;
      const li=new THREE.PointLight(0x334455,1.0,12);
      li.position.set(cx,yB+BH-0.5,cz);
      li.userData.isRoomLight=true; li.userData.baseIntensity=1.0;
      sc.add(li); r.light=li; this._lights.push(li);
      this.rooms.push(r);
    });
  }

  // ── Attic ─────────────────────────────────────────────────────────────────
  _buildAttic(){
    const sc=this._scene, {HW,HD}=this;
    const yB=GH+UH;
    const r={name:'attic',x1:-HW*0.7,x2:HW*0.7,z1:-HD*0.7,z2:HD*0.7};
    r.center=new THREE.Vector3(0,yB+1.5,0);
    r.w=HW*1.4; r.d=HD*1.4; r.floor=2;
    const li=new THREE.PointLight(0x221818,0.8,16);
    li.position.set(0,yB+2,0);
    li.userData.isRoomLight=true; li.userData.baseIntensity=0.8;
    sc.add(li); r.light=li; this._lights.push(li);
    this.rooms.push(r);
    // Attic clutter
    for(let i=0;i<8;i++){
      const bx=(this.rand()-0.5)*HW*1.2, bz=(this.rand()-0.5)*HD*1.2;
      B(sc,0.5+this.rand()*0.5,0.3+this.rand()*0.4,0.4+this.rand()*0.3,bx,yB+0.2,bz,this.M.dkW);
    }
  }

  // ── Interior Wall Builder ─────────────────────────────────────────────────
  // axis: 'h'=fixed-z wall runs along X, 'v'=fixed-x wall runs along Z
  _iWall(yB,h, x1,z1,x2,z2, doorPos=-1, axis='h'){
    const sc=this._scene, m=this.M.intW;
    const isH=axis==='h';
    const lo=isH?Math.min(x1,x2):Math.min(z1,z2);
    const cx=(x1+x2)/2, cz=(z1+z2)/2;

    if(doorPos<0){
      const w=isH?Math.abs(x2-x1):WT, d=isH?WT:Math.abs(z2-z1);
      B(sc,w,h,d,cx,yB+h/2,cz,m); return;
    }

    const len=isH?Math.abs(x2-x1):Math.abs(z2-z1);
    const dS=len*doorPos-DW/2, dE=dS+DW;

    // Before door
    if(dS>0.08){
      const pl=dS, pw=isH?pl:WT, pd=isH?WT:pl;
      const px=isH?lo+pl/2:cx, pz=isH?cz:lo+pl/2;
      B(sc,pw,h,pd,px,yB+h/2,pz,m);
    }
    // After door
    if(dE<len-0.08){
      const pl=len-dE, pw=isH?pl:WT, pd=isH?WT:pl;
      const px=isH?lo+dE+pl/2:cx, pz=isH?cz:lo+dE+pl/2;
      B(sc,pw,h,pd,px,yB+h/2,pz,m);
    }
    // Header above door
    if(h-DHT>0.08){
      const hh=h-DHT, pw=isH?DW:WT, pd=isH?WT:DW;
      const px=isH?lo+dS+DW/2:cx, pz=isH?cz:lo+dS+DW/2;
      B(sc,pw,hh,pd,px,yB+DHT+hh/2,pz,m);
    }
    // Door mesh
    const dpx=isH?lo+dS+DW/2:cx, dpz=isH?cz:lo+dS+DW/2;
    this._addDoor(dpx,yB,dpz, isH?0:Math.PI/2);
  }

  _addDoor(x,yB,z,rotY=0){
    const sc=this._scene;
    const grp=new THREE.Group();
    // Hinge at -DW/2 edge
    grp.position.set(x-Math.cos(rotY)*DW/2, yB, z-Math.sin(rotY)*DW/2);
    const pnl=new THREE.Mesh(new THREE.BoxGeometry(DW-0.04,DHT,0.06),this.M.door);
    pnl.position.set(Math.cos(rotY)*DW/2, DHT/2, Math.sin(rotY)*DW/2);
    // Door knob
    const knob=new THREE.Mesh(new THREE.SphereGeometry(0.04,6,6),SM(0xaa8820));
    knob.position.set(Math.cos(rotY)*(DW-0.15), DHT*0.45, Math.sin(rotY)*(DW-0.15)+0.04);
    grp.add(pnl,knob);
    sc.add(grp);
    this.doors.push({mesh:grp,panel:pnl,isOpen:false,isFront:false,
      position:new THREE.Vector3(x,yB+DHT/2,z)});
  }

  // ── Stairs ────────────────────────────────────────────────────────────────
  _stairs(sc,x,yB,z,w,h,goDown){
    const steps=12, sH=h/steps, sD=0.38;
    const dir=goDown?1:-1;
    for(let i=0;i<steps;i++){
      const sy=yB+(goDown?-(i+1)*sH:(i+0.5)*sH);
      const sz=z+dir*i*sD;
      B(sc,w*2,sH+0.02,sD+0.02,x,sy,sz,this.M.flr);
    }
    // Handrail
    const railH=0.85, railL=steps*sD*0.9;
    const rY=yB+(goDown?-h*0.5:h*0.5)+railH/2;
    const rZ=z+dir*(steps*sD)/2;
    B(sc,0.07,railH,railL,x-w+0.1,rY,rZ,this.M.trim,false);
    B(sc,0.07,railH,railL,x+w-0.1,rY,rZ,this.M.trim,false);
  }

  // ── Room Furniture ────────────────────────────────────────────────────────
  _furnishRoom(room,yB){
    const sc=this._scene;
    const {name,x1,x2,z1,z2}=room;
    const cx=(x1+x2)/2, cz=(z1+z2)/2;
    const w=x2-x1, d=z2-z1;
    const rnd=this.rand;

    const P=(fw,fh,fd,ox,oz,mat)=>{
      B(sc,fw,fh,fd, cx+ox,yB+fh/2, cz+oz, mat);
    };

    switch(name){
      case 'living_room':
        P(2.6,0.85,1.1, -w*0.1, d*0.1, TM(0x3a4555,4));  // sofa
        P(2.6,0.35,0.3,  -w*0.1,d*0.1+0.55, TM(0x3a4555,4)); // sofa back
        P(1.3,0.45,0.75, -w*0.1,-d*0.15, TM(0x3a2010,4)); // coffee table
        P(0.06,0.06,0.75,-w*0.1,-d*0.15, SM(0x111111)); // table legs (visual)
        P(2.0,1.1,0.3,   w*0.2, -d*0.3, SM(0x111111));  // TV
        P(2.0,0.05,0.5,  w*0.2, -d*0.3, TM(0x2a1808,4));// TV stand
        P(0.3,2.1,1.3,  -w*0.35,-d*0.25, TM(0x2a1808,4));// bookshelf
        P(0.08,1.5,0.08, w*0.3,  d*0.3,  SM(0x111111)); // lamp post
        P(0.4,0.02,0.4,  w*0.3,  d*0.3,  SM(0x886633)); // lamp shade
        P(3.0,0.025,2.2, -w*0.05,0,       TM(0x554433,4)); // rug
        break;

      case 'kitchen':
        P(w*0.85,1.0,0.65, 0,-d*0.35, TM(0xd0c8b0,4)); // counter
        P(0.65,1.0,d*0.65,-w*0.38,0,  TM(0xd0c8b0,4)); // side counter
        P(1.5,0.95,0.95,  w*0.1,d*0.05,TM(0xbcb4a0,4));// kitchen island
        P(0.7,1.85,0.72,  w*0.35,-d*0.28, SM(0xdddddd));// fridge
        P(0.65,0.9,0.65,  -w*0.1,-d*0.35,SM(0x222222)); // stove
        P(0.5,0.08,0.45,  w*0.1,-d*0.35, SM(0x777777)); // sink
        P(w*0.7,0.5,0.35,  w*0.05,-d*0.35,TM(0x3a2810,4));// upper cabinets (visual)
        break;

      case 'dining':
        P(1.9,0.78,1.0,  0,0,   TM(0x4a3010,4));// table
        [[-0.7,0.5],[0.7,0.5],[-0.7,-0.5],[0.7,-0.5]].forEach(([ox,oz])=>{
          P(0.45,0.9,0.45, ox,oz, TM(0x2a1808,4));
        });
        P(0.5,0.06,0.5, 0,0, SM(0x111111)); // chandelier
        break;

      case 'study':
        P(1.5,0.76,0.7,  0, d*0.15, TM(0x3a2010,4));  // desk
        P(0.5,0.9,0.5,  -0.3,d*0.15+0.55,TM(0x2a1808,4)); // chair
        P(0.3,2.1,1.3,   w*0.35,0,  TM(0x2a1808,4));  // bookshelf
        P(0.3,2.1,1.3,   w*0.35,d*0.28,TM(0x2a1808,4));
        P(0.5,0.5,0.4,   0,-d*0.3,  SM(0x1a1818)); // old radio/safe
        break;

      case 'storage':
        for(let i=0;i<5;i++)
          P(0.45+rnd()*0.4,0.35+rnd()*0.6,0.4+rnd()*0.35,
            (rnd()-0.5)*w*0.5,(rnd()-0.5)*d*0.4, TM(0x222018,3));
        P(0.3,2.0,1.0, w*0.35,0, TM(0x2a1808,3)); // shelf
        break;

      case 'bathroom_gf':
      case 'bathroom_uf':
        P(0.75,0.65,1.55, w*0.1,-d*0.2, TM(0xccbbaa,3));// tub
        P(0.5,0.82,0.55,-w*0.25,d*0.2, TM(0xddccbb,3)); // toilet
        P(0.7,0.85,0.42,-w*0.2,-d*0.3, TM(0xccc0b0,3)); // sink vanity
        P(0.68,0.06,0.38,-w*0.2,-d*0.3, SM(0x777777));  // sink basin
        break;

      case 'master_bed':
        P(1.85,0.5,2.3,  0,-d*0.05,TM(0x3a2010,4)); // bed frame
        P(1.65,0.3,2.1,  0,-d*0.05,TM(0x888070,4)); // mattress
        P(1.3,0.3,0.65,  -0.3,0.4-d*0.05-1.05,TM(0xd8ccbe,4)); // pillow
        P(0.5,0.56,0.42,-w*0.3,d*0.05,TM(0x2a1808,4)); // nightstand L
        P(0.5,0.56,0.42, w*0.3,d*0.05,TM(0x2a1808,4)); // nightstand R
        P(1.7,2.2,0.6,   w*0.3,d*0.3,  TM(0x2a1808,4)); // wardrobe
        P(1.1,0.04,0.08,-w*0.25,0,    SM(0x2a2020)); // mirror frame
        break;

      case 'bedroom_2':
      case 'bedroom_3':
        P(1.45,0.45,2.0,  0,-d*0.1,TM(0x3a2010,4));
        P(1.25,0.28,1.8,  0,-d*0.1,TM(0x9a8878,4));
        P(0.5,0.55,0.42, w*0.3,-d*0.15,TM(0x2a1808,4));
        P(1.5,2.0,0.55, -w*0.3,d*0.3,  TM(0x2a1808,4));
        break;

      case 'childrens':
        P(1.0,0.35,1.8, -w*0.2,-d*0.05,TM(0x5a3015,4));
        P(0.85,0.22,1.6,-w*0.2,-d*0.05,TM(0xff9090,4));
        P(0.6,0.4,0.4,   w*0.2,d*0.2,  TM(0x5090a0,4));
        P(0.8,0.65,0.5,  w*0.2,-d*0.28,TM(0x886040,4));
        break;

      case 'library':
        for(let i=0;i<5;i++)
          P(0.3,2.1,1.2,-w*0.38+i*0.32,0,TM(0x2a1808,4));
        P(0.85,0.76,0.5, w*0.15,d*0.15,TM(0x3a2010,4));
        P(0.5,0.9,0.5,   w*0.3, d*0.15,TM(0x2a1808,4));
        P(1.0,0.04,0.7,  w*0.1,-d*0.3, SM(0x3a4050)); // reading rug
        break;

      case 'laundry':
        P(0.7,1.1,0.7,-w*0.25,0,SM(0xcccccc)); // washer
        P(0.7,1.1,0.7,-w*0.25,d*0.25,SM(0xbbbbbb)); // dryer
        P(0.3,2.0,0.35,w*0.3,0,TM(0x2a2020,4)); // utility shelf
        break;

      case 'foyer':
        P(0.12,1.8,0.12,-w*0.35,d*0.1,SM(0x1a0e08)); // coat rack
        P(1.3,0.85,0.38, 0,d*0.3,       TM(0x3a2010,4)); // console table
        P(2.5,0.025,1.8, 0,-d*0.05,     TM(0x6a4428,4)); // entry rug
        P(0.5,1.0,0.5,   w*0.3,-d*0.3,  SM(0xd0c8b0)); // umbrella stand
        break;

      case 'utility_room':
        P(0.4,1.9,0.3, w*0.3,-d*0.3, TM(0x181818,3)); // breaker box
        break;
    }
  }

  // ── Global Lighting ───────────────────────────────────────────────────────
  _buildAllLighting(){
    const sc=this._scene;
    // Ambient (bright, clear)
    sc.add(new THREE.AmbientLight(0xffffff, 1.2));
    sc.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.8));
    // Moonlight/Sunlight
    const moon=new THREE.DirectionalLight(0xffffee, 1.0);
    moon.position.set(-15,30,-10); moon.castShadow=true;
    moon.shadow.mapSize.set(2048,2048);
    sc.add(moon);
  }

  // ── Door Interaction ──────────────────────────────────────────────────────
  openDoor(door){
    if(door.isOpen) return;
    door.isOpen=true;
    let t=0;
    const animDoor=()=>{
      t+=0.06;
      if(t<Math.PI/2){
        door.mesh.rotation.y=t*(door.isFront?1:-1);
        requestAnimationFrame(animDoor);
      }
    };
    animDoor();
  }

  checkDoorInteraction(playerPos,threshold=1.8){
    for(const d of this.doors){
      if(!d.isOpen && d.position.distanceTo(playerPos)<threshold) return d;
    }
    return null;
  }

  // ── API ───────────────────────────────────────────────────────────────────
  getSpawnPoint(){
    // Player spawns outside, in front of house
    return new THREE.Vector3(0,1.7,-this.HD-18);
  }

  getAllRoomCenters(){
    return this.rooms.filter(r=>r.center).map(r=>r.center);
  }

  getRandomRoomCenter(){
    const c=this.getAllRoomCenters();
    return c[Math.floor(this.rand()*c.length)];
  }

  getRoomLights(){
    return this._lights.filter(l=>l.userData&&l.userData.isRoomLight);
  }

  getStyleName(){ return this.style.name; }
}
