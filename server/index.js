const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3008;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
const publicPath = fs.existsSync(path.join(__dirname, 'public'))
  ? path.join(__dirname, 'public')
  : path.join(__dirname, '../public');

app.use(express.static(publicPath));

// ── Data helpers ──────────────────────────────────────────────────────────────

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { communications: [] };
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    if (!raw || raw.trim() === '') return { communications: [] };
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading/parsing state:', err);
    return { communications: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function generateId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

// ── API Routes ───────────────────────────────────────────────────────────────

// GET /communications/:agent
app.get('/api/communications/:agent', (req, res) => {
  try {
    const { agent } = req.params;
    const { filter = 'all' } = req.query;
    const data = readData();

    let results = data.communications.filter(
      c => c.origin === agent || c.destination === agent
    );

    if (filter === 'pending') {
      // Communications this agent needs to answer (is destination + not answered)
      results = results.filter(c => c.destination === agent && c.status === 'pending');
    } else if (filter === 'answered') {
      // Communications answered for this agent (is origin + answered)
      results = results.filter(c => c.origin === agent && c.status === 'answered');
    } else if (filter === 'processed') {
      // Communications that have been processed (answered + processed = true)
      results = results.filter(c => c.status === 'answered' && c.processed === true);
    }

    // Sort by createdAt descending (most recent first)
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ communications: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /communications/:agent/pending-process ──────────────────────────────
// Returns answered communications where agent is origin and not yet processed

app.get('/api/communications/:agent/pending-process', (req, res) => {
  try {
    const { agent } = req.params;
    const data = readData();

    const results = data.communications
      .filter(c => c.origin === agent && c.status === 'answered' && !c.processed)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ communications: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /communications ─────────────────────────────────────────────────────
// Body: { origin, destination, title, description }

app.post('/api/communications', (req, res) => {
  try {
    const { origin, destination, title, description, action } = req.body;

    if (!origin || !destination || !title) {
      return res.status(400).json({ error: 'origin, destination and title are required' });
    }

    const data = readData();

    const comm = {
      id: generateId(),
      origin,
      destination,
      title,
      description: description || '',
      action: action || null,
      status: 'pending',
      processed: false,
      answer: null,
      answeredAt: null,
      processedAt: null,
      createdAt: new Date().toISOString()
    };

    data.communications.push(comm);
    writeData(data);

    res.status(201).json({ communication: comm });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /communications/:id/answer ──────────────────────────────────────────
// Body: { answer }

app.put('/api/communications/:id/answer', (req, res) => {
  try {
    const { id } = req.params;
    const { answer } = req.body;

    if (answer === undefined) {
      return res.status(400).json({ error: 'answer is required' });
    }

    const data = readData();
    const comm = data.communications.find(c => c.id === id);

    if (!comm) {
      return res.status(404).json({ error: 'Communication not found' });
    }

    comm.answer = answer;
    comm.status = 'answered';
    comm.answeredAt = new Date().toISOString();

    writeData(data);

    res.json({ communication: comm });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /communications/:id/mark-processed ────────────────────────────────────

app.put('/api/communications/:id/mark-processed', (req, res) => {
  try {
    const { id } = req.params;
    const data = readData();
    const comm = data.communications.find(c => c.id === id);

    if (!comm) {
      return res.status(404).json({ error: 'Communication not found' });
    }

    // Auto-answer if still pending (prevents inconsistent state)
    if (comm.status === 'pending') {
      comm.answer = 'Process completed';
      comm.status = 'answered';
      comm.answeredAt = new Date().toISOString();
    }

    comm.processed = true;
    comm.processedAt = new Date().toISOString();

    writeData(data);

    res.json({ communication: comm });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /communications/:id ──────────────────────────────────────────────

app.delete('/api/communications/:id', (req, res) => {
  try {
    const { id } = req.params;
    const data = readData();
    const index = data.communications.findIndex(c => c.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Communication not found' });
    }

    const deleted = data.communications.splice(index, 1)[0];
    writeData(data);

    res.json({ success: true, deleted: deleted.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /communications/:id ───────────────────────────────────────────────────

app.get('/api/debug', (req, res) => {
  try {
    const info = {
      __dirname,
      cwd: process.cwd(),
      publicPath,
      exists: fs.existsSync(publicPath),
      contents: fs.readdirSync(__dirname),
      publicContents: fs.existsSync(publicPath) ? fs.readdirSync(publicPath) : 'NOT FOUND'
    };
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/communications/detail/:id', (req, res) => {
  try {
    const { id } = req.params;
    const data = readData();
    const comm = data.communications.find(c => c.id === id);

    if (!comm) {
      return res.status(404).json({ error: 'Communication not found' });
    }

    res.json({ communication: comm });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log('Agent Coordinator API running on port ' + PORT);
});
