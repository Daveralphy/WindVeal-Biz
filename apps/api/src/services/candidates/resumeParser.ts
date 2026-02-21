import pdf from 'pdf-parse';
import mammoth from 'mammoth';

export const parseResume = async (buffer: Buffer, mimeType: string): Promise<string> => {
  if (mimeType === 'application/pdf') {
    const data = await pdf(buffer);
    return data.text;
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  
  throw new Error(`Unsupported file type: ${mimeType}`);
};