import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { filename, transcript, problemTitle } = req.body;

    if (!filename || !transcript) {
      return res.status(400).json({ error: 'Missing required fields: filename, transcript' });
    }

    // Create transcripts directory if it doesn't exist
    const transcriptDir = path.join(process.cwd(), 'transcripts');
    
    // Create directory synchronously (for serverless environment)
    if (!fs.existsSync(transcriptDir)) {
      fs.mkdirSync(transcriptDir, { recursive: true });
    }

    // Create file with metadata
    const timestamp = new Date().toISOString();
    const content = `Audio Transcription Log
Problem: ${problemTitle || 'Unknown'}
Timestamp: ${timestamp}
${'='.repeat(80)}

${transcript}

${'='.repeat(80)}
End of transcription
`;

    // Write file
    const filePath = path.join(transcriptDir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');

    console.log(`[save-transcript] Saved transcript to ${filePath}`);

    return res.status(200).json({
      success: true,
      filename,
      filepath: filePath,
      message: `Transcript saved successfully`,
    });
  } catch (error: any) {
    console.error('[save-transcript] Error:', {
      message: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to save transcript',
    });
  }
}
