/* Theme control: system / light / dark.
 *
 * styles.css does the actual work — every colour token is declared with
 * light-dark(), which reads the used `color-scheme`, so switching themes is
 * a matter of narrowing that one property. There is no second palette in
 * this file, and nothing here knows a hex value except the two the browser
 * chrome needs.
 *
 * The pre-paint snippet in each page's <head> has already applied a stored
 * choice before this runs; this adds only the parts that can wait.
 */
(function () {
  var KEY = 'nudgio-theme';
  var LIGHT = '#F7F4EE';
  var DARK = '#11141D';
  var root = document.documentElement;

  function stored() {
    try {
      var v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' ? v : 'system';
    } catch (e) {
      /* Private mode, or storage blocked — "system" is the right answer. */
      return 'system';
    }
  }

  function systemIsDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function resolve(choice) {
    return choice === 'system' ? (systemIsDark() ? 'dark' : 'light') : choice;
  }

  /* On "system" the two metas keep their own media queries and the browser
     picks between them. On an explicit choice they must both report the same
     colour, or the browser chrome goes on following the OS while the page
     does not. */
  function paintMeta(choice) {
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) {
      var meta = metas[i];
      var own = meta.getAttribute('media') === '(prefers-color-scheme: dark)' ? DARK : LIGHT;
      meta.setAttribute(
        'content',
        choice === 'system' ? own : resolve(choice) === 'dark' ? DARK : LIGHT
      );
    }
  }

  function apply(choice, persist) {
    if (choice === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', choice);
    }
    if (persist) {
      try {
        if (choice === 'system') {
          localStorage.removeItem(KEY);
        } else {
          localStorage.setItem(KEY, choice);
        }
      } catch (e) {
        /* Not persisting is survivable; the page is already correct. */
      }
    }
    paintMeta(choice);
    /* The dial's pulse caches its colours, so it needs telling. */
    try {
      document.dispatchEvent(
        new CustomEvent('nudgio:theme', {detail: {choice: choice, resolved: resolve(choice)}})
      );
    } catch (e) {}
  }

  var current = stored();
  var input = document.getElementById('theme-' + current);
  if (input) input.checked = true;
  paintMeta(current);

  var control = document.getElementById('theme-control');
  if (control) {
    control.addEventListener('change', function (event) {
      if (event.target && event.target.name === 'theme') {
        apply(event.target.value, true);
      }
    });
  }

  /* While the choice is "system", follow the OS if it flips mid-visit. */
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onSystemChange = function () {
      if (stored() === 'system') apply('system', false);
    };
    if (mq.addEventListener) {
      mq.addEventListener('change', onSystemChange);
    } else if (mq.addListener) {
      mq.addListener(onSystemChange);
    }
  }
})();
