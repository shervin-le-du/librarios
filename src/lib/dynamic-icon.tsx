import { icons, type LucideProps } from "lucide-react";

// Match the lucide-react/dynamic API: names are kebab-case strings.
export type IconName = string;

function toPascal(name: string): string {
  return name
    .split("-")
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

export function DynamicIcon({ name, ...props }: { name: IconName } & LucideProps) {
  const key = toPascal(name) as keyof typeof icons;
  const Cmp = icons[key];
  if (!Cmp) return null;
  return <Cmp {...props} />;
}
