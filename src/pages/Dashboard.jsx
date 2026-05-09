import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import StatsCards from '@/components/dashboard/StatsCards';
import SessionsList from '@/components/dashboard/SessionsList';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupByLineage, setGroupByLineage] = useState(true);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => base44.entities.Session.list('-created_date', 50),
    refetchInterval: (query) => {
      const data = query.state?.data;
      return data?.some(s => s.status === 'running') ? 5000 : false;
    },
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: () => base44.entities.Agent.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (sessionId) => base44.entities.Session.delete(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Adversarial risk analysis overview</p>
        </div>
        <Link to="/sessions/new">
          <Button className="gap-1.5">
            <Plus className="w-4 h-4" /> New Session
          </Button>
        </Link>
      </div>

      <StatsCards sessions={sessions} agents={agents} />

      <SessionsList
        sessions={sessions}
        onDelete={(id) => deleteMutation.mutate(id)}
        deletingId={deleteMutation.variables}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        groupByLineage={groupByLineage}
        setGroupByLineage={setGroupByLineage}
        agents={agents}
      />
    </div>
  );
}
