'use strict';
// The R-07 robot model and its procedural walk / IK animation.

/* =========================================================
   Robot (R-07)
   ========================================================= */
const MAT = {};
function initMaterials() {
  MAT.shell = new THREE.MeshStandardMaterial({ color: 0xdcd9d2, roughness: 0.42, metalness: 0.08 });
  MAT.shell2 = new THREE.MeshStandardMaterial({ color: 0xb9b6ae, roughness: 0.5, metalness: 0.1 });
  MAT.dark = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.55, metalness: 0.55 });
  MAT.accent = new THREE.MeshStandardMaterial({ color: 0xe0712c, roughness: 0.5, metalness: 0.1 });
  MAT.visor = new THREE.MeshStandardMaterial({ color: 0x0a0d10, emissive: 0x86e1f2, emissiveIntensity: 3.2, roughness: 0.25 });
  MAT.fin = new THREE.MeshStandardMaterial({ color: 0x3a3226, emissive: 0xf2a04b, emissiveIntensity: 0.0, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide });
  MAT.concrete = new THREE.MeshStandardMaterial({ color: 0x86827a, roughness: 0.92 });
  MAT.concreteDark = new THREE.MeshStandardMaterial({ color: 0x55524d, roughness: 0.95 });
  MAT.metal = new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: 0.6, metalness: 0.7 });
  MAT.panel = new THREE.MeshStandardMaterial({ color: 0xcfcbc2, roughness: 0.6, metalness: 0.1 });
}
const L1 = 0.44, L2 = 0.44, ANKLE = 0.07;
function mk(geo, mat, parent, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; if (parent) parent.add(m); return m; }

