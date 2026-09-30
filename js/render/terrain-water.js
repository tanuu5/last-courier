'use strict';
// Terrain mesh / shader, height texture and water.

/* ---------- terrain ---------- */
const terrainUniforms = {
  uTime: { value: 0 }, uScanO: { value: new THREE.Vector3() }, uScanR: { value: 0 }, uScanA: { value: 0 },
  uStorms: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
  uNodes: { value: NODES.map(() => new THREE.Vector4()) },
  uWater: { value: WATER },
};
function buildTerrainMesh() {
  const pos = new Float32Array(VN * VN * 3), nrm = new Float32Array(VN * VN * 3), rock = new Float32Array(VN * VN);
  for (let j = 0; j < VN; j++) for (let i = 0; i < VN; i++) {
    const k = j * VN + i;
    pos[k * 3] = -HALF + i * CELL; pos[k * 3 + 1] = H[k]; pos[k * 3 + 2] = -HALF + j * CELL;
    const hl = H[j * VN + Math.max(i - 1, 0)], hr = H[j * VN + Math.min(i + 1, GRID)];
    const hu = H[Math.max(j - 1, 0) * VN + i], hd = H[Math.min(j + 1, GRID) * VN + i];
    let nx = -(hr - hl) / (2 * CELL), ny = 1, nz = -(hd - hu) / (2 * CELL);
    const l = Math.hypot(nx, ny, nz); nrm[k * 3] = nx / l; nrm[k * 3 + 1] = ny / l; nrm[k * 3 + 2] = nz / l;
    rock[k] = ROCK[k];
  }
  const idx = new Uint32Array(GRID * GRID * 6); let p = 0;
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
    const a = j * VN + i, b = a + 1, c = a + VN, d = c + 1;
    idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('aRock', new THREE.BufferAttribute(rock, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  terrainMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  terrainMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, terrainUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aRock;\nvarying vec3 vWPos;\nvarying vec3 vWN;\nvarying float vRock;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);\nvRock = aRock;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform vec3 uScanO; uniform float uScanR; uniform float uScanA;
        uniform vec4 uStorms[4]; uniform vec4 uNodes[${NODES.length}]; uniform float uWater;
        varying vec3 vWPos; varying vec3 vWN; varying float vRock;
        ${GLSL_NOISE}
        vec3 s2l(vec3 c){ return c*c; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 tN = normalize(vWN);
        float tSlope = 1.0 - clamp(tN.y, 0.0, 1.0);
        vec2 tp = vWPos.xz;
        float tn1 = fbm4(tp*0.045);
        float tn2 = fbm4(tp*0.55);
        float tn3 = fbm4(tp*0.011 + 7.0);
        vec3 cMoss = mix(vec3(0.22,0.29,0.14), vec3(0.34,0.38,0.19), tn1);
        vec3 cDry = mix(vec3(0.42,0.4,0.29), vec3(0.48,0.45,0.33), tn2);
        vec3 cGrass = mix(cMoss, cDry, smoothstep(0.5, 0.72, tn3)*0.8);
        vec3 cRock = mix(vec3(0.26,0.26,0.27), vec3(0.47,0.45,0.42), tn2*0.8 + tn1*0.2);
        vec3 cSand = vec3(0.15,0.15,0.16) + 0.07*tn2;
        vec3 cSnow = vec3(0.86,0.89,0.93);
        float tRockM = clamp(max(smoothstep(0.2, 0.34, tSlope + (tn1-0.5)*0.12), vRock), 0.0, 1.0);
        vec3 tc = mix(cGrass, cRock, tRockM);
        float tBeach = 1.0 - smoothstep(uWater + 0.2, uWater + 1.8 + tn1*2.0, vWPos.y);
        tc = mix(tc, cSand, tBeach);
        float tSnow = smoothstep(82.0, 96.0, vWPos.y + (tn1-0.5)*16.0) * (1.0 - smoothstep(0.3, 0.46, tSlope));
        tc = mix(tc, cSnow, tSnow);
        float tPad = 0.0;
        for (int i = 0; i < ${NODES.length}; i++) { float dn = length(tp - uNodes[i].xy); tPad = max(tPad, 1.0 - smoothstep(uNodes[i].z - 3.0, uNodes[i].z + 3.0 + tn2*4.0, dn)); }
        tc = mix(tc, vec3(0.36,0.35,0.33)*(0.85+0.3*tn2), tPad*0.85);
        tc *= 0.82 + 0.36*tn2;
        float tWet = 0.0;
        for (int i = 0; i < 4; i++) { vec4 st = uStorms[i]; float d = length(tp - st.xy); tWet = max(tWet, st.w * (1.0 - smoothstep(st.z*0.75, st.z, d))); }
        tc *= mix(1.0, 0.76, tWet);
        diffuseColor.rgb = s2l(tc);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.62, tWet) - tSnow*0.15;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec2 bp = vWPos.xz*0.85; float e = 0.2;
          float b0 = vn(bp), bx = vn(bp + vec2(e, 0.0)), bz = vn(bp + vec2(0.0, e));
          float b1 = vn(bp*3.1), b1x = vn(bp*3.1 + vec2(e, 0.0)), b1z = vn(bp*3.1 + vec2(0.0, e));
          vec3 wn = normalize(tN + (vec3(-(bx - b0), 0.0, -(bz - b0))*1.1 + vec3(-(b1x - b1), 0.0, -(b1z - b1))*0.5) * (0.35 + tRockM));
          normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float tsd = length(vWPos.xz - uScanO.xz);
        float tq = (tsd - uScanR) / 1.4;
        float tRing = exp(-tq*tq);
        float tIn = (1.0 - step(uScanR, tsd)) * (1.0 - clamp(tsd / max(uScanR, 0.001), 0.0, 1.0));
        float tgv = vWPos.y*0.5;
        float tg = abs(fract(tgv - 0.5) - 0.5) / max(fwidth(tgv), 0.0001);
        float tLine = 1.0 - min(tg, 1.0);
        float tGrow = smoothstep(1.5, 9.0, uScanR);
        totalEmissiveRadiance += vec3(0.35, 0.85, 1.0) * (tRing*1.2*tGrow + tLine*tIn*0.55) * uScanA;`);
  };
  terrainMesh = new THREE.Mesh(geo, terrainMat);
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);
  NODES.forEach((n, i) => terrainUniforms.uNodes.value[i].set(n.x, n.z, 19, 0));
}

function buildHeightTexture() {
  const data = new Float32Array(VN * VN * 4);
  for (let k = 0; k < VN * VN; k++) { data[k * 4] = H[k]; data[k * 4 + 1] = ROCK[k]; data[k * 4 + 2] = FLOWX[k]; data[k * 4 + 3] = FLOWZ[k]; }
  heightTex = new THREE.DataTexture(data, VN, VN, THREE.RGBAFormat, THREE.FloatType);
  heightTex.minFilter = heightTex.magFilter = THREE.NearestFilter;
  heightTex.needsUpdate = true;
}
const GLSL_HDATA = `
uniform sampler2D uHeight;
vec4 hData(vec2 p){
  vec2 g = clamp((p + ${HALF.toFixed(1)}) / ${CELL.toFixed(1)}, vec2(0.0), vec2(${(GRID - 0.001).toFixed(3)}));
  ivec2 i = ivec2(floor(g)); vec2 f = g - floor(g);
  vec4 a = texelFetch(uHeight, i, 0), b = texelFetch(uHeight, i + ivec2(1, 0), 0);
  vec4 c = texelFetch(uHeight, i + ivec2(0, 1), 0), d = texelFetch(uHeight, i + ivec2(1, 1), 0);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}`;

/* ---------- water ---------- */
function buildWater() {
  waterMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uHeight: { value: null }, uTime: { value: 0 }, uSunDir: { value: SUN_DIR }, uSunCol: { value: new THREE.Color(0xffe0c0) },
      uSky: { value: new THREE.Color() }, uDeep: { value: new THREE.Color(0x0e2227) }, uShallow: { value: new THREE.Color(0x3d5a55) }, uWaterY: { value: WATER }, uDim: { value: 1 },
    }]),
    vertexShader: `varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime, uWaterY, uDim; uniform vec3 uSunDir, uSunCol, uSky, uDeep, uShallow; varying vec3 vW;
      ${GLSL_NOISE}
      ${GLSL_HDATA}
      #include <fog_pars_fragment>
      float wave(vec2 p){ return vn(p*0.9)*0.6 + vn(p*2.3 + 5.0)*0.3 + vn(p*5.1 + 9.0)*0.1; }
      void main(){
        vec4 hd = hData(vW.xz);
        float depth = max(uWaterY - hd.r, 0.0);
        vec2 flow = hd.ba;
        float ph0 = fract(uTime*0.22), ph1 = fract(uTime*0.22 + 0.5);
        float wgt = abs(0.5 - ph0) * 2.0;
        vec2 p = vW.xz*0.8 + vec2(uTime*0.05, uTime*0.03);
        vec2 q0 = p - flow*ph0*3.0, q1 = p - flow*ph1*3.0 + 0.37;
        float e = 0.08;
        float w0 = wave(q0), w1 = wave(q1);
        float wx = mix(wave(q0 + vec2(e,0.0)), wave(q1 + vec2(e,0.0)), wgt) - mix(w0, w1, wgt);
        float wz = mix(wave(q0 + vec2(0.0,e)), wave(q1 + vec2(0.0,e)), wgt) - mix(w0, w1, wgt);
        float amp = 0.9 + length(flow)*1.2;
        vec3 n = normalize(vec3(-wx*amp*4.0, 1.0, -wz*amp*4.0));
        vec3 V = normalize(cameraPosition - vW);
        float nv = clamp(dot(n, V), 0.0, 1.0);
        float fres = 0.02 + 0.98 * pow(max(1.0 - nv, 0.0), 5.0);
        vec3 base = mix(uShallow, uDeep, smoothstep(0.0, 2.4, depth));
        vec3 col = mix(base, uSky, clamp(fres*0.85, 0.0, 1.0));
        vec3 Hh = normalize(uSunDir + V);
        col += uSunCol * pow(max(dot(n, Hh), 0.0), 160.0) * 1.6 * uDim;
        float fn = vn(vW.xz*1.7 + flow*uTime*1.5 + uTime*0.2);
        float foam = (1.0 - smoothstep(0.0, 0.4, depth)) * smoothstep(0.35, 0.8, fn);
        foam += smoothstep(0.9, 1.6, length(flow)) * smoothstep(0.6, 0.9, fn) * 0.4;
        col = mix(col, vec3(0.62, 0.66, 0.66), clamp(foam, 0.0, 1.0)*0.55);
        float alpha = clamp(0.28 + smoothstep(0.0, 1.4, depth)*0.62 + fres*0.25 + foam*0.3, 0.0, 0.97);
        gl_FragColor = vec4(max(col, vec3(0.0)), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    transparent: true, fog: true, depthWrite: false,
  });
  waterMat.uniforms.uHeight.value = heightTex;
  const g = new THREE.PlaneGeometry(WORLD, WORLD, 1, 1); g.rotateX(-Math.PI / 2);
  waterMesh = new THREE.Mesh(g, waterMat);
  waterMesh.position.y = WATER;
  waterMesh.renderOrder = 2;
  scene.add(waterMesh);
}
