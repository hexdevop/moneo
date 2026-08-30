import * as Icons from "lucide-react"
import type { LucideProps } from "lucide-react"
import type { ComponentType } from "react"

function toPascalCase(kebab: string): string {
  return kebab
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")
}

type IconMap = Record<string, ComponentType<LucideProps>>

export function CategoryIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = (Icons as unknown as IconMap)[toPascalCase(name)] ?? Icons.Circle
  return <Icon {...props} />
}
