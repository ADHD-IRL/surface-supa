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
  if (score >= 16) return <Badge className="bg-red-600 text-white text-xs">Critical</Badge>;
  if (score >= 10) return <Badge className="bg-orange-500 text-white text-xs">High</Badge>;
  if (score >= 5) return <Badge className="bg-amber-400 text-black text-xs">Medium</Badge>;
  return <Badge className="bg-green-500 text-white text-xs">Low</Badge>;
}

export default function MitigationTable({ risks }) {
  if (!risks?.length) return null;

  return (
    <Card className="overflow-hidden">
      <div className="p-6 pb-0">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Risk Registry & Mitigations
        </h3>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead className="text-xs font-semibold">Risk</TableHead>
              <TableHead className="text-xs font-semibold">Category</TableHead>
              <TableHead className="text-xs font-semibold">Severity</TableHead>
              <TableHead className="text-xs font-semibold">Mitigation</TableHead>
              <TableHead className="text-xs font-semibold">Owner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {risks.map((risk, i) => (
              <TableRow key={i}>
                <TableCell>
                  <p className="font-medium text-sm">{risk.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{risk.description}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs capitalize">{risk.category}</Badge>
                </TableCell>
                <TableCell>{severityBadge(risk.likelihood, risk.impact)}</TableCell>
                <TableCell className="text-sm max-w-xs">{risk.mitigation}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{risk.owner || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}