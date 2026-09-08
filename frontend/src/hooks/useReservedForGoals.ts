import { useGoals } from "@/hooks/useGoals"

/** Sum of all goals' current_amount, converted to the user's base currency — a virtual reserve, not a real transaction. */
export function useReservedForGoals(): number {
  const { data: goals = [] } = useGoals()
  return goals.reduce((sum, g) => sum + g.current_amount_base, 0)
}
