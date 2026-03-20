/**
 * calculadora-sgf.js
 *
 * Segurança:
 *  - Nenhum evento inline no HTML (onclick, onchange, etc.)
 *  - Nenhum innerHTML alimentado com dados do usuário
 *  - Todo DOM construído via createElement / textContent
 *  - Validação numérica estrita (evita falsos positivos em WAF)
 *  - Sanitização de input antes de qualquer operação
 */

'use strict';

/* ─── Configuração de modos ─────────────────────────────────── */

/**
 * Cada modo define:
 *   labelA  / labelB  → texto do <label> visível ao usuário
 *   hintA   / hintB   → aria-label adicional para leitores de tela
 *   campoOculto       → qual campo não é necessário naquele modo (null = todos visíveis)
 */
const MODOS = {
  premio: {
    labelA: 'Importância Segurada (R$)',
    labelB: 'Taxa (%)',
    campoOculto: null,
    resultado: 'Prêmio (R$)',
  },
  taxa: {
    labelA: 'Importância Segurada (R$)',
    labelB: 'Prêmio conhecido (R$)',
    campoOculto: null,
    resultado: 'Taxa (%)',
  },
  is: {
    labelA: 'Prêmio (R$)',
    labelB: 'Taxa (%)',
    campoOculto: null,
    resultado: 'Importância Segurada (R$)',
  },
};

/* ─── Estado ────────────────────────────────────────────────── */
let modoAtual = 'premio';

/* ─── Referências ao DOM ────────────────────────────────────── */
const elCampoA   = document.getElementById('campo-a');
const elCampoB   = document.getElementById('campo-b');
const elCampoDias = document.getElementById('campo-dias');
const elLabelA   = document.getElementById('label-a');
const elLabelB   = document.getElementById('label-b');
const elResLabel = document.getElementById('res-label');
const elResValue = document.getElementById('res-value');
const elBreakdown = document.getElementById('breakdown');
const elBtnCalc  = document.getElementById('btn-calcular');

/* ─── Inicialização ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  // Botões de modo — listener único via delegação
  const modeBar = document.querySelector('.mode-bar');
  modeBar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (!btn) return;
    setModo(btn.dataset.mode);
  });

  // Botão calcular
  elBtnCalc.addEventListener('click', calcular);

  // Enter nos inputs dispara cálculo
  [elCampoA, elCampoB, elCampoDias].forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') calcular();
    });
  });

  // Estado inicial
  setModo('premio');
});

/* ─── Troca de modo ─────────────────────────────────────────── */
function setModo(modo) {
  if (!MODOS[modo]) return;
  modoAtual = modo;

  // Atualiza labels (textContent → seguro)
  elLabelA.textContent = MODOS[modo].labelA;
  elLabelB.textContent = MODOS[modo].labelB;

  // Destaca botão ativo sem innerHTML
  document.querySelectorAll('.btn-mode').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === modo);
  });

  limparResultado();
  limparErros();
}

/* ─── Validação ─────────────────────────────────────────────── */

/**
 * Converte string de input para número float.
 * Aceita vírgula como separador decimal (padrão brasileiro).
 * Retorna null se o valor for inválido, negativo ou zero.
 *
 * Regex estreita: apenas dígitos, vírgula/ponto únicos.
 * Isso evita que strings como "1e9", "--1" ou "NaN" passem.
 */
function parseInput(str) {
  if (typeof str !== 'string') return null;

  // Remove espaços e troca vírgula por ponto
  const limpo = str.trim().replace(/\s/g, '').replace(',', '.');

  // Aceita apenas o padrão: dígitos opcionalmente com um ponto decimal
  if (!/^\d+(\.\d+)?$/.test(limpo)) return null;

  const n = parseFloat(limpo);
  return isFinite(n) && n > 0 ? n : null;
}

function getValor(el) {
  return parseInput(el.value);
}

function marcarErro(el, sim) {
  el.classList.toggle('erro', sim);
}

function limparErros() {
  [elCampoA, elCampoB, elCampoDias].forEach((el) => marcarErro(el, false));
}

