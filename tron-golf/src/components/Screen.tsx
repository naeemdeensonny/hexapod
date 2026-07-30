import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  IconCard,
  IconFlag,
  IconGear,
  IconHistory,
  IconHome,
  IconMap,
  IconTarget,
} from './icons';
import { useStore } from '../state/store';

type NavItem = { label: string; to: string; icon: (p: { size?: number }) => JSX.Element };

const MAIN_NAV: NavItem[] = [
  { label: 'HOME', to: '/', icon: IconHome },
  { label: 'COURSES', to: '/courses', icon: IconFlag },
  { label: 'SCORECARD', to: '/scorecard', icon: IconCard },
  { label: 'HISTORY', to: '/history', icon: IconHistory },
  { label: 'SETTINGS', to: '/settings', icon: IconGear },
];

const ROUND_NAV: NavItem[] = [
  { label: 'MAP', to: '/play', icon: IconMap },
  { label: 'SCORECARD', to: '/scorecard', icon: IconCard },
  { label: 'ROUND', to: '/hole', icon: IconTarget },
];

function BottomNav() {
  const { activeRound } = useStore();
  const nav = useNavigate();
  const { pathname } = useLocation();

  // During a round the nav prioritises the playing screens.
  const inRoundView =
    !!activeRound && ['/play', '/hole', '/score', '/scorecard', '/complete'].includes(pathname);
  const items = inRoundView ? ROUND_NAV : MAIN_NAV;

  return (
    <nav className="nav">
      {items.map((it) => {
        const active = pathname === it.to || (it.to !== '/' && pathname.startsWith(it.to));
        const Ico = it.icon;
        return (
          <button
            key={it.to}
            className={`nav__item ${active ? 'nav__item--active' : ''}`}
            onClick={() => nav(it.to)}
          >
            <Ico size={14} />
            <span>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default function Screen({
  title,
  subtitle,
  back,
  children,
  flush,
  hideNav,
  hideHeader,
}: {
  title: string;
  subtitle?: string;
  /** Path to navigate to, or `true` for browser back. */
  back?: string | true;
  children: ReactNode;
  flush?: boolean;
  hideNav?: boolean;
  /** Skip the chrome header bar — for screens that draw their own top area. */
  hideHeader?: boolean;
}) {
  const nav = useNavigate();
  return (
    <div className="app grid-texture">
      {!hideHeader && (
        <header className="hdr">
          {back && (
            <button
              className="hdr__back"
              aria-label="Back"
              onClick={() => (back === true ? nav(-1) : nav(back))}
            >
              {'<'}
            </button>
          )}
          <h1 className="hdr__title">{title}</h1>
          {subtitle && <span className="hdr__sub">{subtitle}</span>}
        </header>
      )}

      <main className={`screen-body ${flush ? 'flush' : ''}`}>{children}</main>

      {!hideNav && <BottomNav />}
    </div>
  );
}
