import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Users, Settings, LogOut } from 'lucide-react';

const NAVIGATION = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Jobs', href: '/jobs', icon: Briefcase },
  { name: 'Candidates', href: '/candidates', icon: Users },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <div className="hidden border-r bg-gray-50/40 lg:block lg:w-64 h-screen sticky top-0">
      <div className="flex h-16 items-center border-b px-6">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl">
          <span className="text-primary">Veal</span>Biz
        </Link>
      </div>
      <div className="flex flex-col gap-2 p-4">
        {NAVIGATION.map((item) => {
          const isActive = location.pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                isActive 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-primary hover:bg-gray-100'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </div>
      <div className="absolute bottom-4 left-0 right-0 px-4">
        <Link
          to="/login"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-all"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Link>
      </div>
    </div>
  );
}