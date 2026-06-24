import { describe, it, expect } from 'vitest';
import {
  escapeHtml, formatDate, formatMoney,
  isOverdue, monthKey, isThisMonth, gaugeColor
} from '../assets/app/helpers-pure.js';

// ── escapeHtml ──────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('échappe les 5 caractères spéciaux HTML', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('"quote"')).toBe('&quot;quote&quot;');
    expect(escapeHtml("l'apostrophe")).toBe('l&#39;apostrophe');
  });

  it('retourne chaîne vide pour null / undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('retourne la chaîne inchangée si aucun caractère spécial', () => {
    expect(escapeHtml('Bonjour monde')).toBe('Bonjour monde');
  });

  it('convertit les nombres en chaîne et les échappe', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});

// ── formatDate ──────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('convertit ISO 8601 en format français JJ/MM/AAAA', () => {
    expect(formatDate('2026-06-24')).toBe('24/06/2026');
    expect(formatDate('2024-01-01')).toBe('01/01/2024');
  });

  it('retourne "—" pour une valeur falsy', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('')).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });
});

// ── formatMoney ─────────────────────────────────────────────────────────────

describe('formatMoney', () => {
  it('formate un montant entier avec 2 décimales et le symbole €', () => {
    expect(formatMoney(1000)).toBe('1 000,00 €');
  });

  it('formate un montant décimal correctement', () => {
    expect(formatMoney(99.5)).toBe('99,50 €');
  });

  it('retourne "—" pour null / undefined / chaîne vide', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
    expect(formatMoney('')).toBe('—');
  });

  it('formate zéro', () => {
    expect(formatMoney(0)).toBe('0,00 €');
  });
});

// ── isOverdue ───────────────────────────────────────────────────────────────

describe('isOverdue', () => {
  it('retourne true pour une date passée avec statut non-terminé', () => {
    expect(isOverdue('2020-01-01', 'En cours')).toBe(true);
  });

  it('retourne false si statut = "Terminé"', () => {
    expect(isOverdue('2020-01-01', 'Terminé')).toBe(false);
  });

  it('retourne false si dateStr est falsy', () => {
    expect(isOverdue(null, 'En cours')).toBeFalsy();
    expect(isOverdue('', 'En cours')).toBeFalsy();
  });

  it('retourne false pour une date future', () => {
    expect(isOverdue('2099-12-31', 'À faire')).toBe(false);
  });
});

// ── monthKey ────────────────────────────────────────────────────────────────

describe('monthKey', () => {
  it('retourne le format AAAA-MM', () => {
    const result = monthKey(new Date('2026-06-15'));
    expect(result).toBe('2026-06');
  });

  it('padde les mois < 10 avec un zéro', () => {
    expect(monthKey(new Date('2026-03-01'))).toBe('2026-03');
  });
});

// ── isThisMonth ─────────────────────────────────────────────────────────────

describe('isThisMonth', () => {
  it('retourne false pour une chaîne vide ou null', () => {
    expect(isThisMonth('')).toBe(false);
    expect(isThisMonth(null)).toBe(false);
  });

  it('retourne true pour une date du mois en cours', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(isThisMonth(today)).toBe(true);
  });

  it('retourne false pour une date d\'un autre mois', () => {
    expect(isThisMonth('2020-01-15')).toBe(false);
  });
});

// ── gaugeColor ──────────────────────────────────────────────────────────────

describe('gaugeColor', () => {
  it('retourne bleu foncé pour pct < 50', () => {
    expect(gaugeColor(0)).toBe('#2563eb');
    expect(gaugeColor(49)).toBe('#2563eb');
  });

  it('retourne bleu pour 50 ≤ pct < 75', () => {
    expect(gaugeColor(50)).toBe('#3b82f6');
    expect(gaugeColor(74)).toBe('#3b82f6');
  });

  it('retourne gold pour pct ≥ 75', () => {
    expect(gaugeColor(75)).toBe('#f59e0b');
    expect(gaugeColor(100)).toBe('#f59e0b');
  });
});
