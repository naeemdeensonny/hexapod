import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

/* --- destructive action guard -------------------------------------------- */

/**
 * A delete button that will not fire on a single tap.
 *
 * The first press only *arms* it; the second press within `window` ms performs
 * the action. It disarms itself automatically, so a stray tap in a pocket or a
 * mis-hit next to a list row cannot destroy a course or a round. Preferred over
 * a `confirm()` dialog here because the arming state is visible in place, and
 * on Android a system dialog is easy to dismiss with the wrong button.
 */
export function ConfirmButton({
  onConfirm,
  children,
  armedLabel = 'TAP AGAIN TO CONFIRM',
  window: windowMs = 4000,
  className = '',
  size = 'md',
  ...rest
}: Omit<BtnProps, 'variant' | 'onClick'> & {
  onConfirm: () => void;
  children: ReactNode;
  armedLabel?: string;
  window?: number;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), windowMs);
    return () => clearTimeout(t);
  }, [armed, windowMs]);

  return (
    <Button
      {...rest}
      size={size}
      variant="danger"
      className={`${armed ? 'btn--armed' : ''} ${className}`}
      aria-live="polite"
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? armedLabel : children}
    </Button>
  );
}

/* --- overflowing text ----------------------------------------------------- */

/**
 * Single-line text that gently scrolls back and forth when it is too long for
 * its container, and sits still when it fits.
 *
 * Course names like "Awana Genting Highlands Golf & Country Resort" would
 * otherwise either wrap onto three lines or be cut off mid-word. Measuring
 * first means short names pay nothing — no animation, no motion.
 */
export function MarqueeText({ text, className = '' }: { text: string; className?: string }) {
  const outer = useRef<HTMLSpanElement | null>(null);
  const inner = useRef<HTMLSpanElement | null>(null);
  const [shift, setShift] = useState(0);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;

    const measure = () => {
      const overflow = i.scrollWidth - o.clientWidth;
      setShift(overflow > 4 ? overflow : 0);
    };
    measure();

    // Re-measure on rotation / layout changes; the element is often inside a
    // flex row whose width settles after first paint.
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    return () => ro.disconnect();
  }, [text]);

  // Roughly constant scroll speed regardless of how much overflows.
  const duration = shift ? Math.max(6, Math.round(shift / 18) + 5) : 0;

  return (
    <span ref={outer} className={`marquee ${shift ? 'marquee--on' : ''} ${className}`} title={text}>
      <span
        ref={inner}
        className="marquee__inner"
        style={
          shift
            ? ({
                '--marquee-shift': `-${shift}px`,
                '--marquee-dur': `${duration}s`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </span>
  );
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
