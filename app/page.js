import OnyxCanvas from "./main";

export default function Page() {
  return (
    <main className="page-shell">
      <p className="hero-description">
        AI first platform to manage your website,
        <br />
        company, and beyond...
      </p>
      <div className="hero-wordmark" aria-hidden="true">
        ONYX
      </div>
      <div className="scene-layer">
        <OnyxCanvas />
      </div>
    </main>
  );
}
