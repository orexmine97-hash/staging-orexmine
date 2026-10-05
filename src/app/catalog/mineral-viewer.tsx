"use client";

import { Suspense, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage, useGLTF } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

// Interactive representative model (FR-82/83). Lazily imported by MineralShowcase
// (ssr:false) so three.js never ships in the first paint. The GLB is Draco-
// compressed (see seed), so useGLTF is told to use the Draco decoder.
// ponytail: Draco decoder is pulled from drei's default CDN; self-host it if the
// showcase must work offline or you want to drop the third-party fetch.
function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url, true);
  return <primitive object={scene} />;
}

export default function MineralViewer({ modelUrl }: { modelUrl: string }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const [spin, setSpin] = useState(true);

  return (
    <div className="group relative h-full w-full">
      <Canvas
        camera={{ position: [0, 0, 3.4], fov: 45 }}
        dpr={[1, 2]}
        tabIndex={0}
        aria-label="Interactive representative mineral model"
        className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Suspense fallback={null}>
          <Stage environment="studio" intensity={0.5} adjustCamera={1.1}>
            <Model url={modelUrl} />
          </Stage>
        </Suspense>
        <OrbitControls
          ref={controls}
          makeDefault
          autoRotate={spin}
          autoRotateSpeed={0.8}
          enablePan
          enableZoom
          minDistance={1.5}
          maxDistance={8}
        />
      </Canvas>

      {/* Accessible controls — keyboard/touch reach these regardless of the canvas. */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2 rounded-full border border-divider bg-surface/90 px-2 py-1 text-xs shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => setSpin((s) => !s)}
          aria-pressed={spin}
          className="rounded-full px-2 py-0.5 text-muted hover:text-text"
        >
          {spin ? "Pause" : "Rotate"}
        </button>
        <span className="text-divider">|</span>
        <button
          type="button"
          onClick={() => controls.current?.reset()}
          className="rounded-full px-2 py-0.5 text-muted hover:text-text"
        >
          Reset view
        </button>
      </div>
    </div>
  );
}
