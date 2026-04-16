(function () {
  'use strict';

  // Don't run twice
  if (document.getElementById('__probe-overlay')) return;

  /* ── Styles ─────────────────────────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    #__probe-overlay {
      position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
      width: 320px; background: #fff; border-radius: 10px;
      box-shadow: 0 4px 24px rgba(0,0,0,.18); font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px; color: #1a1a1a; overflow: hidden;
    }
    #__probe-header {
      background: #1e293b; color: #fff; padding: 10px 14px;
      display: flex; justify-content: space-between; align-items: center;
    }
    #__probe-header strong { font-size: 13px; letter-spacing: .02em; }
    #__probe-header span { font-size: 11px; opacity: .6; }
    #__probe-close {
      background: none; border: none; color: #fff; cursor: pointer;
      font-size: 18px; line-height: 1; padding: 0 0 0 10px; opacity: .7;
    }
    #__probe-close:hover { opacity: 1; }
    #__probe-body { padding: 10px 0 6px; }
    .probe-row {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 7px 14px; border-bottom: 1px solid #f1f5f9;
    }
    .probe-row:last-child { border-bottom: none; }
    .probe-dot {
      width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; margin-top: 2px;
      background: #d1d5db;
    }
    .probe-dot.pass  { background: #16a34a; }
    .probe-dot.fail  { background: #dc2626; }
    .probe-dot.warn  { background: #d97706; }
    .probe-dot.spin  {
      background: none; border: 2px solid #d1d5db;
      border-top-color: #6366f1; animation: __probe-spin .7s linear infinite;
    }
    @keyframes __probe-spin { to { transform: rotate(360deg); } }
    .probe-label { font-weight: 600; line-height: 1.3; }
    .probe-detail { font-size: 11px; color: #64748b; margin-top: 2px; line-height: 1.4; }
    .probe-detail.fail { color: #dc2626; }
    .probe-detail.warn { color: #b45309; }
    #__probe-footer {
      padding: 8px 14px; background: #f8fafc; border-top: 1px solid #e2e8f0;
      font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between;
    }
    #__probe-rerun {
      background: none; border: none; color: #6366f1; cursor: pointer;
      font-size: 11px; font-weight: 600; padding: 0;
    }
    #__probe-rerun:hover { text-decoration: underline; }
  `;
  document.head.appendChild(style);

  /* ── Shell ───────────────────────────────────────────────────────────── */
  const overlay = document.createElement('div');
  overlay.id = '__probe-overlay';
  overlay.innerHTML = `
    <div id="__probe-header">
      <div><strong>App Compatibility Probe</strong><br><span id="__probe-url"></span></div>
      <button id="__probe-close" title="Close">×</button>
    </div>
    <div id="__probe-body"></div>
    <div id="__probe-footer">
      <span id="__probe-summary">Running checks…</span>
      <button id="__probe-rerun">Re-run</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('__probe-url').textContent = location.hostname;
  document.getElementById('__probe-close').onclick = () => overlay.remove();
  document.getElementById('__probe-rerun').onclick = () => run();

  /* ── Check definitions ───────────────────────────────────────────────── */
  // Each check returns { status: 'pass'|'fail'|'warn', detail: string }
  const CHECKS = [
    {
      id: 'iovation',
      label: 'iovation / Device Fingerprint',
      impact: 'Form submit may be silently rejected',
      run: () => new Promise(resolve => {
        // 1. Check if the global was already set by a prior load
        if (window.IGLOO || window.io_bb_callback || window.io_install_stm !== undefined) {
          return resolve({ status: 'pass', detail: 'iovation global detected — loaded OK' });
        }
        // 2. Try to load the script fresh
        const s = document.createElement('script');
        s.src = 'https://mpsnare.iesnare.com/general5/wdp.js?loaderVer=5.2.2&compat=false&tp=true&tp_split=false&fp_static=false&fp_dyn=true&flash=false&_t=' + Date.now();
        const timer = setTimeout(() => {
          s.remove();
          resolve({ status: 'fail', detail: 'Script blocked or timed out (no response in 4s)' });
        }, 4000);
        s.onload = () => {
          clearTimeout(timer);
          s.remove();
          resolve({ status: 'pass', detail: 'Script loaded successfully' });
        };
        s.onerror = () => {
          clearTimeout(timer);
          s.remove();
          resolve({ status: 'fail', detail: 'Script blocked — device fingerprint will not be collected' });
        };
        document.head.appendChild(s);
      }),
    },

    {
      id: 'recaptcha',
      label: 'reCAPTCHA Enterprise',
      impact: 'Form submission will be rejected',
      run: () => new Promise(resolve => {
        // 1. Already loaded?
        if (window.grecaptcha && window.grecaptcha.enterprise) {
          return resolve({ status: 'pass', detail: 'grecaptcha.enterprise already present' });
        }
        // 2. Try loading enterprise.js
        const SITE_KEY = '6LeB62shAAAAACYquFTk4tX615Ct0M7YX5njNWXv';
        const s = document.createElement('script');
        s.src = `https://www.google.com/recaptcha/enterprise.js?render=${SITE_KEY}&t=` + Date.now();
        const timer = setTimeout(() => {
          s.remove();
          resolve({ status: 'fail', detail: 'Script blocked or timed out' });
        }, 5000);
        s.onerror = () => {
          clearTimeout(timer);
          s.remove();
          resolve({ status: 'fail', detail: 'enterprise.js blocked — no CAPTCHA token can be issued' });
        };
        s.onload = () => {
          clearTimeout(timer);
          s.remove();
          // Give grecaptcha a moment to initialise
          setTimeout(() => {
            if (window.grecaptcha && window.grecaptcha.enterprise) {
              resolve({ status: 'pass', detail: 'enterprise.js loaded, grecaptcha.enterprise ready' });
            } else {
              resolve({ status: 'warn', detail: 'Script loaded but grecaptcha.enterprise not initialised' });
            }
          }, 800);
        };
        document.head.appendChild(s);
      }),
    },

    {
      id: 'maps',
      label: 'Google Maps / Places API',
      impact: 'Address autocomplete broken',
      run: () => new Promise(resolve => {
        // 1. Already loaded?
        if (window.google && window.google.maps && window.google.maps.places) {
          return resolve({ status: 'pass', detail: 'google.maps.places already present' });
        }
        // 2. Try loading the Maps JS API (same key the page uses)
        const API_KEY = 'AIzaSyBLMq1TZER7AzdNN37orwa-UlRX9ZYDALE';
        const cb = '__probeMapsCb_' + Date.now();
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          delete window[cb];
          resolve({ status: 'fail', detail: 'Maps API blocked or timed out' });
        }, 6000);
        window[cb] = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          delete window[cb];
          if (window.google && window.google.maps && window.google.maps.places) {
            resolve({ status: 'pass', detail: 'Maps + Places loaded successfully' });
          } else {
            resolve({ status: 'warn', detail: 'Maps loaded but Places library missing' });
          }
        };
        const s = document.createElement('script');
        s.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&callback=${cb}&t=` + Date.now();
        s.onerror = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          delete window[cb];
          s.remove();
          resolve({ status: 'fail', detail: 'Maps API script blocked' });
        };
        document.head.appendChild(s);
      }),
    },

    {
      id: 'glance',
      label: 'Glance Cobrowse',
      impact: 'Support agents cannot screen-share with user',
      run: () => new Promise(resolve => {
        // Already loaded?
        if (window.GLANCE && window.GLANCE.Cobrowse) {
          return resolve({ status: 'pass', detail: 'GLANCE.Cobrowse already present' });
        }
        const s = document.createElement('script');
        s.src = 'https://www.glancecdn.net/cobrowse/CobrowseJS.ashx?group=24479&site=production&t=' + Date.now();
        const timer = setTimeout(() => {
          s.remove();
          resolve({ status: 'fail', detail: 'Script blocked or timed out' });
        }, 5000);
        s.onload = () => {
          clearTimeout(timer);
          s.remove();
          resolve({ status: 'pass', detail: 'CobrowseJS loaded successfully' });
        };
        s.onerror = () => {
          clearTimeout(timer);
          s.remove();
          resolve({ status: 'fail', detail: 'Script blocked — co-browse unavailable' });
        };
        document.head.appendChild(s);
      }),
    },

    {
      id: 'quantum',
      label: 'Quantum Metric',
      impact: 'Session replay and UX analytics unavailable',
      run: () => new Promise(resolve => {
        // Already loaded?
        if (window.QuantumMetricAPI || window.QuantumMetricOnload) {
          return resolve({ status: 'pass', detail: 'QuantumMetricAPI already present' });
        }
        const s = document.createElement('script');
        s.src = 'https://cdn.quantummetric.com/qscripts/quantum-associatedbank.js?t=' + Date.now();
        const timer = setTimeout(() => {
          s.remove();
          resolve({ status: 'fail', detail: 'Script blocked or timed out' });
        }, 5000);
        s.onload = () => {
          clearTimeout(timer);
          s.remove();
          resolve({ status: 'pass', detail: 'Quantum Metric script loaded' });
        };
        s.onerror = () => {
          clearTimeout(timer);
          s.remove();
          resolve({ status: 'fail', detail: 'Script blocked — session replay unavailable' });
        };
        document.head.appendChild(s);
      }),
    },

    {
      id: 'alloy',
      label: 'Alloy Identity Verification',
      impact: 'ID verification iframe will not render — flow cannot complete',
      run: () => new Promise(resolve => {
        // Already loaded?
        if (window.Alloy) {
          return resolve({ status: 'pass', detail: 'Alloy SDK global already present' });
        }
        let apiOk = false;
        let sdkOk = false;
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          if (apiOk && sdkOk) {
            resolve({ status: 'pass', detail: 'API reachable and SDK loaded' });
          } else if (!apiOk && !sdkOk) {
            resolve({ status: 'fail', detail: 'API and SDK both blocked — verification cannot start' });
          } else if (!sdkOk) {
            resolve({ status: 'fail', detail: 'alloysdk.alloy.co blocked — iframe will not render' });
          } else {
            resolve({ status: 'fail', detail: 'docv-prod-api.alloy.co unreachable — auth will fail' });
          }
        };

        // 1. API reachability — HEAD request avoids triggering a real session
        fetch('https://docv-prod-api.alloy.co/health', { method: 'HEAD', mode: 'no-cors' })
          .then(() => { apiOk = true; })
          .catch(() => { apiOk = false; })
          .finally(() => { if (sdkSettled) finish(); sdkSettled = true; });

        // 2. SDK script load
        let sdkSettled = false;
        const s = document.createElement('script');
        s.src = 'https://alloysdk.alloy.co/v2/alloy.js?t=' + Date.now();
        const timer = setTimeout(() => {
          s.remove();
          sdkOk = false;
          sdkSettled = true;
          finish();
        }, 5000);
        s.onload = () => {
          clearTimeout(timer);
          s.remove();
          sdkOk = true;
          sdkSettled = true;
          finish();
        };
        s.onerror = () => {
          clearTimeout(timer);
          s.remove();
          sdkOk = false;
          sdkSettled = true;
          finish();
        };
        document.head.appendChild(s);
      }),
    },

    {
      id: 'tealeaf',
      label: 'IBM Tealeaf',
      impact: 'Behavioral analytics and session replay unavailable',
      run: () => new Promise(resolve => {
        // Already loaded?
        if (window.TLT) {
          return resolve({ status: 'pass', detail: 'TLT (Tealeaf) global already present' });
        }
        const s = document.createElement('script');
        s.src = 'https://www.associatedbank.com/js/Tealeaf-associatedterafina.js?t=' + Date.now();
        const timer = setTimeout(() => {
          s.remove();
          resolve({ status: 'fail', detail: 'Script blocked or timed out' });
        }, 5000);
        s.onload = () => {
          clearTimeout(timer);
          s.remove();
          resolve({ status: 'pass', detail: 'Tealeaf script loaded' });
        };
        s.onerror = () => {
          clearTimeout(timer);
          s.remove();
          resolve({ status: 'fail', detail: 'Script blocked — behavioral analytics unavailable' });
        };
        document.head.appendChild(s);
      }),
    },
  ];

  /* ── Render rows (initially as spinners) ─────────────────────────────── */
  const body = document.getElementById('__probe-body');

  function buildRows() {
    body.innerHTML = CHECKS.map(c => `
      <div class="probe-row" id="__probe-row-${c.id}">
        <div class="probe-dot spin" id="__probe-dot-${c.id}"></div>
        <div>
          <div class="probe-label">${c.label}</div>
          <div class="probe-detail" id="__probe-detail-${c.id}">Checking…</div>
        </div>
      </div>
    `).join('');
  }

  function updateRow(id, status, detail) {
    const dot = document.getElementById('__probe-dot-' + id);
    const det = document.getElementById('__probe-detail-' + id);
    if (!dot || !det) return;
    dot.className = 'probe-dot ' + status;
    det.className = 'probe-detail ' + (status !== 'pass' ? status : '');
    det.textContent = detail;
  }

  /* ── Run all checks ──────────────────────────────────────────────────── */
  async function run() {
    buildRows();
    document.getElementById('__probe-summary').textContent = 'Running checks…';

    const results = await Promise.all(
      CHECKS.map(c =>
        c.run()
          .then(r => { updateRow(c.id, r.status, r.detail); return r; })
          .catch(e => {
            const r = { status: 'warn', detail: 'Check error: ' + e.message };
            updateRow(c.id, r.status, r.detail);
            return r;
          })
      )
    );

    const fails = results.filter(r => r.status === 'fail').length;
    const warns = results.filter(r => r.status === 'warn').length;
    const summary = document.getElementById('__probe-summary');
    if (fails > 0) {
      summary.textContent = `${fails} blocker${fails > 1 ? 's' : ''} detected — app will break`;
      summary.style.color = '#dc2626';
    } else if (warns > 0) {
      summary.textContent = `${warns} warning${warns > 1 ? 's' : ''} — check manually`;
      summary.style.color = '#d97706';
    } else {
      summary.textContent = 'All critical services reachable';
      summary.style.color = '#16a34a';
    }

    // Log structured results to console for export
    console.table(CHECKS.map((c, i) => ({
      service: c.label,
      status: results[i].status,
      detail: results[i].detail,
      impact: c.impact,
    })));
  }

  run();
})();
