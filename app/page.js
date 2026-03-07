import OnyxCanvas from "./main";

export default function Page() {
  return (
    <main className="page-shell">
      <div className="hero-wordmark" aria-hidden="true">
        ONYX
      </div>
      <div className="scene-layer">
        <OnyxCanvas />
      </div>
    </main>
  );
}
