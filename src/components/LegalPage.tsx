import { useState } from 'react'

/**
 * Privacy Policy + Terms — grounded in what NUTRYOS actually does (checked against the real
 * code, not boilerplate): anonymous-by-default Supabase auth with optional Google linking, RLS
 * scoping every table to auth.uid(), meal/progress photos sent to whichever vision backend is
 * reachable (on-device WebGPU model, a user-run local Ollama instance, or Google Gemini via a
 * server-side Supabase Edge Function that holds the one API key), barcode lookups sent to the
 * public Open Food Facts database (no personal data attached, just the barcode), and Buy Me a
 * Coffee as an external link Deep never sees payment details through.
 */
export function LegalPage({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'privacy' | 'terms'>('privacy')

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg-primary text-text-primary">
      <div className="glass sticky top-0 z-10 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3">
        <button onClick={onClose} className="text-caption text-text-tertiary">
          Close
        </button>
        <h2 className="text-caption uppercase tracking-wide text-text-secondary">Privacy &amp; Terms</h2>
        <div className="w-12" />
      </div>

      <div className="mx-4 mt-4 flex gap-2 rounded-xl bg-bg-secondary p-1">
        {(['privacy', 'terms'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-caption font-semibold transition-colors ${
              tab === t ? 'bg-accent-health text-bg-primary' : 'text-text-tertiary'
            }`}
          >
            {t === 'privacy' ? 'Privacy Policy' : 'Terms of Use'}
          </button>
        ))}
      </div>

      <div className="mx-4 mb-8 mt-4 flex flex-col gap-4 text-body text-text-secondary">
        {tab === 'privacy' ? <PrivacyContent /> : <TermsContent />}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass-card flex flex-col gap-2 p-4">
      <h3 className="text-body font-semibold text-text-primary">{title}</h3>
      <div className="flex flex-col gap-2 text-caption leading-relaxed text-text-secondary">{children}</div>
    </section>
  )
}

function PrivacyContent() {
  return (
    <>
      <p className="text-caption text-text-tertiary">Last updated 2026-09-19.</p>

      <Section title="What we store">
        <p>
          Your meals, workouts, water intake, weight, goals, and any photos you take are stored in NUTRYOS's
          database. Every row is scoped to your account — nobody else, including us, can query another user's data
          through the app.
        </p>
      </Section>

      <Section title="How you're identified">
        <p>
          NUTRYOS creates an anonymous account for you automatically — no email or password required to start. You
          can optionally link a Google account later (in Settings → Account) so your data follows you across
          devices; until you do, your data lives only on this device's login.
        </p>
      </Section>

      <Section title="Photos and food recognition">
        <p>
          When you log a meal by photo, the image is sent to whichever food-recognition backend is available at
          that moment: a model running on your own device, a local Ollama server on your own network if you've set
          one up, or — as the fallback — Google's Gemini API, called through our own server so the API key never
          touches your device. We don't store your photos anywhere beyond what's needed to show them back to you in
          the app.
        </p>
      </Section>

      <Section title="Barcode scanning">
        <p>
          Scanning a barcode sends only the barcode number to Open Food Facts, a public, independent food database —
          no personal or account information is attached to that request.
        </p>
      </Section>

      <Section title="Together mode">
        <p>
          If you join or create a household, the meals and progress you choose to share become visible to other
          members of that household. Nothing is shared outside a household you've explicitly joined.
        </p>
      </Section>

      <Section title="Payments">
        <p>
          The "Support NUTRYOS" link opens Buy Me a Coffee in your browser. We never see or store your payment
          details — that happens entirely on Buy Me a Coffee's own platform.
        </p>
      </Section>

      <Section title="Your data, your control">
        <p>
          You can export your data as a local file at any time from Settings → Account &amp; Backup, and you can ask
          us to delete your account and data by reaching out through the app's feedback link.
        </p>
      </Section>

      <Section title="What we don't do">
        <p>We don't run ad trackers, sell your data, or share it with data brokers. There are no ads in NUTRYOS.</p>
      </Section>
    </>
  )
}

function TermsContent() {
  return (
    <>
      <p className="text-caption text-text-tertiary">Last updated 2026-09-19.</p>

      <Section title="Not medical advice">
        <p>
          NUTRYOS estimates calories and macros to help you track your own goals. It is not a medical device and
          doesn't provide medical, dietary, or health advice — talk to a qualified professional for that.
        </p>
      </Section>

      <Section title="Accuracy">
        <p>
          Nutrition estimates come from AI food recognition and public food databases and can be wrong — always use
          your own judgment, especially for allergies or strict dietary needs.
        </p>
      </Section>

      <Section title="Your account">
        <p>
          You're responsible for what you log and for anything shared through Together mode with your household.
          Don't use NUTRYOS to upload content that isn't yours or that violates someone else's privacy.
        </p>
      </Section>

      <Section title="Service availability">
        <p>
          NUTRYOS is an independent, actively-developed app. Features may change, and we can't guarantee uninterrupted
          availability of third-party services it depends on (like the AI vision backend or the barcode database).
        </p>
      </Section>

      <Section title="Contact">
        <p>Questions about these terms or your data can be sent through the app's feedback link in Settings.</p>
      </Section>
    </>
  )
}
