// Inverse standard normal (Acklam's approximation)
export function invNorm(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const lo = 0.02425
  const tail = (q: number) =>
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  if (p < lo) return tail(Math.sqrt(-2 * Math.log(p)))
  if (p > 1 - lo) return -tail(Math.sqrt(-2 * Math.log(1 - p)))
  const q = p - 0.5
  const r = q * q
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

export function normCdf(x: number): number {
  const z = Math.abs(x) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * z)
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z)
  return 0.5 * (1 + (x >= 0 ? erf : -erf))
}

export const zFor = (conf: number) => invNorm(1 - (1 - conf) / 2)

export const nEstimate = (p: number, E: number, z: number) => Math.ceil((z * z * p * (1 - p)) / (E * E))

export function nCompare(p1: number, p2: number, za: number, zb: number): number {
  const pb = (p1 + p2) / 2
  const top = za * Math.sqrt(2 * pb * (1 - pb)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))
  return Math.ceil((top * top) / ((p1 - p2) * (p1 - p2)))
}

export const nRare = (x: number, conf: number) => Math.ceil(Math.log(1 - conf) / Math.log(1 - x))

export function wilson(s: number, n: number, z: number): [number, number] {
  const p = s / n
  const z2 = z * z
  const den = 1 + z2 / n
  const mid = (p + z2 / (2 * n)) / den
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den
  return [Math.max(0, mid - half), Math.min(1, mid + half)]
}

export const fmt = (n: number) => n.toLocaleString('en-US')
export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`
export const clampRate = (p: number) => Math.min(Math.max(p, 0.01), 0.99)
