/**
 * The GPU half of Sky V2: a thin copy of what realSky.ts decides, drawn.
 *
 * Two passes over one triangle that covers the card.
 *
 * - Pass 0, the atmosphere: single scattering (Rayleigh, Mie and ozone) along
 *   each view ray, lit by the sun at `uSun`, plus the dawn's and the red
 *   twilight's light, which single scattering cannot give that deep in
 *   twilight. Drawn into a texture, at half the card's resolution - the sky
 *   has no detail finer than that - and only when the moment changes, about
 *   once a minute.
 * - Pass 1, every frame: the sky read back from that texture, the sun's disc,
 *   the sea below the horizon with its small waves and the sun's glint, and
 *   the sky giving way behind the words. The only pass that moves.
 *
 * Coordinates: x across the card, y up from its bottom edge, in device px.
 * The horizon is `uHorizon` px up; one px is `uDegPx` degrees of sky either
 * way, so the sky is never stretched. Azimuth `uAzC` is at the card's middle.
 */

export const VERTEX_SHADER = `
attribute vec3 position;
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const FRAGMENT_SHADER = `
precision highp float;
uniform vec2 uRes;
uniform float uSkyScale;
uniform vec3 uSun;
uniform vec3 uDisc;
uniform float uAzC, uDegPx, uHorizon, uExposure, uSunR, uHaze, uBloom, uGive, uWind, uTime, uFajrAge, uDusk, uPass;
uniform sampler2D uMask;
uniform sampler2D uSky;

#define PI 3.14159265359
#define RG 6360.0
#define RT 6460.0
#define N 32
#define M 8

const vec3 bR = vec3(5.802e-3, 13.558e-3, 33.1e-3);
const float bMs = 3.996e-3;
const float bMe = 4.40e-3;
const vec3 bO = vec3(0.650e-3, 1.881e-3, 0.085e-3);
const float SUN_I = 22.0;
const vec3 RO = vec3(0.0, RG + 0.03, 0.0);

