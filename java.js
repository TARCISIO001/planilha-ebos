
// =======================================================
// Ebó - App (CLEAN v2 - compatível com modal antigo e novo)
// =======================================================



const COLLECTION = "listas";
const USERS_COLLECTION = "users";
const MASTERS = ["taina", "tata"];
const OFERENDA_MAX_FOTOS_POR_BLOCO = 3;
const OFERENDA_FOTO_MAX_LADO = 900;
const OFERENDA_FOTO_QUALIDADE = 0.68;
const OFERENDAS_ORIXA_COLLECTION = "oferendas";
const OFERENDAS_EBO_COLLECTION = "oferendas_ebo";


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
  "bola", "",
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
  if (!ingrediente) return "";

  // 1️⃣ Normaliza: remove acentos, pontuação, deixa minúsculas
  const base = (ingrediente || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")      // remove acentos
    .replace(/[^a-z0-9\s]+/g, " ")       // remove pontuação
    .replace(/\s+/g, " ")                // colapsa espaços duplicados
    .trim();

  // 2️⃣ Quebra em tokens e aplica singularização
  let tokens = base
    .split(" ")
    .map(t => singularizarBasico(t))
    .filter(t => t && !STOPWORDS_ING.has(t));

  // 3️⃣ Usa todas as palavras como chave
  return tokens.join(" ");
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

  if (!isLogged) {
    esconderTodasAsTelas();
  }

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
    esconderTodasAsTelas();
    showApp(false);

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

function escaparValorInput(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escaparHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

window.__fotosProcessando = window.__fotosProcessando || 0;

function iniciarProcessamentoFotos() {
  window.__fotosProcessando = Number(window.__fotosProcessando || 0) + 1;
}

function finalizarProcessamentoFotos() {
  window.__fotosProcessando = Math.max(0, Number(window.__fotosProcessando || 0) - 1);
}

async function aguardarProcessamentoFotos() {
  const limite = 8000;
  const inicio = Date.now();

  while (Number(window.__fotosProcessando || 0) > 0 && (Date.now() - inicio) < limite) {
    await new Promise(resolve => setTimeout(resolve, 120));
  }
}

function montarLinhaEditavelListaGerada(item = {}, manual = false) {
  const total = item?.totalTxt ?? item?.quantidade ?? "";
  const ingrediente = item?.ingrediente ?? "";
  const origens = item?.pratosTxt ?? item?.pratos ?? item?.origensTxt ?? item?.origens ?? "";
  const observacoes = item?.observacoesTxt ?? item?.observacoes ?? "";

  return `
    <tr${manual ? ' data-manual="1"' : ""}>
      <!-- Coluna Quantidades -->
      <td class="print-total" data-label="Quantidades">
        <input class="editQtd" type="text" placeholder="Quantidades" value="${escaparValorInput(total)}">
      </td>

      <!-- Coluna Ingredientes -->
      <td class="print-ing" data-label="Ingredientes">
        <input class="editIng" type="text" placeholder="Ingredientes" value="${escaparValorInput(ingrediente)}">
      </td>

      <!-- Coluna Origens -->
      <td class="print-pratos print-origens" data-label="Origens">
        <textarea class="editPratos editOrigens" placeholder="Origens">${escaparHTML(origens)}</textarea>
      </td>

      <!-- Coluna Observações -->
      <td class="print-observacoes" data-label="Observações">
        <textarea class="editObservacoes" placeholder="Observações">${escaparHTML(observacoes)}</textarea>
        ${manual ? `
          <button class="btn-danger btn-mini btn-remover-linha" type="button" onclick="this.closest('tr').remove()">
            Remover
          </button>
        ` : ""}
      </td>
    </tr>
  `;
}

function lerTextoTabelaSemBotoes(el) {
  if (!el) return "";
  const clone = el.cloneNode(true);
  clone.querySelectorAll("button").forEach((btn) => btn.remove());
  return (clone.textContent || "").trim();
}

function coletarLinhasEditaveisListaGerada() {
  return Array.from(document.querySelectorAll("#listaGeradaContainer tbody tr"))
    .map((tr) => {
      const quantidade = (
        tr.querySelector(".editQtd")?.value ||
        lerTextoTabelaSemBotoes(tr.querySelector(".print-total"))
      ).trim();

      const ingrediente = (
        tr.querySelector(".editIng")?.value ||
        lerTextoTabelaSemBotoes(tr.querySelector(".print-ing"))
      ).trim();

      const origens = (
        tr.querySelector(".editOrigens")?.value ||
        tr.querySelector(".editPratos")?.value ||
        lerTextoTabelaSemBotoes(tr.querySelector(".print-origens")) ||
        lerTextoTabelaSemBotoes(tr.querySelector(".print-pratos"))
      ).trim();

      const observacoes = (
        tr.querySelector(".editObservacoes")?.value ||
        lerTextoTabelaSemBotoes(tr.querySelector(".print-observacoes"))
      ).trim();

      return { quantidade, ingrediente, pratos: origens, origens, observacoes };
    })
    .filter((item) => item.quantidade || item.ingrediente || item.origens || item.observacoes);
}

function resetarQuantidadePessoasPara1() {
  const input = document.getElementById("numPratos");
  if (!input) return;

  const valorAtual = String(input.value || "").trim().replace(",", ".");
  const numeroAtual = Number(valorAtual);

  if (!Number.isFinite(numeroAtual) || numeroAtual < 1) {
    input.value = "1";
  }
}


//function getGeradorEstado() {
  //const eboNome = ($("eboNome")?.value || "").trim();
  //const pratos = parseInt($("numPratos")?.value || "0", 10);
  //return { eboNome, pratos: Number.isFinite(pratos) ? pratos : 0 };//
//}

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

// 🔹 Prioridade customizada (respeita a ordem da lista)
const prioridadeMap = new Map(
  INGREDIENTES_PRIORIDADE_INICIO.map((nome, idx) => [nome.toLowerCase(), idx])
);

itensConsolidados.sort((a, b) => {
  const ingA = (a.ingrediente || "").toLowerCase();
  const ingB = (b.ingrediente || "").toLowerCase();

  const idxA = prioridadeMap.has(ingA) ? prioridadeMap.get(ingA) : Infinity;
  const idxB = prioridadeMap.has(ingB) ? prioridadeMap.get(ingB) : Infinity;

  if (idxA !== idxB) return idxA - idxB;
  return ingA.localeCompare(ingB, undefined, { sensitivity: "base" });
});

if (!itensConsolidados.length) {
  alert("Essa lista não possui ingredientes cadastrados.");
  throw new Error("Lista sem ingredientes");
}

  // Geração da impressão
  //if ($("saidaPrint")) $("saidaPrint").style.display = "block";//
if ($("printEboNome")) {
  const nomeTemplo = "ILÊ D'OGUM";
  $("printEboNome").innerHTML = `<div style="font-size:28px; font-weight:800;">${nomeTemplo}</div>`;

  (window.__listasAcumuladas || []).forEach(lista => {
    const numPessoas = lista.pratos || 1;
    const divEbo = document.createElement("div");
    divEbo.style.fontSize = "20px";
    divEbo.style.marginTop = "4px";
    divEbo.textContent = `${lista.nome} (${numPessoas} pessoa${numPessoas > 1 ? "s" : ""})`;
    $("printEboNome").appendChild(divEbo);
  });
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
  //resetarQuantidadePessoasPara1();

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
      lista2: { subtitulo: subtitulo2, modo: modo2, itens: itens2 },
      fotosModo1: montarFotosComLegenda("listas", "1", getFotosAreaState("listas")["1"]),
      fotosModo2: montarFotosComLegenda("listas", "2", getFotosAreaState("listas")["2"]),
    };
  }

  const nome = ($("modalNomeEbo")?.value || "").trim();
  const itens = getLinhas("old");
  return { tipo: "antigo", nome, itens };
}

// =======================================================
// CONFERÊNCIA AUTOMÁTICA DE INGREDIENTES — PALAVRA/FRÁSE INTEIRA
// - Não altera a lógica de cálculo, PDF ou impressão.
// - Não substitui ingrediente automaticamente.
// - Maiúsculas/minúsculas e espaços duplicados não contam como erro.
// - A comparação é feita no NOME INTEIRO do ingrediente.
// - Só avisa quando a frase inteira parece ser o mesmo ingrediente:
//   acento/pontuação diferente ou erro pequeno de digitação.
// - Não usa regra específica para feijão; vale para todos os ingredientes.
// =======================================================
let __timerConferenciaIngredientes = null;
let __timerConferenciaGlobalIngredientes = null;
window.__ingredientesConferenciaUltimaSuspeitas = [];

function limparEspacosIngrediente(s) {
  return (s || "")
    .toString()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarIngredienteSemCaixa(s) {
  // Igualdade permitida: Pipoca, pipoca e PIPOCA são o mesmo texto.
  return limparEspacosIngrediente(s).toLocaleLowerCase("pt-BR");
}

function normalizarIngredienteFraseInteira(s) {
  // Assinatura da frase inteira: mantém TODAS as palavras importantes.
  // Não remove palavras como branco, fradinho, prato, vela, etc.
  return normalizarIngredienteSemCaixa(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensIngredienteFraseInteira(s) {
  const assinatura = normalizarIngredienteFraseInteira(s);
  return assinatura ? assinatura.split(" ").filter(Boolean) : [];
}

function temAcentoIngrediente(s) {
  return /[áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]/.test(String(s || ""));
}

function distanciaLevenshteinIngrediente(a, b) {
  a = String(a || "");
  b = String(b || "");
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);

  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + custo
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }

  return prev[b.length];
}

function erroPequenoNaPalavra(tokenA, tokenB) {
  if (!tokenA || !tokenB || tokenA === tokenB) return false;

  const maior = Math.max(tokenA.length, tokenB.length);
  const menor = Math.min(tokenA.length, tokenB.length);
  if (menor < 4) return false;

  const dist = distanciaLevenshteinIngrediente(tokenA, tokenB);

  // Evita trocar palavras realmente diferentes: branco x fradinho, milho x feijão, etc.
  // Para erro de digitação, normalmente o começo da palavra continua parecido.
  if (tokenA[0] !== tokenB[0]) return false;
  if (maior >= 7 && tokenA.slice(0, 2) !== tokenB.slice(0, 2)) return false;

  if (maior <= 6) return dist <= 1;
  return dist <= 2;
}

function parecemMesmoIngredientePorErroPequeno(nomeA, nomeB) {
  const tokensA = tokensIngredienteFraseInteira(nomeA);
  const tokensB = tokensIngredienteFraseInteira(nomeB);

  if (!tokensA.length || !tokensB.length) return false;

  // Regra principal: tem que ser a frase inteira.
  // Se a quantidade de palavras mudou, não sugere troca.
  if (tokensA.length !== tokensB.length) return false;

  let diferencas = 0;

  for (let i = 0; i < tokensA.length; i++) {
    if (tokensA[i] === tokensB[i]) continue;

    diferencas += 1;
    if (diferencas > 1) return false;

    if (!erroPequenoNaPalavra(tokensA[i], tokensB[i])) return false;
  }

  return diferencas === 1;
}

function eNomeSuspeitoIngrediente(nomeAtual, nomePadrao) {
  const atualSemCaixa = normalizarIngredienteSemCaixa(nomeAtual);
  const padraoSemCaixa = normalizarIngredienteSemCaixa(nomePadrao);

  // Só mudou maiúscula/minúscula ou espaço duplicado: não é erro.
  if (!atualSemCaixa || !padraoSemCaixa || atualSemCaixa === padraoSemCaixa) return false;

  const atualFrase = normalizarIngredienteFraseInteira(nomeAtual);
  const padraoFrase = normalizarIngredienteFraseInteira(nomePadrao);

  if (!atualFrase || !padraoFrase) return false;

  // Mesmas palavras na frase inteira, mas com acento/pontuação diferente.
  // Ex.: Acaca x Acaçá, Feijao branco x Feijão branco.
  if (atualFrase === padraoFrase) return true;

  // Erro pequeno de digitação em UMA palavra, mantendo a frase inteira.
  // Ex.: milho vemelho x milho vermelho; algidar x alguidar.
  return parecemMesmoIngredientePorErroPequeno(nomeAtual, nomePadrao);
}

function pontuarNomePadraoIngrediente(nome, quantidade) {
  const n = limparEspacosIngrediente(nome);
  let score = Number(quantidade || 0) * 1000;
  if (temAcentoIngrediente(n)) score += 80;
  if (/^[A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]/.test(n)) score += 10;
  score += Math.min(n.length, 80) / 100;
  return score;
}

function escolherNomePadraoIngrediente(ocorrencias) {
  const mapa = new Map();

  (ocorrencias || []).forEach((oc) => {
    const nome = limparEspacosIngrediente(oc?.nome || oc?.ingrediente || "");
    const key = normalizarIngredienteSemCaixa(nome);
    if (!nome || !key) return;

    if (!mapa.has(key)) {
      mapa.set(key, { nome, quantidade: 0, ocorrencias: [] });
    }

    const item = mapa.get(key);
    item.quantidade += 1;
    item.ocorrencias.push(oc);

    if (pontuarNomePadraoIngrediente(nome, 1) > pontuarNomePadraoIngrediente(item.nome, 1)) {
      item.nome = nome;
    }
  });

  let melhor = null;
  mapa.forEach((item) => {
    const score = pontuarNomePadraoIngrediente(item.nome, item.quantidade);
    if (!melhor || score > melhor.score) melhor = { ...item, score };
  });

  return melhor?.nome || limparEspacosIngrediente(ocorrencias?.[0]?.nome || ocorrencias?.[0]?.ingrediente || "");
}

function coletarIngredientesModalAtual() {
  const itens = [];
  const rows = Array.from(document.querySelectorAll("#modalBackdrop tbody tr"));

  rows.forEach((tr, index) => {
    const input = tr.querySelector(".modalIng");
    if (!input) return;

    const nome = limparEspacosIngrediente(input.value || "");
    if (!nome) return;

    const tbodyId = tr.closest("tbody")?.id || "";
    const listId = tbodyId.includes("_2") ? "2" : tbodyId.includes("_1") ? "1" : "old";

    itens.push({
      nome,
      input,
      rowIndex: index,
      listId,
      lista: listId === "2" ? "Lista 2" : "Lista 1",
      origem: "lista_atual"
    });
  });

  return itens;
}

async function buscarCatalogoIngredientesCadastrados(excluirDocId = null) {
  const { db, collection, getDocs } = fb();
  const snap = await getDocs(collection(db, COLLECTION));
  const catalogo = [];

  snap.forEach((s) => {
    if (excluirDocId && s.id === excluirDocId) return;

    const data = s.data() || {};
    const listaNome = limparEspacosIngrediente(data.nome || "(lista sem nome)");

    ["itens", "itens2"].forEach((campo, blocoIndex) => {
      const itens = Array.isArray(data[campo]) ? data[campo] : [];
      itens.forEach((it, itemIndex) => {
        const nome = limparEspacosIngrediente(it?.ingrediente || "");
        if (!nome) return;

        catalogo.push({
          nome,
          lista: listaNome,
          docId: s.id,
          campo,
          itemIndex,
          origem: "banco",
          bloco: blocoIndex === 0 ? "Lista 1" : "Lista 2"
        });
      });
    });
  });

  return catalogo;
}

function agruparOcorrenciasPorFraseInteira(ocorrencias) {
  const grupos = new Map();

  (ocorrencias || []).forEach((oc) => {
    const frase = normalizarIngredienteFraseInteira(oc.nome || oc.ingrediente || "");
    if (!frase) return;
    if (!grupos.has(frase)) grupos.set(frase, []);
    grupos.get(frase).push(oc);
  });

  return grupos;
}

function adicionarSuspeitaIngrediente(suspeitas, vistos, atual, sugestao, ocorrencias, motivo) {
  const nomeAtual = limparEspacosIngrediente(atual.nome);
  const nomeSugestao = limparEspacosIngrediente(sugestao);
  if (!nomeAtual || !nomeSugestao) return;
  if (!eNomeSuspeitoIngrediente(nomeAtual, nomeSugestao)) return;

  const key = `${atual.listId || "global"}|${atual.rowIndex ?? "-"}|${normalizarIngredienteSemCaixa(nomeAtual)}|${normalizarIngredienteSemCaixa(nomeSugestao)}`;
  if (vistos.has(key)) return;
  vistos.add(key);

  suspeitas.push({
    atual,
    nomeAtual,
    sugestao: nomeSugestao,
    ocorrencias: (ocorrencias || []).slice(0, 6),
    motivo
  });
}

function encontrarSugestoesIngredientes(itensAtuais, catalogo) {
  const suspeitas = [];
  const vistos = new Set();
  const gruposBanco = agruparOcorrenciasPorFraseInteira(catalogo);

  // 1) Mesma frase inteira, mas acento/pontuação diferente.
  itensAtuais.forEach((atual) => {
    const frase = normalizarIngredienteFraseInteira(atual.nome);
    const grupo = gruposBanco.get(frase) || [];
    if (!grupo.length) return;

    const sugestao = escolherNomePadraoIngrediente([...grupo, atual]);
    adicionarSuspeitaIngrediente(suspeitas, vistos, atual, sugestao, grupo, "Mesma frase com escrita diferente");
  });

  // 2) Pequeno erro de digitação, sempre respeitando a frase inteira.
  itensAtuais.forEach((atual) => {
    const atualFrase = normalizarIngredienteFraseInteira(atual.nome);
    if (!atualFrase || atualFrase.length < 4) return;

    let melhor = null;

    catalogo.forEach((oc) => {
      const nomeBanco = limparEspacosIngrediente(oc.nome);
      const bancoFrase = normalizarIngredienteFraseInteira(nomeBanco);
      if (!bancoFrase || atualFrase === bancoFrase) return;
      if (!parecemMesmoIngredientePorErroPequeno(atual.nome, nomeBanco)) return;

      const grupo = gruposBanco.get(bancoFrase) || [oc];
      const dist = distanciaLevenshteinIngrediente(atualFrase, bancoFrase);
      if (!melhor || dist < melhor.dist) {
        melhor = {
          sugestao: escolherNomePadraoIngrediente(grupo),
          ocorrencias: grupo,
          dist
        };
      }
    });

    if (melhor) {
      adicionarSuspeitaIngrediente(suspeitas, vistos, atual, melhor.sugestao, melhor.ocorrencias, "Possível erro pequeno de digitação");
    }
  });

  // 3) Diferenças dentro da própria lista atual.
  const gruposAtual = agruparOcorrenciasPorFraseInteira(itensAtuais);
  gruposAtual.forEach((grupo) => {
    if (grupo.length < 2) return;
    const sugestao = escolherNomePadraoIngrediente(groupToOcorrenciasComListaAtual(grupo));
    grupo.forEach((atual) => {
      adicionarSuspeitaIngrediente(suspeitas, vistos, atual, sugestao, grupo, "Mesmo ingrediente repetido com escrita diferente na lista atual");
    });
  });

  return suspeitas;
}

function groupToOcorrenciasComListaAtual(grupo) {
  return (grupo || []).map((g) => ({ ...g, lista: g.lista || "Lista atual" }));
}

async function conferirIngredientesModalContraCatalogo() {
  const itensAtuais = coletarIngredientesModalAtual();
  if (!itensAtuais.length) return { suspeitas: [], catalogo: [] };

  const catalogo = await buscarCatalogoIngredientesCadastrados(editingDocId || null);
  const suspeitas = encontrarSugestoesIngredientes(itensAtuais, catalogo);
  return { suspeitas, catalogo };
}

function montarTextoSuspeitaIngrediente(s, idx) {
  const linhas = [];
  linhas.push(`${idx + 1}. Na ${s.atual?.lista || "lista"}: "${s.nomeAtual}"`);
  linhas.push(`   Nome já encontrado parecido: "${s.sugestao}"`);
  linhas.push(`   Motivo: ${s.motivo || "escrita diferente"}`);

  const listas = Array.from(new Set((s.ocorrencias || [])
    .map(oc => limparEspacosIngrediente(oc.lista || oc.bloco || ""))
    .filter(Boolean)))
    .slice(0, 3);

  if (listas.length) linhas.push(`   Encontrado em: ${listas.join(", ")}`);
  return linhas.join("\n");
}

function montarMensagemConferenciaIngredientes(suspeitas) {
  return [
    "⚠️ Conferência automática de ingredientes",
    "",
    "Encontrei ingredientes com escrita parecida em outras listas.",
    "A conferência usa o nome inteiro do ingrediente, não apenas uma palavra.",
    "Maiúsculas e minúsculas foram ignoradas.",
    "Nada será trocado automaticamente.",
    "",
    ...suspeitas.slice(0, 8).map(montarTextoSuspeitaIngrediente),
    suspeitas.length > 8 ? `\n... e mais ${suspeitas.length - 8} suspeita(s).` : ""
  ].filter(Boolean).join("\n");
}

function garantirBoxConferenciaIngredientesModal() {
  const backdrop = $("modalBackdrop");
  const card = backdrop?.querySelector(".modal-card");
  const head = card?.querySelector(".section-head");
  if (!backdrop || !card || !head) return null;

  let box = $("ingredientesConferenciaBox");
  if (!box) {
    box = document.createElement("div");
    box.id = "ingredientesConferenciaBox";
    box.className = "hint";
    box.style.cssText = [
      "display:none",
      "margin:10px 0 14px",
      "padding:10px 12px",
      "border-radius:12px",
      "border:1px solid #fde68a",
      "background:#fffbeb",
      "color:#92400e",
      "line-height:1.45"
    ].join(";");
    head.insertAdjacentElement("afterend", box);
  }

  return box;
}

function renderizarConferenciaIngredientesModal(suspeitas) {
  const box = garantirBoxConferenciaIngredientesModal();
  if (!box) return;

  window.__ingredientesConferenciaUltimaSuspeitas = suspeitas || [];

  if (!suspeitas || !suspeitas.length) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

  const itensHtml = suspeitas.slice(0, 8).map((s) => {
    const listas = Array.from(new Set((s.ocorrencias || [])
      .map(oc => limparEspacosIngrediente(oc.lista || oc.bloco || ""))
      .filter(Boolean)))
      .slice(0, 3);

    return `
      <div style="margin-top:8px;">
        <strong>${escaparHTML(s.nomeAtual)}</strong>
        <span> parecido com </span>
        <strong>${escaparHTML(s.sugestao)}</strong>
        <div style="font-size:12px; opacity:.9;">${escaparHTML(s.motivo || "Confira o nome inteiro antes de salvar.")}</div>
        ${listas.length ? `<div style="font-size:12px; opacity:.9;">Encontrado em: ${escaparHTML(listas.join(", "))}</div>` : ""}
      </div>
    `;
  }).join("");

  box.innerHTML = `
    <div style="font-weight:800; margin-bottom:4px;">⚠️ Conferência automática de ingredientes</div>
    <div>Revise os nomes abaixo. A conferência usa a frase inteira e não troca nada automaticamente.</div>
    ${itensHtml}
    <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
      <button type="button" class="btn-tertiary btn-mini" onclick="document.getElementById('ingredientesConferenciaBox').style.display='none'">Ocultar aviso</button>
    </div>
  `;
  box.style.display = "block";
}

window.aplicarSugestoesConferenciaIngredientes = function aplicarSugestoesConferenciaIngredientes() {
  alert("Por segurança, esta versão não troca ingredientes automaticamente. Revise e ajuste manualmente o campo destacado no aviso.");
};

function prepararConferenciaIngredientesModal() {
  const backdrop = $("modalBackdrop");
  if (!backdrop) return;

  garantirBoxConferenciaIngredientesModal();

  if (!backdrop.__conferenciaIngredientesListener) {
    backdrop.addEventListener("input", (event) => {
      if (event.target?.classList?.contains("modalIng")) {
        agendarConferenciaIngredientesModal(700);
      }
    });
    backdrop.__conferenciaIngredientesListener = true;
  }
}

function agendarConferenciaIngredientesModal(ms = 700) {
  clearTimeout(__timerConferenciaIngredientes);
  __timerConferenciaIngredientes = setTimeout(async () => {
    try {
      const resultado = await conferirIngredientesModalContraCatalogo();
      renderizarConferenciaIngredientesModal(resultado.suspeitas);
    } catch (e) {
      console.warn("Conferência de ingredientes falhou:", e);
    }
  }, ms);
}

async function verificarIngredientesAntesSalvarLista() {
  try {
    const resultado = await conferirIngredientesModalContraCatalogo();
    const suspeitas = resultado.suspeitas || [];
    renderizarConferenciaIngredientesModal(suspeitas);

    if (!suspeitas.length) return true;

    return confirm(
      montarMensagemConferenciaIngredientes(suspeitas) +
      "\n\nClique em OK para salvar mesmo assim." +
      "\nClique em Cancelar para voltar e revisar os nomes."
    );
  } catch (e) {
    console.warn("Não foi possível conferir ingredientes antes de salvar:", e);
    return true;
  }
}

function encontrarSuspeitasGlobaisIngredientes(catalogo) {
  const suspeitas = [];
  const vistos = new Set();
  const grupos = agruparOcorrenciasPorFraseInteira(catalogo);

  // Mesma frase inteira, escrita visual diferente.
  grupos.forEach((ocorrencias) => {
    const variantes = new Map();
    ocorrencias.forEach((oc) => {
      const key = normalizarIngredienteSemCaixa(oc.nome);
      if (!key) return;
      if (!variantes.has(key)) variantes.set(key, []);
      variantes.get(key).push(oc);
    });

    if (variantes.size <= 1) return;

    const padrao = escolherNomePadraoIngrediente(ocorrencias);
    variantes.forEach((ocs, key) => {
      if (key === normalizarIngredienteSemCaixa(padrao)) return;
      adicionarSuspeitaIngrediente(suspeitas, vistos, {
        nome: ocs[0].nome,
        lista: ocs[0].lista,
        listId: "global",
        rowIndex: `${ocs[0].docId || ""}-${ocs[0].itemIndex || 0}`
      }, padrao, ocorrencias, "Mesma frase com escrita diferente");
    });
  });

  // Pequenos erros de digitação, respeitando frase inteira.
  const unicos = [];
  const unicosVistos = new Set();
  catalogo.forEach((oc) => {
    const frase = normalizarIngredienteFraseInteira(oc.nome);
    const semCaixa = normalizarIngredienteSemCaixa(oc.nome);
    if (!frase || unicosVistos.has(semCaixa)) return;
    unicosVistos.add(semCaixa);
    unicos.push({ ...oc, frase });
  });

  const buckets = new Map();
  unicos.slice(0, 1200).forEach((oc) => {
    const tokens = tokensIngredienteFraseInteira(oc.nome);
    const chave = `${tokens.length}|${tokens[0] || ""}|${tokens[tokens.length - 1] || ""}`;
    if (!buckets.has(chave)) buckets.set(chave, []);
    buckets.get(chave).push(oc);
  });

  buckets.forEach((arr) => {
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (suspeitas.length >= 25) return;
        const a = arr[i];
        const b = arr[j];
        if (normalizarIngredienteFraseInteira(a.nome) === normalizarIngredienteFraseInteira(b.nome)) continue;
        if (!parecemMesmoIngredientePorErroPequeno(a.nome, b.nome)) continue;

        const padrao = escolherNomePadraoIngrediente([a, b]);
        const outro = normalizarIngredienteSemCaixa(a.nome) === normalizarIngredienteSemCaixa(padrao) ? b : a;
        adicionarSuspeitaIngrediente(suspeitas, vistos, {
          nome: outro.nome,
          lista: outro.lista,
          listId: "global",
          rowIndex: `${outro.docId || ""}-${outro.itemIndex || 0}`
        }, padrao, [a, b], "Possível erro pequeno de digitação");
      }
    }
  });

  return suspeitas.slice(0, 25);
}

