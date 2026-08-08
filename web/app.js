(function () {
  'use strict';

  var REPO = 'TeckTinkerere/Nudgio';
  var RELEASES_URL = 'https://github.com/' + REPO + '/releases/latest';
  var API_URL = 'https://api.github.com/repos/' + REPO + '/releases/latest';

  function buildTicks() {
    var group = document.getElementById('dial-tick-group');
    if (!group) return;
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
    if (!bytes && bytes !== 0) return '—';
    var mb = bytes / (1024 * 1024);
    return mb.toFixed(1) + ' MB';
  }

  function formatDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function setDialState(text, tone) {
    var stateEl = document.getElementById('dial-state');
    if (!stateEl) return;
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
        if (!res.ok) throw new Error('GitHub API returned ' + res.status);
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
    if (!countEl || typeof n !== 'number') return;
    countEl.textContent = formatCount(n);
    countEl.hidden = false;
  }

  function setWaitlistStatus(text, tone) {
    var statusEl = document.getElementById('waitlist-status');
    if (!statusEl) return;
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
        if (!res.ok) throw new Error('bad response');
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
    if (!form) return;

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
              if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again in a bit.');
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

  buildTicks();
  loadLatestRelease();
  loadWaitlistCount();
  initWaitlistForm();
})();