vec2 hit(vec3 o, vec3 d, float r) {
  float b = dot(o, d); float lo = length(o); float c = (lo - r) * (lo + r);
  float h = b * b - c;
  if (h < 0.0) return vec2(-1.0, -1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}
vec3 dens(float h) { return vec3(exp(-h / 8.0), exp(-h / 1.2), max(0.0, 1.0 - abs(h - 25.0) / 15.0)); }
vec3 dirOf(float el, float az) { return vec3(cos(el) * sin(az), sin(el), -cos(el) * cos(az)); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 tauOf(vec3 od) { return bR * od.x + bMe * uHaze * od.y + bO * od.z; }

/* Sunlight reaching the eye and the sea along the disc as drawn. The drawn sun can sit a hair below the true horizon while
   its disc shows, so the path is taken at least a little above it rather than into the ground. */
vec3 sunTrans() {
  vec3 d = uDisc;
  if (d.y < 0.002) d = normalize(vec3(d.x, 0.002 * length(d.xz), d.z));
  float lt = hit(RO, d, RT).y; float ls = lt / float(M); vec3 od = vec3(0.0);
  for (int j = 0; j < M; j++) { vec3 q = RO + d * ls * (float(j) + 0.5); od += dens(length(q) - RG) * ls; }
  return exp(-tauOf(od));
}

/* Single scattering along a view ray. */
vec3 sky(vec3 rd) {
  float tmax = hit(RO, rd, RT).y;
  vec3 od = vec3(0.0); vec3 sR = vec3(0.0); vec3 sM = vec3(0.0);
  for (int i = 0; i < N; i++) {
    float a = float(i) / float(N); float b = float(i + 1) / float(N);
    float t0 = tmax * a * a; float t1 = tmax * b * b; float dt = t1 - t0;
    vec3 p = RO + rd * (t0 + dt * 0.5);
    vec3 dd = dens(length(p) - RG) * dt;
    od += dd;
    if (hit(p, uSun, RG).x > 0.0) continue;
    float lt = hit(p, uSun, RT).y; float ls = lt / float(M); vec3 lod = vec3(0.0);
    for (int j = 0; j < M; j++) { vec3 q = p + uSun * ls * (float(j) + 0.5); lod += dens(length(q) - RG) * ls; }
    vec3 at = exp(-tauOf(od + lod));
    sR += dd.x * at; sM += dd.y * at;
  }
  float mu = dot(rd, uSun);
  float pR = 3.0 / (16.0 * PI) * (1.0 + mu * mu);
  float g = 0.8;
  float pM = 3.0 / (8.0 * PI) * ((1.0 - g * g) * (1.0 + mu * mu)) / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
  return SUN_I * (sR * bR * pR + sM * bMs * uHaze * pM);
}

/* The disc, limb-darkened, and a camera's glare around it. */
vec3 sunLight(vec3 rd, vec3 trans) {
  float ang = acos(clamp(dot(rd, uDisc), -1.0, 1.0));
  float sr = uSunR * PI / 180.0;
  float r = ang / sr;
  float edge = (uDegPx * PI / 180.0) / sr;
  float limb = 1.0 - 0.6 * (1.0 - sqrt(max(0.0, 1.0 - r * r)));
  float disc = (1.0 - smoothstep(1.0 - edge, 1.0 + edge, r)) * limb;
  return trans * SUN_I * (2.0 * disc + uBloom * (0.06 * exp(-pow(ang / (sr * 2.2), 2.0)) + 0.006 * exp(-ang / (sr * 7.0))));
}

/* 8-bit RGBM: exposure-scaled radiance up to 8. */
vec4 enc(vec3 c) { c /= 8.0; float m = clamp(max(max(c.r, c.g), max(c.b, 1e-6)), 0.0, 1.0); m = ceil(m * 255.0) / 255.0; return vec4(c / m, m); }
vec3 dec(vec4 t) { return t.rgb * t.a * 8.0; }

/* The sky in direction r, read from the texture. */
vec3 skyAt(vec3 r) {
  float azr = atan(r.x, -r.z) * 180.0 / PI;
  float d = mod(azr - uAzC + 180.0, 360.0) - 180.0;
  float x = d / uDegPx + uRes.x * 0.5;
  float y = uHorizon + asin(clamp(r.y, 0.0, 1.0)) * 180.0 / PI / uDegPx;
  return dec(texture2D(uSky, clamp(vec2(x, y) / uRes, vec2(0.0, (uHorizon + 1.0) / uRes.y), vec2(1.0))));
}

/* Fajr: the false dawn's pillar of zodiacal light, then the true dawn's band and white thread (realSky.ts, fajrAge). */
vec3 dawn(float el, float az) {
  float se = asin(clamp(uSun.y, -1.0, 1.0)) * 180.0 / PI;
  float saz = atan(uSun.x, -uSun.z);
  float a = (mod(az - saz + PI, 2.0 * PI) - PI) * 180.0 / PI;
  float e = el * 180.0 / PI;
  float morning = smoothstep(-0.05, 0.05, uSun.x);
  float td = morning * smoothstep(-19.6, -17.7, se) * (1.0 - smoothstep(-12.5, -9.0, se));
  float pulse = exp(-pow((uFajrAge - 1.2) / 1.8, 2.0));
  float reach = 40.0 + 40.0 * smoothstep(-18.5, -13.0, se);
  float spread = exp(-pow(a / reach, 2.0));
  float band = 0.22 * exp(-e / (1.6 + 2.5 * smoothstep(-18.0, -12.0, se)));
  float line = 0.5 * exp(-pow((e - 0.3) / 0.4, 2.0)) * (1.0 + 0.9 * pulse);
  vec3 tint = mix(vec3(0.80, 0.87, 1.0), vec3(1.0, 0.84, 0.70), smoothstep(-16.0, -11.0, se));
  vec3 L = tint * spread * td * (band + line);
  float zd = morning * smoothstep(-32.0, -26.0, se) * (1.0 - smoothstep(-20.5, -18.3, se));
  vec2 ax = vec2(cos(1.12), sin(1.12));
  vec2 v = vec2(a, e - se);
  float sAx = dot(v, ax); float pp = dot(v, vec2(-ax.y, ax.x));
  float w = 4.0 + 0.32 * max(sAx, 0.0);
  float zl = (sAx > 0.0 ? exp(-sAx / 34.0) : 0.0) * exp(-pp * pp / (w * w)) * 0.16;
  L += vec3(0.86, 0.87, 0.92) * zl * zd * smoothstep(-0.5, 4.0, e);
  return L;
}

/* Maghrib to Isha: the red twilight narrows, sinks and deepens, and is gone at uDusk = 1, Isha. */
vec3 shafaq(float el, float az) {
  if (uDusk <= 0.0 || uDusk >= 1.0) return vec3(0.0);
  float f = uDusk;
  float saz = atan(uSun.x, -uSun.z);
  float a = (mod(az - saz + PI, 2.0 * PI) - PI) * 180.0 / PI;
  float e = el * 180.0 / PI;
  float width = mix(55.0, 9.0, f);
  float height = mix(5.5, 0.9, f);
  float glow = exp(-pow(a / width, 2.0)) * exp(-e / height);
  vec3 tint = mix(mix(vec3(1.0, 0.62, 0.28), vec3(0.95, 0.30, 0.14), smoothstep(0.0, 0.5, f)), vec3(0.75, 0.10, 0.07), smoothstep(0.5, 1.0, f));
  float strength = 0.55 * smoothstep(0.0, 0.3, f) * pow(1.0 - f, 0.45);
  return tint * glow * strength;
}

/* Gradient noise and its derivative (after Inigo Quilez). */
vec2 hash2(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return -1.0 + 2.0 * fract(sin(p) * 43758.5453); }
vec2 noiseGrad(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  vec2 ga = hash2(i), gb = hash2(i + vec2(1.0, 0.0)), gc = hash2(i + vec2(0.0, 1.0)), gd = hash2(i + vec2(1.0, 1.0));
  float va = dot(ga, f), vb = dot(gb, f - vec2(1.0, 0.0)), vc = dot(gc, f - vec2(0.0, 1.0)), vd = dot(gd, f - vec2(1.0, 1.0));
  return ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd) + du * (u.yx * (va - vb - vc + vd) + vec2(vb, vc) - va);
}

void main() {
  vec2 f = gl_FragCoord.xy / (uPass < 0.5 ? uSkyScale : 1.0);
  float az = (uAzC + (f.x - uRes.x * 0.5) * uDegPx) * PI / 180.0;
  float el = (f.y - uHorizon) * uDegPx * PI / 180.0;
  if (uPass < 0.5) {
    gl_FragColor = enc(sky(dirOf(max(el, 0.0008), az)) * uExposure + dawn(max(el, 0.0), az) + shafaq(max(el, 0.0), az));
    return;
  }
  vec3 col;
  vec3 sT = sunTrans();
  if (el >= 0.0) {
    col = dec(texture2D(uSky, vec2(f.x, max(f.y, uHorizon + 1.0)) / uRes));
    col += sunLight(dirOf(el, az), sT) * smoothstep(-0.5, 0.5, el * 180.0 / PI / uDegPx) * uExposure;
  } else {
    /* The sea: twelve trains of small wind waves, metres to centimetres long. A train longer than a few px at that
       distance is drawn as real slopes; a shorter one becomes statistical roughness (a covariance, as in Cox and
       Munk's measurements), so nothing finer than a pixel shimmers. */
    vec3 rd = dirOf(el, az);
    float dist = 30.0 / max(-rd.y, 1e-4);
    vec2 P = rd.xz * dist;
    vec2 fw = normalize(rd.xz); vec2 rt = vec2(-fw.y, fw.x);
    float across = dist * uDegPx * PI / 180.0;
    float along = across / max(-rd.y, 1e-3);
    float sig2 = (0.003 + 0.00512 * uWind) * 0.5;
    float amp = sqrt(2.0 * sig2 / 12.0);
    vec2 sl = vec2(0.0);
    vec3 C = vec3(1e-6, 1e-6, 0.0);
    for (int i = 0; i < 12; i++) {
      float fi = float(i);
      float k = 0.22 * pow(1.55, fi);
      float th = 0.35 + 0.6 * sin(fi * 2.39996);
      vec2 d = vec2(cos(th), sin(th)); vec2 pd = vec2(-d.y, d.x);
      float fp = length(vec2(across * dot(d, rt), along * dot(d, fw)));
      float g = 1.0 - smoothstep(0.08, 0.3, fp * k / (2.0 * PI));
      if (g > 0.001) {
        vec2 q = vec2(dot(P, d) - sqrt(9.8 / k) * uTime, dot(P, pd) * 0.4) * (k / PI) + vec2(fi * 17.3, fi * 5.1);
        vec2 gr = noiseGrad(q);
        sl += g * amp * 0.7 * (gr.x * d + 0.4 * gr.y * pd);
      }
      float v = (1.0 - g) * amp * amp * 0.5;
      C += vec3(v * d.x * d.x, v * d.y * d.y, v * d.x * d.y);
    }
    vec3 n = normalize(vec3(-sl.x, 1.0, -sl.y));
    /* The sky it reflects, a little above the mirror point, and never more than about 60% of it. */
    vec3 r = reflect(rd, n); r.y = max(r.y, 0.0) + 0.04; r = normalize(r);
    vec3 refl = skyAt(r);
    float F = 0.02 + 0.56 * pow(1.0 - clamp(dot(-rd, n), 0.0, 1.0), 5.0);
    col = mix(refl * vec3(0.03, 0.075, 0.095), refl, F);
    /* The sun in the water: the share of facets tilted to send the disc to the eye, E F p / (4 cos(view) cos^4(tilt)),
       only while some of the disc is above the horizon. */
    float seD = asin(clamp(uDisc.y, -1.0, 1.0)) * 180.0 / PI;
    sT *= clamp((seD + uSunR) / (2.0 * uSunR), 0.0, 1.0);
    if (sT.r + sT.g + sT.b > 0.0) {
      float sr = uSunR * PI / 180.0;
      vec3 h = normalize(uDisc - rd);
      vec2 dv = vec2(-h.x / h.y, -h.z / h.y) - sl;
      float sd = sr * 0.5;
      float cxx = C.x + sd * sd, czz = C.y + sd * sd, cxz = C.z;
      float det = max(cxx * czz - cxz * cxz, 1e-12);
      float q = (czz * dv.x * dv.x - 2.0 * cxz * dv.x * dv.y + cxx * dv.y * dv.y) / det;
      float pr = exp(-0.5 * q) / (2.0 * PI * sqrt(det));
      float Fs = 0.02 + 0.98 * pow(1.0 - clamp(dot(h, uDisc), 0.0, 1.0), 5.0);
      float E = SUN_I * 2.0 * PI * sr * sr;
      col += uExposure * sT * E * Fs * pr / (4.0 * max(-rd.y, 0.01) * pow(h.y, 4.0));
    }
  }
  col = aces(col);
  col = pow(col, vec3(1.0 / 2.2));
  float v = clamp(f.y / uRes.y, 0.0, 1.0);
  vec3 night = mix(vec3(0.075, 0.085, 0.16), vec3(0.022, 0.03, 0.075), v);
  if (el < 0.0) night *= 0.6;
  col = max(col, night);
  /* Give way to the text: behind white words pull the sky down toward 0.15 luminance, behind black words lift it
     toward 0.24, only where it is past that. The mask is soft-edged. */
  vec2 mk = texture2D(uMask, gl_FragCoord.xy / uRes).rg * uGive;
  if (mk.r + mk.g > 0.001) {
    vec3 lc = pow(col, vec3(2.2));
    float L = dot(lc, vec3(0.2126, 0.7152, 0.0722));
    if (L > 0.15) lc = mix(lc, lc * (0.15 / L), mk.r);
    L = dot(lc, vec3(0.2126, 0.7152, 0.0722));
    if (L < 0.24) lc = mix(lc, mix(lc, vec3(1.0), (0.24 - L) / (1.0 - L)), mk.g);
    col = pow(lc, vec3(1.0 / 2.2));
  }
  gl_FragColor = vec4(col, 1.0);
}
`;
