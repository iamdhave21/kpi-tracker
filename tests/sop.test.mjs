import {
  sameStaff, canAuthor, canBeApprover, canManageDoc, canSeeDoc, canSeeAllVersions, isReceiver, ackStats,
  approvalOutcome, approverProblem, nextVersionNo, validCode, reviewState, sanitizeCards, cardPaths,
  canRetireDoc, proofProblem, proofMissing, cardsChanged, cardHasContent, publicProof, methodLabel,
} from '../lib/sop.ts'
let fail = 0
const eq = (n, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`) }

// identity: alias domains, empties
eq('alias domain is same person', sameStaff('a.b@ab-businesssupport.com', 'A.B@ab-contactsolutions.com'), true)
eq('different people', sameStaff('a@x.com', 'b@x.com'), false)
eq('empty never matches', sameStaff('', ''), false)

// roles
eq('agent cannot author', canAuthor('agent'), false)
eq('TL can author', canAuthor('Team Lead'), true)
eq('admin can author', canAuthor('admin'), true)
eq('agent cannot approve', canBeApprover('agent'), false)

// managing: admin any, author own, other TL no
const doc = { created_by: 'tl.one@ab-businesssupport.com', status: 'active' }
eq('admin manages any', canManageDoc(doc, 'admin', 'a@x.com'), true)
eq('author TL manages own (alias domain)', canManageDoc(doc, 'Team Lead', 'TL.ONE@ab-contactsolutions.com'), true)
eq('other TL cannot manage', canManageDoc(doc, 'Team Lead', 'tl.two@x.com'), false)
eq('agent who created (role since changed) cannot manage', canManageDoc(doc, 'agent', 'tl.one@x.com'), false)

// visibility
const ctx = (o) => ({ role: 'agent', email: 'ag@x.com', isApprover: false, isReceiver: true, hasCurrentVersion: true, ...o })
eq('receiver sees active doc', canSeeDoc(doc, ctx({})), true)
eq('non-receiver does not see (narrowed doc)', canSeeDoc(doc, ctx({ isReceiver: false })), false)
eq('nobody sees a doc with no approved version', canSeeDoc({ ...doc, status: 'draft' }, ctx({ hasCurrentVersion: false })), false)
eq('retired hidden from receivers', canSeeDoc({ ...doc, status: 'retired' }, ctx({})), false)
eq('retired still visible to admin', canSeeDoc({ ...doc, status: 'retired' }, ctx({ role: 'admin' })), true)
eq('approver sees pending draft', canSeeDoc({ ...doc, status: 'draft' }, ctx({ isApprover: true, hasCurrentVersion: false, isReceiver: false })), true)
eq('agent cannot see version history', canSeeAllVersions(doc, { role: 'agent', email: 'ag@x.com', isApprover: false }), false)
eq('approver can see version history', canSeeAllVersions(doc, { role: 'Team Lead', email: 'other@x.com', isApprover: true }), true)

// receivers
eq("mode 'all' includes everyone", isReceiver('all', [], 'anyone@x.com'), true)
eq('selected: in list (alias)', isReceiver('selected', ['a@ab-businesssupport.com'], 'A@ab-contactsolutions.com'), true)
eq('selected: not in list', isReceiver('selected', ['a@x.com'], 'b@x.com'), false)
eq('empty email is never a receiver', isReceiver('all', [], ''), false)

// acknowledgment stats; re-ack is natural because acks are per version
const active = ['a@ab-businesssupport.com', 'b@ab-businesssupport.com', 'c@ab-businesssupport.com']
eq('all: 1 of 3 acked, alias counts', ackStats('all', active, [], ['A@ab-contactsolutions.com']),
  { expected: 3, acked: 1, pending: ['b@ab-businesssupport.com', 'c@ab-businesssupport.com'] })
eq('new version = nobody acked yet', ackStats('all', active, [], []).acked, 0)
eq('selected: only listed people expected', ackStats('selected', active, ['b@x.com'], []).expected, 1)
eq('duplicates in pool counted once', ackStats('all', ['a@x.com', 'A@y.com'], [], []).expected, 1)
eq('ack by someone outside pool does not inflate', ackStats('selected', active, ['b@x.com'], ['zz@x.com']).acked, 0)

// approvals
eq('no approvers = pending', approvalOutcome([]), 'pending')
eq('all approved', approvalOutcome(['approved', 'approved']), 'approved')
eq('one pending = pending', approvalOutcome(['approved', 'pending']), 'pending')
eq('any decline = declined', approvalOutcome(['approved', 'declined', 'pending']), 'declined')
eq('needs an approver', approverProblem([], 'a@x.com', 'Team Lead'), 'Choose at least one approver.')
eq('agent cannot be approver', approverProblem([{ email: 'ag@x.com', role: 'agent' }], 'tl@x.com', 'Team Lead') !== null, true)
eq('TL cannot approve own', approverProblem([{ email: 'TL@y.com', role: 'Team Lead' }], 'tl@x.com', 'Team Lead') !== null, true)
eq('admin may approve own', approverProblem([{ email: 'ad@x.com', role: 'admin' }], 'ad@x.com', 'admin'), null)
eq('valid approver passes', approverProblem([{ email: 'ad@x.com', role: 'admin' }], 'tl@x.com', 'Team Lead'), null)

// versions, codes
eq('first version is 1', nextVersionNo([]), 1)
eq('next version', nextVersionNo([1, 2, 5]), 6)
eq('valid code', validCode('OPS-SOP-001'), true)
eq('code with space rejected', validCode('OPS SOP'), false)
eq('code too short rejected', validCode('A'), false)

// review dates (fixed "today" = Oct 7 2026)
const today = new Date(2026, 9, 7)
eq('no review date', reviewState(null, today), 'none')
eq('overdue yesterday', reviewState('2026-10-06', today), 'overdue')
eq('due today is due soon, not overdue', reviewState('2026-10-07', today), 'due_soon')
eq('30 days out is due soon', reviewState('2026-11-06', today), 'due_soon')
eq('31 days out is ok', reviewState('2026-11-07', today), 'ok')

// card sanitising: forged attachment paths must never survive
const stored = [{ id: 'card-one-aaaa', type: 'file', title: 't', body: '', url: '', attachments: [{ name: 'a.pdf', path: 'sop/1/1/a.pdf', size: 5 }] }]
const forged = [
  { id: 'card-one-aaaa', type: 'file', title: 'T', attachments: [{ name: 'x', path: 'client-uploads/OTHER-CLIENT/secret.pdf', size: 1 }] },
  { id: 'brand-new-card', type: 'file', title: 'N', attachments: [{ name: 'y', path: 'sop/9/9/hack.pdf', size: 1 }] },
]
const clean = sanitizeCards(forged, stored)
eq('existing card keeps ONLY stored attachments', clean[0].attachments.map(a => a.path), ['sop/1/1/a.pdf'])
eq('new card gets no attachments from request', clean[1].attachments, [])
eq('cardPaths lists stored paths', cardPaths(clean), ['sop/1/1/a.pdf'])
eq('non-http link dropped', sanitizeCards([{ id: 'abcdefgh', type: 'link', title: 'x', url: 'javascript:alert(1)' }], [])[0].url, '')
eq('https link kept', sanitizeCards([{ id: 'abcdefgh', type: 'link', title: 'x', url: 'https://example.com/a' }], [])[0].url, 'https://example.com/a')
eq('text card never carries a url or files', sanitizeCards([{ id: 'abcdefgh', type: 'text', url: 'https://x.com', attachments: [{ path: 'p' }] }], stored)[0].attachments, [])
eq('unknown type falls back to text', sanitizeCards([{ id: 'abcdefgh', type: 'script' }], [])[0].type, 'text')
eq('duplicate ids are replaced', new Set(sanitizeCards([{ id: 'dup-id-1234' }, { id: 'dup-id-1234' }], []).map(c => c.id)).size, 2)
eq('non-array input gives no cards', sanitizeCards('nope', []), [])

// ---- client-scoped management (Team Leads maintain their own client's docs) ----
const emmaDoc = { created_by: 'tl.one@x.com', client: 'EMMA', status: 'active' }
eq('TL supporting the client can manage', canManageDoc(emmaDoc, 'Team Lead', 'tl.two@x.com', ['emma']), true)
eq('TL on a different client cannot', canManageDoc(emmaDoc, 'Team Lead', 'tl.two@x.com', ['Harlan + Holden']), false)
eq('TL with no clients cannot', canManageDoc(emmaDoc, 'Team Lead', 'tl.two@x.com', []), false)
eq('company-wide doc (no client): other TL cannot', canManageDoc({ created_by: 'a@x.com', client: null }, 'Team Lead', 'tl.two@x.com', ['EMMA']), false)
eq('an agent on that client still cannot', canManageDoc(emmaDoc, 'agent', 'ag@x.com', ['EMMA']), false)
eq('client TL sees drafts (manager view)', canSeeAllVersions(emmaDoc, { role: 'Team Lead', email: 'tl.two@x.com', isApprover: false, clients: ['EMMA'] }), true)
eq('client TL can open the doc', canSeeDoc({ ...emmaDoc, status: 'draft' }, { role: 'Team Lead', email: 'tl.two@x.com', clients: ['EMMA'], isApprover: false, isReceiver: false, hasCurrentVersion: false }), true)
eq('retire: client TL may NOT', canRetireDoc(emmaDoc, 'Team Lead', 'tl.two@x.com'), false)
eq('retire: creator may', canRetireDoc(emmaDoc, 'Team Lead', 'TL.ONE@y.com'), true)
eq('retire: admin may', canRetireDoc(emmaDoc, 'admin', 'a@x.com'), true)

// ---- approval proof ----
eq('proof complete', proofProblem({ approved_by_name: 'Kyla', approved_on: '2026-10-08', method: 'chat' }), null)
eq('proof needs a name', proofProblem({ approved_by_name: '  ', approved_on: '2026-10-08', method: 'chat' }) !== null, true)
eq('proof needs a real date', proofProblem({ approved_by_name: 'K', approved_on: '10/08/2026', method: 'chat' }) !== null, true)
eq('proof needs a known method', proofProblem({ approved_by_name: 'K', approved_on: '2026-10-08', method: 'carrier pigeon' }) !== null, true)
eq('method label', methodLabel('call'), 'Phone / video call')
eq('internal approval never "missing"', proofMissing({ approval_source: 'internal' }, []), false)
eq('external with no proof rows = missing', proofMissing({ approval_source: 'external' }, []), true)
eq('external with a row but no files = missing', proofMissing({ approval_source: 'external' }, [{ attachments: [] }]), true)
eq('external with a file = not missing', proofMissing({ approval_source: 'external' }, [{ attachments: [{ path: 'p' }] }]), false)
eq('readers get only who/when/how',
  Object.keys(publicProof({ approved_by_name: 'K', approved_by_role: 'POC', approved_on: '2026-10-08', method: 'chat', attachments: [{ path: 'secret' }], note: 'private' })).sort(),
  ['approved_by_name', 'approved_by_role', 'approved_on', 'method'])

// ---- small edits ----
const c1 = { id: 'aaaaaaaa', type: 'text', title: 'Step', body: 'one', url: '', attachments: [] }
eq('identical cards = no change', cardsChanged([c1], [{ ...c1 }]), false)
eq('text edit = change', cardsChanged([c1], [{ ...c1, body: 'two' }]), true)
eq('reorder = change', cardsChanged([c1, { ...c1, id: 'bbbbbbbb' }], [{ ...c1, id: 'bbbbbbbb' }, c1]), true)
eq('new attachment = change', cardsChanged([c1], [{ ...c1, attachments: [{ name: 'a', path: 'p', size: 1 }] }]), true)
eq('empty card has no content', cardHasContent({ ...c1, title: '', body: '  ' }), false)
eq('file-only card has content', cardHasContent({ ...c1, title: '', body: '', attachments: [{ name: 'a', path: 'p', size: 1 }] }), true)

console.log(fail === 0 ? '\nALL PASSED' : `\n${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)
