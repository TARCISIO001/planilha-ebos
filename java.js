
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
  const pratos = item?.pratosTxt ?? item?.pratos ?? "";

  return `
    <tr${manual ? ' data-manual="1"' : ""}>
      <td class="print-total" data-label="Total">
        <input class="editQtd" type="text" placeholder="Qtd" value="${escaparValorInput(total)}">
      </td>

      <td class="print-ing" data-label="Ingrediente">
        <input class="editIng" type="text" placeholder="Ingrediente" value="${escaparValorInput(ingrediente)}">
      </td>

      <td class="print-pratos" data-label="Pratos">
        <div class="preview-pratos-cell">
          <input class="editPratos" type="text" placeholder="Pratos" value="${escaparValorInput(pratos)}">
          ${manual ? `
            <button class="btn-danger btn-mini" type="button" onclick="this.closest('tr').remove()">
              Remover
            </button>
          ` : ""}
        </div>
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

      const pratos = (
        tr.querySelector(".editPratos")?.value ||
        lerTextoTabelaSemBotoes(tr.querySelector(".print-pratos"))
      ).trim();

      return { quantidade, ingrediente, pratos };
    })
    .filter((item) => item.quantidade || item.ingrediente || item.pratos);
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


window.fecharModal = function fecharModal() {
  $("modalBackdrop") && ($("modalBackdrop").style.display = "none");
};

function abrirModal() {
  prepararModalFotosArea("listas");
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
              <button class="btn-mini btn-mini-open" onclick="editarLista('${item.id}')">Editar</button>
              <button class="btn-mini btn-mini-del" onclick="excluirLista('${item.id}')">Excluir</button>
              <button class="btn-mini btn-print" onclick="imprimirListaCadastrada('${item.id}')">Imprimir</button>
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
window.imprimirListaGerada = function imprimirListaGerada() {
  const area = document.getElementById("saidaPrint");
  const tbody = document.getElementById("printIngredientes");

  if (!area || !tbody) {
    alert("Não achei a área de impressão no HTML.");
    return;
  }

  let linhasEditadas = coletarLinhasEditaveisListaGerada();

  if (!linhasEditadas.length && window.__listasAcumuladas?.length) {
    try {
      window.gerarListaFinalAcumulada();
      linhasEditadas = coletarLinhasEditaveisListaGerada();
    } catch (e) {
      console.error(e);
    }
  }

  if (!linhasEditadas.length) {
    alert("Adicione a lista primeiro para imprimir.");
    return;
  }

  try { limparSaidaPrintListaCadastrada(); } catch {}

  tbody.innerHTML = "";

  linhasEditadas.forEach((item) => {
    const tr = document.createElement("tr");

    const tdTotal = document.createElement("td");
    tdTotal.className = "print-total";
    tdTotal.textContent = item.quantidade || "—";

    const tdIng = document.createElement("td");
    tdIng.className = "print-ing";
    tdIng.textContent = item.ingrediente || "—";

    const tdPratos = document.createElement("td");
    tdPratos.className = "print-pratos";
    tdPratos.textContent = item.pratos || "—";

    tr.appendChild(tdTotal);
    tr.appendChild(tdIng);
    tr.appendChild(tdPratos);
    tbody.appendChild(tr);
  });

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


//ADICIONAR FUNCAO NOVA LINHA ANTES DE IMPRIMIR//

function adicionarLinhaManual(){
  const tabela = document.querySelector("#listaGeradaContainer table tbody");

  if(!tabela) {
    alert("Adicione uma lista primeiro.");
    return;
  }

  tabela.insertAdjacentHTML(
    "beforeend",
    montarLinhaEditavelListaGerada({ totalTxt: "", ingrediente: "", pratosTxt: "" }, true)
  );

  tabela.lastElementChild?.querySelector(".editQtd")?.focus();
}

window.adicionarLinhaManual = adicionarLinhaManual;
// =======================================================
// 🔹 IMPRESSÃO DAS LISTAS CADASTRADAS
// - abre um aviso com checkbox antes de imprimir
// - mantém o layout atual da folha
// - segue a ordem do modal: ingredientes → modo / ingredientes → modo
// =======================================================

let printJobPendenteListaCadastrada = null;

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

  if (titulo) titulo.textContent = config.tituloModal || "Imprimir lista";
  if (checkboxModos) checkboxModos.checked = true;
  if (checkboxFotos) checkboxFotos.checked = true;

  modal.style.display = "flex";
}

window.fecharModalImpressaoListaCadastrada = function fecharModalImpressaoListaCadastrada() {
  printJobPendenteListaCadastrada = null;
  esconderModalImpressaoListaCadastrada();
};

function confirmarImpressaoListaCadastrada() {
  const incluirFotos = document.getElementById("checkImprimirFotosListaCadastrada").checked;

  // Limpa a área de impressão antes de adicionar novos elementos
  const areaImpressao = document.getElementById("saidaPrintListaCadastrada");
  areaImpressao.innerHTML = "";  // Limpa a área

  if (incluirFotos) {
    // Seleciona todas as imagens com a classe 'foto-classe'
    const imagensModais = document.querySelectorAll(".foto-classe");
    
    imagensModais.forEach(img => {
      const imgClone = img.cloneNode(true); // Clona a imagem
      // Adiciona a imagem clonada à área de impressão imediatamente
      areaImpressao.appendChild(imgClone);
    });
  }

  // Exibe a área de impressão (apenas quando for necessário)
  document.getElementById("saidaPrintListaCadastrada").style.display = 'block';

  // Realiza a impressão
  window.print();
}

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

function normalizarItensBlocoImpressao(itens = []) {
  return (Array.isArray(itens) ? itens : []).filter((it) => {
    const ing = (it?.ingrediente || "").toString().trim();
    const qtd = (it?.quantidade || "").toString().trim();
    return ing || qtd;
  });
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

function blocoTemConteudoImprimivel(bloco, incluirModo, incluirFotos) {
  return !!(
    bloco?.itens?.length ||
    (bloco?.subtitulo || "").trim() ||
    (incluirModo && (bloco?.modo || "").trim()) ||
    (incluirFotos && bloco?.fotos?.length)
  );
}

function montarConteudoImpressaoListaCadastrada(data, incluirModo = true, incluirFotos = true) {
  const conteudo = document.getElementById("printListaCadastradaConteudo");
  if (!conteudo) return;

  conteudo.innerHTML = "";

  const blocos = [
    {
      tituloLista: "Lista 1",
      subtitulo: (data?.subtitulo || "").toString().trim(),
      itens: normalizarItensBlocoImpressao(data?.itens),
      modo: (data?.modo || "").toString().trim(),
      fotos: normalizarFotosOferenda(data?.fotosModo1),
      tituloModo: "Modo de fazer",
    },
    {
      tituloLista: "Lista 2",
      subtitulo: (data?.subtitulo2 || "").toString().trim(),
      itens: normalizarItensBlocoImpressao(data?.itens2),
      modo: (data?.modo2 || "").toString().trim(),
      fotos: normalizarFotosOferenda(data?.fotosModo2),
      tituloModo: "Modo de preparo",
    },
  ];

  // Filtra apenas os blocos que têm conteúdo
  const blocosAtivos = blocos.filter((bloco) => {
    return (
      bloco.itens.length > 0 || // Tem itens
      (bloco.subtitulo && bloco.subtitulo.trim()) || // Tem subtítulo
      (incluirModo && bloco.modo && bloco.modo.trim()) || // Tem modo de fazer
      (incluirFotos && bloco.fotos && bloco.fotos.length > 0) // Tem fotos
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

    // Só mostra ingredientes se houver itens
    if (bloco.itens.length > 0) {
      wrap.appendChild(criarTabelaIngredientesBlocoImpressao(bloco.itens));
    }

    const deveMostrarModo = incluirModo && bloco.modo;
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
          img.src = foto?.src || foto;
          img.alt = (foto?.legenda || "").trim() || `${bloco.tituloModo} ${index + 1}`;
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
      } catch {}
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
    const snap = await getDoc(doc(db, collectionName, String(docId)));

    if (!snap.exists()) {
      alert(mensagens.naoEncontrado || "Registro não encontrado.");
      return;
    }

 const data = snap.data() || {};
const incluirModo = opcoes?.incluirModo !== false;
const incluirFotos = opcoes?.incluirFotos !== false;

titulo.textContent = data.nome || "(sem nome)";
montarConteudoImpressaoListaCadastrada(data, incluirModo, incluirFotos);

    area.style.display = "block";
    document.body.classList.add("print-lista-cadastrada");

    await aguardarFramesImpressao(2);
    void area.offsetHeight;
    await aguardarImagensAreaImpressao(area);
    await new Promise((resolve) => setTimeout(resolve, 180));

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
    alert(mensagens.erro || "Erro ao imprimir. Veja o console (F12).");
    cleanup();
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
      ? linhas.map((item) => montarLinhaEditavelListaGerada({
          totalTxt: item.totalTxt,
          ingrediente: item.ingrediente,
          pratosTxt: montarTextoPratosLista(item),
        })).join("")
      : `
          <tr>
            <td class="print-total" data-label="Total">—</td>
            <td class="print-ing" data-label="Ingrediente">Nenhum item gerado.</td>
            <td class="print-pratos" data-label="Pratos">—</td>
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
  
  // 🔄 RESETA OS CAMPOS APÓS ADICIONAR
  if ($("eboNome")) $("eboNome").value = "";
  if ($("numPratos")) $("numPratos").value = "1";
  
  // Foca no campo do nome do ebó para facilitar a próxima entrada
  if ($("eboNome")) $("eboNome").focus();

  // 🔹 NOVO: gera a lista final automaticamente
  window.gerarListaFinalAcumulada();

