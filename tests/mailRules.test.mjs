import { isValidEmail, isCompanyEmail, normalizeEmails, splitRecipients, safeHttpUrl, MAX_RECIPIENTS } from '../lib/mailRules.ts'
let fail = 0
const eq = (n, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`) }
const none = new Set()

eq('valid email', isValidEmail('a.b@ab-businesssupport.com'), true)
eq('rejects no @', isValidEmail('nobody'), false)
eq('rejects spaces and injected headers', isValidEmail('a@x.com\nBcc: evil@x.com'), false)
eq('rejects angle-bracket display names', isValidEmail('Boss <a@x.com>'), false)
eq('rejects non-strings', isValidEmail(42), false)
eq('company email (primary domain)', isCompanyEmail('A@AB-BusinessSupport.com'), true)
eq('company email (alias domain)', isCompanyEmail('a@ab-contactsolutions.com'), true)
eq('lookalike domain is NOT a company email', isCompanyEmail('a@ab-businesssupport.com.evil.io'), false)
eq('gmail is not a company email', isCompanyEmail('a@gmail.com'), false)

eq('normalize: array, dedupe, lowercase, drop junk', normalizeEmails([' A@x.com ', 'a@x.com', 'junk', null, 'b@y.org']), ['a@x.com', 'b@y.org'])
eq('normalize: comma/semicolon string (cc field)', normalizeEmails('a@x.com; b@y.org, c@z.io'), ['a@x.com', 'b@y.org', 'c@z.io'])
eq('normalize: non-list input gives empty', normalizeEmails({ a: 1 }), [])
eq('normalize: capped', normalizeEmails(Array.from({ length: 200 }, (_, i) => `u${i}@x.com`)).length, MAX_RECIPIENTS)

eq('company addresses always allowed', splitRecipients(['a@ab-businesssupport.com'], none), { allowed: ['a@ab-businesssupport.com'], blocked: [] })
eq('a stranger is blocked (the mail-relay case)', splitRecipients(['victim@gmail.com'], none), { allowed: [], blocked: ['victim@gmail.com'] })
eq('an address that exists on a portal user/employee is allowed', splitRecipients(['pat@gmail.com'], new Set(['pat@gmail.com'])), { allowed: ['pat@gmail.com'], blocked: [] })
eq('mixed list is split', splitRecipients(['a@ab-contactsolutions.com', 'evil@x.io'], none), { allowed: ['a@ab-contactsolutions.com'], blocked: ['evil@x.io'] })

eq('http link kept', safeHttpUrl('https://drive.google.com/x'), 'https://drive.google.com/x')
eq('javascript: link refused', safeHttpUrl('javascript:alert(1)'), null)
eq('link with quote refused', safeHttpUrl('https://x.com/"onmouseover="x'), null)
console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0)
