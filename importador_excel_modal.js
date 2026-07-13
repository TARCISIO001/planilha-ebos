(function () {
  'use strict';

  const CONFIGS = [
    {
      key: 'listas',
      backdropId: 'modalBackdrop',
      addRowFn: 'modalAdicionarLinha',
      fields: {
        nome: 'modalNomeEbo_1',
        tbody1: 'modalBodyLinhas_1'
      }
    },
    {
      key: 'positivos',
      backdropId: 'modalBackdropPositivos',
      addRowFn: 'modalAdicionarLinhaPositivos',
      fields: {
        nome: 'modalNomeEbo_1Positivos',
        tbody1: 'modalBodyLinhas_1Positivos'
      }
    },
    {
      key: 'oferendas',
      backdropId: 'modalBackdropOferendas',
      addRowFn: 'modalAdicionarLinhaOferendas',
      fields: {
        nome: 'modalNomeOferenda_1',
        tbody1: 'modalBodyLinhasOferendas_1'
      }
    },
    {
      key: 'oferendas_ebo',
      backdropId: 'modalBackdropOferendasEbo',
      addRowFn: 'modalAdicionarLinhaOferendasEbo',
      fields: {
        nome: 'modalNomeOferendaEbo_1',
        tbody1: 'modalBodyLinhasOferendasEbo_1'
      }
    },
    {
      key: 'banhos',
      backdropId: 'modalBackdropBanhos',
      addRowFn: 'modalAdicionarLinhaBanhos',
      fields: {
        nome: 'modalNomeBanho_1',
        tbody1: 'modalBodyLinhasBanhos_1'
      }
    },
    {
      key: 'obrigacoes',
      backdropId: 'modalBackdropObrigacoes',
      addRowFn: 'modalAdicionarLinhaObrigacoes',
      fields: {
        nome: 'modalNomeObrigacao_1',
        tbody1: 'modalBodyLinhasObrigacoes_1'
      }
    },
    {
      key: 'iba_orixa',
      backdropId: 'modalBackdropListaIbaOrixa',
      addRowFn: 'modalAdicionarLinhaIbaOrixa',
      fields: {
        nome: 'modalNomeIbaOrixa_1',
        tbody1: 'modalBodyLinhasIbaOrixa_1'
      }
    }
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function cleanText(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\r/g, '')
      .replace(/\t/g, ' ')
      .trim();
  }

  function splitLinha(line) {
    const raw = cleanText(line).replace(/^[-•*]\s*/, '');
    if (!raw) return null;

    let match = raw.match(/^(.+?)\s*[|;]\s*(.+)$/);
    if (match) {
      return {
        ingrediente: cleanText(match[1]),
        quantidade: cleanText(match[2])
      };
    }

    match = raw.match(/^(.+?)\s+[-–—]\s+(.+)$/);
    if (match) {
      return {
        ingrediente: cleanText(match[1]),
        quantidade: cleanText(match[2])
      };
    }

    match = raw.match(/^(.+?)\s{2,}(.+)$/);
    if (match) {
      return {
        ingrediente: cleanText(match[1]),
        quantidade: cleanText(match[2])
      };
    }

    match = raw.match(/^(.+?)\s+(\d+(?:[.,]\d+)?(?:\s+[^\s]+)?)$/);
    if (match) {
      return {
        ingrediente: cleanText(match[1]),
        quantidade: cleanText(match[2])
      };
    }

    return {
      ingrediente: raw,
      quantidade: ''
    };
  }

  function setStatus(key, msg, isError = false) {
    const el = $(`importStatus_${key}`);
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = isError ? '#b91c1c' : '#166534';
  }

  function setNome(config, value) {
    const campo = $(config.fields.nome);
    if (!campo) return;
    if (!campo.value.trim()) {
      campo.value = cleanText(value);
    }
  }

  function clearTabela(config) {
    const tbody = $(config.fields.tbody1);
    if (tbody) tbody.innerHTML = '';
  }

  function preencherTabela(config, linhas) {
    clearTabela(config);

    const itens = Array.isArray(linhas) && linhas.length
      ? linhas
      : [{ ingrediente: '', quantidade: '' }];

    itens.forEach((item) => {
      const addRow = window[config.addRowFn];
      if (typeof addRow === 'function') {
        addRow('1');
      }

      const tr = $(config.fields.tbody1)?.lastElementChild;
      if (!tr) return;

      const inputIng = tr.querySelector('.modalIng');
      const inputQtd = tr.querySelector('.modalQtd');
      const inputObs = tr.querySelector('.modalObs');

      if (inputIng) inputIng.value = cleanText(item.ingrediente);
      if (inputQtd) inputQtd.value = cleanText(item.quantidade);
      if (inputObs) inputObs.value = cleanText(item.obs);
    });
  }

  async function importarExcel(file, config) {
    if (!window.XLSX) {
      throw new Error('Biblioteca XLSX não carregada.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const firstSheet = workbook.SheetNames?.[0];

    if (!firstSheet) {
      throw new Error('A planilha está vazia.');
    }

    const worksheet = workbook.Sheets[firstSheet];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: false,
      blankrows: false
    });

    const linhas = [];

    rows.forEach((row, idx) => {
      const valores = Array.isArray(row)
        ? row.map((cell) => cleanText(cell)).filter(Boolean)
        : [];

      if (!valores.length) return;

      if (idx === 0 && valores.length === 1) {
        setNome(config, valores[0]);
      }

      if (valores.length >= 2) {
        linhas.push({
          ingrediente: valores[0],
          quantidade: valores[1] || '',
          obs: valores.slice(2).join(' | ')
        });
      } else if (valores.length === 1) {
        linhas.push(splitLinha(valores[0]));
      }
    });

    return linhas.filter(Boolean);
  }

  async function importarWord(file, config) {
    if (!window.mammoth) {
      throw new Error('Biblioteca Mammoth não carregada.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    const texto = String(result.value || '');

    const linhasTexto = texto
      .split(/\n+/)
      .map((line) => cleanText(line))
      .filter(Boolean);

    if (linhasTexto[0]) {
      setNome(config, linhasTexto[0]);
    }

    return linhasTexto
      .slice(1)
      .map(splitLinha)
      .filter(Boolean);
  }

  async function importarArquivo(file, config) {
    const nome = String(file?.name || '').toLowerCase();

    if (nome.endsWith('.xlsx') || nome.endsWith('.xls') || nome.endsWith('.csv')) {
      return importarExcel(file, config);
    }

    if (nome.endsWith('.docx')) {
      return importarWord(file, config);
    }

    throw new Error('Use arquivo .docx, .xlsx, .xls ou .csv.');
  }

  function buildBox(config) {
    return `
      <div class="oferenda-fotos-box" id="importadorBox_${config.key}" style="margin-top:12px; margin-bottom:12px;">
        <div class="saved-title" style="margin-bottom:8px;">Importar Word ou Excel</div>
        <div class="hint" style="margin-bottom:12px;">
          Escolha um arquivo .docx, .xlsx, .xls ou .csv.
          O conteúdo será trazido para as linhas editáveis da Lista 1, sem salvar automático.
        </div>

        <input id="importFile_${config.key}" type="file" accept=".docx,.xlsx,.xls,.csv" />

        <div id="importStatus_${config.key}" class="hint" style="margin-top:10px;"></div>
      </div>
    `;
  }

  function injectImportBox(config) {
    const backdrop = $(config.backdropId);
    const card = backdrop?.querySelector('.modal-card');
    const head = card?.querySelector('.section-head');

    if (!backdrop || !card || !head) return;
    if (card.querySelector(`#importadorBox_${config.key}`)) return;

    head.insertAdjacentHTML('afterend', buildBox(config));

    const input = $(`importFile_${config.key}`);
    if (!input) return;

    input.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        setStatus(config.key, 'Importando arquivo...');

        const nomeBase = file.name.replace(/\.[^.]+$/, '');
        setNome(config, nomeBase);

        const linhas = await importarArquivo(file, config);
        preencherTabela(config, linhas);

        setStatus(
          config.key,
          'Importação concluída. Revise, imprima se quiser, e depois clique em "Enviar para banco de dados".'
        );
      } catch (error) {
        console.error(error);
        setStatus(config.key, error?.message || 'Erro ao importar arquivo.', true);
      } finally {
        event.target.value = '';
      }
    });
  }

  function boot() {
    CONFIGS.forEach(injectImportBox);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
