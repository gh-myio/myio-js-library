// /**
//  * fetchWithRetry(url, {
//  *   retries?: number = 0,
//  *   retryDelay?: number = 100,
//  *   timeout?: number = 10000,
//  *   retryCondition?: (error, response) => boolean,
//  *   ...RequestInit (method, headers, body, signal, etc.)
//  * })
//  *
//  * Observação: os testes verificam que o objeto de options passado ao fetch
//  * contém a prop `timeout`, então mantemos `{ timeout }` no init.
//  */
// export async function fetchWithRetry(url, options = {}) {
//   const {
//     retries = 0,
//     retryDelay = 100,
//     timeout = 10000,
//     retryCondition,
//     ...passThrough
//   } = options;

//   const baseInit = { ...passThrough, timeout }; // manter timeout no objeto

//   let attempt = 0;
//   while (true) {
//     try {
//       const res = await withTimeout(fetch(url, baseInit), timeout);
//       if (!res.ok) {
//         const doRetry =
//           (typeof retryCondition === 'function' && retryCondition(null, res)) ||
//           res.status >= 500; // padrão: 5xx
//         if (doRetry && attempt < retries) {
//           await delay(expBackoff(retryDelay, attempt));
//           attempt++;
//           continue;
//         }
//         const msg = `HTTP ${res.status}: ${res.statusText || ''}`.trim();
//         throw new Error(msg);
//       }
//       return res;
//     } catch (err) {
//       if (err && err.message === 'Request timeout') {
//         if (attempt < retries) {
//           await delay(expBackoff(retryDelay, attempt));
//           attempt++;
//           continue;
//         }
//         throw err;
//       }
//       const doRetry =
//         (typeof retryCondition === 'function' && retryCondition(err, undefined)) ||
//         isRetryableNetworkError(err);
//       if (doRetry && attempt < retries) {
//         await delay(expBackoff(retryDelay, attempt));
//         attempt++;
//         continue;
//       }
//       throw err;
//     }
//   }
// }

// export const http = fetchWithRetry; // alias para manter compat

// function withTimeout(promise, ms) {
//   return new Promise((resolve, reject) => {
//     const t = setTimeout(() => reject(new Error('Request timeout')), ms);
//     promise.then(
//       (v) => { clearTimeout(t); resolve(v); },
//       (e) => { clearTimeout(t); reject(e); }
//     );
//   });
// }

// function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }
// function expBackoff(base, attempt) { return base * Math.pow(2, attempt); } // 0->base,1->2x,...
// function isRetryableNetworkError(err) {
//   if (!err) return false;
//   const msg = String(err.message || '').toLowerCase();
//   return msg.includes('network') || err.name === 'AbortError';
// }
