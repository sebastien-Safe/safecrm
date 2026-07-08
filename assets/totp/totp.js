// ==========================================================================
// S@FE CRM — Module TOTP / MFA
// Extrait de assets/app.js
// Dépendances globales : sb, state, $, getRole, logRgpd
// ==========================================================================

// Rôles nécessitant un TOTP obligatoire (Art.42 RGPD — accès aux données sensibles)
const TOTP_REQUIRED_ROLES = ['collab-assurances', 'super_admin', 'resp-equipe'];

async function refreshTOTPStatus() {
  if (!state.user) return;
  try {
    const { data } = await sb.auth.mfa.listFactors();
    const verified = (data?.totp || []).filter(f => f.status === 'verified');
    const enrolled = verified.length > 0;
    state._totpFactors = data?.totp || [];
    $('#totp-status-label').textContent = enrolled
      ? '🔒 2FA activée — appli d\'authentification requise à chaque connexion.'
      : 'Non activée — appuyez sur le bouton pour scanner un QR code.';
    $('#totp-enroll-btn').style.display  = enrolled ? 'none' : 'inline-flex';
    $('#totp-disable-btn').style.display = enrolled ? 'inline-flex' : 'none';
  } catch (e) { console.warn('listFactors:', e); }
}

async function openTotpEnroll() {
  const err = $('#totp-enroll-error'); err.style.display = 'none';
  $('#totp-code').value = '';
  try {
    const { data: factorsData, error: listErr } = await sb.auth.mfa.listFactors();
    if (listErr) { alert("Erreur (listFactors) : " + (listErr.message || JSON.stringify(listErr))); return; }
    const allTotp = (factorsData?.totp) || [];

    const verified = allTotp.find(f => f.status === 'verified');
    if (verified) {
      alert("Votre compte a déjà la 2FA activée. Désactivez-la d'abord pour en enregistrer une nouvelle.");
      return;
    }

    for (const f of allTotp) {
      if (f.status !== 'verified') {
        try { await sb.auth.mfa.unenroll({ factorId: f.id }); }
        catch (e) { console.warn('unenroll cleanup:', e); }
      }
    }

    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp' });
    if (error) {
      alert("Erreur Supabase MFA : " + (error.message || JSON.stringify(error)));
      console.error('mfa.enroll error:', error); return;
    }
    if (!data?.totp) {
      alert("Réponse inattendue de Supabase : aucun QR code retourné.\nRéponse : " + JSON.stringify(data));
      return;
    }

    state._totpEnrollFactorId = data.id;
    const otpauth = data.totp.uri;
    const container = $('#totp-qr'); container.innerHTML = '';

    if (window.QRCode && typeof window.QRCode.toCanvas === 'function') {
      const canvas = document.createElement('canvas');
      await window.QRCode.toCanvas(canvas, otpauth, { width: 220, margin: 1, color: { dark: '#0a1628', light: '#ffffff' } });
      container.appendChild(canvas);
    } else if (data.totp.qr_code) {
      const img = document.createElement('img');
      img.src = data.totp.qr_code; img.alt = 'QR code TOTP';
      img.style.cssText = 'width:220px;height:220px;background:#fff;padding:10px;border-radius:8px';
      container.appendChild(img);
    } else {
      const img = document.createElement('img');
      img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(otpauth);
      img.alt = 'QR code TOTP';
      img.style.cssText = 'background:#fff;padding:10px;border-radius:8px';
      container.appendChild(img);
    }

    const hint = document.createElement('p');
    hint.className = 'mut';
    hint.style.cssText = 'font-size:.78rem;margin-top:8px;text-align:center';
    hint.textContent = "Si le QR code ne s'affiche pas, saisissez la clé secrète ci-dessous dans votre application.";
    container.appendChild(hint);

    $('#totp-secret').value = data.totp.secret;
    $('#totp-enroll-modal').classList.add('show');

  } catch (e) {
    alert("Exception lors de l'enrôlement TOTP : " + (e.message || e));
    console.error('openTotpEnroll exception:', e);
  }
}

