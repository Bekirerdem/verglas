import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/** VERGLAS in three dimensions — black ice, glass ice, ice crystal.
    Real refractive glass-ice shards (physical transmission material,
    ior of ice) drift over a black-ice void; a cold key light and an
    Avalanche-red rim light fracture through the edges; ice dust falls.
    Camera: slow drift + pointer parallax + scroll dolly. The red band
    fires a red light pulse ("verglas-sweep"). Dark = night ice,
    light = ice in daylight. Reduced motion renders a single still. */

const SHARDS = 9;
const DUST = 320;

export function VerglasScene({ theme }: { theme: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const mount = mountRef.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setSize(window.innerWidth, window.innerHeight);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 9);

    // lights: cold key + avalanche red rim + faint fill
    const key = new THREE.DirectionalLight(0xeaf2ff, 2.2);
    key.position.set(4, 6, 6);
    scene.add(key);
    const red = new THREE.DirectionalLight(0xe84142, 1.4);
    red.position.set(-6, -2, 3);
    scene.add(red);
    const fill = new THREE.AmbientLight(0x8090b0, 0.35);
    scene.add(fill);

    // glass-ice plates: gently displaced icosahedra, glassy via env
    // reflection + see-through opacity (alpha canvas can't refract the DOM,
    // so glassiness = reflection + translucency, not transmission)
    const iceMat = new THREE.MeshPhysicalMaterial({
      transparent: true,
      opacity: 0.38,
      roughness: 0.05,
      metalness: 0,
      ior: 1.31,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      color: 0xf2f7ff,
      envMapIntensity: 1.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const shards: { mesh: THREE.Mesh; spin: THREE.Vector3; basePos: THREE.Vector3; drift: number }[] = [];
    const addShard = (radius: number, base: THREE.Vector3, spinScale = 1) => {
      const geo = new THREE.IcosahedronGeometry(radius, 0);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let v = 0; v < pos.count; v++) {
        pos.setXYZ(
          v,
          pos.getX(v) * (0.88 + Math.random() * 0.24),
          pos.getY(v) * (0.88 + Math.random() * 0.24),
          pos.getZ(v) * (0.3 + Math.random() * 0.2), // plates of glaze
        );
      }
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, iceMat);
      mesh.position.copy(base);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      scene.add(mesh);
      shards.push({
        mesh,
        basePos: base.clone(),
        drift: 0.4 + Math.random() * 0.8,
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 0.1 * spinScale,
          (Math.random() - 0.5) * 0.14 * spinScale,
          (Math.random() - 0.5) * 0.07 * spinScale,
        ),
      });
    };
    // the lead crystal — slow, stately, stage right (copy lives stage left)
    addShard(1.9, new THREE.Vector3(3.6, -0.2, 0.5), 0.5);
    for (let i = 0; i < SHARDS - 1; i++) {
      const rightSide = Math.random() < 0.72;
      addShard(
        0.35 + Math.random() * 0.75,
        new THREE.Vector3(
          rightSide ? 1.2 + Math.random() * 5.4 : -(2.5 + Math.random() * 4),
          (Math.random() * 2 - 1) * 3.2,
          -2 + Math.random() * 3.2,
        ),
      );
    }

    // ice dust
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) {
      dustPos[i * 3] = (Math.random() * 2 - 1) * 9;
      dustPos[i * 3 + 1] = (Math.random() * 2 - 1) * 5;
      dustPos[i * 3 + 2] = -2 + Math.random() * 5;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      size: 0.02,
      color: 0xdfe9f5,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);

    const mouse = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let redPulse = 0;
    const onSweep = () => {
      redPulse = 1;
    };
    window.addEventListener("verglas-sweep", onSweep);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    const clock = new THREE.Clock();
    const render = () => {
      const t = clock.getElapsedTime();
      const dark = themeRef.current !== "light";

      key.intensity = dark ? 2.2 : 3.1;
      fill.intensity = dark ? 0.35 : 0.9;
      red.intensity = (dark ? 1.4 : 1.0) + redPulse * 3.2;
      if (redPulse > 0) redPulse = Math.max(0, redPulse - 0.012);

      const doc = document.documentElement;
      const progress = Math.min(1, window.scrollY / Math.max(1, doc.scrollHeight - window.innerHeight));

      shards.forEach((s, i) => {
        s.mesh.rotation.x += s.spin.x * 0.016;
        s.mesh.rotation.y += s.spin.y * 0.016;
        s.mesh.rotation.z += s.spin.z * 0.016;
        s.mesh.position.y = s.basePos.y + Math.sin(t * 0.3 * s.drift + i * 1.7) * 0.35;
        s.mesh.position.x = s.basePos.x + Math.cos(t * 0.22 * s.drift + i * 2.3) * 0.25;
      });

      dust.rotation.y = t * 0.012;
      const dp = dust.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < DUST; i++) {
        let y = dp.getY(i) - 0.0035;
        if (y < -5) y = 5;
        dp.setY(i, y);
      }
      dp.needsUpdate = true;

      // camera: slow drift + pointer parallax + scroll dolly
      camera.position.x += (mouse.x * 0.7 - camera.position.x) * 0.03;
      camera.position.y += (-mouse.y * 0.45 - camera.position.y) * 0.03;
      camera.position.z = 9 + progress * 2.4;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      if (!reduced) raf = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("verglas-sweep", onSweep);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      pmrem.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="verglas-canvas" aria-hidden="true" />;
}
