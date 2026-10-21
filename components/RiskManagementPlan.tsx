'use client'
import { useState } from 'react'
import { AlertCircle } from 'lucide-react'

// AB BSS Risk Management Plan -- a read-only reference view inside BCP, built
// the same way as the Escalation Matrix tab: collapsible sections plus the
// plan's own diagrams. It is a document, not a logging feature. The "Gaps to
// close" list is the starting point for the risk registers (a later phase).
// Source: AB BSS Risk Management Plan, Oct 8, 2026, prepared by Dhave Latimer.

type Row = [risk: string, existing: string, standardize: string, gap: string]

const OPERATIONS: Row[] = [
  ['Attrition / resignation', 'BCP and replacement planning', 'Formalize triggers', 'Workforce risk register'],
  ['Capacity and staffing shortages', 'Volume and FTE monitoring', 'Standard thresholds', 'Predictive capacity planning'],
  ['Peak-volume readiness (holidays, Black Friday)', 'Existing peak planning', 'Formal readiness checklist', 'Peak-readiness assessment'],
  ['Business continuity and replacement delays', 'Existing BCP', 'Consolidate documentation', 'Scenario-based testing'],
  ['Client escalations and service-impacting issues', 'Escalation Matrix and Procedure (AB-ESC-01, draft v0.1)', 'Adopt after the Section 11 decisions', 'Client risk register'],
  ['Process errors / quality issues', 'Tracking and observations', 'RCA and corrective action', 'Recurring-risk analysis'],
]
const PAYROLL: Row[] = [
  ['Attendance and unauthorized absences affecting paid time', 'Leave approval and monitoring', 'Consistent escalation and documentation', 'Early-warning indicators'],
  ['Urgent leave or leave extensions', 'Prior approval required, except genuine emergencies', 'Same-day documentation when the Team Lead is unreachable', 'Link approvals to payroll records'],
  ['Replacement and onboarding costs', 'AB BSS may absorb recruitment, onboarding, training and knowledge-transfer costs until the replacement is fully billable-ready', 'Define when absorption applies and its limit', 'Cost tracking per replacement'],
  ['Side work / productivity concerns', 'Performance observations', 'Standard RCA and action plan', 'Trend-based monitoring'],
  ['Refund and financial-control risk', 'Refund and reconciliation controls', 'Standardize evidence', 'Financial-risk register'],
]
const HR: Row[] = [
  ['Employee attrition', 'BCP and replacement planning', 'Formalize triggers', 'Workforce risk register'],
  ['Attendance', 'Leave approval and monitoring', 'Consistent escalation', 'Early-warning indicators'],
  ['Performance / productivity', 'Coaching and observations', 'Standard RCA and action plans', 'Trend-based risk monitoring'],
  ['Training and onboarding gaps', 'Replacement training step in the continuity framework', 'Validate independent performance before transition', 'Onboarding readiness check'],
]
const HR_SIGNALS = ['Attendance', 'Responsiveness', 'Engagement', 'Performance', 'Communication', 'Escalation behavior']
const SECURITY_CONTROLS = [
  'Access requests and approvals',
  'Immediate access removal when required',
  'Contractor, client and internal review before decommissioning',
  'Device retrieval',
  'Decommissioning of access when the relationship ends',
  'QRT device-retrieval escalation if the contractor is nonresponsive within one hour, to reduce data-breach exposure',
]
// Technology and work-environment disruption. "Stated practice" = the guidance given
// to staff, as described by the Director of Operations (Oct 2026); the written copy still
// needs to be attached as evidence. "System control" = something the portal enforces today.
const TECHNOLOGY: Row[] = [
  ['Internet outage', 'Stated practice: staff are expected to keep a backup internet connection (postpaid or prepaid) and to report an outage.', 'Write the rule down and set how quickly an outage must be reported (to be confirmed).', 'Outage procedure and a recovery test'],
  ['Power outage or severe weather (storm, flood)', 'Stated practice: staff tell AB BSS; AB BSS can arrange accommodation with reliable internet and power so work continues, and can help secure the safety of the person and their family.', 'Define who approves the arrangement and how it is recorded (to be confirmed).', 'Weather and Flood Procedure (not yet written)'],
  ['Device failure or loss', 'Stated practice: staff report it; AB BSS can provide or lend a device so delivery is not disrupted.', 'A loaner-device log: who, when, returned.', 'Spare-device inventory and replacement lead time'],
  ['Client system or platform downtime', 'To be confirmed. Service-impacting issues follow the Escalation Matrix.', 'Per-account downtime instructions: who to tell, what work can continue.', 'Client-system dependency inventory'],
  ['Device security baseline', 'System control: staff submit antivirus scans in the portal (AV Scan, monthly, with an audit trail).', 'Apply the same baseline to loaner devices.', 'Device inventory'],
]
const GOV_ROWS: [string, string, string][] = [
  ['Named plan owner', 'Assigned', 'Dhave Latimer, Director of Operations, is the accountable BCP owner (owner #1). Further owners can be added.'],
  ['Approver and approval date', 'To be assigned', 'The plan stays a draft until it is approved.'],
  ['Version control', 'Draft', 'Current version: Draft, Oct 8, 2026. A version number and change log are to be agreed.'],
  ['Review cadence', 'To be assigned', 'Set the next review date when the plan is approved.'],
  ['Staff awareness', 'Evidence to attach', 'Guidance on outages, severe weather and devices has been shared with staff (per the Director of Operations). Attach the written copy.'],
  ['Drills and scenario tests', 'No schedule recorded', 'No test schedule exists yet. Scenarios to run are listed below.'],
]
const SCENARIOS = ['Agent absence', 'Resignation or contractor removal', 'Internet or power outage', 'Device failure', 'Client platform downtime', 'Peak-volume surge']
const STATUS_DEFS: [string, string][] = [
  ['Existing', 'Active, standardized, owned, and backed by current evidence.'],
  ['Partial', 'Exists informally or inconsistently.'],
  ['Gap', 'Absent or insufficient.'],
  ['N/A', 'Does not apply, with a documented reason.'],
]
const REGISTER_FIELDS = ['Risk or control', 'Status', 'Evidence', 'Business or client impact', 'Current mitigation', 'Recommended action', 'Owner and approver', 'Priority and due date', 'Validation or closure']
const AREAS: { sec: string, title: string, lines: string[] }[] = [
  { sec: 'operations', title: 'Operations', lines: ['Attrition, capacity', 'Peak readiness', 'Business continuity', 'Escalations, errors'] },
  { sec: 'payroll', title: 'Payroll, finance', lines: ['Absences and leave', 'Replacement costs', 'Refund controls', 'Side work'] },
  { sec: 'hr', title: 'HR, workforce', lines: ['Attendance', 'Performance', 'Onboarding gaps', 'Early warning'] },
  { sec: 'security', title: 'Security, access', lines: ['Access approvals', 'Access removal', 'Device retrieval', 'Breach prevention'] },
  { sec: 'technology', title: 'Technology, work environment', lines: ['Internet and power outages', 'Severe weather', 'Device failure', 'Client system downtime'] },
]

