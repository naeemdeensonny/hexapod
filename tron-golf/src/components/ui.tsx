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

/** Pixels per second for scrolling text. One speed for the whole app. */
const MARQUEE_SPEED = 38;
/** Blank run between the end of the text and the start of its repeat, in px. */
const MARQUEE_GAP = 48;

/**
 * Single-line text that scrolls continuously right-to-left when it is too long
 * for its container, and sits perfectly still when it fits.
 *
 * The text is rendered twice; the track slides exactly one copy-width and
 * loops, so the scroll is seamless rather than a bounce or a jump-back.
 *
 * Duration is derived from content width at a FIXED speed, so every scrolling
 * label in the app moves at the same pace — a long course name is not "faster"
 * than a short one, and identical names (the common case in a round list)
 * measure identically and therefore stay in step with each other.
 */
export function MarqueeText({ text, className = '' }: { text: string; className?: string }) {
  const outer = useRef<HTMLSpanElement | null>(null);
  const probe = useRef<HTMLSpanElement | null>(null);
  const [duration, setDuration] = useState(0); // 0 = fits, render static

  useLayoutEffect(() => {
    const o = outer.current;
    const p = probe.current;
    if (!o || !p) return;

    const measure = () => {
      // `probe` is the first copy and carries no gap, so this is the true
      // width of the text regardless of whether we are currently animating.
      const textWidth = p.scrollWidth;
      if (textWidth <= o.clientWidth + 2) {
        setDuration(0);
        return;
      }
      // Rounded so two identical strings always land on the same duration and
      // therefore stay in phase.
      const travel = textWidth + MARQUEE_GAP;
      setDuration(Math.round((travel / MARQUEE_SPEED) * 10) / 10);
    };

    measure();
    // Width settles after first paint inside flex rows, and changes on rotate.
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    return () => ro.disconnect();
  }, [text]);

  const on = duration > 0;

  return (
    <span ref={outer} className={`marquee ${on ? 'marquee--on' : ''} ${className}`} title={text}>
      <span
        className="marquee__track"
        style={on ? { animationDuration: `${duration}s` } : undefined}
      >
        <span className="marquee__copy">
          <span ref={probe} className="marquee__item">
            {text}
          </span>
          {on && <span className="marquee__gap" aria-hidden="true" />}
        </span>
        {on && (
          <span className="marquee__copy" aria-hidden="true">
            <span className="marquee__item">{text}</span>
            <span className="marquee__gap" />
          </span>
        )}
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
