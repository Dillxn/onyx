import OnyxCanvas from "./main";

export default function Page() {
  return (
    <main className="page-shell">
      <div className="hero-lockup">
        <div className="hero-wordmark" aria-hidden="true">
          ONYX
        </div>
        <p className="hero-description">
          AI first platform to manage your website,
          <br />
          company, and beyond...
        </p>
      </div>
      <div className="scene-layer">
        <OnyxCanvas />
      </div>
    </main>
  );
}
