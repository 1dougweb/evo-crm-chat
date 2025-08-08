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

    const { action, instanceName, webhookUrl } = await req.json();

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new Error('Evolution API configuration not found');
    }

    let result: any = {};

    switch (action) {
      case 'create':
        result = await createInstance(EVOLUTION_API_URL, EVOLUTION_API_KEY, instanceName, webhookUrl);
        
        // Store instance in database
        await supabase.from('whatsapp_instances').insert({
          instance_name: instanceName,
          status: 'created',
          webhook_url: webhookUrl,
          is_active: true
        });
        break;

      case 'connect':
        result = await connectInstance(EVOLUTION_API_URL, EVOLUTION_API_KEY, instanceName);
        
        // Update instance status
        await supabase.from('whatsapp_instances').update({
          status: 'connecting'
        }).eq('instance_name', instanceName);
        break;

      case 'disconnect':
        result = await disconnectInstance(EVOLUTION_API_URL, EVOLUTION_API_KEY, instanceName);
        
        // Update instance status
        await supabase.from('whatsapp_instances').update({
          status: 'disconnected'
        }).eq('instance_name', instanceName);
        break;

      case 'delete':
        result = await deleteInstance(EVOLUTION_API_URL, EVOLUTION_API_KEY, instanceName);
        
        // Remove instance from database
        await supabase.from('whatsapp_instances').delete().eq('instance_name', instanceName);
        break;

      case 'status':
        result = await getInstanceStatus(EVOLUTION_API_URL, EVOLUTION_API_KEY, instanceName);
        
        // Update instance status in database
        if (result.instance) {
          await supabase.from('whatsapp_instances').update({
            status: result.instance.state,
            phone_number: result.instance.owner?.split('@')[0] || null
          }).eq('instance_name', instanceName);
        }
        break;

      case 'qr':
        result = await getQRCode(EVOLUTION_API_URL, EVOLUTION_API_KEY, instanceName);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error managing instance:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function createInstance(apiUrl: string, apiKey: string, instanceName: string, webhookUrl: string) {
  const response = await fetch(`${apiUrl}/instance/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    },
    body: JSON.stringify({
      instanceName,
      webhook: webhookUrl,
      events: [
        'APPLICATION_STARTUP',
        'QRCODE_UPDATED',
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'MESSAGES_DELETE',
        'SEND_MESSAGE',
        'CONTACTS_SET',
        'CONTACTS_UPSERT',
        'CONTACTS_UPDATE',
        'PRESENCE_UPDATE',
        'CHATS_SET',
        'CHATS_UPSERT',
        'CHATS_UPDATE',
        'CHATS_DELETE',
        'GROUPS_UPSERT',
        'GROUP_UPDATE',
        'GROUP_PARTICIPANTS_UPDATE',
        'CONNECTION_UPDATE',
        'CALL',
        'NEW_JWT_TOKEN'
      ]
    }),
  });

  return await response.json();
}

async function connectInstance(apiUrl: string, apiKey: string, instanceName: string) {
  const response = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
    method: 'GET',
    headers: {
      'apikey': apiKey,
    },
  });

  return await response.json();
}

async function disconnectInstance(apiUrl: string, apiKey: string, instanceName: string) {
  const response = await fetch(`${apiUrl}/instance/logout/${instanceName}`, {
    method: 'DELETE',
    headers: {
      'apikey': apiKey,
    },
  });

  return await response.json();
}

async function deleteInstance(apiUrl: string, apiKey: string, instanceName: string) {
  const response = await fetch(`${apiUrl}/instance/delete/${instanceName}`, {
    method: 'DELETE',
    headers: {
      'apikey': apiKey,
    },
  });

  return await response.json();
}

async function getInstanceStatus(apiUrl: string, apiKey: string, instanceName: string) {
  const response = await fetch(`${apiUrl}/instance/fetchInstances/${instanceName}`, {
    method: 'GET',
    headers: {
      'apikey': apiKey,
    },
  });

  return await response.json();
}

async function getQRCode(apiUrl: string, apiKey: string, instanceName: string) {
  const response = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
    method: 'GET',
    headers: {
      'apikey': apiKey,
    },
  });

  return await response.json();
}