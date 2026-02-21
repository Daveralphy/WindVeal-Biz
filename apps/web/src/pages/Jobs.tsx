import { Link } from 'react-router-dom';

export default function Jobs() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground mt-1">Manage your job postings and candidates.</p>
        </div>
        <Link
          to="/jobs/new"
          className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md text-sm font-medium"
        >
          Create Job
        </Link>
      </div>

      <div className="grid gap-4">
        {/* Placeholder for Job List */}
        {[1, 2, 3].map((job) => (
          <div key={job} className="flex items-center justify-between p-6 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div>
              <h3 className="text-lg font-semibold">Senior Frontend Developer</h3>
              <div className="flex gap-2 mt-1 text-sm text-muted-foreground">
                <span>Engineering</span>
                <span>•</span>
                <span>Lagos, Nigeria</span>
                <span>•</span>
                <span>Full-time</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right mr-4">
                <div className="text-2xl font-bold">24</div>
                <div className="text-xs text-muted-foreground">Candidates</div>
              </div>
              <Link to={`/jobs/${job}`} className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">
                View Details
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}