'use client';

import { useMemo } from 'react';
import { Crown } from 'lucide-react';
import {
  flattenMenuGroups,
  orderMobileBottomNavItems,
  type DashboardMenuGroup,
  type DashboardMenuItem,
} from '@/lib/dashboard-menu';
import { dashboardMenuGroups } from '@/lib/dashboard-menu-icons';
import { areModuleKeysEnabled } from '@/lib/feature-modules';
import type { CompanyFeatureConfig } from '@/services/companies.service';
import type { SessionRole } from '@/hooks/use-session';

type Params = {
  role: SessionRole;
  featureConfig: CompanyFeatureConfig;
  isPlatformAdmin: boolean;
};

export function useDashboardMenu({ role, featureConfig, isPlatformAdmin }: Params) {
  const shouldShowByFeature = (item: DashboardMenuItem) => {
    if (!item.moduleKeys?.length) return true;
    const match = item.moduleMatch ?? 'all';
    return areModuleKeysEnabled(featureConfig, item.moduleKeys, match);
  };

  const filterItem = (item: DashboardMenuItem) =>
    item.roles.includes(role) && shouldShowByFeature(item);

  const filteredMenuGroups = useMemo(
    () =>
      dashboardMenuGroups
        .map((group) => ({
          ...group,
          items: group.items.filter(filterItem),
        }))
        .filter((group) => group.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role, featureConfig.hasFeatureConfig, featureConfig.enabledModules, featureConfig.enabledFeatures],
  );

  const menuGroupsForNav = useMemo((): DashboardMenuGroup[] => {
    if (!isPlatformAdmin) return filteredMenuGroups;
    const allRoles: SessionRole[] = [
      'owner',
      'manager',
      'accountant',
      'warehouse',
      'sales',
      'field_worker',
      'worker',
    ];
    return [
      ...filteredMenuGroups,
      {
        id: 'platform-admin',
        title: 'Platforma',
        items: [
          {
            href: '/admin',
            label: 'Axis Console',
            icon: <Crown size={20} />,
            roles: allRoles,
          },
        ],
      },
    ];
  }, [filteredMenuGroups, isPlatformAdmin]);

  const allMenuItems = useMemo(() => flattenMenuGroups(dashboardMenuGroups), []);

  const filteredMenu = useMemo(
    () => menuGroupsForNav.flatMap((g) => g.items),
    [menuGroupsForNav],
  );

  const mobileNavItems = useMemo(() => {
    const hidden = new Set(['/dashboard/warehouse-intake/settings']);
    const items = filteredMenu.filter((item) => !hidden.has(item.href));
    return orderMobileBottomNavItems(items, role);
  }, [filteredMenu, role]);

  return { menuGroupsForNav, allMenuItems, filteredMenu, mobileNavItems };
}
