// web-ui has no chart component, so these are plain SVG coloured with web-ui's theme variables.
import { fmt, pct } from './stats'

const color = (token: string, alpha = 1) => `rgba(var(--${token}), ${alpha})`
const axisText = { fill: color('greyscale-level-2'), fontSize: 11, fontFamily: 'inherit' }

type LineChartProps = {
  f: (x: number) => number
  xmin: number
  xmax: number
  xcur: number
  ycur: number
  xfmt: (x: number) => string
  xTitle: string
  yTitle: string
  label: string
}

// Line chart with a log-scaled y axis
export function LineChart({ f, xmin, xmax, xcur, ycur, xfmt, xTitle, yTitle, label }: LineChartProps) {
  const W = 560, H = 250, L = 56, R = 20, T = 18, B = 44
  const pts: [number, number][] = []
  for (let i = 0; i <= 80; i++) {
    const x = xmin + ((xmax - xmin) * i) / 80
    const y = f(x)
    if (Number.isFinite(y) && y > 0) pts.push([x, y])
  }
  if (pts.length < 2) return null
  let ymin = Math.max(1, Math.min(...pts.map(p => p[1]), ycur))
  const ymax = Math.max(...pts.map(p => p[1]), ycur, ymin * 2)
  const lmin = Math.log10(ymin), lmax = Math.log10(ymax)
  const sx = (x: number) => L + ((x - xmin) / (xmax - xmin)) * (W - L - R)
  const sy = (y: number) => T + (1 - (Math.log10(Math.max(y, 1)) - lmin) / (lmax - lmin)) * (H - T - B)

  let ticks: number[] = []
  for (let k = Math.floor(lmin); k <= Math.ceil(lmax); k++)
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** k
      if (v >= ymin && v <= ymax) ticks.push(v)
    }
  if (ticks.length > 7) ticks = ticks.filter((v, i) => i === 0 || String(v).startsWith('1'))

  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)} ${sy(p[1]).toFixed(1)}`).join(' ')
  const cx = sx(xcur), cy = sy(ycur)
  const labelEnd = cx > W - 110

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {ticks.map(v => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} stroke={color('greyscale-level-4')} />
          <text x={L - 8} y={sy(v) + 4} textAnchor="end" {...axisText}>{fmt(v)}</text>
        </g>
      ))}
      {[0, 1, 2, 3, 4, 5].map(i => {
        const x = xmin + ((xmax - xmin) * i) / 5
        return <text key={i} x={sx(x)} y={H - B + 18} textAnchor="middle" {...axisText}>{xfmt(x)}</text>
      })}
      <path d={`${d} L${sx(pts[pts.length - 1][0])} ${H - B} L${sx(pts[0][0])} ${H - B} Z`} fill={color('primary-default', 0.12)} />
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke={color('greyscale-level-3')} />
      <path d={d} fill="none" stroke={color('primary-default')} strokeWidth={2.25} />
      {xcur >= xmin && xcur <= xmax && (
        <g>
          <line x1={cx} x2={cx} y1={cy} y2={H - B} stroke={color('primary-default', 0.6)} strokeDasharray="3 3" />
          <circle cx={cx} cy={cy} r={6} fill={color('primary-default')} stroke={color('greyscale-level-6')} strokeWidth={3} />
          <text x={cx + (labelEnd ? -10 : 10)} y={Math.max(cy - 10, T + 10)} textAnchor={labelEnd ? 'end' : 'start'}
            fill={color('greyscale-level-1')} fontSize={12} fontWeight={600}>{fmt(ycur)}</text>
        </g>
      )}
      <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" {...axisText} fontSize={12}>{xTitle}</text>
      <text transform={`translate(14 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" {...axisText} fontSize={12}>{yTitle}</text>
    </svg>
  )
}

type Interval = { label: string; p: number; lo: number; hi: number }

// Observed pass rates with their confidence intervals
export function IntervalChart({ rows }: { rows: Interval[] }) {
  const W = 560, L = 90, R = 24, rowH = 46, T = 14
  const H = T + rows.length * rowH + 34
  const sx = (v: number) => L + v * (W - L - R)
  const tones = ['primary-default', 'success-default']
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Observed pass rates with confidence intervals" style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 2, 4, 6, 8, 10].map(i => (
        <g key={i}>
          <line x1={sx(i / 10)} x2={sx(i / 10)} y1={T} y2={H - 30} stroke={color('greyscale-level-4')} />
          <text x={sx(i / 10)} y={H - 12} textAnchor="middle" {...axisText}>{i * 10}%</text>
        </g>
      ))}
      {rows.map((r, i) => {
        const y = T + i * rowH + rowH / 2
        return (
          <g key={r.label}>
            <text x={0} y={y + 4} fill={color('greyscale-level-1')} fontSize={13} fontWeight={500}>{r.label}</text>
            <line x1={sx(r.lo)} x2={sx(r.hi)} y1={y} y2={y} stroke={color(tones[i])} strokeWidth={3} strokeLinecap="round" />
            <circle cx={sx(r.p)} cy={y} r={6} fill={color(tones[i])} stroke={color('greyscale-level-6')} strokeWidth={3} />
            <text x={sx(r.p)} y={y - 12} textAnchor="middle" fill={color('greyscale-level-1')} fontSize={12} fontWeight={600}>{pct(r.p)}</text>
          </g>
        )
      })}
    </svg>
  )
}
