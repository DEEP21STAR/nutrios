# Footer backups

Snapshots of `WhetuFooter.tsx` + its `.wfd-*` CSS block, saved before making changes, so a
previous version is easy to find without digging through `git log`.

## 2026-09-19-pre-condense

The version before condensing the footer from 5 rows to 4 (removed the redundant
`NUTRYOS · Whetū Digital 2026` badge, tightened spacing). To restore it:

1. Copy the contents of `2026-09-19-pre-condense.WhetuFooter.tsx` into
   `src/components/WhetuFooter.tsx`.
2. Copy the contents of `2026-09-19-pre-condense.wfd-footer.css` into `src/index.css`,
   replacing the current block of `.wfd-*` rules (they start at `.wfd-footer {` and run
   through the `wfdNameGlow` keyframes, just before the `prefers-reduced-motion` block).

This is also just sitting in git history as commit `fb09921` if you'd rather restore via
`git show fb09921:src/components/WhetuFooter.tsx` — these files are only here so it's
findable without git commands.
