"use client";
/**
 * The React Three Fiber canvas that hosts a fight's World. R3F owns the renderer, the scene and the camera; the
 * World (plain three.js, built once per fight and graphics level) is added to the scene and its frame() runs in a
 * priority frame callback, which also does the rendering: straight to the screen on Low and Medium, through the
 * hurt vision pass on High and Ultra. A small environment map (the light rig as a bright panel overhead, a dim
 * glow round the hall) gives the gloves, the skin and the sweat their highlights.
 */
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { World } from "./world";
import { GFX } from "./gfx";
import { Post, hurtOf } from "./post";

function arenaEnvironment(gl: THREE.WebGLRenderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020203);
  const box = new THREE.Mesh(new THREE.BoxGeometry(20, 12, 20), new THREE.MeshBasicMaterial({ color: 0x050608, side: THREE.BackSide }));
  scene.add(box);
  // the light rig: a bright square overhead
  const rig = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.05, 2.85) }));
  rig.position.y = 5.5;
  rig.rotation.x = Math.PI / 2;
  scene.add(rig);
  // the hall: a dim warm band round the horizon, a cooler one above it
  const band = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 2.5, 32, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.22, 0.17, 0.13), side: THREE.BackSide }));
  band.position.y = -0.5;
  scene.add(band);
  const pm = new THREE.PMREMGenerator(gl);
  const rt = pm.fromScene(scene, 0.02);
  pm.dispose();
  scene.traverse(o => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) (m.material as THREE.Material).dispose();
  });
  return rt;
}

function Host({ world, quality, dpr }: { world: World; quality: number; dpr: number }) {
  const { gl, scene, camera, size } = useThree();
  const post = useRef<Post | null>(null);
  useEffect(() => {
    scene.add(world.group);
    scene.add(camera);
    world.attachCamera(camera as THREE.PerspectiveCamera);
    scene.fog = new THREE.FogExp2(0x04050a, 0.042);
    scene.background = new THREE.Color(0x020306);
    const env = arenaEnvironment(gl);
    scene.environment = env.texture;
    scene.environmentIntensity = 0.55;
    return () => {
      scene.remove(world.group);
      scene.remove(camera);
      scene.environment = null;
      env.dispose();
    };
  }, [world, scene, camera, gl]);
  useEffect(() => {
    if (!GFX[quality]?.post) return;
    post.current = new Post(gl, scene, camera, size.width, size.height, dpr);
    return () => {
      post.current?.dispose();
      post.current = null;
    };
    // the pass is rebuilt only for a new world or level; size changes go through setSize below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, quality, gl, scene, camera]);
  useEffect(() => {
    post.current?.setSize(size.width, size.height, dpr);
    const cam = camera as THREE.PerspectiveCamera;
    cam.aspect = size.width / Math.max(1, size.height);
    // narrow screens keep the other boxer in view: a wider lens when the window is tall
    cam.fov = cam.aspect < 1 ? 74 : 60;
    cam.updateProjectionMatrix();
  }, [size.width, size.height, dpr, camera]);
  useFrame((_, dt) => {
    world.frame(dt);
    const f = world.st.f[0];
    if (post.current && world.mode === "fight") post.current.render(hurtOf(f.headHP, f.rocked, f.stamina, world.hurtFlash, world.slowT, world.time), world.time);
    else if (post.current) post.current.render({ vignette: 0.15, blur: 0, red: 0, desat: 0, double: 0 }, world.time);
    else gl.render(scene, camera);
  }, 1);
  return null;
}

export default function FightCanvas({ world, quality }: { world: World; quality: number }) {
  const tier = GFX[quality] || GFX[2];
  const dpr = useMemo(() => Math.min(tier.dpr, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1), [tier.dpr]);
  return (
    <Canvas
      className="pf-canvas"
      dpr={dpr}
      shadows={tier.shadows ? { type: THREE.PCFShadowMap } : false}
      gl={{ antialias: !tier.post, powerPreference: "high-performance", stencil: false }}
      camera={{ fov: 60, near: 0.03, far: 140, position: [0, 1.6, 2] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        // the browser battery reads the renderer's counts (geometries, textures, programs) to catch leaks
        if (window.location.search.includes("pftest")) (window as unknown as { __pfGL?: THREE.WebGLRenderer }).__pfGL = gl;
      }}
    >
      <Host world={world} quality={quality} dpr={dpr} />
    </Canvas>
  );
}
