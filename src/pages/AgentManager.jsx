import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import AgentCard from '@/components/agents/AgentCard';
import AgentForm from '@/components/agents/AgentForm';

export default function AgentManager() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // null | 'new' | agent object
  const [showForm, setShowForm] = useState(false);

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => base44.entities.Agent.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Agent.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setShowForm(false);
      setEditing(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Agent.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setShowForm(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Agent.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });

  const handleSave = (formData) => {
    if (editing && editing !== 'new') {
      updateMutation.mutate({ id: editing.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (agent) => {
    setEditing(agent);
    setShowForm(true);
  };

  const handleDelete = (agent) => {
    if (confirm(`Delete agent "${agent.name}"?`)) {
      deleteMutation.mutate(agent.id);
    }
  };

  const redAgents = agents.filter(a => a.team === 'red');
  const blueAgents = agents.filter(a => a.team === 'blue');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage Red and Blue team AI agents</p>
        </div>
        <Button
          onClick={() => { setEditing('new'); setShowForm(true); }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" /> Create Agent
        </Button>
      </div>

      {showForm && (
        <AgentForm
          agent={editing !== 'new' ? editing : null}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          saving={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Red Team */}
      <div>
        <h2 className="text-sm font-semibold text-red-team uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-team" />
          Red Team — Attackers
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {redAgents.map(agent => (
            <AgentCard key={agent.id} agent={agent} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
        {redAgents.length === 0 && (
          <p className="text-sm text-muted-foreground">No red team agents</p>
        )}
      </div>

      {/* Blue Team */}
      <div>
        <h2 className="text-sm font-semibold text-blue-team uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-team" />
          Blue Team — Defenders
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {blueAgents.map(agent => (
            <AgentCard key={agent.id} agent={agent} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
        {blueAgents.length === 0 && (
          <p className="text-sm text-muted-foreground">No blue team agents</p>
        )}
      </div>
    </div>
  );
}