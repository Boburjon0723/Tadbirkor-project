'use client';

import React from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  History,
  PackagePlus,
  ScanLine,
  Truck,
} from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { isModuleKeyEnabled } from '@/lib/feature-modules';

type HubLink = {
  href: string;
  label: string;
  icon: React.ReactNode;
  color: string;
};

export function WarehouseOperatorMobileHub() {
  const { data: session } = useSession();
  const role = session?.role;
  const features = session?.features;

  if (!role || !['owner', 'manager', 'warehouse'].includes(role)) return null;

  const links: HubLink[] = [];

  if (isModuleKeyEnabled(features, 'WAREHOUSE_INTAKE')) {
    links.push({
      href: '/dashboard/warehouse-intake',
      label: 'Kirim',
      icon: <PackagePlus size={18} />,
      color: 'from-blue-600/20 to-blue-600/5 border-blue-500/20 text-blue-400',
    });
  }
  if (isModuleKeyEnabled(features, 'GOODS_RECEIPTS')) {
    links.push({
      href: '/dashboard/receipts',
      label: 'Yuklar',
      icon: <Truck size={18} />,
      color: 'from-emerald-600/20 to-emerald-600/5 border-emerald-500/20 text-emerald-400',
    });
  }
  if (isModuleKeyEnabled(features, 'WAREHOUSE_PICKING')) {
    links.push({
      href: '/dashboard/picking',
      label: 'Saralash',
      icon: <ScanLine size={18} />,
      color: 'from-amber-600/20 to-amber-600/5 border-amber-500/20 text-amber-400',
    });
  }
  if (isModuleKeyEnabled(features, 'WAREHOUSE_INVENTORY_COUNT')) {
    links.push({
      href: '/dashboard/inventory-count',
      label: 'Inventar',
      icon: <ClipboardList size={18} />,
      color: 'from-teal-600/20 to-teal-600/5 border-teal-500/20 text-teal-400',
    });
  }
  if (isModuleKeyEnabled(features, 'WAREHOUSE_BASIC')) {
    links.push({
      href: '/dashboard/warehouse',
      label: 'Tarix',
      icon: <History size={18} />,
      color: 'from-purple-600/20 to-purple-600/5 border-purple-500/20 text-purple-400',
    });
  }

  if (links.length < 2) return null;

  return (
    <div className="md:hidden px-4 pb-3 pt-1">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
        Ombor tezkor
      </p>
      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 flex items-center gap-2 px-4 py-3 rounded-2xl border bg-gradient-to-br font-black text-xs uppercase tracking-wide active:scale-95 transition-transform ${link.color}`}
          >
            {link.icon}
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