// Novo código (copie e cole isto)
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
}
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
  esconderTodasAsTelas(); // 🔹 esconde tudo

  const app = document.getElementById("postLogin");
  if (app) app.style.display = "block";

  window.scrollTo({ top: 0, behavior: "instant" });
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
  oferendas_ebo: { stateKey: "__oferendasEboFotos", inputPrefix: "modalFotosOferendaEbo_", previewPrefix: "previewFotosOferendaEbo_" },
  banhos: { stateKey: "__banhosFotos", inputPrefix: "modalFotosBanho_", previewPrefix: "previewFotosBanho_" },
  obrigacoes: { stateKey: "__obrigacoesFotos", inputPrefix: "modalFotosObrigacao_", previewPrefix: "previewFotosObrigacao_" },
  iba_orixa: { stateKey: "__ibaOrixaFotos", inputPrefix: "modalFotosIbaOrixa_", previewPrefix: "previewFotosIbaOrixa_" },
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







//PROTEÇÃO NO JS//
if (mostrarTituloLista) {
  const tituloLista = document.createElement("h2");
  tituloLista.className = "print-list-block-title";
  tituloLista.textContent = bloco.tituloLista;
  wrap.appendChild(tituloLista);
}


 //🔒 BLOQUEAR CLIQUE DIREITO
document.addEventListener("contextmenu", function(e) {
  e.preventDefault();
});

// 🔒 BLOQUEAR F12, CTRL+SHIFT+I, CTRL+U/
document.addEventListener("keydown", function(e) {
  if (
    e.key === "F12" ||
    (e.ctrlKey && e.shiftKey && e.key === "I") ||
    (e.ctrlKey && e.key === "u")
  ) {
    e.preventDefault();
 }
});

// 🔒 DETECTAR DEVTOOLS ABERTO//
setInterval(function() {
  const aberto = window.outerWidth - window.innerWidth > 160;
  if (aberto) {
    document.body.innerHTML = "<h1 style='color:red;text-align:center'>Acesso bloqueado</h1>";
  }
}, 1000);

function imprimirLista() {
  window.print();
}

function imprimirLista() {
  window.print();
}

function imprimirLista() {
  window.print();
}

// Versão alternativa para Safari
function safariPrint() {
  const content = document.querySelector('.print-area').innerHTML;
  const originalContent = document.body.innerHTML;
  
  document.body.innerHTML = content;
  window.print();
  document.body.innerHTML = originalContent;
}
