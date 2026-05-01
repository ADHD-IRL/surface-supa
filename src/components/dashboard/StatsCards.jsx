import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function StatsCards({ sessions }) {
  const total = sessions.length;
  const running = sessions.filter(s => s.status === 'running').length;
  const completed = sessions.filter(s => s.status === 'completed').length;
  const totalRisks = sessions.reduce((sum, s) => sum + (s.risk_registry?.length || 0), 0);

  const stats = [
    { label: 'Total Sessions', value: total, color: 'text-primary' },
    { label: 'Running', value: running, color: 'text-amber-500' },
    { label: 'Completed', value: completed, color: 'text-green-team' },
    { label: 'Risks Found', value: totalRisks, color: 'text-red-team' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-5 bg-card border border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
          <p className={cn("text-3xl font-bold mt-1 tracking-tight", stat.color)}>{stat.value}</p>
        </Card>
      ))}
    </div>
  );
}