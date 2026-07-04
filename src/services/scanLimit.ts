import AsyncStorage from "@react-native-async-storage/async-storage"

const MAX_FREE_SCANS = 10
const KEY = "scan_usage"

type ScanUsage = {
  month: string  // "2026-07"
  count: number
}

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

async function getUsage(): Promise<ScanUsage> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return { month: currentMonth(), count: 0 }

    const data: ScanUsage = JSON.parse(raw)

    // Reset if new month
    if (data.month !== currentMonth()) {
      return { month: currentMonth(), count: 0 }
    }

    return data
  } catch {
    return { month: currentMonth(), count: 0 }
  }
}

async function saveUsage(usage: ScanUsage): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(usage))
}

export async function canScan(): Promise<{
  allowed: boolean
  scansUsed: number
  scansLeft: number
  limit: number
}> {
  const usage = await getUsage()
  const allowed = usage.count < MAX_FREE_SCANS
  return {
    allowed,
    scansUsed: usage.count,
    scansLeft: Math.max(0, MAX_FREE_SCANS - usage.count),
    limit: MAX_FREE_SCANS,
  }
}

export async function recordScan(): Promise<void> {
  const usage = await getUsage()
  await saveUsage({ ...usage, count: usage.count + 1 })
}

export async function getScansLeft(): Promise<number> {
  const usage = await getUsage()
  return Math.max(0, MAX_FREE_SCANS - usage.count)
}

// For testing — reset usage
export async function resetScanUsage(): Promise<void> {
  await AsyncStorage.removeItem(KEY)
}