function garantirBoxConferenciaGlobalIngredientes() {
  const listasBox = $("listasSalvasBox");
  if (!listasBox?.parentElement) return null;

  let box = $("ingredientesConferenciaGlobalBox");
  if (!box) {
    box = document.createElement("div");
    box.id = "ingredientesConferenciaGlobalBox";
    box.className = "hint";
    box.style.cssText = [
      "display:none",
      "margin:10px 0 14px",
      "padding:10px 12px",
      "border-radius:12px",
      "border:1px solid #fde68a",
      "background:#fffbeb",
      "color:#92400e",
      "line-height:1.45"
    ].join(";");
    listasBox.parentElement.insertBefore(box, listasBox);
  }

  return box;
}

async function atualizarConferenciaGlobalIngredientes() {
  try {
    const box = garantirBoxConferenciaGlobalIngredientes();
    if (!box) return;

    const catalogo = await buscarCatalogoIngredientesCadastrados(null);
    const suspeitas = encontrarSuspeitasGlobaisIngredientes(catalogo);

    if (!suspeitas.length) {
      box.style.display = "none";
      box.innerHTML = "";
      return;
    }

    const html = suspeitas.slice(0, 8).map((s) => {
      const listas = Array.from(new Set((s.ocorrencias || [])
        .map(oc => limparEspacosIngrediente(oc.lista || ""))
        .filter(Boolean)))
        .slice(0, 4);

      return `
        <div style="margin-top:8px;">
          <strong>${escaparHTML(s.nomeAtual)}</strong>
          <span> parecido com </span>
          <strong>${escaparHTML(s.sugestao)}</strong>
          <div style="font-size:12px; opacity:.9;">${escaparHTML(s.motivo || "Confira o nome inteiro.")}</div>
          ${listas.length ? `<div style="font-size:12px; opacity:.9;">Listas: ${escaparHTML(listas.join(", "))}</div>` : ""}
        </div>
      `;
    }).join("");

    box.innerHTML = `
      <div style="font-weight:800; margin-bottom:4px;">⚠️ Conferência automática das listas cadastradas</div>
      <div>Encontrei possíveis ingredientes repetidos com nomes diferentes. A conferência usa o nome inteiro e não troca nada automaticamente.</div>
      ${html}
    `;
    box.style.display = "block";
  } catch (e) {
    console.warn("Conferência global de ingredientes falhou:", e);
  }
}

function agendarConferenciaGlobalIngredientes(ms = 900) {
  clearTimeout(__timerConferenciaGlobalIngredientes);
  __timerConferenciaGlobalIngredientes = setTimeout(() => {
    atualizarConferenciaGlobalIngredientes();
  }, ms);
}

window.fecharModal = function fecharModal() {
  $("modalBackdrop") && ($("modalBackdrop").style.display = "none");
};

function abrirModal() {
  prepararModalFotosArea("listas");
  prepararConferenciaIngredientesModal();
  $("modalBackdrop") && ($("modalBackdrop").style.display = "flex");
  agendarConferenciaIngredientesModal(350);
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
    resetarFotosArea("listas");
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
    salvarCacheImpressaoLista(COLLECTION, items);

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
              <button class="btn-mini btn-add-lista" onclick="adicionarListaAcumulada('${item.id}')">Adicionar lista</button>
              <button class="btn-mini btn-mini-open" onclick="editarLista('${item.id}')">Editar</button>
              <button class="btn-mini btn-mini-del" onclick="excluirLista('${item.id}')">Excluir</button>
              <button class="btn-mini btn-print" onclick="imprimirListaCadastrada('${item.id}')">Imprimir</button>
            </div>
          </div>
        `;
      })
      .join("");

    setFirebaseStatus(true, "Firebase: conectado");
    agendarConferenciaGlobalIngredientes();
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

     definirFotosArea("listas", "1", (data.fotosModo1 || []).map(f => ({
  src: f.src || f,
  legenda: f.legenda || ""
})));

definirFotosArea("listas", "2", (data.fotosModo2 || []).map(f => ({
  src: f.src || f,
  legenda: f.legenda || ""
})));
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
  await aguardarProcessamentoFotos();
  try {
    const payloadModal = modalGetPayloadCompat();

    const podeContinuarConferencia = await verificarIngredientesAntesSalvarLista();
    if (!podeContinuarConferencia) return;

    const { db, collection, addDoc, doc, setDoc, serverTimestamp } = fb();

    let payload;

    if (payloadModal.tipo === "novo") {
      const { lista1, lista2 } = payloadModal;

      if (!lista1.nome) return alert("Erro: digite o nome do ebó (Lista 1).");
      if (!lista1.itens || !lista1.itens.some(i => (i.ingrediente || "").trim())) 
        return alert("Erro: adicione ao menos 1 ingrediente na Lista 1.");

/// Captura legendas da Lista 1
const preview1 = document.getElementById(`previewFotosLista_1`);
const legendas1 = Array.from(preview1.querySelectorAll(".foto-legenda-input"))
  .map(input => {
    if (!input) return "";                        // evita undefined
    if (input.value !== undefined) return input.value.trim(); // textarea ou input
    if (input.innerText !== undefined) return input.innerText.trim(); // div contenteditable
    return "";
  });

const preview2 = document.getElementById(`previewFotosLista_2`);
const legendas2 = Array.from(preview2.querySelectorAll(".foto-legenda-input"))
  .map(input => {
    if (!input) return "";
    if (input.value !== undefined) return input.value.trim();
    if (input.innerText !== undefined) return input.innerText.trim();
    return "";
  });

payload = {
  nome: lista1.nome,
  nome_norm: normalizarTexto(lista1.nome),
  subtitulo: lista1.subtitulo || "",
  modo: lista1.modo || "",

  // CORREÇÃO
  subtitulo2: lista2.subtitulo || "",
  modo2: lista2.modo || "",

  fotosModo1: (payloadModal.fotosModo1 || []).map((f, i) => ({
    src: f.src || f,
    legenda: f.legenda || legendas1[i] || ""
  })),

  fotosModo2: (payloadModal.fotosModo2 || []).map((f, i) => ({
    src: f.src || f,
    legenda: f.legenda || legendas2[i] || ""
  })),

  itens: lista1.itens,
  itens2: lista2.itens || [],
  updatedAt: serverTimestamp()
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

  // Mostra apenas resumo: nome do ebó, pessoas e quantidade de itens
  box.innerHTML = window.__listasAcumuladas
    .map((l, idx) => {
      const nItens = Array.isArray(l.itens) ? l.itens.length : 0;
      return `
        <div class="saved-item">
          <div>
            <div class="saved-title">${l.nome}</div>
            <div class="saved-meta">Pessoas: ${l.pratos} • Itens: ${nItens}</div>
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
  const conferencia = document.getElementById("printConferenciaMesas");

  if (tbody) tbody.innerHTML = "";
  if (conferencia) conferencia.innerHTML = "";
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
  esconderTodasAsTelas();

  const admin = document.getElementById("adminScreen");
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

  // === AQUI ADICIONAMOS O BOTÃO ALEATÓRIO ===
const btnAleatorio = document.getElementById('btn-aleatorio');
if (btnAleatorio) btnAleatorio.addEventListener('click', abrirTelaAleatorio);

const { auth, onAuthStateChanged } = fb();

onAuthStateChanged(auth, (user) => {
  if (user) {
    const username = emailToUsername(user.email);

    esconderTodasAsTelas();
    showApp(true);
    showAdminPanel(MASTERS.includes(username));

    const btnAdmin = document.getElementById("btnAdmin");
if (btnAdmin) {
  btnAdmin.style.display = MASTERS.includes(username) ? "inline-block" : "none";
  btnAdmin.addEventListener("click", abrirTelaAdmin);
}
    setAuthMsg(`Logado como: ${username}`);
    setUserBadge(`Logado como: ${username}`);
    setFirebaseStatus(true, "Firebase: conectado");
    procurarListas();
    iniciarControleInatividade();
  } else {
    esconderTodasAsTelas();
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
window.imprimirListaGerada = function () {

  const area = document.getElementById("saidaPrint");
  if (!area) return;
  if (!exigirDataFuncaoAntesDeSaida()) return;

  gerarConferenciaMesasParaImpressao();

  area.style.left = "0";
  area.style.zIndex = "9999";

  requestAnimationFrame(() => {
    setTimeout(() => {

      window.print();

      area.style.left = "-9999px";
      area.style.zIndex = "-1";

    }, 80);
  });

};

async function aguardarImagensDoElementoPDF(root) {
  const imagens = Array.from(root.querySelectorAll("img"));
  if (!imagens.length) return;

  await Promise.all(
    imagens.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
        setTimeout(resolve, 1200);
      });
    })
  );
}

function pdfNormalizarTexto(value) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function pdfTextoParaWinAnsi(value) {
  const mapa = {
    "€": 128,
    "‚": 130,
    "ƒ": 131,
    "„": 132,
    "…": 133,
    "†": 134,
    "‡": 135,
    "ˆ": 136,
    "‰": 137,
    "Š": 138,
    "‹": 139,
    "Œ": 140,
    "Ž": 142,
    "‘": 145,
    "’": 146,
    "“": 147,
    "”": 148,
    "•": 149,
    "–": 150,
    "—": 151,
    "˜": 152,
    "™": 153,
    "š": 154,
    "›": 155,
    "œ": 156,
    "ž": 158,
    "Ÿ": 159,
  };

  const bytes = [];
  String(value ?? "").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, "-").split("").forEach((ch) => {
    const code = ch.charCodeAt(0);
    if (code <= 255) bytes.push(code);
    else if (mapa[ch]) bytes.push(mapa[ch]);
    else bytes.push(63);
  });
  return bytes;
}

function pdfEscapeLiteral(value) {
  let out = "";
  pdfTextoParaWinAnsi(value).forEach((byte) => {
    const ch = String.fromCharCode(byte);
    if (ch === "\\") out += "\\\\";
    else if (ch === "(") out += "\\(";
    else if (ch === ")") out += "\\)";
    else if (byte === 10) out += "\\n";
    else if (byte === 13) out += "";
    else out += ch;
  });
  return out;
}

function pdfLarguraTexto(texto, tamanhoFonte = 10) {
  const value = pdfNormalizarTexto(texto);
  let peso = 0;
  for (const ch of value) {
    if (ch === " ") peso += 0.28;
    else if ("ilI.,'|!".includes(ch)) peso += 0.24;
    else if ("mwMW@#%".includes(ch)) peso += 0.78;
    else if (/[A-ZÁÉÍÓÚÃÕÂÊÔÇ]/.test(ch)) peso += 0.62;
    else peso += 0.50;
  }
  return peso * tamanhoFonte;
}

function pdfQuebrarTexto(texto, larguraMax, tamanhoFonte = 10) {
  const linhasEntrada = pdfNormalizarTexto(texto || "—").split(/\n+/);
  const linhas = [];

  linhasEntrada.forEach((linhaEntrada) => {
    const palavras = linhaEntrada.split(/\s+/).filter(Boolean);
    if (!palavras.length) {
      linhas.push("");
      return;
    }

    let atual = "";
    palavras.forEach((palavra) => {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (pdfLarguraTexto(tentativa, tamanhoFonte) <= larguraMax || !atual) {
        atual = tentativa;
        return;
      }

      linhas.push(atual);
      atual = palavra;

      while (pdfLarguraTexto(atual, tamanhoFonte) > larguraMax && atual.length > 8) {
        let corte = atual.length - 1;
        while (corte > 4 && pdfLarguraTexto(atual.slice(0, corte) + "-", tamanhoFonte) > larguraMax) {
          corte -= 1;
        }
        linhas.push(atual.slice(0, corte) + "-");
        atual = atual.slice(corte);
      }
    });
    if (atual) linhas.push(atual);
  });

  return linhas.length ? linhas : ["—"];
}

function pdfAdicionarTexto(comandos, texto, x, y, tamanho = 10, negrito = false) {
  const fonte = negrito ? "/F2" : "/F1";
  comandos.push(`BT ${fonte} ${tamanho} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscapeLiteral(texto)}) Tj ET`);
}

function pdfAdicionarTextoCentralizado(comandos, texto, centroX, y, tamanho = 10, negrito = false) {
  const largura = pdfLarguraTexto(texto, tamanho);
  pdfAdicionarTexto(comandos, texto, centroX - largura / 2, y, tamanho, negrito);
}

function pdfLinha(comandos, x1, y1, x2, y2) {
  comandos.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
}

function pdfRetangulo(comandos, x, y, w, h) {
  comandos.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
}

