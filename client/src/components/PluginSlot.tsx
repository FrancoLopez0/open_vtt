import { useEffect, useRef, useState } from 'react'

/**
 * PluginSlot — dynamically loads plugin Web Components and renders them.
 *
 * Fetches /api/plugins, selects the correct widget URL based on `role`,
 * injects each JS file as a <script> tag (once, deduplicated), then
 * renders the corresponding custom element tags inside a container div.
 *
 * @param {{ role: 'dm' | 'player' }} props
 */
export default function PluginSlot({ role }) {
  const containerRef = useRef(null)
  const [plugins, setPlugins] = useState([])

  // Fetch plugin metadata
  useEffect(() => {
    fetch('/api/plugins')
      .then((res) => res.json())
      .then(setPlugins)
      .catch((err) => console.error('[PluginSlot] Failed to fetch plugins:', err))
  }, [])

  // Load scripts and render custom elements when plugins arrive
  useEffect(() => {
    if (!containerRef.current || plugins.length === 0) return

    const widgetKey = role === 'dm' ? 'dm_widget' : 'player_widget'
    const loaded = new Set()

    // Collect already-injected script srcs to avoid duplicates
    document.querySelectorAll('script[data-plugin]').forEach((s) => loaded.add((s as HTMLScriptElement).src))

    const elements = []

    for (const plugin of plugins) {
      const widgetUrl = plugin[widgetKey]
      if (!widgetUrl) continue

      // Inject script tag if not already present
      const fullUrl = new URL(widgetUrl, window.location.origin).href
      if (!loaded.has(fullUrl)) {
        const script = document.createElement('script')
        script.src = fullUrl
        script.type = 'module'
        script.dataset.plugin = plugin.name
        document.head.appendChild(script)
        loaded.add(fullUrl)
      }

      // Derive custom element tag: "example_plugin" + "dm" → "example-plugin-dm"
      const tagSuffix = role === 'dm' ? 'dm' : 'player'
      const tagName = plugin.name.replace(/_/g, '-') + '-' + tagSuffix
      elements.push(tagName)
    }

    // Render custom element tags into the container
    if (containerRef.current) {
      containerRef.current.innerHTML = elements
        .map((tag) => `<${tag}></${tag}>`)
        .join('\n')
    }
  }, [plugins, role])

  if (plugins.length === 0) return null

  return (
    <div
      ref={containerRef}
      className="plugin-slot"
      data-role={role}
      style={{ display: 'contents' }}
    />
  )
}
