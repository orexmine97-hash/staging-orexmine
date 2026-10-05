"use client";

import { Component, type ReactNode, useEffect, useState } from "react";
import dynamic from "next/dynamic";

// three.js only loads once we've decided to render 3D — never on first paint,
// never on the server (Canvas needs a DOM).
const MineralViewer = dynamic(() => import("./mineral-viewer"), { ssr: false });

export type ShowcaseAsset = { posterUrl: string; modelUrl: string | null } | null;

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
  } catch {
    return false;
  }
}

// A broken GLB (missing file, decode error) rejects inside Suspense; catch it and
// fall back to the poster instead of blanking the page (FR-87).
class ViewerBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Gradient({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-lg bg-gradient-to-br from-amber/10 to-accent/20 text-center">
      <div>
        <p className="font-heading text-2xl font-semibold text-accent">{label}</p>
        <p className="mt-1 text-xs text-muted">Representative model — presentation only</p>
      </div>
    </div>
  );
}

// Poster still with a graceful fall-through to the gradient when the image 404s.
function Poster({ posterUrl, label }: { posterUrl: string; label: string }) {
  const [broken, setBroken] = useState(false);
  if (!posterUrl || broken) return <Gradient label={label} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external/CDN asset, no static import
    <img
      src={posterUrl}
      alt={`${label} — representative model`}
      onError={() => setBroken(true)}
      className="h-full w-full rounded-lg object-cover"
    />
  );
}

// Presentation aid only: rotate/zoom/pan never imply proof of grade or quantity
// (FR-84). Live facts live in the panel beside this, from the transactional API.
export function MineralShowcase({ asset, label }: { asset: ShowcaseAsset; label: string }) {
  // null until mounted; probing WebGL post-mount avoids a hydration mismatch
  // (the viewer is ssr:false, so 3D can only be decided on the client).
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot client capability check on mount
    setWebgl(hasWebGL());
  }, []);

  const show3D = webgl === true && !failed && !!asset?.modelUrl;

  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border border-divider bg-surface">
      {/* Poster is the base layer — instant, and what shows through while the GLB
          loads or if 3D is unavailable. */}
      {asset ? <Poster posterUrl={asset.posterUrl} label={label} /> : <Gradient label={label} />}

      {show3D && asset?.modelUrl && (
        <div className="absolute inset-0">
          <ViewerBoundary onError={() => setFailed(true)}>
            <MineralViewer modelUrl={asset.modelUrl} />
          </ViewerBoundary>
        </div>
      )}
    </div>
  );
}
