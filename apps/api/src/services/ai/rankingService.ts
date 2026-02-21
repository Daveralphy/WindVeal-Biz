import { getCompletion } from './groqService';

interface AnalysisResult {
  name: string;
  email: string;
  score: number;
  summary: string;
  skills: string[];
}

export const rankCandidate = async (
  resumeText: string,
  jobDescription: string
): Promise<AnalysisResult> => {
  const prompt = `
    You are an expert AI recruiter. Analyze the following resume text against the job description.
    
    JOB DESCRIPTION:
    ${jobDescription}
    
    RESUME TEXT:
    ${resumeText.substring(0, 15000)}
    
    Extract the candidate's name and email if present.
    Evaluate the candidate and return a JSON object with:
    1. "name": Candidate name (or "Unknown" if not found)
    2. "email": Candidate email (or null if not found)
    3. "score": A number between 0-100 indicating the match percentage based on skills and experience.
    4. "summary": A brief 2-3 sentence professional summary of the candidate's fit.
    5. "skills": An array of matching technical and soft skills found in the resume.
    
    JSON Output:
  `;

  try {
    const jsonStr = await getCompletion(prompt);
    const result = JSON.parse(jsonStr);
    return {
      name: result.name || 'Unknown',
      email: result.email || null,
      score: typeof result.score === 'number' ? result.score : 0,
      summary: result.summary || 'Analysis failed',
      skills: Array.isArray(result.skills) ? result.skills : [],
    };
  } catch (error) {
    console.error('AI Ranking Error:', error);
    return {
      name: 'Unknown',
      email: null,
      score: 0,
      summary: 'AI analysis failed due to an error.',
      skills: [],
    };
  }
};