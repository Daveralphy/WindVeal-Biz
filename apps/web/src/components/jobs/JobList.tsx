import { JobCard } from './JobCard';

// Mock data for now
const MOCK_JOBS = [
  {
    id: 1,
    title: 'Senior Frontend Developer',
    department: 'Engineering',
    location: 'Lagos, Nigeria',
    type: 'Full-time',
    candidateCount: 24,
  },
  {
    id: 2,
    title: 'Product Designer',
    department: 'Design',
    location: 'Remote',
    type: 'Contract',
    candidateCount: 12,
  },
  {
    id: 3,
    title: 'Backend Engineer',
    department: 'Engineering',
    location: 'Abuja, Nigeria',
    type: 'Full-time',
    candidateCount: 8,
  },
];

export function JobList() {
  return (
    <div className="grid gap-4">
      {MOCK_JOBS.map((job) => (
        <JobCard
          key={job.id}
          {...job}
        />
      ))}
    </div>
  );
}