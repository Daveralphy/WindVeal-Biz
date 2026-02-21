import { Bell, User } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-6 shadow-sm">
      <div className="flex flex-1 items-center justify-end gap-4">
        <button className="relative rounded-full bg-background p-2 text-muted-foreground hover:text-foreground focus:outline-none">
          <span className="sr-only">View notifications</span>
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-600 ring-2 ring-white" />
        </button>
        
        <div className="flex items-center gap-2 border-l pl-4">
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium">John Doe</span>
            <span className="text-xs text-muted-foreground">Acme Corp</span>
          </div>
          <button className="rounded-full bg-gray-100 p-2">
            <User className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>
    </header>
  );
}