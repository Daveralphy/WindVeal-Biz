import { useParams } from 'react-router-dom';

export default function JobDetail() {
  const { id } = useParams();

  return (
    <div className="p-8 h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Senior Frontend Developer</h1>
          <div className="flex gap-2 mt-1 text-sm text-muted-foreground">
            <span>ID: {id}</span>
            <span>•</span>
            <span>Lagos, Nigeria</span>
          </div>
        </div>
        <button className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md text-sm font-medium">
          Add Candidate
        </button>
      </div>

      {/* Pipeline Board Placeholder */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 h-full min-w-max pb-4">
          {['Applied', 'Screening', 'Interview', 'Offer', 'Hired'].map((stage) => (
            <div key={stage} className="w-80 flex-shrink-0 flex flex-col bg-gray-50/50 rounded-lg border">
              <div className="p-4 font-medium border-b bg-white rounded-t-lg flex justify-between">
                {stage} <span className="text-muted-foreground text-sm">0</span>
              </div>
              <div className="p-2 flex-1">
                {/* Candidate cards will go here */}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}