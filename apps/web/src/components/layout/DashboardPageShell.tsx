'use client';

import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
};

/** Dashboard sahifalari uchun umumiy joylashuv */
export function DashboardPageShell({ children, className = '' }: Props) {
  return <div className={`dash-page ${className}`.trim()}>{children}</div>;
}

type HeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
};

export function DashboardPageHeader({ title, subtitle, actions }: HeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/5">
      <div>
        <h1 className="dash-page-title mb-1.5">{title}</h1>
        {subtitle ? <p className="dash-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
