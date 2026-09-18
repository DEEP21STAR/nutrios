/**
 * Whetū Digital trademark footer — same wordmark, 3D tilt animation, and
 * real brand colors (cyan/purple) as the live Clarity dashboard (see the
 * .wfd-* rules in index.css for the ported animation itself). This is the
 * company brand mark, not an app-themed element, so it deliberately does
 * NOT use NUTRIOS's own emerald/violet tokens.
 * NUTRIOS has no third-party client the way Clarity (Mimi) or Voyager
 * (Sachind) do, so the "built with care for" line reads generically.
 */
export function WhetuFooter({ className, name }: { className?: string; name?: string | null }) {
  return (
    <div className={`wfd-footer ${className ?? ''}`}>
      <div className="wfd-logo">WHETŪ DIGITAL</div>
      <div className="wfd-tagline">Digital Tools for Modern Living — Aotearoa New Zealand</div>
      <div className="wfd-copy">
        © {new Date().getFullYear()} Whetū Digital Ltd. &nbsp;·&nbsp;{' '}
        <a href="mailto:hello@whetudigital.co.nz">hello@whetudigital.co.nz</a>
      </div>
      <span className="wfd-ded">
        Built with care for <span className="wfd-name">{name?.trim() || 'you'}</span>{' '}
        <span className="wfd-heart">♥</span>
      </span>
      <span className="wfd-badge">NUTRIOS · Whetū Digital {new Date().getFullYear()}</span>
    </div>
  )
}
