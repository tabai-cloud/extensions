import { useEffect, useState } from "react"

type LimitEntry = {
  feature_name: string
  remaining: number
  reset_after: string
}

type UsageData = {
  limitsProgress: LimitEntry[]
  modelLimits: unknown[]
  updatedAt: number
}

function formatResetAfter(iso: string) {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return "resets now"
  const hours = Math.round(ms / (1000 * 60 * 60))
  if (hours < 24) return `resets in ${hours}h`
  return `resets in ${Math.round(hours / 24)}d`
}

function IndexPopup() {
  const [usage, setUsage] = useState<UsageData | null>(null)

  useEffect(() => {
    chrome.storage.local.get("usage", (result) => {
      if (result.usage) setUsage(result.usage as UsageData)
    })

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== "local" || !changes.usage) return
      setUsage(changes.usage.newValue as UsageData)
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  return (
    <div style={{ width: 280, padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>ChatGPT Usage</h3>

      {!usage && (
        <p style={{ fontSize: 12, color: "#666" }}>
          No usage data captured yet — open a ChatGPT conversation and send a message.
        </p>
      )}

      {usage && usage.limitsProgress.length === 0 && (
        <p style={{ fontSize: 12, color: "#666" }}>No per-feature limits reported (nothing capped right now).</p>
      )}

      {usage &&
        usage.limitsProgress.map((entry) => (
          <div
            key={entry.feature_name}
            style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #eee", fontSize: 13 }}>
            <span>{entry.feature_name.replace(/_/g, " ")}</span>
            <span style={{ color: entry.remaining <= 1 ? "#d33" : "#333" }}>
              {entry.remaining} left · {formatResetAfter(entry.reset_after)}
            </span>
          </div>
        ))}

      {usage && (
        <p style={{ fontSize: 10, color: "#999", marginTop: 10 }}>
          Last updated {new Date(usage.updatedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}

export default IndexPopup
