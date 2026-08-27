import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const supabase = createClient(
  'https://ileyrleweonplnpfuncj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsZXlybGV3ZW9ucGxucGZ1bmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzYxMjEsImV4cCI6MjEwMzI1MjEyMX0.vrUQ4FaMyNhJKlU2igp39ZlHFVfG0oT22wkyVFfpDy4'
);
