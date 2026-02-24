import { useState, useEffect } from 'react';
import { Monitor } from 'lucide-react';

const BREAKPOINT = 1024;

export default function MobileGuard({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < BREAKPOINT);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (isMobile) {
    return (
      <div className="min-h-screen bg-vb-bg flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center mx-auto mb-6">
            <Monitor className="w-8 h-8 text-brand" />
          </div>
          <h1 className="text-xl font-bold text-vb-text mb-2">Desktop Required</h1>
          <p className="text-vb-text-muted text-sm leading-relaxed">
            VealBiz is designed for desktop use. Please switch to a computer or widen your browser window to access the platform.
          </p>
          <div className="mt-6 text-vb-text-faint text-xs">
            A mobile app is coming soon.
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
