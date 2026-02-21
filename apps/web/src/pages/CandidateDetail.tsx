import { useParams } from 'react-router-dom';

export default function CandidateDetail() {
  const { id } = useParams();

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sarah Johnson</h1>
          <p className="text-muted-foreground mt-1">Applied for Senior Frontend Developer</p>
        </div>
        <div className="flex gap-2">
           <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80">
            Score: 98%
          </span>
          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
            Interview Stage
          </span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <h3 className="font-semibold leading-none tracking-tight mb-4">AI Summary</h3>
            <p className="text-sm text-muted-foreground">
              Sarah is an exceptional candidate with strong experience in React and TypeScript.
              Her resume indicates 5 years of relevant experience at top tech companies.
            </p>
          </div>

          <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <h3 className="font-semibold leading-none tracking-tight mb-4">Experience</h3>
            <div className="space-y-4">
              <div>
                <div className="font-medium">Senior Developer at TechCorp</div>
                <div className="text-sm text-muted-foreground">2020 - Present</div>
                <p className="text-sm mt-1">Led frontend team of 5...</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <h3 className="font-semibold leading-none tracking-tight mb-4">Contact</h3>
            <div className="space-y-2 text-sm">
              <div>sarah@example.com</div>
              <div>+234 800 000 0000</div>
              <div>Lagos, Nigeria</div>
            </div>
          </div>

          <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <h3 className="font-semibold leading-none tracking-tight mb-4">Skills</h3>
            <div className="flex flex-wrap gap-2">
              {['React', 'TypeScript', 'Node.js', 'Tailwind'].map(skill => (
                <span key={skill} className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}