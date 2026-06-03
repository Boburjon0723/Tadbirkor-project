import { redirect } from 'next/navigation';

/** Eski /admin URL — haqiqiy panel /dashboard/platform-admin da */
export default function AdminDashboardPage() {
  redirect('/dashboard/platform-admin');
}
