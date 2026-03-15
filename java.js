// =======================================================
// Ebó - App (CLEAN v2 - compatível com modal antigo e novo)
// =======================================================



const COLLECTION = "listas";
const USERS_COLLECTION = "users";
const MASTERS = ["taina", "tata"];


let editingDocId = null;

const $ = (id) => document.getElementById(id);

function extenso(n) {
  const m = {
    1: "um", 2: "dois", 3: "três", 4: "quatro", 5: "cinco",
    6: "seis", 7: "sete", 8: "oito", 9: "nove", 10: "dez",
    11: "onze", 12: "doze", 13: "treze", 14: "quatorze", 15: "quinze",
    16: "dezesseis", 17: "dezessete", 18: "dezoito", 19: "dezenove", 20: "vinte"
  };
  return m[n] || String(n);
}


// ============================
// Firebase bridge
// ============================
function fb() {
  if (!window.__FIREBASE__) throw new Error("Firebase não inicializado. Confira firebaseConfig no index.html.");
  return window.__FIREBASE__;
}

// Normalização LEGACY (para buscar em registros antigos já salvos)
function normalizarTextoLegacy(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

// Normalização FORTE (para comparar/consolidar SEM diferenciar hífen, acento, etc.)
function normalizarTexto(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")        // remove acentos
    .replace(/[^a-z0-9]+/g, " ")           // troca TUDO que não é letra/número por espaço (hífen, underscore, etc.)
    .replace(/\s+/g, " ")                  // colapsa espaços duplicados
    .trim();
}

// Palavras que não contam para diferenciar ingrediente (ruído)
const STOPWORDS_ING = new Set([
  "de", "do", "da", "dos", "das",
  "bola", "bolas",
  "po", "pó",
  "porta", "portas" // (se aparecerem nos seus dados)
]);

function singularizarBasico(token) {
  // regra simples: remove "s" final (plural) em palavras maiores
  if (!token) return token;
  if (token.length <= 3) return token;
  if (token.endsWith("s")) return token.slice(0, -1);
  return token;
}

// Normalização FORTE (já deixa letras minúsculas, sem acento, sem pontuação)
function normalizarForte(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Gera a "chave" do ingrediente para comparar e somar.
 * - ignora acento / maiúscula / hífen / pontuação
 * - remove stopwords (bola, de, do...)
 * - singulariza básico (acacas -> acaca)
 * - regra 1ª + 3ª palavra (se existir) para reduzir variações do meio
 */
function chaveIngrediente(ingrediente) {
  const base = normalizarForte(ingrediente);
  if (!base) return "";

  let tokens = base
    .split(" ")
    .map(t => singularizarBasico(t))
    .filter(t => t && !STOPWORDS_ING.has(t));

  if (!tokens.length) return "";

  // ✅ SUA REGRA: usa 1ª e 3ª palavra quando existir
  if (tokens.length >= 3) {
    return `${tokens[0]} ${tokens[2]}`;
  }

  // caso tenha 2 palavras, mantém as 2
  if (tokens.length === 2) {
    return `${tokens[0]} ${tokens[1]}`;
  }

  // caso tenha 1 palavra, usa ela
  return tokens[0];
}



// UI legacy: se o HTML ainda chamar renderizarListas(), redireciona para procurarListas
window.renderizarListas = function renderizarListas(){
  try { return window.procurarListas?.(true); } catch { /* no-op */ }
};

function formatarDataBR(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : null;
    return d ? d.toLocaleString("pt-BR") : "—";
  } catch {
    return "—";
  }
}

function setFirebaseStatus(ok, msg) {
  const el = $("firebaseStatus");
  if (!el) return;
  el.textContent = msg;
  el.style.background = ok ? "#e8f5e9" : "#ffebee";
  el.style.color = ok ? "#1b5e20" : "#b71c1c";
}

// ============================
// AUTH helpers
// ============================
function usernameToEmail(username) {
  const u = (username || "").trim().toLowerCase();
  const safe = u.replace(/\s+/g, "").replace(/[^a-z0-9._-]/g, "");
  return safe ? `${safe}@app.local` : "";
}
function emailToUsername(email) {
  return (email || "").toLowerCase().replace("@app.local", "");
}

function setAuthMsg(msg, isError = false) {
  const el = $("authMsg");
  if (!el) return;
  el.textContent = msg || "";
  el.style.color = isError ? "#b71c1c" : "#1b5e20";
}

function showApp(isLogged) {
  const authCard = $("authCard");
  const postLogin = $("postLogin");
  if (authCard) authCard.style.display = isLogged ? "none" : "block";
  if (postLogin) postLogin.style.display = isLogged ? "block" : "none";
}

function setUserBadge(text) {
  const el = $("userBadge");
  if (el) el.textContent = text || "—";
}

function showAdminPanel(isMaster) {
  const panel = $("adminPanel");
  if (panel) panel.style.display = isMaster ? "block" : "none";
}

function getLoginInputs() {
  return {
    user: ($("authUser")?.value || "").trim(),
    senha: ($("authSenha")?.value || "").trim(),
  };
}

function getNewUserInputs() {
  return {
    user: ($("newUser")?.value || "").trim(),
    senha: ($("newPass")?.value || "").trim(),
  };
}

// ============================
// LOGIN / CRIAR CONTA
// ============================
window.entrar = async function entrar() {
  try {
    const { auth, signInWithEmailAndPassword } = fb();
    const { user, senha } = getLoginInputs();
    const email = usernameToEmail(user);
    if (!email || !senha) return setAuthMsg("Digite usuário e senha.", true);

    await signInWithEmailAndPassword(auth, email, senha);
    setAuthMsg("Logado com sucesso.");
  } catch (e) {
    console.error(e);
    setAuthMsg(`Falha no login: ${e?.code || e?.message || "erro"}`, true);
  }
};

window.criarConta = async function criarConta() {
  try {
    const { auth, createUserWithEmailAndPassword } = fb();
    const { user, senha } = getLoginInputs();
    const email = usernameToEmail(user);
    if (!email || !senha) return setAuthMsg("Digite usuário e senha.", true);

    await createUserWithEmailAndPassword(auth, email, senha);
    setAuthMsg("Conta criada e logada.");
  } catch (e) {
    console.error(e);
    setAuthMsg(`Erro ao criar conta: ${e?.code || e?.message || "erro"}`, true);
  }
};

window.sair = async function sair() {
  try {
    pararControleInatividade();

    const { auth, signOut } = fb();
    await signOut(auth);
        limparSaidaPrint();
    try { limparSaidaPrintListaCadastrada(); } catch {}


    setAuthMsg("Você saiu.");
  } catch (e) {
    console.error(e);
    setAuthMsg(`Erro ao sair: ${e?.code || e?.message || "erro"}`, true);
  }
};

// ============================
// ADMIN: cadastrar master/cliente
// ============================
async function marcarRoleNoFirestore(uid, username, role) {
  const { db, doc, setDoc, serverTimestamp } = fb();
  await setDoc(
    doc(db, USERS_COLLECTION, uid),
    {
      username: username || "",
      username_norm: normalizarTexto(username || ""),
      role,
      blocked: false,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

async function relogarMaster(masterUsername) {
  const masterPass = prompt(`Digite a senha do master "${masterUsername}" para voltar a logar:`);
  if (!masterPass) return;
  const { auth, signInWithEmailAndPassword } = fb();
  await signInWithEmailAndPassword(auth, usernameToEmail(masterUsername), masterPass);
}

async function criarUsuarioComRole(role) {
  const { auth, createUserWithEmailAndPassword, signOut } = fb();
  const masterUsername = emailToUsername(auth.currentUser?.email || "");
  if (!MASTERS.includes(masterUsername)) return alert("Apenas Master pode cadastrar usuários.");

  const { user: newUser, senha: newPass } = getNewUserInputs();
  const newEmail = usernameToEmail(newUser);
  if (!newEmail || !newPass) return alert("Preencha novo usuário e senha inicial.");

  try {
    const cred = await createUserWithEmailAndPassword(auth, newEmail, newPass);
    await marcarRoleNoFirestore(cred.user.uid, newUser, role);
    alert(`${role === "master" ? "Master" : "Cliente"} cadastrado com sucesso!`);

    await signOut(auth);
    await relogarMaster(masterUsername);

    if ($("newUser")) $("newUser").value = "";
    if ($("newPass")) $("newPass").value = "";
  } catch (e) {
    console.error(e);
    alert(`Erro ao cadastrar usuário: ${e?.code || e?.message || "erro"}`);
  }
}

window.cadastrarMaster = async () => criarUsuarioComRole("master");
window.cadastrarCliente = async () => criarUsuarioComRole("client");

// Admin extra (botões existem no HTML)
window.listarContas = async function listarContas() {
  const box = $("accountsBox");
  if (!box) return;

  const { db, collection, getDocs, query, orderBy, limit } = fb();
  box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Carregando...</div></div></div>`;

  try {
    const q = query(collection(db, USERS_COLLECTION), orderBy("updatedAt", "desc"), limit(200));
    const snaps = await getDocs(q);
    const items = [];
    snaps.forEach((s) => items.push({ id: s.id, ...s.data() }));

    if (!items.length) {
      box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Nenhuma conta encontrada.</div></div></div>`;
      return;
    }

    box.innerHTML = items
      .map((u) => {
        const role = u.role || "—";
        const blocked = u.blocked ? "✅ Bloqueado" : "Ativo";
        const user = u.username || u.username_norm || u.id;
        return `
          <div class="saved-item">
            <div>
              <div class="saved-title">${user}</div>
              <div class="saved-meta">Role: ${role} • Status: ${blocked}</div>
            </div>
          </div>
        `;
      })
      .join("");
  } catch (e) {
    console.error(e);
    box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Erro ao listar contas</div><div class="saved-meta">Veja o console (F12).</div></div></div>`;
  }
};

window.adminRenomearLogin = function adminRenomearLogin() {
  alert("Renomear login (Firebase Auth) exige Cloud Function. Posso te passar essa parte se você quiser.");
};
window.adminTrocarSenha = function adminTrocarSenha() {
  alert("Trocar senha (Firebase Auth) exige Cloud Function. Posso te passar essa parte se você quiser.");
};
window.adminBloquearUsuario = async function adminBloquearUsuario() {
  const user = ($("manageUser")?.value || "").trim().toLowerCase();
  if (!user) return alert("Digite o usuário (atual).");

  const { db, doc, setDoc, serverTimestamp } = fb();
  try {
    await setDoc(
      doc(db, USERS_COLLECTION, user),
      { username: user, username_norm: normalizarTexto(user), blocked: true, updatedAt: serverTimestamp() },
      { merge: true }
    );
    alert("Usuário bloqueado (Firestore).");
    await window.listarContas?.();
  } catch (e) {
    console.error(e);
    alert("Erro ao bloquear. Veja o console (F12).");
  }
};

// =======================================================
// 1) GERADOR: somente PRATOS (sem bolas / tipos)
// - Seleciona o ebó (nome) e multiplica as quantidades cadastradas
//   pelo número de pratos informado.
// =======================================================

let __listaCache = null;
let __autoTimer = null;

function parseQuantidadeComUnidade(raw) {
  // Suporta:
  // - "7"
  // - "7,5"
  // - "1/2"
  // - "2 kg" / "0,5 litro" / "3 un"
  const s = (raw ?? "").toString().trim();
  if (!s) return { ok: false, value: null, unit: "" };

  // fraction a/b
  const frac = s.match(/^\s*(\d+)\s*\/\s*(\d+)\s*(.*)$/);
  if (frac) {
    const a = parseFloat(frac[1]);
    const b = parseFloat(frac[2]);
    const unit = (frac[3] || "").trim();
    if (b !== 0) return { ok: true, value: a / b, unit };
    return { ok: false, value: null, unit };
  }

  // leading number (comma or dot) + optional unit
  const m = s.match(/^\s*([0-9]+(?:[.,][0-9]+)?)\s*(.*)$/);
  if (!m) return { ok: false, value: null, unit: "" };

  const num = parseFloat(m[1].replace(",", "."));
  const unit = (m[2] || "").trim();
  if (!Number.isFinite(num)) return { ok: false, value: null, unit: "" };
  return { ok: true, value: num, unit };
}

function formatNumero(n) {
  // evita 7.000000
  const v = Math.round((n + Number.EPSILON) * 1000) / 1000;
  // remove .0
  return (v % 1 === 0) ? String(Math.trunc(v)) : String(v).replace(".", ",");
}

function resetarQuantidadePessoasPara1() {
  const input = document.getElementById("numPratos");
  if (input) input.value = "1";
  setTimeout(() => {
    const i = document.getElementById("numPratos");
    if (i) i.value = "1";
  }, 0);
}


function getGeradorEstado() {
  const eboNome = ($("eboNome")?.value || "").trim();
  const pratos = parseInt($("numPratos")?.value || "0", 10);
  return { eboNome, pratos: Number.isFinite(pratos) ? pratos : 0 };
}

// Busca lista salva pelo nome (match exato em nome_norm ou nome2_norm; senão pega o primeiro resultado)
async function buscarListaPorNomeOuNome2(eboNome) {
  const { db, collection, getDocs, query, orderBy, startAt, endAt, limit } = fb();

  const termoForte = normalizarTexto(eboNome);
  const termoLegacy = normalizarTextoLegacy(eboNome);

  if (!termoForte && !termoLegacy) return null;

  // Helper: tenta query em um campo com um termo
  async function tentarQueryPorCampo(campo, termo) {
    if (!termo) return [];
    try {
      const q = query(
        collection(db, COLLECTION),
        orderBy(campo, "asc"),
        startAt(termo),
        endAt(termo + "\uf8ff"),
        limit(20)
      );
      const snap = await getDocs(q);
      const arr = [];
      snap.forEach((s) => arr.push({ id: s.id, ...s.data() }));
      return arr;
    } catch (e) {
      console.warn(`Busca por ${campo} falhou`, e);
      return [];
    }
  }

  // 1) tenta com normalização FORTE
  let candidatos = [
    ...(await tentarQueryPorCampo("nome_norm", termoForte)),
    ...(await tentarQueryPorCampo("nome2_norm", termoForte)),
  ];

  // 2) fallback: tenta com LEGACY (para docs antigos)
  if (!candidatos.length) {
    candidatos = [
      ...(await tentarQueryPorCampo("nome_norm", termoLegacy)),
      ...(await tentarQueryPorCampo("nome2_norm", termoLegacy)),
    ];
  }

  if (!candidatos.length) return null;

  // Filtra por match exato usando normalização FORTE (ignora acento, hífen, etc.)
  const alvo = termoForte || normalizarTexto(eboNome);

  // prioridade: match exato no nome, depois no nome2, senão retorna o primeiro
  let exatoNome = candidatos.find(d => normalizarTexto(d.nome || "") === alvo);
  if (exatoNome) return { __match: "nome", ...exatoNome };

  let exatoNome2 = candidatos.find(d => normalizarTexto(d.nome2 || "") === alvo);
  if (exatoNome2) return { __match: "nome2", ...exatoNome2 };

  return { __match: "aprox", ...candidatos[0] };
}


// Auto-carrega (só pra validar rapidamente se existe lista com esse nome)
window.autoCarregarListaDebounced = function autoCarregarListaDebounced() {
  clearTimeout(__autoTimer);
  __autoTimer = setTimeout(async () => {
    const nome = ($("eboNome")?.value || "").trim();
    if (!nome) { __listaCache = null; return; }
    try {
      __listaCache = await buscarListaPorNomeOuNome2(nome);
    } catch {
      __listaCache = null;
    }
  }, 450);
};

function consolidarIngredientes(itens) {
  const mapa = {};

  itens.forEach((it) => {
    const nome = (it.ingrediente || "").trim();
    if (!nome) return;

    const chave = chaveIngrediente(nome);

    const qtdRaw = (it.quantidade || "").trim();
    const parsed = parseQuantidadeComUnidade(qtdRaw);

    if (!mapa[chave]) {
      mapa[chave] = {
        ingrediente: nome,
        valores: [],
        unidades: [],
        texto: []
      };
    }

    if (parsed.ok) {
      mapa[chave].valores.push(parsed.value);
      mapa[chave].unidades.push(parsed.unit || "");
    } else if (qtdRaw) {
      mapa[chave].texto.push(qtdRaw);
    }
  });

  return Object.values(mapa);
}
  // =============================
// DETECTAR "QUALIDADES DE PADÊ"
// =============================
function detectarQualidadesPade(nome) {
  if (!nome) return 1;

  const txt = nome.toLowerCase();

  const match = txt.match(/(\d+)\s*qualidades?\s*de\s*pad[eê]s?/);

  if (match) {
    return parseInt(match[1], 10);
  }

  return 1;
}

window.gerarLista = async function gerarLista() {
  const { eboNome, pratos } = getGeradorEstado();

  if (!eboNome) { alert("Informe o nome do ebó."); return; }
  if (!pratos || pratos < 1) { alert("Informe a quantidade de pratos."); return; }

  let docLista = __listaCache;
 
  // ✅ CORREÇÃO PRINCIPAL: declarar itens1 e itens2
  const itens1 = Array.isArray(docLista.itens) ? docLista.itens : [];
  const itens2 = Array.isArray(docLista.itens2) ? docLista.itens2 : [];

  // Junta lista 1 + lista 2
  const itensBrutos = [...itens1, ...itens2];

// 🔥 Detecta número de qualidades de padê
const multiplicadorPade = detectarQualidadesPade(docLista.nome);

// Ajusta quantidades automaticamente
const itensAjustados = itensBrutos.map(it => {
  let qtd = (it.quantidade || "").toString().trim();

  // se não tiver quantidade escrita
  if (!qtd) {
    return {
      ...it,
      quantidade: String(multiplicadorPade)
    };
  }

  const num = parseFloat(qtd.replace(",", "."));

  if (!isNaN(num)) {
    return {
      ...it,
      quantidade: String(num * multiplicadorPade)
    };
  }

  return it;
});
  const itensConsolidados = consolidarIngredientes(itensBrutos);

if (!itensConsolidados.length) {
  alert("Essa lista não possui ingredientes cadastrados.");
  throw new Error("Lista sem ingredientes");
}

  // Geração da impressão
  //if ($("saidaPrint")) $("saidaPrint").style.display = "block";//
  if ($("printEboNome")) $("printEboNome").textContent = eboNome;
  if ($("printTotalPratos")) {
    $("printTotalPratos").textContent = `${pratos} prato${pratos > 1 ? "s" : ""}`;
  }
const tbody = $("printIngredientes");
if (!tbody) return;
tbody.innerHTML = "";
itensConsolidados.forEach((item) => {
  let totalTxt = "";
  if (item.valores.length) {
    const unidadeBase = item.unidades[0];
    const unidadesIguais = item.unidades.every(u => u === unidadeBase);
    if (unidadesIguais) {
      const soma = item.valores.reduce((a, b) => a + b, 0);
      const total = soma * pratos;
      totalTxt = `${formatNumero(total)}${unidadeBase ? " " + unidadeBase : ""}`;
    }
  }

  if (!totalTxt) {
    totalTxt = item.texto.length
      ? item.texto.join(" + ") + ` x ${pratos}`
      : `x ${pratos}`;
  }

const tr = document.createElement("tr");

// TOTAL primeiro
const tdQtd = document.createElement("td");
tdQtd.className = "print-total";

// INGREDIENTE no meio
const tdIng = document.createElement("td");
tdIng.className = "print-ing";
tdIng.textContent = item.ingrediente;

// 3ª coluna (pratos)
const tdPratos = document.createElement("td");
tdPratos.className = "print-pratos";
tdPratos.textContent = "";

const pratosBase =
  window.__listasAcumuladas &&
  window.__listasAcumuladas[0]
    ? window.__listasAcumuladas[0].pratos
    : null;

let exibiuDetalhe = false;

if (pratosBase && typeof totalTxt === "string") {
  const partes = totalTxt.split(" ");
  const num = parseFloat(partes[0].replace(",", "."));
  const unidade = partes.slice(1).join(" ");

  if (!isNaN(num) && num % pratosBase === 0) {
    const porPrato = num / pratosBase;
    tdQtd.textContent =
      formatNumero(num) +
      (unidade ? " " + unidade : "") +
      "  |  " +
      pratosBase +
      " pratos × " +
      formatNumero(porPrato);
    exibiuDetalhe = true;
  }
}

if (!exibiuDetalhe) {
  tdQtd.textContent = totalTxt;
}

tr.appendChild(tdQtd);
tr.appendChild(tdIng);
tr.appendChild(tdPratos);
tbody.appendChild(tr);


  });

  $("saidaPrint")?.scrollIntoView?.({ behavior: "smooth" });

  // 🔄 sempre voltar Quantidade de Pessoas para 1
  resetarQuantidadePessoasPara1();

};


// =======================================================
// 2) MODAL (compatível)
// - Modal Antigo: modalNomeEbo + modalBodyLinhas
// - Modal Novo: modalNomeEbo_1/_2 + modalBodyLinhas_1/_2 + modos
// =======================================================
function modalIsNovo() {
  return !!$("modalNomeEbo_1");
}
function modalIsAntigo() {
  return !!$("modalNomeEbo") && !!$("modalBodyLinhas");
}

function modalLimparLinhas(listId = "old") {
  const tbody = listId === "old" ? $("modalBodyLinhas") : document.getElementById(`modalBodyLinhas_${listId}`);
  if (tbody) tbody.innerHTML = "";
}

function modalCriarLinha(listId = "old", ingrediente = "", quantidade = "") {
  const tbody = listId === "old" ? $("modalBodyLinhas") : document.getElementById(`modalBodyLinhas_${listId}`);
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="modalIng" type="text" placeholder="Ex: Pipoca" value="${String(ingrediente).replace(/"/g, "&quot;")}" /></td>
    <td><input class="modalQtd" type="text" placeholder="Ex: 7" value="${String(quantidade).replace(/"/g, "&quot;")}" /></td>
    <td><button class="btn-danger btn-mini" type="button">Remover</button></td>
  `;
  tr.querySelector("button").onclick = () => tr.remove();
  tbody.appendChild(tr);
}

// HTML antigo chama modalAdicionarLinha() sem args
// HTML novo chama modalAdicionarLinha('1') e modalAdicionarLinha('2')
window.modalAdicionarLinha = function modalAdicionarLinha(listId) {
  if (modalIsNovo()) {
    const id = String(listId || "1"); // se vier vazio, adiciona na lista 1
    modalCriarLinha(id, "", "");
    return;
  }
  // fallback modal antigo
  modalCriarLinha("old", "", "");
};

function getLinhas(listId = "old") {
  const selector = listId === "old" ? "#modalBodyLinhas tr" : `#modalBodyLinhas_${listId} tr`;
  const linhas = [];
  document.querySelectorAll(selector).forEach((tr) => {
    const ing = (tr.querySelector(".modalIng")?.value || "").trim();
    const qtd = (tr.querySelector(".modalQtd")?.value || "").trim();

    // Salva a linha se houver QUALQUER conteúdo.
    // (Antes só salvava quando ingrediente E quantidade estavam preenchidos,
    // o que fazia algumas linhas "sumirem" do banco.)
    if (ing || qtd) linhas.push({ ingrediente: ing, quantidade: qtd });
  });
  return linhas;
}
function modalGetPayloadCompat() {
  if (modalIsNovo()) {
    const nome1 = ($("modalNomeEbo_1")?.value || "").trim();
    const subtitulo1 = ($("modalSubtitulo_1")?.value || "").trim();
    const modo1 = ($("modalModoFazer_1")?.value || "").trim();
    const itens1 = getLinhas("1");

    // Lista 2 NÃO TEM nome
    const subtitulo2 = ($("modalSubtitulo_2")?.value || "").trim();
    const modo2 = ($("modalModoFazer_2")?.value || "").trim();
    const itens2 = getLinhas("2");

    return {
      tipo: "novo",
      lista1: { nome: nome1, subtitulo: subtitulo1, modo: modo1, itens: itens1 },
      lista2: { subtitulo: subtitulo2, modo: modo2, itens: itens2 }
    };
  }

  const nome = ($("modalNomeEbo")?.value || "").trim();
  const itens = getLinhas("old");
  return { tipo: "antigo", nome, itens };
}


window.fecharModal = function fecharModal() {
  $("modalBackdrop") && ($("modalBackdrop").style.display = "none");
};

function abrirModal() {
  $("modalBackdrop") && ($("modalBackdrop").style.display = "flex");
}

window.cadastrarLista = function cadastrarLista() {
  editingDocId = null;

  const titulo = $("modalTitulo");
  if (titulo) titulo.textContent = "Cadastrar lista";

  if (modalIsNovo()) {
    if ($("modalNomeEbo_1")) $("modalNomeEbo_1").value = "";
    if ($("modalModoFazer_1")) $("modalModoFazer_1").value = "";
    if ($("modalNomeEbo_2")) $("modalNomeEbo_2").value = "";
    if ($("modalModoFazer_2")) $("modalModoFazer_2").value = "";
    if ($("modalSubtitulo_1")) $("modalSubtitulo_1").value = "";
    if ($("modalSubtitulo_2")) $("modalSubtitulo_2").value = "";


    modalLimparLinhas("1");
    modalLimparLinhas("2");
    modalCriarLinha("1", "", "");
    modalCriarLinha("2", "", "");
  } else {
    if ($("modalNomeEbo")) $("modalNomeEbo").value = "";
    modalLimparLinhas("old");
    modalCriarLinha("old", "", "");
  }

  abrirModal();
};

// =======================================================
// 3) GERENCIAR LISTAS: procurar / editar / excluir
// =======================================================
window.procurarListas = async function procurarListas(silent = false) {
  const box = $("listasSalvasBox");
  if (!box) return;

  const { db, collection, getDocs, query, orderBy, startAt, endAt, limit } = fb();

  const termo = normalizarTexto($("pesquisaListas")?.value || "");
  const ordenacao = "recent"; // ordenação removida da UI


  if (!silent) box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Carregando...</div></div></div>`;

  try {
    let q;

    if (termo) {
      // busca por nome
      q = query(
        collection(db, COLLECTION),
        orderBy("nome_norm", "asc"),
        startAt(termo),
        endAt(termo + "\uf8ff"),
        limit(50)
      );
    } else {
      // padrão: mais recentes (updatedAt)
      q = query(collection(db, COLLECTION), orderBy("updatedAt", "desc"), limit(50));
    }

    const snaps = await getDocs(q);
    const items = [];
    snaps.forEach((s) => items.push({ id: s.id, ...s.data() }));

    if (!items.length) {
      box.innerHTML = `
        <div class="saved-item">
          <div>
            <div class="saved-title">Nenhuma lista encontrada.</div>
            <div class="saved-meta">Tente outro nome.</div>
          </div>
        </div>`;
      setFirebaseStatus(true, "Firebase: conectado");
      try { window.procurarListas?.(true); } catch {}

      return;
    }

    box.innerHTML = items
      .map((item) => {
        const created = formatarDataBR(item.createdAt);
        const updated = formatarDataBR(item.updatedAt);
        const n = Array.isArray(item.itens) ? item.itens.length : 0;

        return `
          <div class="saved-item">
            <div>
              <div class="saved-title">${item.nome || "(sem nome)"}</div>
              <div class="saved-meta">Itens: ${n} • Criada: ${created} • Atualizada: ${updated}</div>
            </div>
            <div class="saved-actions-row">
              <button class="btn-mini btn-print" onclick="imprimirListaCadastrada('${item.id}')">Imprimir</button>
              <button class="btn-mini btn-mini-open" onclick="editarLista('${item.id}')">Editar</button>
              <button class="btn-mini btn-mini-del" onclick="excluirLista('${item.id}')">Excluir</button>
            </div>
          </div>
        `;
      })
      .join("");

    setFirebaseStatus(true, "Firebase: conectado");
  } catch (e) {
    console.error(e);
    setFirebaseStatus(false, "Firebase: erro");
    box.innerHTML = `
      <div class="saved-item">
        <div>
          <div class="saved-title">Erro ao carregar do Firebase</div>
          <div class="saved-meta">Abra o console (F12) e veja o erro.</div>
        </div>
      </div>`;
  }
};

window.editarLista = async function editarLista(docId) {
  const { db, doc, getDoc } = fb();

  try {
    const snap = await getDoc(doc(db, COLLECTION, docId));
    if (!snap.exists()) return alert("Lista não encontrada.");

    const data = snap.data();
    editingDocId = docId;

    const titulo = $("modalTitulo");
    if (titulo) titulo.textContent = "Editar lista";

    if (modalIsNovo()) {
      // Lista 1
      if ($("modalNomeEbo_1")) $("modalNomeEbo_1").value = data.nome || "";
      if ($("modalModoFazer_1")) $("modalModoFazer_1").value = data.modo || "";
      if ($("modalSubtitulo_1")) $("modalSubtitulo_1").value = data.subtitulo || "";

      modalLimparLinhas("1");
      const itens1 = Array.isArray(data.itens) ? data.itens : [];
      if (itens1.length) itens1.forEach((it) => modalCriarLinha("1", it.ingrediente || "", it.quantidade || ""));
      else modalCriarLinha("1", "", "");

      // Lista 2
      
      if ($("modalModoFazer_2")) $("modalModoFazer_2").value = data.modo2 || "";
      if ($("modalSubtitulo_2")) $("modalSubtitulo_2").value = data.subtitulo2 || "";

      modalLimparLinhas("2");
      const itens2 = Array.isArray(data.itens2) ? data.itens2 : [];
      if (itens2.length) itens2.forEach((it) => modalCriarLinha("2", it.ingrediente || "", it.quantidade || ""));
      else modalCriarLinha("2", "", "");
    } else {
      // modal antigo
      if ($("modalNomeEbo")) $("modalNomeEbo").value = data.nome || "";
      modalLimparLinhas("old");
      const itens = Array.isArray(data.itens) ? data.itens : [];
      if (itens.length) itens.forEach((it) => modalCriarLinha("old", it.ingrediente || "", it.quantidade || ""));
      else modalCriarLinha("old", "", "");
    }

    abrirModal();
  } catch (e) {
    console.error(e);
    alert("Erro ao editar. Veja o console (F12).");
  }
};

window.excluirLista = async function excluirLista(docId) {
  const ok = confirm("Tem certeza que deseja excluir essa lista?");
  if (!ok) return;

  const { db, doc, deleteDoc } = fb();
  try {
    await deleteDoc(doc(db, COLLECTION, docId));
    if (editingDocId === docId) editingDocId = null;
    await window.procurarListas(true);
  } catch (e) {
    console.error(e);
    alert("Erro ao excluir. Veja o console (F12).");
  }
};

// =======================================================
// 4) ENVIAR PARA BANCO (Firestore) - compatível
// =======================================================
window.__enviarBancoComAlerta = async function () {
  try {
    const payloadModal = modalGetPayloadCompat();

    const { db, collection, addDoc, doc, setDoc, serverTimestamp } = fb();

    let payload;

    if (payloadModal.tipo === "novo") {
      const { lista1, lista2 } = payloadModal;

      if (!lista1.nome) return alert("Erro: digite o nome do ebó (Lista 1).");
      if (!lista1.itens || !lista1.itens.some(i => (i.ingrediente || "").trim())) 
        return alert("Erro: adicione ao menos 1 ingrediente na Lista 1.");

     payload = {
  nome: lista1.nome,
  nome_norm: normalizarTexto(lista1.nome),
  subtitulo: lista1.subtitulo || "",
  modo: lista1.modo || "",
  itens: lista1.itens,

  // Lista 2 NÃO tem nome
  nome2: "",
  nome2_norm: "",
  subtitulo2: lista2.subtitulo || "",
  modo2: lista2.modo || "",
  itens2: lista2.itens || [],

  updatedAt: serverTimestamp(),
};


      
    } else {
      // antigo
      const nome = payloadModal.nome;
      const itens = payloadModal.itens;

      if (!nome) return alert("Erro: digite o nome do ebó.");
      if (!itens || !itens.some(i => (i.ingrediente || "").trim())) return alert("Erro: adicione ao menos 1 ingrediente.");

      payload = {
        nome,
        nome_norm: normalizarTexto(nome),
        itens,
        updatedAt: serverTimestamp(),
      };
    }

    if (editingDocId) {
      await setDoc(doc(db, COLLECTION, editingDocId), payload, { merge: true });
      alert("✅ Lista atualizada com sucesso!");
    } else {
      payload.createdAt = serverTimestamp();
      const ref = await addDoc(collection(db, COLLECTION), payload);
      editingDocId = ref.id;
      alert("✅ Lista enviada com sucesso!");
    }

    await window.procurarListas(true);
    window.fecharModal();
  } catch (e) {
    console.error(e);
    alert(`❌ Erro ao enviar: ${e?.code || e?.message || "erro desconhecido"}`);
  }
};

// Aliases usados no HTML
window.enviarParaBanco = window.__enviarBancoComAlerta;
window.enviarListaParaBanco = window.__enviarBancoComAlerta;
window.enviarListaParaBancoDeDados = window.__enviarBancoComAlerta;
window.__listasAcumuladas = [];

// Render das listas adicionadas na UI
// 🔹 Renderiza somente o resumo das listas adicionadas, sem detalhes da lista final
function renderizarListasAcumuladas() {
  const box = document.getElementById("listasContainer");
  if (!box) return;

  if (!window.__listasAcumuladas.length) {
    box.innerHTML = `
      <div class="saved-item">
        <div>
          <div class="saved-title">Nenhuma lista adicionada.</div>
          <div class="saved-meta">Use "Adicionar lista" para ir acumulando.</div>
        </div>
      </div>
    `;
    return;
  }

  // Mostra apenas resumo: nome do ebó, pratos e quantidade de itens
  box.innerHTML = window.__listasAcumuladas
    .map((l, idx) => {
      const nItens = Array.isArray(l.itens) ? l.itens.length : 0;
      return `
        <div class="saved-item">
          <div>
            <div class="saved-title">${l.nome}</div>
            <div class="saved-meta">Pratos: ${l.pratos} • Itens: ${nItens}</div>
          </div>
          <div class="saved-actions-row">
            <button class="btn-mini btn-mini-del" onclick="removerListaAcumulada(${idx})">Remover</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function limparPreviewListaGerada() {
  const container = document.getElementById("listaGeradaContainer");
  if (!container) return;

  container.innerHTML = `
    <div class="saved-item">
      <div>
        <div class="saved-title">Nenhuma lista gerada.</div>
        <div class="saved-meta">Adicione uma lista para montar a prévia automática.</div>
      </div>
    </div>
  `;
}

function removerListaAcumulada(idx) {
  __listasAcumuladas.splice(idx, 1);
  renderizarListasAcumuladas();

  if (window.__listasAcumuladas.length) {
    window.gerarListaFinalAcumulada();
  } else {
    limparPreviewListaGerada();
    limparSaidaPrint();
  }
}
window.limparListasAcumuladas = function limparListasAcumuladas() {
  window.__listasAcumuladas = [];
  renderizarListasAcumuladas();
  limparPreviewListaGerada();
  limparSaidaPrint();
  window.scrollTo({ top: 0, behavior: "instant" });
};

function limparSaidaPrint() {
  const saida = document.getElementById("saidaPrint");
  const tbody = document.getElementById("printIngredientes");
  if (tbody) tbody.innerHTML = "";
  if (saida) saida.style.display = "none";
}


// Consolida ingredientes dentro de UMA lista (evita contar item repetido mais de 1 vez)
function consolidarItensDaLista(itens) {
  const mapa = {};

  (Array.isArray(itens) ? itens : []).forEach((it) => {
    const ing = (it?.ingrediente || "").trim();
    if (!ing) return;

    const chave = chaveIngrediente(ing);

    const qtdRaw = (it?.quantidade || "").toString().trim();
    const parsed = parseQuantidadeComUnidade(qtdRaw);

    if (!mapa[chave]) {
      mapa[chave] = {
        ingrediente: ing,
        valores: [],
        unidades: [],
        textos: []
      };
    }

    if (parsed.ok) {
      mapa[chave].valores.push(parsed.value);
      mapa[chave].unidades.push(parsed.unit || "");
    } else if (qtdRaw) {
      // evita repetir o mesmo texto muitas vezes
      const tKey = normalizarTexto(qtdRaw);
      if (!mapa[chave].textos.some(t => normalizarTexto(t) === tKey)) {
        mapa[chave].textos.push(qtdRaw);
      }
    }
  });

  // volta para o formato {ingrediente, quantidade}
  return Object.values(mapa).map((g) => {
    // se todas unidades forem iguais, somamos o número
    if (g.valores.length) {
      const base = g.unidades[0] || "";
      const iguais = g.unidades.every(u => u === base);
      if (iguais) {
        const soma = g.valores.reduce((a, b) => a + b, 0);
        const qtd = `${formatNumero(soma)}${base ? " " + base : ""}`;
        return { ingrediente: g.ingrediente, quantidade: qtd };
      }
    }

    // fallback para textos
    if (g.textos.length) return { ingrediente: g.ingrediente, quantidade: g.textos.join(" + ") };
    return { ingrediente: g.ingrediente, quantidade: "" };
  });
}
window.abrirTelaAdmin = function () {
  const app = document.getElementById("postLogin");
  const admin = document.getElementById("adminScreen");
  const oferendas = document.getElementById("oferendasScreen");

  if (app) app.style.display = "none";
  if (oferendas) oferendas.style.display = "none";
  if (admin) admin.style.display = "block";

  window.scrollTo({ top: 0, behavior: "instant" });
};




// =======================================================
// INIT
// =======================================================
document.addEventListener("DOMContentLoaded", () => {
  limparPreviewListaGerada();

  const btnEntrar = document.getElementById("btnEntrar");
if (btnEntrar) btnEntrar.addEventListener("click", () => window.entrar());

const btnCriar = document.getElementById("btnCriarConta");
if (btnCriar) btnCriar.addEventListener("click", () => window.criarConta());


const { auth, onAuthStateChanged } = fb();

onAuthStateChanged(auth, (user) => {
  if (user) {
    const username = emailToUsername(user.email);
    showApp(true);
    showAdminPanel(MASTERS.includes(username));
    const btnAdmin = document.getElementById("btnAdmin");
if (btnAdmin) {
  btnAdmin.style.display = MASTERS.includes(username) ? "inline-block" : "none";
}

    setAuthMsg(`Logado como: ${username}`);
    setUserBadge(`Logado como: ${username}`);
    setFirebaseStatus(true, "Firebase: conectado");
    procurarListas(); //se nao quiser que a lista cadastrada apareça , so comentar essa linha, só vai aparecer quando apertar o botão procurar 
     iniciarControleInatividade(); // 🔥 aqui

    

  } else {
    showApp(false);
    showAdminPanel(false);
    setFirebaseStatus(false, "Firebase: não conectado");
    setAuthMsg("Faça login para acessar.");
    setUserBadge("—");
  }
});


  // inicializa a área de "Listas adicionadas"
  renderizarListasAcumuladas();
});

// Imprimir lista Gerada
window.imprimirListaGerada = function imprimirListaGerada() {
  const area = document.getElementById("saidaPrint");
  let tbody = document.getElementById("printIngredientes");

  // Se ainda não montou a área de impressão, tenta gerar automaticamente
  if ((!tbody || !tbody.children.length) && window.__listasAcumuladas?.length) {
    try {
      window.gerarListaFinalAcumulada();
      tbody = document.getElementById("printIngredientes");
    } catch (e) {
      console.error(e);
    }
  }

  if (!window.__listasAcumuladas || !window.__listasAcumuladas.length) {
    alert("Adicione a lista primeiro para imprimir.");
    return;
  }

  if (!area || !tbody || !tbody.children.length) {
    alert("Não consegui montar a impressão automaticamente. Clique em 'Adicionar lista' novamente.");
    return;
  }

  try { limparSaidaPrintListaCadastrada(); } catch {}

  const displayAnterior = area.style.display;
  area.style.display = "block";

  let mq = null;
  let onChange = null;
  let cleaned = false;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;

    area.style.display = displayAnterior || "none";
    window.removeEventListener("afterprint", cleanup);

    try {
      if (mq) {
        if (mq.removeEventListener) mq.removeEventListener("change", onChange);
        else if (mq.removeListener) mq.removeListener(onChange);
      }
    } catch {}
  };

  window.addEventListener("afterprint", cleanup);

  try {
    mq = window.matchMedia("print");
    onChange = (e) => {
      if (!e.matches) cleanup();
    };

    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  } catch {}

  window.print();
};

// =======================================================
// 🔹 IMPRIMIR LISTA CADASTRADA (SIMPLES)
// - quantidade à esquerda
// - ingrediente centralizado
// - sem logo / sem grades (CSS em @media print com body.print-lista-cadastrada)
// =======================================================

function limparSaidaPrintListaCadastrada() {
  document.body.classList.remove("print-lista-cadastrada");

  const area = document.getElementById("saidaPrintListaCadastrada");
  const tbody = document.getElementById("printListaCadastradaIngredientes");

  if (tbody) tbody.innerHTML = "";
  if (area) area.style.display = "none";
}

window.imprimirListaCadastrada = async function imprimirListaCadastrada(docId) {
  if (!docId) {
    alert("ID da lista não informado.");
    return;
  }

  const area = document.getElementById("saidaPrintListaCadastrada");
  const titulo = document.getElementById("printListaCadastradaNome");
  const tbody = document.getElementById("printListaCadastradaIngredientes");

  if (!area || !titulo || !tbody) {
    alert("Área de impressão simples não encontrada no HTML. Confira se existe #saidaPrintListaCadastrada.");
    return;
  }

  // sempre limpa antes
  limparSaidaPrintListaCadastrada();

  let mq = null;
  let onChange = null;

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;

    limparSaidaPrintListaCadastrada();

    window.removeEventListener("afterprint", cleanup);

    try {
      if (mq) {
        if (mq.removeEventListener) mq.removeEventListener("change", onChange);
        else if (mq.removeListener) mq.removeListener(onChange);
      }
    } catch {
      // no-op
    }
  };

  try {
    const { db, doc, getDoc } = fb();
    const snap = await getDoc(doc(db, COLLECTION, String(docId)));

    if (!snap.exists()) {
      alert("Lista não encontrada.");
      return;
    }

    const data = snap.data() || {};

    titulo.textContent = data.nome || "(sem nome)";

    const itens1 = Array.isArray(data.itens) ? data.itens : [];
    const itens2 = Array.isArray(data.itens2) ? data.itens2 : [];

    // Lista 1 + Lista 2 (sem multiplicar)
    const itens = [...itens1, ...itens2].filter((it) => {
      const ing = (it?.ingrediente || "").trim();
      const qtd = (it?.quantidade || "").toString().trim();
      return ing || qtd;
    });

    tbody.innerHTML = "";

    if (!itens.length) {
      const tr = document.createElement("tr");
const tdTotal = document.createElement("td");
tdTotal.className = "print-total";
tdTotal.textContent = (it?.quantidade || "").toString().trim() || "—";

const tdIng = document.createElement("td");
tdIng.className = "print-ing";
tdIng.textContent = (it?.ingrediente || "").trim();

//const tdPratos = document.createElement("td");//
//tdPratos.className = "print-pratos";//
//tdPratos.textContent = "—";//

tr.appendChild(tdTotal);
tr.appendChild(tdIng);

    } else {
      itens.forEach((it) => {
        const tr = document.createElement("tr");

        // Quantidade (esquerda)
        const tdQtd = document.createElement("td");
        tdQtd.className = "print-total";
        tdQtd.textContent = (it?.quantidade || "").toString().trim() || "—";

        // Ingrediente (meio)
        const tdIng = document.createElement("td");
        tdIng.className = "print-ing";
        tdIng.textContent = (it?.ingrediente || "").trim();

        tr.appendChild(tdQtd);
        tr.appendChild(tdIng);
        tbody.appendChild(tr);
      });
    }

    area.style.display = "block";
    document.body.classList.add("print-lista-cadastrada");

    // cleanup robusto (afterprint + matchMedia)
    window.addEventListener("afterprint", cleanup);

    try {
      mq = window.matchMedia("print");
      onChange = (e) => {
        if (!e.matches) cleanup();
      };

      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    } catch {
      // no-op
    }

    window.print();
  } catch (e) {
    console.error(e);
    alert("Erro ao imprimir lista cadastrada. Veja o console (F12).");
    cleanup();
  }
};



function extrairInfoQualidadesPade(ingrediente, quantidade = "") {
  const ing = (ingrediente || "").toString().trim();
  const qtd = (quantidade || "").toString().trim();

  const reHeader = /(\d+(?:[.,]\d+)?)\s*qualidades?\s*de\s*pad[eê]s?\b/i;
  const temMarcador = reHeader.test(ing) || /qualidades?\s*de\s*pad[eê]s?\b/i.test(ing) || /qualidades?\s*de\s*pad[eê]s?\b/i.test(qtd);

  if (!temMarcador) return null;

  let totalBase = null;
  let detalhes = "";

  const matchHeader = ing.match(reHeader);
  if (matchHeader) {
    totalBase = parseFloat((matchHeader[1] || "").replace(",", "."));
    detalhes = ing.slice((matchHeader.index || 0) + matchHeader[0].length).trim();
  } else {
    const parsedQtd = parseQuantidadeComUnidade(qtd);
    if (parsedQtd.ok) totalBase = parsedQtd.value;
    detalhes = ing.replace(/qualidades?\s*de\s*pad[eê]s?\b/i, "").trim();
  }

  const itens = [];
  const extras = [];

  const partes = detalhes
    .split(/[,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  partes.forEach((parte) => {
    const p = parte.replace(/^[-–—:]+/, "").trim();
    if (!p) return;

    const m = p.match(/^(\d+(?:[.,]\d+)?)\s*[-–—x×:]?\s*(.+)$/i);
    if (m) {
      const qtdItem = parseFloat((m[1] || "").replace(",", "."));
      const nomeItem = (m[2] || "").trim();
      if (nomeItem) itens.push({ nome: nomeItem, quantidade: Number.isFinite(qtdItem) ? qtdItem : 0 });
      return;
    }

    if (!extras.some((x) => normalizarTexto(x) === normalizarTexto(p))) {
      extras.push(p);
    }
  });

  if (!itens.length && detalhes) {
    const reItensInline = /(\d+(?:[.,]\d+)?)\s*[-–—x×:]?\s*([a-zà-ÿ0-9][^,;\n]+?)(?=(?:\s+\d+(?:[.,]\d+)?\s*[-–—x×:]?\s*[a-zà-ÿ0-9])|$)/gi;
    const itensInline = [];
    let m;
    while ((m = reItensInline.exec(detalhes)) !== null) {
      const qtdItem = parseFloat((m[1] || "").replace(",", "."));
      const nomeItem = (m[2] || "").trim();
      if (nomeItem) itensInline.push({ nome: nomeItem, quantidade: Number.isFinite(qtdItem) ? qtdItem : 0 });
    }

    if (itensInline.length) {
      itensInline.forEach((it) => itens.push(it));
      extras.length = 0;
    }
  }

  if ((!Number.isFinite(totalBase) || totalBase === null) && itens.length) {
    totalBase = itens.reduce((acc, it) => acc + (Number(it.quantidade) || 0), 0);
  }

  const nomesChave = itens.map((it) => normalizarTexto(it.nome)).filter(Boolean).join("|");
  const extrasChave = extras.map((it) => normalizarTexto(it)).filter(Boolean).join("|");
  const totalChave = Number.isFinite(totalBase) ? String(totalBase) : "0";

  return {
    key: `pade|global`,
    totalBase: Number.isFinite(totalBase) ? totalBase : 0,
    itens,
    extras,
    ingredienteBase: "Padezinhos",
  };
}

function formatarDetalhesQualidadesPade(agregado) {
  const partes = [];

  (agregado.itensOrdem || []).forEach((nomeKey) => {
    const it = agregado.itensMap[nomeKey];
    if (!it) return;
    partes.push(`${formatNumero(it.quantidade)}- ${it.nome}`);
  });

  (agregado.extrasOrdem || []).forEach((extraKey) => {
    const valor = agregado.extrasMap[extraKey];
    if (valor) partes.push(valor);
  });

  return partes.length ? partes.join(", ") : "—";
}

function montarTextoPratosLista(item) {
  let textoPratos = item?.pratosTxt || "—";
  const ingrediente = (item?.ingrediente || "").toLowerCase();

  const qtd = parseInt(item?.totalTxt, 10) || 1;

  if (ingrediente.includes("morim")) {
    textoPratos = `${qtd} morim preto, vermelho e branco`;
  } else if (ingrediente.includes("casal de bruxo")) {
    textoPratos = `${qtd} casal de bruxo`;
  }

  if (ingrediente.includes("morim")) {
    textoPratos = textoPratos
      .replace(/pratos/g, "morim")
      .replace(/prato/g, "morim");
  }

  return textoPratos || "—";
}


window.gerarListaFinalAcumulada = function () {
  try {
    if (!window.__listasAcumuladas || !window.__listasAcumuladas.length) {
      limparPreviewListaGerada();
      limparSaidaPrint();
      return;
    }

    const itensExpandidos = [];
    window.__listasAcumuladas.forEach((lista) => {
      (lista.itens || []).forEach((item) => {
        itensExpandidos.push({
          ingrediente: item.ingrediente,
          quantidade: item.quantidade,
          __pratos: Number(lista.pratos) || 0,
        });
      });
    });
    

    const consolidados = {};
    const consolidadosPade = {};
    let ordemAtual = 0;

    itensExpandidos.forEach((it) => {
      const ing = (it?.ingrediente || "").trim();
      if (!ing) return;

      const multiplicador = Number(it.__pratos) || 0;
      const infoPade = extrairInfoQualidadesPade(ing, it.quantidade);

      if (infoPade) {
        const chavePade = infoPade.key;

        if (!consolidadosPade[chavePade]) {
          consolidadosPade[chavePade] = {
            tipo: "pade",
            ordem: ordemAtual++,
            ingrediente: infoPade.ingredienteBase,
            total: 0,
            itensMap: {},
            itensOrdem: [],
            extrasMap: {},
            extrasOrdem: [],
          };
        }

        const grupo = consolidadosPade[chavePade];
        const totalBase = Number(infoPade.totalBase) || 0;
        grupo.total += totalBase * multiplicador;

        (infoPade.itens || []).forEach((parte) => {
          const nomeOriginal = (parte?.nome || "").trim();
          if (!nomeOriginal) return;

          const nomeKey = normalizarTexto(nomeOriginal);
          if (!grupo.itensMap[nomeKey]) {
            grupo.itensMap[nomeKey] = { nome: nomeOriginal, quantidade: 0 };
            grupo.itensOrdem.push(nomeKey);
          }

          grupo.itensMap[nomeKey].quantidade += (Number(parte.quantidade) || 0) * multiplicador;
        });

        (infoPade.extras || []).forEach((extra) => {
          const extraTxt = (extra || "").trim();
          if (!extraTxt) return;

          const extraKey = normalizarTexto(extraTxt);
          if (!grupo.extrasMap[extraKey]) {
            grupo.extrasMap[extraKey] = extraTxt;
            grupo.extrasOrdem.push(extraKey);
          }
        });

        return;
      }

      const chave = chaveIngrediente(ing);

      if (!consolidados[chave]) {
        consolidados[chave] = {
          tipo: "normal",
          ordem: ordemAtual++,
          ingrediente: ing,
          valores: [],
          unidades: [],
          textos: [],
        };
      }

      const parsed = parseQuantidadeComUnidade(it.quantidade);

      if (parsed.ok) {
        consolidados[chave].valores.push(parsed.value * multiplicador);
        consolidados[chave].unidades.push(parsed.unit || "");
      } else if (it.quantidade) {
        const txt = `${it.quantidade} x ${multiplicador}`;
        if (!consolidados[chave].textos.some((t) => normalizarTexto(t) === normalizarTexto(txt))) {
          consolidados[chave].textos.push(txt);
        }
      }
    });

    const linhasNormais = Object.values(consolidados).map((item) => {
      let totalTxt = "";

      if (item.valores.length) {
        const base = item.unidades[0] || "";
        const iguais = item.unidades.every((u) => u === base);

        if (iguais) {
          const soma = item.valores.reduce((a, b) => a + b, 0);
          totalTxt = `${formatNumero(soma)}${base ? " " + base : ""}`;
        }
      }

      if (!totalTxt) {
        totalTxt = item.textos.length ? item.textos.join(" + ") : "—";
      }

      const chaveAtual = chaveIngrediente(item.ingrediente);
      const contagemPorQtd = {};

      itensExpandidos.forEach((it) => {
        const ing = (it?.ingrediente || "").trim();
        if (!ing) return;
        if (extrairInfoQualidadesPade(ing, it.quantidade)) return;
        if (chaveIngrediente(ing) !== chaveAtual) return;

        const parsed = parseQuantidadeComUnidade(it.quantidade);
        if (!parsed.ok) return;

        const key = String(parsed.value).replace(".", ",");
        contagemPorQtd[key] = (contagemPorQtd[key] || 0) + (Number(it.__pratos) || 0);
      });

      const qtdKeys = Object.keys(contagemPorQtd)
        .map((k) => ({ k, n: parseFloat(k.replace(",", ".")) }))
        .filter((o) => Number.isFinite(o.n))
        .sort((a, b) => a.n - b.n)
        .map((o) => o.k);

      let pratosTxt = "—";
      if (qtdKeys.length) {
        const partes = qtdKeys.map((q) => {
          const qtdListas = contagemPorQtd[q];
          const rotulo = qtdListas === 1 ? "prato" : "pratos";
          return `${extenso(qtdListas)} ${rotulo} de ${q}`;
        });

        if (partes.length === 1) pratosTxt = partes[0];
        else if (partes.length === 2) pratosTxt = `${partes[0]} e ${partes[1]}`;
        else pratosTxt = `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
      }

      return {
        ordem: item.ordem,
        totalTxt,
        ingrediente: item.ingrediente,
        pratosTxt,
      };
    });

    const linhasPade = Object.values(consolidadosPade).map((item) => ({
      ordem: item.ordem,
      totalTxt: item.total ? formatNumero(item.total) : "—",
      ingrediente: item.ingrediente,
      pratosTxt: formatarDetalhesQualidadesPade(item),
    }));

    const linhas = [...linhasNormais, ...linhasPade].sort((a, b) => a.ordem - b.ordem);

    // 🔹 MOSTRAR LISTA NO CARD "Lista gerada" no mesmo visual da tabela final
    const container = document.getElementById("listaGeradaContainer");

    const linhasHtml = linhas.length
      ? linhas.map((item) => `
          <tr>
            <td class="print-total">${item.totalTxt}</td>
            <td class="print-ing">${item.ingrediente}</td>
            <td class="print-pratos">${montarTextoPratosLista(item)}</td>
          </tr>
        `).join("")
      : `
          <tr>
            <td class="print-total">—</td>
            <td class="print-ing">Nenhum item gerado.</td>
            <td class="print-pratos">—</td>
          </tr>
        `;

    if (container) {
      container.innerHTML = `
        <section class="preview-print-area">
          <div class="print-header">
            <img src="./imagem.png" alt="Ilê D'Ogum" class="print-logo">
            <h1 class="preview-print-title">Ilê D'Ogum</h1>
          </div>

          <table class="print-table">
            <thead>
              <tr>
                <th class="print-total">Total</th>
                <th class="print-ing">Ingrediente</th>
                <th class="print-pratos">Pratos</th>
              </tr>
            </thead>
            <tbody>${linhasHtml}</tbody>
          </table>
        </section>
      `;
    }

    // Mantém a tabela escondida, mas pronta para impressão

    const printNome = document.getElementById("printEboNome");
    if (printNome) printNome.textContent = "Ilê D'Ogum";

    const saida = document.getElementById("saidaPrint");
    const tbody = document.getElementById("printIngredientes");
    if (!tbody) {
      alert("Erro: não achei o tbody #printIngredientes no HTML.");
      return;
    }

    tbody.innerHTML = "";
    if (saida) saida.style.display = "none";

    linhas.forEach((item) => {
      const tr = document.createElement("tr");

      const tdTotal = document.createElement("td");
      tdTotal.className = "print-total";
      tdTotal.textContent = item.totalTxt;
      
      
      const tdIng = document.createElement("td");
      tdIng.className = "print-ing";
      tdIng.textContent = item.ingrediente;

const tdPratos = document.createElement("td");
tdPratos.className = "print-pratos";
tdPratos.textContent = montarTextoPratosLista(item);

      tr.appendChild(tdTotal);
      tr.appendChild(tdIng);
      tr.appendChild(tdPratos);
      tbody.appendChild(tr);
    });

    resetarQuantidadePessoasPara1();
    container?.scrollIntoView?.({ behavior: "smooth" });
  } catch (e) {
    console.error(e);
    alert("Erro ao gerar a lista. Abra o console (F12) para ver o detalhe.\\n\\n" + (e?.message || e));
  }
};



// =======================================================
// 🔹 LISTAS ACUMULADAS (APENAS ADIÇÃO – NÃO QUEBRA NADA)
// =======================================================

window.adicionarListaAcumulada = async function () {
  const eboNome = ($("eboNome")?.value || "").trim();
  const pratos = parseInt($("numPratos")?.value || "0", 10);

  if (!eboNome) {
    alert("Informe o nome do ebó.");
    return;
  }
  if (!pratos || pratos < 1) {
    alert("Informe a quantidade de pratos.");
    return;
  }

  let lista = null;
  try {
    lista = await buscarListaPorNomeOuNome2(eboNome);
  } catch (e) {
    console.error(e);
  }

  if (!lista) {
    alert("Lista não encontrada.");
    return;
  }

  const itens1 = Array.isArray(lista.itens) ? lista.itens : [];
  const itens2 = Array.isArray(lista.itens2) ? lista.itens2 : [];

  const itensConsolidados = consolidarItensDaLista([...itens1, ...itens2]);

  const chaveNova = `${normalizarTexto(eboNome)}|${pratos}`;
  const jaExiste = window.__listasAcumuladas.some(l => `${normalizarTexto(l.nome)}|${l.pratos}` === chaveNova);
  if (!jaExiste) {
    window.__listasAcumuladas.push({
      nome: eboNome,
      pratos,
      itens: itensConsolidados
    });
  }

  renderizarListasAcumuladas();
  resetarQuantidadePessoasPara1();

  // 🔹 NOVO: gera a lista final automaticamente
  window.gerarListaFinalAcumulada();

  // 🔄 limpa o input do ebó
  const inputEbo = document.getElementById("eboNome");
  if (inputEbo) {
    inputEbo.value = "";
    inputEbo.focus();
  }
};


// Força fundo branco no formulário "Gerar lista de ebó"
document.addEventListener("DOMContentLoaded", () => {
  const inputEbo = document.getElementById("eboNome");

  if (inputEbo) {
    const gerarListaCard = inputEbo.closest("section.card");

    if (gerarListaCard) {
      gerarListaCard.style.background = "#ffffff";
      gerarListaCard.style.border = "1px solid #e5e7eb";
      gerarListaCard.style.color = "#020617";

      // garante seleção de texto
      gerarListaCard.style.userSelect = "text";
    }
  }
});

// Inverte colunas da tabela de impressão (Qtd à esquerda, Ingrediente à direita)
function prepararTabelaParaPrint() {
  const tabela = document.querySelector("#saidaPrint table");
  if (!tabela) return;

  // Cabeçalho
  const ths = tabela.querySelectorAll("thead th");
  if (ths.length >= 2) {
    ths[0].parentNode.insertBefore(ths[1], ths[0]); // troca 2º com 1º
  }

  // Linhas do corpo
  tabela.querySelectorAll("tbody tr").forEach(tr => {
    const tds = tr.querySelectorAll("td");
    if (tds.length >= 2) {
      tr.insertBefore(tds[1], tds[0]); // troca 2º com 1º
    }
  });
}

// ======================================
// AUTO LOGOUT POR INATIVIDADE
// ======================================

let idleTimer = null;
const IDLE_TIMEOUT = 60 * 1000; // ⏱️ 60 segundos (ajuste aqui)

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);

  idleTimer = setTimeout(() => {
    console.log("Logout por inatividade");
    sair(); // usa sua função existente
    alert("Sessão encerrada por inatividade.");
  }, IDLE_TIMEOUT);
}

// eventos que contam como atividade
const IDLE_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click"
];

function iniciarControleInatividade() {
  IDLE_EVENTS.forEach(event =>
    document.addEventListener(event, resetIdleTimer, true)
  );

  resetIdleTimer(); // inicia contador
}

function pararControleInatividade() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;

  IDLE_EVENTS.forEach(event =>
    document.removeEventListener(event, resetIdleTimer, true)
  );
}


// ======================================
// TROCA DE TELAS (APP x ADMIN)
// ======================================

function abrirTelaAdmin() {
  const admin = document.getElementById("adminScreen");
  const app = document.getElementById("postLogin");

  if (admin) admin.style.display = "block";
  if (app) app.style.display = "none";
}



// ============================
// NOVA FUNÇÃO , OFERENDAS
// ============================
window.abrirTelaOferendas = function () {
  const app = document.getElementById("postLogin");
  const admin = document.getElementById("adminScreen");
  const banhos = document.getElementById("banhosScreen");
  const oferendas = document.getElementById("oferendasScreen");

  if (app) app.style.display = "none";
  if (admin) admin.style.display = "none";
  if (banhos) banhos.style.display = "none";

  if (oferendas) oferendas.style.display = "block";

  // 🔹 Renderizar todas as listas cadastradas ao abrir a tela
  renderizarOferendas();

  window.scrollTo({ top: 0, behavior: "instant" });
};
window.voltarTelaPrincipal = function () {
  const app = document.getElementById("postLogin");
  const admin = document.getElementById("adminScreen");
  const oferendas = document.getElementById("oferendasScreen");

  if (admin) admin.style.display = "none";
  if (oferendas) oferendas.style.display = "none";
  if (app) app.style.display = "block";

  window.scrollTo({ top: 0, behavior: "instant" });
};

//Isso elimina definitivamente o bug de foco preso
document.addEventListener("DOMContentLoaded", () => {
  const user = document.getElementById("authUser");
  const senha = document.getElementById("authSenha");

  if (user) {
    user.focus();
  }

  if (senha) {
    senha.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        entrar();
      }
    });
  }
});


// ============================
// FUNÇÃO POSITIVOS
// ============================

window.abrirTelaPositivos = function () {
  esconderTodasAsTelas(); // 🔹 esconde tudo

  const positivos = document.getElementById("positivosScreen");
  if (positivos) positivos.style.display = "block";

  renderizarPositivos();
  window.scrollTo({ top: 0, behavior: "instant" });
};

window.abrirTelaBanhos = function () {
  esconderTodasAsTelas(); // 🔹 esconde tudo

  const banhos = document.getElementById("banhosScreen");
  if (banhos) banhos.style.display = "block";

  renderizarBanhos();
  window.scrollTo({ top: 0, behavior: "instant" });
};

window.abrirTelaOferendas = function () {
  esconderTodasAsTelas(); // 🔹 esconde tudo

  const oferendas = document.getElementById("oferendasScreen");
  if (oferendas) oferendas.style.display = "block";

  renderizarOferendas();
  window.scrollTo({ top: 0, behavior: "instant" });
};

window.voltarTelaPrincipal = function () {
  esconderTodasAsTelas(); // 🔹 esconde tudo

  const app = document.getElementById("postLogin");
  if (app) app.style.display = "block";

  window.scrollTo({ top: 0, behavior: "instant" });
};
function limparFormularioPositivos() {
  const campos = [
    "modalNomeEbo_1Positivos",
    "modalSubtitulo_1Positivos",
    "modalModoFazer_1Positivos",
    "modalSubtitulo_2Positivos",
    "modalModoFazer_2Positivos",
    "modalMsgPositivos"
  ];

  campos.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if ("value" in el) el.value = "";
    else el.textContent = "";
  });

  modalLimparLinhasPositivos("1");
  modalLimparLinhasPositivos("2");
  modalCriarLinhaPositivos("1", "", "");
  window.editingDocIdPositivos = null;
}

window.abrirModalPositivos = function (modo = "novo") {
  if (modo !== "editar") limparFormularioPositivos();

  const modal = document.getElementById("modalBackdropPositivos");
  if (modal) modal.style.display = "flex";
};

window.fecharModalPositivos = function () {
  const modal = document.getElementById("modalBackdropPositivos");
  if (modal) modal.style.display = "none";
  limparFormularioPositivos();
};


// =======================================================
// MODAL POSITIVOS - FUNÇÕES
// =======================================================

function modalLimparLinhasPositivos(listId) {
  const tbody = document.getElementById(`modalBodyLinhas_${listId}Positivos`);
  if (tbody) tbody.innerHTML = "";
}

function modalCriarLinhaPositivos(listId = "1", ingrediente = "", quantidade = "") {
  const tbody = document.getElementById(`modalBodyLinhas_${listId}Positivos`);
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="modalIng" type="text" placeholder="Ex: Pipoca" value="${String(ingrediente).replace(/"/g, "&quot;")}" /></td>
    <td><input class="modalQtd" type="text" placeholder="Ex: 7" value="${String(quantidade).replace(/"/g, "&quot;")}" /></td>
    <td><button class="btn-danger btn-mini" type="button">Remover</button></td>
  `;
  tr.querySelector("button").onclick = () => tr.remove();
  tbody.appendChild(tr);
}

// Adicionar linha (chamado pelos botões +Adicionar linha do modal Positivos)
window.modalAdicionarLinhaPositivos = function(listId) {
  modalCriarLinhaPositivos(listId, "", "");
};

// Captura todas as linhas do modal Positivos
function getLinhasPositivos(listId) {
  const linhas = [];
  const selector = `#modalBodyLinhas_${listId}Positivos tr`;

  document.querySelectorAll(selector).forEach((tr) => {
    const ing = (tr.querySelector(".modalIng")?.value || "").trim();
    const qtd = (tr.querySelector(".modalQtd")?.value || "").trim();
    if (ing || qtd) linhas.push({ ingrediente: ing, quantidade: qtd });
  });

  return linhas;
}

// Prepara payload do modal Positivos
function modalGetPayloadPositivos() {
  const lista1 = {
    nome: ($("modalNomeEbo_1Positivos")?.value || "").trim(),
    subtitulo: ($("modalSubtitulo_1Positivos")?.value || "").trim(),
    modo: ($("modalModoFazer_1Positivos")?.value || "").trim(),
    itens: getLinhasPositivos("1")
  };

  const lista2 = {
    subtitulo: ($("modalSubtitulo_2Positivos")?.value || "").trim(),
    modo: ($("modalModoFazer_2Positivos")?.value || "").trim(),
    itens: getLinhasPositivos("2")
  };

  return { lista1, lista2 };
}

// Enviar Positivos para Firebase
window.enviarParaBancoPositivos = async function() {
  try {
    const payload = modalGetPayloadPositivos();
    const { db, collection, doc, setDoc, addDoc, serverTimestamp } = fb();

    if (!payload.lista1.nome) return alert("Digite o nome do Positivo (Lista 1).");
    if (!payload.lista1.itens || !payload.lista1.itens.some(i => (i.ingrediente || "").trim())) {
      return alert("Adicione ao menos 1 ingrediente na Lista 1.");
    }

    const docPayload = {
      nome: payload.lista1.nome,
      nome_norm: normalizarTexto(payload.lista1.nome),
      subtitulo: payload.lista1.subtitulo || "",
      modo: payload.lista1.modo || "",
      itens: payload.lista1.itens,

      nome2: "",
      nome2_norm: "",
      subtitulo2: payload.lista2.subtitulo || "",
      modo2: payload.lista2.modo || "",
      itens2: payload.lista2.itens || [],

      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    };

   if (window.editingDocIdPositivos) {
  await setDoc(doc(db, "positivos", window.editingDocIdPositivos), docPayload, { merge: true });
  window.editingDocIdPositivos = null;
} else {
  await addDoc(collection(db, "positivos"), docPayload);
}

// 🔹 Atualiza apenas o container de Positivos
renderizarPositivos();
fecharModalPositivos();

  } catch (e) {
    console.error(e);
    alert(`❌ Erro ao enviar: ${e?.code || e?.message || "erro desconhecido"}`);
  }
};

// =======================================================
// POSITIVOS - renderizar listas cadastradas
// =======================================================
window.renderizarPositivos = async function() {
  const box = $("positivosSalvosBox");
  if (!box) return;

  const { db, collection, getDocs, query, orderBy, limit } = fb();

  box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Carregando...</div></div></div>`;

  try {
    const q = query(collection(db, "positivos"), orderBy("updatedAt", "desc"), limit(50));
    const snaps = await getDocs(q);
    const items = [];
    snaps.forEach(s => items.push({ id: s.id, ...s.data() }));

    if (!items.length) {
      box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Nenhum positivo cadastrado.</div></div></div>`;
      return;
    }

    box.innerHTML = items.map((item) => {
      const nItens1 = Array.isArray(item.itens) ? item.itens.length : 0;
      const nItens2 = Array.isArray(item.itens2) ? item.itens2.length : 0;

      return `
        <div class="saved-item">
          <div>
            <div class="saved-title">${item.nome || "(sem nome)"}</div>
            <div class="saved-meta">Itens Lista 1: ${nItens1} • Itens Lista 2: ${nItens2}</div>
          </div>
          <div class="saved-actions-row">
         
            <button class="btn-mini btn-mini-open" onclick="editarPositivo('${item.id}')">Editar</button>
            <button class="btn-mini btn-mini-del" onclick="excluirPositivo('${item.id}')">Excluir</button>
             <button class="btn-mini btn-print" onclick="imprimirPositivo('${item.id}')">Imprimir</button>
            
          </div>
        </div>
      `;
    }).join("");

  } catch (e) {
    console.error(e);
    box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Erro ao carregar</div></div></div>`;
  }
};

// Editar positivo
window.editarPositivo = async function(docId) {
  const { db, doc, getDoc } = fb();

  try {
    const snap = await getDoc(doc(db, "positivos", docId));
    if (!snap.exists()) return alert("Positivo não encontrado.");
    const data = snap.data();

    // limpa e abre modal Positivos
    abrirModalPositivos("editar");

    // Lista 1
    if ($("modalNomeEbo_1Positivos")) $("modalNomeEbo_1Positivos").value = data.nome || "";
    if ($("modalSubtitulo_1Positivos")) $("modalSubtitulo_1Positivos").value = data.subtitulo || "";
    if ($("modalModoFazer_1Positivos")) $("modalModoFazer_1Positivos").value = data.modo || "";
    modalLimparLinhasPositivos("1");
    (data.itens || []).forEach(it => modalCriarLinhaPositivos("1", it.ingrediente || "", it.quantidade || ""));

    // Lista 2
    if ($("modalSubtitulo_2Positivos")) $("modalSubtitulo_2Positivos").value = data.subtitulo2 || "";
    if ($("modalModoFazer_2Positivos")) $("modalModoFazer_2Positivos").value = data.modo2 || "";
    modalLimparLinhasPositivos("2");
    (data.itens2 || []).forEach(it => modalCriarLinhaPositivos("2", it.ingrediente || "", it.quantidade || ""));

    // salva o id editando
    window.editingDocIdPositivos = docId;

  } catch (e) {
    console.error(e);
    alert("Erro ao editar positivo.");
  }
};

// Excluir positivo
window.excluirPositivo = async function(docId) {
  const ok = confirm("Tem certeza que deseja excluir este positivo?");
  if (!ok) return;

  const { db, doc, deleteDoc } = fb();

  try {
    await deleteDoc(doc(db, "positivos", docId));
    alert("Positivo excluído!");
    renderizarPositivos();
  } catch (e) {
    console.error(e);
    alert("Erro ao excluir positivo.");
  }
};

//imprimir positivo//

window.imprimirPositivo = async function(docId) {
  if (!docId) {
    alert("ID do positivo não informado.");
    return;
  }

  const area = document.getElementById("saidaPrintListaCadastrada");
  const titulo = document.getElementById("printListaCadastradaNome");
  const tbody = document.getElementById("printListaCadastradaIngredientes");

  if (!area || !titulo || !tbody) return alert("Área de impressão não encontrada.");

  // limpa antes
  tbody.innerHTML = "";

  try {
    const { db, doc, getDoc } = fb();
    const snap = await getDoc(doc(db, "positivos", docId));
    if (!snap.exists()) return alert("Positivo não encontrado.");
    const data = snap.data() || {};

    titulo.textContent = data.nome || "(sem nome)";

    const itens1 = Array.isArray(data.itens) ? data.itens : [];
    const itens2 = Array.isArray(data.itens2) ? data.itens2 : [];

    const itens = [...itens1, ...itens2].filter(it => (it.ingrediente || "").trim());

    if (!itens.length) {
      const tr = document.createElement("tr");
      const tdIng = document.createElement("td");
      tdIng.className = "print-ing";
      tdIng.colSpan = 2;
      tdIng.textContent = "Sem ingredientes cadastrados.";
      tr.appendChild(tdIng);
      tbody.appendChild(tr);
    } else {
      itens.forEach(it => {
        const tr = document.createElement("tr");

        const tdQtd = document.createElement("td");
        tdQtd.className = "print-total";
        tdQtd.textContent = (it.quantidade || "").trim() || "—";

        const tdIng = document.createElement("td");
        tdIng.className = "print-ing";
        tdIng.textContent = it.ingrediente || "—";

        tr.appendChild(tdQtd);
        tr.appendChild(tdIng);
        tbody.appendChild(tr);
      });
    }

    // mostra e imprime
    area.style.display = "block";
    document.body.classList.add("print-lista-cadastrada");
    window.print();

    // opcional: limpa após impressão
    area.style.display = "none";
    tbody.innerHTML = "";
    document.body.classList.remove("print-lista-cadastrada");

  } catch (e) {
    console.error(e);
    alert("Erro ao imprimir positivo. Veja o console.");
  }
};


function limparFormularioBanhos() {
  const campos = [
    "modalNomeBanho_1",
    "modalSubtituloBanho_1",
    "modalModoFazerBanho_1",
    "modalSubtituloBanho_2",
    "modalModoFazerBanho_2",
    "modalMsgBanhos"
  ];

  campos.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if ("value" in el) el.value = "";
    else el.textContent = "";
  });

  modalLimparLinhasBanhos("1");
  modalLimparLinhasBanhos("2");
  modalCriarLinhaBanhos("1", "", "");
  window.editingDocIdBanhos = null;
}

window.abrirModalBanhos = function(modo = "novo") {
  if (modo !== "editar") limparFormularioBanhos();

  const modal = document.getElementById("modalBackdropBanhos");
  if (modal) modal.style.display = "flex";
};

window.fecharModalBanhos = function() {
  const modal = document.getElementById("modalBackdropBanhos");
  if (modal) modal.style.display = "none";
  limparFormularioBanhos();
};

// Adicionar linhas
function modalLimparLinhasBanhos(listId) {
  const tbody = document.getElementById(`modalBodyLinhasBanhos_${listId}`);
  if (tbody) tbody.innerHTML = "";
}

function modalCriarLinhaBanhos(listId = "1", ingrediente = "", quantidade = "") {
  const tbody = document.getElementById(`modalBodyLinhasBanhos_${listId}`);
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="modalIng" type="text" placeholder="Ex: Pipoca" value="${ingrediente}" /></td>
    <td><input class="modalQtd" type="text" placeholder="Ex: 7" value="${quantidade}" /></td>
    <td><button class="btn-danger btn-mini" type="button">Remover</button></td>
  `;
  tr.querySelector("button").onclick = () => tr.remove();
  tbody.appendChild(tr);
}

window.modalAdicionarLinhaBanhos = function(listId) {
  modalCriarLinhaBanhos(listId, "", "");
};

// Captura linhas
function getLinhasBanhos(listId) {
  const linhas = [];
  const selector = `#modalBodyLinhasBanhos_${listId} tr`;
  document.querySelectorAll(selector).forEach(tr => {
    const ing = (tr.querySelector(".modalIng")?.value || "").trim();
    const qtd = (tr.querySelector(".modalQtd")?.value || "").trim();
    if (ing || qtd) linhas.push({ ingrediente: ing, quantidade: qtd });
  });
  return linhas;
}

// Payload
function modalGetPayloadBanhos() {
  const lista1 = {
    nome: ($("modalNomeBanho_1")?.value || "").trim(),
    subtitulo: ($("modalSubtituloBanho_1")?.value || "").trim(),
    modo: ($("modalModoFazerBanho_1")?.value || "").trim(),
    itens: getLinhasBanhos("1")
  };
  const lista2 = {
    subtitulo: ($("modalSubtituloBanho_2")?.value || "").trim(),
    modo: ($("modalModoFazerBanho_2")?.value || "").trim(),
    itens: getLinhasBanhos("2")
  };
  return { lista1, lista2 };
}

// Enviar para Firebase
window.enviarParaBancoBanhos = async function() {
  try {
    const payload = modalGetPayloadBanhos();
    const { db, collection, doc, setDoc, addDoc, serverTimestamp } = fb();

    if (!payload.lista1.nome) return alert("Digite o nome do Banho (Lista 1).");
    if (!payload.lista1.itens || !payload.lista1.itens.some(i => (i.ingrediente || "").trim())) {
      return alert("Adicione ao menos 1 ingrediente na Lista 1.");
    }

    const docPayload = {
      nome: payload.lista1.nome,
      nome_norm: normalizarTexto(payload.lista1.nome),
      subtitulo: payload.lista1.subtitulo || "",
      modo: payload.lista1.modo || "",
      itens: payload.lista1.itens,
      nome2: "",
      nome2_norm: "",
      subtitulo2: payload.lista2.subtitulo || "",
      modo2: payload.lista2.modo || "",
      itens2: payload.lista2.itens || [],
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    };

    if (window.editingDocIdBanhos) {
      await setDoc(doc(db, "banhos", window.editingDocIdBanhos), docPayload, { merge: true });
      window.editingDocIdBanhos = null;
      alert("✅ Banho atualizado com sucesso!");
    } else {
      await addDoc(collection(db, "banhos"), docPayload);
      alert("✅ Banho cadastrado com sucesso!");
    }

    renderizarBanhos();
    fecharModalBanhos();
  } catch (e) {
    console.error(e);
    alert(`❌ Erro ao enviar: ${e?.code || e?.message || "erro desconhecido"}`);
  }
};

// Renderizar listas
window.renderizarBanhos = async function() {
  const box = $("banhosSalvosBox");
  if (!box) return;

  const { db, collection, getDocs, query, orderBy, limit } = fb();

  box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Carregando...</div></div></div>`;

  try {
    const q = query(collection(db, "banhos"), orderBy("updatedAt", "desc"), limit(50));
    const snaps = await getDocs(q);
    const items = [];
    snaps.forEach(s => items.push({ id: s.id, ...s.data() }));

    if (!items.length) {
      box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Nenhum banho cadastrado.</div></div></div>`;
      return;
    }

    box.innerHTML = items.map(item => {
      const nItens1 = Array.isArray(item.itens) ? item.itens.length : 0;
      const nItens2 = Array.isArray(item.itens2) ? item.itens2.length : 0;
      return `
        <div class="saved-item">
          <div>
            <div class="saved-title">${item.nome || "(sem nome)"}</div>
            <div class="saved-meta">Itens Lista 1: ${nItens1} • Itens Lista 2: ${nItens2}</div>
          </div>
          <div class="saved-actions-row">
            <button class="btn-mini btn-mini-open" onclick="editarBanho('${item.id}')">Editar</button>
            <button class="btn-mini btn-mini-del" onclick="excluirBanho('${item.id}')">Excluir</button>
            <button class="btn-mini btn-print" onclick="imprimirBanho('${item.id}')">Imprimir</button>
          </div>
        </div>
      `;
    }).join("");

  } catch (e) {
    console.error(e);
    box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Erro ao carregar</div></div></div>`;
  }
};

// Editar
window.editarBanho = async function(docId) {
  const { db, doc, getDoc } = fb();
  try {
    const snap = await getDoc(doc(db, "banhos", docId));
    if (!snap.exists()) return alert("Banho não encontrado.");
    const data = snap.data();

    abrirModalBanhos("editar");

    if ($("modalNomeBanho_1")) $("modalNomeBanho_1").value = data.nome || "";
    if ($("modalSubtituloBanho_1")) $("modalSubtituloBanho_1").value = data.subtitulo || "";
    if ($("modalModoFazerBanho_1")) $("modalModoFazerBanho_1").value = data.modo || "";
    modalLimparLinhasBanhos("1");
    (data.itens || []).forEach(it => modalCriarLinhaBanhos("1", it.ingrediente || "", it.quantidade || ""));

    if ($("modalSubtituloBanho_2")) $("modalSubtituloBanho_2").value = data.subtitulo2 || "";
    if ($("modalModoFazerBanho_2")) $("modalModoFazerBanho_2").value = data.modo2 || "";
    modalLimparLinhasBanhos("2");
    (data.itens2 || []).forEach(it => modalCriarLinhaBanhos("2", it.ingrediente || "", it.quantidade || ""));

    window.editingDocIdBanhos = docId;
  } catch (e) {
    console.error(e);
    alert("Erro ao editar banho.");
  }
};

// Excluir
window.excluirBanho = async function(docId) {
  const ok = confirm("Tem certeza que deseja excluir este banho?");
  if (!ok) return;
  const { db, doc, deleteDoc } = fb();
  try {
    await deleteDoc(doc(db, "banhos", docId));
    alert("Banho excluído!");
    renderizarBanhos();
  } catch (e) {
    console.error(e);
    alert("Erro ao excluir banho.");
  }
};

// ============================
// ABRIR TELA BANHOS
// ============================
window.abrirTelaBanhos = function () {
  esconderTodasAsTelas(); // 🔹 agora esconde TUDO, inclusive lista do gerador

  const banhos = document.getElementById("banhosScreen");
  if (banhos) banhos.style.display = "block";

  renderizarBanhos();
  window.scrollTo({ top: 0, behavior: "instant" });
};

window.imprimirBanho = async function(docId) {
  if (!docId) {
    alert("ID do banho não informado.");
    return;
  }

  const area = document.getElementById("saidaPrintListaCadastrada");
  const titulo = document.getElementById("printListaCadastradaNome");
  const tbody = document.getElementById("printListaCadastradaIngredientes");

  if (!area || !titulo || !tbody) {
    alert("Área de impressão não encontrada.");
    return;
  }

  // limpa tabela antes
  tbody.innerHTML = "";

  try {
    const { db, doc, getDoc } = fb();
    const snap = await getDoc(doc(db, "banhos", docId));
    if (!snap.exists()) return alert("Banho não encontrado.");
    const data = snap.data() || {};

    titulo.textContent = data.nome || "(sem nome)";

    const itens1 = Array.isArray(data.itens) ? data.itens : [];
    const itens2 = Array.isArray(data.itens2) ? data.itens2 : [];
    const itens = [...itens1, ...itens2].filter(it => (it.ingrediente || "").trim());

    if (!itens.length) {
      const tr = document.createElement("tr");
      const tdIng = document.createElement("td");
      tdIng.className = "print-ing";
      tdIng.colSpan = 2;
      tdIng.textContent = "Sem ingredientes cadastrados.";
      tr.appendChild(tdIng);
      tbody.appendChild(tr);
    } else {
      itens.forEach(it => {
        const tr = document.createElement("tr");

        const tdQtd = document.createElement("td");
        tdQtd.className = "print-total";
        tdQtd.textContent = (it.quantidade || "").trim() || "—";

        const tdIng = document.createElement("td");
        tdIng.className = "print-ing";
        tdIng.textContent = it.ingrediente || "—";

        tr.appendChild(tdQtd);
        tr.appendChild(tdIng);
        tbody.appendChild(tr);
      });
    }

    // mostra e imprime
    area.style.display = "block";
    document.body.classList.add("print-lista-cadastrada");
    window.print();

    // opcional: limpa após impressão
    area.style.display = "none";
    tbody.innerHTML = "";
    document.body.classList.remove("print-lista-cadastrada");

  } catch (e) {
    console.error(e);
    alert("Erro ao imprimir banho. Veja o console (F12).");
  }
};

// OFERENDAS//
function limparFormularioOferendas() {
  const campos = [
    "modalNomeOferenda_1",
    "modalSubtituloOferenda_1",
    "modalModoFazerOferenda_1",
    "modalSubtituloOferenda_2",
    "modalModoFazerOferenda_2",
    "modalMsgOferendas"
  ];

  campos.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if ("value" in el) el.value = "";
    else el.textContent = "";
  });

  modalLimparLinhasOferendas("1");
  modalLimparLinhasOferendas("2");
  modalCriarLinhaOferendas("1", "", "");
  window.editingDocIdOferendas = null;
}

window.abrirModalOferendas = function(modo = "novo") {
  if (modo !== "editar") limparFormularioOferendas();

  const modal = document.getElementById("modalBackdropOferendas");
  if (modal) modal.style.display = "flex";
};

window.fecharModalOferendas = function() {
  const modal = document.getElementById("modalBackdropOferendas");
  if (modal) modal.style.display = "none";
  limparFormularioOferendas();
};

// Adicionar linhas
function modalLimparLinhasOferendas(listId) {
  const tbody = document.getElementById(`modalBodyLinhasOferendas_${listId}`);
  if (tbody) tbody.innerHTML = "";
}

function modalCriarLinhaOferendas(listId = "1", ingrediente = "", quantidade = "") {
  const tbody = document.getElementById(`modalBodyLinhasOferendas_${listId}`);
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="modalIng" type="text" placeholder="Ex: Pipoca" value="${ingrediente}" /></td>
    <td><input class="modalQtd" type="text" placeholder="Ex: 7" value="${quantidade}" /></td>
    <td><button class="btn-danger btn-mini" type="button">Remover</button></td>
  `;
  tr.querySelector("button").onclick = () => tr.remove();
  tbody.appendChild(tr);
}

window.modalAdicionarLinhaOferendas = function(listId) {
  modalCriarLinhaOferendas(listId, "", "");
};

function getLinhasOferendas(listId) {
  const linhas = [];
  const selector = `#modalBodyLinhasOferendas_${listId} tr`;
  document.querySelectorAll(selector).forEach(tr => {
    const ing = (tr.querySelector(".modalIng")?.value || "").trim();
    const qtd = (tr.querySelector(".modalQtd")?.value || "").trim();
    if (ing || qtd) linhas.push({ ingrediente: ing, quantidade: qtd });
  });
  return linhas;
}

function modalGetPayloadOferendas() {
  const lista1 = {
    nome: ($("modalNomeOferenda_1")?.value || "").trim(),
    subtitulo: ($("modalSubtituloOferenda_1")?.value || "").trim(),
    modo: ($("modalModoFazerOferenda_1")?.value || "").trim(),
    itens: getLinhasOferendas("1")
  };
  const lista2 = {
    subtitulo: ($("modalSubtituloOferenda_2")?.value || "").trim(),
    modo: ($("modalModoFazerOferenda_2")?.value || "").trim(),
    itens: getLinhasOferendas("2")
  };
  return { lista1, lista2 };
}

// Enviar para Firebase
window.enviarParaBancoOferendas = async function() {
  try {
    const payload = modalGetPayloadOferendas();
    const { db, collection, doc, setDoc, addDoc, serverTimestamp } = fb();

    if (!payload.lista1.nome) return alert("Digite o nome da Oferenda (Lista 1).");
    if (!payload.lista1.itens || !payload.lista1.itens.some(i => (i.ingrediente || "").trim())) {
      return alert("Adicione ao menos 1 ingrediente na Lista 1.");
    }

    const docPayload = {
      nome: payload.lista1.nome,
      nome_norm: normalizarTexto(payload.lista1.nome),
      subtitulo: payload.lista1.subtitulo || "",
      modo: payload.lista1.modo || "",
      itens: payload.lista1.itens,
      nome2: "",
      nome2_norm: "",
      subtitulo2: payload.lista2.subtitulo || "",
      modo2: payload.lista2.modo || "",
      itens2: payload.lista2.itens || [],
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    };

    if (window.editingDocIdOferendas) {
      await setDoc(doc(db, "oferendas", window.editingDocIdOferendas), docPayload, { merge: true });
      window.editingDocIdOferendas = null;
      alert("✅ Oferenda atualizada com sucesso!");
    } else {
      await addDoc(collection(db, "oferendas"), docPayload);
      alert("✅ Oferenda cadastrada com sucesso!");
    }

    renderizarOferendas();
    fecharModalOferendas();
  } catch (e) {
    console.error(e);
    alert(`❌ Erro ao enviar: ${e?.code || e?.message || "erro desconhecido"}`);
  }
};

// Renderizar listas cadastradas
window.renderizarOferendas = async function() {
  const box = $("oferendasSalvosBox");
  if (!box) return;

  const { db, collection, getDocs, query, orderBy, limit } = fb();

  box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Carregando...</div></div></div>`;

  try {
    const q = query(collection(db, "oferendas"), orderBy("updatedAt", "desc"), limit(50));
    const snaps = await getDocs(q);
    const items = [];
    snaps.forEach(s => items.push({ id: s.id, ...s.data() }));

    if (!items.length) {
      box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Nenhuma Oferenda cadastrada.</div></div></div>`;
      return;
    }

    box.innerHTML = items.map(item => {
      const nItens1 = Array.isArray(item.itens) ? item.itens.length : 0;
      const nItens2 = Array.isArray(item.itens2) ? item.itens2.length : 0;
      return `
        <div class="saved-item">
          <div>
            <div class="saved-title">${item.nome || "(sem nome)"}</div>
            <div class="saved-meta">Itens Lista 1: ${nItens1} • Itens Lista 2: ${nItens2}</div>
          </div>
          <div class="saved-actions-row">
            <button class="btn-mini btn-mini-open" onclick="editarOferenda('${item.id}')">Editar</button>
            <button class="btn-mini btn-mini-del" onclick="excluirOferenda('${item.id}')">Excluir</button>
            <button class="btn-mini btn-print" onclick="imprimirOferenda('${item.id}')">Imprimir</button>
          </div>
        </div>
      `;
    }).join("");

  } catch (e) {
    console.error(e);
    box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Erro ao carregar</div></div></div>`;
  }
};

// Editar Oferenda
window.editarOferenda = async function(docId) {
  const { db, doc, getDoc } = fb();
  try {
    const snap = await getDoc(doc(db, "oferendas", docId));
    if (!snap.exists()) return alert("Oferenda não encontrada.");
    const data = snap.data();

    abrirModalOferendas("editar");

    if ($("modalNomeOferenda_1")) $("modalNomeOferenda_1").value = data.nome || "";
    if ($("modalSubtituloOferenda_1")) $("modalSubtituloOferenda_1").value = data.subtitulo || "";
    if ($("modalModoFazerOferenda_1")) $("modalModoFazerOferenda_1").value = data.modo || "";
    modalLimparLinhasOferendas("1");
    (data.itens || []).forEach(it => modalCriarLinhaOferendas("1", it.ingrediente || "", it.quantidade || ""));

    if ($("modalSubtituloOferenda_2")) $("modalSubtituloOferenda_2").value = data.subtitulo2 || "";
    if ($("modalModoFazerOferenda_2")) $("modalModoFazerOferenda_2").value = data.modo2 || "";
    modalLimparLinhasOferendas("2");
    (data.itens2 || []).forEach(it => modalCriarLinhaOferendas("2", it.ingrediente || "", it.quantidade || ""));

    window.editingDocIdOferendas = docId;
  } catch (e) {
    console.error(e);
    alert("Erro ao editar oferenda.");
  }
};

// Excluir Oferenda
window.excluirOferenda = async function(docId) {
  const ok = confirm("Tem certeza que deseja excluir esta oferenda?");
  if (!ok) return;
  const { db, doc, deleteDoc } = fb();
  try {
    await deleteDoc(doc(db, "oferendas", docId));
    alert("Oferenda excluída!");
    renderizarOferendas();
  } catch (e) {
    console.error(e);
    alert("Erro ao excluir oferenda.");
  }
};

// Imprimir Oferenda
window.imprimirOferenda = async function(docId) {
  const area = document.getElementById("saidaPrintListaCadastrada");
  const titulo = document.getElementById("printListaCadastradaNome");
  const tbody = document.getElementById("printListaCadastradaIngredientes");

  if (!area || !titulo || !tbody) return alert("Área de impressão não encontrada.");

  tbody.innerHTML = "";

  try {
    const { db, doc, getDoc } = fb();
    const snap = await getDoc(doc(db, "oferendas", docId));
    if (!snap.exists()) return alert("Oferenda não encontrada.");
    const data = snap.data() || {};

    titulo.textContent = data.nome || "(sem nome)";

    const itens1 = Array.isArray(data.itens) ? data.itens : [];
    const itens2 = Array.isArray(data.itens2) ? data.itens2 : [];
    const itens = [...itens1, ...itens2].filter(it => (it.ingrediente || "").trim());

    if (!itens.length) {
      const tr = document.createElement("tr");
      const tdIng = document.createElement("td");
      tdIng.colSpan = 2;
      tdIng.textContent = "Sem ingredientes cadastrados.";
      tr.appendChild(tdIng);
      tbody.appendChild(tr);
    } else {
      itens.forEach(it => {
        const tr = document.createElement("tr");
        const tdQtd = document.createElement("td");
        tdQtd.className = "print-total";
        tdQtd.textContent = it.quantidade || "—";
        const tdIng = document.createElement("td");
        tdIng.className = "print-ing";
        tdIng.textContent = it.ingrediente || "—";
        tr.appendChild(tdQtd);
        tr.appendChild(tdIng);
        tbody.appendChild(tr);
      });
    }

    area.style.display = "block";
    document.body.classList.add("print-lista-cadastrada");
    window.print();
    area.style.display = "none";
    tbody.innerHTML = "";
    document.body.classList.remove("print-lista-cadastrada");
  } catch (e) {
    console.error(e);
    alert("Erro ao imprimir oferenda.");
  }
};

//ESCONDER TODAS AS TELAS//
function esconderTodasAsTelas() {
  const ids = [
    "postLogin",
    "adminScreen",
    "oferendasScreen",
    "banhosScreen",
    "positivosScreen"
  ];

  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  // esconde a lista gerada do ebó
  const saidaPrint = document.getElementById("saidaPrint");
  const printIngredientes = document.getElementById("printIngredientes");
  if (printIngredientes) printIngredientes.innerHTML = "";
  if (saidaPrint) saidaPrint.style.display = "none";

  // esconde também a impressão simples
  const saidaPrintLista = document.getElementById("saidaPrintListaCadastrada");
  const printLista = document.getElementById("printListaCadastradaIngredientes");
  if (printLista) printLista.innerHTML = "";
  if (saidaPrintLista) saidaPrintLista.style.display = "none";
}
