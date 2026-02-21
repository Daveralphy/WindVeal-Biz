import { Link } from 'react-router-dom';

interface JobCardProps {
  id: string | number;
  title: string;
  department: string;
  location: string;
  type: string;
  candidateCount: number;
}

export function JobCard({ id, title, department, location, type, candidateCount }: JobCardProps) {
  return (
    <div className="flex items-center justify-between p-6 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="flex gap-2 mt-1 text-sm text-muted-foreground">
          <span>{department}</span>
          <span>•</span>
          <span>{location}</span>
          <span>•</span>
          <span>{type}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right mr-4">
          <div className="text-2xl font-bold">{candidateCount}</div>
          <div className="text-xs text-muted-foreground">Candidates</div>
        </div>
        <Link 
          to={`/jobs/${id}`} 
          className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50 transition-colors"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}