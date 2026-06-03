import React from 'react';

export const metadata = {
  title: 'Platforma admin',
  description: 'Kompaniyalar va obuna boshqaruvi',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-900 text-white font-sans selection:bg-indigo-500 selection:text-white">
      {children}
    </div>
  );
}
