/**
 * Screen effects for High and Ultra: one pass after the scene. Hurt vision (the edges close in as your head
 * health drops, a blur and a faint double image when you are rocked, a red wash on a big hit), the colour drains
 * for the beat of slow motion after a perfect slip, and breathing pulses the edges when you are tired. Low and
 * Medium get the edges and the red from the page itself (a cheap overlay), with no blur.
 */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

export interface HurtFx {
  vignette: number;
  blur: number;
  red: number;
  desat: number;
  double: number;
}

const HurtShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uVignette: { value: 0 },
    uBlur: { value: 0 },
    uRed: { value: 0 },
    uDesat: { value: 0 },
    uDouble: { value: 0 },
    uTime: { value: 0 },
    uAspect: { value: 1 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uVignette; uniform float uBlur; uniform float uRed; uniform float uDesat;
    uniform float uDouble; uniform float uTime; uniform float uAspect; varying vec2 vUv;
    void main(){
      vec2 c = vUv - 0.5;
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      if (uBlur > 0.001) {
        // a soft radial blur that grows toward the edges
        vec3 acc = col; float w = 1.0;
        for (int i = 1; i <= 6; i++) {
          float k = float(i) / 6.0 * uBlur * 0.018 * (0.4 + length(c) * 1.6);
          acc += texture2D(tDiffuse, vUv - c * k * 6.0).rgb; w += 1.0;
        }
        col = acc / w;
      }
      if (uDouble > 0.001) {
        vec2 off = vec2(sin(uTime * 1.3), cos(uTime * 0.9)) * 0.012 * uDouble;
        col = mix(col, texture2D(tDiffuse, vUv + off).rgb, 0.35 * uDouble);
      }
      float g = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(g), uDesat);
      col = mix(col, col * vec3(1.35, 0.55, 0.5) + vec3(0.06, 0.0, 0.0), uRed);
      vec2 v = c * vec2(uAspect, 1.0);
      float vig = 1.0 - smoothstep(0.2 - uVignette * 0.15, 0.95 - uVignette * 0.55, length(v));
      col *= mix(1.0, vig, clamp(0.35 + uVignette, 0.0, 1.0));
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class Post {
  readonly composer: EffectComposer;
  private hurt: ShaderPass;
  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, w: number, h: number, dpr: number) {
    const rt = new THREE.WebGLRenderTarget(Math.max(1, Math.floor(w * dpr)), Math.max(1, Math.floor(h * dpr)), { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.composer.addPass(new RenderPass(scene, camera));
    this.hurt = new ShaderPass(HurtShader);
    this.composer.addPass(this.hurt);
    this.composer.addPass(new OutputPass());
  }
  setSize(w: number, h: number, dpr: number) {
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.hurt.uniforms.uAspect.value = w / Math.max(1, h);
  }
  render(fx: HurtFx, t: number) {
    const u = this.hurt.uniforms;
    u.uVignette.value = fx.vignette;
    u.uBlur.value = fx.blur;
    u.uRed.value = fx.red;
    u.uDesat.value = fx.desat;
    u.uDouble.value = fx.double;
    u.uTime.value = t;
    this.composer.render();
  }
  dispose() {
    this.composer.renderTarget1.dispose();
    this.composer.renderTarget2.dispose();
    this.composer.dispose();
  }
}

/** what the hurt vision should be this moment, from your boxer */
export function hurtOf(headHP: number, rocked: number, stamina: number, flash: number, slow: number, t: number): HurtFx {
  const hurt = Math.max(0, (70 - headHP) / 70);
  const tired = Math.max(0, (35 - stamina) / 35);
  const breathe = tired * (0.5 + 0.5 * Math.sin(t * 3.2)) * 0.18;
  return {
    vignette: Math.min(1, hurt * 0.75 + (rocked > 0 ? 0.3 : 0) + breathe),
    blur: rocked > 0 ? Math.min(1, 0.45 + rocked * 0.25) : hurt > 0.7 ? (hurt - 0.7) * 1.2 : 0,
    red: Math.min(0.55, flash * 0.45),
    desat: slow > 0 ? 0.6 : 0,
    double: rocked > 0 ? Math.min(1, rocked * 0.5) : 0,
  };
}
