import * as L from '../lib/clientRequests.ts'
let fail = 0
const eq = (n, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`) }
// approval by type
for (const [t, w] of [['headcount',true],['process_change',true],['commercial_change',true],['escalation',false],['commendation',false],['complaint_feedback',false],['general',false],['bogus',false]]) eq('approval '+t, L.requiresApproval(t), w)
eq('ref', L.refLabel(7), 'CR-0007'); eq('ref big', L.refLabel(12345), 'CR-12345')
// N/A dates
eq('NA', L.parseNaDate('NA'), {ok:true,value:null}); eq('n/a lower', L.parseNaDate(' n/a '), {ok:true,value:null})
eq('real date', L.parseNaDate('2026-11-05'), {ok:true,value:'2026-11-05'})
eq('empty is NOT na', L.parseNaDate(''), {ok:false}); eq('undefined', L.parseNaDate(undefined), {ok:false})
eq('feb 30', L.parseNaDate('2026-02-30'), {ok:false}); eq('garbage', L.parseNaDate('tomorrow'), {ok:false}); eq('leap ok', L.parseNaDate('2028-02-29'), {ok:true,value:'2028-02-29'})
// visibility
eq('admin all', L.canSeeRequest('admin', [], 'EMMA'), true); eq('SA all', L.canSeeRequest('super_admin', [], 'X'), true)
eq('TL own client', L.canSeeRequest('Team Lead', ['emma'], 'EMMA'), true)
eq('TL other client', L.canSeeRequest('Team Lead', ['EMMA'], 'Harlan + Holden'), false)
eq('TL no clients', L.canSeeRequest('Team Lead', [], 'EMMA'), false)
eq('agent none', L.canSeeRequest('agent', ['EMMA'], 'EMMA'), false)
// routing
const routing = [
  { client: null, level: 'director', recipients: 'dir@x.com' },
  { client: 'EMMA', level: 'director', recipients: 'emma.dir@x.com; second@x.com' },
  { client: null, level: 'ceo', recipients: 'ceo@x.com' },
  { client: null, level: 'team_lead', recipients: 'globaltl@x.com' },
]
const base = { derivedTeamLeads: ['tl.emma@x.com'], routing, fallback: 'ops@x.com' }
eq('client-specific beats global', L.resolveRecipients({ ...base, level: 'director', client: 'emma' }), ['emma.dir@x.com','second@x.com'])
eq('other client -> global', L.resolveRecipients({ ...base, level: 'director', client: 'Harlan + Holden' }), ['dir@x.com'])
eq('TL level -> actual TLs', L.resolveRecipients({ ...base, level: 'team_lead', client: 'EMMA' }), ['tl.emma@x.com'])
eq('TL level no TLs -> global row', L.resolveRecipients({ ...base, derivedTeamLeads: [], level: 'team_lead', client: 'EMMA' }), ['globaltl@x.com'])
eq('account_manager unset -> fallback', L.resolveRecipients({ ...base, level: 'account_manager', client: 'EMMA' }), ['ops@x.com'])
eq('junk recipients -> fallback', L.resolveRecipients({ ...base, routing: [{ client: null, level: 'ceo', recipients: 'not an email' }], level: 'ceo', client: 'A' }), ['ops@x.com'])
eq('dedupe + lowercase', L.resolveRecipients({ ...base, routing: [{ client: null, level: 'ceo', recipients: 'A@x.com, a@X.com' }], level: 'ceo', client: 'A' }), ['a@x.com'])
// approvals
eq('none = pending', L.decisionOutcome([]), 'pending'); eq('all approved', L.decisionOutcome(['approved','approved']), 'approved')
eq('one pending', L.decisionOutcome(['approved','pending']), 'pending'); eq('any declined wins', L.decisionOutcome(['approved','declined','pending']), 'declined')
// manual statuses
eq('ack-only gets all manual', L.allowedManualStatuses({ requires_approval: false, status: 'new' }).includes('completed'), true)
eq('ack-only never approved/declined', L.allowedManualStatuses({ requires_approval: false, status: 'new' }).some(s => s==='approved'||s==='declined'), false)
eq('approval type, not yet approved: no completed', L.allowedManualStatuses({ requires_approval: true, status: 'in_review' }).includes('completed'), false)
eq('approval type, approved: completed ok', L.allowedManualStatuses({ requires_approval: true, status: 'approved' }).includes('completed'), true)
// staff identity across alias domains
eq('alias domain', L.sameStaff('a.b@ab-businesssupport.com', 'A.B@ab-contactsolutions.com'), true); eq('different', L.sameStaff('a@x.com','b@x.com'), false); eq('empty', L.sameStaff('', ''), false)
console.log(fail ? `${fail} FAILED` : 'ALL PASSED')
