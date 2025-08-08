import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Users, 
  Smartphone, 
  Settings,
  Bot,
  Megaphone,
  BarChart3
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Chat', href: '/chat', icon: MessageSquare },
  { name: 'Contatos', href: '/contacts', icon: Users },
  { name: 'Instâncias', href: '/instances', icon: Smartphone },
  { name: 'Automações', href: '/automations', icon: Bot },
  { name: 'Campanhas', href: '/campaigns', icon: Megaphone },
  { name: 'Relatórios', href: '/reports', icon: BarChart3 },
  { name: 'Configurações', href: '/settings', icon: Settings },
];

const Sidebar = () => {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-sidebar">
      <div className="flex flex-col w-64 bg-sidebar border-r border-sidebar-border">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-sidebar-border">
          <div className="w-8 h-8 bg-whatsapp-primary rounded-lg flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-lg font-bold text-sidebar-foreground">
            CRM WhatsApp
          </h1>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            
            return (
              <Link key={item.name} to={item.href}>
                <Button
                  variant={isActive ? 'default' : 'ghost'}
                  className={cn(
                    'w-full justify-start gap-3 text-sidebar-foreground',
                    isActive && 'bg-whatsapp-primary text-white hover:bg-whatsapp-dark'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Button>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 p-3 bg-sidebar-accent rounded-lg">
            <div className="w-8 h-8 bg-whatsapp-primary rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-semibold">U</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-sidebar-foreground">Usuário</p>
              <p className="text-xs text-sidebar-foreground/60">Admin</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;