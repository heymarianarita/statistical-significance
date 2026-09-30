import { useState, type ReactNode } from 'react'
import { Badge, Box, Card, Cell, Input, List, SelectNative, Stack, StackItem, Tabs, Text } from '@vinted/web-ui'
import { IntervalChart, LineChart } from './charts'
import { clampRate, fmt, invNorm, nCompare, nEstimate, normCdf, nRare, pct, wilson, zFor } from './stats'

type Mode = 'estimate' | 'compare' | 'rare' | 'check'

const TABS: { id: Mode; title: string; question: string }[] = [
  { id: 'estimate', title: 'Pass rate', question: 'Measure how often one setup (model, prompt and design-system context) produces a passing prototype.' },
  { id: 'compare', title: 'A vs B', question: 'Compare two setups, such as the current prompt against a new one, or with and without design-system context.' },
  { id: 'rare', title: 'Rare failures', question: 'Show that a setup fails less often than a threshold, such as "breaks the layout in under 5% of runs".' },
  { id: 'check', title: 'Check results', question: 'Already ran the tests? Enter the counts to see whether the result holds up. Leave B empty to check one setup.' },
]

const CONFIDENCE = [
  { value: '0.90', label: '90%' },
  { value: '0.95', label: '95%' },
  { value: '0.99', label: '99%' },
]
const POWER = [
  { value: '0.80', label: '80% (standard)' },
  { value: '0.90', label: '90%' },
]

const NOTES = [
  { title: 'Fix the scoring rubric first', body: 'Decide what "pass" means (renders, uses the right components, matches the brief) before you look at any output, and score every run the same way.' },
  { title: 'Each run is one fresh generation', body: "Don't regenerate until you like the result, and don't count retries of the same run separately." },
  { title: 'Spread runs across a set of briefs', body: 'Running one prompt 80 times only tells you about that prompt. Rotate through 10–20 representative briefs.' },
  { title: 'Give A and B the same briefs', body: 'Running both setups on each brief is fairer, and usually needs fewer runs than this calculator shows.' },
  { title: 'Pick the number up front and stop there', body: 'Checking after every few runs and stopping when it looks significant makes false positives more likely.' },
]

const DEFAULTS: Record<string, string> = {
  eP: '70', eM: '10', eC: '0.95',
  cP1: '60', cP2: '80', cC: '0.95', cW: '0.80',
  rX: '5', rC: '0.95',
  kAs: '42', kAn: '60', kBs: '53', kBn: '60', kC: '0.95',
}

type Fields = typeof DEFAULTS
type Result = { errors: Partial<Record<keyof Fields, string>>; body?: ReactNode }

function Figure({ value, unit, badge }: { value: string; unit?: string; badge?: ReactNode }) {
  return (
    <Stack wrap alignment="center" gap="space-300">
      <Text as="span" type="heading-xxl" theme="primary" text={value} />
      {unit && <Text as="span" type="body" theme="muted" text={unit} />}
      {badge}
    </Stack>
  )
}

function Details({ items }: { items: [string, string][] }) {
  return (
    <Stack wrap gap="space-200">
      {items.map(([k, v]) => (
        <StackItem key={k} flex="1 1 140px">
          <Box theme="background-passive-neutral-subtle-low" border="none" padding="space-300">
            <Stack direction="column" gap="space-100">
              <Text as="span" type="caption" theme="muted" text={k} />
              <Text as="span" type="title" text={v} />
            </Stack>
          </Box>
        </StackItem>
      ))}
    </Stack>
  )
}

function Chart({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack direction="column" gap="space-200" fillEqually>
      <Text as="p" type="caption" theme="muted" text={title} />
      <div>{children}</div>
    </Stack>
  )
}

const Formula = ({ text }: { text: string }) => <Text as="p" type="caption" theme="muted" text={text} />