function pdfAdicionarImagem(comandos, nomeObjeto, x, y, w, h) {
  if (!nomeObjeto || !w || !h) return;
  comandos.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /${nomeObjeto} Do Q`);
}

function pdfColetarLinhasDaLista() {
  let linhas = [];
  try {
    linhas = coletarLinhasEditaveisListaGerada();
  } catch (e) {
    linhas = [];
  }

  if (!linhas.length) {
    linhas = Array.from(document.querySelectorAll("#printIngredientes tr")).map((tr) => ({
      quantidade: tr.querySelector(".print-total")?.textContent?.trim() || "",
      ingrediente: tr.querySelector(".print-ing")?.textContent?.trim() || "",
      origens: tr.querySelector(".print-origens")?.textContent?.trim() || tr.querySelector(".print-pratos")?.textContent?.trim() || "",
      observacoes: tr.querySelector(".print-observacoes")?.textContent?.trim() || "",
    }));
  }

  return linhas.filter((item) => item.quantidade || item.ingrediente || item.origens || item.observacoes);
}

function pdfMontarPaginasListaGerada(opcoes = {}) {
  const logo = opcoes?.logo || null;
  const pagina = { w: 595.28, h: 841.89, margemTopo: 12, margemBaixo: 36 };

  // Larguras ajustadas para ficar parecido com a lista impressa:
  // tabela larga, títulos grandes e todos dentro do gradeado.
  const colunas = [
    { key: "quantidade", titulo: "QUANTIDADES", w: 112, align: "center", bold: true },
    { key: "ingrediente", titulo: "INGREDIENTES", w: 168, align: "center", bold: true },
    { key: "origens", titulo: "ORIGENS", w: 116, align: "center", bold: false },
    { key: "observacoes", titulo: "OBSERVAÇÕES", w: 164, align: "center", bold: false },
  ];

  const larguraTabela = colunas.reduce((acc, col) => acc + col.w, 0);
  const x0 = (pagina.w - larguraTabela) / 2;
  const fontLinha = 8.25;
  const fontLinhaDestaque = 8.7;
  const fontCab = 10.8;
  const linhaAltura = 10.2;
  const paddingX = 4.8;
  const paddingY = 5.4;
  const headerTabelaH = 22;
  const rodapeY = 22;
  const limiteInferior = 42;

  const linhas = pdfColetarLinhasDaLista();
  const dataFuncao = obterTextoDataFuncao?.() || "";

  const paginas = [];
  let comandos = [];
  let y = pagina.h - pagina.margemTopo;
  let numeroPagina = 1;

  function setCorLinha(r = 0, g = 0, b = 0) {
    comandos.push(`${r} ${g} ${b} RG`);
  }

  function setCorTexto(r = 0, g = 0, b = 0) {
    comandos.push(`${r} ${g} ${b} rg`);
  }

  function pdfAdicionarTextoAlinhado(texto, x, yTexto, largura, tamanho = 10, negrito = false, align = "left") {
    const valor = String(texto || "");
    let tx = x;
    if (align === "center") {
      tx = x + (largura - pdfLarguraTexto(valor, tamanho)) / 2;
    } else if (align === "right") {
      tx = x + largura - pdfLarguraTexto(valor, tamanho);
    }
    pdfAdicionarTexto(comandos, valor, tx, yTexto, tamanho, negrito);
  }

  function desenharCabecalhoBonito() {
    if (logo?.width && logo?.height) {
      // Logo bem no alto da página, igual ao modelo enviado.
      const logoMaxW = 118;
      const logoMaxH = 112;
      const logoEscala = Math.min(logoMaxW / logo.width, logoMaxH / logo.height);
      const logoW = Math.max(1, logo.width * logoEscala);
      const logoH = Math.max(1, logo.height * logoEscala);
      const logoTopoY = pagina.h - 8;
      pdfAdicionarImagem(comandos, "Logo", (pagina.w - logoW) / 2, logoTopoY - logoH, logoW, logoH);
      y = logoTopoY - logoH - 58;
    } else {
      y -= 18;
    }

    setCorTexto(0, 0, 0);
    pdfAdicionarTextoCentralizado(comandos, "Ilê D'Ogum", pagina.w / 2, y, 25, true);
    y -= 30;

    if (dataFuncao) {
      pdfAdicionarTextoCentralizado(comandos, dataFuncao, pagina.w / 2, y, 12.8, true);
      y -= 24;
    } else {
      y -= 8;
    }
  }

  function novaPagina(comHeaderCompleto = false) {
    comandos = [];
    setCorLinha(0, 0, 0);
    setCorTexto(0, 0, 0);
    comandos.push("0.55 w");
    y = pagina.h - pagina.margemTopo;

    if (comHeaderCompleto) {
      desenharCabecalhoBonito();
    } else {
      pdfAdicionarTextoCentralizado(comandos, "Continuação da lista", pagina.w / 2, y, 11, true);
      y -= 20;
    }

    desenharCabecalhoTabela();
  }

  function finalizarPagina() {
    setCorTexto(0.35, 0.35, 0.35);
    pdfAdicionarTextoCentralizado(comandos, `Página ${numeroPagina}`, pagina.w / 2, rodapeY, 7.5, false);
    setCorTexto(0, 0, 0);
    paginas.push(comandos.join("\n"));
    numeroPagina += 1;
  }

  function desenharCabecalhoTabela() {
    setCorLinha(0, 0, 0);
    comandos.push("0.65 w");
    pdfRetangulo(comandos, x0, y - headerTabelaH, larguraTabela, headerTabelaH);

    let x = x0;
    colunas.forEach((col, idx) => {
      if (idx > 0) pdfLinha(comandos, x, y, x, y - headerTabelaH);
      setCorTexto(0.12, 0.16, 0.22);
      pdfAdicionarTextoAlinhado(col.titulo, x, y - 14.7, col.w, fontCab, true, "center");
      x += col.w;
    });
    setCorTexto(0, 0, 0);
    y -= headerTabelaH;
  }

  function prepararCelula(texto, largura, tamanhoFonte) {
    return pdfQuebrarTexto(texto || "—", largura - paddingX * 2, tamanhoFonte);
  }

  novaPagina(true);

  if (!linhas.length) {
    linhas.push({ quantidade: "—", ingrediente: "Nenhum item gerado.", origens: "—", observacoes: "—" });
  }

  linhas.forEach((item) => {
    const celulas = colunas.map((col) => {
      const fonte = col.bold ? fontLinhaDestaque : fontLinha;
      return prepararCelula(item[col.key], col.w, fonte);
    });

    const maxLinhas = Math.max(...celulas.map((c) => c.length));
    const rowH = Math.max(30, maxLinhas * linhaAltura + paddingY * 2);

    if (y - rowH < limiteInferior) {
      finalizarPagina();
      novaPagina(false);
    }

    comandos.push("0.45 w");
    setCorLinha(0, 0, 0);
    pdfRetangulo(comandos, x0, y - rowH, larguraTabela, rowH);

    let x = x0;
    colunas.forEach((col, idx) => {
      if (idx > 0) pdfLinha(comandos, x, y, x, y - rowH);

      const linhasCelula = celulas[idx];
      const fonte = col.bold ? fontLinhaDestaque : fontLinha;
      const negrito = Boolean(col.bold);
      const blocoAltura = (linhasCelula.length - 1) * linhaAltura + fonte;
      const textoYInicial = y - (rowH - blocoAltura) / 2 - fonte + 1.3;

      if (col.key === "origens" || col.key === "observacoes") {
        setCorTexto(0.26, 0.30, 0.35);
      } else {
        setCorTexto(0.06, 0.10, 0.16);
      }

      linhasCelula.forEach((linha, linhaIdx) => {
        pdfAdicionarTextoAlinhado(
          linha,
          x + paddingX,
          textoYInicial - linhaIdx * linhaAltura,
          col.w - paddingX * 2,
          fonte,
          negrito,
          col.align
        );
      });
      x += col.w;
    });

    setCorTexto(0, 0, 0);
    y -= rowH;
  });

  finalizarPagina();
  return paginas;
}

function pdfBase64ParaBytes(base64) {
  const bin = atob(base64 || "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}


// Logo embutida diretamente no gerador de PDF.
// Isso evita falha de carregamento/canvas quando o app é aberto por arquivo local ou navegador móvel.
const PDF_LOGO_EMBUTIDA = {
  width: 402,
  height: 400,
  base64: "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"
};

function pdfObterLogoEmbutida() {
  try {
    if (!PDF_LOGO_EMBUTIDA?.base64) return null;
    return {
      width: PDF_LOGO_EMBUTIDA.width,
      height: PDF_LOGO_EMBUTIDA.height,
      bytes: pdfBase64ParaBytes(PDF_LOGO_EMBUTIDA.base64),
    };
  } catch (e) {
    console.warn("Não foi possível carregar a logo embutida no PDF.", e);
    return null;
  }
}

async function pdfObterLogoJpeg() {
  // Primeiro usa a logo embutida para garantir que ela sempre apareça centralizada no PDF.
  const logoEmbutida = pdfObterLogoEmbutida();
  if (logoEmbutida) return logoEmbutida;

  const imagens = [
    document.querySelector("#saidaPrint .print-logo"),
    document.querySelector("#listaGeradaContainer .print-logo"),
    document.querySelector(".print-logo"),
  ].filter(Boolean);

  for (const img of imagens) {
    try {
      if (!img.complete || !img.naturalWidth || !img.naturalHeight) {
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
          setTimeout(resolve, 1500);
        });
      }

      if (!img.naturalWidth || !img.naturalHeight) continue;

      const maxLado = 800;
      const escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));

      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      const base64 = dataUrl.split(",")[1];
      if (!base64) continue;

      return {
        width: canvas.width,
        height: canvas.height,
        bytes: pdfBase64ParaBytes(base64),
      };
    } catch (e) {
      console.warn("Não foi possível puxar o logo para o PDF direto. O PDF será gerado sem o logo.", e);
    }
  }

  return null;
}

function pdfBytesFromStringLatin1(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    bytes.push(code <= 255 ? code : 63);
  }
  return bytes;
}

function pdfCriarArquivo(paginasConteudo, opcoes = {}) {
  const encoder = {
    bytes: [],
    addString(str) {
      this.bytes.push(...pdfBytesFromStringLatin1(str));
    },
    addBytes(arr) {
      this.bytes.push(...arr);
    },
    get length() {
      return this.bytes.length;
    }
  };

  const objects = [];
  function addObject(content) {
    objects.push(content);
    return objects.length;
  }

  const catalogId = addObject("");
  const pagesId = addObject("");
  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const logo = opcoes?.logo || null;
  const logoImageId = logo?.bytes?.length
    ? addObject({
        kind: "rawStream",
        dict: `<< /Type /XObject /Subtype /Image /Width ${Math.max(1, Math.round(logo.width || 1))} /Height ${Math.max(1, Math.round(logo.height || 1))} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>`,
        bytes: logo.bytes,
      })
    : null;
  const pageIds = [];

  paginasConteudo.forEach((conteudo) => {
    const conteudoBytes = pdfBytesFromStringLatin1(conteudo);
    const streamId = addObject(`<< /Length ${conteudoBytes.length} >>
stream
${conteudo}
endstream`);
    const xObjectResource = logoImageId ? `/XObject << /Logo ${logoImageId} 0 R >>` : "";
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> ${xObjectResource} >> /Contents ${streamId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  encoder.addString("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const offsets = [0];
  objects.forEach((obj, idx) => {
    offsets[idx + 1] = encoder.length;

    if (obj && typeof obj === "object" && obj.kind === "rawStream") {
      encoder.addString(`${idx + 1} 0 obj
${obj.dict}
stream
`);
      encoder.addBytes(Array.from(obj.bytes));
      encoder.addString(`
endstream
endobj
`);
      return;
    }

    encoder.addString(`${idx + 1} 0 obj
${obj}
endobj
`);
  });

  const xrefOffset = encoder.length;
  encoder.addString(`xref\n0 ${objects.length + 1}\n`);
  encoder.addString("0000000000 65535 f \n");
  for (let i = 1; i <= objects.length; i += 1) {
    encoder.addString(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  encoder.addString(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Uint8Array(encoder.bytes);
}

function pdfBaixarBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "lista-ebo.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

window.salvarListaGeradaPdf = async function salvarListaGeradaPdf() {
  const linhas = pdfColetarLinhasDaLista();
  if (!linhas.length) return alert("Gere a lista antes de salvar em PDF.");
  if (!exigirDataFuncaoAntesDeSaida()) return;

  try {
    gerarConferenciaMesasParaImpressao();
  } catch (e) {
    console.warn("Não foi possível atualizar a conferência antes do PDF.", e);
  }

  try {
    const logo = await pdfObterLogoJpeg();
    const paginas = pdfMontarPaginasListaGerada({ logo });
    const bytes = pdfCriarArquivo(paginas, { logo });
    pdfBaixarBytes(bytes, nomeArquivoPdfListaGerada());
  } catch (e) {
    console.error(e);
    alert("Não foi possível gerar o PDF. Veja o console do navegador (F12) para detalhes.");
  }
};

//ADICIONAR FUNCAO NOVA LINHA ANTES DE IMPRIMIR//

function adicionarLinhaManual(){
  const tabela = document.querySelector("#listaGeradaContainer table tbody");

  if(!tabela) {
    alert("Adicione uma lista primeiro.");
    return;
  }

  tabela.insertAdjacentHTML(
    "beforeend",
    montarLinhaEditavelListaGerada({ totalTxt: "", ingrediente: "", pratosTxt: "", observacoesTxt: "" }, true)
  );

  tabela.lastElementChild?.querySelector(".editQtd")?.focus();
}

window.adicionarLinhaManual = adicionarLinhaManual;


// =======================================================
// 🔹 IMPRESSÃO DAS LISTAS CADASTRADAS
// - abre o modal antes de imprimir
// - usa cache local para evitar buscar sempre no Firebase
// - no mobile desmarca fotos por padrão
// - evita limpar cedo demais a área impressa
// =======================================================

let printJobPendenteListaCadastrada = null;
window.__cacheImpressaoListas = window.__cacheImpressaoListas || {};

function salvarCacheImpressaoLista(collectionName, items = []) {
  if (!collectionName) return;

  const chaveColecao = String(collectionName).trim();
  if (!chaveColecao) return;

  if (!window.__cacheImpressaoListas[chaveColecao] || typeof window.__cacheImpressaoListas[chaveColecao] !== "object") {
    window.__cacheImpressaoListas[chaveColecao] = {};
  }

  (Array.isArray(items) ? items : []).forEach((item) => {
    const id = String(item?.id || "").trim();
    if (!id) return;
    window.__cacheImpressaoListas[chaveColecao][id] = item;
  });
}

function obterCacheImpressaoLista(collectionName, docId) {
  const chaveColecao = String(collectionName || "").trim();
  const chaveDoc = String(docId || "").trim();

  if (!chaveColecao || !chaveDoc) return null;
  return window.__cacheImpressaoListas?.[chaveColecao]?.[chaveDoc] || null;
}

function esconderModalImpressaoListaCadastrada() {
  const modal = document.getElementById("modalImpressaoListaCadastrada");
  if (modal) modal.style.display = "none";
}

function abrirModalImpressaoListaCadastrada(config = {}) {
  const modal = document.getElementById("modalImpressaoListaCadastrada");
  const titulo = document.getElementById("modalImpressaoTitulo");
  const checkboxModos = document.getElementById("checkImprimirModosListaCadastrada");
  const checkboxFotos = document.getElementById("checkImprimirFotosListaCadastrada");

  printJobPendenteListaCadastrada = config;

  if (!modal) {
    return imprimirRegistroListaCadastrada(
      config.collectionName,
      config.docId,
      config.mensagens,
      { incluirModo: true, incluirFotos: true }
    );
  }

  if (titulo) {
    titulo.textContent = config.tituloModal || "Imprimir lista";
  }

  const mobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent || "");

  if (checkboxModos) checkboxModos.checked = true;
  if (checkboxFotos) checkboxFotos.checked = !mobile;

  requestAnimationFrame(() => {
    modal.style.display = "flex";
  });
}

window.fecharModalImpressaoListaCadastrada = function fecharModalImpressaoListaCadastrada() {
  printJobPendenteListaCadastrada = null;
  esconderModalImpressaoListaCadastrada();
};

window.confirmarImpressaoListaCadastrada = async function confirmarImpressaoListaCadastrada() {
  const job = printJobPendenteListaCadastrada;
  const incluirModo = !!document.getElementById("checkImprimirModosListaCadastrada")?.checked;
  const incluirFotos = !!document.getElementById("checkImprimirFotosListaCadastrada")?.checked;

  printJobPendenteListaCadastrada = null;
  esconderModalImpressaoListaCadastrada();

  if (!job) return;

  await imprimirRegistroListaCadastrada(job.collectionName, job.docId, job.mensagens, {
    incluirModo,
    incluirFotos,
  });
};

function limparSaidaPrintListaCadastrada() {
  document.body.classList.remove("print-lista-cadastrada");

  const area = document.getElementById("saidaPrintListaCadastrada");
  const titulo = document.getElementById("printListaCadastradaNome");
  const conteudo = document.getElementById("printListaCadastradaConteudo");

  if (titulo) titulo.textContent = "";
  if (conteudo) conteudo.innerHTML = "";
  if (area) area.style.display = "none";
}

function prepararLimpezaRetornoImpressaoListaCadastrada() {
  let finalizado = false;

  const finalizar = () => {
    if (finalizado) return;
    finalizado = true;

    document.removeEventListener("visibilitychange", aoVoltarVisibilidade, true);
    window.removeEventListener("focus", aoVoltarFoco, true);

    setTimeout(() => {
      limparSaidaPrintListaCadastrada();
    }, 250);
  };

  const aoVoltarVisibilidade = () => {
    if (document.visibilityState === "visible") {
      finalizar();
    }
  };

  const aoVoltarFoco = () => {
    setTimeout(finalizar, 250);
  };

  document.addEventListener("visibilitychange", aoVoltarVisibilidade, true);
  window.addEventListener("focus", aoVoltarFoco, true);

  setTimeout(finalizar, 60000);
}

function normalizarItensBlocoImpressao(itens = []) {
  return (Array.isArray(itens) ? itens : []).filter((it) => {
    const ing = (it?.ingrediente || "").toString().trim();
    const qtd = (it?.quantidade || "").toString().trim();
    return ing || qtd;
  });
}

function normalizarFotosImpressaoLista(lista = []) {
  return (Array.isArray(lista) ? lista : [])
    .filter(Boolean)
    .slice(0, 3)
    .map((foto) => {
      if (typeof foto === "string") {
        return { src: foto, legenda: "" };
      }

      if (typeof foto === "object" && foto?.src) {
        return {
          src: foto.src,
          legenda: (foto.legenda || "").toString().trim(),
        };
      }

      return null;
    })
    .filter(Boolean);
}

function criarTabelaIngredientesBlocoImpressao(itens = []) {
  const table = document.createElement("table");
  table.className = "print-table";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th class="print-total">Quantidade</th>
      <th class="print-ing">Ingrediente</th>
    </tr>
  `;

  const tbody = document.createElement("tbody");

  if (!itens.length) {
    const tr = document.createElement("tr");
    const tdIng = document.createElement("td");
    tdIng.className = "print-ing";
    tdIng.colSpan = 2;
    tdIng.textContent = "Sem ingredientes cadastrados.";
    tr.appendChild(tdIng);
    tbody.appendChild(tr);
  } else {
    itens.forEach((it) => {
      const tr = document.createElement("tr");

      const tdQtd = document.createElement("td");
      tdQtd.className = "print-total";
      tdQtd.textContent = (it?.quantidade || "").toString().trim() || "—";

      const tdIng = document.createElement("td");
      tdIng.className = "print-ing";
      tdIng.textContent = (it?.ingrediente || "").toString().trim() || "—";

      tr.appendChild(tdQtd);
      tr.appendChild(tdIng);
      tbody.appendChild(tr);
    });
  }

  table.appendChild(thead);
  table.appendChild(tbody);
  return table;
}

function criarTituloSecaoImpressao(texto) {
  const titulo = document.createElement("div");
  titulo.className = "print-section-title";
  titulo.textContent = texto;
  return titulo;
}

function montarConteudoImpressaoListaCadastrada(data, incluirModo = true, incluirFotos = true) {
  const conteudo = document.getElementById("printListaCadastradaConteudo");
  if (!conteudo) return;

  conteudo.innerHTML = "";

  const blocos = [
    {
      tituloLista: "Lista 1",
      subtitulo: (data?.subtitulo || "").toString().trim(),
      itens: normalizarItensBlocoImpressao(
        data?.itens || data?.linhas || data?.ingredientes || []
      ),
      modo: (data?.modo || "").toString().trim(),
      fotos: normalizarFotosImpressaoLista(data?.fotosModo1),
      tituloModo: "Modo de fazer",
    },
    {
      tituloLista: "Lista 2",
      subtitulo: (data?.subtitulo2 || "").toString().trim(),
      itens: normalizarItensBlocoImpressao(
        data?.itens2 || data?.linhas2 || data?.ingredientes2 || []
      ),
      modo: (data?.modo2 || "").toString().trim(),
      fotos: normalizarFotosImpressaoLista(data?.fotosModo2),
      tituloModo: "Modo de preparo",
    },
  ];

  const blocosAtivos = blocos.filter((bloco) => {
    return (
      bloco.itens.length > 0 ||
      !!bloco.subtitulo ||
      (incluirModo && !!bloco.modo) ||
      (incluirFotos && bloco.fotos.length > 0)
    );
  });

  if (!blocosAtivos.length) {
    conteudo.innerHTML = `<div class="print-empty-message">Nenhum conteúdo disponível para impressão.</div>`;
    return;
  }

  const mostrarTituloLista = blocosAtivos.length > 1;

  blocosAtivos.forEach((bloco) => {
    const wrap = document.createElement("div");
    wrap.className = "print-list-block";

    if (mostrarTituloLista) {
      const tituloLista = document.createElement("h2");
      tituloLista.className = "print-list-block-title";
      tituloLista.textContent = bloco.tituloLista;
      wrap.appendChild(tituloLista);
    }

    if (bloco.subtitulo) {
      const subtitulo = document.createElement("div");
      subtitulo.className = "print-list-subtitle";
      subtitulo.textContent = bloco.subtitulo;
      wrap.appendChild(subtitulo);
    }

    if (bloco.itens.length > 0) {
      wrap.appendChild(criarTabelaIngredientesBlocoImpressao(bloco.itens));
    }

    const deveMostrarModo = incluirModo && !!bloco.modo;
    const deveMostrarFotos = incluirFotos && bloco.fotos.length > 0;

    if (deveMostrarModo || deveMostrarFotos) {
      wrap.appendChild(criarTituloSecaoImpressao(bloco.tituloModo));

      const modoBox = document.createElement("div");
      modoBox.className = "print-mode-box";

      if (deveMostrarModo) {
        const modoTexto = document.createElement("p");
        modoTexto.className = "print-mode-text";
        modoTexto.textContent = bloco.modo;
        modoBox.appendChild(modoTexto);
      }

      if (deveMostrarFotos) {
        const fotosWrap = document.createElement("div");
        fotosWrap.className = "print-mode-photos";

        bloco.fotos.forEach((foto, index) => {
          const fotoBox = document.createElement("div");
          fotoBox.className = "print-mode-photo";

          const img = document.createElement("img");
          img.loading = "eager";
          img.decoding = "sync";
          img.src = foto?.src || "";
          img.alt = foto?.legenda || `${bloco.tituloModo} ${index + 1}`;
          fotoBox.appendChild(img);

          const legendaTexto = (foto?.legenda || "").trim();
          if (legendaTexto) {
            const legenda = document.createElement("div");
            legenda.className = "print-mode-caption";
            legenda.textContent = legendaTexto;
            fotoBox.appendChild(legenda);
          }

          fotosWrap.appendChild(fotoBox);
        });

        modoBox.appendChild(fotosWrap);
      }

      wrap.appendChild(modoBox);
    }

    conteudo.appendChild(wrap);
  });
}

function aguardarFramesImpressao(quantidade = 2) {
  return new Promise((resolve) => {
    const passo = () => {
      if (quantidade <= 0) {
        resolve();
        return;
      }

      quantidade -= 1;
      requestAnimationFrame(passo);
    };

    requestAnimationFrame(passo);
  });
}

function aguardarImagemPronta(img, timeout = 12000) {
  return new Promise((resolve) => {
    if (!img) {
      resolve();
      return;
    }

    let finalizado = false;

    const encerrar = () => {
      if (finalizado) return;
      finalizado = true;
      clearTimeout(timer);
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
      resolve();
    };

    const onLoad = async () => {
      try {
        if (typeof img.decode === "function") {
          await img.decode().catch(() => {});
        }
      } catch (_) {}
      encerrar();
    };

    const onError = () => encerrar();
    const timer = setTimeout(encerrar, timeout);

    if (img.complete && img.naturalWidth > 0) {
      onLoad();
      return;
    }

    if (img.complete) {
      encerrar();
      return;
    }

    img.addEventListener("load", onLoad, { once: true });
    img.addEventListener("error", onError, { once: true });
  });
}

async function aguardarImagensAreaImpressao(area) {
  const imagens = Array.from(area?.querySelectorAll("img") || []);
  if (!imagens.length) return;

  await Promise.all(imagens.map((img) => aguardarImagemPronta(img)));
  await aguardarFramesImpressao(2);
}

async function imprimirRegistroListaCadastrada(collectionName, docId, mensagens = {}, opcoes = {}) {
  const area = document.getElementById("saidaPrintListaCadastrada");
  const titulo = document.getElementById("printListaCadastradaNome");
  const conteudo = document.getElementById("printListaCadastradaConteudo");

  if (!docId) {
    alert(mensagens.idNaoInformado || "ID não informado.");
    return;
  }

  if (!area || !titulo || !conteudo) {
    alert("Área de impressão não encontrada no HTML. Confira se existe #saidaPrintListaCadastrada.");
    return;
  }

  limparSaidaPrintListaCadastrada();

  try {
    let data = obterCacheImpressaoLista(collectionName, docId);

    if (!data) {
      const { db, doc, getDoc } = fb();
      const snap = await getDoc(doc(db, collectionName, String(docId)));

      if (!snap.exists()) {
        alert(mensagens.naoEncontrado || "Registro não encontrado.");
        return;
      }

      data = { id: String(docId), ...(snap.data() || {}) };
      salvarCacheImpressaoLista(collectionName, [data]);
    }

    const incluirModo = opcoes?.incluirModo !== false;
    const incluirFotos = opcoes?.incluirFotos !== false;

    titulo.textContent = data.nome || "(sem nome)";
    montarConteudoImpressaoListaCadastrada(data, incluirModo, incluirFotos);

    area.style.display = "block";
    document.body.classList.add("print-lista-cadastrada");

    await aguardarFramesImpressao(2);
    void area.offsetHeight;

    if (incluirFotos) {
      await aguardarImagensAreaImpressao(area);
    } else {
      await aguardarFramesImpressao(1);
    }

    await new Promise((resolve) => setTimeout(resolve, 80));

    prepararLimpezaRetornoImpressaoListaCadastrada();
    window.print();
  } catch (e) {
    console.error(e);
    alert(mensagens.erro || "Erro ao imprimir. Veja o console (F12).");
    limparSaidaPrintListaCadastrada();
  }
}

