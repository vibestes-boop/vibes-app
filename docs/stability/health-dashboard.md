# Health Dashboard

The dashboard is the compact traffic-light view across all production guards.

Run:

```bash
npm run health:dashboard
```

Statuses:

- `Green`: guard passed and no dashboard-level concern
- `Yellow`: no blocker, but the weekly review must discuss the signal
- `Red`: blocker; workflow fails and broad feature launches stay frozen

Covered areas:

- Data Lifecycle
- Launch Readiness
- Product Metrics
- Cost Monitoring
- Moderation/Trust
- Push/Feed
- Governance

The dashboard does not replace the detailed guards. It summarizes their
snapshots so the weekly review can start with a single status board.
`Launch Readiness` intentionally stays yellow while the app is technically
usable but not ready for more invited users. Run `npm run launch:scorecard` for
the full invite decision.

Transient Supabase RPC timeouts are retried by default. A repeated timeout still
turns the affected area red, but a single short-lived `57014` statement timeout
does not make the whole dashboard noisy.
