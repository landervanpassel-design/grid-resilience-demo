import React from 'react';
import { SimResult, SimParams } from '../simulation/engine';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ExportButton({ result, params }: { result: SimResult | null, params: SimParams }) {
  
  const handleExport = () => {
    if (!result) return;
    
    // Create CSV
    const header = ['t', 'mean_delta', 'p10_delta', 'p90_delta', ...result.paths.map((_, i) => `path_${i}`)].join(',');
    
    const rows = result.mean_delta.map((mean, i) => {
      const t = (i * (10.0 / (result.mean_delta.length - 1))).toFixed(4);
      const cols = [
        t,
        mean.toFixed(6),
        result.p10_delta[i].toFixed(6),
        result.p90_delta[i].toFixed(6)
      ];
      result.paths.forEach(p => {
        cols.push(p.delta[i].toFixed(6));
      });
      return cols.join(',');
    });

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stochastic_reconstruction_${params.mode}_mc${params.num_paths}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleExport}
      disabled={!result}
      className="font-mono text-xs border-border bg-background hover:bg-card hover:text-primary"
    >
      <Download className="w-3 h-3 mr-2" />
      Export CSV
    </Button>
  );
}
