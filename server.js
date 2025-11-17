import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.post('/api/scribe-token', async (req, res) => {
  const apiKey = process.env.VITE_ELEVENLABS_API_KEY;

  if (!apiKey || apiKey === 'your_elevenlabs_api_key_here') {
    return res.status(500).json({
      error: 'ElevenLabs API key not configured. Please set VITE_ELEVENLABS_API_KEY in .env file',
    });
  }

  try {
    const response = await fetch(
      'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe',
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    const data = await response.json();

    res.json({ token: data.token });
  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({
      error: 'Failed to generate token',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API server is running' });
});

app.listen(PORT, () => {
  console.log(`✅ API server running on http://localhost:${PORT}`);
  console.log(` Endpoints:`);
  console.log(`   POST http://localhost:${PORT}/api/scribe-token`);
  console.log(`   GET  http://localhost:${PORT}/api/health`);
});
