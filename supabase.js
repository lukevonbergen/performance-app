import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://vhfbwhyfroedggmsdbhs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoZmJ3aHlmcm9lZGdnbXNkYmhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM4Mzc5MTQsImV4cCI6MjA0OTQxMzkxNH0.EmS6PzfNRr3Q93aWY4iNpVrIsmHjhe5v_EnfKyHo4tY';

const supabase = createClient(supabaseUrl, supabaseKey);

export { supabase };
