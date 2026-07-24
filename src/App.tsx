import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, Link, useLocation } from 'wouter';
import Demo from '@/pages/Demo';
import Benchmark from '@/pages/Benchmark';
import Event2003 from '@/pages/Event2003';

const queryClient = new QueryClient();

const TABS = [
  { path: '/',          label: 'Simulation',  sub: 'Interactive' },
  { path: '/benchmark', label: 'Benchmark',   sub: '6 methods' },
  { path: '/event-2003',label: '2003 Event',  sub: 'Replay' },
];

function NavTabs() {
  const [location] = useLocation();

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-0 border-b border-border bg-card/95 backdrop-blur-sm">
      {TABS.map(tab => {
        const active = tab.path === '/'
          ? location === '/' || location === ''
          : location.startsWith(tab.path);
        return (
          <Link key={tab.path} href={tab.path}
            className={`px-5 py-2.5 text-xs font-mono font-semibold tracking-widest uppercase transition-colors border-b-2 flex items-baseline gap-1.5
              ${active
                ? 'text-primary border-primary bg-primary/5'
                : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/30'}`}>
            {tab.label}
            <span className={`text-[8px] normal-case tracking-normal font-normal hidden sm:inline
              ${active ? 'text-primary/60' : 'text-zinc-700'}`}>{tab.sub}</span>
          </Link>
        );
      })}
      <div className="ml-auto pr-4 text-[9px] font-mono text-zinc-600">
        IEEE 9-bus · Van Passel 2026
      </div>
    </div>
  );
}

function Router() {
  return (
    <div className="pt-[41px] h-screen">
      <Switch>
        <Route path="/"           component={Demo} />
        <Route path="/benchmark"  component={Benchmark} />
        <Route path="/event-2003" component={Event2003} />
        <Route component={() => (
          <div className="flex items-center justify-center h-full font-mono text-muted-foreground">
            404 — Not Found
          </div>
        )} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <NavTabs />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