window.imprimirListaCadastrada = function imprimirListaCadastrada(docId) {
  return abrirModalImpressaoListaCadastrada({
    collectionName: COLLECTION,
    docId,
    tituloModal: "Imprimir lista cadastrada",
    mensagens: {
      idNaoInformado: "ID da lista não informado.",
      naoEncontrado: "Lista não encontrada.",
      erro: "Erro ao imprimir lista cadastrada. Veja o console (F12).",
    },
  });
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

// Regra especial: tiras de morim branco sempre devem mostrar a quantidade CADA na coluna Pratos.
// Ex.: mesmo que o total esteja multiplicado pelas pessoas, a coluna Pratos deve ficar:
// "9 tiras de morim branco cada" ou "tiras de morim branco (9 cada)".
const TIRAS_MORIM_BRANCO_CADA_PADRAO = "9";

function normalizarTextoMorim(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9,.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ehTirasMorimBranco(ingrediente) {
  const normalizado = normalizarTextoMorim(ingrediente);

  // Aceita: "tira de morim branco", "tiras de morim branco", "9 tiras de morim branco",
  // "tiras morim branco" e "tiras de morim branco (9 cada)".
  return /\btiras?\s+(?:de\s+)?morim\s+branco\b/.test(normalizado);
}

function adicionarQuantidadeUnica(lista, vistos, valor) {
  const numero = parseFloat(String(valor || "").replace(",", "."));
  if (!Number.isFinite(numero)) return;

  const formatado = formatNumero(numero);
  if (vistos.has(formatado)) return;

  vistos.add(formatado);
  lista.push(formatado);
}

function extrairQuantidadesTirasMorimBranco(item) {
  const quantidades = [];
  const vistos = new Set();
  const ingrediente = String(item?.ingrediente || "");
  const pratosTxt = String(item?.pratosTxt || "");
  const textos = [ingrediente, pratosTxt];

  textos.forEach((textoOriginal) => {
    const texto = normalizarTextoMorim(textoOriginal);
    let match;

    // "9 tiras de morim branco"
    const reAntes = /\b(\d+(?:[,.]\d+)?)\s+tiras?\s+(?:de\s+)?morim\s+branco\b/g;
    while ((match = reAntes.exec(texto)) !== null) {
      adicionarQuantidadeUnica(quantidades, vistos, match[1]);
    }

    // "tiras de morim branco 9 cada" ou "tiras de morim branco (9 cada)"
    const reDepois = /\btiras?\s+(?:de\s+)?morim\s+branco\s*(?:\(|-|–|—|:)?\s*(\d+(?:[,.]\d+)?)\s*(?:cada|por\s+pessoa|por\s+prato)?\b/g;
    while ((match = reDepois.exec(texto)) !== null) {
      adicionarQuantidadeUnica(quantidades, vistos, match[1]);
    }

    // "um prato de 9", "três pratos de 9", etc.
    const rePratos = /\bde\s+(\d+(?:[,.]\d+)?)\b/g;
    while ((match = rePratos.exec(texto)) !== null) {
      adicionarQuantidadeUnica(quantidades, vistos, match[1]);
    }

    // "(9 cada)", "9 cada", "9 por pessoa"
    const reCada = /\b(\d+(?:[,.]\d+)?)\s*(?:cada|por\s+pessoa|por\s+prato)\b/g;
    while ((match = reCada.exec(texto)) !== null) {
      adicionarQuantidadeUnica(quantidades, vistos, match[1]);
    }
  });

  // Se o sistema achou apenas "1", isso normalmente vem de "um prato de 1".
  // Para este item específico, o correto pedido é 9 cada, então ignoramos o 1 e usamos 9.
  const semUm = quantidades.filter((qtd) => parseFloat(String(qtd).replace(",", ".")) !== 1);
  return semUm.length ? semUm : [];
}

function montarTextoTirasMorimBranco(item) {
  const quantidades = extrairQuantidadesTirasMorimBranco(item);
  const qtds = quantidades.length ? quantidades : [TIRAS_MORIM_BRANCO_CADA_PADRAO];

  const partes = qtds.map((qtd) => `${qtd} tiras de morim branco cada`);

  if (partes.length === 1) return partes[0];
  if (partes.length === 2) return `${partes[0]} e ${partes[1]}`;
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

// =======================================================
// APRIMORAMENTO: coluna "Pratos" didática e automática
// - Mantém a lógica de cálculo/consolidação existente.
// - Só troca o texto exibido na coluna Pratos.
// - Não mexe em bolas: qualquer ingrediente com "bola/bolas" continua igual.
// - Primeiro respeita tratamentos já existentes (morim, tiras, casal de bruxo,
//   mingau). Depois classifica automaticamente por tipo de ingrediente.
// - Se não reconhecer o tipo, usa "porção" para ficar didático sem precisar
//   criar tratamento item por item.
// =======================================================
const NUMEROS_PRATOS_PT = {
  "um": 1,
  "uma": 1,
  "dois": 2,
  "duas": 2,
  "tres": 3,
  "três": 3,
  "quatro": 4,
  "cinco": 5,
  "seis": 6,
  "sete": 7,
  "oito": 8,
  "nove": 9,
  "dez": 10,
  "onze": 11,
  "doze": 12,
  "treze": 13,
  "quatorze": 14,
  "catorze": 14,
  "quinze": 15,
  "dezesseis": 16,
  "dezessete": 17,
  "dezoito": 18,
  "dezenove": 19,
  "vinte": 20
};

const NUMERO_PRATOS_PATTERN = "\\d+|um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte";

const CLASSIFICADOR_PRATOS_AUTOMATICO = [
  // 1) Recipientes/objetos citados no próprio ingrediente
  { tipo: "recipiente", singular: "cesto de vime", plural: "cestos de vime", genero: "m", padroes: [/\bcestos?(?:\s+de)?\s+vime\b/] },
  { tipo: "recipiente", singular: "bacia", plural: "bacias", genero: "f", padroes: [/\bbacias?\b/] },
  { tipo: "recipiente", singular: "alguidar", plural: "alguidares", genero: "m", padroes: [/\balguidar(?:es)?\b/] },
  { tipo: "recipiente", singular: "pote", plural: "potes", genero: "m", padroes: [/\bpotes?\b/] },
  { tipo: "recipiente", singular: "quartinha", plural: "quartinhas", genero: "f", padroes: [/\bquartinhas?\b/] },
  { tipo: "recipiente", singular: "moringa", plural: "moringas", genero: "f", padroes: [/\bmoringas?\b/] },
  { tipo: "recipiente", singular: "garrafa", plural: "garrafas", genero: "f", padroes: [/\bgarrafas?\b/] },
  { tipo: "recipiente", singular: "copo", plural: "copos", genero: "m", padroes: [/\bcopos?\b/] },
  { tipo: "recipiente", singular: "taça", plural: "taças", genero: "f", padroes: [/\btacas?\b/] },
  { tipo: "recipiente", singular: "jarra", plural: "jarras", genero: "f", padroes: [/\bjarras?\b/] },
  { tipo: "recipiente", singular: "cumbuca", plural: "cumbucas", genero: "f", padroes: [/\bcumbucas?\b/] },
  { tipo: "recipiente", singular: "cuia", plural: "cuias", genero: "f", padroes: [/\bcuias?\b/] },
  { tipo: "recipiente", singular: "gamela", plural: "gamelas", genero: "f", padroes: [/\bgamelas?\b/] },
  { tipo: "recipiente", singular: "travessa", plural: "travessas", genero: "f", padroes: [/\btravessas?\b/] },
  { tipo: "recipiente", singular: "tigela", plural: "tigelas", genero: "f", padroes: [/\btigelas?\b/] },
  { tipo: "recipiente", singular: "panela", plural: "panelas", genero: "f", padroes: [/\bpanelas?\b/] },
  { tipo: "recipiente", singular: "balaio", plural: "balaios", genero: "m", padroes: [/\bbalaios?\b/] },
  { tipo: "recipiente", singular: "cesta", plural: "cestas", genero: "f", padroes: [/\bcestas?\b/] },
  { tipo: "recipiente", singular: "vaso", plural: "vasos", genero: "m", padroes: [/\bvasos?\b/] },
  { tipo: "recipiente", singular: "saco", plural: "sacos", genero: "m", padroes: [/\bsacos?\b/] },
  { tipo: "recipiente", singular: "sacola", plural: "sacolas", genero: "f", padroes: [/\bsacolas?\b/] },
  { tipo: "recipiente", singular: "pacote", plural: "pacotes", genero: "m", padroes: [/\bpacotes?\b/] },
  { tipo: "recipiente", singular: "caixa", plural: "caixas", genero: "f", padroes: [/\bcaixas?\b/] },

  // 2) Comidas secas/grãos/farinhas: normalmente ficam melhor em bacia
  {
    tipo: "alimento_volume",
    singular: "bacia",
    plural: "bacias",
    genero: "f",
    padroes: [
      /\bpipocas?\b/, /\barroz\b/, /\bfeij(?:ao|oes)\b/, /\bmilho\b/,
      /\bcanjicas?\b/, /\bamendoins?\b/, /\bfubas?\b/, /\bfarinhas?\b/,
      /\bfarofas?\b/, /\blentilhas?\b/, /\bgraos?\b/, /\bsementes?\b/,
      /\balpistes?\b/, /\bacucares?\b/, /\bsais?\b/, /\bcafes?\b/,
      /\bpade\b/, /\bpad[eê]s\b/
    ]
  },

  // 3) Líquidos e bebidas
  {
    tipo: "bebida",
    singular: "garrafa",
    plural: "garrafas",
    genero: "f",
    padroes: [
      /\baguas?\b/, /\bvinhos?\b/, /\bcachacas?\b/, /\bmarafo\b/,
      /\bmarafa\b/, /\bcervejas?\b/, /\brefrigerantes?\b/, /\bsucos?\b/,
      /\blicores?\b/, /\bchampanhes?\b/, /\bchampagnes?\b/
    ]
  },
  {
    tipo: "liquido_oleoso",
    singular: "frasco",
    plural: "frascos",
    genero: "m",
    padroes: [
      /\bazeites?\b/, /\boleos?\b/, /\bdende\b/, /\bmel\b/,
      /\bmelado\b/, /\bperfumes?\b/, /\bessencias?\b/, /\blavandas?\b/
    ]
  },

  // 4) Folhas, ervas e flores
  {
    tipo: "folhas_ervas",
    singular: "maço",
    plural: "maços",
    genero: "m",
    padroes: [
      /\bfolhas?\b/, /\bervas?\b/, /\barruda\b/, /\bguine\b/,
      /\balecrim\b/, /\bmanjericao\b/, /\blouro\b/, /\beucalipto\b/,
      /\bespada\s+de\s+sao\s+jorge\b/, /\babre\s+caminho\b/,
      /\bflores?\b/, /\brosas?\b/, /\bpalmas?\b/, /\bgirassois?\b/
    ]
  },

  // 5) Tecidos e amarrações, exceto morim, que já tem tratamento próprio
  {
    tipo: "tecido",
    singular: "pedaço",
    plural: "pedaços",
    genero: "m",
    padroes: [/\bpanos?\b/, /\btecidos?\b/, /\bfitas?\b/, /\blacos?\b/]
  },

  // 6) Itens contáveis comuns
  { tipo: "vela", singular: "vela", plural: "velas", genero: "f", padroes: [/\bvelas?\b/] },
  { tipo: "charuto", singular: "charuto", plural: "charutos", genero: "m", padroes: [/\bcharutos?\b/] },
  { tipo: "cigarro", singular: "cigarro", plural: "cigarros", genero: "m", padroes: [/\bcigarros?\b/] },
  { tipo: "fosforo", singular: "caixa de fósforo", plural: "caixas de fósforo", genero: "f", padroes: [/\bfosforos?\b/] },
  { tipo: "pemba", singular: "pemba", plural: "pembas", genero: "f", padroes: [/\bpembas?\b/] },
  { tipo: "moeda", singular: "moeda", plural: "moedas", genero: "f", padroes: [/\bmoedas?\b/] },
  { tipo: "buzio", singular: "búzio", plural: "búzios", genero: "m", padroes: [/\bbuzios?\b/] },
  { tipo: "pedra", singular: "pedra", plural: "pedras", genero: "f", padroes: [/\bpedras?\b/] },
  { tipo: "ovo", singular: "ovo", plural: "ovos", genero: "m", padroes: [/\bovos?\b/] },
  { tipo: "coco", singular: "coco", plural: "cocos", genero: "m", padroes: [/\bcocos?\b/] },

  // 7) Frutas pelo nome ou pela palavra "fruta"
  {
    tipo: "fruta",
    singular: "fruta",
    plural: "frutas",
    genero: "f",
    padroes: [
      /\bfrutas?\b/, /\bbananas?\b/, /\bmacas?\b/, /\blaranjas?\b/,
      /\blimoes?\b/, /\bperas?\b/, /\buvas?\b/, /\bmangas?\b/,
      /\bmamoes?\b/, /\bmelancias?\b/, /\babacaxis?\b/, /\babacates?\b/,
      /\bgoiabas?\b/, /\bpessegos?\b/
    ]
  },

  // 8) Comidas/itens rituais contáveis
  {
    tipo: "unidade",
    singular: "unidade",
    plural: "unidades",
    genero: "f",
    padroes: [
      /\bobis?\b/, /\borogbos?\b/, /\bacacas?\b/, /\bacarajes?\b/,
      /\bpaes?\b/, /\bpeixes?\b/, /\bfrangos?\b/, /\bgalinhas?\b/,
      /\bgalos?\b/, /\bpatos?\b/, /\bpombos?\b/
    ]
  }
];

function numeroTextoPratosParaNumero(valor) {
  const texto = normalizarTexto(valor || "");
  if (!texto) return null;

  const numero = parseInt(texto, 10);
  if (Number.isFinite(numero)) return numero;

  return NUMEROS_PRATOS_PT[texto] || null;
}

function numeroExtensoComGenero(numero, genero = "m") {
  const base = extenso(numero);

  if (genero === "f") {
    if (base === "um") return "uma";
    if (base === "dois") return "duas";
  }

  return base;
}

function textoPessoaPratos(numero) {
  const n = Number(numero) || 1;
  return `${n} ${n === 1 ? "pessoa" : "pessoas"}`;
}

function juntarTextosComE(partes) {
  const itens = (Array.isArray(partes) ? partes : [])
    .map((p) => String(p || "").trim())
    .filter(Boolean);

  if (!itens.length) return "";
  if (itens.length === 1) return itens[0];
  if (itens.length === 2) return `${itens[0]} e ${itens[1]}`;
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

function extrairGruposTextoPratos(textoPratos) {
  const texto = String(textoPratos || "").trim();
  if (!texto || texto === "—") return [];

  const grupos = [];
  const re = new RegExp(`\\b(${NUMERO_PRATOS_PATTERN})\\s+pratos?\\s+de\\s+([0-9]+(?:[,.][0-9]+)?)\\b`, "gi");

  let match;
  while ((match = re.exec(texto)) !== null) {
    const pessoas = numeroTextoPratosParaNumero(match[1]);
    const quantidadeBase = parseFloat(String(match[2] || "").replace(",", "."));

    if (Number.isFinite(pessoas) && pessoas > 0) {
      grupos.push({
        pessoas,
        quantidadeBase: Number.isFinite(quantidadeBase) ? quantidadeBase : null
      });
    }
  }

  return grupos;
}

function ingredienteTemBola(ingrediente) {
  return /\bbolas?\b/.test(normalizarTexto(ingrediente || ""));
}

function classificarIngredienteParaPratos(ingrediente) {
  const ing = normalizarTexto(ingrediente || "");

  if (!ing || ingredienteTemBola(ing)) return null;

  return CLASSIFICADOR_PRATOS_AUTOMATICO.find((regra) => {
    return (regra.padroes || []).some((padrao) => padrao.test(ing));
  }) || {
    tipo: "generico",
    singular: "porção",
    plural: "porções",
    genero: "f"
  };
}

function regraEhItemContavel(regra) {
  const tiposContaveis = new Set([
    "vela", "charuto", "cigarro", "fosforo", "pemba", "moeda",
    "buzio", "pedra", "ovo", "coco", "fruta", "unidade"
  ]);

  return tiposContaveis.has(String(regra?.tipo || ""));
}

function nomePorQuantidade(regra, quantidade) {
  const n = Number(quantidade);
  return Number.isFinite(n) && n === 1 ? regra.singular : regra.plural;
}

function montarTextoDidaticoPratos(textoPratos, ingrediente, regra) {
  const grupos = extrairGruposTextoPratos(textoPratos);
  if (!grupos.length || !regra) return "";

  const partes = grupos.map((grupo) => {
    const pessoas = Number(grupo.pessoas) || 1;
    const qtdBase = Number(grupo.quantidadeBase);
    const temQtdBase = Number.isFinite(qtdBase);
    const qtdBaseTxt = temQtdBase ? formatNumero(qtdBase) : "";

    // Itens contáveis mantêm a lógica antiga do "de X" como quantidade por pessoa.
    // Ex.: "um prato de 7" vira "7 velas para 1 pessoa".
    // Ex.: "dois pratos de 7" vira "7 velas para cada uma das 2 pessoas".
    if (regraEhItemContavel(regra) && temQtdBase) {
      const nomeItem = nomePorQuantidade(regra, qtdBase);
      if (pessoas === 1) {
        return `${qtdBaseTxt} ${nomeItem} para 1 pessoa`;
      }
      return `${qtdBaseTxt} ${nomeItem} para cada uma das ${pessoas} pessoas`;
    }

    // Recipientes/porções preservam a lógica antiga: quantidade de pessoas
    // define quantos recipientes; o "de X" continua quando X é diferente de 1.
    // Ex.: "um prato de 7" vira "uma bacia de 7 para 1 pessoa".
    // Ex.: "dois pratos de 7" vira "duas bacias de 7 para 2 pessoas".
    const nomeItem = pessoas === 1 ? regra.singular : regra.plural;
    const quantidadeItem = numeroExtensoComGenero(pessoas, regra.genero);
    const detalheQuantidade = temQtdBase && qtdBase !== 1 ? ` de ${qtdBaseTxt}` : "";

    return `${quantidadeItem} ${nomeItem}${detalheQuantidade} para ${textoPessoaPratos(pessoas)}`;
  });

  const partesUnicas = [];
  const vistos = new Set();

  partes.forEach((parte) => {
    const chave = normalizarTexto(parte);
    if (vistos.has(chave)) return;
    vistos.add(chave);
    partesUnicas.push(parte);
  });

  return juntarTextosComE(partesUnicas);
}

function montarTextoPratosLista(item) {
  let textoPratos = item?.pratosTxt || "—";
  const ingrediente = item?.ingrediente || "";
  const ingLower = ingrediente
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  // Pedido: bolas já estão certas, então não mexe nelas.
  if (ingredienteTemBola(ingrediente)) {
    return textoPratos || "—";
  }

  // Regra já existente para tiras de morim branco
  if (ehTirasMorimBranco(ingrediente)) {
    return montarTextoTirasMorimBranco(item);
  }

  const qtd = parseInt(item?.totalTxt, 10) || 1;

  // ==============================
  // TRATAMENTOS EXISTENTES
  // ==============================

  // Mingau / mingaus:
  // Exemplo: "um prato de 4" vira "um pote com 4"
  if (/\bmingaus?\b/.test(ingLower)) {
    return textoPratos
      .replace(/\bpratos?\s+de\b/gi, (match) => {
        return match.toLowerCase().includes("pratos") ? "potes com" : "pote com";
      })
      .replace(/\bprato\b/gi, "pote")
      .replace(/\bpratos\b/gi, "potes");
  }

  // Morim
  if (ingLower.includes("morim")) {
    textoPratos = `${qtd} morim preto, vermelho e branco`;
  }

  // Casal de bruxo
  else if (ingLower.includes("casal de bruxo")) {
    textoPratos = `${qtd} casal de bruxo`;
  }

  if (ingLower.includes("morim")) {
    textoPratos = textoPratos
      .replace(/pratos/g, "morim")
      .replace(/prato/g, "morim");
  }

  // ==============================
  // CLASSIFICAÇÃO AUTOMÁTICA
  // ==============================
  const regraAutomatica = classificarIngredienteParaPratos(ingrediente);
  const textoAutomatico = montarTextoDidaticoPratos(textoPratos, ingrediente, regraAutomatica);

  if (textoAutomatico) return textoAutomatico;

  return textoPratos || "—";
}

// =======================================================
// ORDEM PERSONALIZADA DOS INGREDIENTES NA LISTA GERADA
// =======================================================
// O arquivo ainda não tinha uma ordem fixa de prioridade.
// A ordem original vinha de "ordemAtual" e depois:
//   sort((a, b) => a.ordem - b.ordem)
//
// Para escolher quais ingredientes aparecem no começo, preencha a lista abaixo.
// A ordem escrita aqui será a ordem do começo da lista.
//
// Exemplos:
// const INGREDIENTES_PRIORIDADE_INICIO = [
//   "cesto de vime",
//   "pipoca",
//   "vela branca",
//   "morim",
//   "padezinhos"
// ];
//
// Se deixar vazio, a lista continua exatamente na ordem antiga.
const INGREDIENTES_PRIORIDADE_INICIO = [
  // Coloque aqui os ingredientes que você quer puxar para o começo.
  // Exemplo:
   "bolas de acaças",
   "acaças no formato da bananeira",
   "bolas de farinha",
   "bolas de arroz",
    "bolas de fubá",
   "bolas de sagu",
   "bolas de inhame",
    "bolas de feijão preto",
    "bolas de feijão fradinho",
    "bolas de feijão branco",
    "Bolas de canjica",
    "bolas de farinha com mel",
    "bolas de farinha com efum ralado",
    "bolas de algodão",
    "tapiocas",
    "acarajés",
    "acarajés no azeite doce",
    "ekurus",
    "ekurus de feijão branco ",
    "7 qualidades de cereais torrados",
    "9 qualidades de cereais torrados",
    "feijão fradinho torrados",
    "canjica torrada (prato)",
    "arroz torrado (prato)",
    "amendoim torrado (prato)",
    "7 qualidades de feijões torrados",
     "9 qualidades de feijões torrados",
     "7 qualidades de feijões aferventado",
    "9 qualidades de feijões aferventado",
    "feijão branco aferventado (Prato)",
     "feijão fradinho aferventado (Prato)",
     "amendoim aferventado (prato)",
     "arroz lavado (prato)",
     "feijão fradinho cozido",
    "mingaus",
     "Padezinhos",
     "Padê de dendê",
     "Padê de mel",
     "Padê de água",
     "7 qualidades de legumes picados",
    "9 qualidades de legumes picados",
    "11 qualidades de legumes picados",
    "canjica (prato)",
      "punhado canjica cozida",
       "prato de girassol",
      "Repolho Picado",
      "7 qualidades de miúdos bovinos",
      "sardinha ( 9 cada prato)",
      "pedaços de carne de porco ( 9 cada prato)",
      "pedaços de carne de segunda ( 9 cada prato)",
      "Tuia",
      "cabeça de farinha ( com olhos,boca,nariz,e orelhas)",
      "charuto tipo batuta",
      "velas brancas",
       "velas brancas de 7 horas",
        "Moedas Atuais",
        "quiabos",
        "cocos secos",
        "Cebola roxa",
        "Cebola Fêmeas ( redondas)",
        "obis brancos",
        "bolas de gude branca",
        "búzios",
        "cocadas brancas",
         "ovos",
       "ovos de galinha",
       "ovos de codorna",
       "ovos de pombo",
       "Ovos de pata",
        "cesto de vime",  
        "abanos de palha",
        "Casal de bruxo",
        "Linhas coloridas",
        "Linha branca",
        "3 linhas ( branca, preta, vermelha)",
        "colheres de pau",
        "vara de amora",
        "varas de goiabeira ou Amora",
        "folhas de oxibatá",
        "ervas para ''bater'' na pessoa EBÓ CAMINHO: para-raio,amora e peregum",
        "pemba branca",
        "Facas de madeira",
        "cadarço",
        "pano de saco branco",
        "pregos",
        "caixa de fosforo",
        "Moringa de barro (Homem) ou Panelçinhas de barro (Mulher)",
        "Folhas de peregum",
        "Folhas de couve",
        "folhas de saião",
        "favas de trigo",
        "morim preto,vermelho e branco",
        "Tiras morim branco (9 tiras para cada)",
        "Tiras de morim branco (10 tiras para cada)",
        "Morim Branco",
        "9 Palmos morim branco, preto e vermelho ",
        "pães dormidos",
        "Alguida de barro N5 Pintado de Efum",
        "alguidar de barro N4",
        "pipoca",
        "Pipoca no EPÓ doce ",
        "Pêras ou Maçã Verdes",



];  

function indicePrioridadeIngredienteLista(ingrediente) {
  const chave = chaveIngrediente(ingrediente || "");
  if (!chave) return -1;

  return INGREDIENTES_PRIORIDADE_INICIO.findIndex((nomePrioridade) => {
    const prioridade = chaveIngrediente(nomePrioridade || "");
    if (!prioridade) return false;

    // Aceita igual ou parecido.
    // Ex.: "cesto vime" encontra "cesto de vime".
    return chave === prioridade || chave.includes(prioridade) || prioridade.includes(chave);
  });
}

function ordenarLinhasGeradasComPrioridade(linhas) {
  return (Array.isArray(linhas) ? linhas : []).slice().sort((a, b) => {
    const prioridadeA = indicePrioridadeIngredienteLista(a?.ingrediente || "");
    const prioridadeB = indicePrioridadeIngredienteLista(b?.ingrediente || "");

    const aTemPrioridade = prioridadeA >= 0;
    const bTemPrioridade = prioridadeB >= 0;

    if (aTemPrioridade || bTemPrioridade) {
      if (!aTemPrioridade) return 1;
      if (!bTemPrioridade) return -1;
      if (prioridadeA !== prioridadeB) return prioridadeA - prioridadeB;
    }

    // Mantém a lógica antiga para todo o resto.
    return (Number(a?.ordem) || 0) - (Number(b?.ordem) || 0);
  });
}


// =======================================================
// 🔹 CONFERÊNCIA DE MESA NA IMPRESSÃO
// - NÃO aparece na tela principal
// - Sai no final da impressão da lista gerada
// - Quantidade fica como foi cadastrada na lista do ebó
// - A quantidade de pessoas vira quantidade de caixas OK
// =======================================================
function montarCaixasConferenciaMesa(qtdPessoas) {
  const total = Math.max(1, Number(qtdPessoas) || 1);
  let html = "";

  for (let i = 1; i <= total; i++) {
    html += `<span class="check-conferencia" title="Pessoa ${i}"></span>`;
  }

  return html;
}

function montarQuantidadeConferenciaMesa(item) {
  const qtd = (item?.quantidade ?? "").toString().trim();
  return qtd || "—";
}

function montarItensConferenciaMesa(lista) {
  const itens = Array.isArray(lista?.itens) ? lista.itens : [];

  if (!itens.length) {
    return `
      <tr>
        <td class="conf-ok">${montarCaixasConferenciaMesa(lista?.pratos || 1)}</td>
        <td class="conf-qtd">—</td>
        <td class="conf-ing">Nenhum ingrediente encontrado nesta lista.</td>
      </tr>
    `;
  }

  return itens.map((item) => `
    <tr>
      <td class="conf-ok">${montarCaixasConferenciaMesa(lista?.pratos || 1)}</td>
      <td class="conf-qtd">${escaparHTML(montarQuantidadeConferenciaMesa(item))}</td>
      <td class="conf-ing">${escaparHTML(item?.ingrediente || "")}</td>
    </tr>
  `).join("");
}

function gerarConferenciaMesasParaImpressao() {
  let container = document.getElementById("printConferenciaMesas");

  // Segurança: se o HTML antigo ainda não tiver o container, cria automaticamente.
  if (!container) {
    const saida = document.getElementById("saidaPrint");
    if (!saida) return;
    container = document.createElement("div");
    container.id = "printConferenciaMesas";
    container.className = "print-conferencia-mesas";
    saida.appendChild(container);
  }

  const listas = Array.isArray(window.__listasAcumuladas) ? window.__listasAcumuladas : [];

  if (!listas.length) {
    container.innerHTML = "";
    return;
  }

  const totalMesas = listas.length;
  const totalPessoas = listas.reduce((acc, lista) => acc + Math.max(1, Number(lista?.pratos) || 1), 0);
  const totalItens = listas.reduce((acc, lista) => acc + (Array.isArray(lista?.itens) ? lista.itens.length : 0), 0);

  const mesasHtml = listas.map((lista, idx) => {
    const numeroMesa = String(idx + 1).padStart(2, "0");
    const qtdPessoas = Math.max(1, Number(lista?.pratos) || 1);
    const rotuloPessoas = qtdPessoas === 1 ? "pessoa / prato" : "pessoas / pratos";

    return `
      <section class="conf-mesa-bloco">
        <div class="conf-mesa-topo">
          <div class="conf-mesa-titulo-wrap">
            <div class="conf-mesa-badge">Mesa ${numeroMesa}</div>
            <div class="conf-mesa-titulos">
              <h2>${escaparHTML(lista?.nome || "Ebó")}</h2>
              <p>Checklist de separação e conferência individual</p>
            </div>
          </div>

          <div class="conf-mesa-pessoas">
            <strong>${qtdPessoas}</strong>
            <span>${rotuloPessoas}</span>
          </div>
        </div>

        <table class="conf-mesa-table">
          <thead>
            <tr>
              <th class="conf-ok">OK</th>
              <th class="conf-qtd">Quantidade</th>
              <th class="conf-ing">Ingrediente</th>
            </tr>
          </thead>
          <tbody>
            ${montarItensConferenciaMesa(lista)}
          </tbody>
        </table>

        <div class="conf-observacao-box">
          <div class="conf-observacao-titulo">Observações</div>
          <div class="conf-observacao-linhas" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </section>
    `;
  }).join("");

  container.innerHTML = `
    <section class="conf-capa">
      <div class="conf-capa-label">Controle de Separação e Conferência</div>
      <h1>Conferência de Mesa</h1>
      <div class="conf-capa-subtitle">Organização dos ingredientes por mesa, com marcação de conferência e campo de observações.</div>

      <div class="conf-resumo-grid">
        <div class="conf-resumo-card">
          <strong>${totalMesas}</strong>
          <span>${totalMesas === 1 ? "Mesa" : "Mesas"}</span>
        </div>
        <div class="conf-resumo-card">
          <strong>${totalPessoas}</strong>
          <span>${totalPessoas === 1 ? "Pessoa / Prato" : "Pessoas / Pratos"}</span>
        </div>
        <div class="conf-resumo-card">
          <strong>${totalItens}</strong>
          <span>${totalItens === 1 ? "Item" : "Itens"}</span>
        </div>
      </div>
    </section>
    ${mesasHtml}
  `;
}


function formatarQuantidadeObservacao(valor, unidade = "") {
  const numero = Number(valor);
  const valorTxt = Number.isFinite(numero) ? formatNumero(numero) : String(valor || "").trim();
  const unidadeTxt = String(unidade || "").trim();
  return `${valorTxt}${unidadeTxt ? " " + unidadeTxt : ""}`.trim();
}

function rotuloTotalObservacao(unidade = "", total = null) {
  const unidadeTxt = String(unidade || "").trim();
  if (unidadeTxt) return unidadeTxt;

  const numero = Number(total);
  return Number.isFinite(numero) && Math.abs(numero) === 1 ? "unidade" : "unidades";
}

function inicializarOrigemObservacaoGrupo(grupo) {
  if (!grupo) return;
  if (!grupo.origensMap) grupo.origensMap = {};
  if (!grupo.origensOrdem) grupo.origensOrdem = [];
  if (!grupo.observacoesMap) grupo.observacoesMap = {};
  if (!grupo.observacoesOrdem) grupo.observacoesOrdem = [];
}

function adicionarOrigemObservacaoGrupo(grupo, dados = {}) {
  inicializarOrigemObservacaoGrupo(grupo);
  if (!grupo) return;

  const nome = String(dados.listaNome || "Ebó").trim() || "Ebó";
  const pessoas = Math.max(1, Number(dados.pessoas) || 1);
  const quantidadeRaw = String(dados.quantidadeRaw ?? "").trim();
  const parsed = dados.parsed || parseQuantidadeComUnidade(quantidadeRaw);

  const origemKey = normalizarTexto(nome);
  if (origemKey && !grupo.origensMap[origemKey]) {
    grupo.origensMap[origemKey] = nome;
    grupo.origensOrdem.push(origemKey);
  }

  let textoObservacao = "";
  if (parsed?.ok) {
    const quantidadeBase = Number(parsed.value) || 0;
    const unidade = String(parsed.unit || dados.unidade || "").trim();
    const total = Number.isFinite(Number(dados.total)) ? Number(dados.total) : quantidadeBase * pessoas;
    const totalTxt = `${formatNumero(total)} ${rotuloTotalObservacao(unidade, total)}`;
    textoObservacao = `${pessoas}x ${nome} (${totalTxt})`;
  } else {
    textoObservacao = `${pessoas}x ${nome}${quantidadeRaw ? " " + quantidadeRaw : ""}`.trim();
  }

  const observacaoKey = normalizarTexto(textoObservacao);
  if (observacaoKey && !grupo.observacoesMap[observacaoKey]) {
    grupo.observacoesMap[observacaoKey] = textoObservacao;
    grupo.observacoesOrdem.push(observacaoKey);
  }
}

function montarTextoOrigensLinha(item) {
  const valores = (item?.origensOrdem || [])
    .map((key) => item?.origensMap?.[key])
    .filter(Boolean);

  return valores.length ? valores.join("\n") : "—";
}

function montarTextoObservacoesLinha(item) {
  const valores = (item?.observacoesOrdem || [])
    .map((key) => item?.observacoesMap?.[key])
    .filter(Boolean);

  return valores.length ? valores.join("\n") : "—";
}


function formatarDataFuncaoPorExtenso(valor) {
  const value = String(valor || "").trim();
  if (!value) return "";

  const partes = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let data = null;

  if (partes) {
    data = new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
  } else {
    const tentativa = new Date(value);
    if (!Number.isNaN(tentativa.getTime())) data = tentativa;
  }

  if (!data || Number.isNaN(data.getTime())) return "";

  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];

  return `${data.getDate()} de ${meses[data.getMonth()]} de ${data.getFullYear()}`;
}

function obterTextoDataFuncao() {
  const dataInput = document.getElementById("dataFuncao");
  const dataTxt = formatarDataFuncaoPorExtenso(dataInput?.value || "");
  return dataTxt ? `Função do dia ${dataTxt}.` : "";
}

function atualizarDataFuncaoNaLista() {
  const texto = obterTextoDataFuncao();

  const printData = document.getElementById("printFuncaoData");
  if (printData) printData.textContent = texto;

  document.querySelectorAll(".preview-funcao-data").forEach((el) => {
    el.textContent = texto;
  });

  return texto;
}

function exigirDataFuncaoAntesDeSaida() {
  const texto = atualizarDataFuncaoNaLista();
  if (!texto) {
    alert("Informe o dia da função antes de imprimir ou salvar em PDF.");
    document.getElementById("dataFuncao")?.focus();
    return false;
  }
  return true;
}

function nomeArquivoPdfListaGerada() {
  const dataInput = document.getElementById("dataFuncao");
  const data = String(dataInput?.value || "").trim() || "sem-data";
  return `lista-ebo-funcao-${data}.pdf`;
}

window.atualizarDataFuncaoNaLista = atualizarDataFuncaoNaLista;

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
          __listaNome: lista.nome || "Ebó",
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
            origensMap: {},
            origensOrdem: [],
            observacoesMap: {},
            observacoesOrdem: [],
          };
        }

        const grupo = consolidadosPade[chavePade];
        const totalBase = Number(infoPade.totalBase) || 0;
        grupo.total += totalBase * multiplicador;
        adicionarOrigemObservacaoGrupo(grupo, {
          listaNome: it.__listaNome,
          pessoas: multiplicador,
          quantidadeRaw: String(totalBase || infoPade.totalBase || ""),
          parsed: { ok: true, value: totalBase, unit: "" },
          total: totalBase * multiplicador,
        });

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
          origensMap: {},
          origensOrdem: [],
          observacoesMap: {},
          observacoesOrdem: [],
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

      adicionarOrigemObservacaoGrupo(consolidados[chave], {
        listaNome: it.__listaNome,
        pessoas: multiplicador,
        quantidadeRaw: it.quantidade,
        parsed,
        total: parsed.ok ? parsed.value * multiplicador : null,
      });
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
        origensTxt: montarTextoOrigensLinha(item),
        observacoesTxt: montarTextoObservacoesLinha(item),
      };
    });

    const linhasPade = Object.values(consolidadosPade).map((item) => ({
      ordem: item.ordem,
      totalTxt: item.total ? formatNumero(item.total) : "—",
      ingrediente: item.ingrediente,
      pratosTxt: formatarDetalhesQualidadesPade(item),
      origensTxt: montarTextoOrigensLinha(item),
      observacoesTxt: montarTextoObservacoesLinha(item),
    }));

    const linhas = ordenarLinhasGeradasComPrioridade([...linhasNormais, ...linhasPade]);

    // 🔹 MOSTRAR LISTA NO CARD "Lista gerada" no mesmo visual da tabela final
    const container = document.getElementById("listaGeradaContainer");

    const linhasHtml = linhas.length
      ? linhas.map((item) => montarLinhaEditavelListaGerada({
          totalTxt: item.totalTxt,
          ingrediente: item.ingrediente,
          pratosTxt: montarTextoPratosLista(item),
          observacoesTxt: item.observacoesTxt || "—",
        })).join("")
      : `
          <tr>
            <td class="print-total" data-label="Quantidades">—</td>
            <td class="print-ing" data-label="Ingredientes">Nenhum item gerado.</td>
            <td class="print-pratos print-origens" data-label="Origens">—</td>
            <td class="print-observacoes" data-label="Observações">—</td>
          </tr>
        `;

    if (container) {
      container.innerHTML = `
        <section class="preview-print-area">
          <div class="print-header">
            <img src="./imagem.png" alt="Ilê D'Ogum" class="print-logo">
            <h1 class="preview-print-title">Ilê D'Ogum</h1>
            <div class="print-funcao-data preview-funcao-data">${obterTextoDataFuncao()}</div>
          </div>

          <table class="print-table">
            <thead>
              <tr>
                <th class="print-total">Quantidades</th>
                <th class="print-ing">Ingredientes</th>
                <th class="print-pratos print-origens">Origens</th>
                <th class="print-observacoes">Observações</th>
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
    atualizarDataFuncaoNaLista();

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

const tdOrigens = document.createElement("td");
tdOrigens.className = "print-pratos print-origens";
tdOrigens.textContent = montarTextoPratosLista(item);

const tdObservacoes = document.createElement("td");
tdObservacoes.className = "print-observacoes";
tdObservacoes.textContent = item.observacoesTxt || "—";

      tr.appendChild(tdTotal);
      tr.appendChild(tdIng);
      tr.appendChild(tdOrigens);
      tr.appendChild(tdObservacoes);
      tbody.appendChild(tr);
    });

    gerarConferenciaMesasParaImpressao();

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
window.adicionarListaAcumulada = async function(docId = null) {
  let eboNome, lista = null;

  if (docId) {
    // busca lista pelo id no cache
    lista = obterCacheImpressaoLista('listas', docId);
    if (!lista) {
      alert("Lista não encontrada no cache.");
      return;
    }
    eboNome = lista.nome;
  } else {
    eboNome = ($("eboNome")?.value || "").trim();
  }

  if (!eboNome) { alert("Informe o nome do ebó."); return; }

  // Prompt para quantidade de pessoas
  let pratos = parseInt(prompt(`Informe a quantidade de pessoas para "${eboNome}"`, "1"), 10);
  if (!Number.isFinite(pratos) || pratos < 1) {
    alert("Quantidade inválida. Será considerado 1 pessoa.");
    pratos = 1;
  }

  // Se lista não veio pelo docId, busca ela
  if (!lista) {
    try {
      lista = await buscarListaPorNomeOuNome2(eboNome);
    } catch(e) { console.error(e); }
  }

  if (!lista) { alert("Lista não encontrada."); return; }

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

  // Atualiza UI
  renderizarListasAcumuladas();
  window.gerarListaFinalAcumulada();

  // Limpa campos se não veio do docId
  if (!docId) {
    if ($("eboNome")) $("eboNome").value = "";
    if ($("numPratos")) $("numPratos").value = "1";
    if ($("eboNome")) $("eboNome").focus();
  }

  // 🔹 Mostra animação de feedback
  const feedback = document.createElement('div');
  feedback.textContent = '✅ Lista adicionada com sucesso!';
  feedback.style.position = 'fixed';
  feedback.style.top = '20px';
  feedback.style.left = '50%';
  feedback.style.transform = 'translateX(-50%)';
  feedback.style.background = '#4CAF50';
  feedback.style.color = 'white';
  feedback.style.padding = '12px 24px';
  feedback.style.borderRadius = '4px';
  feedback.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
  feedback.style.zIndex = '1000';
  feedback.style.fontFamily = 'Arial, sans-serif';
  feedback.style.fontSize = '14px';
  feedback.style.animation = 'fadeIn 0.3s ease-out';

  document.body.appendChild(feedback);

  // Adiciona animações CSS dinamicamente
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translate(-50%, -20px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }
    @keyframes fadeOut {
      from { opacity: 1; transform: translate(-50%, 0); }
      to { opacity: 0; transform: translate(-50%, -20px); }
    }
  `;
  document.head.appendChild(style);

  setTimeout(() => {
    feedback.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => feedback.remove(), 300);
  }, 2000);
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
const IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutos
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
  renderizarOferendasEbo();
  window.scrollTo({ top: 0, behavior: "instant" });
};