async function verifyTotpEnroll() {
  const err = $('#totp-enroll-error'); err.style.display = 'none';
  const code = $('#totp-code').value.trim();
  const factorId = state._totpEnrollFactorId;
  if (!factorId) { err.textContent = "Aucun enrôlement en cours."; err.style.display = 'block'; return; }
  if (!/^\d{6}$/.test(code)) { err.textContent = "Saisissez un code à 6 chiffres."; err.style.display = 'block'; return; }
  try {
    const ch = await sb.auth.mfa.challenge({ factorId });
    if (ch.error) throw ch.error;
    const v = await sb.auth.mfa.verify({ factorId, challengeId: ch.data.id, code });
    if (v.error) throw v.error;
    $('#totp-enroll-modal').classList.remove('show');
    alert('✅ Double authentification activée. Vous devrez désormais saisir un code à 6 chiffres à chaque connexion.');
    refreshTOTPStatus();
  } catch (e) {
    err.textContent = 'Code refusé : ' + (e.message || e);
    err.style.display = 'block';
  }
}

async function disableTotp() {
  if (!confirm("Désactiver la double authentification ? Vous pourrez la réactiver à tout moment.")) return;
  try {
    const factors = state._totpFactors || [];
    for (const f of factors) { await sb.auth.mfa.unenroll({ factorId: f.id }); }
    alert('Double authentification désactivée.');
    refreshTOTPStatus();
  } catch (e) { alert('Erreur : ' + (e.message || e)); }
}

async function _logTotpEvent(event, role) {
  try {
    await sb.from('totp_audit').insert({
      user_id:    state.user?.id || null,
      event,
      role:       role || getRole(),
      user_agent: navigator.userAgent.slice(0, 200),
    });
  } catch (_) { /* non bloquant */ }
}

async function challengeTOTPIfNeeded() {
  try {
    const userId   = state.user?.id || '';
    const trustKey = 'safe_totp_trust_' + userId;
    const trustExp = parseInt(localStorage.getItem(trustKey) || '0', 10);

    if (trustExp > Date.now()) return true;

    let userRole = 'collab-digitalisation';
    try {
      const { data: pData } = await sb.from('profiles').select('role').eq('id', userId).maybeSingle();
      userRole = pData?.role || 'collab-digitalisation';
    } catch (_) {}
    const isPrivileged = TOTP_REQUIRED_ROLES.includes(userRole);

    const { data: factorsData } = await sb.auth.mfa.listFactors();
    const totp = (factorsData?.totp || []).find(f => f.status === 'verified');

    if (!totp) {
      if (isPrivileged) {
        await _logTotpEvent('enrollment_required', userRole);
        return await _forceTotpEnrollment();
      }
      return true;
    }

    const { data: aalData } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData && aalData.currentLevel === aalData.nextLevel) {
      localStorage.setItem(trustKey, String(Date.now() + 2 * 3600 * 1000));
      await _logTotpEvent('verify_ok_aal', userRole);
      return true;
    }

    return await new Promise((resolve) => {
      const modal = $('#totp-challenge-modal');
      const err   = $('#totp-challenge-error');
      err.style.display = 'none';
      $('#totp-challenge-code').value = '';
      modal.classList.add('show');

      $('#totp-challenge-cancel').onclick = async () => {
        modal.classList.remove('show');
        await _logTotpEvent('challenge_cancelled', userRole);
        await sb.auth.signOut();
        resolve(false);
      };

      $('#totp-challenge-verify').onclick = async () => {
        const code = $('#totp-challenge-code').value.trim();
        if (!/^\d{6}$/.test(code)) { err.textContent = 'Code à 6 chiffres requis.'; err.style.display = 'block'; return; }
        try {
          const ch = await sb.auth.mfa.challenge({ factorId: totp.id });
          if (ch.error) throw ch.error;
          const v = await sb.auth.mfa.verify({ factorId: totp.id, challengeId: ch.data.id, code });
          if (v.error) throw v.error;
          modal.classList.remove('show');
          localStorage.setItem(trustKey, String(Date.now() + 2 * 3600 * 1000));
          await _logTotpEvent('verify_ok', userRole);
          resolve(true);
        } catch (e) {
          await _logTotpEvent('verify_fail', userRole);
          err.textContent = 'Code refusé : ' + (e.message || e);
          err.style.display = 'block';
        }
      };
    });
  } catch (e) { console.warn('AAL check:', e); return true; }
}

