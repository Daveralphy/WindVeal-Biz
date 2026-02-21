import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ResumeParserProps {
  status: 'idle' | 'parsing' | 'success' | 'error';
  data?: {
    name: string;
    email: string;
    skills: string[];
    summary: string;
  };
}

export function ResumeParser({ status, data }: ResumeParserProps) {
  if (status === 'idle') return null;

  return (
    <div className="mt-6 border rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b flex items-center gap-2">
        {status === 'parsing' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
        {status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
        {status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
        <h3 className="font-medium text-sm">AI Analysis</h3>
      </div>
      
      <div className="p-4 bg-white">
        {status === 'parsing' && (
          <p className="text-sm text-muted-foreground">Extracting information and scoring candidate...</p>
        )}
        
        {status === 'error' && (
          <p className="text-sm text-red-600">Failed to parse resume. Please try again.</p>
        )}

        {status === 'success' && data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Name</label>
                <p className="text-sm font-medium">{data.name}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Email</label>
                <p className="text-sm font-medium">{data.email}</p>
              </div>
            </div>
            
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase">Professional Summary</label>
              <p className="text-sm text-gray-700 mt-1">{data.summary}</p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 uppercase">Detected Skills</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {data.skills.map(skill => (
                  <span key={skill} className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}