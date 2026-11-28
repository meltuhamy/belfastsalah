import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  RGBAFormat,
  RawShaderMaterial,
  Scene,
  Texture,
  UnsignedByteType,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from "three";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./realSkyShader";
import { Pixels, SKY_LOOK, ShownSun } from "./realSky";

/*
  three.js is only imported from here, and this module only from RealSky.tsx,
  by a dynamic import: three is a chunk of its own, fetched once the card is
  on screen, and not in the main bundle.
*/

const RAD = Math.PI / 180;

/** The atmosphere is drawn at this share of the canvas's resolution. */
const SKY_SCALE = 0.5;

/** What the card tells the renderer, all in CSS px where it is a length. */
export type SkyScene = {
  sun: ShownSun;
  bearing: number;
  exposure: number;
  fajrAge: number;
  dusk: number;
  /** The horizon, in CSS px up from the card's bottom edge. */
  horizon: number;
};

function direction(el: number, az: number, out: Vector3): Vector3 {
  const e = el * RAD;
  const a = az * RAD;
  return out.set(
    Math.cos(e) * Math.sin(a),
    Math.sin(e),
    -Math.cos(e) * Math.cos(a)
  );
}

/** A one-pixel texture: the mask when there is none, and the sky's stand-in while the sky is drawn. */
function blank(): DataTexture {
  const t = new DataTexture(
    new Uint8Array(4),
    1,
    1,
    RGBAFormat,
    UnsignedByteType
  );
  t.needsUpdate = true;
  return t;
}

/**
 * Draws Sky V2 into a canvas with three.js. One full-screen triangle and the
 * shaders in realSkyShader.ts, used as they are (a RawShaderMaterial: three
 * adds nothing to them), in two passes:
 *
 * - the atmosphere, into a render target at half the canvas's resolution,
 *   only when the scene or the canvas's size has changed;
 * - the frame itself - the sky read back from that target, the disc, the
 *   sea, the sky giving way behind the words - which is all the water's
 *   frame loop draws.
 *
 * `create` returns null where three cannot start WebGL 2 or the shader will
 * not build, and the card falls back to the Sky theme's painted sky. If the
 * GPU takes the context away (Android can, with the app in the background),
 * drawing pauses, and three rebuilds what it needs when it is given back.
 */
export class RealSkyRenderer {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera();
  private readonly material: RawShaderMaterial;
  private readonly skyTarget: WebGLRenderTarget;
  private readonly standIn = blank();
  private mask: DataTexture = blank();
  private current: SkyScene | null = null;
  private skyKey = "";
  private lost = false;

  private readonly uniforms = {
    uRes: { value: new Vector2() },
    uSkyScale: { value: SKY_SCALE },
    uSun: { value: new Vector3() },
    uDisc: { value: new Vector3() },
    uAzC: { value: 0 },
    uDegPx: { value: 1 },
    uHorizon: { value: 0 },
    uExposure: { value: 1 },
    uSunR: { value: SKY_LOOK.sunRadius as number },
    uHaze: { value: SKY_LOOK.haze as number },
    uBloom: { value: SKY_LOOK.bloom as number },
    uGive: { value: 0 },
    uWind: { value: SKY_LOOK.wind as number },
    uTime: { value: 0 },
    uFajrAge: { value: 0 },
    uDusk: { value: 0 },
    uPass: { value: 1 },
    uMask: { value: this.mask as Texture },
    uSky: { value: this.standIn as Texture },
  };

  static create(canvas: HTMLCanvasElement): RealSkyRenderer | null {
    try {
      return new RealSkyRenderer(canvas);
    } catch (error) {
      console.warn("Sky V2 cannot be drawn here:", error);
      return null;
    }
  }