window.voltarTelaPrincipal = function () {
  esconderTodasAsTelas();

  const postLogin = document.getElementById("postLogin");
  if (postLogin) postLogin.style.display = "block";

  // reset scroll
  window.scrollTo({ top: 0, behavior: "instant" });
  const container = document.querySelector(".app-container");
  if (container) container.scrollTop = 0;

  // garante que a aba Aleatório fique escondida e fora do fluxo
  const aleatorio = document.getElementById("aleatorioScreen");
  if (aleatorio) {
    aleatorio.style.display = "none";
    aleatorio.style.position = "absolute";
    aleatorio.scrollTop = 0;
  }
};
window.abrirModalPositivos = function () {
  limparCamposModalPositivos();
  prepararModalFotosArea("positivos");

  const modal = document.getElementById("modalBackdropPositivos");

  if (modal) modal.style.display = "flex";

};

window.fecharModalPositivos = function () {

  const modal = document.getElementById("modalBackdropPositivos");

  if (modal) modal.style.display = "none";

};


function limparCamposModalPositivos() {
  window.editingDocIdPositivos = null;

  if ($("modalNomeEbo_1Positivos")) $("modalNomeEbo_1Positivos").value = "";
  if ($("modalSubtitulo_1Positivos")) $("modalSubtitulo_1Positivos").value = "";
  if ($("modalModoFazer_1Positivos")) $("modalModoFazer_1Positivos").value = "";
  if ($("modalSubtitulo_2Positivos")) $("modalSubtitulo_2Positivos").value = "";
  if ($("modalModoFazer_2Positivos")) $("modalModoFazer_2Positivos").value = "";

  modalLimparLinhasPositivos("1");
  modalLimparLinhasPositivos("2");
  modalCriarLinhaPositivos("1", "", "");
  modalCriarLinhaPositivos("2", "", "");

  resetarFotosArea("positivos");
}


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

  return {
    lista1,
    lista2,
    fotosModo1: montarFotosComLegenda("positivos", "1", getFotosAreaState("positivos")["1"]),
    fotosModo2: montarFotosComLegenda("positivos", "2", getFotosAreaState("positivos")["2"]),
  };
}

// Enviar Positivos para Firebase
window.enviarParaBancoPositivos = async function() {
  await aguardarProcessamentoFotos();
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
      fotosModo1: payload.fotosModo1 || [],
      itens: payload.lista1.itens,

      nome2: "",
      nome2_norm: "",
      subtitulo2: payload.lista2.subtitulo || "",
      modo2: payload.lista2.modo || "",
      fotosModo2: payload.fotosModo2 || [],
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
    abrirModalPositivos();

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

    definirFotosArea("positivos", "1", data.fotosModo1);
    definirFotosArea("positivos", "2", data.fotosModo2);

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

window.imprimirPositivo = function(docId) {
  return abrirModalImpressaoListaCadastrada({
    collectionName: "positivos",
    docId,
    tituloModal: "Imprimir positivo",
    mensagens: {
      idNaoInformado: "ID do positivo não informado.",
      naoEncontrado: "Positivo não encontrado.",
      erro: "Erro ao imprimir positivo. Veja o console (F12).",
    },
  });
};


window.abrirModalBanhos = function() {
  limparCamposModalBanhos();
  prepararModalFotosArea("banhos");

  const modal = document.getElementById("modalBackdropBanhos");
  if (modal) modal.style.display = "flex";
};

window.fecharModalBanhos = function() {
  const modal = document.getElementById("modalBackdropBanhos");
  if (modal) modal.style.display = "none";
};


function limparCamposModalBanhos() {
  window.editingDocIdBanhos = null;

  if ($("modalNomeBanho_1")) $("modalNomeBanho_1").value = "";
  if ($("modalSubtituloBanho_1")) $("modalSubtituloBanho_1").value = "";
  if ($("modalModoFazerBanho_1")) $("modalModoFazerBanho_1").value = "";
  if ($("modalSubtituloBanho_2")) $("modalSubtituloBanho_2").value = "";
  if ($("modalModoFazerBanho_2")) $("modalModoFazerBanho_2").value = "";

  modalLimparLinhasBanhos("1");
  modalLimparLinhasBanhos("2");
  modalCriarLinhaBanhos("1", "", "");
  modalCriarLinhaBanhos("2", "", "");

  resetarFotosArea("banhos");
}

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
  return {
    lista1,
    lista2,
    fotosModo1: montarFotosComLegenda("banhos", "1", getFotosAreaState("banhos")["1"]),
    fotosModo2: montarFotosComLegenda("banhos", "2", getFotosAreaState("banhos")["2"]),
  };
}

