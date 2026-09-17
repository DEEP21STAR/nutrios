import { TodayTabIcon, ProgressTabIcon, TogetherTabIcon } from '@/components/TabIcons'
import { cn } from '@/lib/utils'

export type TabKey = 'today' | 'progress' | 'together'

const TABS: Array<{ key: TabKey; label: string; Icon: typeof TodayTabIcon }> = [
  { key: 'today', label: 'Today', Icon: TodayTabIcon },
  { key: 'progress', label: 'Progress', Icon: ProgressTabIcon },
  { key: 'together', label: 'Together', Icon: TogetherTabIcon },
]

/**
 * Replaces the old single-scroll layout (Today ring → Achievements →
 * Together Mode → Trends, all stacked forever) with three real sections
 * behind their own tab, per Deep: "we don't want one long scroll going
 * through everything." Sits fixed at the very bottom; the input orb
 * (App.tsx) floats just above it, unaffected by which tab is active since
 * logging a meal is a global action, not a per-tab one.
 */
export function TabBar({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-white/5 pb-[env(safe-area-inset-bottom,0px)]">
      {TABS.map(({ key, label, Icon }) => {
        const isActive = active === key
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            aria-current={isActive ? 'page' : undefined}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 transition active:scale-95"
          >
            <Icon active={isActive} />
            <span
              className={cn(
                'text-caption transition-colors',
                isActive ? 'font-semibold text-text-primary' : 'text-text-muted',
              )}
            >
              {label}
            </span>
            <span
              className={cn(
                'h-0.5 w-6 rounded-full transition-all duration-300',
                isActive ? 'opacity-100' : 'scale-x-0 opacity-0',
              )}
              style={{
                background:
                  key === 'today'
                    ? 'var(--color-accent-health)'
                    : key === 'progress'
                      ? 'var(--color-accent-energy)'
                      : 'var(--color-accent-ai)',
              }}
              aria-hidden
            />
          </button>
        )
      })}
    </nav>
  )
}