class Robot {
  constructor() {
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body);
    this.pelvis = new THREE.Group(); this.pelvis.position.y = 0.92; this.body.add(this.pelvis);
    mk(new THREE.BoxGeometry(0.34, 0.14, 0.2), MAT.dark, this.pelvis, 0, -0.02, 0);
    mk(new THREE.BoxGeometry(0.3, 0.06, 0.22), MAT.shell2, this.pelvis, 0, 0.05, 0);
    this.legs = [this.makeLeg(1), this.makeLeg(-1)];
    // torso
    this.torso = new THREE.Group(); this.torso.position.y = 0.1; this.pelvis.add(this.torso);
    mk(new THREE.CylinderGeometry(0.11, 0.13, 0.2, 12), MAT.dark, this.torso, 0, 0.1, 0);
    const chest = mk(new THREE.BoxGeometry(0.44, 0.3, 0.25), MAT.shell, this.torso, 0, 0.34, 0.01);
    mk(new THREE.BoxGeometry(0.38, 0.1, 0.27), MAT.shell2, this.torso, 0, 0.2, 0.0);
    mk(new THREE.BoxGeometry(0.2, 0.16, 0.03), MAT.accent, this.torso, 0, 0.36, 0.14);
    mk(new THREE.BoxGeometry(0.06, 0.02, 0.01), MAT.visor, this.torso, -0.13, 0.43, 0.14);
    // shoulder pads + straps
    for (const s of [1, -1]) {
      mk(new THREE.BoxGeometry(0.14, 0.08, 0.26), MAT.shell2, this.torso, 0.23 * s, 0.47, 0);
      mk(new THREE.BoxGeometry(0.035, 0.34, 0.02), MAT.dark, this.torso, 0.12 * s, 0.33, 0.14);
    }
    // head
    this.neck = new THREE.Group(); this.neck.position.set(0, 0.5, 0.01); this.torso.add(this.neck);
    mk(new THREE.CylinderGeometry(0.045, 0.055, 0.08, 8), MAT.dark, this.neck, 0, 0.03, 0);
    this.head = new THREE.Group(); this.head.position.y = 0.09; this.neck.add(this.head);
    mk(new THREE.BoxGeometry(0.21, 0.17, 0.22), MAT.shell, this.head, 0, 0.07, 0);
    mk(new THREE.BoxGeometry(0.22, 0.05, 0.16), MAT.dark, this.head, 0, 0.0, -0.01);
    mk(new THREE.BoxGeometry(0.18, 0.04, 0.02), MAT.dark, this.head, 0, 0.085, 0.11);
    this.visor = mk(new THREE.BoxGeometry(0.16, 0.022, 0.012), MAT.visor, this.head, 0, 0.085, 0.121);
    mk(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 4), MAT.dark, this.head, 0.08, 0.26, -0.06);
    this.antTip = mk(new THREE.SphereGeometry(0.014, 8, 6), MAT.fin, this.head, 0.08, 0.37, -0.06);
    for (const s of [1, -1]) mk(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12), MAT.accent, this.head, 0.11 * s, 0.06, 0).rotation.z = Math.PI / 2;
    // arms
    this.arms = [this.makeArm(1), this.makeArm(-1)];
    // sensor fin (left shoulder)
    this.sensor = new THREE.Group(); this.sensor.position.set(0.24, 0.52, -0.06); this.torso.add(this.sensor);
    mk(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8), MAT.dark, this.sensor, 0, 0, 0);
    this.sensorArm = new THREE.Group(); this.sensor.add(this.sensorArm);
    mk(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 6), MAT.dark, this.sensorArm, 0, 0.13, 0);
    this.finHub = new THREE.Group(); this.finHub.position.y = 0.27; this.sensorArm.add(this.finHub);
    this.fins = [];
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Group(); f.rotation.y = i / 4 * TAU; this.finHub.add(f);
      const leaf = mk(new THREE.BoxGeometry(0.012, 0.13, 0.05), MAT.fin, f, 0, 0.05, 0.03);
      this.fins.push({ g: f, leaf });
    }
    // back rack
    this.rack = new THREE.Group(); this.rack.position.set(0, 0.12, -0.14); this.torso.add(this.rack);
    for (const s of [1, -1]) mk(new THREE.BoxGeometry(0.03, 0.9, 0.03), MAT.dark, this.rack, 0.18 * s, 0.3, -0.03);
    mk(new THREE.BoxGeometry(0.42, 0.03, 0.34), MAT.dark, this.rack, 0, -0.16, -0.17);
    mk(new THREE.BoxGeometry(0.4, 0.03, 0.03), MAT.accent, this.rack, 0, 0.74, -0.03);
    mk(new THREE.BoxGeometry(0.3, 0.26, 0.08), MAT.shell2, this.rack, 0, 0.12, -0.01);
    this.stack = new THREE.Group(); this.stack.position.set(0, -0.145, -0.05); this.rack.add(this.stack);
    // state
    this.phase = 0; this.gaitAmp = 0; this.heading = 0;
    this.gripW = [0, 0]; this.fallT = 0; this.fallDir = new THREE.Vector2(); this.crouch = 0;
    this.visorColor = new THREE.Color(0x86e1f2);
    this.sensorOpen = 0; this.sensorSpin = 0;
    this.tmp = new THREE.Vector3(); this.tmp2 = new THREE.Vector3();
    this.footPos = [new THREE.Vector3(), new THREE.Vector3()];
    this.lastStepPhase = [0, 0];
    this.onStep = null;
    this.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }
  makeLeg(side) {
    const hip = new THREE.Group(); hip.position.set(0.12 * side, -0.04, 0); hip.rotation.order = 'ZXY'; this.pelvis.add(hip);
    mk(new THREE.SphereGeometry(0.065, 10, 8), MAT.dark, hip);
    mk(new THREE.CapsuleGeometry(0.068, L1 - 0.14, 4, 10), MAT.shell, hip, 0, -L1 / 2, 0.005);
    mk(new THREE.BoxGeometry(0.1, 0.12, 0.05), MAT.shell2, hip, 0.02 * side, -0.14, 0.06);
    const knee = new THREE.Group(); knee.position.y = -L1; hip.add(knee);
    mk(new THREE.SphereGeometry(0.058, 10, 8), MAT.dark, knee);
    mk(new THREE.BoxGeometry(0.09, 0.08, 0.05), MAT.accent, knee, 0, 0.02, 0.055);
    mk(new THREE.CylinderGeometry(0.052, 0.075, L2 - 0.1, 10), MAT.shell, knee, 0, -L2 / 2 + 0.02, 0);
    mk(new THREE.BoxGeometry(0.08, 0.2, 0.04), MAT.shell2, knee, 0, -0.2, 0.05);
    const ankle = new THREE.Group(); ankle.position.y = -L2; knee.add(ankle);
    mk(new THREE.SphereGeometry(0.045, 8, 6), MAT.dark, ankle);
    mk(new THREE.BoxGeometry(0.12, 0.055, 0.25), MAT.dark, ankle, 0, -ANKLE + 0.03, 0.04);
    mk(new THREE.BoxGeometry(0.125, 0.02, 0.26), MAT.accent, ankle, 0, -ANKLE + 0.005, 0.04);
    return { hip, knee, ankle, side };
  }
  makeArm(side) {
    const sh = new THREE.Group(); sh.position.set(0.28 * side, 0.43, 0); this.torso.add(sh);
    mk(new THREE.SphereGeometry(0.06, 10, 8), MAT.dark, sh);
    mk(new THREE.CapsuleGeometry(0.052, 0.18, 4, 8), MAT.shell, sh, 0, -0.15, 0);
    const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
    mk(new THREE.SphereGeometry(0.045, 8, 6), MAT.dark, el);
    mk(new THREE.CylinderGeometry(0.045, 0.055, 0.22, 8), MAT.shell2, el, 0, -0.13, 0);
    mk(new THREE.BoxGeometry(0.07, 0.1, 0.07), MAT.dark, el, 0, -0.29, 0.01);
    return { sh, el, side };
  }
  solveLeg(leg, target) {
    const t = this.pelvis.worldToLocal(this.tmp.copy(target));
    t.sub(leg.hip.position);
    const roll = Math.atan2(t.x, -t.y);
    const py = -Math.sqrt(t.x * t.x + t.y * t.y), pz = t.z;
    let d = Math.hypot(py, pz);
    d = clamp(d, 0.25, L1 + L2 - 0.002);
    const alpha = Math.atan2(pz, -py);
    const a1 = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const a2 = Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
    leg.hip.rotation.z = roll;
    leg.hip.rotation.x = -(alpha + a1);
    leg.knee.rotation.x = Math.PI - a2;
    leg.ankle.rotation.x = -(leg.hip.rotation.x + leg.knee.rotation.x);
    leg.ankle.rotation.z = -roll;
  }
  setCargoVisual(list) {
    while (this.stack.children.length) this.stack.remove(this.stack.children[0]);
    let y = 0;
    list.forEach((c) => {
      c.mesh.position.set(0, y + c.size[1] / 2, -c.size[2] / 2 + 0.03);
      c.mesh.rotation.set(0, 0, 0);
      c.stackY = y;
      this.stack.add(c.mesh);
      y += c.size[1] + 0.005;
    });
    this.stackHeight = y;
  }
  update(dt, P) {
    const R = this.root;
    R.position.copy(P.pos);
    this.heading += angleDiff(this.heading, P.heading) * (1 - Math.exp(-10 * dt));
    R.rotation.y = this.heading;
    const speed = P.speed;
    const st = P.state;
    // crouch (sneak)
    this.crouch = damp(this.crouch, P.sneak ? 1 : 0, 6, dt);
    // ---- fall / get-up pose ----
    if (st === 'fallen' || st === 'getup' || st === 'boot') {
      let k;
      if (st === 'fallen') k = smoothstep(0, 0.45, P.stateT);
      else if (st === 'getup') k = 1 - smoothstep(0, 1.1, P.stateT);
      else k = 1 - smoothstep(0.6, 2.4, P.stateT);
      const fd = this.fallDir;
      const kneel = st === 'boot';
      if (kneel) {
        this.body.rotation.set(0, 0, 0);
        this.pelvis.position.y = lerp(0.92, 0.52, k);
        this.torso.rotation.set(lerp(0, 0.32, k), 0, 0);
        this.neck.rotation.x = lerp(0, 0.6, k);
      } else {
        this.body.rotation.x = fd.y * k * 1.35;
        this.body.rotation.z = -fd.x * k * 1.35;
        this.pelvis.position.y = lerp(0.92, 0.55, k);
        this.torso.rotation.set(0.3 * k, 0, 0);
        this.neck.rotation.x = 0;
      }
      R.updateMatrixWorld(true);
      for (const leg of this.legs) {
        leg.hip.rotation.set(lerp(-0.05, -1.3, k * (kneel ? 1 : 0.6)), 0, 0);
        leg.knee.rotation.x = lerp(0.1, kneel ? 2.3 : 1.2, k);
        leg.ankle.rotation.x = -(leg.hip.rotation.x + leg.knee.rotation.x) * (kneel ? 1 : 0.3);
        leg.ankle.rotation.z = 0;
      }
      if (kneel) { this.legs[1].hip.rotation.x = lerp(-0.05, -0.2, k); this.legs[1].knee.rotation.x = lerp(0.1, 2.0, k); }
      for (const arm of this.arms) { arm.sh.rotation.set(lerp(0, -0.4, k), 0, arm.side * lerp(0.1, 0.5, k)); arm.el.rotation.x = -0.6 * k; }
      this.stack.rotation.set(0, 0, 0);
      this.updateVisor(P, dt);
      this.updateSensor(P, dt);
      return;
    }
    this.body.rotation.x = damp(this.body.rotation.x, 0, 8, dt);
    this.body.rotation.z = damp(this.body.rotation.z, 0, 8, dt);
    // ---- gait ----
    const moving = speed > 0.08;
    this.gaitAmp = damp(this.gaitAmp, moving ? 1 : 0, moving ? 6 : 8, dt);
    const A = lerp(0.12, 0.54, clamp(speed / RUN, 0, 1)) * (1 - this.crouch * 0.25);
    const beta = lerp(0.62, 0.38, clamp((speed - WALK) / (RUN - WALK), 0, 1));
    if (moving) this.phase = (this.phase + dt / (2 * A / (Math.max(speed, 0.3) * beta))) % 1;
    else this.phase = damp(this.phase, Math.round(this.phase * 2) / 2, 3, dt) % 1;
    const run = clamp((speed - WALK) / (RUN - WALK), 0, 1);
    // pelvis height / bob
    const fwd = this.tmp2.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    const rightX = -Math.cos(this.heading), rightZ = Math.sin(this.heading);
    const footInfo = [];
    for (let s = 0; s < 2; s++) {
      const leg = this.legs[s];
      const ph = (this.phase + s * 0.5) % 1;
      let z, lift = 0;
      if (ph < beta) z = A - 2 * A * (ph / beta);
      else { const u = (ph - beta) / (1 - beta); z = -A + 2 * A * (u * u * (3 - 2 * u)); lift = Math.sin(Math.PI * u) * lerp(0.1, 0.2, run); }
      z *= this.gaitAmp; lift *= this.gaitAmp;
      const lat = 0.12 * leg.side * (1 + this.crouch * 0.3);
      const fx = P.pos.x + fwd.x * z - rightX * lat;
      const fz = P.pos.z + fwd.z * z - rightZ * lat;
      const gy = P.groundAt(fx, fz, P.pos.y);
      footInfo.push({ fx, fz, gy, lift, ph });
      // footstep event
      const planted = ph < beta;
      if (planted && this.lastStepPhase[s] >= beta && moving && this.onStep) this.onStep(s, speed, fx, fz);
      this.lastStepPhase[s] = ph;
    }
    const lowRel = Math.min(footInfo[0].gy, footInfo[1].gy) - P.pos.y;
    const bob = moving ? (run > 0.3 ? -Math.abs(Math.cos(this.phase * TAU)) * 0.06 * run : -Math.abs(Math.sin(this.phase * TAU * 2)) * 0.02) * this.gaitAmp : 0;
    const baseH = 0.9 - this.crouch * 0.24 - run * 0.03;
    const pelvisY = Math.min(baseH + bob, lowRel + 0.9);
    this.pelvis.position.y = damp(this.pelvis.position.y, pelvisY, 18, dt);
    // torso lean
    const lean = run * 0.18 + this.crouch * 0.35 + (P.tiltZ || 0) * 0.3;
    this.torso.rotation.x = damp(this.torso.rotation.x, lean, 8, dt);
    const shift = (P.grip[1] ? 1 : 0) - (P.grip[0] ? 1 : 0);
    this.torso.rotation.z = damp(this.torso.rotation.z, (P.tiltX || 0) * 0.32 + shift * 0.12, 10, dt);
    this.torso.rotation.y = moving ? Math.sin(this.phase * TAU) * 0.08 * this.gaitAmp : 0;
    this.pelvis.rotation.y = -this.torso.rotation.y * 0.6;
    this.pelvis.rotation.z = (P.tiltX || 0) * 0.08;
    // IK legs
    R.updateMatrixWorld(true);
    for (let s = 0; s < 2; s++) {
      const f = footInfo[s];
      this.footPos[s].set(f.fx, f.gy + f.lift + ANKLE, f.fz);
      this.solveLeg(this.legs[s], this.footPos[s]);
    }
    // arms
    for (let s = 0; s < 2; s++) {
      const arm = this.arms[s];
      const gw = this.gripW[s] = damp(this.gripW[s], P.grip[s] ? 1 : 0, 10, dt);
      const swing = Math.sin((this.phase + (s === 0 ? 0.5 : 0)) * TAU) * lerp(0.3, 0.7, run) * this.gaitAmp;
      const holding = P.holding ? 1 : 0;
      arm.sh.rotation.x = lerp(lerp(swing, -0.35, holding), -1.25, gw);
      arm.sh.rotation.z = lerp(arm.side * 0.12, -arm.side * 0.42, gw);
      arm.el.rotation.x = lerp(lerp(-0.25 - run * 0.9, -1.2, holding), -1.75, gw);
    }
    // head look
    const look = clamp(angleDiff(this.heading, P.lookYaw), -0.9, 0.9);
    this.neck.rotation.y = damp(this.neck.rotation.y, look * 0.7, 5, dt);
    this.neck.rotation.x = damp(this.neck.rotation.x, -this.torso.rotation.x * 0.6, 5, dt);
    // cargo stack sway
    this.stack.rotation.z = damp(this.stack.rotation.z, (P.tiltX || 0) * 0.22, 12, dt);
    this.stack.rotation.x = damp(this.stack.rotation.x, (P.tiltZ || 0) * 0.18, 12, dt);
    let i = 0;
    for (const m of this.stack.children) { m.rotation.z = (P.tiltX || 0) * 0.035 * i; m.position.x = (P.tiltX || 0) * 0.012 * i * i; i++; }
    this.updateVisor(P, dt);
    this.updateSensor(P, dt);
  }
  updateVisor(P, dt) {
    let target;
    if (P.state === 'hijack') target = 0xff5a4f;
    else if (P.battery < 15) target = 0xf2a04b;
    else target = visorHex();
    this.visorColor.lerp(new THREE.Color(target), 1 - Math.exp(-6 * dt));
    MAT.visor.emissive.copy(this.visorColor);
    let inten = 3.2;
    if (P.state === 'boot') inten = 3.2 * smoothstep(0.3, 1.5, P.stateT) * (0.7 + 0.3 * Math.sin(P.stateT * 30));
    if (P.state === 'hijack') inten = 2 + Math.random() * 3;
    MAT.visor.emissiveIntensity = inten;
  }
  updateSensor(P, dt) {
    const want = P.sensor || 0;
    this.sensorOpen = damp(this.sensorOpen, want > 0 ? 1 : 0, 4, dt);
    const o = this.sensorOpen;
    this.sensorArm.rotation.x = lerp(1.9, 0.05, o);
    this.sensorArm.rotation.z = lerp(-0.2, -0.15, o);
    this.sensorSpin += dt * (1 + want * 10);
    if (P.sensorDir != null && want > 0.5) {
      const rel = angleDiff(this.heading, P.sensorDir);
      this.finHub.rotation.y = damp(this.finHub.rotation.y, rel, 6, dt);
      for (const f of this.fins) f.g.rotation.x = lerp(0, -0.9, o) + Math.sin(this.sensorSpin * 4 + f.g.rotation.y) * 0.1 * want;
    } else {
      this.finHub.rotation.y = this.sensorSpin * 0.4 * o;
      for (const f of this.fins) f.g.rotation.x = lerp(0, -0.6, o);
    }
    MAT.fin.emissiveIntensity = damp(MAT.fin.emissiveIntensity, want > 0 ? 1.2 + want * 2.5 : 0.25, 5, dt);
    MAT.fin.emissive.setHex(P.sensorAlert ? 0xff5a4f : 0xf2a04b);
  }
}
