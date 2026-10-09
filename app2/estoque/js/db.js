/* ==========================================================
   db.js — Banco de dados local (IndexedDB)
   Stores:
     produtos       {id, nome, codigo, categoria, unidade, estoqueMin,
                     custo, venda, foto, estoque}
     movimentacoes  {id, tipo:'entrada'|'saida', sub, data, obs,
                     itens:[{produtoId, nome, unidade, qtd}], criadoEm}
     config         {chave, valor}
   ========================================================== */
const DB = (() => {
  const NAME = 'estoque-db';
  const VERSION = 1;
  let db = null;

  function abrir() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('produtos')) {
          const s = d.createObjectStore('produtos', { keyPath: 'id', autoIncrement: true });
          s.createIndex('codigo', 'codigo', { unique: false });
        }
        if (!d.objectStoreNames.contains('movimentacoes')) {
          d.createObjectStore('movimentacoes', { keyPath: 'id', autoIncrement: true });
        }
        if (!d.objectStoreNames.contains('config')) {
          d.createObjectStore('config', { keyPath: 'chave' });
        }
      };
      req.onsuccess = () => { db = req.result; resolve(db); };
      req.onerror = () => reject(req.error);
    });
  }

  // executa uma operação simples em um store
  function op(store, modo, fn) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, modo);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => resolve(req ? req.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  /* ---------- produtos ---------- */
  const todosProdutos = () => op('produtos', 'readonly', s => s.getAll());
  const salvarProduto = (p) => op('produtos', 'readwrite', s => s.put(p));
  const excluirProduto = (id) => op('produtos', 'readwrite', s => s.delete(id));

  /* ---------- movimentações ---------- */
  const todasMovs = () => op('movimentacoes', 'readonly', s => s.getAll());

  // grava a movimentação e atualiza o saldo dos produtos na MESMA transação
  function registrarMovimentacao(mov) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(['produtos', 'movimentacoes'], 'readwrite');
      const ps = t.objectStore('produtos');
      const ms = t.objectStore('movimentacoes');
      const sinal = mov.tipo === 'entrada' ? 1 : -1;
      let erro = null;

      mov.itens.forEach(it => {
        const g = ps.get(it.produtoId);
        g.onsuccess = () => {
          const p = g.result;
          if (!p) return;
          const novo = Math.round(((p.estoque || 0) + sinal * it.qtd) * 1000) / 1000;
          if (novo < 0) { erro = `Estoque insuficiente de "${p.nome}"`; t.abort(); return; }
          p.estoque = novo;
          ps.put(p);
        };
      });
      ms.add(mov);

      t.oncomplete = () => resolve();
      t.onabort = () => reject(new Error(erro || 'Falha ao salvar movimentação'));
    });
  }

  /* ---------- config ---------- */
  const getConfig = async (chave) => (await op('config', 'readonly', s => s.get(chave)))?.valor;
  const setConfig = (chave, valor) => op('config', 'readwrite', s => s.put({ chave, valor }));

  /* ---------- backup ---------- */
  async function exportar() {
    return {
      versao: VERSION,
      geradoEm: new Date().toISOString(),
      produtos: await todosProdutos(),
      movimentacoes: await todasMovs(),
      config: await op('config', 'readonly', s => s.getAll()),
    };
  }

  function limpar() {
    return new Promise((resolve, reject) => {
      const t = db.transaction(['produtos', 'movimentacoes', 'config'], 'readwrite');
      ['produtos', 'movimentacoes', 'config'].forEach(n => t.objectStore(n).clear());
      t.oncomplete = resolve; t.onerror = () => reject(t.error);
    });
  }

  async function importar(dados) {
    if (!dados || !Array.isArray(dados.produtos)) throw new Error('Arquivo de backup inválido');
    await limpar();
    return new Promise((resolve, reject) => {
      const t = db.transaction(['produtos', 'movimentacoes', 'config'], 'readwrite');
      dados.produtos.forEach(p => t.objectStore('produtos').put(p));
      (dados.movimentacoes || []).forEach(m => t.objectStore('movimentacoes').put(m));
      (dados.config || []).forEach(c => t.objectStore('config').put(c));
      t.oncomplete = resolve; t.onerror = () => reject(t.error);
    });
  }

  return {
    abrir, todosProdutos, salvarProduto, excluirProduto,
    todasMovs, registrarMovimentacao,
    getConfig, setConfig, exportar, importar, limpar,
  };
})();
