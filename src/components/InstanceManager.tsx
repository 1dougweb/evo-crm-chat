import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Smartphone, QrCode, Power, Trash2 } from 'lucide-react';

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  phone_number: string | null;
  status: string;
  qr_code: string | null;
  is_active: boolean;
  created_at: string;
}

const InstanceManager = () => {
  const [newInstanceName, setNewInstanceName] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: instances, isLoading } = useQuery({
    queryKey: ['whatsapp-instances'],
    queryFn: async (): Promise<WhatsAppInstance[]> => {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const createInstanceMutation = useMutation({
    mutationFn: async (instanceName: string) => {
      const { data, error } = await supabase.functions.invoke('evolution-instance-manager', {
        body: {
          action: 'create',
          instanceName,
          webhookUrl: `${window.location.origin}/api/evolution-webhook`
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      setIsCreateDialogOpen(false);
      setNewInstanceName('');
      toast({ title: 'Instância criada com sucesso!' });
    },
    onError: (error) => {
      toast({ 
        title: 'Erro ao criar instância', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  });

  const connectInstanceMutation = useMutation({
    mutationFn: async (instanceName: string) => {
      const { data, error } = await supabase.functions.invoke('evolution-instance-manager', {
        body: { action: 'connect', instanceName }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      toast({ title: 'Conectando instância...' });
    },
    onError: (error) => {
      toast({ 
        title: 'Erro ao conectar', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  });

  const disconnectInstanceMutation = useMutation({
    mutationFn: async (instanceName: string) => {
      const { data, error } = await supabase.functions.invoke('evolution-instance-manager', {
        body: { action: 'disconnect', instanceName }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      toast({ title: 'Instância desconectada' });
    },
    onError: (error) => {
      toast({ 
        title: 'Erro ao desconectar', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  });

  const deleteInstanceMutation = useMutation({
    mutationFn: async (instanceName: string) => {
      const { data, error } = await supabase.functions.invoke('evolution-instance-manager', {
        body: { action: 'delete', instanceName }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      toast({ title: 'Instância removida' });
    },
    onError: (error) => {
      toast({ 
        title: 'Erro ao remover instância', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'open': return 'default';
      case 'connecting': return 'secondary';
      case 'qr_code': return 'outline';
      case 'disconnected': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Conectado';
      case 'connecting': return 'Conectando';
      case 'qr_code': return 'QR Code';
      case 'disconnected': return 'Desconectado';
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-48 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Instâncias WhatsApp</h1>
          <p className="text-muted-foreground">Gerencie suas conexões WhatsApp</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Instância
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Instância</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Nome da instância"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
              />
              <Button 
                onClick={() => createInstanceMutation.mutate(newInstanceName)}
                disabled={!newInstanceName || createInstanceMutation.isPending}
                className="w-full"
              >
                {createInstanceMutation.isPending ? 'Criando...' : 'Criar Instância'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {instances?.map((instance) => (
          <Card key={instance.id} className="relative">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                {instance.instance_name}
              </CardTitle>
              <Badge variant={getStatusVariant(instance.status)} className="w-fit">
                {getStatusLabel(instance.status)}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {instance.phone_number && (
                <p className="text-sm text-muted-foreground">
                  <strong>Número:</strong> {instance.phone_number}
                </p>
              )}
              
              {instance.qr_code && instance.status === 'qr_code' && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Escaneie o QR Code:</p>
                  <img 
                    src={instance.qr_code} 
                    alt="QR Code" 
                    className="mx-auto max-w-full h-32 object-contain"
                  />
                </div>
              )}
              
              <div className="flex gap-2">
                {instance.status === 'disconnected' || instance.status === 'qr_code' ? (
                  <Button
                    size="sm"
                    onClick={() => connectInstanceMutation.mutate(instance.instance_name)}
                    disabled={connectInstanceMutation.isPending}
                    className="gap-1"
                  >
                    <Power className="h-3 w-3" />
                    Conectar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => disconnectInstanceMutation.mutate(instance.instance_name)}
                    disabled={disconnectInstanceMutation.isPending}
                    className="gap-1"
                  >
                    <Power className="h-3 w-3" />
                    Desconectar
                  </Button>
                )}
                
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteInstanceMutation.mutate(instance.instance_name)}
                  disabled={deleteInstanceMutation.isPending}
                  className="gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Excluir
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {(!instances || instances.length === 0) && (
          <Card className="col-span-full">
            <CardContent className="text-center py-12">
              <Smartphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma instância encontrada</h3>
              <p className="text-muted-foreground">
                Crie sua primeira instância WhatsApp para começar a usar o CRM
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default InstanceManager;