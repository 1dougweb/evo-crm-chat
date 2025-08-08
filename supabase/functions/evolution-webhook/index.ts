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

    const body = await req.json();
    console.log('Evolution webhook received:', body);

    // Process different event types
    switch (body.event) {
      case 'messages.upsert':
        await processMessage(supabase, body);
        break;
      case 'connection.update':
        await processConnectionUpdate(supabase, body);
        break;
      case 'qr.updated':
        await processQRUpdate(supabase, body);
        break;
      default:
        console.log('Unhandled event type:', body.event);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processMessage(supabase: any, data: any) {
  const message = data.data;
  
  // Find or create contact
  const phoneNumber = message.key.remoteJid.replace('@s.whatsapp.net', '');
  let contact = await findOrCreateContact(supabase, phoneNumber, message.pushName);
  
  // Find or create conversation
  let conversation = await findOrCreateConversation(supabase, contact.id, data.instance);
  
  // Store message
  await supabase.from('messages').insert({
    conversation_id: conversation.id,
    whatsapp_message_id: message.key.id,
    content: message.message?.conversation || message.message?.extendedTextMessage?.text || '',
    message_type: getMessageType(message.message),
    sender_type: message.key.fromMe ? 'user' : 'contact',
    timestamp: new Date(message.messageTimestamp * 1000).toISOString(),
    status: 'delivered'
  });

  // Update conversation last message
  await supabase.from('conversations').update({
    last_message: message.message?.conversation || message.message?.extendedTextMessage?.text || '',
    last_message_at: new Date(message.messageTimestamp * 1000).toISOString(),
    unread_count: message.key.fromMe ? 0 : conversation.unread_count + 1
  }).eq('id', conversation.id);

  // Process automation rules
  await processAutomation(supabase, conversation.id, message);
}

async function findOrCreateContact(supabase: any, phoneNumber: string, name?: string) {
  const { data: existing } = await supabase
    .from('contacts')
    .select('*')
    .eq('phone', phoneNumber)
    .single();

  if (existing) {
    // Update name if provided and different
    if (name && existing.name !== name) {
      await supabase.from('contacts').update({ name }).eq('id', existing.id);
      return { ...existing, name };
    }
    return existing;
  }

  const { data: newContact } = await supabase
    .from('contacts')
    .insert({
      phone: phoneNumber,
      name: name || phoneNumber,
      source: 'whatsapp'
    })
    .select()
    .single();

  return newContact;
}

async function findOrCreateConversation(supabase: any, contactId: string, instance: string) {
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('contact_id', contactId)
    .eq('whatsapp_instance_id', instance)
    .single();

  if (existing) return existing;

  const { data: newConversation } = await supabase
    .from('conversations')
    .insert({
      contact_id: contactId,
      whatsapp_instance_id: instance,
      status: 'active',
      unread_count: 0
    })
    .select()
    .single();

  return newConversation;
}

function getMessageType(message: any): string {
  if (message.conversation || message.extendedTextMessage) return 'text';
  if (message.imageMessage) return 'image';
  if (message.videoMessage) return 'video';
  if (message.audioMessage) return 'audio';
  if (message.documentMessage) return 'document';
  return 'text';
}

async function processAutomation(supabase: any, conversationId: string, message: any) {
  if (message.key.fromMe) return; // Don't process automation for outgoing messages

  const content = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
  
  // Get active automations
  const { data: automations } = await supabase
    .from('automations')
    .select('*')
    .eq('is_active', true)
    .eq('trigger_type', 'keyword');

  for (const automation of automations || []) {
    const keywords = automation.trigger_keywords || [];
    const hasKeyword = keywords.some((keyword: string) => 
      content.toLowerCase().includes(keyword.toLowerCase())
    );

    if (hasKeyword) {
      // Send automated response
      await supabase.functions.invoke('evolution-send-message', {
        body: {
          instance: message.instance,
          number: message.key.remoteJid,
          message: automation.response_message
        }
      });
      break; // Only trigger first matching automation
    }
  }
}

async function processConnectionUpdate(supabase: any, data: any) {
  await supabase
    .from('whatsapp_instances')
    .update({
      status: data.data.state,
      last_seen: new Date().toISOString()
    })
    .eq('instance_name', data.instance);
}

async function processQRUpdate(supabase: any, data: any) {
  await supabase
    .from('whatsapp_instances')
    .update({
      qr_code: data.data.qr,
      status: 'qr_code'
    })
    .eq('instance_name', data.instance);
}