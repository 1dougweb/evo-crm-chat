import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { instance, number, message, messageType = 'text', mediaUrl } = await req.json();

    // Get Evolution API configuration
    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new Error('Evolution API configuration not found');
    }

    let payload: any = {
      number: number.replace('@s.whatsapp.net', ''),
    };

    // Prepare payload based on message type
    switch (messageType) {
      case 'text':
        payload.text = message;
        break;
      case 'image':
        payload.mediaMessage = {
          mediatype: 'image',
          media: mediaUrl,
          caption: message
        };
        break;
      case 'video':
        payload.mediaMessage = {
          mediatype: 'video',
          media: mediaUrl,
          caption: message
        };
        break;
      case 'audio':
        payload.audioMessage = {
          audio: mediaUrl
        };
        break;
      case 'document':
        payload.mediaMessage = {
          mediatype: 'document',
          media: mediaUrl,
          fileName: message
        };
        break;
    }

    // Send message via Evolution API
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log('Evolution API response:', result);

    if (!response.ok) {
      throw new Error(`Evolution API error: ${result.error || 'Unknown error'}`);
    }

    // Store message in database
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('whatsapp_instance_id', instance)
      .eq('contact_id', await getContactIdByPhone(supabase, number))
      .single();

    if (conversation) {
      await supabase.from('messages').insert({
        conversation_id: conversation.id,
        whatsapp_message_id: result.key?.id,
        content: message,
        message_type: messageType,
        sender_type: 'user',
        status: 'sent',
        media_url: mediaUrl
      });

      // Update conversation
      await supabase.from('conversations').update({
        last_message: message,
        last_message_at: new Date().toISOString()
      }).eq('id', conversation.id);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getContactIdByPhone(supabase: any, phone: string): Promise<string | null> {
  const cleanPhone = phone.replace('@s.whatsapp.net', '');
  const { data } = await supabase
    .from('contacts')
    .select('id')
    .eq('phone', cleanPhone)
    .single();
  
  return data?.id || null;
}