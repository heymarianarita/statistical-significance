// web-ui switches to its dark palette with data-theme="dark" on the root element.
// When nothing has chosen a theme explicitly, follow the operating system setting.
export function followSystemTheme() {
  const root = document.documentElement
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  let ours: string | null = null

  const apply = () => {
    const current = root.getAttribute('data-theme')
    if (current !== null && current !== ours) return // explicit choice wins
    ours = media.matches ? 'dark' : 'light'
    root.setAttribute('data-theme', ours)
  }

  new MutationObserver(() => {
    if (root.getAttribute('data-theme') === null) apply()
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] })
  media.addEventListener('change', apply)
  apply()
}
