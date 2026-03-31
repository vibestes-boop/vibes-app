// supabase/functions/delete-account/index.ts
// Löscht den Auth-User des aufrufenden Users via Service-Role-Key.
// Die profiles-Tabelle hat ON DELETE CASCADE → alle Daten werden mitgelöscht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Auth-Token aus dem Request extrahieren
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Kein Authorization-Header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') as string;

    // 2. User-ID aus dem JWT ermitteln (via anon-client)
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: authHeader,
        apikey: anonKey,
      },
    });

    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: 'Ungültiger Token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { id: userId } = await userRes.json() as { id: string };

    // 3. User via Service-Role-Key löschen (Auth + Cascade)
    const deleteRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    });

    if (!deleteRes.ok) {
      const body = await deleteRes.text();
      return new Response(JSON.stringify({ error: `Löschen fehlgeschlagen: ${body}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
