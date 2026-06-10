'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { DashboardMenuItem } from '@/lib/dashboard-menu';
import { mobileNavShortLabel } from '@/lib/dashboard-labels';

type Props = {
  item: DashboardMenuItem;
  copyIndex: number;
  loopEnabled: boolean;
  isActive: boolean;
  onPrefetch: (href: string) => void;
};

export function MobileBottomNavItem({
  item,
  copyIndex,
  loopEnabled,
  isActive,
  onPrefetch,
}: Props) {
  const isCenterAnchor = item.href === '/dashboard';
  const shortLabel = mobileNavShortLabel(item.label);
  const showActiveDot = isActive && (!loopEnabled || copyIndex === 1);
  const itemKey = loopEnabled ? `${copyIndex}:${item.href}` : item.href;

  const dataProps = {
    'data-nav-href': item.href,
    'data-nav-copy': String(copyIndex),
  };

  const content = (
    <>
      <div
        className={`relative flex items-center justify-center rounded-2xl transition-all duration-200 ${
          isActive
            ? 'h-11 w-11 bg-blue-500/15 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.25)]'
            : isCenterAnchor
              ? 'h-10 w-10 bg-white/[0.06] text-gray-300'
              : 'h-9 w-9 text-gray-500'
        }`}
      >
        <div className={isActive ? 'scale-110' : 'scale-95'}>{item.icon}</div>
      </div>
      <span
        className={`mt-1 max-w-[4.5rem] truncate text-center uppercase tracking-tighter transition-all duration-200 ${
          isActive
            ? 'text-[10px] font-black text-blue-300'
            : 'text-[9px] font-bold text-gray-500'
        }`}
      >
        {shortLabel}
      </span>
      {showActiveDot ? (
        <motion.div
          layoutId="mobile-nav-active-dot"
          className="mt-0.5 h-1 w-1 rounded-full bg-blue-400"
        />
      ) : (
        <span className="mt-0.5 h-1 w-1" aria-hidden />
      )}
    </>
  );

  const itemClass = `relative flex shrink-0 flex-col items-center justify-end py-0.5 transition-transform duration-200 w-[4.75rem] ${
    isActive
      ? 'scale-105'
      : isCenterAnchor
        ? 'scale-[0.98] opacity-90'
        : 'scale-[0.92] opacity-70'
  }`;

  if (item.href === '#support') {
    return (
      <button
        key={itemKey}
        type="button"
        {...dataProps}
        onClick={() => window.dispatchEvent(new CustomEvent('open-support-widget'))}
        className={itemClass}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      key={itemKey}
      href={item.href}
      prefetch
      {...dataProps}
      onMouseEnter={() => onPrefetch(item.href)}
      className={itemClass}
    >
      {content}
    </Link>
  );
}
