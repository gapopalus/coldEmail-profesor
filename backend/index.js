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

function safeParseJSON(text) {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]);
  } catch (e) {
    try {
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return [];
      let fixed = match[0];
      fixed = fixed.replace(/"([^"]*)"/g, (fullMatch, inner) => {
        const escaped = inner
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        return `"${escaped}"`;
      });
      return JSON.parse(fixed);
    } catch (e2) {
      try {
        const objects = [];
        const objRegex = /\{[\s\S]*?"emailDraft"[\s\S]*?\}/g;
        let objMatch;
        while ((objMatch = objRegex.exec(text)) !== null) {
          try {
            let objText = objMatch[0];
            objText = objText.replace(/"([^"]*)"/g, (fullMatch, inner) => {
              const escaped = inner
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t');
              return `"${escaped}"`;
            });
            objects.push(JSON.parse(objText));
          } catch (e3) {
            continue;
          }
        }
        return objects;
      } catch (e3) {
        return [];
      }
    }
  }
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
      const googleQuery = `${university} computer science engineering data science professor research ${focuses.join(' ')}`;
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`;
      const response = await axios.get(googleUrl, { headers, timeout: 8000 });
      const $ = cheerio.load(response.data);
      scrapedText = $('body').text().slice(0, 4000);
    } catch (e) {
      scrapedText = '';
    }

    const prompt = `You are helping a high school student write personalized, compelling cold emails to university professors for summer 2026 research internship opportunities.

The emails should feel genuine and human — like a real student who has done their homework on the professor's work. They should be confident and specific, but not overwhelming or overly formal. Think of it as a well-written email, not an essay.

University: ${university}
Student profile:
- Name: ${profile.name || 'Gautam Arora'}
- School: ${profile.school || 'American High School in Fremont, CA'}
- Year: High school junior, Class of 2028
- Major interest: ${profile.major || 'Computer Science'}
- Student background (use this as source material — do NOT copy word for word. Expand, elevate, and connect it creatively to the professor's specific research): ${profile.background || 'interested in CS research'}

Research areas to focus on: ${focuses.join(', ')}

${scrapedText ? `Web context found:\n${scrapedText}\n` : ''}

Based on your knowledge of ${university}'s CS, engineering, and data science departments, generate a list of 5 real professors whose research relates to the focus areas. Include professors from CS, electrical engineering, robotics, data science, and adjacent fields.

For each professor provide:
1. Their real name
2. Department
3. 3-4 research interests (short phrases)
4. Their likely university email
5. A personalized cold email (400-450 words) following this EXACT structure. Use [PARA] to separate paragraphs — never use actual line breaks inside the emailDraft string.

IMPORTANT RULES FOR TONE AND VOICE:
- The email is addressed DIRECTLY to the professor. Use "you" and "your" — never refer to the professor in third person (e.g. never say "Professor Smith's research", say "your research")
- The greeting must be: "Dear Professor [Last Name],"
- The tone should be warm, confident, and natural — not stiff or overly academic
- Do not cram too much into each paragraph — be selective and specific rather than exhaustive

PARAGRAPH 1 — Introduction + hook (2-3 sentences):
- First sentence: "I'm [student name], a high school junior (Class of 2028) at [school name]."
- Then reference something SPECIFIC about the professor's research — name an actual paper, project, system, or finding. Be precise.
- Briefly explain what about that specific work caught your attention. Keep it focused, not gushing.

PARAGRAPH 2 — Student background connected to their work (3-4 sentences):
- Describe the student's relevant experience in a way that feels natural and impressive.
- Do NOT copy the background info word for word — elevate it, add technical detail, make it sound accomplished.
- Draw a clear, specific connection between the student's experience and the professor's research area.

PARAGRAPH 3 — Genuine engagement with their research (2-3 sentences):
- Show you've thought about their work beyond the surface level.
- Reference a specific aspect — a methodology, an open question, or an implication — that genuinely interests you.
- Keep it tight. One focused observation is better than three vague ones.

PARAGRAPH 4 — The ask + why you'd be useful (3-4 sentences):
- State clearly that you're looking for a summer 2026 research internship.
- Make a specific case for why your background would be useful in their lab — connect your skills to their actual work.
- Sound like an asset, not just someone looking for experience.

PARAGRAPH 5 — Close (2 sentences):
- Ask if they'd be open to a brief conversation — a call, a meeting, or even a quick email exchange.
- End with: "Best," then student name on the next line, then school name on the line after.

STRICT RULES:
- Use [PARA] between paragraphs — no actual newlines inside emailDraft
- Always use "you/your" when referring to the professor — never third person
- Always start with "Dear Professor [Last Name],"
- NEVER use: "I am writing to", "I would be honored", "passionate about", "I came across your work", "I hope this email finds you well"
- Reference something REAL and SPECIFIC about each professor's research
- Keep it to 400-450 words — quality over quantity

Respond ONLY with a valid JSON array:
[
  {
    "name": "Professor Full Name",
    "department": "Department Name",
    "researchInterests": ["interest 1", "interest 2", "interest 3"],
    "email": "professor@university.edu",
    "emailDraft": "Dear Professor [Last Name],[PARA]Paragraph 1[PARA]Paragraph 2[PARA]Paragraph 3[PARA]Paragraph 4[PARA]Paragraph 5[PARA]Best,[PARA][Student Name][PARA][School Name]"
  }
]

No markdown, no backticks, just the raw JSON array.`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.75,
      max_tokens: 6000,
    });

    let content = completion.choices[0]?.message?.content || '[]';
    content = content.replace(/```json|```/g, '').trim();

    const professors = safeParseJSON(content);

    const processedProfessors = professors.map(prof => ({
      ...prof,
      emailDraft: prof.emailDraft
        ? prof.emailDraft.replace(/\[PARA\]/g, '\n\n')
        : ''
    }));

    res.json({ professors: processedProfessors });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));