// Enviar para Firebase
window.enviarParaBancoBanhos = async function() {
  await aguardarProcessamentoFotos();
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
      fotosModo1: payload.fotosModo1 || [],
      itens: payload.lista1.itens,
      nome2: "",
      nome2_norm: "",
      subtitulo2: payload.lista2.subtitulo || "",
      modo2: payload.lista2.modo || "",
      fotosModo2: payload.fotosModo2 || [],
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

    abrirModalBanhos();

    if ($("modalNomeBanho_1")) $("modalNomeBanho_1").value = data.nome || "";
    if ($("modalSubtituloBanho_1")) $("modalSubtituloBanho_1").value = data.subtitulo || "";
    if ($("modalModoFazerBanho_1")) $("modalModoFazerBanho_1").value = data.modo || "";
    modalLimparLinhasBanhos("1");
    (data.itens || []).forEach(it => modalCriarLinhaBanhos("1", it.ingrediente || "", it.quantidade || ""));

    if ($("modalSubtituloBanho_2")) $("modalSubtituloBanho_2").value = data.subtitulo2 || "";
    if ($("modalModoFazerBanho_2")) $("modalModoFazerBanho_2").value = data.modo2 || "";
    modalLimparLinhasBanhos("2");
    (data.itens2 || []).forEach(it => modalCriarLinhaBanhos("2", it.ingrediente || "", it.quantidade || ""));

    definirFotosArea("banhos", "1", data.fotosModo1);
    definirFotosArea("banhos", "2", data.fotosModo2);

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

window.imprimirBanho = function(docId) {
  return abrirModalImpressaoListaCadastrada({
    collectionName: "banhos",
    docId,
    tituloModal: "Imprimir banho",
    mensagens: {
      idNaoInformado: "ID do banho não informado.",
      naoEncontrado: "Banho não encontrado.",
      erro: "Erro ao imprimir banho. Veja o console (F12).",
    },
  });
};

// OFERENDAS//
function filtrarRegistrosPorPesquisaOferenda(items, termo) {
  const busca = normalizarTexto(termo || "");
  if (!busca) return items;

  return (Array.isArray(items) ? items : []).filter((item) => {
    const nome = normalizarTexto(item?.nome || "");
    const subtitulo = normalizarTexto(item?.subtitulo || "");
    const subtitulo2 = normalizarTexto(item?.subtitulo2 || "");
    return nome.includes(busca) || subtitulo.includes(busca) || subtitulo2.includes(busca);
  });
}

window.abrirModalOferendas = function() {
  limparCamposModalOferendas();
  prepararModalFotosArea("oferendas");

  const modal = document.getElementById("modalBackdropOferendas");
  if (modal) modal.style.display = "flex";
};

window.fecharModalOferendas = function() {
  const modal = document.getElementById("modalBackdropOferendas");
  if (modal) modal.style.display = "none";
};

function limparCamposModalOferendas() {
  window.editingDocIdOferendas = null;

  if ($("modalNomeOferenda_1")) $("modalNomeOferenda_1").value = "";
  if ($("modalSubtituloOferenda_1")) $("modalSubtituloOferenda_1").value = "";
  if ($("modalModoFazerOferenda_1")) $("modalModoFazerOferenda_1").value = "";
  if ($("modalSubtituloOferenda_2")) $("modalSubtituloOferenda_2").value = "";
  if ($("modalModoFazerOferenda_2")) $("modalModoFazerOferenda_2").value = "";

  modalLimparLinhasOferendas("1");
  modalLimparLinhasOferendas("2");
  modalCriarLinhaOferendas("1", "", "");
  modalCriarLinhaOferendas("2", "", "");

  resetarFotosArea("oferendas");
}

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
    <td><input class="modalIng" type="text" placeholder="Ex: Pipoca" value="${escaparValorInput(ingrediente)}" /></td>
    <td><input class="modalQtd" type="text" placeholder="Ex: 7" value="${escaparValorInput(quantidade)}" /></td>
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
  document.querySelectorAll(selector).forEach((tr) => {
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
  return {
    lista1,
    lista2,
    fotosModo1: montarFotosComLegenda("oferendas", "1", getFotosAreaState("oferendas")["1"]),
    fotosModo2: montarFotosComLegenda("oferendas", "2", getFotosAreaState("oferendas")["2"]),
  };
}

// Enviar para Firebase
window.enviarParaBancoOferendas = async function() {
  await aguardarProcessamentoFotos();
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
      fotosModo1: payload.fotosModo1 || [],
      itens: payload.lista1.itens,
      nome2: "",
      nome2_norm: "",
      subtitulo2: payload.lista2.subtitulo || "",
      modo2: payload.lista2.modo || "",
      fotosModo2: payload.fotosModo2 || [],
      itens2: payload.lista2.itens || [],
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    };

    if (window.editingDocIdOferendas) {
      await setDoc(doc(db, OFERENDAS_ORIXA_COLLECTION, window.editingDocIdOferendas), docPayload, { merge: true });
      window.editingDocIdOferendas = null;
      alert("✅ Oferenda de Orixá atualizada com sucesso!");
    } else {
      await addDoc(collection(db, OFERENDAS_ORIXA_COLLECTION), docPayload);
      alert("✅ Oferenda de Orixá cadastrada com sucesso!");
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
  const termo = $("pesquisaOferendas")?.value || "";

  box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Carregando...</div></div></div>`;

  try {
    const q = query(collection(db, OFERENDAS_ORIXA_COLLECTION), orderBy("updatedAt", "desc"), limit(100));
    const snaps = await getDocs(q);
    let items = [];
    snaps.forEach(s => items.push({ id: s.id, ...s.data() }));

    items = filtrarRegistrosPorPesquisaOferenda(items, termo);

    if (!items.length) {
      box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Nenhuma oferenda de Orixá cadastrada.</div></div></div>`;
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
    const snap = await getDoc(doc(db, OFERENDAS_ORIXA_COLLECTION, docId));
    if (!snap.exists()) return alert("Oferenda não encontrada.");
    const data = snap.data();

    abrirModalOferendas();

    if ($("modalNomeOferenda_1")) $("modalNomeOferenda_1").value = data.nome || "";
    if ($("modalSubtituloOferenda_1")) $("modalSubtituloOferenda_1").value = data.subtitulo || "";
    if ($("modalModoFazerOferenda_1")) $("modalModoFazerOferenda_1").value = data.modo || "";
    modalLimparLinhasOferendas("1");
    if (Array.isArray(data.itens) && data.itens.length) {
      data.itens.forEach(it => modalCriarLinhaOferendas("1", it.ingrediente || "", it.quantidade || ""));
    } else {
      modalCriarLinhaOferendas("1", "", "");
    }

    if ($("modalSubtituloOferenda_2")) $("modalSubtituloOferenda_2").value = data.subtitulo2 || "";
    if ($("modalModoFazerOferenda_2")) $("modalModoFazerOferenda_2").value = data.modo2 || "";
    modalLimparLinhasOferendas("2");
    if (Array.isArray(data.itens2) && data.itens2.length) {
      data.itens2.forEach(it => modalCriarLinhaOferendas("2", it.ingrediente || "", it.quantidade || ""));
    } else {
      modalCriarLinhaOferendas("2", "", "");
    }

    definirFotosArea("oferendas", "1", data.fotosModo1);
    definirFotosArea("oferendas", "2", data.fotosModo2);

    window.editingDocIdOferendas = docId;
  } catch (e) {
    console.error(e);
    alert("Erro ao editar oferenda.");
  }
};

// Excluir Oferenda
window.excluirOferenda = async function(docId) {
  const ok = confirm("Tem certeza que deseja excluir esta oferenda de Orixá?");
  if (!ok) return;
  const { db, doc, deleteDoc } = fb();
  try {
    await deleteDoc(doc(db, OFERENDAS_ORIXA_COLLECTION, docId));
    alert("Oferenda de Orixá excluída!");
    renderizarOferendas();
  } catch (e) {
    console.error(e);
    alert("Erro ao excluir oferenda.");
  }
};

// Imprimir Oferenda
window.imprimirOferenda = function(docId) {
  return abrirModalImpressaoListaCadastrada({
    collectionName: OFERENDAS_ORIXA_COLLECTION,
    docId,
    tituloModal: "Imprimir oferenda de Orixá",
    mensagens: {
      idNaoInformado: "ID da oferenda não informado.",
      naoEncontrado: "Oferenda não encontrada.",
      erro: "Erro ao imprimir oferenda. Veja o console (F12).",
    },
  });
};

// OFERENDAS EBÓ //
window.abrirModalOferendasEbo = function() {
  limparCamposModalOferendasEbo();
  prepararModalFotosArea("oferendas_ebo");

  const modal = document.getElementById("modalBackdropOferendasEbo");
  if (modal) modal.style.display = "flex";
};

window.fecharModalOferendasEbo = function() {
  const modal = document.getElementById("modalBackdropOferendasEbo");
  if (modal) modal.style.display = "none";
};

function limparCamposModalOferendasEbo() {
  window.editingDocIdOferendasEbo = null;

  if ($("modalNomeOferendaEbo_1")) $("modalNomeOferendaEbo_1").value = "";
  if ($("modalSubtituloOferendaEbo_1")) $("modalSubtituloOferendaEbo_1").value = "";
  if ($("modalModoFazerOferendaEbo_1")) $("modalModoFazerOferendaEbo_1").value = "";
  if ($("modalSubtituloOferendaEbo_2")) $("modalSubtituloOferendaEbo_2").value = "";
  if ($("modalModoFazerOferendaEbo_2")) $("modalModoFazerOferendaEbo_2").value = "";

  modalLimparLinhasOferendasEbo("1");
  modalLimparLinhasOferendasEbo("2");
  modalCriarLinhaOferendasEbo("1", "", "");
  modalCriarLinhaOferendasEbo("2", "", "");

  resetarFotosArea("oferendas_ebo");
}

function modalLimparLinhasOferendasEbo(listId) {
  const tbody = document.getElementById(`modalBodyLinhasOferendasEbo_${listId}`);
  if (tbody) tbody.innerHTML = "";
}

function modalCriarLinhaOferendasEbo(listId = "1", ingrediente = "", quantidade = "") {
  const tbody = document.getElementById(`modalBodyLinhasOferendasEbo_${listId}`);
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="modalIng" type="text" placeholder="Ex: Pipoca" value="${escaparValorInput(ingrediente)}" /></td>
    <td><input class="modalQtd" type="text" placeholder="Ex: 7" value="${escaparValorInput(quantidade)}" /></td>
    <td><button class="btn-danger btn-mini" type="button">Remover</button></td>
  `;
  tr.querySelector("button").onclick = () => tr.remove();
  tbody.appendChild(tr);
}

window.modalAdicionarLinhaOferendasEbo = function(listId) {
  modalCriarLinhaOferendasEbo(listId, "", "");
};

function getLinhasOferendasEbo(listId) {
  const linhas = [];
  const selector = `#modalBodyLinhasOferendasEbo_${listId} tr`;
  document.querySelectorAll(selector).forEach((tr) => {
    const ing = (tr.querySelector(".modalIng")?.value || "").trim();
    const qtd = (tr.querySelector(".modalQtd")?.value || "").trim();
    if (ing || qtd) linhas.push({ ingrediente: ing, quantidade: qtd });
  });
  return linhas;
}

function modalGetPayloadOferendasEbo() {
  const lista1 = {
    nome: ($("modalNomeOferendaEbo_1")?.value || "").trim(),
    subtitulo: ($("modalSubtituloOferendaEbo_1")?.value || "").trim(),
    modo: ($("modalModoFazerOferendaEbo_1")?.value || "").trim(),
    itens: getLinhasOferendasEbo("1")
  };
  const lista2 = {
    subtitulo: ($("modalSubtituloOferendaEbo_2")?.value || "").trim(),
    modo: ($("modalModoFazerOferendaEbo_2")?.value || "").trim(),
    itens: getLinhasOferendasEbo("2")
  };
  return {
    lista1,
    lista2,
    fotosModo1: montarFotosComLegenda("oferendas_ebo", "1", getFotosAreaState("oferendas_ebo")["1"]),
    fotosModo2: montarFotosComLegenda("oferendas_ebo", "2", getFotosAreaState("oferendas_ebo")["2"]),
  };
}
window.enviarParaBancoOferendasEbo = async function () {
  await aguardarProcessamentoFotos();
  const { auth, db, collection, doc, setDoc, addDoc, serverTimestamp } = fb();

  const payload = modalGetPayloadOferendasEbo();

  console.log("[Oferendas Ebó] project:", db.app.options.projectId);
  console.log("[Oferendas Ebó] user:", auth.currentUser?.uid || null, auth.currentUser?.email || null);

  if (!auth.currentUser) {
    alert("❌ Você não está autenticado. Faça login novamente.");
    return;
  }

  await auth.currentUser.getIdToken(true);

  if (!payload.lista1.nome) {
    alert("Digite o nome da Oferenda de Ebó (Lista 1).");
    return;
  }

  if (!payload.lista1.itens || !payload.lista1.itens.some(i => (i.ingrediente || "").trim())) {
    alert("Adicione ao menos 1 ingrediente na Lista 1.");
    return;
  }

  const docPayload = {
    nome: payload.lista1.nome,
    nome_norm: normalizarTexto(payload.lista1.nome),
    subtitulo: payload.lista1.subtitulo || "",
    modo: payload.lista1.modo || "",
    fotosModo1: payload.fotosModo1 || [],
    itens: payload.lista1.itens,

    nome2: "",
    nome2_norm: "",
    subtitulo2: payload.lista2.subtitulo || "",
    modo2: payload.lista2.modo || "",
    fotosModo2: payload.fotosModo2 || [],
    itens2: payload.lista2.itens || [],

    createdBy: auth.currentUser.uid,
    updatedAt: serverTimestamp()
  };

  try {
    if (window.editingDocIdOferendasEbo) {
      await setDoc(
        doc(db, OFERENDAS_EBO_COLLECTION, window.editingDocIdOferendasEbo),
        docPayload,
        { merge: true }
      );

      console.log("[Oferendas Ebó] atualizado:", window.editingDocIdOferendasEbo);
      window.editingDocIdOferendasEbo = null;

      await renderizarOferendasEbo();
      fecharModalOferendasEbo();
      alert("✅ Oferenda de Ebó atualizada com sucesso!");
    } else {
      docPayload.createdAt = serverTimestamp();

      const docRef = await addDoc(collection(db, OFERENDAS_EBO_COLLECTION), docPayload);
      console.log("[Oferendas Ebó] salvo:", docRef.id);

      await renderizarOferendasEbo();
      fecharModalOferendasEbo();
      alert("✅ Oferenda de Ebó cadastrada com sucesso!");
    }
  } catch (e) {
    console.error("[Oferendas Ebó] erro:", e);
    alert(
      `❌ ${e?.code || e?.message || "erro"}\n` +
      `uid=${auth.currentUser?.uid || "null"}\n` +
      `project=${db.app.options.projectId}`
    );
  }
};

window.renderizarOferendasEbo = async function() {
  const box = $("oferendasEboSalvosBox");
  if (!box) return;

  const { db, collection, getDocs, query, orderBy, limit } = fb();
  const termo = $("pesquisaOferendasEbo")?.value || "";

  box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Carregando...</div></div></div>`;

  try {
    const q = query(collection(db, OFERENDAS_EBO_COLLECTION), orderBy("updatedAt", "desc"), limit(100));
    const snaps = await getDocs(q);
    let items = [];
    snaps.forEach((s) => items.push({ id: s.id, ...s.data() }));

    items = filtrarRegistrosPorPesquisaOferenda(items, termo);

    if (!items.length) {
      box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Nenhuma oferenda de Ebó cadastrada.</div></div></div>`;
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
            <button class="btn-mini btn-mini-open" onclick="editarOferendaEbo('${item.id}')">Editar</button>
            <button class="btn-mini btn-mini-del" onclick="excluirOferendaEbo('${item.id}')">Excluir</button>
            <button class="btn-mini btn-print" onclick="imprimirOferendaEbo('${item.id}')">Imprimir</button>
          </div>
        </div>
      `;
    }).join("");

  } catch (e) {
    console.error(e);
    box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Erro ao carregar</div></div></div>`;
  }
};

window.editarOferendaEbo = async function(docId) {
  const { db, doc, getDoc } = fb();
  try {
    const snap = await getDoc(doc(db, OFERENDAS_EBO_COLLECTION, docId));
    if (!snap.exists()) return alert("Oferenda de Ebó não encontrada.");
    const data = snap.data();

    abrirModalOferendasEbo();

    if ($("modalNomeOferendaEbo_1")) $("modalNomeOferendaEbo_1").value = data.nome || "";
    if ($("modalSubtituloOferendaEbo_1")) $("modalSubtituloOferendaEbo_1").value = data.subtitulo || "";
    if ($("modalModoFazerOferendaEbo_1")) $("modalModoFazerOferendaEbo_1").value = data.modo || "";
    modalLimparLinhasOferendasEbo("1");
    if (Array.isArray(data.itens) && data.itens.length) {
      data.itens.forEach((it) => modalCriarLinhaOferendasEbo("1", it.ingrediente || "", it.quantidade || ""));
    } else {
      modalCriarLinhaOferendasEbo("1", "", "");
    }

    if ($("modalSubtituloOferendaEbo_2")) $("modalSubtituloOferendaEbo_2").value = data.subtitulo2 || "";
    if ($("modalModoFazerOferendaEbo_2")) $("modalModoFazerOferendaEbo_2").value = data.modo2 || "";
    modalLimparLinhasOferendasEbo("2");
    if (Array.isArray(data.itens2) && data.itens2.length) {
      data.itens2.forEach((it) => modalCriarLinhaOferendasEbo("2", it.ingrediente || "", it.quantidade || ""));
    } else {
      modalCriarLinhaOferendasEbo("2", "", "");
    }

    definirFotosArea("oferendas_ebo", "1", data.fotosModo1);
    definirFotosArea("oferendas_ebo", "2", data.fotosModo2);

    window.editingDocIdOferendasEbo = docId;
  } catch (e) {
    console.error(e);
    alert("Erro ao editar oferenda de Ebó.");
  }
};

window.excluirOferendaEbo = async function(docId) {
  const ok = confirm("Tem certeza que deseja excluir esta oferenda de Ebó?");
  if (!ok) return;
  const { db, doc, deleteDoc } = fb();
  try {
    await deleteDoc(doc(db, OFERENDAS_EBO_COLLECTION, docId));
    alert("Oferenda de Ebó excluída!");
    renderizarOferendasEbo();
  } catch (e) {
    console.error(e);
    alert("Erro ao excluir oferenda de Ebó.");
  }
};

window.imprimirOferendaEbo = function(docId) {
  return abrirModalImpressaoListaCadastrada({
    collectionName: OFERENDAS_EBO_COLLECTION,
    docId,
    tituloModal: "Imprimir oferenda de Ebó",
    mensagens: {
      idNaoInformado: "ID da oferenda de Ebó não informado.",
      naoEncontrado: "Oferenda de Ebó não encontrada.",
      erro: "Erro ao imprimir oferenda de Ebó. Veja o console (F12).",
    },
  });
};


// ============================
// FOTOS - LISTA OBRIGAÇÃO
// ============================
const FOTOS_MODAL_AREAS = {
  listas: { stateKey: "__listasFotos", inputPrefix: "modalFotosLista_", previewPrefix: "previewFotosLista_" },
  positivos: { stateKey: "__positivosFotos", inputPrefix: "modalFotosPositivos_", previewPrefix: "previewFotosPositivos_" },
  oferendas: { stateKey: "__oferendasFotos", inputPrefix: "modalFotosOferenda_", previewPrefix: "previewFotosOferenda_" },
  banhos: { stateKey: "__banhosFotos", inputPrefix: "modalFotosBanho_", previewPrefix: "previewFotosBanho_" },
  obrigacoes: { stateKey: "__obrigacoesFotos", inputPrefix: "modalFotosObrigacao_", previewPrefix: "previewFotosObrigacao_" },
  iba_orixa: { stateKey: "__ibaOrixaFotos", inputPrefix: "modalFotosIbaOrixa_", previewPrefix: "previewFotosIbaOrixa_" },
  aleatorio: { stateKey: "__aleatorioFotos", inputPrefix: "modalFotosAleatorio_", previewPrefix: "previewFotosAleatorio_" } // ✅ corrigido
};

function getConfigFotosArea(area) {
  const config = FOTOS_MODAL_AREAS[String(area || "").toLowerCase()];
  if (!config) throw new Error(`Área de fotos inválida: ${area}`);
  return config;
}

function getFotosAreaState(area) {
  const config = getConfigFotosArea(area);

  if (!window[config.stateKey] || typeof window[config.stateKey] !== "object") {
    window[config.stateKey] = { "1": [], "2": [] };
  }

  ["1", "2"].forEach((id) => {
    if (!Array.isArray(window[config.stateKey][id])) {
      window[config.stateKey][id] = [];
    }
  });

  return window[config.stateKey];
}

function normalizarFotosOferenda(lista) {
  return (Array.isArray(lista) ? lista : [])
    .filter(foto => foto)
    .slice(0, OFERENDA_MAX_FOTOS_POR_BLOCO)
    .map(foto => {
      if (!foto) return null;

      // Se for string, transforma em objeto
      if (typeof foto === "string") return { src: foto, legenda: "" };

      // Se já for objeto com src, mantém
      if (typeof foto === "object" && foto.src) return { src: foto.src, legenda: foto.legenda || "" };

      return null;
    })
    .filter(f => f !== null);
}

window.renderizarIbaOrixa = async function () {
  const box = $("ibaOrixaSalvosBox");
  if (!box) return;

  // consulta Firebase
  const { db, collection, getDocs, query, orderBy, limit } = fb();
  const termo = normalizarTexto($("pesquisaIbaOrixa")?.value || "");

  box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Carregando...</div></div></div>`;

  try {
    const q = query(collection(db, "iba_orixa"), orderBy("updatedAt", "desc"), limit(100));
    const snaps = await getDocs(q);
    let items = [];
    snaps.forEach((s) => items.push({ id: s.id, ...s.data() }));

    if (termo) {
      items = items.filter((item) => {
        const nome = normalizarTexto(item.nome || "");
        const subtitulo = normalizarTexto(item.subtitulo || "");
        const subtitulo2 = normalizarTexto(item.subtitulo2 || "");
        return nome.includes(termo) || subtitulo.includes(termo) || subtitulo2.includes(termo);
      });
    }

    if (!items.length) {
      box.innerHTML = `
        <div class="saved-item">
          <div>
            <div class="saved-title">Nenhuma lista Ibá Orixá cadastrada.</div>
          </div>
        </div>
      `;
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
          <button class="btn-mini btn-mini-open" onclick="editarIbaOrixa('${item.id}')">Editar</button>
          <button class="btn-mini btn-mini-del" onclick="excluirListaIbaOrixa('${item.id}')">Excluir</button>
          <button class="btn-mini btn-print" onclick="imprimirListaIbaOrixa('${item.id}')">Imprimir</button>
          </div>
        </div>
      `;
    }).join("");

  } catch (e) {
    console.error(e);
    box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Erro ao carregar</div></div></div>`;
  }
};
function definirFotosArea(area, listId, fotos) {
  const id = String(listId || "1");
  const config = getConfigFotosArea(area);
  const state = getFotosAreaState(area);
  state[id] = normalizarFotosOferenda(fotos);
  renderizarPreviewFotosArea(area, id);

  const input = document.getElementById(`${config.inputPrefix}${id}`);
  if (input) input.value = "";
}

function resetarFotosArea(area) {
  ["1", "2"].forEach((id) => definirFotosArea(area, id, []));
}

function renderizarPreviewFotosArea(area, listId) {
  const id = String(listId || "1");
  const config = getConfigFotosArea(area);
  const box = document.getElementById(`${config.previewPrefix}${id}`);
  if (!box) return;

  const fotos = normalizarFotosOferenda(getFotosAreaState(area)[id] || []);
  box.innerHTML = "";

  if (!fotos.length) {
    box.innerHTML = `<div class="foto-preview-empty">Nenhuma foto adicionada nesta parte.</div>`;
    return;
  }

  fotos.forEach((foto, index) => {
    const item = document.createElement("div");
    item.className = "foto-preview-item";

    const img = document.createElement("img");
    img.alt = `Foto ${index + 1}`;
    img.loading = "eager";
    img.decoding = "async";
    img.src = foto?.src || foto || "";

    img.addEventListener("error", () => {
      img.removeAttribute("src");
      img.alt = `Foto ${index + 1} indisponível`;
      img.style.display = "none";

      const erro = document.createElement("div");
      erro.className = "foto-preview-empty";
      erro.textContent = "Esta foto não conseguiu abrir. Remova e envie novamente em JPG ou PNG.";
      item.insertBefore(erro, legenda);
    }, { once: true });

    const legenda = document.createElement("div");
    legenda.className = "foto-legenda-input";
    legenda.contentEditable = "true";
    legenda.setAttribute("placeholder", "Digite a legenda aqui");
    legenda.innerHTML = escaparHTML(foto?.legenda || "");

    const actions = document.createElement("div");
    actions.className = "foto-preview-actions";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-danger btn-mini";
    btn.textContent = "Remover";
    btn.addEventListener("click", () => removerFotoArea(area, id, index));

    actions.appendChild(btn);
    item.appendChild(img);
    item.appendChild(legenda);
    item.appendChild(actions);
    box.appendChild(item);
  });
}

window.removerFotoArea = function removerFotoArea(area, listId, index) {
  const id = String(listId || "1");
  const fotos = getFotosAreaState(area)[id] || [];
  if (index < 0 || index >= fotos.length) return;

  fotos.splice(index, 1);
  renderizarPreviewFotosArea(area, id);
};

function lerArquivoComoDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Erro ao ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function carregarImagemDataURL(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível abrir a imagem."));
    img.src = src;
  });
}

async function compactarFotoOferenda(file) {
  if (!file || !file.type || !file.type.startsWith("image/")) {
    throw new Error("Selecione apenas arquivos de imagem.");
  }

  const original = await lerArquivoComoDataURL(file);
  const img = await carregarImagemDataURL(original);

  let largura = img.naturalWidth || img.width || 0;
  let altura = img.naturalHeight || img.height || 0;

  if (!largura || !altura) {
    return original;
  }

  if (largura > OFERENDA_FOTO_MAX_LADO || altura > OFERENDA_FOTO_MAX_LADO) {
    const escala = Math.min(OFERENDA_FOTO_MAX_LADO / largura, OFERENDA_FOTO_MAX_LADO / altura);
    largura = Math.max(1, Math.round(largura * escala));
    altura = Math.max(1, Math.round(altura * escala));
  }

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;

  const ctx = canvas.getContext("2d");
  if (!ctx) return original;

  ctx.drawImage(img, 0, 0, largura, altura);
  return canvas.toDataURL("image/jpeg", OFERENDA_FOTO_QUALIDADE);
}

async function handleFotosAreaSelecionadas(area, listId) {
  const id = String(listId || "1");
  const config = getConfigFotosArea(area);
  const input = document.getElementById(`${config.inputPrefix}${id}`);
  const files = Array.from(input?.files || []);
  if (!files.length) return;

  const state = getFotosAreaState(area);
  const fotosAtuais = state[id] || [];
  const vagas = OFERENDA_MAX_FOTOS_POR_BLOCO - fotosAtuais.length;

  if (vagas <= 0) {
    alert(`Você pode adicionar até ${OFERENDA_MAX_FOTOS_POR_BLOCO} fotos nesta parte.`);
    if (input) input.value = "";
    return;
  }

  const arquivosSelecionados = files.slice(0, vagas);
  if (files.length > vagas) {
    alert(`Só as primeiras ${vagas} foto(s) foram adicionadas. Limite: ${OFERENDA_MAX_FOTOS_POR_BLOCO}.`);
  }

  try {
    if (input) input.disabled = true;

    for (const file of arquivosSelecionados) {
      iniciarProcessamentoFotos();
      try {
        const fotoCompactada = await compactarFotoOferenda(file);
        fotosAtuais.push({
          src: fotoCompactada,
          legenda: ""
        });
        renderizarPreviewFotosArea(area, id);
      } catch (err) {
        console.error("Erro ao processar foto:", err);
        alert(`Erro ao adicionar a foto: ${file.name}`);
      } finally {
        finalizarProcessamentoFotos();
      }
    }
  } finally {
    if (input) {
      input.disabled = false;
      input.value = "";
    }
  }
}

function inicializarInputsFotosArea(area) {
  const config = getConfigFotosArea(area);

  ["1", "2"].forEach((id) => {
    const input = document.getElementById(`${config.inputPrefix}${id}`);
    if (!input || input.dataset.boundFotos === "1") return;

    input.addEventListener("change", () => handleFotosAreaSelecionadas(area, id));
    input.dataset.boundFotos = "1";
  });
}

function prepararModalFotosArea(area) {
  inicializarInputsFotosArea(area);
  renderizarPreviewFotosArea(area, "1");
  renderizarPreviewFotosArea(area, "2");
  requestAnimationFrame(() => {
    renderizarPreviewFotosArea(area, "1");
    renderizarPreviewFotosArea(area, "2");
  });
}

// ============================
// FUNÇÃO LISTA OBRIGAÇÃO
// ============================
window.abrirTelaObrigacoes = function () {
  esconderTodasAsTelas();

 const lista = document.getElementById("listaScreen");
if (lista) lista.style.display = "block";

  renderizarObrigacoes();
  window.scrollTo({ top: 0, behavior: "instant" });
};

window.abrirModalObrigacoes = function() {
  limparCamposModalObrigacoes();
  prepararModalFotosArea("obrigacoes");
  const modal = document.getElementById("modalBackdropObrigacoes");
  if (modal) modal.style.display = "flex";
};

window.fecharModalObrigacoes = function() {
  const modal = document.getElementById("modalBackdropObrigacoes");
  if (modal) modal.style.display = "none";
};

function limparCamposModalObrigacoes() {
  window.editingDocIdObrigacoes = null;

  if ($("modalNomeObrigacao_1")) $("modalNomeObrigacao_1").value = "";
  if ($("modalSubtituloObrigacao_1")) $("modalSubtituloObrigacao_1").value = "";
  if ($("modalModoFazerObrigacao_1")) $("modalModoFazerObrigacao_1").value = "";
  if ($("modalSubtituloObrigacao_2")) $("modalSubtituloObrigacao_2").value = "";
  if ($("modalModoFazerObrigacao_2")) $("modalModoFazerObrigacao_2").value = "";

  modalLimparLinhasObrigacoes("1");
  modalLimparLinhasObrigacoes("2");
  modalCriarLinhaObrigacoes("1", "", "");
  modalCriarLinhaObrigacoes("2", "", "");

  resetarFotosArea("obrigacoes");
}

function modalLimparLinhasObrigacoes(listId) {
  const tbody = document.getElementById(`modalBodyLinhasObrigacoes_${listId}`);
  if (tbody) tbody.innerHTML = "";
}

function modalCriarLinhaObrigacoes(listId = "1", ingrediente = "", quantidade = "") {
  const tbody = document.getElementById(`modalBodyLinhasObrigacoes_${listId}`);
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="modalIng" type="text" placeholder="Ex: Pipoca" value="${escaparValorInput(ingrediente)}" /></td>
    <td><input class="modalQtd" type="text" placeholder="Ex: 7" value="${escaparValorInput(quantidade)}" /></td>
    <td><button class="btn-danger btn-mini" type="button">Remover</button></td>
  `;
  tr.querySelector("button").onclick = () => tr.remove();
  tbody.appendChild(tr);
}