  private constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    // Every pixel is drawn every time: nothing to clear.
    this.renderer.autoClear = false;
    // A shader this GPU cannot build is reported here rather than logged.
    let shaderError: string | null = null;
    this.renderer.debug.checkShaderErrors = true;
    this.renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
      shaderError =
        gl.getShaderInfoLog(fragment) ||
        gl.getShaderInfoLog(vertex) ||
        gl.getProgramInfoLog(program) ||
        "the shader did not build";
    };
    this.material = new RawShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
    });
    // One triangle that covers the whole canvas, in clip space: the vertex
    // shader passes it straight through, so the camera is never used.
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      // three counts the vertices to draw from the attribute named position.
      "position",
      new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)
    );
    geometry.setDrawRange(0, 3);
    const triangle = new Mesh(geometry, this.material);
    triangle.frustumCulled = false;
    this.scene.add(triangle);
    this.skyTarget = new WebGLRenderTarget(1, 1, {
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
      generateMipmaps: false,
    });
    // Build the shader now, so one this GPU cannot run is found here and the
    // card falls back, rather than drawing nothing.
    this.renderer.compile(this.scene, this.camera);
    if (shaderError != null) throw new Error(shaderError);
    if (this.renderer.getContext().isContextLost())
      throw new Error("no context");
    canvas.addEventListener("webglcontextlost", this.onLost);
    canvas.addEventListener("webglcontextrestored", this.onRestored);
  }

  private readonly onLost = () => {
    this.lost = true;
  };

  private readonly onRestored = () => {
    this.lost = false;
    // The atmosphere's target went with the context.
    this.skyKey = "";
  };

  /** Matches the canvas to its CSS size, at up to 2 device px per px. */
  private fit(): { w: number; h: number; scale: number } {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * ratio));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(w, h, false);
    }
    return { w, h, scale: h / Math.max(1, this.canvas.clientHeight) };
  }

  setScene(scene: SkyScene): void {
    this.current = scene;
  }

  /**
   * The give-way mask (realSky.ts giveWayMask), or null for none. RGBA, rows
   * top-down, at any size: it is stretched over the card.
   */
  setMask(
    mask: { data: Uint8Array; width: number; height: number } | null
  ): void {
    this.mask.dispose();
    if (mask == null) {
      this.mask = blank();
    } else {
      // GL's rows run bottom-up.
      const rows = new Uint8Array(mask.data.length);
      const row = mask.width * 4;
      for (let y = 0; y < mask.height; y++) {
        rows.set(
          mask.data.subarray(
            (mask.height - 1 - y) * row,
            (mask.height - y) * row
          ),
          y * row
        );
      }
      this.mask = new DataTexture(
        rows,
        mask.width,
        mask.height,
        RGBAFormat,
        UnsignedByteType
      );
      this.mask.minFilter = LinearFilter;
      this.mask.magFilter = LinearFilter;
      this.mask.needsUpdate = true;
    }
    this.uniforms.uMask.value = this.mask;
  }

  /**
   * Draws a frame: the atmosphere first if the scene or size has changed
   * since it was last drawn, then the rest. `time` is the water's clock, in
   * seconds; `give` how far the sky gives way behind the words.
   */
  draw(time: number, give: number): void {
    const scene = this.current;
    if (scene == null || this.lost) return;
    const { w, h, scale } = this.fit();
    const horizon = scene.horizon * scale;
    const u = this.uniforms;
    u.uRes.value.set(w, h);
    direction(scene.sun.el, scene.sun.az, u.uSun.value);
    direction(scene.sun.discEl, scene.sun.az, u.uDisc.value);
    u.uAzC.value = scene.bearing;
    u.uDegPx.value = SKY_LOOK.fieldOfView / w;
    u.uHorizon.value = horizon;
    u.uExposure.value = scene.exposure;
    u.uFajrAge.value = scene.fajrAge;
    u.uDusk.value = scene.dusk;
    u.uTime.value = time;
    u.uGive.value = give;

    const key = [
      scene.sun.el,
      scene.sun.az,
      scene.bearing,
      scene.exposure,
      horizon,
      w,
      h,
      scene.fajrAge.toFixed(2),
      scene.dusk.toFixed(4),
    ].join("|");
    if (key !== this.skyKey) {
      const sw = Math.max(1, Math.round(w * SKY_SCALE));
      const sh = Math.max(1, Math.round(h * SKY_SCALE));
      if (this.skyTarget.width !== sw || this.skyTarget.height !== sh) {
        this.skyTarget.setSize(sw, sh);
      }
      // Only the sky above the horizon, and a row or two under it for the
      // linear filter to blend with.
      const y0 = Math.max(0, Math.floor(horizon * SKY_SCALE) - 2);
      this.skyTarget.scissor.set(0, y0, sw, sh - y0);
      this.skyTarget.scissorTest = true;
      // Never sample the target while drawing into it.
      u.uSky.value = this.standIn;
      u.uPass.value = 0;
      this.renderer.setRenderTarget(this.skyTarget);
      this.renderer.render(this.scene, this.camera);
      this.renderer.setRenderTarget(null);
      this.skyKey = key;
    }
    u.uSky.value = this.skyTarget.texture;
    u.uPass.value = 1;
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * The frame just drawn, rows top-down, with the scale from CSS px to its
   * pixels. Must follow `draw` in the same task: the drawing buffer is not
   * kept after the browser has shown it.
   */
  read(): { pixels: Pixels; scale: number } {
    const gl = this.renderer.getContext();
    const w = this.canvas.width;
    const h = this.canvas.height;
    const raw = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    const data = new Uint8Array(w * h * 4);
    const row = w * 4;
    for (let y = 0; y < h; y++) {
      data.set(raw.subarray((h - 1 - y) * row, (h - y) * row), y * row);
    }
    return {
      pixels: { data, width: w, height: h },
      scale: h / Math.max(1, this.canvas.clientHeight),
    };
  }

  /**
   * Lets go of what it holds on the GPU. The context itself is left to the
   * canvas, which hands the same one to the next renderer made on it (React's
   * development double mount, for one): losing it here would leave that one a
   * dead context.
   */
  dispose(): void {
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestored);
    this.skyTarget.dispose();
    this.mask.dispose();
    this.standIn.dispose();
    this.material.dispose();
    this.renderer.dispose();
  }
}
