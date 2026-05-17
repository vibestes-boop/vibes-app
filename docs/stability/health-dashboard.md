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
- Product Metrics
- Cost Monitoring
- Moderation/Trust
- Push/Feed
- Governance

The dashboard does not replace the detailed guards. It summarizes their
snapshots so the weekly review can start with a single status board.
