import { Link } from 'react-router-dom';

interface CandidateCardProps {
  id: string | number;
  name: string;
  score: number;
  stage: string;
  jobTitle: string;
}

export function CandidateCard({ id, name, score, stage, jobTitle }: CandidateCardProps) {
  // Color coding for scores
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-green-100 text-green-800';
    if (score >= 70) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="bg-white p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-semibold truncate">{name}</h4>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${getScoreColor(score)}`}>
          {score}%
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{jobTitle}</p>
      <div className="flex justify-between items-center mt-2">
        <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">{stage}</span>
        <Link to={`/candidates/${id}`} className="text-xs text-primary hover:underline">
          View
        </Link>
      </div>
    </div>
  );
}