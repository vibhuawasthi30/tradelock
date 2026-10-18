
(function (root) {
  'use strict';
  function closedPositions(cards) {
    const seen = new Set();
    return (Array.isArray(cards) ? cards : []).filter(card => {
      if (!card || typeof card.id !== 'string' || !card.id || seen.has(card.id)) return false;
      if (![card.invested, card.received, card.openedAt, card.closedAt].every(Number.isFinite)) return false;
      if (card.invested <= 0 || card.received < 0 || card.closedAt < card.openedAt) return false;
      if (!Number.isFinite(card.received / card.invested)) return false;
      seen.add(card.id);
      return true;
    }).map(card => ({id: card.id, returnRate: card.received / card.invested - 1}));
  }
  function random(seed) {
    let state = seed >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }
  function percentile(sorted, fraction) {
    const index = (sorted.length - 1) * fraction, lower = Math.floor(index), part = index - lower;
    return sorted[lower] + (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * part;
  }
  function simulate(cards, settings = {}) {
    const positions = closedPositions(cards);
    if (positions.length < 10) throw Error('Complete at least 10 unique paper positions first.');
    const options = {mode: 'resample', runs: 1000, horizon: 100, balance: 100, fraction: .1, extraCost: 0, lossThreshold: .5, seed: 73017, ...settings};
    if (!['reshuffle', 'resample'].includes(options.mode)) throw Error('Choose reshuffle or resample.');
    if (!Number.isInteger(options.runs) || options.runs < 100 || options.runs > 5000) throw Error('Use 100–5,000 simulations.');
    if (!Number.isInteger(options.horizon) || options.horizon < 1 || options.horizon > 1000) throw Error('Use 1–1,000 positions per simulation.');
    if (!Number.isFinite(options.balance) || options.balance <= 0 || options.balance > 1e9) throw Error('Starting balance must be positive and at most one billion.');
    if (!Number.isFinite(options.fraction) || options.fraction <= 0 || options.fraction > 1) throw Error('Allocation must be above 0% and at most 100%.');
    if (!Number.isFinite(options.extraCost) || options.extraCost < 0 || options.extraCost > .05) throw Error('Extra cost must be 0–5% per side.');
    if (!Number.isFinite(options.lossThreshold) || options.lossThreshold <= 0 || options.lossThreshold >= 1) throw Error('Loss threshold must be between 0% and 100%.');
    if (!Number.isInteger(options.seed) || options.seed < 0 || options.seed > 4294967295) throw Error('Seed must be an unsigned 32-bit integer.');
    const horizon = options.mode === 'reshuffle' ? positions.length : options.horizon;
    // Added hypothetical entry/exit costs; existing simulated slippage stays in the returns.
    const returns = positions.map(p => (1 + p.returnRate) * (1 - options.extraCost) / (1 + options.extraCost) - 1);
    const rand = random(options.seed), steps = Array.from({length: horizon + 1}, () => []), endings = [], drawdowns = [], streaks = [];
    let endedBelowStart = 0, crossedThreshold = 0;
    for (let run = 0; run < options.runs; run++) {
      const order = returns.slice();
      if (options.mode === 'reshuffle') for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]];
      }
      let equity = options.balance, peak = equity, drawdown = 0, streak = 0, longest = 0, crossed = false;
      steps[0].push(equity);
      for (let i = 0; i < horizon; i++) {
        const rate = options.mode === 'reshuffle' ? order[i] : returns[Math.floor(rand() * returns.length)];
        equity *= 1 + options.fraction * rate;
        if (!Number.isFinite(equity)) throw Error('Balance overflow; reduce the allocation or simulation length.');
        peak = Math.max(peak, equity); drawdown = Math.max(drawdown, (peak - equity) / peak);
        streak = rate < -1e-10 ? streak + 1 : 0; longest = Math.max(longest, streak);
        if (equity <= options.balance * (1 - options.lossThreshold)) crossed = true;
        steps[i + 1].push(equity);
      }
      if (equity < options.balance - options.balance * 1e-10) endedBelowStart++;
      if (crossed) crossedThreshold++;
      endings.push(equity); drawdowns.push(drawdown); streaks.push(longest);
    }
    endings.sort((a,b) => a-b); drawdowns.sort((a,b) => a-b); streaks.sort((a,b) => a-b);
    return {options: {...options, horizon}, sampleSize: positions.length,
      ending: {low: percentile(endings,.05), median: percentile(endings,.5), high: percentile(endings,.95)},
      lossFrequency: endedBelowStart/options.runs, thresholdFrequency: crossedThreshold/options.runs,
      drawdown95: percentile(drawdowns,.95), longestLosingStreak95: percentile(streaks,.95),
      bands: steps.map((values, step) => {values.sort((a,b) => a-b); return {step, low: percentile(values,.05), median: percentile(values,.5), high: percentile(values,.95)};})};
  }
  root.TradeLockMonteCarlo = {closedPositions, simulate};
})(globalThis);