window.modalAdicionarLinhaObrigacoes = function(listId) {
  modalCriarLinhaObrigacoes(listId, "", "");
};

function getLinhasObrigacoes(listId) {
  const linhas = [];
  const selector = `#modalBodyLinhasObrigacoes_${listId} tr`;
  document.querySelectorAll(selector).forEach((tr) => {
    const ing = (tr.querySelector(".modalIng")?.value || "").trim();
    const qtd = (tr.querySelector(".modalQtd")?.value || "").trim();
    if (ing || qtd) linhas.push({ ingrediente: ing, quantidade: qtd });
  });
  return linhas;
}

function modalGetPayloadObrigacoes() {
  const lista1 = {
    nome: ($("modalNomeObrigacao_1")?.value || "").trim(),
    subtitulo: ($("modalSubtituloObrigacao_1")?.value || "").trim(),
    modo: ($("modalModoFazerObrigacao_1")?.value || "").trim(),
    itens: getLinhasObrigacoes("1")
  };

  const lista2 = {
    subtitulo: ($("modalSubtituloObrigacao_2")?.value || "").trim(),
    modo: ($("modalModoFazerObrigacao_2")?.value || "").trim(),
    itens: getLinhasObrigacoes("2")
  };

  // Usa a função já existente que pega fotos do modal
  const fotos = getFotosAreaState("obrigacoes");

  return {
    lista1,
    lista2,
    fotosModo1: montarFotosComLegenda("obrigacoes", "1", fotos["1"]),
    fotosModo2: montarFotosComLegenda("obrigacoes", "2", fotos["2"]),
  };
}

window.enviarParaBancoObrigacoes = async function() {
  await aguardarProcessamentoFotos();
  try {
    const payload = modalGetPayloadObrigacoes();
    const { db, collection, addDoc, serverTimestamp } = fb();

    if (!payload.lista1.nome) return alert("Digite o nome da obrigação (Lista 1).");
    if (!payload.lista1.itens || !payload.lista1.itens.some(i => (i.ingrediente || "").trim())) {
      return alert("Adicione ao menos 1 ingrediente na Lista 1.");
    }

    // salva no Firestore
    const docRef = await addDoc(collection(db, "obrigacoes"), {
      nome: payload.lista1.nome,
      nome_norm: normalizarTexto(payload.lista1.nome),
      subtitulo: payload.lista1.subtitulo || "",
      modo: payload.lista1.modo || "",
      fotosModo1: payload.fotosModo1 || [],
      itens: payload.lista1.itens,
      nome2: "",
      nome2_norm: "",
      subtitulo2: payload.lista2.subtitulo || "",
      modo2: payload.lista2.modo || "",
      fotosModo2: payload.fotosModo2 || [],
      itens2: payload.lista2.itens || [],
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    });

    // 🔹 Atualiza imediatamente a UI
    const box = $("obrigacoesSalvosBox");
    if (box) {
      const nItens1 = payload.lista1.itens.length;
      const nItens2 = payload.lista2.itens.length;
      const html = `
        <div class="saved-item">
          <div>
            <div class="saved-title">${payload.lista1.nome}</div>
            <div class="saved-meta">Itens Lista 1: ${nItens1} • Itens Lista 2: ${nItens2}</div>
          </div>
          <div class="saved-actions-row">
            <button class="btn-mini btn-mini-open" onclick="editarObrigacao('${docRef.id}')">Editar</button>
            <button class="btn-mini btn-mini-del" onclick="excluirObrigacao('${docRef.id}')">Excluir</button>
            <button class="btn-mini btn-print" onclick="imprimirObrigacao('${docRef.id}')">Imprimir</button>
          </div>
        </div>
      `;
      box.insertAdjacentHTML("afterbegin", html);
    }

    fecharModalObrigacoes();
    alert("✅ Lista obrigação cadastrada com sucesso!");

  } catch (e) {
    console.error(e);
    alert(`❌ Erro ao enviar: ${e?.code || e?.message || "erro desconhecido"}`);
  }
};

window.renderizarObrigacoes = async function () {
  const box = $("obrigacoesSalvosBox");
  if (!box) return;

  const { db, collection, getDocs, query, orderBy, limit } = fb();
  const termo = normalizarTexto($("pesquisaObrigacoes")?.value || "");

  box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Carregando...</div></div></div>`;

  try {
    const q = query(collection(db, "obrigacoes"), orderBy("updatedAt", "desc"), limit(100));
    const snaps = await getDocs(q);

    let items = [];
    snaps.forEach((s) => items.push({ id: s.id, ...s.data() }));

    if (termo) {
      items = items.filter((item) => {
        const nome = normalizarTexto(item.nome || "");
        const subtitulo = normalizarTexto(item.subtitulo || "");
        const subtitulo2 = normalizarTexto(item.subtitulo2 || "");
        return nome.includes(termo) || subtitulo.includes(termo) || subtitulo2.includes(termo);
      });
    }

    if (!items.length) {
      box.innerHTML = `
        <div class="saved-item">
          <div>
            <div class="saved-title">Nenhuma lista obrigação cadastrada.</div>
          </div>
        </div>
      `;
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
            <button class="btn-mini btn-mini-open" onclick="editarObrigacao('${item.id}')">Editar</button>
            <button class="btn-mini btn-mini-del" onclick="excluirObrigacao('${item.id}')">Excluir</button>
            <button class="btn-mini btn-print" onclick="imprimirObrigacao('${item.id}')">Imprimir</button>
          </div>
        </div>
      `;
    }).join("");
  } catch (e) {
    console.error(e);
    box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Erro ao carregar</div></div></div>`;
  }
};
window.editarObrigacao = async function(docId) {
  const { db, doc, getDoc } = fb();
  try {
    const snap = await getDoc(doc(db, "obrigacoes", docId));
    if (!snap.exists()) return alert("Lista obrigação não encontrada.");
    const data = snap.data();

    limparCamposModalObrigacoes();
    prepararModalFotosArea("obrigacoes");
    const modal = document.getElementById("modalBackdropObrigacoes");
    if (modal) modal.style.display = "flex";

    if ($("modalNomeObrigacao_1")) $("modalNomeObrigacao_1").value = data.nome || "";
    if ($("modalSubtituloObrigacao_1")) $("modalSubtituloObrigacao_1").value = data.subtitulo || "";
    if ($("modalModoFazerObrigacao_1")) $("modalModoFazerObrigacao_1").value = data.modo || "";
    modalLimparLinhasObrigacoes("1");
    if (Array.isArray(data.itens) && data.itens.length) {
      data.itens.forEach((it) => modalCriarLinhaObrigacoes("1", it.ingrediente || "", it.quantidade || ""));
    } else {
      modalCriarLinhaObrigacoes("1", "", "");
    }

    if ($("modalSubtituloObrigacao_2")) $("modalSubtituloObrigacao_2").value = data.subtitulo2 || "";
    if ($("modalModoFazerObrigacao_2")) $("modalModoFazerObrigacao_2").value = data.modo2 || "";
    modalLimparLinhasObrigacoes("2");
    if (Array.isArray(data.itens2) && data.itens2.length) {
      data.itens2.forEach((it) => modalCriarLinhaObrigacoes("2", it.ingrediente || "", it.quantidade || ""));
    } else {
      modalCriarLinhaObrigacoes("2", "", "");
    }

    definirFotosArea("obrigacoes", "1", data.fotosModo1);
    definirFotosArea("obrigacoes", "2", data.fotosModo2);
    window.editingDocIdObrigacoes = docId;
  } catch (e) {
    console.error(e);
    alert("Erro ao editar lista obrigação.");
  }
};

window.excluirObrigacao = async function(docId) {
  const ok = confirm("Tem certeza que deseja excluir esta lista obrigação?");
  if (!ok) return;
  const { db, doc, deleteDoc } = fb();
  try {
    await deleteDoc(doc(db, "obrigacoes", docId));
    alert("Lista obrigação excluída!");
    renderizarObrigacoes();
  } catch (e) {
    console.error(e);
    alert("Erro ao excluir lista obrigação.");
  }
};

window.imprimirObrigacao = function(docId) {
  return abrirModalImpressaoListaCadastrada({
    collectionName: "obrigacoes",
    docId,
    tituloModal: "Imprimir lista obrigação",
    mensagens: {
      idNaoInformado: "ID da lista obrigação não informado.",
      naoEncontrado: "Lista obrigação não encontrada.",
      erro: "Erro ao imprimir lista obrigação. Veja o console (F12).",
    },
  });
};

//ESCONDER TODAS AS TELAS//
function esconderTodasAsTelas() {
const ids = [
  "postLogin",
  "adminScreen",
  "oferendasScreen",
  "banhosScreen",
  "positivosScreen",
  "listaScreen"
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
  try {
    limparSaidaPrintListaCadastrada();
  } catch {
    const saidaPrintLista = document.getElementById("saidaPrintListaCadastrada");
    if (saidaPrintLista) saidaPrintLista.style.display = "none";
  }

  printJobPendenteListaCadastrada = null;
  esconderModalImpressaoListaCadastrada();
}


function montarFotosComLegenda(area, listId, fotosBase) {
  const config = getConfigFotosArea(area);
  const preview = document.getElementById(`${config.previewPrefix}${listId}`);

  const legendas = Array.from(preview?.querySelectorAll(".foto-legenda-input") || []).map((el) => {
    if (!el) return "";
    if (el.value !== undefined) return el.value.trim();
    if (el.innerText !== undefined) return el.innerText.trim();
    return "";
  });

  return normalizarFotosOferenda(fotosBase).map((foto, i) => ({
    src: foto?.src || foto,
    legenda: legendas[i] || foto?.legenda || ""
  }));
}


// ======================================
// ABA OFERENDAS - IGUAL AO PADRÃO LISTAS
// ======================================

function mostrarEscolhaOferendas() {
  const escolha = document.getElementById("oferendasEscolha");
  const orixas = document.getElementById("container-projeto-orixas");
  const ebo = document.getElementById("container-projeto-ebo");

  if (escolha) escolha.style.display = "block";
  if (orixas) orixas.style.display = "none";
  if (ebo) ebo.style.display = "none";
}

function abrirContainerOferendasOrixa() {
  const escolha = document.getElementById("oferendasEscolha");
  const orixas = document.getElementById("container-projeto-orixas");
  const ebo = document.getElementById("container-projeto-ebo");

  if (escolha) escolha.style.display = "none";
  if (orixas) orixas.style.display = "block";
  if (ebo) ebo.style.display = "none";

  if (typeof window.renderizarOferendas === "function") {
    window.renderizarOferendas();
  }
}

function abrirContainerOferendasEbo() {
  const escolha = document.getElementById("oferendasEscolha");
  const orixas = document.getElementById("container-projeto-orixas");
  const ebo = document.getElementById("container-projeto-ebo");

  if (escolha) escolha.style.display = "none";
  if (orixas) orixas.style.display = "none";
  if (ebo) ebo.style.display = "block";

  if (typeof window.renderizarOferendasEbo === "function") {
    window.renderizarOferendasEbo();
  }
}

window.abrirTelaOferendas = function () {
  esconderTodasAsTelas();

  const oferendas = document.getElementById("oferendasScreen");
  if (oferendas) oferendas.style.display = "block";

  mostrarEscolhaOferendas();

  if (typeof window.renderizarOferendas === "function") {
    window.renderizarOferendas();
  }

  if (typeof window.renderizarOferendasEbo === "function") {
    window.renderizarOferendasEbo();
  }

  window.scrollTo({ top: 0, behavior: "instant" });
};

(function bindNavegacaoOferendas() {
  const btnOrixas = document.getElementById("btn-projeto-orixas");
  const btnEbo = document.getElementById("btn-projeto-ebo");
  const voltarOrixas = document.getElementById("voltar-orixas");
  const voltarEbo = document.getElementById("voltar-ebo");
  const voltarOferendas = document.getElementById("voltar-oferendas");

  if (btnOrixas && !btnOrixas.dataset.boundClick) {
    btnOrixas.addEventListener("click", abrirContainerOferendasOrixa);
    btnOrixas.dataset.boundClick = "1";
  }

  if (btnEbo && !btnEbo.dataset.boundClick) {
    btnEbo.addEventListener("click", abrirContainerOferendasEbo);
    btnEbo.dataset.boundClick = "1";
  }

  if (voltarOrixas && !voltarOrixas.dataset.boundClick) {
    voltarOrixas.addEventListener("click", mostrarEscolhaOferendas);
    voltarOrixas.dataset.boundClick = "1";
  }

  if (voltarEbo && !voltarEbo.dataset.boundClick) {
    voltarEbo.addEventListener("click", mostrarEscolhaOferendas);
    voltarEbo.dataset.boundClick = "1";
  }

  if (voltarOferendas && !voltarOferendas.dataset.boundClick) {
    voltarOferendas.addEventListener("click", () => {
      const screen = document.getElementById("oferendasScreen");
      const postLogin = document.getElementById("postLogin");

      if (screen) screen.style.display = "none";
      if (postLogin) postLogin.style.display = "block";

      mostrarEscolhaOferendas();
      window.scrollTo({ top: 0, behavior: "instant" });
    });

    voltarOferendas.dataset.boundClick = "1";
  }
})();


document.getElementById('btn-projeto-ebo').addEventListener('click', () => {
  document.getElementById('oferendasEscolha').style.display = 'none';
  document.getElementById('container-projeto-ebo').style.display = 'block';
  document.getElementById('container-projeto-orixas').style.display = 'none';
});

// Botões Voltar
document.getElementById('voltar-orixas').addEventListener('click', () => {
  document.getElementById('container-projeto-orixas').style.display = 'none';
  document.getElementById('oferendasEscolha').style.display = 'block';
});

document.getElementById('voltar-ebo').addEventListener('click', () => {
  document.getElementById('container-projeto-ebo').style.display = 'none';
  document.getElementById('oferendasEscolha').style.display = 'block';
});


document.getElementById('voltar-oferendas').addEventListener('click', () => {
  // Esconde toda a aba de oferendas
  document.getElementById('oferendasScreen').style.display = 'none';

  // Volta para a tela principal do app
  const postLogin = document.getElementById('postLogin');
  if (postLogin) postLogin.style.display = 'block';

  // Esconde containers de projeto caso estejam abertos
  document.getElementById('container-projeto-orixas').style.display = 'none';
  document.getElementById('container-projeto-ebo').style.display = 'none';

  // Scroll ao topo
  window.scrollTo({ top: 0, behavior: 'instant' });
});



// Abrir cada container
document.getElementById('btn-lista-obrigacao').addEventListener('click', () => {
  document.getElementById('listaEscolha').style.display = 'none';
  document.getElementById('container-lista-obrigacao').style.display = 'block';
  document.getElementById('container-lista-iba-orixa').style.display = 'none';
});

document.getElementById('btn-lista-iba-orixa').addEventListener('click', () => {
  document.getElementById('listaEscolha').style.display = 'none';
  document.getElementById('container-lista-iba-orixa').style.display = 'block';
  document.getElementById('container-lista-obrigacao').style.display = 'none';

  // chama a renderização das listas Ibá Orixá
  window.renderizarIbaOrixa();
});

// Voltar para tela de escolha
document.getElementById('voltar-lista-obrigacao').addEventListener('click', () => {
  document.getElementById('container-lista-obrigacao').style.display = 'none';
  document.getElementById('listaEscolha').style.display = 'block';
});

document.getElementById('voltar-lista-iba-orixa').addEventListener('click', () => {
  document.getElementById('container-lista-iba-orixa').style.display = 'none';
  document.getElementById('listaEscolha').style.display = 'block';
});

// Voltar para painel principal
document.getElementById('voltar-lista').addEventListener('click', () => {
  document.getElementById('listaScreen').style.display = 'none';
  document.getElementById('postLogin').style.display = 'block';
});


//botoes de voltar listas//

document.getElementById('voltar-lista').addEventListener('click', () => {
  document.getElementById('listaScreen').style.display = 'none';
  document.getElementById('postLogin').style.display = 'block';
  
});

// para funcionar modal lista iba orixa//

// Abrir e fechar modal
window.abrirModalListaIbaOrixa = function() {
  const modal = document.getElementById("modalBackdropListaIbaOrixa");
  if (!modal) return;
  modal.style.display = "flex";

  // Inicializa fotos da área
  prepararModalFotosArea("iba_orixa");
};

window.fecharModalListaIbaOrixa = function() {
  const modal = document.getElementById("modalBackdropListaIbaOrixa");
  if (!modal) return;
  modal.style.display = "none";
};
// MODO LIMPAR LINHA// 

// para funcionar modal lista iba orixa//

function modalLimparLinhasIbaOrixa(listId) {
  const tbody = document.getElementById(`modalBodyLinhasIbaOrixa_${listId}`);
  if (tbody) tbody.innerHTML = "";
}

function limparFormularioIbaOrixa() {
  if ($("modalNomeIbaOrixa_1")) $("modalNomeIbaOrixa_1").value = "";
  if ($("modalSubtituloIbaOrixa_1")) $("modalSubtituloIbaOrixa_1").value = "";
  if ($("modalModoFazerIbaOrixa_1")) $("modalModoFazerIbaOrixa_1").value = "";

  if ($("modalSubtituloIbaOrixa_2")) $("modalSubtituloIbaOrixa_2").value = "";
  if ($("modalModoFazerIbaOrixa_2")) $("modalModoFazerIbaOrixa_2").value = "";

  modalLimparLinhasIbaOrixa("1");
  modalLimparLinhasIbaOrixa("2");

  modalCriarLinhaIbaOrixa("1", "", "");
  modalCriarLinhaIbaOrixa("2", "", "");

  try {
    resetarFotosArea("iba_orixa");
  } catch (e) {
    console.warn("Não foi possível resetar fotos do modal:", e);
  }

  window.editingDocIdIbaOrixa = null;
}

window.abrirModalListaIbaOrixa = function(limpar = true) {
  const modal = document.getElementById("modalBackdropListaIbaOrixa");
  if (!modal) return;

  modal.style.display = "flex";

  try {
    prepararModalFotosArea("iba_orixa");
  } catch (e) {
    console.warn("Não foi possível preparar a área de fotos:", e);
  }

  if (limpar) {
    limparFormularioIbaOrixa();
  }
};

window.fecharModalListaIbaOrixa = function() {
  const modal = document.getElementById("modalBackdropListaIbaOrixa");
  if (!modal) return;

  modal.style.display = "none";
  limparFormularioIbaOrixa();
};

function modalCriarLinhaIbaOrixa(listId = "1", ingrediente = "", quantidade = "") {
  const tbody = document.getElementById(`modalBodyLinhasIbaOrixa_${listId}`);
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

window.modalAdicionarLinhaIbaOrixa = function(listId) {
  modalCriarLinhaIbaOrixa(listId, "", "");
};

function getLinhasIbaOrixa(listId) {
  const linhas = [];
  const selector = `#modalBodyLinhasIbaOrixa_${listId} tr`;

  document.querySelectorAll(selector).forEach((tr) => {
    const ing = (tr.querySelector(".modalIng")?.value || "").trim();
    const qtd = (tr.querySelector(".modalQtd")?.value || "").trim();

    if (ing || qtd) {
      linhas.push({
        ingrediente: ing,
        quantidade: qtd
      });
    }
  });

  return linhas;
}