async function _forceTotpEnrollment() {
  return new Promise((resolve) => {
    let overlay = document.getElementById('totp-force-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'totp-force-overlay';
      overlay.style.cssText = `
        position:fixed;inset:0;z-index:9999;background:rgba(10,22,40,.97);
        display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;
        padding:24px;text-align:center;color:#e2e8f0`;
      overlay.innerHTML = `
        <div style="max-width:420px;width:100%">
          <div style="font-size:2.5rem;margin-bottom:8px">🔐</div>
          <h2 style="font-size:1.2rem;font-weight:700;margin-bottom:6px">Double authentification obligatoire</h2>
          <p style="font-size:.85rem;color:#94a3b8;margin-bottom:20px">
            Configurez Google Authenticator ou Authy pour accéder au CRM.<br>
            Cette étape est requise pour tous les utilisateurs.
          </p>
          <div id="totp-force-qr" style="background:#fff;display:inline-block;padding:10px;border-radius:8px;margin-bottom:12px"></div>
          <p style="font-size:.75rem;color:#94a3b8;margin-bottom:4px">Clé manuelle :</p>
          <input id="totp-force-secret" type="text" readonly
            style="width:100%;text-align:center;font-family:monospace;font-size:.85rem;
                   background:#1e293b;border:1px solid #334155;border-radius:6px;
                   padding:8px;color:#f1f5f9;margin-bottom:14px">
          <div class="field">
            <input id="totp-force-code" type="text" maxlength="6" placeholder="Code à 6 chiffres"
              style="width:100%;text-align:center;font-size:1.4rem;letter-spacing:.35em;
                     font-family:monospace;background:#1e293b;border:1px solid #334155;
                     border-radius:8px;padding:12px;color:#f1f5f9">
          </div>
          <p id="totp-force-error" style="color:#fc8181;font-size:.82rem;margin-bottom:10px;display:none"></p>
          <button id="totp-force-verify" class="btn btn-pri" style="width:100%;justify-content:center">
            Activer et continuer →
          </button>
          <p style="font-size:.72rem;color:#64748b;margin-top:14px">
            Scannez le QR code avec votre application d'authentification.
          </p>
        </div>`;
      document.body.appendChild(overlay);
    }

    overlay.style.display = 'flex';

    (async () => {
      try {
        const { data: fd } = await sb.auth.mfa.listFactors();
        for (const f of (fd?.totp || []).filter(f => f.status !== 'verified')) {
          try { await sb.auth.mfa.unenroll({ factorId: f.id }); } catch (_) {}
        }
        const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp' });
        if (error || !data?.totp) {
          document.getElementById('totp-force-error').textContent = 'Erreur Supabase MFA : ' + (error?.message || 'inconnu');
          document.getElementById('totp-force-error').style.display = 'block';
          return;
        }
        overlay._factorId = data.id;
        document.getElementById('totp-force-secret').value = data.totp.secret;
        const qrEl = document.getElementById('totp-force-qr');
        if (typeof QRCode !== 'undefined') {
          new QRCode(qrEl, { text: data.totp.uri, width: 160, height: 160, correctLevel: QRCode.CorrectLevel.M });
        } else if (data.totp.qr_code) {
          const img = document.createElement('img');
          img.src = data.totp.qr_code; img.width = 160;
          qrEl.appendChild(img);
        }
      } catch (e) {
        document.getElementById('totp-force-error').textContent = 'Erreur : ' + e.message;
        document.getElementById('totp-force-error').style.display = 'block';
      }
    })();

    document.getElementById('totp-force-verify').onclick = async () => {
      const code     = (document.getElementById('totp-force-code').value || '').trim();
      const errEl    = document.getElementById('totp-force-error');
      const factorId = overlay._factorId;
      errEl.style.display = 'none';
      if (!/^\d{6}$/.test(code)) { errEl.textContent = 'Code à 6 chiffres requis.'; errEl.style.display = 'block'; return; }
      if (!factorId)             { errEl.textContent = 'Enrôlement non initialisé.'; errEl.style.display = 'block'; return; }
      try {
        const ch = await sb.auth.mfa.challenge({ factorId });
        if (ch.error) throw ch.error;
        const v = await sb.auth.mfa.verify({ factorId, challengeId: ch.data.id, code });
        if (v.error) throw v.error;
        overlay.style.display = 'none';
        const trustKey = 'safe_totp_trust_' + (state.user?.id || '');
        localStorage.setItem(trustKey, String(Date.now() + 2 * 3600 * 1000));
        resolve(true);
      } catch (e) {
        errEl.textContent = 'Code refusé : ' + (e.message || e);
        errEl.style.display = 'block';
      }
    };
  });
}
