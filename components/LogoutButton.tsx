'use client';

import { supabase } from '@/lib/supabaseClient';

export default function LogoutButton() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <button className='border p-4 hover:bg-amber-600 border-amber-200 rounded-2xl' onClick={handleLogout}>
      Sair
    </button>
  );
}
