import { useMe, useUpdateMe } from "@/hooks/useAuth"

export function useHideBalance() {
  const { data: user } = useMe()
  const updateMe = useUpdateMe()
  const hidden = user?.hide_accounts_balance ?? false

  function toggle() {
    updateMe.mutate({ hide_accounts_balance: !hidden })
  }

  return { hidden, toggle, isPending: updateMe.isPending }
}
