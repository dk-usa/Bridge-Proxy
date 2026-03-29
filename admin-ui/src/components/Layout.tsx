import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Server,
  Map,
  FileText,
  Activity,
  Key,
  Building2,
  Users,
  UserCircle,
  Route,
  KeyRound,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/providers', label: 'Providers', icon: Server },
  { href: '/models', label: 'Model Mappings', icon: Map },
  { href: '/keys', label: 'API Keys', icon: Key },
  { href: '/virtual-keys', label: 'Virtual Keys', icon: KeyRound },
  { href: '/routing', label: 'Routing', icon: Route },
  { href: '/orgs', label: 'Organizations', icon: Building2 },
  { href: '/teams', label: 'Teams', icon: Users },
  { href: '/users', label: 'Users', icon: UserCircle },
  { href: '/logs', label: 'Request Logs', icon: FileText },
  { href: '/stream', label: 'Streaming', icon: Activity },
];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold">Bridge Admin</h1>
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Button
                    key={item.href}
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    asChild
                  >
                    <Link to={item.href} className="gap-2">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </Button>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>API:</span>
            <code className="bg-muted px-2 py-1 rounded">http://localhost:3000</code>
          </div>
        </div>
      </header>
      <main className="container py-6 px-4">{children}</main>
    </div>
  );
}