const GAPS: { title: string, items: string }[] = [
  { title: 'Registers', items: 'Workforce, client and financial risk registers.' },
  { title: 'Standards', items: 'Adoption of AB-ESC-01 (eight decisions pending), capacity thresholds, a peak-readiness checklist and a standard access checklist.' },
  { title: 'Monitoring', items: 'Early-warning indicators, trend-based performance monitoring and recurring-risk analysis.' },
  { title: 'Testing and planning', items: 'Scenario-based BCP testing and predictive capacity planning.' },
  { title: 'Reviews', items: 'A formal access-risk review and standard RCA with action plans.' },
  { title: 'Technology and work environment', items: 'Written outage, severe-weather and device procedures; a loaner-device log; a spare-device inventory; per-account client-downtime instructions.' },
  { title: 'Governance', items: 'An approver, a review date, version control, and a drill schedule.' },
  { title: 'Business impact', items: 'A list of critical processes per account with recovery priorities and target recovery times.' },
]

const SECTION_NAMES: Record<string, string> = {
  operations: '1. Operations risks', payroll: '2. Payroll and financial-control risks', hr: '3. HR and workforce risks',
  security: '4. Security and access risks', technology: '5. Technology and work-environment disruption',
  continuity: '6. Continuity, issue management and escalation', impact: '7. Critical processes and recovery priorities',
  governance: '8. Plan ownership and governance', gaps: '9. Gaps to close',
}

