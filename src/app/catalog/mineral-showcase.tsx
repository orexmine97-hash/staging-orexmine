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

// Placeholder when there's no usable poster: the commodity illustration (or just
// the label) on the same soft backdrop as the inventory cards.
function Gradient({ label, img }: { label: string; img?: string }) {
  return (
    <div
      className="relative flex h-full w-full items-end"
      style={{ background: "radial-gradient(100% 80% at 50% 35%, #fbfaf6 0%, #e4e8e2 78%)" }}
    >
      {img && (
        // eslint-disable-next-line @next/next/no-img-element -- static illustration
        <img src={img} alt="" className="absolute left-1/2 top-[45%] w-[82%] -translate-x-1/2 -translate-y-1/2" />
      )}
      <p className="relative m-5 rounded-full bg-surface/85 px-3 py-1 text-[13px] text-muted">
        {label} · illustration, not a batch photo
      </p>
    </div>
  );
}

// Poster still with a graceful fall-through to the gradient when the image 404s.
function Poster({ posterUrl, label, img }: { posterUrl: string; label: string; img?: string }) {
  const [broken, setBroken] = useState(false);
  if (!posterUrl || broken) return <Gradient label={label} img={img} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external/CDN asset, no static import
    <img
      src={posterUrl}
      alt={`${label} — representative model`}
      onError={() => setBroken(true)}
      // A 404 can land before hydration, when onError isn't attached yet.
      ref={(el) => {
        if (el?.complete && el.naturalWidth === 0) setBroken(true);
      }}
      className="h-full w-full object-cover"
    />
  );
}

// Presentation aid only: rotate/zoom/pan never imply proof of grade or quantity
// (FR-84). Live facts live in the panel beside this, from the transactional API.
export function MineralShowcase({ asset, label, img }: { asset: ShowcaseAsset; label: string; img?: string }) {
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
    <div className="relative aspect-square overflow-hidden rounded-[32px] bg-surface">
      {/* Poster is the base layer — instant, and what shows through while the GLB
          loads or if 3D is unavailable. */}
      {asset ? <Poster posterUrl={asset.posterUrl} label={label} img={img} /> : <Gradient label={label} img={img} />}

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
