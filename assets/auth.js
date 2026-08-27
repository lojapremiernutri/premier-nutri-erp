import { supabase } from './supabase.js';

export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.href = 'login.html';
    return null;
  }
  return session;
}

export async function doLogout() {
  await supabase.auth.signOut();
  location.href = 'login.html';
}
