(function () {
  'use strict';

  var REPO = 'TeckTinkerere/Nudgio';
  var RELEASES_URL = 'https://github.com/' + REPO + '/releases/latest';
  var API_URL = 'https://api.github.com/repos/' + REPO + '/releases/latest';

  function buildTicks() {
    var group = document.getElementById('dial-tick-group');
    if (!group) {return;}
    var cx = 100;
    var cy = 100;
    var count = 60;
    var ns = 'http://www.w3.org/2000/svg';
    for (var i = 0; i < count; i++) {
      var angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      var major = i % 5 === 0;
      var outerR = 92;
      var innerR = major ? 78 : 85;
      var x1 = cx + Math.cos(angle) * outerR;
      var y1 = cy + Math.sin(angle) * outerR;
      var x2 = cx + Math.cos(angle) * innerR;
      var y2 = cy + Math.sin(angle) * innerR;
      var line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', x1.toFixed(2));
      line.setAttribute('y1', y1.toFixed(2));
      line.setAttribute('x2', x2.toFixed(2));
      line.setAttribute('y2', y2.toFixed(2));
      line.setAttribute('class', major ? 'dial__tick dial__tick--major' : 'dial__tick');
      group.appendChild(line);
    }
  }

  function formatBytes(bytes) {
    if (!bytes && bytes !== 0) {return '—';}
    var mb = bytes / (1024 * 1024);
    return mb.toFixed(1) + ' MB';
  }

  function formatDate(iso) {
    if (!iso) {return '—';}
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function setDialState(text, tone) {
    var stateEl = document.getElementById('dial-state');
    if (!stateEl) {return;}
    stateEl.textContent = text;
    if (tone) {
      stateEl.setAttribute('data-tone', tone);
    } else {
      stateEl.removeAttribute('data-tone');
    }
  }

  function loadLatestRelease() {
    var versionPill = document.getElementById('version-pill');
    var downloadLink = document.getElementById('download-link');
    var sizeEl = document.getElementById('fact-size');
    var updatedEl = document.getElementById('fact-updated');
    var checksumRow = document.getElementById('checksum-row');
    var checksumLink = document.getElementById('checksum-link');

    fetch(API_URL, { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (res) {
        if (!res.ok) {throw new Error('GitHub API returned ' + res.status);}
        return res.json();
      })
      .then(function (release) {
        var assets = release.assets || [];
        var apkAsset = assets.find(function (a) {
          return /\.apk$/i.test(a.name);
        });

        if (!apkAsset) {
          throw new Error('No .apk asset on the latest release');
        }

        downloadLink.href = apkAsset.browser_download_url;
        versionPill.textContent = release.tag_name || 'latest';
        sizeEl.textContent = formatBytes(apkAsset.size);
        updatedEl.textContent = formatDate(release.published_at);
        setDialState('tap to download ' + (release.tag_name || 'the latest build'));

        var checksumAsset = assets.find(function (a) {
          return /^SHA256SUMS\.txt$/i.test(a.name);
        });
        if (checksumAsset && checksumRow && checksumLink) {
          checksumLink.href = checksumAsset.browser_download_url;
          checksumRow.hidden = false;
        }
      })
      .catch(function () {
        downloadLink.href = RELEASES_URL;
        versionPill.textContent = 'see releases';
        setDialState('opens the GitHub releases page', 'error');
      });
  }

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function formatCount(n) {
    return n === 1 ? '1 person on the list' : n + ' people on the list';
  }

  function showWaitlistCount(n) {
    var countEl = document.getElementById('waitlist-count');
    if (!countEl || typeof n !== 'number') {return;}
    countEl.textContent = formatCount(n);
    countEl.hidden = false;
  }

  function setWaitlistStatus(text, tone) {
    var statusEl = document.getElementById('waitlist-status');
    if (!statusEl) {return;}
    statusEl.textContent = text;
    if (tone) {
      statusEl.setAttribute('data-tone', tone);
    } else {
      statusEl.removeAttribute('data-tone');
    }
  }

  function loadWaitlistCount() {
    fetch('/api/waitlist')
      .then(function (res) {
        if (!res.ok) {throw new Error('bad response');}
        return res.json();
      })
      .then(function (data) {
        showWaitlistCount(data.count);
      })
      .catch(function () {
        /* count is decorative — fail silently */
      });
  }

  function initWaitlistForm() {
    var form = document.getElementById('waitlist-form');
    if (!form) {return;}

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var emailInput = document.getElementById('waitlist-email');
      var honeypot = document.getElementById('waitlist-company');
      var submitBtn = form.querySelector('.waitlist__submit');
      var email = (emailInput.value || '').trim().toLowerCase();

      if (!EMAIL_RE.test(email)) {
        setWaitlistStatus('That doesn’t look like a valid email.', 'error');
        emailInput.focus();
        return;
      }

      submitBtn.disabled = true;
      setWaitlistStatus('Joining…');

      fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, company: honeypot.value }),
      })
        .then(function (res) {
          return res
            .json()
            .catch(function () {
              return {};
            })
            .then(function (data) {
              if (!res.ok) {throw new Error(data.error || 'Something went wrong. Try again in a bit.');}
              return data;
            });
        })
        .then(function (data) {
          form.reset();
          showWaitlistCount(data.count);
          setWaitlistStatus(
            data.alreadyJoined ? 'You’re already on the list.' : 'You’re in — thanks!',
            'success'
          );
        })
        .catch(function (err) {
          setWaitlistStatus(err.message || 'Something went wrong. Try again in a bit.', 'error');
        })
        .finally(function () {
          submitBtn.disabled = false;
        });
    });
  }

  function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  // Ticks independent of the alarm pulse — a live clock should keep telling
  // real time even for visitors who have motion reduced.
  function initLiveClock() {
    var clockEl = document.getElementById('live-clock');
    if (!clockEl) return;

    function tick() {
      var d = new Date();
      clockEl.textContent = pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
    }
    tick();
    setInterval(tick, 1000);
  }

  // Alarm pulse: a waveform ring around the download dial that fires on
  // every real-world even minute (:00, :02, :04…) — a small, literal nod
  // to what the app itself does, rather than a decorative loop. The live
  // clock pulses in step with it, since it's the thing counting down to it.
  function initAlarmPulse() {
    var canvas = document.querySelector('.dial__pulse');
    var dialEl = document.getElementById('download-link');
    var clockEl = document.getElementById('live-clock');
    if (!canvas || !dialEl) return;

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0;
    var h = 0;
    var cx = 0;
    var cy = 0;
    var ringRadius = 0;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      w = canvas.width = Math.round(rect.width * dpr);
      h = canvas.height = Math.round(rect.height * dpr);
      cx = w / 2;
      cy = h / 2;
      ringRadius = Math.min(w, h) * 0.37;
    }
    resize();
    window.addEventListener('resize', resize);

    function hexToRgb(hex) {
      hex = hex.replace('#', '');
      if (hex.length === 3) {
        hex = hex.split('').map(function (c) { return c + c; }).join('');
      }
      var n = parseInt(hex, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    var rootStyles = getComputedStyle(document.documentElement);
    function readColor(name, fallback) {
      var v = rootStyles.getPropertyValue(name).trim();
      return hexToRgb(v || fallback);
    }
    var c1 = readColor('--primary', '#5edbc8');
    var c2 = readColor('--secondary', '#ffb951');

    var BARS = 40;
    var amp = new Float32Array(BARS);
    var rafId = null;
    var pulseStart = 0;
    var ATTACK = 900;
    var SUSTAIN = 4200;
    var RELEASE = 1900;
    var TOTAL = ATTACK + SUSTAIN + RELEASE;

    function envelope(elapsed) {
      if (elapsed < ATTACK) return elapsed / ATTACK;
      if (elapsed < ATTACK + SUSTAIN) return 1;
      if (elapsed < TOTAL) return 1 - (elapsed - ATTACK - SUSTAIN) / RELEASE;
      return 0;
    }

    function spectrum(i, t) {
      var f = i / BARS;
      var v =
        Math.sin(f * 9 + t * 6) * 0.5 +
        Math.sin(f * 23 - t * 9) * 0.3 +
        Math.sin(f * 4 + t * 3) * 0.5;
      return Math.abs(v) * (0.55 + 0.45 * Math.sin(f * Math.PI));
    }

    function frame(now) {
      var elapsed = now - pulseStart;
      var env = envelope(elapsed);
      ctx.clearRect(0, 0, w, h);

      if (elapsed > 0 && env <= 0) {
        rafId = null;
        dialEl.classList.remove('is-alerting');
        if (clockEl) clockEl.classList.remove('is-alerting');
        return;
      }

      var t = elapsed / 1000;
      ctx.lineCap = 'round';
      for (var i = 0; i < BARS; i++) {
        var target = spectrum(i, t) * env;
        amp[i] += (target - amp[i]) * 0.3;
        var len = ringRadius * 0.9 * amp[i];
        var a = (i / BARS) * Math.PI * 2 - Math.PI / 2;
        var ix = cx + Math.cos(a) * ringRadius;
        var iy = cy + Math.sin(a) * ringRadius;
        var ox = cx + Math.cos(a) * (ringRadius + len);
        var oy = cy + Math.sin(a) * (ringRadius + len);
        var mix = amp[i];
        var r = (c1[0] + (c2[0] - c1[0]) * mix) | 0;
        var g = (c1[1] + (c2[1] - c1[1]) * mix) | 0;
        var b = (c1[2] + (c2[2] - c1[2]) * mix) | 0;
        ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (0.85 * env) + ')';
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.moveTo(ix, iy);
        ctx.lineTo(ox, oy);
        ctx.stroke();
      }
      rafId = requestAnimationFrame(frame);
    }

    function triggerPulse() {
      if (rafId) cancelAnimationFrame(rafId);
      dialEl.classList.add('is-alerting');
      if (clockEl) clockEl.classList.add('is-alerting');
      pulseStart = performance.now();
      rafId = requestAnimationFrame(frame);
    }

    // Fires the pulse on demand from the console, for testing without
    // waiting for a real even-minute mark: __triggerAlarmPulse()
    window.__triggerAlarmPulse = triggerPulse;

    function msUntilNextEvenMinute() {
      var d = new Date();
      var next = new Date(d);
      next.setSeconds(0, 0);
      var add = d.getMinutes() % 2 === 0 ? 2 : 1;
      next.setMinutes(d.getMinutes() + add);
      return Math.max(next.getTime() - d.getTime(), 1000);
    }

    function scheduleNext() {
      setTimeout(function () {
        if (!document.hidden) triggerPulse();
        scheduleNext();
      }, msUntilNextEvenMinute());
    }

    scheduleNext();
  }

  buildTicks();
  loadLatestRelease();
  loadWaitlistCount();
  initWaitlistForm();
  initLiveClock();
  initAlarmPulse();
})();
