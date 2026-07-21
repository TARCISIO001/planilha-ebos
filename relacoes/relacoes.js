(function () {
  'use strict';

  // V19: Ebó e Oferenda usam o mesmo cabeçalho centralizado e tipografia ampliada.
  const SCREEN_ID = 'relacoesScreen';
  const RELACOES_EBO_COLLECTION = 'relacoes_ebo';
  const LISTAS_COLLECTION = 'listas';
  const TITULO_PADRAO = 'Relação de ebós do evento';

  // A tela Relações agora faz parte do index.html.
  // Este módulo apenas controla a section #relacoesScreen, sem redirecionar
  // o navegador para relacoes.html.
  const MODO_STANDALONE = document.body.classList.contains('relacoes-standalone');

  let tiposEbo = [];
  let relacoesSalvas = [];
  let relacaoEditandoId = null;
  let carregandoTipos = null;
  let carregandoRelacoes = null;


  function obter(id) {
    return document.getElementById(id);
  }

  function firebase() {
    if (!window.__FIREBASE__) {
      throw new Error('Firebase não inicializado.');
    }
    return window.__FIREBASE__;
  }

  function escaparHTML(valor) {
    return String(valor ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizarTexto(valor) {
    return String(valor || '')
      .toLocaleLowerCase('pt-BR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function formatarDataBR(dataISO) {
    const texto = String(dataISO || '').trim();
    const partes = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!partes) return texto || 'Data não informada';
    return `${partes[3]}/${partes[2]}/${partes[1]}`;
  }

  function formatarDataCurta(dataISO) {
    const texto = String(dataISO || '').trim();
    const partes = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!partes) return texto || '—';
    return `${partes[3]}/${partes[2]}/${partes[1]}`;
  }

  function timestampParaNumero(valor) {
    try {
      if (valor?.toMillis) return valor.toMillis();
      if (valor?.toDate) return valor.toDate().getTime();
      if (valor instanceof Date) return valor.getTime();
      return Number(valor || 0);
    } catch {
      return 0;
    }
  }

  function rotuloComplemento(valor) {
    const chave = normalizarTexto(valor);
    if (chave === 'obi') return 'Obi';
    if (chave === 'bori') return 'Bori';
    if (chave === 'oferta') return 'Oferta';
    return '';
  }

  function hojeISO() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }


  function obterUrlLogoCentro() {
    const logoExistente = document.querySelector('.logo-sistema, .print-logo');
    if (logoExistente?.src) return logoExistente.src;

    try {
      return new URL(MODO_STANDALONE ? '../imagem.png' : './imagem.png', document.baseURI).href;
    } catch {
      return MODO_STANDALONE ? '../imagem.png' : './imagem.png';
    }
  }

  function carregarLogoCentroParaPdf() {
    const url = obterUrlLogoCentro();

    return new Promise((resolve) => {
      const imagem = new Image();
      imagem.crossOrigin = 'anonymous';

      imagem.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = imagem.naturalWidth || imagem.width || 1;
          canvas.height = imagem.naturalHeight || imagem.height || 1;
          const contexto = canvas.getContext('2d');
          contexto.drawImage(imagem, 0, 0);
          resolve({
            dataUrl: canvas.toDataURL('image/png'),
            largura: canvas.width,
            altura: canvas.height
          });
        } catch (erro) {
          console.warn('Não foi possível preparar a logo para o PDF:', erro);
          resolve(null);
        }
      };

      imagem.onerror = () => resolve(null);
      imagem.src = url;
    });
  }

  function aguardarImagensDocumento(documento, limiteMs = 2200) {
    const imagens = Array.from(documento?.images || []);
    if (!imagens.length) return Promise.resolve();

    return Promise.race([
      Promise.all(imagens.map((imagem) => {
        if (imagem.complete) return Promise.resolve();
        return new Promise((resolve) => {
          imagem.addEventListener('load', resolve, { once: true });
          imagem.addEventListener('error', resolve, { once: true });
        });
      })),
      new Promise((resolve) => window.setTimeout(resolve, limiteMs))
    ]);
  }

  async function desenharCabecalhoPdfCentralizado(doc, titulo, dataTexto, paginaLargura, margem) {
    const centroX = paginaLargura / 2;
    const larguraUtil = paginaLargura - (margem * 2);
    let y = 8;
    const logo = await carregarLogoCentroParaPdf();

    if (logo?.dataUrl) {
      const limiteLargura = 46;
      const limiteAltura = 26;
      const proporcao = Math.min(limiteLargura / logo.largura, limiteAltura / logo.altura);
      const larguraLogo = logo.largura * proporcao;
      const alturaLogo = logo.altura * proporcao;
      doc.addImage(logo.dataUrl, 'PNG', centroX - (larguraLogo / 2), y, larguraLogo, alturaLogo);
      y += alturaLogo + 2.5;
    }

    doc.setTextColor(154, 93, 47);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.text("ILÊ D'OGUM", centroX, y, { align: 'center' });
    y += 8;

    doc.setTextColor(41, 37, 36);
    doc.setFontSize(22);
    const tituloLinhas = quebrarTextoPdf(doc, titulo, larguraUtil * 0.88);
    doc.text(tituloLinhas, centroX, y, { align: 'center' });
    y += tituloLinhas.length * 7.2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12.5);
    doc.setTextColor(104, 97, 91);
    doc.text(dataTexto, centroX, y, { align: 'center' });
    y += 5.5;

    doc.setDrawColor(207, 202, 197);
    doc.line(margem, y, paginaLargura - margem, y);
    return y + 7;
  }

  function esconderTelasDoSistema() {
    if (typeof window.esconderTodasAsTelas === 'function') {
      window.esconderTodasAsTelas();
      return;
    }

    [
      'postLogin',
      'adminScreen',
      'oferendasScreen',
      'banhosScreen',
      'positivosScreen',
      'listaScreen',
      'aleatorioScreen',
      SCREEN_ID
    ].forEach((id) => {
      const tela = obter(id);
      if (tela) tela.style.display = 'none';
    });
  }

  function mostrarEscolhaRelacoes() {
    const escolha = obter('relacoesEscolha');
    const relacaoEbo = obter('container-relacao-ebo');
    const relacaoOferenda = obter('container-relacao-oferenda');

    if (escolha) escolha.style.display = 'block';
    if (relacaoEbo) relacaoEbo.style.display = 'none';
    if (relacaoOferenda) relacaoOferenda.style.display = 'none';
  }

  async function abrirContainerRelacaoEbo() {
    const escolha = obter('relacoesEscolha');
    const relacaoEbo = obter('container-relacao-ebo');
    const relacaoOferenda = obter('container-relacao-oferenda');

    if (escolha) escolha.style.display = 'none';
    if (relacaoEbo) relacaoEbo.style.display = 'block';
    if (relacaoOferenda) relacaoOferenda.style.display = 'none';

    if (!obter('relacaoEboData')?.value) {
      obter('relacaoEboData').value = hojeISO();
    }

    if (!obter('relacaoEboLinhas')?.children.length) {
      adicionarLinhaRelacao();
    }

    await Promise.allSettled([
      carregarTiposEbo(),
      carregarRelacoesSalvas()
    ]);

    atualizarResumo();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function abrirContainerRelacaoOferenda() {
    const escolha = obter('relacoesEscolha');
    const relacaoEbo = obter('container-relacao-ebo');
    const relacaoOferenda = obter('container-relacao-oferenda');

    if (escolha) escolha.style.display = 'none';
    if (relacaoEbo) relacaoEbo.style.display = 'none';
    if (relacaoOferenda) relacaoOferenda.style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // Volta da ficha Relação de Ebó para a tela Projeto Relações.
  // Não muda de página, não recarrega o Firebase e não toca na autenticação.
  function voltarParaEscolhaRelacoes(evento) {
    evento?.preventDefault?.();
    evento?.stopPropagation?.();
    evento?.stopImmediatePropagation?.();

    mostrarEscolhaRelacoes();
    window.scrollTo({ top: 0, behavior: 'instant' });
    return false;
  }

  // Volta da tela Projeto Relações diretamente para a página principal.
  // Não usa history.back(), porque o histórico pode apontar para uma tela
  // antiga de login e produzir o efeito visual de deslogar e logar novamente.
function voltarParaPaginaInicial(evento) {
  evento?.preventDefault?.();

  esconderTelasDoSistema();

  const painel = obter('postLogin');
  if (painel) painel.style.display = 'block';

  window.scrollTo({ top: 0, behavior: 'instant' });

  return false;
}

  function obterCatalogoTiposEbo(valorSelecionado = '', tipoSelecionadoId = '') {
    const selecionado = String(valorSelecionado || '').trim();
    const mapa = new Map();

    tiposEbo.forEach((tipo) => {
      const nome = String(tipo?.nome || '').trim();
      const chave = normalizarTexto(nome);
      if (!nome || !chave || mapa.has(chave)) return;
      mapa.set(chave, { id: String(tipo?.id || ''), nome, antigo: false });
    });

    // Relações antigas continuam exibindo o tipo salvo, mesmo quando a lista
    // original já não existe no cadastro atual.
    if (selecionado) {
      const chave = normalizarTexto(selecionado);
      if (chave && !mapa.has(chave)) {
        mapa.set(chave, { id: String(tipoSelecionadoId || ''), nome: selecionado, antigo: true });
      }
    }

    return Array.from(mapa.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base', numeric: true })
    );
  }

  function montarResumoDropdownTipoEbo(valorSelecionado = '') {
    const selecionado = String(valorSelecionado || '').trim();
    if (!selecionado) {
      return '<span class="relacao-select-ebo-placeholder">Selecione o tipo de ebó</span>';
    }

    return `<span class="relacao-select-ebo-chip">${escaparHTML(selecionado)}</span>`;
  }

  function montarOpcoesDropdownTiposEbo(valorSelecionado = '', tipoSelecionadoId = '') {
    const selecionado = String(valorSelecionado || '').trim();
    const chaveSelecionada = normalizarTexto(selecionado);
    const catalogo = obterCatalogoTiposEbo(selecionado, tipoSelecionadoId);

    if (!catalogo.length) {
      return '<div class="relacao-select-ebo-vazio">Nenhuma lista de ebó cadastrada.</div>';
    }

    return catalogo.map((tipo) => {
      const marcado = normalizarTexto(tipo.nome) === chaveSelecionada;
      const textoAntigo = tipo.antigo ? ' <small>(lista antiga)</small>' : '';

      return `
        <button
          type="button"
          class="relacao-select-ebo-opcao${marcado ? ' selecionado' : ''}"
          data-tipo-ebo="${escaparHTML(tipo.nome)}"
          data-lista-id="${escaparHTML(tipo.id)}"
          aria-selected="${marcado ? 'true' : 'false'}"
        >
          <span class="relacao-select-ebo-marcador" aria-hidden="true">✓</span>
          <span class="relacao-select-ebo-opcao-texto">${escaparHTML(tipo.nome)}${textoAntigo}</span>
          <small class="relacao-select-ebo-aviso" aria-live="polite"></small>
        </button>
      `;
    }).join('');
  }

  function montarSeletorTipoEbo(valorSelecionado = '', tipoSelecionadoId = '') {
    const selecionado = String(valorSelecionado || '').trim();

    return `
      <details
        class="relacao-select-ebo"
        data-tipo-ebo="${escaparHTML(selecionado)}"
        data-tipo-ebo-id="${escaparHTML(tipoSelecionadoId)}"
      >
        <summary aria-label="Abrir seleção do tipo de ebó">
          <span class="relacao-select-ebo-resumo">
            ${montarResumoDropdownTipoEbo(selecionado)}
          </span>
          <span class="relacao-multiselect-seta" aria-hidden="true">▾</span>
        </summary>
        <div class="relacao-select-ebo-opcoes" role="listbox">
          ${montarOpcoesDropdownTiposEbo(selecionado, tipoSelecionadoId)}
        </div>
      </details>
    `;
  }

  function obterTipoEboDaLinha(tr) {
    const seletor = tr?.querySelector('.relacao-select-ebo');
    return {
      nome: String(seletor?.dataset?.tipoEbo || '').trim(),
      id: String(seletor?.dataset?.tipoEboId || '').trim()
    };
  }

  function obterTiposEboUsadosPelaMesmaPessoa(linhaAtual) {
    const pessoaAtual = normalizarTexto(linhaAtual?.querySelector('.relacao-pessoa')?.value || '');
    const usados = new Set();
    if (!pessoaAtual) return usados;

    document.querySelectorAll('#relacaoEboLinhas .relacao-linha').forEach((linha) => {
      if (linha === linhaAtual) return;
      const pessoa = normalizarTexto(linha.querySelector('.relacao-pessoa')?.value || '');
      if (!pessoa || pessoa !== pessoaAtual) return;

      const tipo = obterTipoEboDaLinha(linha).nome;
      const chave = normalizarTexto(tipo);
      if (chave) usados.add(chave);
    });

    return usados;
  }

  function atualizarMarcacaoTiposEboPorPessoa() {
    document.querySelectorAll('#relacaoEboLinhas .relacao-linha').forEach((linha) => {
      const seletor = linha.querySelector('.relacao-select-ebo');
      if (!seletor) return;

      const atual = String(seletor.dataset.tipoEbo || '').trim();
      const chaveAtual = normalizarTexto(atual);
      const usados = obterTiposEboUsadosPelaMesmaPessoa(linha);
      const duplicadoAtual = Boolean(chaveAtual && usados.has(chaveAtual));

      seletor.classList.toggle('tem-duplicidade', duplicadoAtual);

      const resumo = seletor.querySelector('.relacao-select-ebo-resumo');
      resumo?.classList.toggle('duplicado', duplicadoAtual);

      seletor.querySelectorAll('.relacao-select-ebo-opcao[data-tipo-ebo]').forEach((opcao) => {
        const chave = normalizarTexto(opcao.dataset.tipoEbo || '');
        const ehAtual = Boolean(chave && chave === chaveAtual);
        const jaUsado = Boolean(chave && usados.has(chave));
        const bloquear = jaUsado && !ehAtual;
        const duplicado = jaUsado && ehAtual;

        opcao.classList.toggle('selecionado', ehAtual);
        opcao.classList.toggle('ja-usado', bloquear);
        opcao.classList.toggle('duplicado', duplicado);
        opcao.disabled = bloquear;
        opcao.setAttribute('aria-selected', ehAtual ? 'true' : 'false');
        opcao.setAttribute('aria-disabled', bloquear ? 'true' : 'false');

        const aviso = opcao.querySelector('.relacao-select-ebo-aviso');
        if (aviso) {
          aviso.textContent = duplicado
            ? 'Duplicado para esta pessoa'
            : bloquear
              ? 'Já escolhido para esta pessoa'
              : '';
        }
      });
    });
  }

  function atualizarResumoDoDropdownTipoEbo(seletor) {
    if (!seletor) return;
    const resumo = seletor.querySelector('.relacao-select-ebo-resumo');
    if (!resumo) return;
    resumo.innerHTML = montarResumoDropdownTipoEbo(seletor.dataset.tipoEbo || '');
  }

  function escolherTipoEboNoDropdown(opcao) {
    if (!opcao || opcao.disabled) return;

    const seletor = opcao.closest('.relacao-select-ebo');
    const linha = opcao.closest('.relacao-linha');
    if (!seletor || !linha) return;

    const valor = String(opcao.dataset.tipoEbo || '').trim();
    const chave = normalizarTexto(valor);
    const usados = obterTiposEboUsadosPelaMesmaPessoa(linha);

    if (chave && usados.has(chave)) {
      definirFeedback(`O tipo “${valor}” já foi escolhido para esta pessoa.`, 'aviso', 4000);
      atualizarMarcacaoTiposEboPorPessoa();
      return;
    }

    seletor.dataset.tipoEbo = valor;
    seletor.dataset.tipoEboId = String(opcao.dataset.listaId || '').trim();
    atualizarResumoDoDropdownTipoEbo(seletor);
    seletor.removeAttribute('open');
    atualizarMarcacaoTiposEboPorPessoa();
    atualizarResumo();
  }

  function atualizarSelectsTiposEbo() {
    document.querySelectorAll('#relacaoEboLinhas .relacao-select-ebo').forEach((seletorAtual) => {
      const atual = String(seletorAtual.dataset.tipoEbo || '').trim();
      const atualId = String(seletorAtual.dataset.tipoEboId || '').trim();
      const template = document.createElement('template');
      template.innerHTML = montarSeletorTipoEbo(atual, atualId).trim();
      seletorAtual.replaceWith(template.content.firstElementChild);
    });

    atualizarMarcacaoTiposEboPorPessoa();
  }

  async function carregarTiposEbo(forcar = false) {
    if (carregandoTipos && !forcar) return carregandoTipos;

    carregandoTipos = (async () => {
      const botao = obter('btnRecarregarTiposEbo');
      if (botao) {
        botao.disabled = true;
        botao.textContent = 'Atualizando...';
      }

      try {
        const { db, collection, getDocs } = firebase();
        const snapshot = await getDocs(collection(db, LISTAS_COLLECTION));
        const mapa = new Map();

        snapshot.forEach((documento) => {
          const dados = documento.data() || {};
          const nomes = [dados.nome, dados.nome2]
            .map((nome) => String(nome || '').trim())
            .filter(Boolean);

          nomes.forEach((nome) => {
            const chave = normalizarTexto(nome);
            if (!chave || mapa.has(chave)) return;
            mapa.set(chave, { id: documento.id, nome });
          });
        });

        tiposEbo = Array.from(mapa.values()).sort((a, b) =>
          a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base', numeric: true })
        );

        atualizarSelectsTiposEbo();
        definirFeedback(
          tiposEbo.length
            ? `${tiposEbo.length} tipo${tiposEbo.length === 1 ? '' : 's'} de ebó carregado${tiposEbo.length === 1 ? '' : 's'}.`
            : 'Nenhuma lista de ebó cadastrada foi encontrada.',
          tiposEbo.length ? 'sucesso' : 'aviso',
          3500
        );
      } catch (erro) {
        console.error('Erro ao carregar tipos de ebó:', erro);
        definirFeedback('Não foi possível carregar as listas cadastradas. Verifique o Firebase.', 'erro');
      } finally {
        if (botao) {
          botao.disabled = false;
          botao.textContent = '↻ Atualizar tipos';
        }
        carregandoTipos = null;
      }
    })();

    return carregandoTipos;
  }

  function adicionarLinhaRelacao(dados = {}, focar = true) {
    const tbody = obter('relacaoEboLinhas');
    if (!tbody) return;

    const pessoa = String(dados.pessoa || dados.nome || '').trim();
    const tipoEbo = String(dados.tipoEbo || dados.ebo || '').trim();
    const tipoEboId = String(dados.tipoEboId || dados.eboId || '').trim();
    const complemento = normalizarTexto(dados.complemento || dados.obiBoriOferta || dados.tipoComplemento || '');
    const observacao = String(dados.observacao || dados.obs || '').trim();

    const tr = document.createElement('tr');
    tr.className = 'relacao-linha';
    tr.innerHTML = `
      <td data-label="Pessoa ou referência">
        <input class="relacao-pessoa" type="text" placeholder="Digite o nome" value="${escaparHTML(pessoa)}" maxlength="120" />
      </td>
      <td data-label="Tipo de ebó">
        ${montarSeletorTipoEbo(tipoEbo, tipoEboId)}
      </td>
      <td data-label="Obi / Bori / Oferta">
        <select class="relacao-complemento">
          <option value="">Selecione</option>
          <option value="obi"${complemento === 'obi' ? ' selected' : ''}>Obi</option>
          <option value="bori"${complemento === 'bori' ? ' selected' : ''}>Bori</option>
          <option value="oferta"${complemento === 'oferta' ? ' selected' : ''}>Oferta</option>
        </select>
      </td>
      <td data-label="Observação">
        <input class="relacao-observacao" type="text" placeholder="Observação opcional" value="${escaparHTML(observacao)}" maxlength="240" />
      </td>
      <td class="relacao-coluna-acao" data-label="Ação">
        <button class="btn-danger btn-mini relacao-remover-linha" type="button" title="Remover esta pessoa">Remover</button>
      </td>
    `;

    tbody.appendChild(tr);
    atualizarMarcacaoTiposEboPorPessoa();
    atualizarResumo();

    if (focar) tr.querySelector('.relacao-pessoa')?.focus();
  }

  function coletarLinhas({ incluirIncompletas = false } = {}) {
    return Array.from(document.querySelectorAll('#relacaoEboLinhas .relacao-linha'))
      .map((tr, indice) => {
        const pessoa = String(tr.querySelector('.relacao-pessoa')?.value || '').trim();
        const seletorEbo = tr.querySelector('.relacao-select-ebo');
        const tipoEbo = String(seletorEbo?.dataset?.tipoEbo || '').trim();
        const tipoEboId = String(seletorEbo?.dataset?.tipoEboId || '').trim();
        const complemento = String(tr.querySelector('.relacao-complemento')?.value || '').trim();
        const observacao = String(tr.querySelector('.relacao-observacao')?.value || '').trim();
        const preenchida = Boolean(pessoa || tipoEbo || complemento || observacao);

        return {
          indice,
          pessoa,
          tipoEbo,
          tipoEboId,
          complemento,
          observacao,
          preenchida
        };
      })
      .filter((linha) => incluirIncompletas || linha.preenchida);
  }

  function calcularResumo(linhas = coletarLinhas()) {
    const validas = linhas.filter((linha) => linha.tipoEbo);
    const porTipo = new Map();
    const complementos = { obi: 0, bori: 0, oferta: 0 };

    validas.forEach((linha) => {
      const tipo = linha.tipoEbo.trim();
      const chave = normalizarTexto(tipo);
      if (chave) {
        const atual = porTipo.get(chave) || { nome: tipo, quantidade: 0 };
        atual.quantidade += 1;
        porTipo.set(chave, atual);
      }

      if (Object.prototype.hasOwnProperty.call(complementos, linha.complemento)) {
        complementos[linha.complemento] += 1;
      }
    });

    return {
      totalEbos: validas.length,
      obi: complementos.obi,
      bori: complementos.bori,
      oferta: complementos.oferta,
      porTipo: Array.from(porTipo.values()).sort((a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base', numeric: true })
      )
    };
  }

  function atualizarResumo() {
    const resumo = calcularResumo();

    if (obter('relacaoTotalEbos')) obter('relacaoTotalEbos').textContent = String(resumo.totalEbos);
    if (obter('relacaoTotalObi')) obter('relacaoTotalObi').textContent = String(resumo.obi);
    if (obter('relacaoTotalBori')) obter('relacaoTotalBori').textContent = String(resumo.bori);
    if (obter('relacaoTotalOferta')) obter('relacaoTotalOferta').textContent = String(resumo.oferta);

    const box = obter('relacaoTiposResumo');
    if (!box) return;

    if (!resumo.porTipo.length) {
      box.innerHTML = `
        <div class="relacao-tipos-resumo-titulo">Quantidade por tipo de ebó</div>
        <div class="relacao-tipos-vazio">Adicione pessoas para gerar o resumo automaticamente.</div>
      `;
      return;
    }

    box.innerHTML = `
      <div class="relacao-tipos-resumo-titulo">Quantidade por tipo de ebó</div>
      <div class="relacao-tipos-grid">
        ${resumo.porTipo.map((item) => `
          <div class="relacao-tipo-item">
            <span>${escaparHTML(item.nome)}</span>
            <strong>${item.quantidade} ${item.quantidade === 1 ? 'ebó' : 'ebós'}</strong>
          </div>
        `).join('')}
      </div>
    `;
  }

  function validarRelacao() {
    const titulo = String(obter('relacaoEboTitulo')?.value || '').trim() || TITULO_PADRAO;
    const dataFuncao = String(obter('relacaoEboData')?.value || '').trim();
    const linhas = coletarLinhas();

    if (!dataFuncao) {
      definirFeedback('Informe a data da função.', 'erro');
      obter('relacaoEboData')?.focus();
      return null;
    }

    if (!linhas.length) {
      definirFeedback('Adicione pelo menos uma pessoa à relação.', 'erro');
      return null;
    }

    const tiposPorPessoa = new Map();
    for (const linha of linhas) {
      const pessoaChave = normalizarTexto(linha.pessoa);
      const tipoChave = normalizarTexto(linha.tipoEbo);
      if (!pessoaChave || !tipoChave) continue;

      const chave = `${pessoaChave}::${tipoChave}`;
      if (tiposPorPessoa.has(chave)) {
        const primeiraLinha = tiposPorPessoa.get(chave);
        const trDuplicada = document.querySelectorAll('#relacaoEboLinhas .relacao-linha')[linha.indice];
        definirFeedback(
          `O tipo “${linha.tipoEbo}” foi colocado duas vezes para ${linha.pessoa} (linhas ${primeiraLinha + 1} e ${linha.indice + 1}).`,
          'erro'
        );
        trDuplicada?.querySelector('.relacao-select-ebo > summary')?.focus();
        atualizarMarcacaoTiposEboPorPessoa();
        return null;
      }
      tiposPorPessoa.set(chave, linha.indice);
    }

    for (const linha of linhas) {
      const tr = document.querySelectorAll('#relacaoEboLinhas .relacao-linha')[linha.indice];

      if (!linha.pessoa) {
        definirFeedback(`Informe o nome da pessoa na linha ${linha.indice + 1}.`, 'erro');
        tr?.querySelector('.relacao-pessoa')?.focus();
        return null;
      }

      if (!linha.tipoEbo) {
        definirFeedback(`Selecione o tipo de ebó de ${linha.pessoa}.`, 'erro');
        tr?.querySelector('.relacao-select-ebo > summary')?.focus();
        return null;
      }

      if (!linha.complemento) {
        definirFeedback(`Selecione Obi, Bori ou Oferta para ${linha.pessoa}.`, 'erro');
        tr?.querySelector('.relacao-complemento')?.focus();
        return null;
      }
    }

    const linhasLimpas = linhas.map(({ indice, preenchida, ...linha }) => linha);
    return {
      titulo,
      titulo_norm: normalizarTexto(titulo),
      dataFuncao,
      linhas: linhasLimpas,
      resumo: calcularResumo(linhasLimpas)
    };
  }

  function definirFeedback(mensagem, tipo = 'neutro', limparApos = 0) {
    const box = obter('relacaoEboFeedback');
    if (!box) return;

    box.textContent = mensagem || '';
    box.dataset.tipo = tipo;

    if (limparApos > 0) {
      window.setTimeout(() => {
        if (box.textContent === mensagem) {
          box.textContent = '';
          box.dataset.tipo = 'neutro';
        }
      }, limparApos);
    }
  }

  function atualizarEstadoEdicao() {
    const status = obter('relacaoEboStatusEdicao');
    const salvar = obter('btnSalvarRelacaoEbo');

    if (status) status.textContent = relacaoEditandoId ? 'Editando uma relação salva' : 'Nova relação';
    if (salvar) salvar.textContent = relacaoEditandoId ? 'Atualizar relação' : 'Salvar relação';
  }

  async function salvarRelacaoEbo() {
    const dados = validarRelacao();
    if (!dados) return;

    const botao = obter('btnSalvarRelacaoEbo');
    if (botao) {
      botao.disabled = true;
      botao.textContent = relacaoEditandoId ? 'Atualizando...' : 'Salvando...';
    }

    try {
      const { db, collection, addDoc, doc, setDoc, serverTimestamp, auth } = firebase();
      const usuario = auth?.currentUser?.email || '';
      const payload = {
        ...dados,
        usuario,
        updatedAt: serverTimestamp()
      };

      if (relacaoEditandoId) {
        await setDoc(doc(db, RELACOES_EBO_COLLECTION, relacaoEditandoId), payload, { merge: true });
        definirFeedback('Relação atualizada com sucesso.', 'sucesso', 4000);
      } else {
        payload.createdAt = serverTimestamp();
        const referencia = await addDoc(collection(db, RELACOES_EBO_COLLECTION), payload);
        relacaoEditandoId = referencia.id;
        definirFeedback('Relação salva com sucesso.', 'sucesso', 4000);
      }

      atualizarEstadoEdicao();
      await carregarRelacoesSalvas(true);
    } catch (erro) {
      console.error('Erro ao salvar relação de ebó:', erro);
      definirFeedback(`Erro ao salvar a relação: ${erro?.code || erro?.message || 'falha desconhecida'}.`, 'erro');
    } finally {
      if (botao) {
        botao.disabled = false;
        atualizarEstadoEdicao();
      }
    }
  }

  function limparFormularioRelacao({ confirmar = true } = {}) {
    const linhasPreenchidas = coletarLinhas().length > 0;
    const tituloAtual = String(obter('relacaoEboTitulo')?.value || '').trim();
    const alterado = linhasPreenchidas || (tituloAtual && tituloAtual !== TITULO_PADRAO) || relacaoEditandoId;

    if (confirmar && alterado && !window.confirm('Deseja iniciar uma nova relação? Os dados ainda não salvos serão limpos.')) {
      return;
    }

    relacaoEditandoId = null;
    if (obter('relacaoEboTitulo')) obter('relacaoEboTitulo').value = TITULO_PADRAO;
    if (obter('relacaoEboData')) obter('relacaoEboData').value = hojeISO();
    if (obter('relacaoEboLinhas')) obter('relacaoEboLinhas').innerHTML = '';
    adicionarLinhaRelacao({}, false);
    atualizarEstadoEdicao();
    atualizarResumo();
    definirFeedback('Nova relação pronta para preenchimento.', 'neutro', 2500);
    obter('relacaoEboTitulo')?.focus();
  }

  async function carregarRelacoesSalvas(forcar = false) {
    if (carregandoRelacoes && !forcar) return carregandoRelacoes;

    carregandoRelacoes = (async () => {
      const box = obter('relacoesEboSalvasBox');
      const botao = obter('btnAtualizarRelacoesSalvas');

      if (botao) {
        botao.disabled = true;
        botao.textContent = 'Atualizando...';
      }
      if (box) box.innerHTML = '<div class="relacoes-vazio">Carregando relações...</div>';

      try {
        const { db, collection, getDocs } = firebase();
        const snapshot = await getDocs(collection(db, RELACOES_EBO_COLLECTION));
        const itens = [];

        snapshot.forEach((documento) => {
          itens.push({ id: documento.id, ...(documento.data() || {}) });
        });

        itens.sort((a, b) => {
          const tempoB = timestampParaNumero(b.updatedAt || b.createdAt);
          const tempoA = timestampParaNumero(a.updatedAt || a.createdAt);
          if (tempoB !== tempoA) return tempoB - tempoA;
          return String(b.dataFuncao || '').localeCompare(String(a.dataFuncao || ''));
        });

        relacoesSalvas = itens;
        renderizarRelacoesSalvas();
      } catch (erro) {
        console.error('Erro ao carregar relações salvas:', erro);
        if (box) {
          box.innerHTML = `
            <div class="relacoes-vazio relacoes-vazio-erro">
              Não foi possível carregar as relações. Verifique as permissões da coleção <strong>${RELACOES_EBO_COLLECTION}</strong> no Firebase.
            </div>
          `;
        }
      } finally {
        if (botao) {
          botao.disabled = false;
          botao.textContent = 'Atualizar';
        }
        carregandoRelacoes = null;
      }
    })();

    return carregandoRelacoes;
  }

  function relacaoCorrespondePesquisa(item, termo) {
    if (!termo) return true;
    const linhas = Array.isArray(item.linhas) ? item.linhas : [];
    const texto = [
      item.titulo,
      item.dataFuncao,
      ...linhas.flatMap((linha) => [linha.pessoa, linha.tipoEbo, linha.complemento, linha.observacao])
    ].join(' ');
    return normalizarTexto(texto).includes(termo);
  }

  function montarBotoesRelacaoSalva() {
    return `
      <button class="btn-tertiary btn-mini" type="button" data-acao="editar">Editar</button>
      <button class="btn-print btn-mini" type="button" data-acao="imprimir">Imprimir</button>
      <button class="btn-pdf btn-mini" type="button" data-acao="pdf">PDF</button>
      <button class="btn-danger btn-mini" type="button" data-acao="excluir">Excluir</button>
    `;
  }

  function renderizarRelacoesSalvas() {
    const box = obter('relacoesEboSalvasBox');
    if (!box) return;

    const termo = normalizarTexto(obter('pesquisaRelacoesEbo')?.value || '');
    const itens = relacoesSalvas.filter((item) => relacaoCorrespondePesquisa(item, termo));

    if (!itens.length) {
      box.innerHTML = `<div class="relacoes-vazio">${termo ? 'Nenhuma relação corresponde à pesquisa.' : 'Nenhuma relação salva.'}</div>`;
      return;
    }

    box.innerHTML = itens.map((item) => {
      const linhas = Array.isArray(item.linhas) ? item.linhas : [];
      const resumo = item.resumo?.totalEbos !== undefined ? item.resumo : calcularResumo(linhas);
      const quantidadePessoas = linhas.filter((linha) => String(linha.pessoa || '').trim()).length;
      const totalEbos = Number(resumo.totalEbos || linhas.length || 0);
      const pessoas = linhas.map((linha) => linha.pessoa).filter(Boolean).slice(0, 3);
      const complementoPessoas = quantidadePessoas > 3 ? ` +${quantidadePessoas - 3}` : '';

      return `
        <article class="relacao-salva-item" data-relacao-id="${escaparHTML(item.id)}">
          <div class="relacao-salva-conteudo">
            <div class="relacao-salva-titulo">${escaparHTML(item.titulo || TITULO_PADRAO)}</div>
            <div class="relacao-salva-meta">
              <span>📅 ${escaparHTML(formatarDataCurta(item.dataFuncao))}</span>
              <span>📿 ${totalEbos} ${totalEbos === 1 ? 'ebó' : 'ebós'}</span>
              <span>👤 ${quantidadePessoas} ${quantidadePessoas === 1 ? 'pessoa' : 'pessoas'}</span>
            </div>
            ${pessoas.length ? `<div class="relacao-salva-pessoas">${escaparHTML(pessoas.join(', '))}${escaparHTML(complementoPessoas)}</div>` : ''}
          </div>
          <div class="relacao-salva-acoes">
            ${montarBotoesRelacaoSalva()}
          </div>
        </article>
      `;
    }).join('');
  }

  async function obterRelacaoPorId(id) {
    const cache = relacoesSalvas.find((item) => item.id === id);
    if (cache) return cache;

    const { db, doc, getDoc } = firebase();
    const snapshot = await getDoc(doc(db, RELACOES_EBO_COLLECTION, id));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...(snapshot.data() || {}) };
  }

  async function editarRelacaoSalva(id) {
    try {
      const item = await obterRelacaoPorId(id);
      if (!item) {
        definirFeedback('Relação não encontrada.', 'erro');
        return;
      }

      relacaoEditandoId = id;
      if (obter('relacaoEboTitulo')) obter('relacaoEboTitulo').value = item.titulo || TITULO_PADRAO;
      if (obter('relacaoEboData')) obter('relacaoEboData').value = item.dataFuncao || hojeISO();

      const tbody = obter('relacaoEboLinhas');
      if (tbody) tbody.innerHTML = '';

      const linhas = Array.isArray(item.linhas) ? item.linhas : [];
      if (linhas.length) linhas.forEach((linha) => adicionarLinhaRelacao(linha, false));
      else adicionarLinhaRelacao({}, false);

      atualizarEstadoEdicao();
      atualizarResumo();
      definirFeedback('Relação aberta para edição.', 'neutro', 2500);
      obter('relacaoEboEditor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (erro) {
      console.error('Erro ao abrir relação:', erro);
      definirFeedback('Não foi possível abrir a relação.', 'erro');
    }
  }

  async function excluirRelacaoSalva(id) {
    const item = relacoesSalvas.find((relacao) => relacao.id === id);
    const nome = item?.titulo || 'esta relação';

    if (!window.confirm(`Deseja excluir “${nome}”?`)) return;
    if (!window.confirm('Confirmação final: esta exclusão não poderá ser desfeita.')) return;

    try {
      const { db, doc, deleteDoc } = firebase();
      await deleteDoc(doc(db, RELACOES_EBO_COLLECTION, id));

      if (relacaoEditandoId === id) limparFormularioRelacao({ confirmar: false });
      await carregarRelacoesSalvas(true);
      definirFeedback('Relação excluída.', 'sucesso', 3000);
    } catch (erro) {
      console.error('Erro ao excluir relação:', erro);
      definirFeedback('Não foi possível excluir a relação.', 'erro');
    }
  }

  function montarHTMLImpressao(dados) {
    const linhas = Array.isArray(dados.linhas) ? dados.linhas : [];
    const resumo = dados.resumo?.totalEbos !== undefined ? dados.resumo : calcularResumo(linhas);

    const tiposHTML = resumo.porTipo?.length
      ? resumo.porTipo.map((item) => `
          <div class="relacao-print-tipo">
            <span>${escaparHTML(item.nome)}</span>
            <strong>${item.quantidade} ${item.quantidade === 1 ? 'ebó' : 'ebós'}</strong>
          </div>
        `).join('')
      : '<div class="relacao-print-sem-dados">Nenhum tipo informado.</div>';

    const linhasHTML = linhas.map((linha) => `
      <tr>
        <td class="relacao-print-pessoa">${escaparHTML(linha.pessoa || '—')}</td>
        <td>${escaparHTML(linha.tipoEbo || '—')}</td>
        <td>${escaparHTML(rotuloComplemento(linha.complemento) || '—')}</td>
        <td>${escaparHTML(linha.observacao || '—')}</td>
      </tr>
    `).join('');

    return `
      <div class="relacao-print-documento">
        <header class="relacao-print-header">
          <div class="relacao-print-identidade">
            <img class="relacao-print-logo" src="${escaparHTML(obterUrlLogoCentro())}" alt="Logo do centro" onerror="this.style.display='none'">
            <div class="relacao-print-marca">ILÊ D'OGUM</div>
          </div>
          <h1>${escaparHTML(dados.titulo || TITULO_PADRAO)}</h1>
          <div class="relacao-print-data">Função do Dia&nbsp; • &nbsp;${escaparHTML(formatarDataBR(dados.dataFuncao))}</div>
        </header>

        <section class="relacao-print-metricas">
          <div><span>EBÓS</span><strong>${Number(resumo.totalEbos || 0)}</strong></div>
          <div><span>OBI</span><strong>${Number(resumo.obi || 0)}</strong></div>
          <div><span>BORI</span><strong>${Number(resumo.bori || 0)}</strong></div>
          <div><span>OFERTA</span><strong>${Number(resumo.oferta || 0)}</strong></div>
        </section>

        <section class="relacao-print-resumo-tipos">
          <h2>Quantidade por tipo de ebó</h2>
          <div class="relacao-print-tipos-grid">${tiposHTML}</div>
        </section>

        <table class="relacao-print-tabela">
          <thead>
            <tr>
              <th>Pessoa ou referência</th>
              <th>Tipo de ebó</th>
              <th>Obi/Bori/Oferta</th>
              <th>Observação</th>
            </tr>
          </thead>
          <tbody>${linhasHTML}</tbody>
        </table>
      </div>
    `;
  }

  function prepararDadosAtuaisParaImpressao() {
    const titulo = String(obter('relacaoEboTitulo')?.value || '').trim() || TITULO_PADRAO;
    const dataFuncao = String(obter('relacaoEboData')?.value || '').trim();
    const linhas = coletarLinhas();

    if (!linhas.length) {
      definirFeedback('Adicione pelo menos uma pessoa antes de imprimir.', 'erro');
      return null;
    }

    return { titulo, dataFuncao, linhas, resumo: calcularResumo(linhas) };
  }

  function montarDocumentoImpressaoCompleto(dados) {
    const tituloSeguro = escaparHTML(dados?.titulo || TITULO_PADRAO);
    const conteudo = montarHTMLImpressao(dados);

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${tituloSeguro}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 12mm;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      width: 100%;
      min-height: 100%;
      margin: 0;
      padding: 0;
      background: #fff;
      color: #292524;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-size: 17px;
      overflow: visible !important;
    }

    .relacao-print-documento {
      width: 100%;
      max-width: 100%;
      margin: 0;
      padding: 0;
      overflow: visible;
    }

    .relacao-print-header {
      padding-bottom: 13px;
      border-bottom: 1px solid #cfcac5;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .relacao-print-identidade {
      display: flex;
      align-items: center;
      flex-direction: column;
      justify-content: center;
      width: 100%;
      margin-bottom: 10px;
      text-align: center;
    }

    .relacao-print-logo {
      display: block;
      width: auto;
      max-width: 125px;
      height: auto;
      max-height: 82px;
      margin: 0 auto 6px;
      object-fit: contain;
    }

    .relacao-print-marca {
      margin: 0;
      color: #9a5d2f;
      font-size: 17px;
      font-weight: 800;
      letter-spacing: .18em;
      text-align: center;
    }

    .relacao-print-header h1 {
      margin: 0 0 6px;
      color: #292524;
      font-size: 34px;
      font-weight: 700;
      line-height: 1.16;
      text-align: center;
      overflow-wrap: anywhere;
    }

    .relacao-print-data {
      color: #68615b;
      font-size: 18px;
      text-align: center;
    }

    .relacao-print-metricas {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      padding: 13px 2px 12px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .relacao-print-metricas div {
      min-width: 0;
      padding: 8px 9px;
      border: 1px solid #e0dcd8;
      border-radius: 5px;
    }

    .relacao-print-metricas span {
      display: block;
      margin-bottom: 4px;
      color: #6f6862;
      font-size: 12.5px;
      font-weight: 800;
      letter-spacing: .10em;
    }

    .relacao-print-metricas strong {
      color: #292524;
      font-size: 24px;
    }

    .relacao-print-resumo-tipos {
      margin-bottom: 10px;
      padding: 9px 10px;
      border: 1px solid #dedad6;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .relacao-print-resumo-tipos h2 {
      margin: 0 0 7px;
      font-size: 18px;
    }

    .relacao-print-tipos-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: 20px;
      row-gap: 4px;
    }

    .relacao-print-tipo {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      min-width: 0;
      color: #625b55;
      font-size: 14.5px;
    }

    .relacao-print-tipo span {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .relacao-print-tipo strong {
      flex: 0 0 auto;
      color: #292524;
      white-space: nowrap;
    }

    .relacao-print-sem-dados {
      color: #78716c;
      font-size: 14.5px;
    }

    .relacao-print-tabela {
      width: 100%;
      max-width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 16.5px;
    }

    .relacao-print-tabela thead {
      display: table-header-group;
    }

    .relacao-print-tabela tbody {
      display: table-row-group;
    }

    .relacao-print-tabela th,
    .relacao-print-tabela td {
      padding: 11px 9px;
      border: 1px solid #d9d6d2;
      vertical-align: top;
      text-align: left;
      overflow-wrap: anywhere;
      word-break: normal;
      white-space: normal;
    }

    .relacao-print-tabela th {
      color: #5f5852;
      background: #f4f2ef;
      font-size: 15.5px;
      font-weight: 800;
    }

    .relacao-print-tabela th:nth-child(1) { width: 29%; }
    .relacao-print-tabela th:nth-child(2) { width: 29%; }
    .relacao-print-tabela th:nth-child(3) { width: 17%; }
    .relacao-print-tabela th:nth-child(4) { width: 25%; }

    .relacao-print-pessoa {
      font-weight: 700;
    }

    .relacao-print-tabela tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    @media screen {
      body {
        padding: 16px;
      }
    }

    @media print {
      html,
      body {
        width: auto !important;
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
      }
    }
  </style>
</head>
<body>${conteudo}</body>
</html>`;
  }

  function executarImpressao(dados) {
    if (!dados) return;

    definirFeedback('Preparando a impressão...', 'neutro', 2500);

    // A impressão acontece em um documento isolado para não herdar estilos,
    // alturas ou áreas ocultas da tela principal. Isso evita página branca,
    // conteúdo cortado e impressão limitada ao tamanho visível da tela.
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Documento de impressão da relação de ebó');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '297mm';
    iframe.style.height = '210mm';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.background = '#fff';
    document.body.appendChild(iframe);

    let removido = false;
    let fallbackTimer = null;

    const limpar = () => {
      if (removido) return;
      removido = true;
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      window.setTimeout(() => iframe.remove(), 500);
    };

    try {
      const docImpressao = iframe.contentDocument || iframe.contentWindow?.document;
      if (!docImpressao) throw new Error('Documento de impressão indisponível.');

      docImpressao.open();
      docImpressao.write(montarDocumentoImpressaoCompleto(dados));
      docImpressao.close();

      const janelaImpressao = iframe.contentWindow;
      if (!janelaImpressao) throw new Error('Janela de impressão indisponível.');

      const imprimirQuandoPronto = async () => {
        try {
          await aguardarImagensDocumento(docImpressao);
          janelaImpressao.addEventListener('afterprint', limpar, { once: true });
          janelaImpressao.focus();

          // Dois frames + pequeno intervalo garantem que tabela e fontes já
          // tenham sido calculadas pelo navegador antes de abrir a prévia.
          janelaImpressao.requestAnimationFrame(() => {
            janelaImpressao.requestAnimationFrame(() => {
              window.setTimeout(() => {
                janelaImpressao.print();
                fallbackTimer = window.setTimeout(limpar, 120000);
              }, 180);
            });
          });
        } catch (erro) {
          console.error('Falha ao abrir impressão isolada:', erro);
          limpar();
          definirFeedback('Não foi possível abrir a impressão. Tente novamente.', 'erro');
        }
      };

      if (docImpressao.readyState === 'complete') {
        imprimirQuandoPronto();
      } else {
        iframe.addEventListener('load', imprimirQuandoPronto, { once: true });
      }
    } catch (erro) {
      console.error('Erro ao preparar documento de impressão:', erro);
      limpar();
      definirFeedback('Não foi possível preparar a impressão.', 'erro');
    }
  }

  function nomeArquivoPdf(dados) {
    const titulo = normalizarTexto(dados?.titulo || TITULO_PADRAO)
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'relacao-de-ebo';
    const data = String(dados?.dataFuncao || hojeISO()).replace(/[^0-9-]/g, '') || hojeISO();
    return `${data}-${titulo}.pdf`;
  }

  function quebrarTextoPdf(doc, texto, larguraMaxima) {
    const valor = String(texto || '—').trim() || '—';
    return doc.splitTextToSize(valor, larguraMaxima);
  }

  async function gerarPdf(dados) {
    if (!dados) return;

    const JsPDF = window.jspdf?.jsPDF;
    if (!JsPDF) {
      definirFeedback('O gerador de PDF não carregou. Verifique a internet e atualize a página.', 'erro', 7000);
      return;
    }

    definirFeedback('Gerando o arquivo PDF...', 'neutro', 8000);

    try {
      const linhas = Array.isArray(dados.linhas) ? dados.linhas : [];
      const resumo = dados.resumo?.totalEbos !== undefined ? dados.resumo : calcularResumo(linhas);
      const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
      const paginaLargura = doc.internal.pageSize.getWidth();
      const paginaAltura = doc.internal.pageSize.getHeight();
      const margem = 12;
      const larguraUtil = paginaLargura - (margem * 2);

      doc.setProperties({
        title: dados.titulo || TITULO_PADRAO,
        subject: 'Relação de Ebó',
        author: "ILÊ D'OGUM",
        creator: 'Sistema de Relações'
      });

      let y = await desenharCabecalhoPdfCentralizado(
        doc,
        dados.titulo || TITULO_PADRAO,
        `Função do Dia • ${formatarDataBR(dados.dataFuncao)}`,
        paginaLargura,
        margem
      );

      const metricas = [
        ['EBÓS', Number(resumo.totalEbos || 0)],
        ['OBI', Number(resumo.obi || 0)],
        ['BORI', Number(resumo.bori || 0)],
        ['OFERTA', Number(resumo.oferta || 0)]
      ];
      const espaco = 3;
      const caixaLargura = (larguraUtil - (espaco * 3)) / 4;

      metricas.forEach(([rotulo, valor], indice) => {
        const x = margem + indice * (caixaLargura + espaco);
        doc.setDrawColor(224, 220, 216);
        doc.roundedRect(x, y, caixaLargura, 17, 1.5, 1.5, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(111, 104, 98);
        doc.text(rotulo, x + 3, y + 5.2);
        doc.setFontSize(17);
        doc.setTextColor(41, 37, 36);
        doc.text(String(valor), x + 3, y + 12.7);
      });
      y += 23;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(41, 37, 36);
      doc.text('Quantidade por tipo de ebó', margem, y);
      y += 4;

      const tipos = Array.isArray(resumo.porTipo) ? resumo.porTipo : [];
      const linhasTipos = tipos.length
        ? tipos.map((item) => `${item.nome}: ${item.quantidade} ${item.quantidade === 1 ? 'ebó' : 'ebós'}`)
        : ['Nenhum tipo informado.'];
      const alturaTipos = Math.max(12, Math.ceil(linhasTipos.length / 2) * 5.2 + 5);

      doc.setDrawColor(222, 218, 214);
      doc.rect(margem, y, larguraUtil, alturaTipos, 'S');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(98, 91, 85);

      linhasTipos.forEach((texto, indice) => {
        const coluna = indice % 2;
        const linha = Math.floor(indice / 2);
        const x = margem + 3 + coluna * (larguraUtil / 2);
        const larguraColuna = (larguraUtil / 2) - 7;
        const partes = quebrarTextoPdf(doc, texto, larguraColuna);
        doc.text(partes, x, y + 5 + linha * 5.2);
      });
      y += alturaTipos + 6;

      if (typeof doc.autoTable !== 'function') {
        throw new Error('Plugin de tabela PDF não carregado.');
      }

      const corpo = linhas.map((linha) => [
        linha.pessoa || '—',
        linha.tipoEbo || '—',
        rotuloComplemento(linha.complemento) || '—',
        linha.observacao || '—'
      ]);

      doc.autoTable({
        startY: y,
        margin: { top: 12, right: margem, bottom: 15, left: margem },
        head: [['Pessoa ou referência', 'Tipo de ebó', 'Obi/Bori/Oferta', 'Observação']],
        body: corpo,
        theme: 'grid',
        tableWidth: larguraUtil,
        styles: {
          font: 'helvetica',
          fontSize: 14.5,
          textColor: [41, 37, 36],
          lineColor: [217, 214, 210],
          lineWidth: 0.2,
          cellPadding: 2.8,
          overflow: 'linebreak',
          valign: 'top'
        },
        headStyles: {
          fillColor: [244, 242, 239],
          textColor: [95, 88, 82],
          fontStyle: 'bold',
          fontSize: 13.5
        },
        columnStyles: {
          0: { cellWidth: larguraUtil * 0.29, fontStyle: 'bold' },
          1: { cellWidth: larguraUtil * 0.29 },
          2: { cellWidth: larguraUtil * 0.17 },
          3: { cellWidth: larguraUtil * 0.25 }
        },
        didDrawPage: () => {
          const numeroPagina = doc.internal.getNumberOfPages();
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9.5);
          doc.setTextColor(120, 113, 108);
          doc.text(`Página ${numeroPagina}`, paginaLargura - margem, paginaAltura - 7, { align: 'right' });
        }
      });

      doc.save(nomeArquivoPdf(dados));
      definirFeedback('PDF baixado com sucesso.', 'sucesso', 4000);
    } catch (erro) {
      console.error('Erro ao gerar PDF:', erro);
      definirFeedback('Não foi possível gerar o PDF. Atualize a página e tente novamente.', 'erro', 7000);
    }
  }

  async function imprimirRelacaoSalva(id) {
    try {
      const item = await obterRelacaoPorId(id);
      if (!item) return;
      executarImpressao(item);
    } catch (erro) {
      console.error('Erro ao imprimir relação:', erro);
      definirFeedback('Não foi possível preparar a impressão.', 'erro');
    }
  }

  async function gerarPdfRelacaoSalva(id) {
    try {
      const item = await obterRelacaoPorId(id);
      if (!item) return;
      await gerarPdf(item);
    } catch (erro) {
      console.error('Erro ao gerar PDF da relação:', erro);
      definirFeedback('Não foi possível gerar o PDF.', 'erro');
    }
  }

  function ligarBotao(id, acao) {
    const botao = obter(id);
    if (!botao || botao.dataset.relacoesLigado === '1') return;

    botao.addEventListener('click', acao);
    botao.dataset.relacoesLigado = '1';
  }

  // Liga os botões Voltar na fase de captura e interrompe qualquer outro
  // manipulador antigo que possa ter ficado no projeto ou no cache.
  function ligarBotaoVoltar(id, acao) {
    const botao = obter(id);
    if (!botao || botao.dataset.relacoesVoltarLigado === '1') return;

    botao.addEventListener('click', acao, true);
    botao.dataset.relacoesVoltarLigado = '1';
  }

  function ligarNavegacao() {
    ligarBotao('btn-relacao-ebo', abrirContainerRelacaoEbo);
    ligarBotao('btn-relacao-oferenda', abrirContainerRelacaoOferenda);

    // Relação de Ebó -> Projeto Relações, dentro da mesma página.
    ligarBotaoVoltar('voltar-relacao-ebo', voltarParaEscolhaRelacoes);
    ligarBotaoVoltar('voltar-relacao-oferenda', voltarParaEscolhaRelacoes);

    // Projeto Relações -> página anterior (painel principal).
    ligarBotaoVoltar('voltar-relacoes', voltarParaPaginaInicial);

    ligarBotao('btnAdicionarPessoaRelacao', () => adicionarLinhaRelacao());
    ligarBotao('btnRecarregarTiposEbo', () => carregarTiposEbo(true));
    ligarBotao('btnSalvarRelacaoEbo', salvarRelacaoEbo);
    ligarBotao('btnNovaRelacaoEbo', () => limparFormularioRelacao({ confirmar: true }));
    ligarBotao('btnAtualizarRelacoesSalvas', () => carregarRelacoesSalvas(true));
    ligarBotao('btnImprimirRelacaoEbo', () => executarImpressao(prepararDadosAtuaisParaImpressao()));
    ligarBotao('btnPdfRelacaoEbo', () => gerarPdf(prepararDadosAtuaisParaImpressao()));

    const tbody = obter('relacaoEboLinhas');
    if (tbody && tbody.dataset.relacoesLigado !== '1') {
      tbody.addEventListener('input', (evento) => {
        atualizarResumo();
        if (evento.target?.classList?.contains('relacao-pessoa')) {
          atualizarMarcacaoTiposEboPorPessoa();
        }
      });
      tbody.addEventListener('change', atualizarResumo);
      tbody.addEventListener('click', (evento) => {
        const opcaoTipoEbo = evento.target.closest('.relacao-select-ebo-opcao[data-tipo-ebo]');
        if (opcaoTipoEbo) {
          evento.preventDefault();
          escolherTipoEboNoDropdown(opcaoTipoEbo);
          return;
        }

        const remover = evento.target.closest('.relacao-remover-linha');
        if (!remover) return;

        const linha = remover.closest('tr');
        linha?.remove();

        if (!tbody.children.length) adicionarLinhaRelacao({}, false);
        atualizarMarcacaoTiposEboPorPessoa();
        atualizarResumo();
      });
      tbody.dataset.relacoesLigado = '1';
    }

    const pesquisa = obter('pesquisaRelacoesEbo');
    if (pesquisa && pesquisa.dataset.relacoesLigado !== '1') {
      pesquisa.addEventListener('input', renderizarRelacoesSalvas);
      pesquisa.dataset.relacoesLigado = '1';
    }

    const salvas = obter('relacoesEboSalvasBox');
    if (salvas && salvas.dataset.relacoesLigado !== '1') {
      salvas.addEventListener('click', async (evento) => {
        const botao = evento.target.closest('button[data-acao]');
        const item = evento.target.closest('[data-relacao-id]');
        if (!botao || !item) return;

        const id = item.dataset.relacaoId;
        const acao = botao.dataset.acao;

        if (acao === 'editar') await editarRelacaoSalva(id);
        if (acao === 'excluir') await excluirRelacaoSalva(id);
        if (acao === 'imprimir') await imprimirRelacaoSalva(id);
        if (acao === 'pdf') await gerarPdfRelacaoSalva(id);
      });
      salvas.dataset.relacoesLigado = '1';
    }
  }

  window.abrirTelaRelacoes = function abrirTelaRelacoes() {
    if (!MODO_STANDALONE) esconderTelasDoSistema();

    const tela = obter(SCREEN_ID);
    if (!tela) {
      console.error('Tela Relações não encontrada no index.html.');
      return;
    }

    tela.style.display = 'block';
    mostrarEscolhaRelacoes();
    atualizarEstadoEdicao();
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  function iniciar() {
    ligarNavegacao();
    atualizarEstadoEdicao();

    const tela = obter(SCREEN_ID);
    if (tela) tela.style.display = MODO_STANDALONE ? 'block' : 'none';

    mostrarEscolhaRelacoes();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }

  // ===================================
// SEÇÃO RELAÇÃO OFERENDA/OFERTA
// ===================================

 const RELACOES_OFERENDA_COLLECTION = 'relacoes_oferenda';
  const TIPOS_OFERENDA_COLLECTION = 'tipos_oferenda'; // Coleção para tipos cadastrados
  
  let tiposOferenda = [];
  let relacoesSalvasOferenda = [];
  let relacaoOferendaEditandoId = null;
  let carregandoTiposOferenda = null;
  let carregandoRelacoesSalvasOferenda = null;

  // ========== FUNÇÕES DE TIPOS DE OFERENDA ==========

  function extrairTiposOferenda(dados = {}) {
    const candidatos = [];

    if (Array.isArray(dados.tiposOferenda)) candidatos.push(...dados.tiposOferenda);
    if (Array.isArray(dados.tipoOferenda)) candidatos.push(...dados.tipoOferenda);

    if (!candidatos.length && dados.tiposOferenda) {
      candidatos.push(...String(dados.tiposOferenda).split(/[;,]/));
    }

    if (!candidatos.length && dados.tipoOferenda) {
      candidatos.push(...String(dados.tipoOferenda).split(/[;,]/));
    }

    const vistos = new Set();
    return candidatos
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .filter((item) => {
        const chave = normalizarTexto(item);
        if (!chave || vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
      });
  }

  function normalizarComplementoOferenda(dados = {}) {
    const candidatos = [];

    if (dados.complemento) candidatos.push(dados.complemento);
    if (Array.isArray(dados.complementos)) candidatos.push(...dados.complementos);
    else if (dados.complementos) candidatos.push(...String(dados.complementos).split(/[;,]/));

    const mapa = {
      oferenda: 'Oferenda',
      oferta: 'Oferta',
      'mesa do obi': 'Mesa do Obi'
    };

    for (const candidato of candidatos) {
      const chave = normalizarTexto(candidato);
      if (mapa[chave]) return mapa[chave];
    }

    return '';
  }

  function obterCatalogoTiposOferenda(valoresSelecionados = []) {
    const selecionados = extrairTiposOferenda({ tiposOferenda: valoresSelecionados });
    const mapa = new Map();

    tiposOferenda.forEach((tipo) => {
      const nome = String(tipo?.nome || '').trim();
      const chave = normalizarTexto(nome);
      if (!nome || !chave || mapa.has(chave)) return;
      mapa.set(chave, { nome, antigo: false });
    });

    // Mantém visíveis os tipos de relações antigas, mesmo que tenham sido
    // removidos do cadastro atual.
    selecionados.forEach((nome) => {
      const chave = normalizarTexto(nome);
      if (!chave || mapa.has(chave)) return;
      mapa.set(chave, { nome, antigo: true });
    });

    return Array.from(mapa.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base', numeric: true })
    );
  }

  function montarResumoDropdownTiposOferenda(valoresSelecionados = []) {
    const selecionados = extrairTiposOferenda({ tiposOferenda: valoresSelecionados });

    if (!selecionados.length) {
      return '<span class="relacao-multiselect-placeholder">Selecione um ou mais tipos</span>';
    }

    return selecionados.map((nome) => `
      <span class="relacao-multiselect-chip">${escaparHTML(nome)}</span>
    `).join('');
  }

  function montarOpcoesDropdownTiposOferenda(valoresSelecionados = []) {
    const selecionados = extrairTiposOferenda({ tiposOferenda: valoresSelecionados });
    const chavesSelecionadas = new Set(selecionados.map(normalizarTexto));
    const catalogo = obterCatalogoTiposOferenda(selecionados);

    if (!catalogo.length) {
      return '<div class="relacao-multiselect-vazio">Cadastre um tipo acima para liberar a seleção.</div>';
    }

    return catalogo.map((tipo) => {
      const selecionado = chavesSelecionadas.has(normalizarTexto(tipo.nome));
      const classeSelecionado = selecionado ? ' selecionado' : '';
      const textoAntigo = tipo.antigo ? ' <small>(tipo antigo)</small>' : '';

      return `
        <button
          type="button"
          class="relacao-multiselect-opcao${classeSelecionado}"
          data-tipo-oferenda="${escaparHTML(tipo.nome)}"
          aria-pressed="${selecionado ? 'true' : 'false'}"
        >
          <span class="relacao-multiselect-marcador" aria-hidden="true">✓</span>
          <span class="relacao-multiselect-opcao-texto">${escaparHTML(tipo.nome)}${textoAntigo}</span>
        </button>
      `;
    }).join('');
  }

  function montarSeletorMultiploTiposOferenda(valoresSelecionados = []) {
    const selecionados = extrairTiposOferenda({ tiposOferenda: valoresSelecionados });

    return `
      <details class="relacao-multiselect-tipos">
        <summary aria-label="Abrir seleção de tipos de oferenda ou oferta">
          <span class="relacao-multiselect-resumo">
            ${montarResumoDropdownTiposOferenda(selecionados)}
          </span>
          <span class="relacao-multiselect-seta" aria-hidden="true">▾</span>
        </summary>
        <div class="relacao-multiselect-opcoes" role="listbox" aria-multiselectable="true">
          ${montarOpcoesDropdownTiposOferenda(selecionados)}
        </div>
      </details>
    `;
  }


  function posicionarDropdownOferendaFora(seletor) {
    if (!seletor?.open) return;

    const resumo = seletor.querySelector(':scope > summary');
    const painel = seletor.querySelector(
      ':scope > .relacao-multiselect-opcoes, :scope > .relacao-select-complemento-opcoes, :scope > .relacao-select-ebo-opcoes'
    );

    if (!resumo || !painel) return;

    const retangulo = resumo.getBoundingClientRect();
    const margem = 8;
    const espacamento = 5;
    const larguraDisponivel = Math.max(180, window.innerWidth - (margem * 2));
    const largura = Math.min(Math.max(retangulo.width, 210), larguraDisponivel);
    const esquerda = Math.min(
      Math.max(margem, retangulo.left),
      Math.max(margem, window.innerWidth - margem - largura)
    );

    const limitePadrao = (seletor.classList.contains('relacao-multiselect-tipos') || seletor.classList.contains('relacao-select-ebo')) ? 280 : 220;
    const espacoAbaixo = Math.max(0, window.innerHeight - retangulo.bottom - espacamento - margem);
    const espacoAcima = Math.max(0, retangulo.top - espacamento - margem);
    const abrirAcima = espacoAbaixo < 150 && espacoAcima > espacoAbaixo;
    const espacoEscolhido = abrirAcima ? espacoAcima : espacoAbaixo;
    const alturaMaxima = Math.max(90, Math.min(limitePadrao, espacoEscolhido));

    painel.style.left = `${Math.round(esquerda)}px`;
    painel.style.width = `${Math.round(largura)}px`;
    painel.style.maxHeight = `${Math.round(alturaMaxima)}px`;

    if (abrirAcima) {
      const alturaPainel = Math.min(painel.scrollHeight || alturaMaxima, alturaMaxima);
      painel.style.top = `${Math.max(margem, Math.round(retangulo.top - espacamento - alturaPainel))}px`;
      painel.dataset.direcao = 'acima';
    } else {
      painel.style.top = `${Math.round(retangulo.bottom + espacamento)}px`;
      painel.dataset.direcao = 'abaixo';
    }
  }

  let quadroReposicionarDropdownOferenda = 0;

  function reposicionarDropdownsOferendaAbertos() {
    if (quadroReposicionarDropdownOferenda) return;

    quadroReposicionarDropdownOferenda = window.requestAnimationFrame(() => {
      quadroReposicionarDropdownOferenda = 0;
      document.querySelectorAll(
        '#relacaoEboLinhas .relacao-select-ebo[open], #relacaoOferendaLinhas .relacao-multiselect-tipos[open], #relacaoOferendaLinhas .relacao-select-complemento[open]'
      ).forEach(posicionarDropdownOferendaFora);
    });
  }

  function prepararDropdownOferendaFlutuante(evento) {
    const seletor = evento.target;
    if (!seletor?.matches?.('.relacao-select-ebo, .relacao-multiselect-tipos, .relacao-select-complemento')) return;

    if (seletor.open) {
      document.querySelectorAll(
        '#relacaoEboLinhas .relacao-select-ebo[open], #relacaoOferendaLinhas .relacao-multiselect-tipos[open], #relacaoOferendaLinhas .relacao-select-complemento[open]'
      ).forEach((outro) => {
        if (outro !== seletor) outro.removeAttribute('open');
      });

      window.requestAnimationFrame(() => posicionarDropdownOferendaFora(seletor));
    }
  }

  function montarSeletorComplementoOferenda(valorSelecionado = '') {
    const complemento = normalizarComplementoOferenda({ complemento: valorSelecionado });
    const opcoes = ['Oferenda', 'Oferta', 'Mesa do Obi'];

    return `
      <details class="relacao-select-complemento" data-complemento="${escaparHTML(complemento)}">
        <summary aria-label="Abrir seleção de complemento">
          <span class="relacao-select-complemento-resumo${complemento ? ' selecionado' : ''}">
            ${escaparHTML(complemento || 'Selecione uma opção')}
          </span>
          <span class="relacao-multiselect-seta" aria-hidden="true">▾</span>
        </summary>
        <div class="relacao-select-complemento-opcoes" role="listbox">
          ${opcoes.map((opcao) => {
            const selecionado = opcao === complemento;
            return `
              <button
                type="button"
                class="relacao-select-complemento-opcao${selecionado ? ' selecionado' : ''}"
                data-complemento-oferenda="${escaparHTML(opcao)}"
                aria-selected="${selecionado ? 'true' : 'false'}"
              >
                <span class="relacao-select-complemento-marcador" aria-hidden="true">✓</span>
                <span>${escaparHTML(opcao)}</span>
              </button>
            `;
          }).join('')}
        </div>
      </details>
    `;
  }

  function escolherComplementoOferendaNoDropdown(opcao) {
    if (!opcao) return;

    const seletor = opcao.closest('.relacao-select-complemento');
    if (!seletor) return;

    const valor = String(opcao.dataset.complementoOferenda || '').trim();
    seletor.dataset.complemento = valor;

    seletor.querySelectorAll('.relacao-select-complemento-opcao').forEach((item) => {
      const selecionado = item === opcao;
      item.classList.toggle('selecionado', selecionado);
      item.setAttribute('aria-selected', selecionado ? 'true' : 'false');
    });

    const resumo = seletor.querySelector('.relacao-select-complemento-resumo');
    if (resumo) {
      resumo.textContent = valor || 'Selecione uma opção';
      resumo.classList.toggle('selecionado', Boolean(valor));
    }

    seletor.removeAttribute('open');
  }

  function obterTiposSelecionadosDaLinha(tr) {
    const vistos = new Set();

    return Array.from(tr?.querySelectorAll('.relacao-multiselect-opcao.selecionado[data-tipo-oferenda]') || [])
      .map((opcao) => String(opcao.dataset.tipoOferenda || '').trim())
      .filter(Boolean)
      .filter((nome) => {
        const chave = normalizarTexto(nome);
        if (!chave || vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
      });
  }

  function atualizarResumoDoDropdownTiposOferenda(seletor) {
    if (!seletor) return;
    const resumo = seletor.querySelector('.relacao-multiselect-resumo');
    if (!resumo) return;

    const linha = seletor.closest('tr');
    const selecionados = obterTiposSelecionadosDaLinha(linha);
    resumo.innerHTML = montarResumoDropdownTiposOferenda(selecionados);
  }

  function alternarTipoOferendaNoDropdown(opcao) {
    if (!opcao) return;

    const selecionado = !opcao.classList.contains('selecionado');
    opcao.classList.toggle('selecionado', selecionado);
    opcao.setAttribute('aria-pressed', selecionado ? 'true' : 'false');

    atualizarResumoDoDropdownTiposOferenda(opcao.closest('.relacao-multiselect-tipos'));
  }

  function atualizarSelectsTiposOferenda() {
    document.querySelectorAll('#relacaoOferendaLinhas .relacao-multiselect-tipos').forEach((seletorAtual) => {
      const linha = seletorAtual.closest('tr');
      const selecionados = obterTiposSelecionadosDaLinha(linha);
      const template = document.createElement('template');
      template.innerHTML = montarSeletorMultiploTiposOferenda(selecionados).trim();
      seletorAtual.replaceWith(template.content.firstElementChild);
    });
  }

  function renderizarTiposOferendaCadastrados() {
    const container = obter('tiposOferendaCadastrados');
    if (!container) return;

    if (!tiposOferenda.length) {
      container.innerHTML = '<div class="relacao-tipos-vazio">Nenhum tipo cadastrado. Use o campo acima para criar o primeiro.</div>';
      return;
    }

    container.innerHTML = tiposOferenda.map((tipo) => `
      <span class="relacao-tipo-cadastrado">
        <span>${escaparHTML(tipo.nome)}</span>
        <button type="button" data-excluir-tipo-oferenda="${escaparHTML(tipo.id)}" data-tipo-nome="${escaparHTML(tipo.nome)}" title="Excluir tipo">×</button>
      </span>
    `).join('');
  }

  async function carregarTiposOferenda(forcar = false) {
    if (carregandoTiposOferenda && !forcar) return carregandoTiposOferenda;

    carregandoTiposOferenda = (async () => {
      const botao = obter('btnRecarregarTiposOferenda');
      if (botao) {
        botao.disabled = true;
        botao.textContent = 'Atualizando...';
      }

      try {
        const { db, collection, getDocs, query, orderBy } = firebase();
        const snapshot = await getDocs(
          query(collection(db, TIPOS_OFERENDA_COLLECTION), orderBy('nome', 'asc'))
        );

        tiposOferenda = [];
        snapshot.forEach((documento) => {
          const dados = documento.data() || {};
          const nome = String(dados.nome || '').trim();
          if (!nome) return;
          tiposOferenda.push({
            id: documento.id,
            nome,
            descricao: String(dados.descricao || '').trim()
          });
        });

        atualizarSelectsTiposOferenda();
        renderizarTiposOferendaCadastrados();
        if (forcar) definirFeedbackOferenda('Tipos atualizados com sucesso.', 'sucesso', 2000);
      } catch (erro) {
        console.error('Erro ao carregar tipos de oferenda:', erro);
        definirFeedbackOferenda('Não foi possível atualizar os tipos.', 'erro', 3000);
      } finally {
        if (botao) {
          botao.disabled = false;
          botao.textContent = '↻ Atualizar tipos';
        }
        carregandoTiposOferenda = null;
      }
    })();

    return carregandoTiposOferenda;
  }

  async function cadastrarTipoOferenda() {
    const input = obter('novoTipoOferendaNome');
    const nome = String(input?.value || '').trim();

    if (!nome) {
      definirFeedbackOferenda('Digite o nome do tipo de oferenda/oferta.', 'erro', 3000);
      input?.focus();
      return;
    }

    if (tiposOferenda.some((tipo) => normalizarTexto(tipo.nome) === normalizarTexto(nome))) {
      definirFeedbackOferenda('Esse tipo já está cadastrado.', 'erro', 3000);
      input?.focus();
      return;
    }

    const botao = obter('btnCadastrarTipoOferenda');
    if (botao) botao.disabled = true;

    try {
      const { db, collection, doc, setDoc, serverTimestamp } = firebase();
      const referencia = doc(collection(db, TIPOS_OFERENDA_COLLECTION));
      await setDoc(referencia, {
        nome,
        nome_norm: normalizarTexto(nome),
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });

      if (input) input.value = '';
      await carregarTiposOferenda(true);
      definirFeedbackOferenda(`Tipo “${nome}” cadastrado.`, 'sucesso', 3000);
      input?.focus();
    } catch (erro) {
      console.error('Erro ao cadastrar tipo de oferenda:', erro);
      definirFeedbackOferenda('Não foi possível cadastrar o tipo.', 'erro', 4000);
    } finally {
      if (botao) botao.disabled = false;
    }
  }

  async function excluirTipoOferenda(id, nome) {
    if (!id) return;
    const resposta = confirm(`Deseja excluir o tipo “${nome || 'selecionado'}”? As relações antigas continuarão guardando o nome já salvo.`);
    if (!resposta) return;

    try {
      const { db, doc, deleteDoc } = firebase();
      await deleteDoc(doc(db, TIPOS_OFERENDA_COLLECTION, id));
      await carregarTiposOferenda(true);
      definirFeedbackOferenda('Tipo excluído com sucesso.', 'sucesso', 3000);
    } catch (erro) {
      console.error('Erro ao excluir tipo de oferenda:', erro);
      definirFeedbackOferenda('Não foi possível excluir o tipo.', 'erro', 4000);
    }
  }

  // ========== FUNÇÕES DE LINHA DA TABELA ==========

  function adicionarLinhaRelacaoOferenda(dados = {}, focar = true) {
    const tbody = obter('relacaoOferendaLinhas');
    if (!tbody) return;

    const linha = document.createElement('tr');
    const pessoa = String(dados.pessoa || '').trim();
    const tiposSelecionados = extrairTiposOferenda(dados);
    const complemento = normalizarComplementoOferenda(dados);
    const observacao = String(dados.observacao || '').trim();

    linha.innerHTML = `
      <td data-label="Pessoa ou referência">
        <input type="text" class="relacao-pessoa-oferenda" value="${escaparHTML(pessoa)}" placeholder="Nome ou referência" />
      </td>
      <td data-label="Tipos de oferenda/oferta">
        ${montarSeletorMultiploTiposOferenda(tiposSelecionados)}
      </td>
      <td data-label="Complemento">
        ${montarSeletorComplementoOferenda(complemento)}
      </td>
      <td data-label="Observação">
        <input type="text" class="relacao-observacao-oferenda" value="${escaparHTML(observacao)}" placeholder="Observação (opcional)" />
      </td>
      <td class="relacao-coluna-acao" data-label="Ação">
        <button class="relacao-remover-linha" type="button" title="Remover linha">🗑️</button>
      </td>
    `;

    tbody.appendChild(linha);

    if (focar) linha.querySelector('.relacao-pessoa-oferenda')?.focus();
  }

  function lerLinhaRelacaoOferenda(tr) {
    const tiposSelecionados = obterTiposSelecionadosDaLinha(tr);
    const complemento = String(tr.querySelector('.relacao-select-complemento')?.dataset?.complemento || '').trim();

    return {
      pessoa: String(tr.querySelector('.relacao-pessoa-oferenda')?.value || '').trim(),
      tiposOferenda: tiposSelecionados,
      tipoOferenda: tiposSelecionados.join(', '),
      complemento,
      complementos: complemento,
      observacao: String(tr.querySelector('.relacao-observacao-oferenda')?.value || '').trim()
    };
  }

  function coletarLinhasRelacaoOferenda() {
    return Array.from(obter('relacaoOferendaLinhas')?.querySelectorAll('tr') || [])
      .map(lerLinhaRelacaoOferenda)
      .filter((linha) => linha.pessoa || linha.tiposOferenda.length || linha.complemento || linha.observacao);
  }

  // ========== FUNÇÕES DE RESUMO ==========

  function atualizarResumoOferenda() {
    const linhas = coletarLinhasRelacaoOferenda();
    let totalOferendas = 0;
    let totalOfertas = 0;
    let totalMesaObi = 0;
    let totalGeral = 0;
    const mapaOferendas = new Map();

    linhas.forEach((linha) => {
      if (!linha.pessoa || !linha.tiposOferenda.length) return;

      const quantidadeTipos = linha.tiposOferenda.length;
      if (linha.complemento === 'Oferenda') totalOferendas += quantidadeTipos;
      if (linha.complemento === 'Oferta') totalOfertas += quantidadeTipos;
      if (linha.complemento === 'Mesa do Obi') totalMesaObi += quantidadeTipos;

      linha.tiposOferenda.forEach((tipo) => {
        mapaOferendas.set(tipo, (mapaOferendas.get(tipo) || 0) + 1);
        totalGeral += 1;
      });
    });

    if (obter('relacaoTotalOferendas')) obter('relacaoTotalOferendas').textContent = String(totalOferendas);
    if (obter('relacaoTotalOfertas')) obter('relacaoTotalOfertas').textContent = String(totalOfertas);
    if (obter('relacaoTotalMesaObi')) obter('relacaoTotalMesaObi').textContent = String(totalMesaObi);
    if (obter('relacaoTotalGeral')) obter('relacaoTotalGeral').textContent = String(totalGeral);

    const secaoTipos = obter('relacaoOferendaTiposResumo');
    if (!secaoTipos) return;

    if (mapaOferendas.size === 0) {
      secaoTipos.innerHTML = `
        <div class="relacao-tipos-resumo-titulo">Quantidade por tipo de oferenda/oferta</div>
        <div class="relacao-tipos-vazio">Adicione pessoas e selecione os tipos para gerar o resumo automaticamente.</div>
      `;
      return;
    }

    const items = Array.from(mapaOferendas.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR', { sensitivity: 'base' }))
      .map(([tipo, qtd]) => `<div class="relacao-tipo-resumo-item">${escaparHTML(tipo)}: ${qtd} ${qtd === 1 ? 'pessoa' : 'pessoas'}</div>`)
      .join('');

    secaoTipos.innerHTML = `
      <div class="relacao-tipos-resumo-titulo">Quantidade por tipo de oferenda/oferta</div>
      <div class="relacao-tipos-resumo-lista">${items}</div>
    `;
  }

  // ========== FUNÇÕES DE FORMULÁRIO ==========

  function prepararDadosAtuaisParaImpressaoOferenda() {
    const titulo = String(obter('relacaoOferendaTitulo')?.value || 'Relação de oferenda/oferta').trim();
    const data = String(obter('relacaoOferendaData')?.value || '').trim();
    const linhas = coletarLinhasRelacaoOferenda();

    return {
      titulo,
      data,
      linhas,
      resumo: {
        totalOferendas: Number(obter('relacaoTotalOferendas')?.textContent || 0),
        totalOfertas: Number(obter('relacaoTotalOfertas')?.textContent || 0),
        totalMesaObi: Number(obter('relacaoTotalMesaObi')?.textContent || 0),
        totalGeral: Number(obter('relacaoTotalGeral')?.textContent || 0)
      }
    };
  }

  function limparFormularioRelacaoOferenda(opcoes = {}) {
    const { confirmar = false, silencioso = false } = opcoes;

    if (confirmar) {
      const resposta = confirm('Deseja limpar o formulário e criar uma nova relação?');
      if (!resposta) return;
    }

    obter('relacaoOferendaTitulo').value = 'Relação de oferenda/oferta do evento';
    obter('relacaoOferendaData').value = hojeISO();
    obter('relacaoOferendaLinhas').innerHTML = '';
    relacaoOferendaEditandoId = null;

    atualizarStatusEdicaoOferenda();
    adicionarLinhaRelacaoOferenda({}, false);
    atualizarResumoOferenda();
    if (!silencioso) definirFeedbackOferenda('Formulário limpo.', 'sucesso', 2000);
  }

  function atualizarStatusEdicaoOferenda() {
    const status = obter('relacaoOferendaStatusEdicao');
    if (!status) return;

    if (relacaoOferendaEditandoId) {
      status.textContent = `Editando relação #${relacaoOferendaEditandoId.substr(0, 8)}`;
    } else {
      status.textContent = 'Nova relação';
    }
  }

  function definirFeedbackOferenda(mensagem, tipo = 'info', duracao = 5000) {
    const feedback = obter('relacaoOferendaFeedback');
    if (!feedback) return;

    feedback.textContent = mensagem;
    feedback.className = `relacao-feedback relacao-feedback-${tipo}`;

    if (duracao > 0) {
      setTimeout(() => {
        feedback.textContent = '';
        feedback.className = 'relacao-feedback';
      }, duracao);
    }
  }

  // ========== FUNÇÕES DE SAVE/LOAD ==========

  async function salvarRelacaoOferenda() {
    const dados = prepararDadosAtuaisParaImpressaoOferenda();

    if (!dados.titulo) {
      definirFeedbackOferenda('Preencha o título da relação.', 'erro');
      obter('relacaoOferendaTitulo')?.focus();
      return;
    }

    if (!dados.data) {
      definirFeedbackOferenda('Informe a data da função.', 'erro');
      obter('relacaoOferendaData')?.focus();
      return;
    }

    const linhaSemPessoa = dados.linhas.find((linha) => !linha.pessoa && (linha.tiposOferenda.length || linha.complemento || linha.observacao));
    if (linhaSemPessoa) {
      definirFeedbackOferenda('Preencha o nome da pessoa na linha incompleta.', 'erro');
      return;
    }

    const linhasComPessoa = dados.linhas.filter((linha) => linha.pessoa);
    if (!linhasComPessoa.length) {
      definirFeedbackOferenda('Adicione pelo menos uma pessoa.', 'erro');
      return;
    }

    const semTipo = linhasComPessoa.find((linha) => !linha.tiposOferenda.length);
    if (semTipo) {
      definirFeedbackOferenda(`Selecione ao menos um tipo para ${semTipo.pessoa}.`, 'erro');
      return;
    }

    const semComplemento = linhasComPessoa.find((linha) => !linha.complemento);
    if (semComplemento) {
      definirFeedbackOferenda(`Selecione Oferenda, Oferta ou Mesa do Obi para ${semComplemento.pessoa}.`, 'erro');
      return;
    }

    const botao = obter('btnSalvarRelacaoOferenda');
    if (botao) botao.disabled = true;

    try {
      const { db, collection, doc, setDoc, serverTimestamp } = firebase();
      const referencia = relacaoOferendaEditandoId
        ? doc(db, RELACOES_OFERENDA_COLLECTION, relacaoOferendaEditandoId)
        : doc(collection(db, RELACOES_OFERENDA_COLLECTION));

      const payload = {
        titulo: dados.titulo,
        data: dados.data,
        linhas: dados.linhas,
        resumo: dados.resumo,
        atualizadoEm: serverTimestamp()
      };

      if (!relacaoOferendaEditandoId) payload.criadoEm = serverTimestamp();
      await setDoc(referencia, payload, { merge: Boolean(relacaoOferendaEditandoId) });

      definirFeedbackOferenda('Relação salva com sucesso!', 'sucesso', 3000);
      relacaoOferendaEditandoId = null;
      atualizarStatusEdicaoOferenda();
      await carregarRelacoesSalvasOferenda(true);
      limparFormularioRelacaoOferenda({ silencioso: true });
    } catch (erro) {
      console.error('Erro ao salvar relação:', erro);
      definirFeedbackOferenda('Não foi possível salvar a relação.', 'erro', 5000);
    } finally {
      if (botao) botao.disabled = false;
    }
  }

  async function carregarRelacoesSalvasOferenda(forcar = false) {
    if (carregandoRelacoesSalvasOferenda && !forcar) return carregandoRelacoesSalvasOferenda;

    carregandoRelacoesSalvasOferenda = (async () => {
      try {
        const { db, collection, getDocs, query, orderBy } = firebase();
        const snapshot = await getDocs(
          query(collection(db, RELACOES_OFERENDA_COLLECTION), orderBy('atualizadoEm', 'desc'))
        );

        relacoesSalvasOferenda = [];
        snapshot.forEach((documento) => {
          relacoesSalvasOferenda.push({
            id: documento.id,
            ...documento.data()
          });
        });

        renderizarRelacoesSalvasOferenda();
      } catch (erro) {
        console.error('Erro ao carregar relações:', erro);
        definirFeedbackOferenda('Não foi possível carregar as relações salvas.', 'erro', 5000);
      } finally {
        carregandoRelacoesSalvasOferenda = null;
      }
    })();

    return carregandoRelacoesSalvasOferenda;
  }

  function renderizarRelacoesSalvasOferenda(filtro = '') {
    const container = obter('relacoesOferendaSalvasBox');
    if (!container) return;

    const filtroNorm = normalizarTexto(filtro);
    const filtradas = relacoesSalvasOferenda.filter((item) => {
      const linhasTexto = (item.linhas || []).map((linha) => {
        const tipos = extrairTiposOferenda(linha).join(' ');
        const complemento = normalizarComplementoOferenda(linha);
        return `${linha.pessoa || ''} ${tipos} ${complemento}`;
      }).join(' ');
      return !filtroNorm || normalizarTexto(`${item.titulo || ''} ${linhasTexto}`).includes(filtroNorm);
    });

    if (!filtradas.length) {
      container.innerHTML = '<div class="relacoes-vazio">Nenhuma relação encontrada.</div>';
      return;
    }

    container.innerHTML = filtradas.map((item) => {
      const quantidadePessoas = (item.linhas || []).filter((linha) => String(linha.pessoa || '').trim()).length;
      const totalTipos = (item.linhas || []).reduce((total, linha) => total + extrairTiposOferenda(linha).length, 0);

      const pessoas = (item.linhas || []).map((linha) => linha.pessoa).filter(Boolean).slice(0, 3);
      const complementoPessoas = quantidadePessoas > 3 ? ` +${quantidadePessoas - 3}` : '';

      return `
        <article class="relacao-salva-item" data-relacao-id="${escaparHTML(item.id)}">
          <div class="relacao-salva-conteudo">
            <div class="relacao-salva-titulo">${escaparHTML(item.titulo || 'Relação de oferenda/oferta')}</div>
            <div class="relacao-salva-meta">
              <span>📅 ${escaparHTML(formatarDataCurta(item.data))}</span>
              <span>🪔 ${totalTipos} ${totalTipos === 1 ? 'tipo' : 'tipos'}</span>
              <span>👤 ${quantidadePessoas} ${quantidadePessoas === 1 ? 'pessoa' : 'pessoas'}</span>
            </div>
            ${pessoas.length ? `<div class="relacao-salva-pessoas">${escaparHTML(pessoas.join(', '))}${escaparHTML(complementoPessoas)}</div>` : ''}
          </div>
          <div class="relacao-salva-acoes">
            ${montarBotoesRelacaoSalva()}
          </div>
        </article>
      `;
    }).join('');
  }

  async function editarRelacaoSalvaOferenda(id) {
    try {
      const { db, doc, getDoc } = firebase();
      const snapshot = await getDoc(doc(db, RELACOES_OFERENDA_COLLECTION, id));

      if (!snapshot.exists()) {
        definirFeedbackOferenda('Relação não encontrada.', 'erro');
        return;
      }

      const dados = snapshot.data();
      obter('relacaoOferendaTitulo').value = dados.titulo || '';
      obter('relacaoOferendaData').value = dados.data || '';

      const tbody = obter('relacaoOferendaLinhas');
      tbody.innerHTML = '';

      (dados.linhas || []).forEach((linha) => {
        adicionarLinhaRelacaoOferenda(linha, false);
      });

      if (!tbody.children.length) {
        adicionarLinhaRelacaoOferenda({}, false);
      }

      relacaoOferendaEditandoId = id;
      atualizarStatusEdicaoOferenda();
      atualizarResumoOferenda();
      definirFeedbackOferenda('Relação carregada para edição.', 'sucesso', 2000);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (erro) {
      console.error('Erro ao editar relação:', erro);
      definirFeedbackOferenda('Não foi possível carregar a relação.', 'erro');
    }
  }

  async function excluirRelacaoSalvaOferenda(id) {
    const resposta = confirm('Deseja realmente excluir esta relação?');
    if (!resposta) return;

    try {
      const { db, doc, deleteDoc } = firebase();
      await deleteDoc(doc(db, RELACOES_OFERENDA_COLLECTION, id));

      definirFeedbackOferenda('Relação excluída com sucesso.', 'sucesso', 3000);
      await carregarRelacoesSalvasOferenda(true);
    } catch (erro) {
      console.error('Erro ao excluir relação:', erro);
      definirFeedbackOferenda('Não foi possível excluir a relação.', 'erro');
    }
  }

  // ========== FUNÇÕES DE IMPRESSÃO E PDF ==========

  function normalizarDadosRelacaoOferendaParaSaida(dados = {}) {
    const linhas = (Array.isArray(dados.linhas) ? dados.linhas : []).map((linha) => {
      const tiposOferenda = extrairTiposOferenda(linha);
      const complemento = normalizarComplementoOferenda(linha);
      return {
        ...linha,
        pessoa: String(linha.pessoa || '').trim(),
        tiposOferenda,
        tipoOferenda: tiposOferenda.join(', '),
        complemento,
        complementos: complemento,
        observacao: String(linha.observacao || '').trim()
      };
    });

    const mapaTipos = new Map();
    linhas.forEach((linha) => {
      if (!linha.pessoa) return;
      linha.tiposOferenda.forEach((tipo) => {
        const nome = String(tipo || '').trim();
        if (!nome) return;
        mapaTipos.set(nome, (mapaTipos.get(nome) || 0) + 1);
      });
    });

    const resumo = {
      totalOferendas: linhas.reduce((total, linha) => total + (linha.pessoa && linha.complemento === 'Oferenda' ? linha.tiposOferenda.length : 0), 0),
      totalOfertas: linhas.reduce((total, linha) => total + (linha.pessoa && linha.complemento === 'Oferta' ? linha.tiposOferenda.length : 0), 0),
      totalMesaObi: linhas.reduce((total, linha) => total + (linha.pessoa && linha.complemento === 'Mesa do Obi' ? linha.tiposOferenda.length : 0), 0),
      totalGeral: linhas.reduce((total, linha) => total + (linha.pessoa ? linha.tiposOferenda.length : 0), 0),
      porTipo: Array.from(mapaTipos.entries())
        .map(([nome, quantidade]) => ({ nome, quantidade }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
    };

    return {
      ...dados,
      titulo: String(dados.titulo || 'Relação de oferenda/oferta').trim() || 'Relação de oferenda/oferta',
      data: String(dados.data || dados.dataFuncao || hojeISO()).trim() || hojeISO(),
      linhas,
      resumo
    };
  }

  function gerarHtmlImpressaoOferenda(dados) {
    const tiposHTML = dados.resumo.porTipo.length
      ? dados.resumo.porTipo.map((item) => `
          <div class="relacao-print-tipo">
            <span>${escaparHTML(item.nome)}</span>
            <strong>${item.quantidade} ${item.quantidade === 1 ? 'registro' : 'registros'}</strong>
          </div>
        `).join('')
      : '<div class="relacao-print-sem-dados">Nenhum tipo informado.</div>';

    const linhasHTML = dados.linhas.map((linha) => `
      <tr>
        <td class="relacao-print-pessoa">${escaparHTML(linha.pessoa || '—')}</td>
        <td>${escaparHTML(linha.tipoOferenda || '—')}</td>
        <td>${escaparHTML(linha.complemento || '—')}</td>
        <td>${escaparHTML(linha.observacao || '—')}</td>
      </tr>
    `).join('');

    return `
      <div class="relacao-print-documento">
        <header class="relacao-print-header">
          <div class="relacao-print-identidade">
            <img class="relacao-print-logo" src="${escaparHTML(obterUrlLogoCentro())}" alt="Logo do centro" onerror="this.style.display='none'">
            <div class="relacao-print-marca">ILÊ D'OGUM</div>
          </div>
          <h1>${escaparHTML(dados.titulo)}</h1>
          <div class="relacao-print-data">Função do Dia&nbsp; • &nbsp;${escaparHTML(formatarDataBR(dados.data))}</div>
        </header>

        <section class="relacao-print-metricas">
          <div><span>OFERENDAS</span><strong>${Number(dados.resumo.totalOferendas || 0)}</strong></div>
          <div><span>OFERTAS</span><strong>${Number(dados.resumo.totalOfertas || 0)}</strong></div>
          <div><span>MESA DO OBI</span><strong>${Number(dados.resumo.totalMesaObi || 0)}</strong></div>
          <div><span>TOTAL</span><strong>${Number(dados.resumo.totalGeral || 0)}</strong></div>
        </section>

        <section class="relacao-print-resumo-tipos">
          <h2>Quantidade por tipo de oferenda/oferta</h2>
          <div class="relacao-print-tipos-grid">${tiposHTML}</div>
        </section>

        <table class="relacao-print-tabela">
          <thead>
            <tr>
              <th>Pessoa ou referência</th>
              <th>Tipos de oferenda/oferta</th>
              <th>Complemento</th>
              <th>Observação</th>
            </tr>
          </thead>
          <tbody>${linhasHTML}</tbody>
        </table>
      </div>
    `;
  }

  function montarDocumentoImpressaoOferendaCompleto(dados) {
    const tituloSeguro = escaparHTML(dados?.titulo || 'Relação de oferenda/oferta');
    const conteudo = gerarHtmlImpressaoOferenda(dados);

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${tituloSeguro}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 12mm;
    }

    * { box-sizing: border-box; }

    html,
    body {
      width: 100%;
      min-height: 100%;
      margin: 0;
      padding: 0;
      background: #fff;
      color: #292524;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-size: 17px;
      overflow: visible !important;
    }

    .relacao-print-documento {
      width: 100%;
      max-width: 100%;
      margin: 0;
      padding: 0;
      overflow: visible;
    }

    .relacao-print-header {
      padding-bottom: 13px;
      border-bottom: 1px solid #cfcac5;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .relacao-print-identidade {
      display: flex;
      align-items: center;
      flex-direction: column;
      justify-content: center;
      width: 100%;
      margin-bottom: 10px;
      text-align: center;
    }

    .relacao-print-logo {
      display: block;
      width: auto;
      max-width: 125px;
      height: auto;
      max-height: 82px;
      margin: 0 auto 6px;
      object-fit: contain;
    }

    .relacao-print-marca {
      margin: 0;
      color: #9a5d2f;
      font-size: 17px;
      font-weight: 800;
      letter-spacing: .18em;
      text-align: center;
    }

    .relacao-print-header h1 {
      margin: 0 0 6px;
      color: #292524;
      font-size: 34px;
      font-weight: 700;
      line-height: 1.16;
      text-align: center;
      overflow-wrap: anywhere;
    }

    .relacao-print-data {
      color: #68615b;
      font-size: 18px;
      text-align: center;
    }

    .relacao-print-metricas {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      padding: 13px 2px 12px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .relacao-print-metricas div {
      min-width: 0;
      padding: 8px 9px;
      border: 1px solid #e0dcd8;
      border-radius: 5px;
    }

    .relacao-print-metricas span {
      display: block;
      margin-bottom: 4px;
      color: #6f6862;
      font-size: 12.5px;
      font-weight: 800;
      letter-spacing: .10em;
    }

    .relacao-print-metricas strong {
      color: #292524;
      font-size: 24px;
    }

    .relacao-print-resumo-tipos {
      margin-bottom: 10px;
      padding: 9px 10px;
      border: 1px solid #dedad6;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .relacao-print-resumo-tipos h2 {
      margin: 0 0 7px;
      font-size: 18px;
    }

    .relacao-print-tipos-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: 20px;
      row-gap: 4px;
    }

    .relacao-print-tipo {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      min-width: 0;
      color: #625b55;
      font-size: 14.5px;
    }

    .relacao-print-tipo span {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .relacao-print-tipo strong {
      flex: 0 0 auto;
      color: #292524;
      white-space: nowrap;
    }

    .relacao-print-sem-dados {
      color: #78716c;
      font-size: 14.5px;
    }

    .relacao-print-tabela {
      width: 100%;
      max-width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 16.5px;
    }

    .relacao-print-tabela thead { display: table-header-group; }
    .relacao-print-tabela tbody { display: table-row-group; }

    .relacao-print-tabela th,
    .relacao-print-tabela td {
      padding: 11px 9px;
      border: 1px solid #d9d6d2;
      vertical-align: top;
      text-align: left;
      overflow-wrap: anywhere;
      word-break: normal;
      white-space: normal;
    }

    .relacao-print-tabela th {
      color: #5f5852;
      background: #f4f2ef;
      font-size: 15.5px;
      font-weight: 800;
    }

    .relacao-print-tabela th:nth-child(1) { width: 29%; }
    .relacao-print-tabela th:nth-child(2) { width: 29%; }
    .relacao-print-tabela th:nth-child(3) { width: 17%; }
    .relacao-print-tabela th:nth-child(4) { width: 25%; }

    .relacao-print-pessoa { font-weight: 700; }

    .relacao-print-tabela tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    @media screen {
      body { padding: 16px; }
    }

    @media print {
      html,
      body {
        width: auto !important;
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
      }
    }
  </style>
</head>
<body>${conteudo}</body>
</html>`;
  }

  function executarImpressaoOferenda(dados) {
    const dadosNormalizados = normalizarDadosRelacaoOferendaParaSaida(dados);

    if (!dadosNormalizados.linhas.length) {
      definirFeedbackOferenda('Adicione pelo menos uma pessoa antes de imprimir.', 'erro', 4000);
      return;
    }

    definirFeedbackOferenda('Preparando a impressão...', 'info', 2500);

    // Usa o mesmo documento isolado da Relação de Ebó. Assim a impressão
    // não herda elementos ocultos da página principal e não sai em branco.
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Documento de impressão da relação de oferenda');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '297mm';
    iframe.style.height = '210mm';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.background = '#fff';
    document.body.appendChild(iframe);

    let removido = false;
    let fallbackTimer = null;

    const limpar = () => {
      if (removido) return;
      removido = true;
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      window.setTimeout(() => iframe.remove(), 500);
    };

    try {
      const docImpressao = iframe.contentDocument || iframe.contentWindow?.document;
      if (!docImpressao) throw new Error('Documento de impressão indisponível.');

      docImpressao.open();
      docImpressao.write(montarDocumentoImpressaoOferendaCompleto(dadosNormalizados));
      docImpressao.close();

      const janelaImpressao = iframe.contentWindow;
      if (!janelaImpressao) throw new Error('Janela de impressão indisponível.');

      const imprimirQuandoPronto = async () => {
        try {
          await aguardarImagensDocumento(docImpressao);
          janelaImpressao.addEventListener('afterprint', limpar, { once: true });
          janelaImpressao.focus();
          janelaImpressao.requestAnimationFrame(() => {
            janelaImpressao.requestAnimationFrame(() => {
              window.setTimeout(() => {
                janelaImpressao.print();
                fallbackTimer = window.setTimeout(limpar, 120000);
              }, 180);
            });
          });
        } catch (erro) {
          console.error('Falha ao abrir impressão de oferenda:', erro);
          limpar();
          definirFeedbackOferenda('Não foi possível abrir a impressão. Tente novamente.', 'erro', 5000);
        }
      };

      if (docImpressao.readyState === 'complete') {
        imprimirQuandoPronto();
      } else {
        iframe.addEventListener('load', imprimirQuandoPronto, { once: true });
      }
    } catch (erro) {
      console.error('Erro ao preparar impressão de oferenda:', erro);
      limpar();
      definirFeedbackOferenda('Não foi possível preparar a impressão.', 'erro', 5000);
    }
  }

  function nomeArquivoPdfOferenda(dados) {
    const titulo = normalizarTexto(dados?.titulo || 'Relação de oferenda/oferta')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'relacao-de-oferenda';
    const data = String(dados?.data || hojeISO()).replace(/[^0-9-]/g, '') || hojeISO();
    return `${data}-${titulo}.pdf`;
  }

  async function gerarPdfOferenda(dados) {
    dados = normalizarDadosRelacaoOferendaParaSaida(dados);

    if (!dados.linhas.length) {
      definirFeedbackOferenda('Adicione pelo menos uma pessoa antes de gerar o PDF.', 'erro', 4000);
      return;
    }

    const JsPDF = window.jspdf?.jsPDF;
    if (!JsPDF) {
      definirFeedbackOferenda('O gerador de PDF não carregou. Verifique a internet e atualize a página.', 'erro', 7000);
      return;
    }

    definirFeedbackOferenda('Gerando o arquivo PDF...', 'info', 8000);

    try {
      const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
      const paginaLargura = doc.internal.pageSize.getWidth();
      const paginaAltura = doc.internal.pageSize.getHeight();
      const margem = 12;
      const larguraUtil = paginaLargura - (margem * 2);

      doc.setProperties({
        title: dados.titulo,
        subject: 'Relação de Oferenda/Oferta',
        author: "ILÊ D'OGUM",
        creator: 'Sistema de Relações'
      });

      let y = await desenharCabecalhoPdfCentralizado(
        doc,
        dados.titulo,
        `Função do Dia • ${formatarDataBR(dados.data)}`,
        paginaLargura,
        margem
      );

      const metricas = [
        ['OFERENDAS', Number(dados.resumo.totalOferendas || 0)],
        ['OFERTAS', Number(dados.resumo.totalOfertas || 0)],
        ['MESA DO OBI', Number(dados.resumo.totalMesaObi || 0)],
        ['TOTAL', Number(dados.resumo.totalGeral || 0)]
      ];
      const espaco = 3;
      const caixaLargura = (larguraUtil - (espaco * 3)) / 4;

      metricas.forEach(([rotulo, valor], indice) => {
        const x = margem + indice * (caixaLargura + espaco);
        doc.setDrawColor(224, 220, 216);
        doc.roundedRect(x, y, caixaLargura, 17, 1.5, 1.5, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(rotulo === 'MESA DO OBI' ? 8.6 : 9.5);
        doc.setTextColor(111, 104, 98);
        doc.text(rotulo, x + 3, y + 5.2);
        doc.setFontSize(17);
        doc.setTextColor(41, 37, 36);
        doc.text(String(valor), x + 3, y + 12.7);
      });
      y += 23;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(41, 37, 36);
      doc.text('Quantidade por tipo de oferenda/oferta', margem, y);
      y += 4;

      const tipos = dados.resumo.porTipo;
      const linhasTipos = tipos.length
        ? tipos.map((item) => `${item.nome}: ${item.quantidade} ${item.quantidade === 1 ? 'registro' : 'registros'}`)
        : ['Nenhum tipo informado.'];
      const alturaTipos = Math.max(12, Math.ceil(linhasTipos.length / 2) * 5.2 + 5);

      doc.setDrawColor(222, 218, 214);
      doc.rect(margem, y, larguraUtil, alturaTipos, 'S');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(98, 91, 85);

      linhasTipos.forEach((texto, indice) => {
        const coluna = indice % 2;
        const linha = Math.floor(indice / 2);
        const x = margem + 3 + coluna * (larguraUtil / 2);
        const larguraColuna = (larguraUtil / 2) - 7;
        const partes = quebrarTextoPdf(doc, texto, larguraColuna);
        doc.text(partes, x, y + 5 + linha * 5.2);
      });
      y += alturaTipos + 6;

      if (typeof doc.autoTable !== 'function') {
        throw new Error('Plugin de tabela PDF não carregado.');
      }

      const corpo = dados.linhas.map((linha) => [
        linha.pessoa || '—',
        linha.tipoOferenda || '—',
        linha.complemento || '—',
        linha.observacao || '—'
      ]);

      doc.autoTable({
        startY: y,
        margin: { top: 12, right: margem, bottom: 15, left: margem },
        head: [['Pessoa ou referência', 'Tipos de oferenda/oferta', 'Complemento', 'Observação']],
        body: corpo,
        theme: 'grid',
        tableWidth: larguraUtil,
        styles: {
          font: 'helvetica',
          fontSize: 14.5,
          textColor: [41, 37, 36],
          lineColor: [217, 214, 210],
          lineWidth: 0.2,
          cellPadding: 2.8,
          overflow: 'linebreak',
          valign: 'top'
        },
        headStyles: {
          fillColor: [244, 242, 239],
          textColor: [95, 88, 82],
          fontStyle: 'bold',
          fontSize: 13.5
        },
        columnStyles: {
          0: { cellWidth: larguraUtil * 0.29, fontStyle: 'bold' },
          1: { cellWidth: larguraUtil * 0.29 },
          2: { cellWidth: larguraUtil * 0.17 },
          3: { cellWidth: larguraUtil * 0.25 }
        },
        didDrawPage: () => {
          const numeroPagina = doc.internal.getNumberOfPages();
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9.5);
          doc.setTextColor(120, 113, 108);
          doc.text(`Página ${numeroPagina}`, paginaLargura - margem, paginaAltura - 7, { align: 'right' });
        }
      });

      doc.save(nomeArquivoPdfOferenda(dados));
      definirFeedbackOferenda('PDF baixado com sucesso.', 'sucesso', 4000);
    } catch (erro) {
      console.error('Erro ao gerar PDF de oferenda:', erro);
      definirFeedbackOferenda('Não foi possível gerar o PDF. Atualize a página e tente novamente.', 'erro', 7000);
    }
  }

  async function abrirContainerRelacaoOferendaCompleto() {
    const escolha = obter('relacoesEscolha');
    const relacaoEbo = obter('container-relacao-ebo');
    const relacaoOferenda = obter('container-relacao-oferenda');

    if (escolha) escolha.style.display = 'none';
    if (relacaoEbo) relacaoEbo.style.display = 'none';
    if (relacaoOferenda) relacaoOferenda.style.display = 'block';

    if (!obter('relacaoOferendaData')?.value) {
      obter('relacaoOferendaData').value = hojeISO();
    }

    if (!obter('relacaoOferendaLinhas')?.children.length) {
      adicionarLinhaRelacaoOferenda();
    }

    await Promise.allSettled([
      carregarTiposOferenda(),
      carregarRelacoesSalvasOferenda()
    ]);

    atualizarResumoOferenda();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ========== LIGAÇÃO DE EVENTOS ==========

  function ligarNavegacaoOferenda() {
    const btnOferenda = obter('btn-relacao-oferenda');
    if (btnOferenda && btnOferenda.dataset.relacoesOferendaCompleto !== '1') {
      btnOferenda.removeEventListener('click', abrirContainerRelacaoOferenda);
      btnOferenda.addEventListener('click', abrirContainerRelacaoOferendaCompleto);
      btnOferenda.dataset.relacoesOferendaCompleto = '1';
      btnOferenda.dataset.relacoesLigado = '1';
    }

    ligarBotao('btnAdicionarPessoaRelacaoOferenda', () => adicionarLinhaRelacaoOferenda());
    ligarBotao('btnRecarregarTiposOferenda', () => carregarTiposOferenda(true));
    ligarBotao('btnCadastrarTipoOferenda', cadastrarTipoOferenda);
    ligarBotao('btnSalvarRelacaoOferenda', salvarRelacaoOferenda);
    ligarBotao('btnNovaRelacaoOferenda', () => limparFormularioRelacaoOferenda({ confirmar: true }));
    ligarBotao('btnAtualizarRelacoesSalvasOferenda', () => carregarRelacoesSalvasOferenda(true));
    ligarBotao('btnImprimirRelacaoOferenda', () => executarImpressaoOferenda(prepararDadosAtuaisParaImpressaoOferenda()));
    ligarBotao('btnPdfRelacaoOferenda', () => gerarPdfOferenda(prepararDadosAtuaisParaImpressaoOferenda()));

    const inputNovoTipo = obter('novoTipoOferendaNome');
    if (inputNovoTipo && inputNovoTipo.dataset.relacoesLigado !== '1') {
      inputNovoTipo.addEventListener('keydown', (evento) => {
        if (evento.key !== 'Enter') return;
        evento.preventDefault();
        cadastrarTipoOferenda();
      });
      inputNovoTipo.dataset.relacoesLigado = '1';
    }

    const listaTipos = obter('tiposOferendaCadastrados');
    if (listaTipos && listaTipos.dataset.relacoesLigado !== '1') {
      listaTipos.addEventListener('click', (evento) => {
        const botao = evento.target.closest('[data-excluir-tipo-oferenda]');
        if (!botao) return;
        excluirTipoOferenda(botao.dataset.excluirTipoOferenda, botao.dataset.tipoNome || '');
      });
      listaTipos.dataset.relacoesLigado = '1';
    }

    const tbody = obter('relacaoOferendaLinhas');
    if (tbody && tbody.dataset.relacoesLigado !== '1') {
      tbody.addEventListener('input', atualizarResumoOferenda);
      tbody.addEventListener('change', atualizarResumoOferenda);
      tbody.addEventListener('click', (evento) => {
        const opcaoTipo = evento.target.closest('.relacao-multiselect-opcao[data-tipo-oferenda]');
        if (opcaoTipo) {
          evento.preventDefault();
          alternarTipoOferendaNoDropdown(opcaoTipo);
          atualizarResumoOferenda();
          return;
        }

        const opcaoComplemento = evento.target.closest('.relacao-select-complemento-opcao[data-complemento-oferenda]');
        if (opcaoComplemento) {
          evento.preventDefault();
          escolherComplementoOferendaNoDropdown(opcaoComplemento);
          atualizarResumoOferenda();
          return;
        }

        const remover = evento.target.closest('.relacao-remover-linha');
        if (!remover) return;

        const linha = remover.closest('tr');
        linha?.remove();

        if (!tbody.children.length) adicionarLinhaRelacaoOferenda({}, false);
        atualizarResumoOferenda();
      });
      tbody.dataset.relacoesLigado = '1';
    }

    if (document.documentElement.dataset.relacoesDropdownOferendaLigado !== '1') {
      document.addEventListener('click', (evento) => {
        document.querySelectorAll(
          '#relacaoEboLinhas .relacao-select-ebo[open], #relacaoOferendaLinhas .relacao-multiselect-tipos[open], #relacaoOferendaLinhas .relacao-select-complemento[open]'
        ).forEach((seletor) => {
          if (!seletor.contains(evento.target)) seletor.removeAttribute('open');
        });
      });

      document.addEventListener('toggle', prepararDropdownOferendaFlutuante, true);
      window.addEventListener('resize', reposicionarDropdownsOferendaAbertos, { passive: true });
      window.addEventListener('scroll', reposicionarDropdownsOferendaAbertos, { passive: true, capture: true });
      document.documentElement.dataset.relacoesDropdownOferendaLigado = '1';
    }

    const pesquisa = obter('pesquisaRelacoesOferenda');
    if (pesquisa && pesquisa.dataset.relacoesLigado !== '1') {
      pesquisa.addEventListener('input', (evt) => renderizarRelacoesSalvasOferenda(evt.target.value));
      pesquisa.dataset.relacoesLigado = '1';
    }

    const salvas = obter('relacoesOferendaSalvasBox');
    if (salvas && salvas.dataset.relacoesLigado !== '1') {
      salvas.addEventListener('click', async (evento) => {
        const botao = evento.target.closest('button[data-acao]');
        const item = evento.target.closest('[data-relacao-id]');
        if (!botao || !item) return;

        const id = item.dataset.relacaoId;
        const acao = botao.dataset.acao;

        if (acao === 'editar') await editarRelacaoSalvaOferenda(id);
        if (acao === 'excluir') await excluirRelacaoSalvaOferenda(id);
        if (acao === 'imprimir') {
          const relacao = relacoesSalvasOferenda.find((registro) => registro.id === id);
          if (relacao) executarImpressaoOferenda(relacao);
        }
        if (acao === 'pdf') {
          const relacao = relacoesSalvasOferenda.find((registro) => registro.id === id);
          if (relacao) await gerarPdfOferenda(relacao);
        }
      });
      salvas.dataset.relacoesLigado = '1';
    }
  }

  // Chamar a função de ligação no início (adicionar ao final do iniciar())
  ligarNavegacaoOferenda();
})();
