/* ==========================================================
   app.js — Navegação, telas e regras de negócio
   Depende de db.js
   ========================================================== */
(() => {
  'use strict';

  /* ---------- constantes ---------- */
  const CATEGORIAS = ['Perecíveis', 'Padaria', 'Frios', 'Congelados', 'Bebidas', 'Limpeza', 'Outros'];
  const UNIDADES = ['un', 'kg', 'g', 'L', 'ml', 'cx', 'pct'];
  const MAIN = ['inicio', 'produtos', 'movimentacoes', 'mais'];
  const SUBS = { entrada: ['Compra', 'Devolução', 'Ajuste'], saida: ['Venda', 'Consumo', 'Perda'] };

  const ICONS = {
    box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    down: '<path d="M12 4v14M6 12l6 6 6-6"/>',
    up: '<path d="M12 20V6M6 12l6-6 6 6"/>',
    chart: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    home: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
    swap: '<path d="M7 7h13l-3-3M17 17H4l3 3"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="14" r="4"/>',
    store: '<path d="M4 9l1-5h14l1 5M4 9v11h16V9M9 20v-6h6v6"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    scan: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M4 12h16"/>',
    filter: '<path d="M4 7h16M7 12h10M10 17h4"/>',
    cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
  };
  const ic = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hoje = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const fmtData = (d) => (d || '').split('-').reverse().join('/');
  const fmtNum = (n) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  const money = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const num = (sel) => parseFloat($(sel).value.replace(',', '.')) || 0;
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const hydrate = (root = document) => $$('[data-icon]', root).forEach(el => { el.innerHTML = ic(el.dataset.icon); });

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 2400);
  }

  /* ---------- estado ---------- */
  const state = {
    view: null, stack: [],
    produtos: [], movs: [],
    empresa: { nome: 'Minha Empresa', ramo: 'Padaria e Confeitaria' },
    cat: 'Todos', busca: '', soBaixo: false,
    mvFiltro: 'todas',
    editId: null, foto: '',
    mov: null,
  };

  const situacao = (p) => {
    const q = p.estoque || 0;
    if (q <= 0) return 'falta';
    if (q <= (p.estoqueMin || 0)) return 'minimo';
    return 'ok';
  };
  const corSit = { ok: 'green', minimo: 'orange', falta: 'red' };

  async function carregar() {
    state.produtos = await DB.todosProdutos();
    state.movs = (await DB.todasMovs()).sort((a, b) => b.criadoEm - a.criadoEm);
    state.empresa = (await DB.getConfig('empresa')) || state.empresa;
  }

  /* ---------- navegação ---------- */
  function go(v, { push = true } = {}) {
    if (MAIN.includes(v)) state.stack = [];
    else if (push && state.view) state.stack.push(state.view);
    state.view = v;
    $$('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
    $('#nav').classList.toggle('hidden', !MAIN.includes(v));
    $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.go === v));
    render(v);
    $('#screen').scrollTop = 0;
  }
  const back = () => go(state.stack.pop() || 'inicio', { push: false });

  function render(v = state.view) {
    ({
      inicio: renderInicio, produtos: renderProdutos, movimentacoes: renderMovs,
      mais: renderMais, relatorios: renderRelatorios, compras: renderCompras,
      empresa: renderEmpresa, mov: renderMov,
    })[v]?.();
  }

  /* ---------- INÍCIO ---------- */
  function renderInicio() {
    const p = state.produtos;
    $('#s-total').textContent = p.length;
    $('#s-ok').textContent = p.filter(x => situacao(x) === 'ok').length;
    $('#s-falta').textContent = p.filter(x => situacao(x) === 'falta').length;
    $('#s-min').textContent = p.filter(x => situacao(x) === 'minimo').length;
    $('#home-q').value = '';
  }

  /* ---------- PRODUTOS ---------- */
  function renderProdutos() {
    // chips
    const cats = ['Todos', ...CATEGORIAS];
    $('#p-chips').innerHTML = cats.map(c => `<button class="chip ${state.cat === c ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
    $('#p-filter').style.color = state.soBaixo ? 'var(--orange)' : '';
    if ($('#p-q').value !== state.busca) $('#p-q').value = state.busca;

    const q = norm(state.busca);
    const lista = state.produtos
      .filter(p => state.cat === 'Todos' || p.categoria === state.cat)
      .filter(p => !state.soBaixo || situacao(p) !== 'ok')
      .filter(p => !q || norm(p.nome).includes(q) || norm(p.codigo).includes(q) || norm(p.categoria).includes(q))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    $('#p-list').innerHTML = lista.length ? lista.map(p => `
      <button class="item" data-edit="${p.id}">
        <div class="thumb">${p.foto ? `<img src="${p.foto}" alt="">` : ic('box')}</div>
        <div class="info"><b>${esc(p.nome)}</b><small>${p.codigo ? 'Cód. ' + esc(p.codigo) : 'Sem código'}</small><small>${esc(p.categoria)}</small></div>
        <div class="qty">Estoque<b class="${corSit[situacao(p)]}">${fmtNum(p.estoque)} ${esc(p.unidade)}</b></div>
      </button>`).join('')
      : `<div class="empty">Nenhum produto encontrado.<br>Toque em <b>+</b> para cadastrar.</div>`;
  }

  /* ---------- CADASTRO ---------- */
  function abrirCadastro(id = null) {
    state.editId = id;
    const p = id ? state.produtos.find(x => x.id === id) : null;
    $('#c-title').textContent = p ? 'Editar Produto' : 'Cadastro de Produto';
    $('#c-del').classList.toggle('hidden', !p);
    $('#c-estoque-wrap').classList.toggle('hidden', !!p);
    $('#c-nome').value = p?.nome || '';
    $('#c-codigo').value = p?.codigo || '';
    $('#c-cat').value = p?.categoria || '';
    $('#c-un').value = p?.unidade || '';
    $('#c-min').value = p?.estoqueMin ?? '';
    $('#c-estoque').value = '';
    $('#c-custo').value = p?.custo || '';
    $('#c-venda').value = p?.venda || '';
    setFoto(p?.foto || '');
    go('cadastro');
  }

  function setFoto(src) {
    state.foto = src;
    $('#c-img').hidden = !src;
    $('#c-img').src = src || '';
    $('#c-ph').hidden = !!src;
  }

  function reduzirImagem(file, max = 320) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function salvarProduto() {
    const nome = $('#c-nome').value.trim();
    const categoria = $('#c-cat').value;
    const unidade = $('#c-un').value;
    const codigo = $('#c-codigo').value.trim();
    if (!nome || !categoria || !unidade) return toast('Preencha os campos obrigatórios (*)');
    if (codigo && state.produtos.some(p => p.codigo === codigo && p.id !== state.editId)) return toast('Esse código já está cadastrado');

    const base = state.editId ? state.produtos.find(p => p.id === state.editId) : { estoque: 0 };
    const p = { ...base, nome, codigo, categoria, unidade, estoqueMin: num('#c-min'), custo: num('#c-custo'), venda: num('#c-venda'), foto: state.foto };
    if (!state.editId) p.estoque = num('#c-estoque');

    await DB.salvarProduto(p);
    await carregar();
    toast('Produto salvo!');
    back();
  }

  async function excluirProduto() {
    if (!state.editId || !confirm('Excluir este produto? O histórico de movimentações será mantido.')) return;
    await DB.excluirProduto(state.editId);
    await carregar();
    toast('Produto excluído');
    back();
  }

  /* ---------- ENTRADA / SAÍDA ---------- */
  function abrirMov(tipo) {
    state.mov = { tipo, sub: SUBS[tipo][0], data: hoje(), itens: [], obs: '' };
    $('#m-data').value = state.mov.data;
    $('#m-obs').value = '';
    go('mov');
  }

  function renderMov() {
    const m = state.mov; if (!m) return;
    const ent = m.tipo === 'entrada';
    $('#m-title').textContent = ent ? 'Entrada de Mercadoria' : 'Saída de Mercadoria';
    $('#m-hero-t').textContent = ent ? 'Registrar nova entrada' : 'Registrar nova saída';
    $('#m-hero-p').textContent = ent ? 'Adicione os produtos e as quantidades recebidas no estoque.' : 'Adicione os produtos e as quantidades retiradas do estoque.';
    $('#m-ico').innerHTML = ic(ent ? 'down' : 'up');
    $('#m-tipo-label').textContent = ent ? 'Tipo de entrada' : 'Tipo de saída';
    $('#m-data-label').textContent = ent ? 'Data da entrada' : 'Data da saída';
    $('#m-seg').innerHTML = SUBS[m.tipo].map(s => `<button data-sub="${s}" class="${m.sub === s ? 'on' : ''}">${s}</button>`).join('');
    $('#m-itens').innerHTML = m.itens.length ? m.itens.map((it, i) => {
      const p = state.produtos.find(x => x.id === it.produtoId);
      return `<div class="item">
        <div class="thumb">${p?.foto ? `<img src="${p.foto}" alt="">` : ic('box')}</div>
        <div class="info"><b>${esc(it.nome)}</b><small>Qtd: ${fmtNum(it.qtd)} ${esc(it.unidade)}</small></div>
        <button class="del" data-rm="${i}" aria-label="Remover">${ic('trash')}</button>
      </div>`;
    }).join('') : `<div class="empty">Nenhum produto adicionado.</div>`;
  }

  async function salvarMov() {
    const m = state.mov;
    m.data = $('#m-data').value; m.obs = $('#m-obs').value.trim();
    if (!m.itens.length) return toast('Adicione ao menos um produto');
    if (!m.data) return toast('Informe a data');
    const mov = { tipo: m.tipo, sub: m.sub, data: m.data, obs: m.obs, itens: m.itens, criadoEm: Date.now() };
    try {
      await DB.registrarMovimentacao(mov);
      await carregar();
      toast(m.tipo === 'entrada' ? 'Entrada registrada!' : 'Saída registrada!');
      state.mov = null;
      go('inicio');
    } catch (e) { toast(e.message); }
  }

  /* ---------- bottom sheet: escolher produto ---------- */
  function abrirSheet() {
    $('#sheet').classList.remove('hidden');
    sheetLista();
  }
  const fecharSheet = () => $('#sheet').classList.add('hidden');

  function sheetLista(q = '') {
    $('#sheet-title').textContent = 'Adicionar produto';
    const qq = norm(q);
    const lista = state.produtos.filter(p => !qq || norm(p.nome).includes(qq) || norm(p.codigo).includes(qq))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    $('#sheet-body').innerHTML = `
      <div class="search"><i>${ic('search')}</i><input id="sh-q" placeholder="Buscar produto..." value="${esc(q)}" autocomplete="off"></div>
      <div class="list">${lista.length ? lista.map(p => `
        <button class="item" data-pick="${p.id}">
          <div class="thumb">${p.foto ? `<img src="${p.foto}" alt="">` : ic('box')}</div>
          <div class="info"><b>${esc(p.nome)}</b><small>${esc(p.categoria)}</small></div>
          <div class="qty">Estoque<b class="${corSit[situacao(p)]}">${fmtNum(p.estoque)} ${esc(p.unidade)}</b></div>
        </button>`).join('') : '<div class="empty">Nenhum produto cadastrado.</div>'}</div>`;
    const inp = $('#sh-q');
    inp.addEventListener('input', () => { sheetLista(inp.value); const n = $('#sh-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); });
  }

  function sheetQtd(id) {
    const p = state.produtos.find(x => x.id === id);
    $('#sheet-title').textContent = p.nome;
    const ent = state.mov.tipo === 'entrada';
    const jaNaLista = state.mov.itens.filter(i => i.produtoId === id).reduce((s, i) => s + i.qtd, 0);
    $('#sheet-body').innerHTML = `
      <p class="mut">${ent ? 'Estoque atual' : 'Disponível'}: <b>${fmtNum((p.estoque || 0) - (ent ? 0 : jaNaLista))} ${esc(p.unidade)}</b></p>
      <div class="qty-box"><input id="sh-qtd" type="number" min="0" step="any" inputmode="decimal" placeholder="0" autofocus><span>${esc(p.unidade)}</span></div>
      <button class="btn" id="sh-ok">Adicionar</button>`;
    setTimeout(() => $('#sh-qtd')?.focus(), 50);
    $('#sh-ok').onclick = () => {
      const qtd = parseFloat($('#sh-qtd').value.replace(',', '.'));
      if (!(qtd > 0)) return toast('Informe uma quantidade válida');
      if (!ent && qtd + jaNaLista > (p.estoque || 0)) return toast(`Estoque insuficiente (${fmtNum(p.estoque)} ${p.unidade})`);
      const ex = state.mov.itens.find(i => i.produtoId === id);
      if (ex) ex.qtd += qtd; else state.mov.itens.push({ produtoId: id, nome: p.nome, unidade: p.unidade, qtd });
      fecharSheet(); renderMov();
    };
  }

  /* ---------- MOVIMENTAÇÕES ---------- */
  function renderMovs() {
    const f = [['todas', 'Todas'], ['entrada', 'Entradas'], ['saida', 'Saídas']];
    $('#mv-chips').innerHTML = f.map(([k, l]) => `<button class="chip ${state.mvFiltro === k ? 'on' : ''}" data-mvf="${k}">${l}</button>`).join('');
    const lista = state.movs.filter(m => state.mvFiltro === 'todas' || m.tipo === state.mvFiltro);
    $('#mv-list').innerHTML = lista.length ? lista.map(m => `
      <div class="mv">
        <div class="ico ${m.tipo === 'entrada' ? 'in' : 'out'}">${ic(m.tipo === 'entrada' ? 'down' : 'up')}</div>
        <div class="body">
          <b>${m.tipo === 'entrada' ? 'Entrada' : 'Saída'} · ${esc(m.sub)}</b>
          <small>${fmtData(m.data)}</small>
          <small>${m.itens.map(i => `${fmtNum(i.qtd)} ${esc(i.unidade)} ${esc(i.nome)}`).join(' · ')}</small>
          ${m.obs ? `<small>“${esc(m.obs)}”</small>` : ''}
        </div>
      </div>`).join('') : '<div class="empty">Nenhuma movimentação registrada.</div>';
  }

  /* ---------- MAIS / EMPRESA ---------- */
  function renderMais() {
    $('#mais-empresa').textContent = state.empresa.nome || 'Minha Empresa';
    $('#mais-ramo').textContent = state.empresa.ramo || 'Toque para editar';
  }
  function renderEmpresa() {
    $('#e-nome').value = state.empresa.nome || '';
    $('#e-ramo').value = state.empresa.ramo || '';
  }
  async function salvarEmpresa() {
    state.empresa = { nome: $('#e-nome').value.trim() || 'Minha Empresa', ramo: $('#e-ramo').value.trim() };
    await DB.setConfig('empresa', state.empresa);
    toast('Dados salvos'); back();
  }

  /* ---------- RELATÓRIOS ---------- */
  function renderRelatorios() {
    const limite = Date.now() - 30 * 864e5;
    const rec = state.movs.filter(m => m.criadoEm >= limite);
    const cont = (t) => rec.filter(m => m.tipo === t).length;
    const valor = state.produtos.reduce((s, p) => s + (p.estoque || 0) * (p.custo || 0), 0);
    const venda = state.produtos.reduce((s, p) => s + (p.estoque || 0) * (p.venda || 0), 0);
    $('#r-cards').innerHTML = [
      ['Valor em estoque (custo)', money(valor)], ['Valor em estoque (venda)', money(venda)],
      ['Entradas (30 dias)', cont('entrada')], ['Saídas (30 dias)', cont('saida')],
    ].map(([l, v]) => `<div class="card stat"><small>${l}</small><b>${v}</b></div>`).join('');
    $('#r-list').innerHTML = state.produtos.length ? [...state.produtos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(p => `
      <div class="item"><div class="info"><b>${esc(p.nome)}</b><small>${esc(p.categoria)} · mín. ${fmtNum(p.estoqueMin)} ${esc(p.unidade)}</small></div>
      <div class="qty">Saldo<b class="${corSit[situacao(p)]}">${fmtNum(p.estoque)} ${esc(p.unidade)}</b></div></div>`).join('')
      : '<div class="empty">Sem produtos cadastrados.</div>';
  }

  /* ---------- LISTA DE COMPRAS ---------- */
  const itensCompra = () => state.produtos.filter(p => situacao(p) !== 'ok').map(p => {
    const alvo = Math.max((p.estoqueMin || 0) * 2, 1);
    return { p, repor: Math.max(Math.ceil((alvo - (p.estoque || 0)) * 100) / 100, 1) };
  });
  function renderCompras() {
    const l = itensCompra();
    $('#lc-list').innerHTML = l.length ? l.map(({ p, repor }) => `
      <div class="item"><div class="info"><b>${esc(p.nome)}</b><small>Atual: ${fmtNum(p.estoque)} ${esc(p.unidade)} · Mín.: ${fmtNum(p.estoqueMin)}</small></div>
      <div class="qty ${corSit[situacao(p)]}">Repor<b>${fmtNum(repor)} ${esc(p.unidade)}</b></div></div>`).join('')
      : '<div class="empty">Tudo certo! Nenhum produto em falta ou no mínimo. 🎉</div>';
  }
  async function copiarCompras() {
    const l = itensCompra();
    if (!l.length) return toast('Lista vazia');
    const txt = 'Lista de compras\n' + l.map(({ p, repor }) => `- ${p.nome}: ${fmtNum(repor)} ${p.unidade}`).join('\n');
    try { await navigator.clipboard.writeText(txt); toast('Lista copiada!'); } catch { prompt('Copie a lista:', txt); }
  }

  /* ---------- CONFIG: backup / exemplos ---------- */
  async function exportar() {
    const blob = new Blob([JSON.stringify(await DB.exportar(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `estoque-backup-${hoje()}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  }
  async function importar(file) {
    try {
      await DB.importar(JSON.parse(await file.text()));
      await carregar(); toast('Backup importado!'); go('inicio');
    } catch (e) { toast(e.message || 'Arquivo inválido'); }
  }
  async function carregarExemplos() {
    const ex = [
      ['Leite Integral 1L', '00123', 'Perecíveis', 'un', 10, 24], ['Pão Francês', '00124', 'Padaria', 'un', 20, 50],
      ['Queijo Mussarela', '00125', 'Frios', 'un', 10, 8], ['Frango Congelado', '00126', 'Congelados', 'kg', 5, 3],
      ['Refrigerante 2L', '00127', 'Bebidas', 'un', 6, 18], ['Detergente 500ml', '00128', 'Limpeza', 'un', 5, 12],
    ];
    for (const [nome, codigo, categoria, unidade, estoqueMin, estoque] of ex) {
      if (state.produtos.some(p => p.codigo === codigo)) continue;
      await DB.salvarProduto({ nome, codigo, categoria, unidade, estoqueMin, estoque, custo: 0, venda: 0, foto: '' });
    }
    await carregar(); toast('Exemplos carregados'); go('inicio');
  }

  /* ---------- leitor de código de barras ---------- */
  let stream = null, scanning = false;
  async function scan(cb) {
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) return toast('Leitor não suportado neste navegador');
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); }
    catch { return toast('Sem acesso à câmera'); }
    const v = $('#scan-video'); v.srcObject = stream; await v.play();
    $('#scanner').classList.remove('hidden'); scanning = true;
    const det = new BarcodeDetector();
    (async function loop() {
      while (scanning) {
        try { const r = await det.detect(v); if (r.length) { stopScan(); cb(r[0].rawValue); return; } } catch { /* tenta de novo */ }
        await new Promise(r => setTimeout(r, 250));
      }
    })();
  }
  function stopScan() {
    scanning = false; stream?.getTracks().forEach(t => t.stop()); stream = null;
    $('#scanner').classList.add('hidden');
  }
  const buscarPorCodigo = (cod) => { state.busca = cod; state.cat = 'Todos'; go('produtos'); };

  /* ---------- eventos ---------- */
  function bind() {
    // navegação genérica
    document.addEventListener('click', (e) => {
      const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go);
      if (e.target.closest('[data-back]')) return back();
    });

    // início
    $('#btn-cadastro').onclick = () => abrirCadastro();
    $('#btn-entrada').onclick = () => abrirMov('entrada');
    $('#btn-saida').onclick = () => abrirMov('saida');
    $('#home-q').addEventListener('focus', () => { go('produtos'); setTimeout(() => $('#p-q').focus(), 60); });
    $('#home-scan').onclick = () => scan(buscarPorCodigo);

    // produtos
    $('#p-q').addEventListener('input', (e) => { state.busca = e.target.value; renderProdutos(); });
    $('#p-chips').addEventListener('click', (e) => { const c = e.target.closest('[data-cat]'); if (c) { state.cat = c.dataset.cat; renderProdutos(); } });
    $('#p-list').addEventListener('click', (e) => { const i = e.target.closest('[data-edit]'); if (i) abrirCadastro(+i.dataset.edit); });
    $('#p-filter').onclick = () => { state.soBaixo = !state.soBaixo; renderProdutos(); toast(state.soBaixo ? 'Mostrando só estoque baixo/em falta' : 'Mostrando todos'); };
    $('#p-scan').onclick = () => scan(buscarPorCodigo);
    $('#fab-add').onclick = () => abrirCadastro();

    // cadastro
    $('#c-foto').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { setFoto(await reduzirImagem(f)); } catch { toast('Imagem inválida'); }
      e.target.value = '';
    });
    $('#c-save').onclick = salvarProduto;
    $('#c-del').onclick = excluirProduto;

    // entrada/saída
    $('#m-seg').addEventListener('click', (e) => { const b = e.target.closest('[data-sub]'); if (b) { state.mov.sub = b.dataset.sub; renderMov(); } });
    $('#m-itens').addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) { state.mov.itens.splice(+b.dataset.rm, 1); renderMov(); } });
    $('#m-add').onclick = () => state.produtos.length ? abrirSheet() : toast('Cadastre um produto primeiro');
    $('#m-save').onclick = salvarMov;
    $('#sheet-close').onclick = fecharSheet;
    $('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') fecharSheet(); const p = e.target.closest('[data-pick]'); if (p) sheetQtd(+p.dataset.pick); });

    // movimentações
    $('#mv-entrada').onclick = () => abrirMov('entrada');
    $('#mv-saida').onclick = () => abrirMov('saida');
    $('#mv-chips').addEventListener('click', (e) => { const c = e.target.closest('[data-mvf]'); if (c) { state.mvFiltro = c.dataset.mvf; renderMovs(); } });

    // outros
    $('#e-save').onclick = salvarEmpresa;
    $('#lc-copy').onclick = copiarCompras;
    $('#cfg-export').onclick = exportar;
    $('#cfg-import').onclick = () => $('#cfg-file').click();
    $('#cfg-file').addEventListener('change', (e) => { if (e.target.files[0]) importar(e.target.files[0]); e.target.value = ''; });
    $('#cfg-demo').onclick = carregarExemplos;
    $('#cfg-clear').onclick = async () => {
      if (!confirm('Apagar TODOS os dados? Esta ação não pode ser desfeita.')) return;
      await DB.limpar(); await carregar(); toast('Dados apagados'); go('inicio');
    };
    $('#scan-close').onclick = stopScan;
  }

  /* ---------- init ---------- */
  async function init() {
    hydrate();
    $('#c-cat').innerHTML = '<option value="" disabled selected>Selecione a categoria</option>' + CATEGORIAS.map(c => `<option>${c}</option>`).join('');
    $('#c-un').innerHTML = '<option value="" disabled selected>Selecione a unidade</option>' + UNIDADES.map(u => `<option>${u}</option>`).join('');
    try {
      await DB.abrir();
      await carregar();
    } catch (e) {
      console.error(e);
      toast('Erro ao abrir o banco de dados');
    }
    bind();
    go('inicio');
  }
  init();
})();
