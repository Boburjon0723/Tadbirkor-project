import { redirect } from 'next/navigation';

/** Eski URL — alohida platforma konsoli /admin da */
export default function LegacyPlatformAdminPage() {
  redirect('/admin');
}
