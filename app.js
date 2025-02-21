// app.js
const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

/*
  Continuous game state:
  - taps: array of taps (each tap costs 1 tap unit) for the current round.
  - roundStartTime: start time of the current round.
  - jackpot: accumulated jackpot for the current round.
  - userTaps: persistent tap balances for each user.
*/
let taps = []; // Each tap: { user: { id, username }, timestamp: number }
let roundStartTime = Date.now();
let jackpot = 0;
let userTaps = {}; // Persistent tap balances per user

const defaultTaps = 0;          // Normal users start with 0 taps (they must buy)
const ownerTaps = 1000000;      // Owner gets a million taps
const ROUND_DURATION = 60 * 1000; // 1 minute

// Owner Telegram ID (provided)
const OWNER_ID = 252205625;

// Ensure a user’s tap balance is initialized
function ensureUserBalance(user) {
  if (userTaps[user.id] === undefined) {
    userTaps[user.id] = (user.id === OWNER_ID) ? ownerTaps : defaultTaps;
  }
  return userTaps[user.id];
}

// Endpoint to "buy" taps (simulate purchase)
// For simplicity, this adds a fixed number (e.g., 50) to the user's balance
app.post('/buy', (req, res) => {
  const user = req.body.user || { id: 0, username: 'Anonymous' };
  // In a real implementation, you would verify payment via Telegram Stars or TON blockchain
  const purchaseAmount = parseInt(req.body.amount) || 50;
  ensureUserBalance(user);
  // For normal users, add taps
  if (user.id !== OWNER_ID) {
    userTaps[user.id] += purchaseAmount;
  }
  res.json({ status: 'ok', message: `Purchased ${purchaseAmount} taps`, balance: userTaps[user.id] });
});

// POST /tap – record a tap, which costs 1 tap unit for non‑owners
app.post('/tap', (req, res) => {
  const user = req.body.user || { id: 0, username: 'Anonymous' };
  ensureUserBalance(user);
  const timestamp = Date.now();

  // Check if within current round
  if (timestamp - roundStartTime > ROUND_DURATION) {
    return res.status(400).json({ status: 'error', message: 'Round over. Please wait for the next round.' });
  }

  // Non-owners must have at least 1 tap to play
  if (user.id !== OWNER_ID) {
    if (userTaps[user.id] <= 0) {
      return res.status(400).json({ status: 'error', message: 'Insufficient taps. Please buy taps to play.' });
    }
    userTaps[user.id] -= 1;
  }
  jackpot += 1;
  taps.push({ user, timestamp });
  res.json({ status: 'ok', message: 'Tap recorded', timestamp, balance: userTaps[user.id], jackpot });
});

// GET /draw – determine the winning tap, award the jackpot, and reset the round (preserving balances)
app.get('/draw', (req, res) => {
  const roundEndTime = roundStartTime + ROUND_DURATION;
  if (Date.now() < roundEndTime) {
    return res.status(400).json({ status: 'error', message: 'Round still in progress.' });
  }
  const roundTaps = taps.filter(t => t.timestamp >= roundStartTime);
  if (roundTaps.length === 0) {
    return res.json({ status: 'error', message: 'No taps recorded this round.' });
  }
  const winningTime = roundStartTime + Math.floor(Math.random() * (roundEndTime - roundStartTime));
  const results = roundTaps.map(tap => ({
    user: tap.user,
    timestamp: tap.timestamp,
    diff: Math.abs(tap.timestamp - winningTime)
  }));
  results.sort((a, b) => a.diff - b.diff);
  results.forEach((result, index) => result.rank = index + 1);
  const winningTap = results[0];

  ensureUserBalance(winningTap.user);
  userTaps[winningTap.user.id] += jackpot;

  const responseData = {
    status: 'ok',
    winningTime,
    winningTap,
    results,
    roundStartTime,
    roundEndTime,
    jackpot,
    winnerBalance: userTaps[winningTap.user.id]
  };

  // Reset round state (taps and jackpot), but keep userTaps intact
  taps = [];
  roundStartTime = Date.now();
  jackpot = 0;

  res.json(responseData);
});

// POST /balance – return current tap balance for a user
app.post('/balance', (req, res) => {
  const user = req.body.user || { id: 0, username: 'Anonymous' };
  const balance = ensureUserBalance(user);
  res.json({ status: 'ok', balance });
});

// GET /reset – for testing: reset only the current round state (does not affect userTaps)
app.get('/reset', (req, res) => {
  taps = [];
  roundStartTime = Date.now();
  jackpot = 0;
  res.json({ status: 'ok', message: 'Round reset.', roundStartTime, roundEndTime: roundStartTime + ROUND_DURATION, jackpot });
});

// Catch-all: serve index.html for any GET request not handled above
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Tap to Win app is running at http://localhost:${port}`);
});
