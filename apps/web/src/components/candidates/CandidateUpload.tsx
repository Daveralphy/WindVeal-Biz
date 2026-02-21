import { useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';

export function CandidateUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    // Simulate upload
    setTimeout(() => {
      setIsUploading(false);
      setFile(null);
      alert('Resume uploaded successfully!');
    }, 1500);
  };

  return (
    <div className="p-6 border rounded-lg bg-white shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Upload Resume</h3>
      
      {!file ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors">
          <input
            type="file"
            id="resume-upload"
            className="hidden"
            accept=".pdf,.docx"
            onChange={handleFileChange}
          />
          <label htmlFor="resume-upload" className="cursor-pointer flex flex-col items-center">
            <Upload className="h-10 w-10 text-gray-400 mb-2" />
            <span className="text-sm font-medium text-gray-900">Click to upload</span>
            <span className="text-xs text-gray-500 mt-1">PDF or DOCX (max 5MB)</span>
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md border">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <div className="text-sm">
                <p className="font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <button onClick={() => setFile(null)} className="text-gray-500 hover:text-red-500">
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {isUploading ? 'Analyzing Resume...' : 'Process Candidate'}
          </button>
        </div>
      )}
    </div>
  );
}