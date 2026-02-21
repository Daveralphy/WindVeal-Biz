import { CandidateCard } from './CandidateCard';

// Mock data
const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
const MOCK_CANDIDATES = [
  { id: 1, name: 'Sarah Johnson', score: 98, stage: 'Interview', jobTitle: 'Senior Frontend Dev' },
  { id: 2, name: 'Michael Chen', score: 85, stage: 'Screening', jobTitle: 'Senior Frontend Dev' },
  { id: 3, name: 'Jessica Williams', score: 92, stage: 'Applied', jobTitle: 'Senior Frontend Dev' },
];

export function CandidatePipeline() {
  return (
    <div className="flex h-full gap-4 overflow-x-auto pb-4">
      {STAGES.map((stage) => (
        <div key={stage} className="w-80 flex-shrink-0 flex flex-col bg-gray-50/50 rounded-lg border">
          <div className="p-3 font-medium border-b bg-white rounded-t-lg flex justify-between items-center sticky top-0">
            <span>{stage}</span>
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
              {MOCK_CANDIDATES.filter(c => c.stage === stage).length}
            </span>
          </div>
          <div className="p-3 flex-1 space-y-3 overflow-y-auto min-h-[200px]">
            {MOCK_CANDIDATES
              .filter((candidate) => candidate.stage === stage)
              .map((candidate) => (
                <CandidateCard key={candidate.id} {...candidate} />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}