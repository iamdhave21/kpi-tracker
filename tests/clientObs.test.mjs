import { canSeeEntry, canEditEntry } from '../lib/clientObs.ts'
let fail = 0
const eq = (n, got, want) => { const ok = got === want; if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${got} want ${want}`) }
const emma = { client: 'EMMA', created_by: 'agent.one@x.com' }
const hh   = { client: 'Harlan + Holden', created_by: 'tl.two@x.com' }
// admins
eq('admin sees all', canSeeEntry(emma, 'admin', 'a@x.com', []), true)
eq('super_admin sees all', canSeeEntry(hh, 'super_admin', 's@x.com', []), true)
// agent
eq('agent sees own', canSeeEntry(emma, 'agent', 'AGENT.ONE@x.com', []), true)
eq('agent not others (same client)', canSeeEntry(emma, 'agent', 'other@x.com', ['EMMA']), false)
eq('agent not others', canSeeEntry(hh, 'agent', 'agent.one@x.com', []), false)
// team lead
eq('TL sees supported client entry (case-insens)', canSeeEntry(emma, 'Team Lead', 'tl@x.com', ['emma']), true)
eq('TL not other client entry', canSeeEntry(hh, 'Team Lead', 'tl@x.com', ['EMMA']), false)
eq('TL sees own even other client', canSeeEntry(hh, 'Team Lead', 'TL.TWO@x.com', ['EMMA']), true)
eq('TL with NO clients sees nothing of others', canSeeEntry(emma, 'Team Lead', 'tl@x.com', []), false)
eq('TL multi-client', canSeeEntry(hh, 'Team Lead', 'tl@x.com', ['EMMA', 'Harlan + Holden']), true)
// empty identity never matches
eq('empty email never owns', canSeeEntry({ client: 'EMMA', created_by: '' }, 'agent', '', []), false)
eq('unknown role = own only', canSeeEntry(emma, 'manager', 'x@x.com', ['EMMA']), false)
// edit
eq('admin edits any', canEditEntry(emma, 'admin', 'a@x.com'), true)
eq('author edits own', canEditEntry(emma, 'agent', 'Agent.One@x.com'), true)
eq('TL cannot edit others\' even if visible', canEditEntry(emma, 'Team Lead', 'tl@x.com'), false)
eq('empty email cannot edit', canEditEntry({ client: 'EMMA', created_by: '' }, 'agent', ''), false)
console.log(fail ? `${fail} FAILED` : 'ALL PASSED')
