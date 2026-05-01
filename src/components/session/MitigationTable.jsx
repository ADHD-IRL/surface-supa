import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

function severityBadge(likelihood, impact) {
  const score = (likelihood || 1) * (impact || 1);
  if (score >= 16) return { label: 'Critical', score, className: 'bg-red-600 text-white' };
  if (score >= 10) return { label: 'High',     score, className: 'bg-orange-500 text-white' };
  if (score >= 5)  return { label: 'Medium',   score, className: 'bg-amber-400 text-black' };
  return               { label: 'Low',      score, className: 'bg-green-500 text-white' };
}

const statusStyles = {
  open:        'border-red-team/40 text-red-team bg-red-team/5',
  'in-progress': 'border-amber-500/40 text-amber-600 bg-amber-500/5',
  mitigated:   'border-green-team/40 text-green-team bg-green-team/5',
  accepted:    'border-muted-foreground/30 text-muted-foreground',
};

export default function MitigationTable({ risks }) {
  if (!risks?.length) return null;

  const sorted = [...risks].sort((a, b) => {
    const sa = (b.likelihood || 1) * (b.impact || 1);
    const sb = (a.likelihood || 1) * (a.impact || 1);
    return sa - sb;
  });

  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Risk Registry &amp; Mitigations
        </h3>
        <span className="text-xs text-muted-foreground">{risks.length} risk{risks.length !== 1 ? 's' : ''} identified</span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="text-xs font-semibold w-6 text-center">#</TableHead>
              <TableHead className="text-xs font-semibold min-w-[180px]">Risk</TableHead>
              <TableHead className="text-xs font-semibold w-28">Category</TableHead>
              <TableHead className="text-xs font-semibold w-24 text-center">Severity</TableHead>
              <TableHead className="text-xs font-semibold w-16 text-center">L × I</TableHead>
              <TableHead className="text-xs font-semibold min-w-[220px]">Mitigation</TableHead>
              <TableHead className="text-xs font-semibold w-28">Owner</TableHead>
              <TableHead className="text-xs font-semibold w-28">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((risk, i) => {
              const sev = severityBadge(risk.likelihood, risk.impact);
              const statusKey = (risk.status || '').toLowerCase().replace(/\s+/g, '-');
              const statusClass = statusStyles[statusKey] || statusStyles['accepted'];
              return (
                <TableRow key={i} className="align-top">
                  <TableCell className="text-center text-xs text-muted-foreground font-medium pt-4">{i + 1}</TableCell>
                  <TableCell className="pt-4">
                    <p className="font-semibold text-sm leading-snug">{risk.title}</p>
                    {risk.description && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed whitespace-pre-wrap">{risk.description}</p>
                    )}
                  </TableCell>
                  <TableCell className="pt-4">
                    <Badge variant="outline" className="text-xs capitalize whitespace-nowrap">{risk.category || '—'}</Badge>
                  </TableCell>
                  <TableCell className="pt-4 text-center">
                    <Badge className={cn("text-xs whitespace-nowrap", sev.className)}>{sev.label}</Badge>
                  </TableCell>
                  <TableCell className="pt-4 text-center text-xs font-mono text-muted-foreground whitespace-nowrap">
                    {risk.likelihood ?? '—'} × {risk.impact ?? '—'} = <span className="font-semibold text-foreground">{sev.score}</span>
                  </TableCell>
                  <TableCell className="pt-4 text-sm leading-relaxed whitespace-pre-wrap">{risk.mitigation || '—'}</TableCell>
                  <TableCell className="pt-4 text-sm text-muted-foreground whitespace-nowrap">{risk.owner || '—'}</TableCell>
                  <TableCell className="pt-4">
                    {risk.status ? (
                      <Badge variant="outline" className={cn("text-xs capitalize whitespace-nowrap", statusClass)}>
                        {risk.status}
                      </Badge>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
