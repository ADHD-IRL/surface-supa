import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import heroImage from '@/assets/surface-hero.jpg';

const FEATURES = [
  { label: 'Red vs Blue',       desc: 'Adversarial agent debate surfaces hidden risks from both sides' },
  { label: 'Multi-domain',      desc: 'Cyber, geopolitical, financial, operational, strategic analysis' },
  { label: 'Synthesis Report',  desc: 'Consensus findings, contested points, blind spots, compound chains and priority mitigations' },
  { label: 'Attack Chains',     desc: 'Step-by-step compound threat chains from initial access to impact' },
  { label: 'SCRS Score',        desc: 'Systemic Critical Risk Score: 0–100 composite weighted by agent expertise and chain resilience' },
  { label: 'Export to PDF',     desc: 'Decision-grade PDF with per-agent assessments, synthesis sections and SCRS score' },
];

export default function Splash() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Hero */}
      <div className="relative w-full overflow-hidden">
        <img
          src={heroImage}
          alt="Surface — Adversarial Risk Intelligence"
          className="w-full object-cover object-top max-h-[520px]"
        />
        {/* Gradient overlay so text sits cleanly on image */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />

        {/* CTA overlay on bottom of hero */}
        <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-12">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-2">
              Adversarial Risk Intelligence
            </p>
            <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-foreground leading-tight">
              Navigate Blind Spots,<br className="hidden sm:block" /> Second-Order Effects &amp; Cascading Failures
            </h1>
            <p className="mt-4 text-muted-foreground text-lg max-w-xl">
              Automated multi-agent Red/Blue team debates that reveal what single-perspective analysis misses.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <Link to="/sessions/new">
                <Button size="lg" className="gap-2 text-base">
                  Start Analysis <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button size="lg" variant="outline" className="gap-2 text-base">
                  View Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Feature grid */}
      <div className="max-w-5xl mx-auto w-full px-6 lg:px-8 py-16">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-8">
          What Surface does
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ label, desc }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-5 space-y-1.5">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm font-semibold">{label}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer strip */}
      <div className="mt-auto border-t border-border py-6 px-8 text-center text-xs text-muted-foreground">
        Surface · Adversarial Risk Intelligence · Confidential
      </div>
    </div>
  );
}
