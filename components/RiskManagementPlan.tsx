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
const GAPS: { title: string, items: string }[] = [
  { title: 'Registers', items: 'Workforce, client and financial risk registers.' },
  { title: 'Standards', items: 'Adoption of AB-ESC-01 (eight decisions pending), capacity thresholds, a peak-readiness checklist and a standard access checklist.' },
  { title: 'Monitoring', items: 'Early-warning indicators, trend-based performance monitoring and recurring-risk analysis.' },
  { title: 'Testing and planning', items: 'Scenario-based BCP testing and predictive capacity planning.' },
  { title: 'Reviews', items: 'A formal access-risk review and standard RCA with action plans.' },
]

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

function Section({ id, title, open, onToggle, children }: { id: string, title: string, open: boolean, onToggle: (id: string) => void, children: React.ReactNode }) {
  return (
    <div id={`risk-${id}`} className="scroll-mt-20 bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={() => onToggle(id)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition">
        <span className="text-sm font-semibold text-blue-900">{title}</span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-gray-100 text-sm text-gray-800 space-y-2">{children}</div>}
    </div>
  )
}

export default function RiskManagementPlan() {
  const [expanded, setExpanded] = useState<string | null>('overview')
  const toggle = (id: string) => setExpanded(cur => (cur === id ? null : id))
  const S = (id: string, title: string, children: React.ReactNode) => (
    <Section id={id} title={title} open={expanded === id} onToggle={toggle}>{children}</Section>
  )

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">Draft — pending approval</p>
          <p className="text-xs text-amber-700 mt-0.5">AB BSS Risk Management Plan, Oct 8, 2026, prepared by Dhave Latimer. It sits inside the wider AB Operations Framework prepared for the CEO's infrastructure review. Owners and due dates for the gaps below are not yet assigned.</p>
        </div>
      </div>

      {S('overview', '🗺️ Overview — Four risk areas, three shared processes', <>
        <p>This plan sets out how AB BSS identifies, controls and escalates operational, payroll-related, HR, security and financial risks. It is built from controls already agreed and in use, not a generic register. For each area it records the existing control, what needs standardizing, and the gap to close.</p>
        <Figure src="/risk-plan/overview.png" alt="Four risk areas (Operations, Payroll and finance, HR and workforce, Security and access) share one set of continuity, issue and escalation processes" />
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
        <p className="text-xs text-gray-600 pt-2">Capacity planning looks at staffing versus actual workload, historical volume, FTE requirements, seasonal fluctuation, absence-related gaps, cross-training, replacement lead time and recovery operations.</p>
      </>)}

      {S('payroll', '2. Payroll and financial-control risks', <>
        <p>Payroll exposure comes from attendance and absence events, replacement costs and refund handling. The controls below tie each risk to the evidence payroll needs.</p>
        <RiskTable rows={PAYROLL} />
        <Note title="Open question:">Which payroll policy or cycle should this section follow (for example cut-off dates, absence deductions, contractor payment terms)? Once confirmed, the table can be aligned to it.</Note>
      </>)}

      {S('hr', '3. HR and workforce risks', <>
        <p>The aim is to act on warning signs before someone resigns or causes a client-impacting failure. Six signals feed an early-warning approach, and any of them can trigger coaching, support, monitoring and contingency planning:</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {HR_SIGNALS.map(s => <span key={s} className="text-xs bg-blue-50 text-blue-900 border border-blue-100 px-2.5 py-1 rounded-full font-medium">{s}</span>)}
        </div>
        <RiskTable rows={HR} />
        <p className="text-xs text-gray-600 pt-2">Urgent leave or leave extensions need prior approval except in genuine emergencies. When the Team Lead is unavailable, the employee contacts another available team member or their immediate superior so the situation can be documented and assessed.</p>
      </>)}

      {S('security', '4. Security and access risks', <>
        <p>The main exposure is data breach through unmanaged access or unreturned devices, especially when a contractor becomes unresponsive or the relationship ends.</p>
        <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide pt-2">Existing controls</p>
        <ul className="list-disc pl-5 text-sm space-y-1">{SECURITY_CONTROLS.map(c => <li key={c}>{c}</li>)}</ul>
        <p className="pt-2"><span className="font-semibold">Standardization needed:</span> a standard access checklist. <span className="font-semibold">Gap to close:</span> a formal access-risk review.</p>
      </>)}

      {S('continuity', '5. Continuity, issue management and escalation', <>
        <p>Three standard processes run through every category above.</p>

        <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide pt-2">Workforce continuity</p>
        <p>Applies to attrition, sudden absence, contractor removal and staffing gaps: identify the operational impact, mitigate through redistribution or available coverage, replace (begin recruitment), train the replacement, validate that the replacement can perform independently, then transition the workload without compromising client service.</p>
        <Figure src="/risk-plan/workforce-continuity.png" alt="Workforce continuity flow: Identify, Mitigate, Replace, Train, Validate, Transition" />
        <p className="text-xs text-gray-600">Validation is the gate: the workload only moves once the replacement can perform independently. AB BSS may absorb recruitment, onboarding, training and knowledge-transfer costs until then.</p>

        <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide pt-3">Issue management</p>
        <p>Keeps issues from being logged without resolution: Issue → RCA → Corrective Action → Owner → Due Date → Follow-up → Closure.</p>
        <Figure src="/risk-plan/issue-management.png" alt="Issue management flow: Issue, RCA, Corrective Action, Owner, Due Date, Follow-up, Closure" />
        <p className="text-xs text-gray-600">RCA is root cause analysis. Every issue passes through it, so documenting a problem always ends in an accountable fix.</p>

        <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide pt-3">Escalation</p>
        <p>Follows AB-ESC-01 (draft v0.1): four levels, Team Lead → Account Manager / Program Manager → Director of Operations → CEO. Track A rates client impact (S1 to S4) and sets the level. Track B handles the people side (B1 to B4). Anyone may go straight to the Director or CEO for suspected fraud, data exposure or an ethics concern.</p>
        <Figure src="/risk-plan/escalation-hierarchy.png" alt="Escalation hierarchy from Team Lead to CEO, with skip-level route and Team Lead unavailable fallback" />
        <Note title="To confirm:">Urgent leave or leave extensions need prior approval except in genuine emergencies; the dashed box shows the fallback so the situation is still documented and assessed. These two rules are not yet in AB-ESC-01. Decide whether they move into the matrix or stay in this plan.</Note>
      </>)}

      {S('gaps', '6. Gaps to close', <>
        <p>The plan's next step is to turn the future controls above into registers, with an owner and due date for each. Owners and dates are not yet assigned.</p>
        <div className="grid sm:grid-cols-2 gap-3 pt-2">
          {GAPS.map(g => (
            <div key={g.title} className="border border-gray-200 rounded-lg px-3 py-2.5">
              <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">{g.title}</p>
              <p className="text-sm text-gray-700 mt-1">{g.items}</p>
            </div>
          ))}
        </div>
      </>)}
    </div>
  )
}
