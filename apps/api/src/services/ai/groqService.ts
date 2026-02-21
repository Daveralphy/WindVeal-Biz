import Groq from 'groq-sdk';

const apiKey = process.env.GROQ_API_KEY;
const isValidKey = apiKey && apiKey !== 'gsk_dummy_key_add_your_actual_key' && !apiKey.startsWith('gsk_dummy');

const groq = isValidKey ? new Groq({ apiKey }) : null;

export const getCompletion = async (prompt: string) => {
  if (!groq) {
    console.warn('Groq API key not configured. Returning empty response.');
    return '{}';
  }

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    model: 'mixtral-8x7b-32768',
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  return completion.choices[0]?.message?.content || '{}';
};