window.enviarListaIbaOrixa = async function () {
  await aguardarProcessamentoFotos();
  const { auth, db, collection, addDoc, doc, setDoc, serverTimestamp } = fb();

  const nome = ($("modalNomeIbaOrixa_1")?.value || "").trim();
  const subtitulo = ($("modalSubtituloIbaOrixa_1")?.value || "").trim();
  const modo = ($("modalModoFazerIbaOrixa_1")?.value || "").trim();
  const itens = getLinhasIbaOrixa("1");

  const subtitulo2 = ($("modalSubtituloIbaOrixa_2")?.value || "").trim();
  const modo2 = ($("modalModoFazerIbaOrixa_2")?.value || "").trim();
  const itens2 = getLinhasIbaOrixa("2");
  const fotosModo1 = montarFotosComLegenda("iba_orixa", "1", getFotosAreaState("iba_orixa")["1"]);
  const fotosModo2 = montarFotosComLegenda("iba_orixa", "2", getFotosAreaState("iba_orixa")["2"]);

  console.log("[Ibá Orixá] project:", db.app.options.projectId);
  console.log("[Ibá Orixá] user:", auth.currentUser?.uid || null, auth.currentUser?.email || null);

  if (!auth.currentUser) {
    alert("❌ Você não está autenticado. Faça login novamente.");
    return;
  }

  await auth.currentUser.getIdToken(true);

  if (!nome) {
    alert("Digite o nome da Lista Ibá Orixá.");
    return;
  }

  if (!itens.some(i => (i.ingrediente || "").trim())) {
    alert("Adicione ao menos 1 ingrediente na Lista 1.");
    return;
  }

  const payload = {
    nome,
    nome_norm: normalizarTexto(nome),
    subtitulo,
    modo,
    fotosModo1,
    itens,

    nome2: "",
    nome2_norm: "",
    subtitulo2,
    modo2,
    fotosModo2,
    itens2,

    createdBy: auth.currentUser.uid,
    updatedAt: serverTimestamp()
  };

  try {
    if (window.editingDocIdIbaOrixa) {
      await setDoc(doc(db, "iba_orixa", window.editingDocIdIbaOrixa), payload, { merge: true });
      console.log("[Ibá Orixá] atualizado:", window.editingDocIdIbaOrixa);

      await renderizarIbaOrixa();
      fecharModalListaIbaOrixa();
      alert("✅ Lista Ibá Orixá atualizada com sucesso!");
    } else {
      payload.createdAt = serverTimestamp();

      const docRef = await addDoc(collection(db, "iba_orixa"), payload);
      console.log("[Ibá Orixá] salvo:", docRef.id);

      await renderizarIbaOrixa();
      fecharModalListaIbaOrixa();
      alert("✅ Lista Ibá Orixá cadastrada com sucesso!");
    }
  } catch (e) {
    console.error("[Ibá Orixá] erro:", e);
    alert(
      `❌ ${e?.code || e?.message || "erro"}\n` +
      `uid=${auth.currentUser?.uid || "null"}\n` +
      `project=${db.app.options.projectId}`
    );
  }
};

window.excluirListaIbaOrixa = async function(docId) {
  const ok = confirm("Tem certeza que deseja excluir esta Lista Ibá Orixá?");
  if (!ok) return;

  const { db, doc, deleteDoc } = fb();

  try {
    await deleteDoc(doc(db, "iba_orixa", docId));
    alert("Lista Ibá Orixá excluída!");
    renderizarIbaOrixa();
  } catch (e) {
    console.error(e);
    alert("Erro ao excluir Lista Ibá Orixá. Veja o console (F12).");
  }
};

window.imprimirListaIbaOrixa = function(docId) {
  return abrirModalImpressaoListaCadastrada({
    collectionName: "iba_orixa",
    docId,
    tituloModal: "Imprimir Lista Ibá Orixá",
    mensagens: {
      idNaoInformado: "ID da lista Ibá Orixá não informado.",
      naoEncontrado: "Lista não encontrada.",
      erro: "Erro ao imprimir lista Ibá Orixá. Veja o console (F12).",
    },
  });
};

window.editarIbaOrixa = async function(docId) {
  const { db, doc, getDoc } = fb();

  try {
    const snap = await getDoc(doc(db, "iba_orixa", docId));
    if (!snap.exists()) {
      alert("Oferenda não encontrada.");
      return;
    }

    const data = snap.data();

    abrirModalListaIbaOrixa(false);

    // Lista 1
    if ($("modalNomeIbaOrixa_1")) $("modalNomeIbaOrixa_1").value = data.nome || "";
    if ($("modalSubtituloIbaOrixa_1")) $("modalSubtituloIbaOrixa_1").value = data.subtitulo || "";
    if ($("modalModoFazerIbaOrixa_1")) $("modalModoFazerIbaOrixa_1").value = data.modo || "";

    modalLimparLinhasIbaOrixa("1");
    if (Array.isArray(data.itens) && data.itens.length) {
      data.itens.forEach((it) => {
        modalCriarLinhaIbaOrixa("1", it.ingrediente || "", it.quantidade || "");
      });
    } else {
      modalCriarLinhaIbaOrixa("1", "", "");
    }

    // Lista 2
    if ($("modalSubtituloIbaOrixa_2")) $("modalSubtituloIbaOrixa_2").value = data.subtitulo2 || "";
    if ($("modalModoFazerIbaOrixa_2")) $("modalModoFazerIbaOrixa_2").value = data.modo2 || "";

    modalLimparLinhasIbaOrixa("2");
    if (Array.isArray(data.itens2) && data.itens2.length) {
      data.itens2.forEach((it) => {
        modalCriarLinhaIbaOrixa("2", it.ingrediente || "", it.quantidade || "");
      });
    } else {
      modalCriarLinhaIbaOrixa("2", "", "");
    }

    try {
      definirFotosArea("iba_orixa", "1", data.fotosModo1 || []);
      definirFotosArea("iba_orixa", "2", data.fotosModo2 || []);
    } catch (e) {
      console.warn("Não foi possível definir as fotos da edição:", e);
    }

    window.editingDocIdIbaOrixa = docId;
  } catch (e) {
    console.error(e);
    alert("Erro ao editar Lista Ibá Orixá.");
  }
};

// IMPRIMIR MAIS RÁPIDO//

window.onafterprint = function () {
  const area = document.getElementById("saidaPrint");
  if(area){
    area.style.display = "none";
  }
};






//PROTEÇÃO NO JS//
//if (mostrarTituloLista) {
  //const tituloLista = document.createElement("h2");
  //tituloLista.className = "print-list-block-title";
  //tituloLista.textContent = bloco.tituloLista;
  //wrap.appendChild(tituloLista);
//}


// 🔒 BLOQUEAR CLIQUE DIREITO
//document.addEventListener("contextmenu", function(e) {
  //e.preventDefault();
//});

// 🔒 BLOQUEAR F12, CTRL+SHIFT+I, CTRL+U/
//document.addEventListener("keydown", function(e) {
  //if (
    //e.key === "F12" ||
    //(e.ctrlKey && e.shiftKey && e.key === "I") ||
    //(e.ctrlKey && e.key === "u")
  //) {
    //e.preventDefault();
 // }
//});

// 🔒 DETECTAR DEVTOOLS ABERTO//
//setInterval(function() {
  //const aberto = window.outerWidth - window.innerWidth > 160;
  //if (aberto) {
    //document.body.innerHTML = "<h1 style='color:red;text-align:center'>Acesso bloqueado</h1>";
  //}
//}, 1000);

// ============================
// ABA ALEATÓRIO
// ============================

// Abrir e fechar modal
window.abrirModalAleatorio = function() {
  document.getElementById("modalBackdropAleatorio").style.display = "flex";
};
window.fecharModalAleatorio = function() {
  document.getElementById("modalBackdropAleatorio").style.display = "none";
};

// Limpar linhas do modal
function modalLimparLinhasAleatorio(listId) {
  const tbody = document.getElementById(`modalBodyLinhasAleatorio_${listId}`);
  if (tbody) tbody.innerHTML = "";
}

// Criar linha editável
function modalCriarLinhaAleatorio(listId = "1", nome = "", quantidade = "") {
  const tbody = document.getElementById(`modalBodyLinhasAleatorio_${listId}`);
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="modalIng" type="text" placeholder="Ex: Item" value="${nome}" /></td>
    <td><input class="modalQtd" type="text" placeholder="Ex: 7" value="${quantidade}" /></td>
    <td><button class="btn-danger btn-mini" type="button">Remover</button></td>
  `;
  tr.querySelector("button").onclick = () => tr.remove();
  tbody.appendChild(tr);
}

// Adicionar linha
window.modalAdicionarLinhaAleatorio = function(listId) {
  modalCriarLinhaAleatorio(listId, "", "");
};

// Obter linhas do modal
function getLinhasAleatorio(listId) {
  const linhas = [];
  document.querySelectorAll(`#modalBodyLinhasAleatorio_${listId} tr`).forEach(tr => {
    const ing = (tr.querySelector(".modalIng")?.value || "").trim();
    const qtd = (tr.querySelector(".modalQtd")?.value || "").trim();
    if (ing || qtd) linhas.push({ ingrediente: ing, quantidade: qtd });
  });
  return linhas;
}

// Enviar para Firebase
window.enviarParaBancoAleatorio = async function() {
  try {
    const lista1 = getLinhasAleatorio("1");
    if (!lista1.length) return alert("Adicione ao menos 1 item.");

    const nome = document.getElementById("modalNomeAleatorio_1")?.value || "Sem nome";

    const { db, collection, addDoc, serverTimestamp } = fb();
    const docRef = await addDoc(collection(db, "aleatorio"), {
      nome,
      itens: lista1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // 🔹 Atualizar a lista em tempo real
    const box = document.getElementById("aleatorioSalvosBox");
    if (box) {
      const itemHTML = `
        <div class="saved-item" id="aleatorio_${docRef.id}">
          <div>
            <div class="saved-title">${nome}</div>
            <div class="saved-meta">${lista1.map(it => it.ingrediente + " • " + it.quantidade).join(", ")}</div>
          </div>
          <div class="saved-actions-row">
            <button class="btn-mini btn-mini-open" onclick="editarAleatorio('${docRef.id}')">Editar</button>
            <button class="btn-mini btn-mini-del" onclick="excluirAleatorio('${docRef.id}')">Excluir</button>
            <button class="btn-mini btn-print" onclick="imprimirAleatorio('${docRef.id}')">Imprimir</button>
          </div>
        </div>
      `;
      box.insertAdjacentHTML("afterbegin", itemHTML);
    }

    fecharModalAleatorio();
    alert("✅ Aleatório cadastrado com sucesso!");
  } catch (e) {
    console.error(e);
    alert("Erro ao salvar Aleatório.");
  }
};
window.abrirTelaAleatorio = function() {
  esconderTodasAsTelas();

  const tela = document.getElementById("aleatorioScreen");
  if (tela) {
    tela.style.display = "block";       // mostra a aba
    tela.style.position = "absolute";   // garante que está fora do fluxo
    tela.scrollTop = 0;                 // scroll interno
  }

  window.scrollTo({ top: 0, behavior: "instant" }); // scroll da página
  if (typeof window.renderizarAleatorio === "function") {
    window.renderizarAleatorio();
  }
};
// Renderizar itens (simplificado)
window.renderizarAleatorio = async function() {
  const box = document.getElementById("aleatorioSalvosBox");
  if (!box) return;

  const { db, collection, getDocs, query, orderBy, limit } = fb();

  box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Carregando...</div></div></div>`;
  try {
    const q = query(collection(db, "aleatorio"), orderBy("updatedAt", "desc"), limit(100));
    const snaps = await getDocs(q);
    const items = [];
    snaps.forEach(s => items.push({ id: s.id, ...s.data() }));

    box.innerHTML = items.map(item => {
      const nItens = Array.isArray(item.itens) ? item.itens.length : 0;
      return `
        <div class="saved-item">
          <div>
            <div class="saved-title">${item.nome || "(sem nome)"}</div>
            <div class="saved-meta">Itens: ${nItens}</div>
          </div>
          <div class="saved-actions-row">
            <button class="btn-mini btn-mini-open" onclick="editarAleatorio('${item.id}')">Editar</button>
            <button class="btn-mini btn-mini-del" onclick="excluirAleatorio('${item.id}')">Excluir</button>
            <button class="btn-mini btn-print" onclick="imprimirAleatorio('${item.id}')">Imprimir</button>
          </div>
        </div>
      `;
    }).join("");
  } catch (e) {
    console.error(e);
    box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Erro ao carregar</div></div></div>`;
  }
};


// Abrir e fechar modal
window.abrirModalAleatorio = function() {
  prepararModalFotosArea("aleatorio");
  const modal = document.getElementById("modalBackdropAleatorio");
  if (modal) modal.style.display = "flex";
};

window.fecharModalAleatorio = function() {
  document.getElementById("modalBackdropAleatorio").style.display = "none";
};

// Limpar linhas e inputs
function limparFormularioAleatorio() {
  $("modalNomeAleatorio_1").value = "";
  $("modalSubtituloAleatorio_1").value = "";
  $("modalSubtituloAleatorio_2").value = "";
  $("modalModoFazerAleatorio_1").value = "";
  $("modalModoFazerAleatorio_2").value = "";
  modalLimparLinhasAleatorio("1");
  modalLimparLinhasAleatorio("2");
  modalCriarLinhaAleatorio("1", "", "");
  modalCriarLinhaAleatorio("2", "", "");
  resetarFotosArea("aleatorio");
}

// Obter payload

function modalGetPayloadAleatorio() {
  const lista1 = {
    nome: $("modalNomeAleatorio_1")?.value || "",
    subtitulo: $("modalSubtituloAleatorio_1")?.value || "",
    modo: $("modalModoFazerAleatorio_1")?.value || "",
    itens: getLinhasAleatorio("1")
  };
  const lista2 = {
    subtitulo: $("modalSubtituloAleatorio_2")?.value || "",
    modo: $("modalModoFazerAleatorio_2")?.value || "",
    itens: getLinhasAleatorio("2")
  };
  return {
    lista1,
    lista2,
    fotosModo1: montarFotosComLegenda("aleatorio", "1", getFotosAreaState("aleatorio")["1"]),
    fotosModo2: montarFotosComLegenda("aleatorio", "2", getFotosAreaState("aleatorio")["2"]),
  };
}

async function renderizarAleatorio() {
  const box = $("aleatorioSalvosBox");
  if (!box) return;
  const { db, collection, getDocs, query, orderBy, limit } = fb();
  box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Carregando...</div></div></div>`;
  try {
    const q = query(collection(db, "aleatorio"), orderBy("updatedAt", "desc"), limit(100));
    const snaps = await getDocs(q);
    const items = [];
    snaps.forEach(s => items.push({ id: s.id, ...s.data() }));
    box.innerHTML = items.map(item => `
      <div class="saved-item">
        <div>
          <div class="saved-title">${item.nome || "(sem nome)"}</div>
          <div class="saved-meta">Itens: ${item.itens.length}</div>
        </div>
        <div class="saved-actions-row">
          <button class="btn-mini btn-mini-open" onclick="editarAleatorio('${item.id}')">Editar</button>
          <button class="btn-mini btn-mini-del" onclick="excluirAleatorio('${item.id}')">Excluir</button>
          <button class="btn-mini btn-print" onclick="imprimirAleatorio('${item.id}')">Imprimir</button>
        </div>
      </div>
    `).join("");
  } catch(e) { console.error(e); box.innerHTML = `<div class="saved-item"><div><div class="saved-title">Erro</div></div></div>`; }
}

window.editarAleatorio = async function(docId) {
  const { db, doc, getDoc } = fb();
  try {
    const snap = await getDoc(doc(db, "aleatorio", docId));
    if (!snap.exists()) return alert("Item Aleatório não encontrado.");
    const data = snap.data();

    abrirModalAleatorio();

    $("modalNomeAleatorio_1").value = data.nome || "";
    modalLimparLinhasAleatorio("1");
    (data.itens || []).forEach(it => modalCriarLinhaAleatorio("1", it.ingrediente || "", it.quantidade || ""));

    window.editingDocIdAleatorio = docId;
  } catch (e) {
    console.error(e);
    alert("Erro ao editar Aleatório.");
  }
};

window.excluirAleatorio = async function(docId) {
  const ok = confirm("Tem certeza que deseja excluir este Aleatório?");
  if (!ok) return;
  const { db, doc, deleteDoc } = fb();
  try {
    await deleteDoc(doc(db, "aleatorio", docId));
    alert("Aleatório excluído!");
    renderizarAleatorio();
  } catch (e) {
    console.error(e);
    alert("Erro ao excluir Aleatório.");
  }
};

window.imprimirAleatorio = function(docId) {
  return abrirModalImpressaoListaCadastrada({
    collectionName: "aleatorio",
    docId,
    tituloModal: "Imprimir Aleatório",
    mensagens: {
      idNaoInformado: "ID do Aleatório não informado.",
      naoEncontrado: "Item não encontrado.",
      erro: "Erro ao imprimir Aleatório. Veja o console (F12).",
    },
  });
};

// Enviar para Firestore
window.enviarParaBancoAleatorio = async function () {
  await aguardarProcessamentoFotos();
  try {
    const payloadModal = modalGetPayloadAleatorio();
    const { db, collection, addDoc, serverTimestamp } = fb();

    if (!payloadModal.lista1.nome) return alert("Digite o nome da Lista 1.");
    if (!payloadModal.lista1.itens.length) return alert("Adicione ao menos 1 item na Lista 1.");

    const docPayload = {
      nome: payloadModal.lista1.nome,
      nome_norm: normalizarTexto(payloadModal.lista1.nome),
      subtitulo: payloadModal.lista1.subtitulo,
      modo: payloadModal.lista1.modo,
      fotosModo1: payloadModal.fotosModo1,
      itens: payloadModal.lista1.itens,
      subtitulo2: payloadModal.lista2.subtitulo,
      modo2: payloadModal.lista2.modo,
      fotosModo2: payloadModal.fotosModo2,
      itens2: payloadModal.lista2.itens || [],
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, "aleatorio"), docPayload);
    alert("✅ Aleatório cadastrado com sucesso!");
    fecharModalAleatorio();

    renderizarAleatorio();
  } catch (e) {
    console.error(e);
    alert("Erro ao enviar Aleatório.");
  }
};

/* =======================================================
   V10 - IMPRESSÃO CORRIGIDA
   O PDF continua igual. Este bloco só troca o botão Imprimir
   para usar uma página temporária própria, evitando folha em branco
   causada por display:none / CSS de impressão da tela principal.
======================================================= */
(function () {
  function escPrint(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function textoLinhaPrint(value) {
    return escPrint(value || "—").replace(/\n/g, "<br>");
  }

  function obterLogoParaImpressao() {
    try {
      if (typeof PDF_LOGO_EMBUTIDA !== "undefined" && PDF_LOGO_EMBUTIDA?.base64) {
        return `data:image/jpeg;base64,${PDF_LOGO_EMBUTIDA.base64}`;
      }
    } catch (e) {}
    return "./imagem.png";
  }

  function montarHtmlImpressaoListaGerada() {
    const linhas = (typeof pdfColetarLinhasDaLista === "function") ? pdfColetarLinhasDaLista() : [];
    if (!linhas.length) return "";

    const dataFuncao = (typeof obterTextoDataFuncao === "function") ? obterTextoDataFuncao() : "";
    const logoSrc = obterLogoParaImpressao();

    const linhasHtml = linhas.map((item) => `
      <tr>
        <td class="print-total">${textoLinhaPrint(item.quantidade)}</td>
        <td class="print-ing"><strong>${textoLinhaPrint(item.ingrediente)}</strong></td>
        <td class="print-origens">${textoLinhaPrint(item.origens)}</td>
        <td class="print-observacoes">${textoLinhaPrint(item.observacoes)}</td>
      </tr>
    `).join("");

    let conferenciaHtml = "";
    try {
      const conferencia = document.getElementById("printConferenciaMesas");
      if (conferencia && conferencia.innerHTML.trim()) {
        const clone = conferencia.cloneNode(true);
        clone.style.display = "block";
        conferenciaHtml = `<section class="conferencia-print">${clone.innerHTML}</section>`;
      }
    } catch (e) {}

    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Lista de Ebó</title>
  <style>
    @page { size: A4 portrait; margin: 7mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #ffffff; color: #111827; }
    body { font-family: Inter, Arial, Helvetica, sans-serif; font-size: 12px; }
    .print-header { text-align: center; margin: 0 0 12px 0; padding: 0; }
    .print-logo { display: block; width: 125px; height: auto; margin: 0 auto 6px auto; }
    h1 { margin: 0; font-size: 32px; line-height: 1.08; font-weight: 900; letter-spacing: -0.03em; }
    .print-funcao-data { margin-top: 8px; font-size: 16px; line-height: 1.2; font-weight: 900; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; page-break-inside: auto; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    th, td { border: 1px solid #111827; text-align: center; vertical-align: middle; }
    th { padding: 8px 4px; font-size: 14px; line-height: 1.1; font-weight: 900; color: #374151; white-space: normal; }
    td { padding: 9px 7px; font-size: 12px; line-height: 1.32; white-space: normal; overflow-wrap: anywhere; }
    .print-total { width: 21%; font-weight: 900; }
    .print-ing { width: 29%; font-weight: 900; }
    .print-origens { width: 20%; color: #4b5563; }
    .print-observacoes { width: 30%; color: #374151; }
    .conferencia-print { page-break-before: always; break-before: page; margin-top: 0; }
    .conferencia-print * { box-sizing: border-box; }
    .conf-capa { text-align: center; border: 1.6px solid #94a3b8; border-radius: 14px; padding: 14px; margin: 0 0 14px 0; }
    .conf-capa h1 { font-size: 24px; }
    .conf-resumo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; }
    .conf-resumo-card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 8px; }
    .conf-mesa-bloco { border: 1.3px solid #94a3b8; border-radius: 12px; margin: 0 0 14px 0; overflow: hidden; page-break-inside: avoid; break-inside: avoid; }
    .conf-mesa-topo { display: flex; justify-content: space-between; gap: 10px; background: #f8fafc; border-bottom: 1px solid #cbd5e1; padding: 8px 10px; font-weight: 900; }
    .conf-mesa-conteudo { padding: 10px; }
    .conf-mesa-lista { margin: 0; padding-left: 18px; }
    .conf-mesa-lista li { margin: 0 0 5px 0; }
    @media print {
      .no-print { display: none !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <section class="print-area">
    <div class="print-header">
      <img class="print-logo" src="${logoSrc}" alt="Ilê D'Ogum">
      <h1>Ilê D'Ogum</h1>
      <div class="print-funcao-data">${escPrint(dataFuncao)}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="print-total">QUANTIDADES</th>
          <th class="print-ing">INGREDIENTES</th>
          <th class="print-origens">ORIGENS</th>
          <th class="print-observacoes">OBSERVAÇÕES</th>
        </tr>
      </thead>
      <tbody>${linhasHtml}</tbody>
    </table>
  </section>
  ${conferenciaHtml}
</body>
</html>`;
  }

  function imprimirHtmlEmIframe(html) {
    const antigo = document.getElementById("iframeImpressaoListaGeradaV10");
    antigo?.remove?.();

    const iframe = document.createElement("iframe");
    iframe.id = "iframeImpressaoListaGeradaV10";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "1px";
    iframe.style.height = "1px";
    iframe.style.opacity = "0";
    iframe.style.border = "0";
    iframe.style.pointerEvents = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    const executarPrint = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } finally {
        setTimeout(() => iframe.remove(), 3000);
      }
    };

    const aguardar = () => {
      const imgs = Array.from(doc.images || []);
      if (!imgs.length) {
        setTimeout(executarPrint, 150);
        return;
      }
      let pendentes = imgs.length;
      const terminou = () => {
        pendentes -= 1;
        if (pendentes <= 0) setTimeout(executarPrint, 150);
      };
      imgs.forEach((img) => {
        if (img.complete) terminou();
        else {
          img.onload = terminou;
          img.onerror = terminou;
        }
      });
      setTimeout(() => {
        if (pendentes > 0) executarPrint();
      }, 1200);
    };

    setTimeout(aguardar, 80);
  }

  window.imprimirListaGerada = function imprimirListaGeradaCorrigida() {
    const linhas = (typeof pdfColetarLinhasDaLista === "function") ? pdfColetarLinhasDaLista() : [];
    if (!linhas.length) {
      alert("Gere a lista antes de imprimir.");
      return;
    }

    if (typeof exigirDataFuncaoAntesDeSaida === "function" && !exigirDataFuncaoAntesDeSaida()) return;

    try {
      if (typeof gerarConferenciaMesasParaImpressao === "function") {
        gerarConferenciaMesasParaImpressao();
      }
    } catch (e) {
      console.warn("Não foi possível atualizar a conferência antes de imprimir.", e);
    }

    const html = montarHtmlImpressaoListaGerada();
    if (!html) {
      alert("Não encontrei a lista gerada para imprimir.");
      return;
    }

    imprimirHtmlEmIframe(html);
  };
})();