/* ─── Cálculo principal ─────────────────────────────────────── */
function calcular() {
  limparErros();

  const dias = getValor(elCampoDias);
  if (!dias) {
    marcarErro(elCampoDias, true);
    return mostrarErro('Informe um prazo em dias (número positivo).');
  }

  const prazo = dias / 365; // fração anual

  if (modoAtual === 'premio') {
    const is   = getValor(elCampoA);
    const taxa = getValor(elCampoB);

    if (!is)   marcarErro(elCampoA, true);
    if (!taxa) marcarErro(elCampoB, true);
    if (!is || !taxa) return mostrarErro('Preencha IS e Taxa com valores positivos.');

    const premio = is * (taxa / 100) * prazo;

    mostrarResultado('Prêmio (R$)', premio, [
      { label: 'Importância Segurada', value: is,     prefixo: 'R$' },
      { label: 'Taxa',                 value: taxa,   sufixo: '%'   },
      { label: 'Prazo',                value: prazo,  sufixo: ' ano(s)', casas: 4 },
      { label: 'Prêmio',               value: premio, prefixo: 'R$', total: true },
    ]);
  }

  else if (modoAtual === 'taxa') {
    const is    = getValor(elCampoA);
    const prem  = getValor(elCampoB);

    if (!is)   marcarErro(elCampoA, true);
    if (!prem) marcarErro(elCampoB, true);
    if (!is || !prem) return mostrarErro('Preencha IS e Prêmio com valores positivos.');

    const taxaCalc = (prem / is / prazo) * 100;

    mostrarResultado('Taxa (%)', taxaCalc, [
      { label: 'Importância Segurada', value: is,       prefixo: 'R$' },
      { label: 'Prêmio',              value: prem,     prefixo: 'R$' },
      { label: 'Prazo',               value: prazo,    sufixo: ' ano(s)', casas: 4 },
      { label: 'Taxa',                value: taxaCalc, sufixo: '%', total: true },
    ]);
  }

  else if (modoAtual === 'is') {
    const prem = getValor(elCampoA);
    const taxa = getValor(elCampoB);

    if (!prem) marcarErro(elCampoA, true);
    if (!taxa) marcarErro(elCampoB, true);
    if (!prem || !taxa) return mostrarErro('Preencha Prêmio e Taxa com valores positivos.');

    const isCalc = prem / ((taxa / 100) * prazo);

    mostrarResultado('Importância Segurada (R$)', isCalc, [
      { label: 'Prêmio', value: prem,   prefixo: 'R$' },
      { label: 'Taxa',   value: taxa,   sufixo: '%'   },
      { label: 'Prazo',  value: prazo,  sufixo: ' ano(s)', casas: 4 },
      { label: 'IS',     value: isCalc, prefixo: 'R$', total: true },
    ]);
  }
}

/* ─── Renderização segura do resultado ─────────────────────── */

/**
 * mostrarResultado — constrói o DOM do breakdown inteiramente via
 * createElement/textContent, nunca via innerHTML com dados externos.
 *
 * @param {string} label   - rótulo do resultado principal
 * @param {number} value   - valor principal
 * @param {Array}  rows    - linhas do breakdown
 */
function mostrarResultado(label, value, rows) {
  // Cabeçalho
  elResLabel.textContent = label;
  elResValue.textContent = formatarNumero(value, 2, '');

  // Limpa breakdown anterior
  while (elBreakdown.firstChild) {
    elBreakdown.removeChild(elBreakdown.firstChild);
  }

  // Linhas do breakdown
  rows.forEach(({ label: l, value: v, prefixo = '', sufixo = '', casas = 2, total = false }) => {
    const row = document.createElement('div');
    row.className = 'breakdown-row' + (total ? ' total' : '');
    row.setAttribute('role', 'row');

    const elLabel = document.createElement('span');
    elLabel.textContent = l;

    const elVal = document.createElement('strong');
    elVal.textContent = prefixo
      ? prefixo + '\u00A0' + formatarNumero(v, casas)
      : formatarNumero(v, casas) + sufixo;

    row.appendChild(elLabel);
    row.appendChild(elVal);
    elBreakdown.appendChild(row);
  });
}

/* ─── Helpers ───────────────────────────────────────────────── */
function mostrarErro(msg) {
  elResLabel.textContent = 'Atenção';
  // textContent escapa qualquer HTML acidental na mensagem
  elResValue.textContent = msg;
  while (elBreakdown.firstChild) {
    elBreakdown.removeChild(elBreakdown.firstChild);
  }
}

function limparResultado() {
  elResLabel.textContent = 'Resultado';
  elResValue.textContent = '—';
  while (elBreakdown.firstChild) {
    elBreakdown.removeChild(elBreakdown.firstChild);
  }
}

/**
 * Formata número para pt-BR.
 * Separado em função pura → testável unitariamente.
 */
function formatarNumero(n, casas = 2) {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}
