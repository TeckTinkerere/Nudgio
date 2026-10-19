/* Applied before first paint so a chosen theme never flashes the other
   one. Anything unrecognised — including nothing stored — falls through
   to "system", which is what the CSS already does on its own.

   A separate file, loaded synchronously from <head>, rather than an inline
   <script>: the Content-Security-Policy in vercel.json then needs no
   'unsafe-inline' for scripts. */
try {
  var t = localStorage.getItem('nudgio-theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
