import { ReactNode } from 'react';

const FEATURES = [
  'AI-powered resume screening & candidate ranking',
  'Branded careers portal for your organization',
  'Visual pipeline with drag-and-drop management',
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left branded panel — ~35% width */}
      <div className="hidden lg:flex lg:w-[35%] bg-[#0D0D0D] flex-col justify-between p-10">
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight">VealBiz</h1>
        </div>

        <div className="space-y-6">
          <h2 className="text-white text-4xl font-bold leading-tight">
            Hire faster with
            <br />
            AI-driven precision.
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
            Streamline your recruitment process with intelligent automation.
            From resume parsing to candidate ranking — all in one platform.
          </p>

          <div className="space-y-3 pt-4">
            {FEATURES.map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                <span className="text-gray-300 text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {['JD', 'AK', 'SM', 'BO'].map((initials) => (
              <div
                key={initials}
                className="w-8 h-8 rounded-full bg-vb-card border-2 border-[#0D0D0D] flex items-center justify-center text-xs text-gray-300 font-medium"
              >
                {initials}
              </div>
            ))}
          </div>
          <span className="text-gray-500 text-xs">
            Trusted by 500+ Nigerian businesses
          </span>
        </div>
      </div>

      {/* Right content panel — ~65% width */}
      <div className="flex-1 bg-white flex items-center justify-center p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
