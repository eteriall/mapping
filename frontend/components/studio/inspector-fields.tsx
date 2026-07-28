import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Vec3 } from "@/lib/types";

export function InspectorShell({
  badge,
  children,
  icon: Icon,
  title,
}: {
  badge: string;
  children: ReactNode;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <aside className="flex h-full min-h-0 flex-col">
      <div className="flex items-start gap-3 border-b p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-medium">{title}</h2>
          <Badge className="mt-1" variant="outline">
            {badge}
          </Badge>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {children}
      </div>
    </aside>
  );
}

export function NumericField({
  label,
  max,
  min,
  onCommit,
  step = 0.1,
  value,
}: {
  label: string;
  max?: number;
  min?: number;
  onCommit: (value: number) => void;
  step?: number;
  value: number;
}) {
  const id = `field-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        defaultValue={Number(value.toFixed(4))}
        id={id}
        key={`${id}-${value}`}
        max={max}
        min={min}
        onBlur={(event) => {
          const number = Number(event.target.value);
          if (Number.isFinite(number)) {
            onCommit(number);
          }
        }}
        step={step}
        type="number"
      />
    </Field>
  );
}

export function ColorField({
  label,
  onCommit,
  value,
}: {
  label: string;
  onCommit: (value: string) => void;
  value: string;
}) {
  const id = `field-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        className="h-9 cursor-pointer p-1"
        id={id}
        onChange={(event) => onCommit(event.target.value)}
        type="color"
        value={value}
      />
    </Field>
  );
}

export function VectorFields({
  label,
  min,
  onCommit,
  step = 0.1,
  value,
}: {
  label: string;
  min?: number;
  onCommit: (value: Vec3) => void;
  step?: number;
  value: Vec3;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="grid grid-cols-3 gap-2">
        {(["x", "y", "z"] as const).map((axis) => (
          <Input
            aria-label={`${label} ${axis.toUpperCase()}`}
            defaultValue={Number(value[axis].toFixed(4))}
            key={`${label}-${axis}-${value[axis]}`}
            min={min}
            onBlur={(event) => {
              const number = Number(event.target.value);
              if (Number.isFinite(number)) {
                onCommit({ ...value, [axis]: number });
              }
            }}
            step={step}
            type="number"
          />
        ))}
      </div>
    </Field>
  );
}
