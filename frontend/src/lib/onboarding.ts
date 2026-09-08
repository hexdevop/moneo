const KEY = "moneo_onboarding_dismissed"

export function isOnboardingDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

export function setOnboardingDismissed(dismissed: boolean): void {
  try {
    if (dismissed) localStorage.setItem(KEY, "1")
    else localStorage.removeItem(KEY)
  } catch {
    // ignore — worst case the welcome modal reappears next time
  }
}
