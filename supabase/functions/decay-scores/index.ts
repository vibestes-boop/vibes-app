import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Supabase Edge Function: decay-scores
// Ruft decay_dwell_scores() auf — wöchentlich via externem Cron-Dienst
// Absicherung: Secret-Key im Header (verhindert unautorisierten Aufruf)

Deno.serve(async (req: Request) => {
  // Methode prüfen
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Secret-Key prüfen (wird als Header mitgegeben)
  const authHeader = req.headers.get('x-cron-secret');
  const expectedSecret = Deno.env.get('CRON_SECRET');

  if (!expectedSecret || authHeader !== expectedSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Supabase Admin-Client (Service Role Key — kein RLS)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Decay ausführen
  const { error } = await supabase.rpc('decay_dwell_scores');

  if (error) {
    console.error('Decay error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const now = new Date().toISOString();
  console.log(`Score decay executed at ${now}`);

  return new Response(
    JSON.stringify({ success: true, executed_at: now }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
