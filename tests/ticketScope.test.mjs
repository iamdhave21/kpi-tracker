import { canSeeTicket, isMine, isHandler, pocCategoriesFor, teamEmailsFor, localPart } from '../lib/ticketScope.ts'
let fail = 0
const eq = (n, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`) }
const ctx = (o) => ({ role: 'agent', email: 'me@ab-businesssupport.com', pocCategories: [], teamEmails: [], roleByLocal: {}, ...o })
const tk = (o) => ({ created_by: 'other@ab-businesssupport.com', requested_by: 'other@ab-businesssupport.com', owner: null, assigned_to: null, category: 'IT', ...o })

// identity
eq('local part of an email', localPart('A.B@X.com'), 'a.b')
eq('a bare legacy username matches the same person\'s email', isMine(tk({ created_by: 'precilla.cornel', requested_by: null }), 'Precilla.Cornel@ab-contactsolutions.com'), true)
eq('empty email never owns anything', isMine(tk({ created_by: '' }), ''), false)

// agent
eq('agent sees own', canSeeTicket(tk({ created_by: 'me@x.com', requested_by: 'me@x.com' }), ctx({})), true)
eq('agent sees own (alias domain)', canSeeTicket(tk({ created_by: 'ME@ab-contactsolutions.com', requested_by: null }), ctx({})), true)
eq('agent does NOT see others', canSeeTicket(tk({}), ctx({})), false)
eq('agent sees a ticket assigned to them', canSeeTicket(tk({ owner: 'ME@x.com' }), ctx({})), true)
eq('agent who is a POC sees that category', canSeeTicket(tk({ category: 'IT' }), ctx({ pocCategories: ['it'] })), true)
eq('POC does not see other categories', canSeeTicket(tk({ category: 'HR' }), ctx({ pocCategories: ['IT'] })), false)

// team lead
const tl = (o) => ctx({ role: 'Team Lead', teamEmails: ['agent.one@ab-businesssupport.com'], ...o })
eq('TL sees own team member\'s ticket', canSeeTicket(tk({ created_by: 'Agent.One@ab-contactsolutions.com', requested_by: null }), tl({})), true)
eq('TL does NOT see another team\'s ticket', canSeeTicket(tk({ created_by: 'stranger@x.com', requested_by: null }), tl({})), false)
eq('TL with no team sees nothing extra', canSeeTicket(tk({ created_by: 'agent.one@x.com' }), tl({ teamEmails: [] })), false)

// manager (role "admin")
const mg = (o) => ctx({ role: 'admin', roleByLocal: { 'agent.one': 'agent', 'tl.one': 'Team Lead', 'mgr.two': 'admin', dhave: 'super_admin' }, ...o })
eq('Manager sees an Agent\'s ticket', canSeeTicket(tk({ created_by: 'agent.one@x.com', requested_by: 'agent.one@x.com' }), mg({})), true)
eq('Manager sees a Team Lead\'s ticket', canSeeTicket(tk({ created_by: 'tl.one@x.com', requested_by: null }), mg({})), true)
eq('Manager does NOT see another Manager\'s ticket', canSeeTicket(tk({ created_by: 'mgr.two@x.com', requested_by: 'mgr.two@x.com' }), mg({})), false)
eq('Manager does NOT see the Super Admin\'s ticket', canSeeTicket(tk({ created_by: 'dhave@x.com', requested_by: 'dhave@x.com' }), mg({})), false)
eq('...unless it is assigned to them', canSeeTicket(tk({ created_by: 'dhave@x.com', requested_by: 'dhave@x.com', owner: 'me@x.com' }), mg({})), true)
eq('...or they are the POC for its category', canSeeTicket(tk({ created_by: 'dhave@x.com', requested_by: 'dhave@x.com', category: 'IT' }), mg({ pocCategories: ['IT'] })), true)
eq('Manager sees their own ticket', canSeeTicket(tk({ created_by: 'me@x.com', requested_by: 'me@x.com' }), mg({ roleByLocal: { me: 'admin' } })), true)
eq('creator with no account on file counts as staff (visible)', canSeeTicket(tk({ created_by: 'legacy.user', requested_by: null }), mg({})), true)
eq('requested_by decides over created_by for the Manager rule', canSeeTicket(tk({ created_by: 'agent.one@x.com', requested_by: 'mgr.two@x.com' }), mg({})), false)

// super admin
eq('Super Admin sees everything', canSeeTicket(tk({}), ctx({ role: 'super_admin' })), true)

// unknown role: fails closed
eq('unknown role sees only own', canSeeTicket(tk({}), ctx({ role: 'viewer' })), false)

// helpers
eq('POC categories from the owners map', pocCategoriesFor({ IT: ['zeljeko@x.com', 'a@x.com'], HR: ['hr@x.com'] }, 'ZELJEKO@ab-contactsolutions.com'), ['IT'])
eq('no POC categories for a stranger', pocCategoriesFor({ IT: ['a@x.com'] }, 'b@x.com'), [])
const emps = [{ id: '1', email: 'lead@x.com' }, { id: '2', email: 'a1@x.com' }, { id: '3', email: 'a2@x.com' }, { id: '4', email: 'other@x.com' }]
eq('team emails follow teams -> members', teamEmailsFor('LEAD@y.com', emps, [{ id: 't1', team_lead_id: '1' }, { id: 't2', team_lead_id: '4' }], [{ team_id: 't1', employee_id: '2' }, { team_id: 't1', employee_id: '3' }, { team_id: 't2', employee_id: '4' }]), ['a1@x.com', 'a2@x.com'])
eq('a person who leads no team gets none', teamEmailsFor('a1@x.com', emps, [{ id: 't1', team_lead_id: '1' }], [{ team_id: 't1', employee_id: '2' }]), [])
eq('unknown person gets none', teamEmailsFor('nobody@x.com', emps, [{ id: 't1', team_lead_id: '1' }], []), [])
eq('isHandler needs an email', isHandler(tk({ owner: '' }), { email: '', pocCategories: [''] }), false)

console.log(fail === 0 ? '\nALL PASSED' : `\n${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)
