# Matrix Auto-Logging Process

## How it works

Every time I (Claude) push a commit to this repo, I also create a matching
`LOG-*.sql` file in the same commit. Running that SQL file in Supabase adds
the entry to `dev_matrix`, so Matrix stays current with every feature and fix
shipped — no manual logging needed.

## Template for every future commit

```sql
insert into dev_matrix (category, title, description, status, priority, created_by, created_at) values
(
  -- category: 'Feature' | 'Issue' | 'Pending SQL'
  'Feature',

  -- title: short, specific, searchable
  'Short descriptive title here',

  -- description: what was done, why, any SQL files to run, any caveats
  'Full description of what changed, why it was needed, what SQL to run if any.',

  -- status: 'Done' for shipped features, 'Open' for known issues
  'Done',

  -- priority: 'Low' | 'Medium' | 'High'
  'Medium',

  'system',
  now()
);
```

## Category guide
- **Feature** — new functionality shipped
- **Issue** — bug found or fixed
- **Pending SQL** — code is live but a SQL migration still needs to be run in Supabase

## Priority guide
- **High** — security issue, data loss risk, or blocking someone's access
- **Medium** — significant feature or meaningful fix
- **Low** — cosmetic, UX tweak, documentation

## Naming convention
Log files are named: `LOG-{short-kebab-description}.sql`
e.g. `LOG-task-reminders.sql`, `LOG-permissions-batch2.sql`

They live in the repo root alongside the feature code, so the full history
of what was shipped and when is readable directly from GitHub.
