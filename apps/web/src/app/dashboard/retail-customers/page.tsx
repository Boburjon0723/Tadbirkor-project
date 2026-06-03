'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RetailCustomersRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/pos?tab=mijozlar');
  }, [router]);
  return null;
}
