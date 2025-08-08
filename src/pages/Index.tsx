import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import ChatInterface from '@/components/ChatInterface';
import InstanceManager from '@/components/InstanceManager';

const Index = () => {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chat" element={<ChatInterface />} />
          <Route path="/instances" element={<InstanceManager />} />
          <Route path="/contacts" element={<div className="p-6"><h1 className="text-2xl font-bold">Contatos (Em breve)</h1></div>} />
          <Route path="/automations" element={<div className="p-6"><h1 className="text-2xl font-bold">Automações (Em breve)</h1></div>} />
          <Route path="/campaigns" element={<div className="p-6"><h1 className="text-2xl font-bold">Campanhas (Em breve)</h1></div>} />
          <Route path="/reports" element={<div className="p-6"><h1 className="text-2xl font-bold">Relatórios (Em breve)</h1></div>} />
          <Route path="/settings" element={<div className="p-6"><h1 className="text-2xl font-bold">Configurações (Em breve)</h1></div>} />
        </Routes>
      </main>
    </div>
  );
};

export default Index;
