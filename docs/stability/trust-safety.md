# Trust & Safety

This is the first operational layer for moderation. Reports must enter one
queue, admins must leave an audit trail, and unattended reports must become
visible before users lose trust.

Run:

```bash
npm run moderation:health
```

## Report Queue

Canonical moderation reports live in `content_reports` and are created through
the `create_report` RPC.

Covered target types:

- `post`
- `profile`
- `comment`
- `live`
- `product`

Legacy report tables may still exist for older flows or product feedback, but
moderation reports must be mirrored into `content_reports`. The health check
fails when it finds legacy reports that are not queued.

## SLA

Default moderation SLA:

- pending report older than 24 hours: fail
- legacy report missing from `content_reports`: fail
- pending report count above 25: fail

Tunable script flags:

```bash
npm run moderation:health -- --max-pending 50 --max-oldest-pending-hours 12
```

## Admin Actions

Admin report resolution goes through `admin_resolve_content_report`, which:

- verifies `profiles.is_admin`
- updates status to `reviewed`, `actioned`, or `dismissed`
- stores reviewer, review time, and note
- writes an `admin_audit_log` entry

Operational review happens in `/admin/reports`. The page shows the canonical
`content_reports` queue, the moderation health/SLA summary, legacy unqueued
report count, recent audit activity, and direct links to actionable targets
where possible.

Status meaning:

- `reviewed`: checked, no user-visible enforcement needed
- `actioned`: enforcement was taken, such as removal, ban, restriction, or escalation
- `dismissed`: report was invalid or not actionable

## Weekly Review

Every weekly operations review checks:

- pending reports
- oldest pending report age
- reports over SLA
- pending reports by target type
- unqueued legacy reports
- moderation audit events in the last 7 days

If reports over SLA are greater than zero, product work pauses until the queue
is cleared or an owner explicitly accepts the risk in the weekly review notes.
