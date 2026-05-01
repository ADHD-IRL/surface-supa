import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import StatsCards from '@/components/dashboard/StatsCards';
import AgentStatusGrid from '@/components/dashboard/AgentStatusGrid';
import SessionsList from '@/components/dashboard/SessionsList';

export default function Dashboard() {
  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => base44.entities.Session.list('-created_date', 50),
  });

  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => base44.entities.Agent.list(),
  });

  const isLoading = loadingSessions || loadingAgents;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Adversarial risk analysis overview</p>
      </div>

      <StatsCards sessions={sessions} />
      <AgentStatusGrid agents={agents} />
      <SessionsList sessions={sessions} />
    </div>
  );
}