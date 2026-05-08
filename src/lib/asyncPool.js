/**
 * Run async tasks with bounded concurrency.
 * @param {number} concurrency - max simultaneous tasks
 * @param {Array} items
 * @param {Function} fn - async function called with each item
 * @returns {Promise<Array>} results in input order
 */
export async function asyncPool(concurrency, items, fn) {
  const results = [];
  const executing = new Set();
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);
    executing.add(p);
    p.finally(() => executing.delete(p));
    if (executing.size >= concurrency) await Promise.race(executing);
  }
  return Promise.all(results);
}