function compute(mode: Mode, v: Fields): Result {
  const n = (k: keyof Fields) => parseFloat(v[k])

  if (mode === 'estimate') {
    const p = n('eP') / 100, E = n('eM') / 100, conf = n('eC'), z = zFor(conf)
    const errors: Result['errors'] = {}
    if (!(p > 0 && p < 1)) errors.eP = 'Enter a pass rate between 1 and 99%.'
    if (!(E > 0 && E < 0.5)) errors.eM = 'Enter a margin between 1 and 49 points.'
    if (Object.keys(errors).length) return { errors }
    const runs = nEstimate(p, E, z)
    return {
      errors,
      body: <>
        <Figure value={fmt(runs)} unit="test runs" />
        <Text as="p" type="body" text={`Run ${fmt(runs)} generations. If about ${pct(p)} pass, you'll know the true pass rate to within ±${Math.round(E * 100)} points (${pct(Math.max(0, p - E))}–${pct(Math.min(1, p + E))}) with ${pct(conf)} confidence.`} />
        <Details items={[['Confidence', pct(conf)], ['z-score', z.toFixed(3)], ['Halve the margin', `${fmt(nEstimate(p, E / 2, z))} runs`]]} />
        <Formula text={`n = z² × p(1 − p) ÷ E² = ${z.toFixed(2)}² × ${p.toFixed(2)} × ${(1 - p).toFixed(2)} ÷ ${E.toFixed(2)}²`} />
        <Chart title="Tighter margins cost many more runs">
          <LineChart f={e => nEstimate(p, e, z)} xmin={0.03} xmax={0.25} xcur={E} ycur={runs}
            xfmt={x => `±${Math.round(x * 100)}`} xTitle="Margin of error (points)" yTitle="Runs needed" label="Runs needed by margin of error" />
        </Chart>
      </>,
    }
  }

  if (mode === 'compare') {
    const p1 = n('cP1') / 100, p2 = n('cP2') / 100, conf = n('cC'), power = n('cW')
    const errors: Result['errors'] = {}
    if (!(p1 > 0 && p1 < 1)) errors.cP1 = 'Enter a rate between 1 and 99%.'
    if (!(p2 > 0 && p2 < 1)) errors.cP2 = 'Enter a rate between 1 and 99%.'
    else if (p1 === p2) errors.cP2 = "Set B to the smallest improvement you'd care about. It can't equal A."
    if (Object.keys(errors).length) return { errors }
    const za = zFor(conf), zb = invNorm(power), runs = nCompare(p1, p2, za, zb)
    const dir = p2 > p1 ? 1 : -1, diff = Math.abs(p2 - p1)
    const maxD = Math.min(0.45, dir > 0 ? 0.99 - p1 : p1 - 0.01)
    const sign = dir > 0 ? '+' : '−'
    return {
      errors,
      body: <>
        <Figure value={fmt(runs)} unit={`runs per setup · ${fmt(runs * 2)} total`} />
        <Text as="p" type="body" text={`Run ${fmt(runs)} generations with A and ${fmt(runs)} with B. If B truly passes ${pct(p2)} against A's ${pct(p1)}, you have a ${pct(power)} chance of getting a result that's significant at ${pct(conf)} confidence.`} />
        <Details items={[['Difference', `${sign}${Math.round(diff * 100)} pts`], ['Confidence', pct(conf)], ['Power', pct(power)], ['At 90% power', `${fmt(nCompare(p1, p2, za, invNorm(0.9)))} / setup`]]} />
        <Formula text={`n = [z(α/2)·√(2p̄q̄) + z(β)·√(p₁q₁ + p₂q₂)]² ÷ (p₁ − p₂)², with z(α/2) = ${za.toFixed(2)}, z(β) = ${zb.toFixed(2)}`} />
        {maxD > 0.03 && (
          <Chart title="Smaller improvements need far more runs to detect">
            <LineChart f={d => nCompare(p1, p1 + dir * d, za, zb)} xmin={0.03} xmax={maxD} xcur={diff} ycur={runs}
              xfmt={x => `${sign}${Math.round(x * 100)}`} xTitle="Difference between A and B (points)" yTitle="Runs per setup" label="Runs per setup by size of difference" />
          </Chart>
        )}
      </>,
    }
  }

  if (mode === 'rare') {
    const x = n('rX') / 100, conf = n('rC')
    if (!(x > 0 && x < 1)) return { errors: { rX: 'Enter a failure rate between 0.5 and 50%.' } }
    const runs = nRare(x, conf)
    return {
      errors: {},
      body: <>
        <Figure value={fmt(runs)} unit="runs in a row, zero failures" />
        <Text as="p" type="body" text={`If ${fmt(runs)} generations in a row all pass, you can say with ${pct(conf)} confidence that the failure rate is below ${pct(x, x < 0.1 ? 1 : 0)}. If any run fails, this no longer holds. Use the Pass rate tab to measure the rate instead.`} />
        <Details items={[['Rule of three', `≈ ${fmt(Math.ceil(3 / x))} runs`], ['Confidence', pct(conf)], ['Half the threshold', `${fmt(nRare(x / 2, conf))} runs`]]} />
        <Formula text={`n = ln(1 − confidence) ÷ ln(1 − max failure rate) = ln(${(1 - conf).toFixed(2)}) ÷ ln(${(1 - x).toFixed(3)})`} />
        <Chart title="Proving a lower failure rate takes more clean runs">
          <LineChart f={r => nRare(r, conf)} xmin={0.01} xmax={0.2} xcur={x} ycur={runs}
            xfmt={r => `${Math.round(r * 100)}%`} xTitle="Highest acceptable failure rate" yTitle="Clean runs needed" label="Clean runs needed by failure threshold" />
        </Chart>
      </>,
    }
  }

  // check
  const as = n('kAs'), an = n('kAn'), bs = n('kBs'), bn = n('kBn'), conf = n('kC'), z = zFor(conf)
  const errors: Result['errors'] = {}
  if (!(an >= 1)) errors.kAn = 'Enter at least 1 run.'
  if (!(as >= 0 && as <= an)) errors.kAs = "Can't be more than the number of runs."
  const hasB = v.kBs.trim() !== '' || v.kBn.trim() !== ''
  if (hasB) {
    if (!(bn >= 1)) errors.kBn = 'Enter at least 1 run, or clear both B fields.'
    if (!(bs >= 0 && bs <= bn)) errors.kBs = "Can't be more than the number of runs."
  }
  if (Object.keys(errors).length) return { errors }

  const pA = as / an
  const [aLo, aHi] = wilson(as, an, z)
  if (!hasB) {
    return {
      errors,
      body: <>
        <Figure value={pct(pA)} unit={`pass rate from ${fmt(an)} runs`} />
        <Text as="p" type="body" text={`The true pass rate is likely between ${pct(aLo)} and ${pct(aHi)} (${pct(conf)} confidence). To narrow that to ±5 points, you'd need about ${fmt(nEstimate(clampRate(pA), 0.05, z))} runs.`} />
        <Details items={[['Passed', `${fmt(as)} / ${fmt(an)}`], ['Low end', pct(aLo, 1)], ['High end', pct(aHi, 1)]]} />
        <Chart title="Observed pass rate, with the range the true rate likely falls in">
          <IntervalChart rows={[{ label: 'Setup A', p: pA, lo: aLo, hi: aHi }]} />
        </Chart>
      </>,
    }
  }

  const pB = bs / bn
  const [bLo, bHi] = wilson(bs, bn, z)
  const pp = (as + bs) / (an + bn)
  const se = Math.sqrt(pp * (1 - pp) * (1 / an + 1 / bn))
  const zs = se > 0 ? (pB - pA) / se : 0
  const pval = 2 * (1 - normCdf(Math.abs(zs)))
  const sig = pval < 1 - conf
  const se2 = Math.sqrt((pA * (1 - pA)) / an + (pB * (1 - pB)) / bn)
  const dLo = pB - pA - z * se2, dHi = pB - pA + z * se2
  const need = pA !== pB ? nCompare(clampRate(pA), clampRate(pB), z, invNorm(0.8)) : null
  const pvTxt = pval < 0.001 ? '< 0.001' : pval.toFixed(3)
  const signed = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}`
  return {
    errors,
    body: <>
      <Figure value={`p = ${pvTxt}`} badge={<Badge theme={sig ? 'success' : 'warning'} styling="light" content={sig ? 'Significant' : 'Not significant yet'} />} />
      <Text as="p" type="body" text={sig
        ? `B's ${pct(pB)} against A's ${pct(pA)} is a real difference at ${pct(conf)} confidence. The true gap is likely between ${signed(dLo)} and ${signed(dHi)} points.`
        : `The gap between A (${pct(pA)}) and B (${pct(pB)}) could still be chance at ${pct(conf)} confidence.${need ? ` To reliably detect a gap this size, plan for about ${fmt(need)} runs per setup.` : ''}`} />
      <Details items={[['A passed', `${fmt(as)} / ${fmt(an)}`], ['B passed', `${fmt(bs)} / ${fmt(bn)}`], ['Difference', `${signed(pB - pA)} pts`], ['Needed at 80% power', need ? `${fmt(need)} / setup` : '—']]} />
      <Formula text={`Two-proportion z-test: z = ${zs.toFixed(2)}, two-sided p = ${pvTxt}, threshold ${(1 - conf).toFixed(2)}`} />
      <Chart title="Observed pass rate, with the range the true rate likely falls in">
        <IntervalChart rows={[{ label: 'Setup A', p: pA, lo: aLo, hi: aHi }, { label: 'Setup B', p: pB, lo: bLo, hi: bHi }]} />
      </Chart>
    </>,
  }
}

export function App() {
  const [mode, setMode] = useState<Mode>('estimate')
  const [v, setV] = useState<Fields>(DEFAULTS)
  const set = (k: keyof Fields) => (e: { target: { value: string } }) => setV(prev => ({ ...prev, [k]: e.target.value }))
  const { errors, body } = compute(mode, v)
  const tab = TABS.find(t => t.id === mode)!

  const num = (k: keyof Fields, label: string, opts: { suffix?: string; helperText?: string; step?: string } = {}) => (
    <Input key={k} id={k} name={k} type="number" inputMode="decimal" label={label} value={v[k]} onChange={set(k)}
      step={opts.step} suffix={opts.suffix} helperText={opts.helperText} validation={errors[k]} />
  )
  const select = (k: keyof Fields, label: string, options: typeof CONFIDENCE, helperText?: string) => (
    <SelectNative key={k} id={k} name={k} label={label} options={options} value={v[k]} onChange={set(k)} helperText={helperText} />
  )
  const pair = (a: ReactNode, b: ReactNode) => (
    <Stack gap="space-300" fillEqually>{a}{b}</Stack>
  )

  const inputs: Record<Mode, ReactNode> = {
    estimate: <>
      {num('eP', 'Expected pass rate', { suffix: '%', helperText: 'Your best guess. Unsure? Use 50%, which gives the safest number.' })}
      {num('eM', 'Margin of error', { suffix: 'pts', helperText: '±10 means a 70% pass rate is truly between 60% and 80%.' })}
      {select('eC', 'Confidence level', CONFIDENCE)}
    </>,
    compare: <>
      {pair(num('cP1', 'A pass rate', { suffix: '%' }), num('cP2', 'B pass rate', { suffix: '%' }))}
      <Text as="p" type="caption" theme="muted" text="A is today's rate. B is the smallest improvement you'd care about detecting." />
      {select('cC', 'Confidence level', CONFIDENCE)}
      {select('cW', 'Power', POWER, "The chance of spotting the difference if it's real.")}
    </>,
    rare: <>
      {num('rX', 'Highest acceptable failure rate', { suffix: '%', step: '0.5' })}
      {select('rC', 'Confidence level', CONFIDENCE)}
    </>,
    check: <>
      <Text as="h3" type="subtitle" text="Setup A" />
      {pair(num('kAs', 'Passed'), num('kAn', 'Runs'))}
      <Text as="h3" type="subtitle" text="Setup B (optional)" />
      {pair(num('kBs', 'Passed'), num('kBn', 'Runs'))}
      {select('kC', 'Confidence level', CONFIDENCE)}
    </>,
  }

  return (
    <main className="page">
      <Stack direction="column" gap="space-600" fillEqually>
        <Stack direction="column" gap="space-200">
          <Text as="h1" type="heading-xl" text="Prototype Test Planner" />
          <Text as="p" type="body" theme="muted" text="Work out how many AI prototype generations to run before you trust the result. Score each generation pass or fail against a fixed rubric, then pick the question you're trying to answer." />
        </Stack>

        <Card>
          <div className="tabs-scroll">
            <Tabs items={TABS.map(t => ({ id: t.id, title: t.title }))} activeItemId={mode} onClick={item => setMode(item.id as Mode)} divider />
          </div>
          <Stack wrap gap="space-600" padding="space-600">
            <StackItem flex="1 1 280px">
              <Stack direction="column" gap="space-400" fillEqually>
                <Text as="h2" type="title" text={tab.question} />
                {inputs[mode]}
                <Text as="p" type="caption" theme="muted" text="Fields start with example values. Replace them with your own." />
              </Stack>
            </StackItem>
            <StackItem flex="2 1 380px">
              <div aria-live="polite" className="result">
                <Stack direction="column" gap="space-500" fillEqually>
                  {body ?? <Text as="p" type="body" theme="muted" text="Fix the highlighted field to see the result." />}
                </Stack>
              </div>
            </StackItem>
          </Stack>
        </Card>

        <Card>
          <Stack direction="column" gap="space-200" paddingTop="space-600" paddingHorizontal="space-600">
            <Text as="h2" type="heading" text="Before you run the tests" />
          </Stack>
          <List mode="modern" dividerBetween paddingVertical="space-300">
            {NOTES.map(n => (
              <List.Item key={n.title}>
                <Cell title={n.title} body={n.body} />
              </List.Item>
            ))}
          </List>
        </Card>
      </Stack>
    </main>
  )
}
