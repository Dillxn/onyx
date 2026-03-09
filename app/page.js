import Link from "next/link";
import OnyxCanvas from "./main";

export default function Page() {
  return (
    <main className="page-shell">
      <div className="sweep-underlay" aria-hidden="true" />

      <div className="hero-wordmark-layer">
        <div className="hero-wordmark" aria-hidden="true">
          ONYX
        </div>
      </div>

      <div className="sweep-wordmark-layer sweep-reveal" aria-hidden="true">
        <div className="hero-wordmark hero-wordmark-inverse">ONYX</div>
      </div>

      <div className="hero-panel-layer">
        <div className="hero-panel-group">
          <div className="hero-wordmark hero-wordmark-measure" aria-hidden="true">
            ONYX
          </div>
          <div className="hero-panel">
            <p className="hero-description">
              AI first platform to manage your website,
              <br />
              company, and beyond...
            </p>
            <Link href="/#future" className="hero-cta" aria-label="See the future">
              <span className="hero-cta-text">See the future...</span>
              <span className="hero-cta-icon" aria-hidden="true">
                <span className="hero-cta-arrow">↗</span>
              </span>
            </Link>
          </div>
        </div>
      </div>

      <div className="scene-layer" id="future">
        <OnyxCanvas />
      </div>

      <div className="sweep-panel-layer sweep-reveal" aria-hidden="true">
        <div className="hero-panel-group">
          <div className="hero-wordmark hero-wordmark-measure">ONYX</div>
          <div className="hero-panel hero-panel-inverse">
            <p className="hero-description hero-description-inverse">
              AI first platform to manage your website,
              <br />
              company, and beyond...
            </p>
            <div className="hero-cta hero-cta-inverse">
              <span className="hero-cta-text">See the future...</span>
              <span className="hero-cta-icon">
                <span className="hero-cta-arrow">↗</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
