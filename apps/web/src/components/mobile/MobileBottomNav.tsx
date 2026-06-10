'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { DashboardMenuItem } from '@/lib/dashboard-menu';
import { isMenuItemActive } from '@/lib/dashboard-menu';
import { MobileBottomNavItem } from '@/components/mobile/MobileBottomNavItem';

type Props = {
  items: DashboardMenuItem[];
  pathname: string;
  search: string;
  onPrefetch: (href: string) => void;
  className?: string;
};

const LOOP_COPIES = 3;
const MIDDLE_COPY = 1;

export function MobileBottomNav({
  items,
  pathname,
  search,
  onPrefetch,
  className = '',
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const setWidthRef = useRef(0);
  const adjustingRef = useRef(false);
  const loopEnabled = items.length >= 2;

  const activeKey =
    items.find(
      (item) =>
        item.href !== '#support' && isMenuItemActive(pathname, item.href, search),
    )?.href ?? null;

  const copies = useMemo(
    () => (loopEnabled ? Array.from({ length: LOOP_COPIES }, (_, i) => i) : [0]),
    [loopEnabled],
  );

  const measureSetWidth = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return 0;
    const setEl = container.querySelector('[data-nav-set="0"]') as HTMLElement | null;
    if (!setEl) return 0;
    const width = setEl.offsetWidth;
    setWidthRef.current = width;
    return width;
  }, []);

  const scrollHrefToCenter = useCallback(
    (href: string, behavior: ScrollBehavior = 'smooth') => {
      const container = scrollRef.current;
      if (!container) return;

      const selector = loopEnabled
        ? `[data-nav-copy="${MIDDLE_COPY}"][data-nav-href="${CSS.escape(href)}"]`
        : `[data-nav-href="${CSS.escape(href)}"]`;
      const el = container.querySelector(selector) as HTMLElement | null;
      if (!el) return;

      adjustingRef.current = true;
      const target = el.offsetLeft - container.clientWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, target), behavior });
      window.setTimeout(() => {
        adjustingRef.current = false;
      }, behavior === 'smooth' ? 320 : 0);
    },
    [loopEnabled],
  );

  const normalizeLoopPosition = useCallback(() => {
    if (!loopEnabled || adjustingRef.current) return;

    const container = scrollRef.current;
    const setWidth = setWidthRef.current || measureSetWidth();
    if (!container || setWidth <= 0) return;

    const { scrollLeft } = container;

    if (scrollLeft < setWidth * 0.35) {
      adjustingRef.current = true;
      container.scrollLeft += setWidth;
      adjustingRef.current = false;
    } else if (scrollLeft > setWidth * 2.05) {
      adjustingRef.current = true;
      container.scrollLeft -= setWidth;
      adjustingRef.current = false;
    }
  }, [loopEnabled, measureSetWidth]);

  const scrollActiveToCenter = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      if (!activeKey) {
        if (loopEnabled) {
          const container = scrollRef.current;
          const setWidth = setWidthRef.current || measureSetWidth();
          if (container && setWidth > 0) {
            adjustingRef.current = true;
            container.scrollLeft = setWidth;
            adjustingRef.current = false;
          }
        }
        return;
      }
      scrollHrefToCenter(activeKey, behavior);
    },
    [activeKey, loopEnabled, measureSetWidth, scrollHrefToCenter],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      measureSetWidth();
      scrollActiveToCenter('auto');
    });
    return () => cancelAnimationFrame(frame);
  }, [items.length, activeKey, measureSetWidth, scrollActiveToCenter]);

  useEffect(() => {
    scrollActiveToCenter('smooth');
  }, [activeKey, scrollActiveToCenter]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !loopEnabled) return;

    let frame = 0;
    const onScroll = () => {
      if (adjustingRef.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(normalizeLoopPosition);
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [loopEnabled, normalizeLoopPosition]);

  const renderItem = (item: DashboardMenuItem, copyIndex: number) => {
    const isActive =
      item.href !== '#support' && isMenuItemActive(pathname, item.href, search);

    return (
      <MobileBottomNavItem
        key={loopEnabled ? `${copyIndex}:${item.href}` : item.href}
        item={item}
        copyIndex={copyIndex}
        loopEnabled={loopEnabled}
        isActive={isActive}
        onPrefetch={onPrefetch}
      />
    );
  };

  return (
    <nav
      className={`md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-[#080808]/92 backdrop-blur-2xl pb-[env(safe-area-inset-bottom)] ${className}`}
    >
      <div
        ref={scrollRef}
        className="flex min-h-[calc(4.5rem+env(safe-area-inset-bottom))] items-end overflow-x-auto overscroll-x-contain px-1 pt-1.5 pb-1 no-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {loopEnabled ? (
          copies.map((copyIndex) => (
            <div
              key={`set-${copyIndex}`}
              data-nav-set={copyIndex}
              className="flex shrink-0 items-end gap-0.5"
            >
              {items.map((item) => renderItem(item, copyIndex))}
            </div>
          ))
        ) : (
          <div data-nav-set="0" className="flex shrink-0 items-end gap-0.5 px-[calc(50vw-2.4rem)]">
            {items.map((item) => renderItem(item, 0))}
          </div>
        )}
      </div>
    </nav>
  );
}
