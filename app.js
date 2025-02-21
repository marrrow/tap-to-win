// app.js
const express = require('express');
const app = express();
const port = 3000;

// Use JSON body parser and serve static files from "public"
app.use(express.json());
app.use(express.static('public'));

/*
  In-memory demo storage.
  NOTE: For a real multi-user app, you’d need persistent storage and per-user data.
*/
let taps = []; // Each tap: { user: { id, username }, timestamp: number }
let roundStartTime = Date.now();
let jackpot = 0;

// Global credits for non-owner users (for demo purposes)
let credits = 100; // This applies for any user except owner; owner gets free taps

// Set round duration to 1 minute (60,000 ms)
const ROUND_DURATION = 60 * 1000; 

// Owner Telegram ID (provided)
const OWNER_ID = 252205625;

// Endpoint to record a tap
app.post('/tap', (req, res) => {
  // Expecting req.body.user to be an object: { id: number, username: string }
  const user = req.body.user || { id: 0, username: 'Anonymous' };
  const timestamp = Date.now();

  // Only allow taps during the current round
  if (timestamp - roundStartTime > ROUND_DURATION) {
    return res.status(400).json({ status: 'error', message: 'Round over. Please wait for the next round.' });
  }
  
  // For non-owner users, check and deduct credits
  if (user.id !== OWNER_ID) {
    if (credits <= 0) {
      return res.status(400).json({ status: 'error', message: 'No credits left.' });
    }
    credits -= 1;
  }
  // For every tap, increment jackpot by 1 unit
  jackpot += 1;
  taps.push({ user, timestamp });
  
  res.json({ status: 'ok', message: 'Tap recorded', timestamp, credits, jackpot });
});

// Endpoint to draw the winner at the end of the round
app.get('/draw', (req, res) => {
  const roundEndTime = roundStartTime + ROUND_DURATION;
  // Ensure draw happens only after the round ends
  if (Date.now() < roundEndTime) {
    return res.status(400).json({ status: 'error', message: 'Round still in progress.' });
  }
  
  // Filter taps for the current round
  const roundTaps = taps.filter(t => t.timestamp >= roundStartTime);
  if (roundTaps.length === 0) {
    return res.json({ status: 'error', message: 'No taps recorded this round.' });
  }
  
  // Generate a random winning time within the round interval
  const winningTime = roundStartTime + Math.floor(Math.random() * (roundEndTime - roundStartTime));
  
  // Calculate absolute differences for each tap
  const results = roundTaps.map(tap => ({
    user: tap.user,
    timestamp: tap.timestamp,
    diff: Math.abs(tap.timestamp - winningTime)
  }));
  
  // Sort taps by closeness to winning time (smallest difference first)
  results.sort((a, b) => a.diff - b.diff);
  // Assign rank based on sorted order (1 = closest)
  results.forEach((result, index) => result.rank = index + 1);
  
  const winningTap = results[0];
  
  res.json({
    status: 'ok',
    winningTime,
    winningTap,
    results,        // All taps with diff and rank
    roundStartTime,
    roundEndTime,
    jackpot
  });
});

// Endpoint to manually reset the round (for testing/new tournament)
app.get('/reset', (req, res) => {
  taps = [];
  roundStartTime = Date.now();
  // For demo, non-owner users get 100 credits each round; owner's free taps remain free
  credits = 100;
  jackpot = 0;
  res.json({ status: 'ok', message: 'Round reset.', roundStartTime, roundEndTime: roundStartTime + ROUND_DURATION, credits, jackpot });
});

app.listen(port, () => {
  console.log(`Tap to Win app is running at http://localhost:${port}`);
});
