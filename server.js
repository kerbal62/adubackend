// server.js (CommonJS)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { OpenAI } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());
app.options('*', cors()); // ⚡️ thêm dòng này

const upload = multer({ storage: multer.memoryStorage() }); // lưu tạm vào memory

// Init OpenAI client
if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️ OPENAI_API_KEY not found in .env — create .env with OPENAI_API_KEY=sk-...');
}
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Health route
app.get('/', (req, res) => res.send('✅ Whisper backend running'));

// POST /transcribe
// Field name expected: "audio" (form-data file)
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    console.log("File uploaded:", req.file);
console.log("Exists?", fs.existsSync(req.file.path));
console.log("Size:", fs.statSync(req.file.path).size);
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No audio file received (field name must be "audio")' });
    }

    // write buffer to temp file (OpenAI can accept stream)
    const ext = path.extname(req.file.originalname) || '.webm';
    const tmpName = `upload-${Date.now()}${ext}`;
    const tmpPath = path.join(os.tmpdir(), tmpName);
    fs.writeFileSync(tmpPath, req.file.buffer);

    // call OpenAI transcription (gpt-4o-mini-transcribe or whisper model)
    // NOTE: pick model available to you; here we use gpt-4o-mini-transcribe as example
    const resp = await client.audio.transcriptions.create({
      file: fs.createReadStream(tmpPath),
      model: 'gpt-4o-mini-transcribe'
    });

    // cleanup temp file
    try { fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }

    // resp typically has .text
    const text = resp?.text ?? null;
    if (!text) {
      return res.status(500).json({ error: 'Transcription returned no text', raw: resp });
    }

    // Respond with transcription and simple metadata
    return res.json({
      text,
      sizeBytes: req.file.size,
      filename: req.file.originalname,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Transcribe error:', err);
    return res.status(500).json({ error: 'Server transcription error', details: err.message || err });
  }
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://0.0.0.0:${PORT}`));
