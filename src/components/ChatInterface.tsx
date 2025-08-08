import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarInitial } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Send, Search, Phone, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Conversation {
  id: string;
  contact_id: string;
  status: string;
  unread_count: number;
  last_message: string;
  last_message_at: string;
  contacts: {
    name: string;
    phone: string;
  };
  whatsapp_instances: {
    instance_name: string;
  };
}

interface Message {
  id: string;
  content: string;
  sender_type: 'user' | 'contact';
  timestamp: string;
  status: string;
  message_type: string;
}

const ChatInterface = () => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: conversations, isLoading: loadingConversations } = useQuery({
    queryKey: ['conversations', searchTerm],
    queryFn: async (): Promise<Conversation[]> => {
      let query = supabase
        .from('conversations')
        .select(`
          *,
          contacts(name, phone),
          whatsapp_instances(instance_name)
        `)
        .order('last_message_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`contacts.name.ilike.%${searchTerm}%,contacts.phone.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ['messages', selectedConversationId],
    queryFn: async (): Promise<Message[]> => {
      if (!selectedConversationId) return [];
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', selectedConversationId)
        .order('timestamp', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedConversationId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, message }: { conversationId: string; message: string }) => {
      const conversation = conversations?.find(c => c.id === conversationId);
      if (!conversation) throw new Error('Conversa não encontrada');

      const { data, error } = await supabase.functions.invoke('evolution-send-message', {
        body: {
          instance: conversation.whatsapp_instances.instance_name,
          number: conversation.contacts.phone + '@s.whatsapp.net',
          message,
          messageType: 'text'
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast({ title: 'Mensagem enviada!' });
    },
    onError: (error) => {
      toast({ 
        title: 'Erro ao enviar mensagem', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  });

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Real-time updates for messages
  useEffect(() => {
    if (!selectedConversationId) return;

    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversationId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['messages', selectedConversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversationId, queryClient]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversationId) return;
    sendMessageMutation.mutate({ 
      conversationId: selectedConversationId, 
      message: newMessage.trim() 
    });
  };

  const selectedConversation = conversations?.find(c => c.id === selectedConversationId);

  return (
    <div className="flex h-[calc(100vh-2rem)] bg-background">
      {/* Conversations List */}
      <div className="w-1/3 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="p-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3 p-3">
                  <div className="w-12 h-12 bg-muted rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            conversations?.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => setSelectedConversationId(conversation.id)}
                className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 border-b border-border ${
                  selectedConversationId === conversation.id ? 'bg-whatsapp-light' : ''
                }`}
              >
                <Avatar>
                  <AvatarFallback>
                    {conversation.contacts.name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <p className="font-medium text-foreground truncate">
                      {conversation.contacts.name || conversation.contacts.phone}
                    </p>
                    {conversation.last_message_at && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(conversation.last_message_at), 'HH:mm', { locale: ptBR })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {conversation.last_message || 'Nenhuma mensagem'}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">
                      {conversation.whatsapp_instances.instance_name}
                    </span>
                    {conversation.unread_count > 0 && (
                      <Badge variant="default" className="bg-whatsapp-primary text-white">
                        {conversation.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          
          {!loadingConversations && (!conversations || conversations.length === 0) && (
            <div className="text-center p-8">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma conversa encontrada</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border bg-whatsapp-light">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    {selectedConversation.contacts.name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium text-foreground">
                    {selectedConversation.contacts.name || 'Sem nome'}
                  </h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {selectedConversation.contacts.phone}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-chat-bg">
              {loadingMessages ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={`animate-pulse flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                      <div className="bg-muted rounded-lg p-3 max-w-xs">
                        <div className="h-4 bg-muted-foreground/20 rounded"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {messages?.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`rounded-lg p-3 max-w-xs lg:max-w-md ${
                          message.sender_type === 'user'
                            ? 'bg-chat-sent text-white'
                            : 'bg-chat-received text-foreground'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.sender_type === 'user' ? 'text-white/70' : 'text-muted-foreground'
                        }`}>
                          {format(new Date(message.timestamp), 'HH:mm', { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-border bg-background">
              <div className="flex gap-2">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  Enviar
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-chat-bg">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Selecione uma conversa
              </h3>
              <p className="text-muted-foreground">
                Escolha uma conversa na lista para começar a enviar mensagens
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;