const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const DB_PATH = path.join(__dirname, 'data.json');
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({ profile: {}, history: [] }));
}

function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

app.get('/api/profile', (req, res) => {
  const db = readDB();
  res.json(db.profile);
});

app.post('/api/profile', (req, res) => {
  const db = readDB();
  db.profile = req.body;
  writeDB(db);
  res.json({ success: true });
});

app.get('/api/history', (req, res) => {
  const db = readDB();
  res.json(db.history);
});

app.post('/api/history', (req, res) => {
  const db = readDB();
  db.history.push({ ...req.body, date: new Date().toISOString() });
  writeDB(db);
  res.json({ success: true });
});

app.post('/api/search', async (req, res) => {
  const { university, focuses, goals, profile } = req.body;

  try {
    let scrapedText = '';
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };

    try {
      const googleQuery = `${university} computer science engineering professor research ${focuses.join(' ')}`;
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`;
      const response = await axios.get(googleUrl, { headers, timeout: 8000 });
      const $ = cheerio.load(response.data);
      scrapedText = $('body').text().slice(0, 4000);
    } catch (e) {
      scrapedText = '';
    }

    const prompt = `A personalized cold email (250-300 words) from ${profile.name || 'the student'} to this professor.
   - Start with "Dear Prof. [Last Name],"
   - First paragraph: reference their SPECIFIC research topic in detail — not generic praise
   - Second paragraph: describe YOUR specific background, projects, skills that are directly relevant to their work. Be concrete — name actual projects, tools, awards.
   - Third paragraph: explain what specifically fascinates you about their research and how it connects to your experience
   - Fourth paragraph: make a clear ask — summer research internship or conversation about opportunities
   - Close with "Best," and the student's name
   - Tone: enthusiastic but professional, specific not generic
   - Do NOT use phrases like "I am writing to express my interest" or "I would be honored"
   - The email should feel like it was written by someone who actually read their papers

University: ${university}
Student profile:
- Name: ${profile.name || 'a rising junior'}
- School: ${profile.school || 'their university'}
- Major: ${profile.major || 'Computer Science'}
- Year: Rising Junior
- Background: ${profile.background || 'interested in CS research'}

Research areas to focus on: ${focuses.join(', ')}
Goals: ${goals.join(', ')}

${scrapedText ? `Web context found:\n${scrapedText}\n` : ''}

Based on your knowledge of ${university}'s CS and engineering department, generate a list of 5 real professors who work in the focus areas listed. For each professor provide:
1. Their real name
2. Department
3. 3-4 research interests (short phrases)
4. Their likely university email (format: firstname.lastname@university.edu or check known formats)
5. A personalized cold email (150-200 words) from ${profile.name || 'the student'} to this specific professor.
   - Reference their actual research specifically
   - Mention being a rising junior studying ${profile.major || 'CS'}
   - Ask about ${goals.join(' or ')}
   - Tone: genuine, curious, brief — not formal or stiff
   - Do NOT start with "I am writing to express my interest"
   - End with the student's name: ${profile.name || 'the student'}

Respond ONLY with a valid JSON array like this:
[
  {
    "name": "Professor Full Name",
    "department": "Department Name",
    "researchInterests": ["interest 1", "interest 2", "interest 3"],
    "email": "professor@university.edu",
    "emailDraft": "Full email text here..."
  }
]

No markdown, no backticks, just the raw JSON array.`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 4000,
    });

    let content = completion.choices[0]?.message?.content || '[]';
    content = content.replace(/```json|```/g, '').trim();
    const match = content.match(/\[[\s\S]*\]/);
    const professors = match ? JSON.parse(match[0]) : [];

    res.json({ professors });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));