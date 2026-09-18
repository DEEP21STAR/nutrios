/**
 * Whetū Digital trademark footer — same wordmark + 3D tilt animation as the
 * live Clarity dashboard, tinted to NUTRIOS's own emerald/violet tokens
 * (see the .wfd-* rules in index.css for the ported animation itself).
 * NUTRIOS has no third-party client the way Clarity (Mimi) or Voyager
 * (Sachind) do, so the "built with care for" line reads generically.
 */
export function WhetuFooter() {
  return (
    <div className="wfd-footer">
      <div className="wfd-logo">WHETŪ DIGITAL</div>
      <div className="wfd-tagline">Digital Tools for Modern Living — Aotearoa New Zealand</div>
      <div className="wfd-copy">
        © {new Date().getFullYear()} Whetū Digital Ltd. &nbsp;·&nbsp;{' '}
        <a href="mailto:hello@whetudigital.co.nz">hello@whetudigital.co.nz</a>
      </div>
      <span className="wfd-ded">
        Built with care for you <span className="wfd-heart">♥</span>
      </span>
      <span className="wfd-badge">NUTRIOS · Whetū Digital {new Date().getFullYear()}</span>
    </div>
  )
}