// The overview diagram. Every box is a button that opens the section holding the
// instructions for that area (and highlights it).
function OverviewDiagram({ go }: { go: (sec: string) => void }) {
  const tile = 'text-left bg-white border border-gray-300 rounded-xl px-3 py-3 transition hover:border-blue-600 hover:ring-2 hover:ring-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer'
  const label = (t: string, sec: string) => ({ title: `Go to ${SECTION_NAMES[sec]}`, 'aria-label': `${t}: go to ${SECTION_NAMES[sec]}` })
  return (
    <div className="mt-2 space-y-2">
      <div className="mx-auto max-w-xs text-center bg-blue-50 border-2 border-blue-500 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900">AB BSS Risk Management Plan</div>
      <div className="mx-auto w-px h-3 bg-gray-300" />
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {AREAS.map(a => (
          <button key={a.sec} type="button" onClick={() => go(a.sec)} {...label(a.title, a.sec)} className={tile}>
            <span className="block text-sm font-semibold text-gray-900 text-center">{a.title}</span>
            {a.lines.map(l => <span key={l} className="block text-xs text-gray-600 text-center mt-0.5">{l}</span>)}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => go('continuity')} {...label('Shared by all five: workforce continuity, issue management, escalation', 'continuity')}
        className="w-full text-center bg-gray-100 border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-800 transition hover:border-blue-600 hover:ring-2 hover:ring-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer">
        Shared by all five: workforce continuity, issue management, escalation
      </button>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => go('impact')} {...label('Business impact and recovery priorities', 'impact')} className={tile}>
          <span className="block text-sm font-semibold text-gray-900 text-center">Business impact and recovery priorities</span>
          <span className="block text-xs text-gray-600 text-center mt-0.5">Critical processes per account</span>
        </button>
        <button type="button" onClick={() => go('governance')} {...label('Governance', 'governance')} className={tile}>
          <span className="block text-sm font-semibold text-gray-900 text-center">Governance</span>
          <span className="block text-xs text-gray-600 text-center mt-0.5">Owner, approval, review, drills</span>
        </button>
      </div>
    </div>
  )
}

// A "where the instructions sit" strip: each button opens the section (or the
// Escalation Matrix tab) that holds the steps to follow.
type Dest = { label: string, sec?: string, anchor?: string, escalation?: boolean }
function Related({ items, go, openEscalation }: { items: Dest[], go: (sec: string, anchor?: string) => void, openEscalation?: () => void }) {
  return (
    <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
      <p className="text-xs font-semibold text-blue-900 mb-1.5">Where the instructions sit</p>
      <div className="flex flex-wrap gap-2">
        {items.filter(i => !i.escalation || openEscalation).map(i => (
          <button key={i.label} type="button"
            onClick={() => (i.escalation ? openEscalation?.() : go(i.sec!, i.anchor))}
            className="text-xs bg-white border border-blue-200 text-blue-900 hover:bg-blue-100 px-2.5 py-1 rounded-full font-medium transition">
            {i.label} →
          </button>
        ))}
      </div>
    </div>
  )
}

function chip(status: string) {
  if (/^(assigned|in place)/i.test(status)) return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  if (/^(draft|evidence)/i.test(status)) return 'bg-amber-50 text-amber-800 border-amber-200'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}
function GovTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full min-w-[560px] text-xs border border-gray-200 rounded-lg overflow-hidden">
        <thead className="bg-blue-50"><tr>{['Control', 'Status', 'Notes'].map(h => <th key={h} className="text-left font-semibold text-blue-900 px-3 py-2 border-b border-gray-200">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r[0]} className="align-top border-b border-gray-100 last:border-0">
              <td className="px-3 py-2 font-medium text-gray-900 w-1/4">{r[0]}</td>
              <td className="px-3 py-2"><span className={`inline-block border rounded-full px-2 py-0.5 font-medium ${chip(r[1])}`}>{r[1]}</span></td>
              <td className="px-3 py-2 text-gray-700">{r[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RiskTable({ rows }: { rows: Row[] }) {
  const heads = ['Risk', 'Existing control', 'Standardization needed', 'Gap / future control']
  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full min-w-[640px] text-xs border border-gray-200 rounded-lg overflow-hidden">
        <thead className="bg-blue-50">
          <tr>{heads.map(h => <th key={h} className="text-left font-semibold text-blue-900 px-3 py-2 border-b border-gray-200">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="align-top border-b border-gray-100 last:border-0">
              <td className="px-3 py-2 font-medium text-gray-900 w-1/4">{r[0]}</td>
              <td className="px-3 py-2 text-gray-700">{r[1]}</td>
              <td className="px-3 py-2 text-gray-700">{r[2]}</td>
              <td className="px-3 py-2 text-gray-700">{r[3]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Figure({ src, alt }: { src: string, alt: string }) {
  return <img src={src} alt={alt} className="w-full rounded-lg border border-gray-100 mt-3" />
}

function Note({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800"><span className="font-semibold">{title} </span>{children}</p>
    </div>
  )
}

function Section({ id, title, open, flash, onToggle, onBack, children }: { id: string, title: string, open: boolean, flash: boolean, onToggle: (id: string) => void, onBack: () => void, children: React.ReactNode }) {
  return (
    <div id={`risk-${id}`} className={`scroll-mt-20 bg-white border rounded-xl overflow-hidden transition ${flash ? 'border-blue-400 ring-2 ring-blue-300' : 'border-gray-200'}`}>
      <button onClick={() => onToggle(id)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition">
        <span className="text-sm font-semibold text-blue-900">{title}</span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 text-sm text-gray-800 space-y-2">
          {children}
          {id !== 'overview' && <button type="button" onClick={onBack} className="mt-2 text-xs text-blue-600 hover:underline block">↑ Back to the diagram</button>}
        </div>
      )}
    </div>
  )
}

export default function RiskManagementPlan({ onOpenEscalation }: { onOpenEscalation?: () => void }) {
  const [expanded, setExpanded] = useState<string | null>('overview')
  const [flash, setFlash] = useState<string | null>(null)
  const toggle = (id: string) => setExpanded(cur => (cur === id ? null : id))
  // Opens a section (and scrolls to a sub-heading inside it, if given), with a
  // brief highlight so it's obvious where you landed.
  function goTo(sec: string, anchor?: string) {
    const target = `risk-${anchor || sec}`
    setExpanded(sec)
    setFlash(target)
    setTimeout(() => document.getElementById(target)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 80)
    setTimeout(() => setFlash(f => (f === target ? null : f)), 1800)
  }
  const S = (id: string, title: string, children: React.ReactNode) => (
    <Section id={id} title={title} open={expanded === id} flash={flash === `risk-${id}`} onToggle={toggle} onBack={() => goTo('overview')}>{children}</Section>
  )
  const Sub = ({ id, children }: { id: string, children: React.ReactNode }) => (
    <p id={`risk-${id}`} className={`scroll-mt-20 text-xs font-semibold text-blue-900 uppercase tracking-wide pt-3 px-1 rounded transition ${flash === `risk-${id}` ? 'bg-blue-100' : ''}`}>{children}</p>
  )

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">Draft — pending approval</p>
          <p className="text-xs text-amber-700 mt-0.5">AB BSS Risk Management Plan, Oct 8, 2026, prepared by Dhave Latimer, who is the accountable plan owner (owner #1). It sits inside the wider AB Operations Framework prepared for the CEO's infrastructure review. Owners and due dates for the gaps below are not yet assigned.</p>
        </div>
      </div>

      {S('overview', '🗺️ Overview — Five risk areas, three shared processes', <>
        <p>This plan sets out how AB BSS identifies, controls and escalates operational, payroll-related, HR, security, technology and financial risks. It is built from controls already agreed and in use, not a generic register. For each area it records the existing control, what needs standardizing, and the gap to close.</p>
        <p className="text-xs text-gray-500 pt-1">Click a box on the diagram to jump to the instructions for that area.</p>
        <OverviewDiagram go={goTo} />
        <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide pt-2">The review it supports asks four questions</p>
        <ul className="list-disc pl-5 text-sm space-y-1">
          <li>What do we already have and actually use?</li>
          <li>What exists but needs standardization or improvement?</li>
          <li>What are we missing that a mature BPO should have?</li>
          <li>What proactive controls should we introduce for larger or more sophisticated clients?</li>
        </ul>
      </>)}

      {S('operations', '1. Operations risks', <>
        <p>Operational risk centers on losing capacity or service quality faster than coverage can be replaced. Several staffing gaps in the earlier capacity analysis were episodic, not structural, so the default mitigation is flex coverage, cross-training or temporary capacity, not another permanent FTE.</p>
        <RiskTable rows={OPERATIONS} />
        <Related go={goTo} openEscalation={onOpenEscalation} items={[
          { label: 'Escalation Matrix (AB-ESC-01)', escalation: true },
          { label: 'Workforce continuity steps', sec: 'continuity', anchor: 'continuity-workforce' },
          { label: 'Issue management steps', sec: 'continuity', anchor: 'continuity-issue' },
        ]} />
        <p className="text-xs text-gray-600 pt-2">Capacity planning looks at staffing versus actual workload, historical volume, FTE requirements, seasonal fluctuation, absence-related gaps, cross-training, replacement lead time and recovery operations.</p>
      </>)}

      {S('payroll', '2. Payroll and financial-control risks', <>
        <p>Payroll exposure comes from attendance and absence events, replacement costs and refund handling. The controls below tie each risk to the evidence payroll needs.</p>
        <RiskTable rows={PAYROLL} />
        <Related go={goTo} openEscalation={onOpenEscalation} items={[
          { label: 'Urgent leave fallback (escalation levels)', sec: 'continuity', anchor: 'continuity-escalation' },
          { label: 'Escalation Matrix (AB-ESC-01)', escalation: true },
          { label: 'Issue management steps', sec: 'continuity', anchor: 'continuity-issue' },
        ]} />
        <Note title="Open question:">Which payroll policy or cycle should this section follow (for example cut-off dates, absence deductions, contractor payment terms)? Once confirmed, the table can be aligned to it.</Note>
      </>)}

      {S('hr', '3. HR and workforce risks', <>
        <p>The aim is to act on warning signs before someone resigns or causes a client-impacting failure. Six signals feed an early-warning approach, and any of them can trigger coaching, support, monitoring and contingency planning:</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {HR_SIGNALS.map(s => <span key={s} className="text-xs bg-blue-50 text-blue-900 border border-blue-100 px-2.5 py-1 rounded-full font-medium">{s}</span>)}
        </div>
        <RiskTable rows={HR} />
        <Related go={goTo} openEscalation={onOpenEscalation} items={[
          { label: 'Workforce continuity steps', sec: 'continuity', anchor: 'continuity-workforce' },
          { label: 'Escalation Matrix (AB-ESC-01)', escalation: true },
          { label: 'Issue management steps', sec: 'continuity', anchor: 'continuity-issue' },
        ]} />
        <p className="text-xs text-gray-600 pt-2">Urgent leave or leave extensions need prior approval except in genuine emergencies. When the Team Lead is unavailable, the employee contacts another available team member or their immediate superior so the situation can be documented and assessed.</p>
      </>)}

      {S('security', '4. Security and access risks', <>
        <p>The main exposure is data breach through unmanaged access or unreturned devices, especially when a contractor becomes unresponsive or the relationship ends.</p>
        <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide pt-2">Existing controls</p>
        <ul className="list-disc pl-5 text-sm space-y-1">{SECURITY_CONTROLS.map(c => <li key={c}>{c}</li>)}</ul>
        <p className="pt-2"><span className="font-semibold">Standardization needed:</span> a standard access checklist. <span className="font-semibold">Gap to close:</span> a formal access-risk review.</p>
        <Related go={goTo} openEscalation={onOpenEscalation} items={[
          { label: 'Escalation Matrix (AB-ESC-01): data exposure goes straight to the Director or CEO', escalation: true },
          { label: 'Escalation levels', sec: 'continuity', anchor: 'continuity-escalation' },
          { label: 'Workforce continuity steps', sec: 'continuity', anchor: 'continuity-workforce' },
        ]} />
      </>)}

      {S('technology', '5. Technology and work-environment disruption', <>
        <p>An internet or power outage, severe weather, or a broken device can stop service. The aim is that nobody goes dark without AB BSS knowing, and that delivery continues through a backup connection, an arranged place to work, or a loaned device.</p>
        <RiskTable rows={TECHNOLOGY} />
        <div className="mt-3 bg-white border border-gray-200 rounded-lg px-3 py-2.5">
          <p className="text-xs font-semibold text-blue-900 mb-1">Controls already enforced in the portal</p>
          <p className="text-xs text-gray-700">The Go-Live Readiness checklist (Client Onboarding, section D, Hardware and Security) requires for every new account: <span className="font-medium">devices issued and configured</span>, <span className="font-medium">security baseline met</span>, and <span className="font-medium">connectivity and power continuity</span> (backup internet and power, or an agreed work-from-home contingency). Connectivity and power continuity is a Critical item.</p>
        </div>
        <Note title="Evidence to attach:">The guidance on outages, severe weather and devices has been given to staff, but the written copy is not attached to this plan yet. Attach it so these rows can show evidence instead of a stated practice.</Note>
        <Related go={goTo} openEscalation={onOpenEscalation} items={[
          { label: 'Escalation Matrix (AB-ESC-01)', escalation: true },
          { label: 'Workforce continuity steps', sec: 'continuity', anchor: 'continuity-workforce' },
          { label: 'Issue management steps', sec: 'continuity', anchor: 'continuity-issue' },
        ]} />
      </>)}

      {S('continuity', '6. Continuity, issue management and escalation', <>
        <p>Three standard processes run through every category above.</p>

        <Sub id="continuity-workforce">Workforce continuity</Sub>
        <p>Applies to attrition, sudden absence, contractor removal and staffing gaps: identify the operational impact, mitigate through redistribution or available coverage, replace (begin recruitment), train the replacement, validate that the replacement can perform independently, then transition the workload without compromising client service.</p>
        <Figure src="/risk-plan/workforce-continuity.png" alt="Workforce continuity flow: Identify, Mitigate, Replace, Train, Validate, Transition" />
        <p className="text-xs text-gray-600">Validation is the gate: the workload only moves once the replacement can perform independently. AB BSS may absorb recruitment, onboarding, training and knowledge-transfer costs until then.</p>

        <Sub id="continuity-issue">Issue management</Sub>
        <p>Keeps issues from being logged without resolution: Issue → RCA → Corrective Action → Owner → Due Date → Follow-up → Closure.</p>
        <Figure src="/risk-plan/issue-management.png" alt="Issue management flow: Issue, RCA, Corrective Action, Owner, Due Date, Follow-up, Closure" />
        <p className="text-xs text-gray-600">RCA is root cause analysis. Every issue passes through it, so documenting a problem always ends in an accountable fix.</p>

        <Sub id="continuity-escalation">Escalation</Sub>
        <p>Follows AB-ESC-01 (draft v0.1): four levels, Team Lead → Account Manager / Program Manager → Director of Operations → CEO. Track A rates client impact (S1 to S4) and sets the level. Track B handles the people side (B1 to B4). Anyone may go straight to the Director or CEO for suspected fraud, data exposure or an ethics concern.</p>
        <Figure src="/risk-plan/escalation-hierarchy.png" alt="Escalation hierarchy from Team Lead to CEO, with skip-level route and Team Lead unavailable fallback" />
        {onOpenEscalation && (
          <button type="button" onClick={onOpenEscalation} className="mt-3 text-xs bg-blue-900 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800 transition">Open the full Escalation Matrix (AB-ESC-01) →</button>
        )}
        <Note title="To confirm:">Urgent leave or leave extensions need prior approval except in genuine emergencies; the dashed box shows the fallback so the situation is still documented and assessed. These two rules are not yet in AB-ESC-01. Decide whether they move into the matrix or stay in this plan.</Note>
      </>)}

      {S('impact', '7. Critical processes and recovery priorities', <>
        <p>For each account, list the processes that must not stop, what happens if they do, how quickly they must be back, and who covers meanwhile. This is the basis for deciding what to recover first. It is not filled in yet.</p>
        <div className="overflow-x-auto mt-3">
          <table className="w-full min-w-[640px] text-xs border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-blue-50"><tr>{['Account', 'Critical process', 'Impact if it stops', 'Recovery priority and target time', 'Fallback or backup', 'Owner'].map(h => <th key={h} className="text-left font-semibold text-blue-900 px-3 py-2 border-b border-gray-200">{h}</th>)}</tr></thead>
            <tbody><tr>{Array.from({ length: 6 }).map((_, i) => <td key={i} className="px-3 py-3 text-gray-400 italic">{i === 0 ? 'To be completed per account' : '—'}</td>)}</tr></tbody>
          </table>
        </div>
        <p className="text-xs text-gray-600 pt-2">A recovery time target is enough here. Because AB BSS works inside client systems, a separate data-recovery-point target is not needed.</p>
      </>)}

      {S('governance', '8. Plan ownership and governance', <>
        <p>Who owns this plan, how it is approved and versioned, and how it is kept alive.</p>
        <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
          <p className="text-xs font-semibold text-blue-900">Plan owners</p>
          <p className="text-sm text-gray-900 mt-0.5"><span className="font-semibold">1. Dhave Latimer</span>, Director of Operations (accountable BCP owner)</p>
        </div>
        <GovTable rows={GOV_ROWS} />
        <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide pt-3">Scenarios to test</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {SCENARIOS.map(sc => <span key={sc} className="text-xs bg-blue-50 text-blue-900 border border-blue-100 px-2.5 py-1 rounded-full font-medium">{sc}</span>)}
        </div>
        <p className="text-xs text-gray-600 pt-2">Each test should record what was tested, who took part, the result, where it failed, and the corrective actions.</p>
      </>)}

      {S('gaps', '9. Gaps to close', <>
        <p>The plan's next step is to turn the future controls above into registers, with an owner and due date for each. Owners and dates are not yet assigned.</p>
        <div className="grid sm:grid-cols-2 gap-3 pt-2">
          {GAPS.map(g => (
            <div key={g.title} className="border border-gray-200 rounded-lg px-3 py-2.5">
              <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">{g.title}</p>
              <p className="text-sm text-gray-700 mt-1">{g.items}</p>
            </div>
          ))}
        </div>
        <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide pt-4">How each gap will be tracked</p>
        <p className="text-xs text-gray-600">Each risk or control gets one register entry with these fields. Nothing is marked Existing on the strength of a discussion or intention; it needs current evidence.</p>
        <div className="grid sm:grid-cols-2 gap-2 pt-2">
          {STATUS_DEFS.map(([k, v]) => (
            <div key={k} className="border border-gray-200 rounded-lg px-3 py-2"><span className="text-xs font-semibold text-blue-900">{k}</span><span className="text-xs text-gray-700"> — {v}</span></div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-3">
          {REGISTER_FIELDS.map(f => <span key={f} className="text-xs bg-gray-50 text-gray-800 border border-gray-200 px-2.5 py-1 rounded-full">{f}</span>)}
        </div>
      </>)}
    </div>
  )
}
