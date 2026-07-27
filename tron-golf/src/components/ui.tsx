import type { ButtonHTMLAttributes, ReactNode } from 'react';

/* --- buttons ------------------------------------------------------------ */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
};

export function Button({ variant = 'default', size = 'md', className = '', ...rest }: BtnProps) {
  const cls = [
    'btn',
    variant !== 'default' ? `btn--${variant}` : '',
    size === 'sm' ? 'btn--sm' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <button className={cls} {...rest} />;
}

/* --- panel -------------------------------------------------------------- */

export function Panel({
  title,
  children,
  sunk,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  sunk?: boolean;
  className?: string;
}) {
  return (
    <section className={`panel ${sunk ? 'panel--sunk' : ''} ${className}`}>
      {title && <h2 className="panel__title">{title}</h2>}
      {children}
    </section>
  );
}

export function KV({ k, v, color }: { k: string; v: ReactNode; color?: string }) {
  return (
    <div className="kv">
      <span className="kv__k">{k}</span>
      <span className="kv__v" style={color ? { color } : undefined}>
        {v}
      </span>
    </div>
  );
}

/* --- stepper ------------------------------------------------------------ */

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  compact,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  compact?: boolean;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="stepper">
      <button
        type="button"
        className="stepper__btn"
        aria-label="decrease"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
      >
        -
      </button>
      <span className="stepper__val" style={compact ? { fontSize: 18 } : undefined}>
        {value}
      </span>
      <button
        type="button"
        className="stepper__btn"
        aria-label="increase"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
}

/* --- segmented control -------------------------------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`seg__opt ${value === o.value ? 'seg__opt--on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* --- toggle ------------------------------------------------------------- */

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`toggle ${on ? 'toggle--on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="toggle__knob" />
    </button>
  );
}

export function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="kv" style={{ alignItems: 'center', minHeight: 46 }}>
      <span className="kv__k">{label}</span>
      {children}
    </div>
  );
}

/* --- form field --------------------------------------------------------- */

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
