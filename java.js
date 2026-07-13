
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

function confirmarExclusaoDupla(nomeItem = "este item") {

  const primeira = confirm(
    `⚠️ Você está tentando excluir ${nomeItem}.\n\nDeseja continuar?`
  );

  if (!primeira) {
    return false;
  }


  const segunda = confirm(
    `🚨 CONFIRMAÇÃO FINAL\n\n` +
    `Essa exclusão não poderá ser desfeita.\n\n` +
    `Tem certeza absoluta que deseja excluir ${nomeItem}?`
  );

  return segunda;
}


function confirmarExclusaoDupla(nomeItem = "este item") {

  const primeira = confirm(
    `⚠️ Você está prestes a excluir ${nomeItem}.\n\nDeseja realmente continuar?`
  );

  if (!primeira) {
    return false;
  }

  const segunda = confirm(
    `🚨 ATENÇÃO!\n\nEsta ação não pode ser desfeita.\n\nTem certeza absoluta que deseja excluir ${nomeItem}?`
  );

  return segunda;
}

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

function normalizarIngredienteParaObs(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function obterObservacaoAutomaticaIngrediente(ingrediente) {
  const nome = normalizarIngredienteParaObs(ingrediente);
  if (!nome) return "";
// Morim preto, vermelho e branco//
if (
  nome.includes("morim preto") &&
  nome.includes("vermelho") &&
  nome.includes("branco")
) {
  return "1 metro de morim preto, 1 metro de morim vermelho e 1 metro de morim branco.";
}
// Morim branco
  if (
    nome.includes("morim") &&
    nome.includes("branco")
  ) {
    return "1 metro de morim branco.";
  }
  
// Molhos de couve 
if (nome.includes("molhos de couve")) {
  return "São 2 molhos de couve para CADA pessoa.";
}

  // A regra mais especifica precisa vir antes da regra geral de ekuru.
  if (nome.includes("ekuru") && nome.includes("feijao branco")) {
    return "FEIJ\u00c3O BRANCO.";
  }

  if (nome.includes("ekuru")) {
    return "Farinha de acaraj\u00e9.";
  }

  if (nome.includes("cebola") && (nome.includes("femea") || nome.includes("fcemea"))) {
    return "Redondas.";
  }

  if (nome.includes("linhas coloridas")) {
    return "Uma de cada cor, exceto PRETA.";
  }

  if (nome.includes("7 qualidades de cereais torrados")) {
    return "Arroz de casca, lentilha, semente de gitassol, gr\u00e3o de bico, milho vermelho, ervilha, e arroz ( \u00daltimo caso entra FEIJ\u00c3O FRADINHO ).";
  }

  if (nome.includes("9 qualidades de cereais torrados")) {
    return "Arroz com casca, amendoim, lentilha, arroz branco, gr\u00e3o de bico, milho vermelho, ervilha, semente de girassol, e canjica.";
  }

  if (nome.includes("9 qualidades de feijoes torrados")) {
    return "Mulatinho, roxinho, cavalinho, branco, manteiga, cariocaquinha, e enxofre.";
  }

  if (
    nome.includes("9 qualidades de feijoes aferventados") ||
    nome.includes("9 qualidades de feijoes afreventados")
  ) {
    return "Mulatinho, roxinho, cavalinho, branco, manteiga, carioquinha, vermelho, de corda, e enxofre.";
  }

  if (
    nome.includes("7 qualidades de feijoes aferventados") ||
    nome.includes("7 qualidades de feijoes afreventados")
  ) {
    return "Mulatinho, roxinho, cavalinho, branco, manteiga, carioquinha, e enxofre.";
  }

  return "";
}

function obterObservacoesAutomaticasEbos(ebos) {
  const texto = normalizarIngredienteParaObs(ebos);
  if (!texto || texto === "—") return "";

  const encontrados = [];
  const adicionar = (padrao, textoObservacao) => {
    const indice = texto.search(padrao);
    if (indice < 0 || encontrados.some((item) => item.texto === textoObservacao)) return;
    encontrados.push({ indice, texto: textoObservacao });
  };

  // As regras apenas leem a coluna EBÓS; a lógica e os cálculos existentes não são alterados.
  adicionar(
    /\bebo\s+de\s*7\s+completo\b/,
    "Ebó de 7 completo  Dênde, mel, aguá, cachaça, açucar, sal, e azeite doce."
  );

  adicionar(
    /\bebo\s+exu\s+11\b/,
    "Ebó Exu 11  Dênde, mel, e cachaça ."
  );

  adicionar(
    /\bebo\s+exu\s+7\b/,
    "Ebó Exu 7  Dênde, mel, aguá, cachaça, açucar, sal, e azeite doce."
  );

  adicionar(
    /\bebo(?:\s+exu)?\s+9\b/,
    "Ebó Exu 9  Dênde, mel, aguá, cachaça, açucar, sal, azeite doce, waji, e vinho ."
  );

  adicionar(
    /\bebo\s+iku\b/,
    "Ebó Ikú   Dênde, mel, aguá, cachaça, açucar, sal, e azeite doce."
  );

  adicionar(
    /(?:\bebo\s*)?(?:pelos?\s+)?caminhos?\s+de\s+os{1,2}a\b/,
    "Ebó pelos caminhos de Ossá (dendê, mel e água)."
  );

  return encontrados
    .sort((a, b) => a.indice - b.indice)
    .map((item) => item.texto)
    .join("\n");
}

function obterObservacaoAutomaticaLinha(ingrediente, ebos) {
  const ingredienteNormalizado = normalizarIngredienteParaObs(ingrediente);
  const ehLinhaPadezinhos = /\bpadezinhos?\b/.test(ingredienteNormalizado);

  const valores = [
    // As observações próprias do ingrediente continuam na linha correspondente.
    obterObservacaoAutomaticaIngrediente(ingrediente),

    // As observações automáticas dos ebós aparecem somente na linha "Padezinhos".
    ehLinhaPadezinhos ? obterObservacoesAutomaticasEbos(ebos) : "",
  ]
    .flatMap((valor) => String(valor || "").split(/\n+/))
    .map((valor) => valor.trim())
    .filter(Boolean);

  return [...new Set(valores)].join("\n");
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


function formatarObsComEbosNegrito(texto) {
  return escaparHTML(texto || "—")
    .replace(
      /(Ebó Exu 11|Ebó pelos caminhos de Ossá|Ebó de 7 completo)/gi,
      "<strong>$1</strong>"
    )
    .replace(/\n/g, "<br>");
}

function montarLinhaEditavelListaGerada(item = {}, manual = false) {
  const total = item?.totalTxt ?? item?.quantidade ?? "";
  const ingrediente = item?.ingrediente ?? "";
  const origens = item?.pratosTxt ?? item?.pratos ?? item?.origensTxt ?? item?.origens ?? "";
  const ebos = item?.ebosTxt ?? item?.ebos ?? item?.observacoesTxt ?? item?.observacoes ?? "";
  const obsInformada = item?.obsTxt ?? item?.obs ?? "";
  const observacoes = String(obsInformada ?? "").trim() || obterObservacaoAutomaticaLinha(ingrediente, ebos);

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

      <!-- Coluna Ebós -->
      <td class="print-ebos" data-label="Ebós">
        <textarea class="editEbos" placeholder="Ebós">${escaparHTML(ebos)}</textarea>
      </td>

      <!-- Nova coluna de observações livres -->
      <td class="print-observacoes" data-label="OBS">
       <textarea class="editObservacoes" placeholder="OBS">${escaparHTML(observacoes)}</textarea>
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

      const ebos = (
        tr.querySelector(".editEbos")?.value ||
        lerTextoTabelaSemBotoes(tr.querySelector(".print-ebos"))
      ).trim();

      const observacoes = (
        tr.querySelector(".editObservacoes")?.value ||
        lerTextoTabelaSemBotoes(tr.querySelector(".print-observacoes"))
      ).trim();

      return { quantidade, ingrediente, pratos: origens, origens, ebos, observacoes };
    })
    .filter((item) => item.quantidade || item.ingrediente || item.origens || item.ebos || item.observacoes);
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

function modalCriarLinha(listId = "old", ingrediente = "", quantidade = "", obs = "") {
  const tbody = listId === "old" ? $("modalBodyLinhas") : document.getElementById(`modalBodyLinhas_${listId}`);
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="modalIng" type="text" placeholder="Ex: Pipoca" value="${String(ingrediente).replace(/"/g, "&quot;")}" /></td>
    <td><input class="modalQtd" type="text" placeholder="Ex: 7" value="${String(quantidade).replace(/"/g, "&quot;")}" /></td>
    <td><input class="modalObs" type="text" placeholder="Observação opcional" value="${escaparValorInput(obs)}" /></td>
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
    const obs = (tr.querySelector(".modalObs")?.value || "").trim();

    // Salva a linha se houver QUALQUER conteúdo.
    // (Antes só salvava quando ingrediente E quantidade estavam preenchidos,
    // o que fazia algumas linhas "sumirem" do banco.)
    if (ing || qtd || obs) linhas.push({ ingrediente: ing, quantidade: qtd, obs });
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
      if (itens1.length) itens1.forEach((it) => modalCriarLinha("1", it.ingrediente || "", it.quantidade || "", it.obs || ""));
      else modalCriarLinha("1", "", "");

      // Lista 2
      
      if ($("modalModoFazer_2")) $("modalModoFazer_2").value = data.modo2 || "";
      if ($("modalSubtitulo_2")) $("modalSubtitulo_2").value = data.subtitulo2 || "";

      modalLimparLinhas("2");
      const itens2 = Array.isArray(data.itens2) ? data.itens2 : [];
      if (itens2.length) itens2.forEach((it) => modalCriarLinha("2", it.ingrediente || "", it.quantidade || "", it.obs || ""));
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
      if (itens.length) itens.forEach((it) => modalCriarLinha("old", it.ingrediente || "", it.quantidade || "", it.obs || ""));
      else modalCriarLinha("old", "", "");
    }

    abrirModal();
  } catch (e) {
    console.error(e);
    alert("Erro ao editar. Veja o console (F12).");
  }
};

window.excluirLista = async function excluirLista(docId) {

  const ok = confirmarExclusaoDupla("esta lista de Ebó");

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

  const campoData = document.getElementById("dataFuncao");

if (campoData) {

  const hoje = new Date();

  const anoAtual = hoje.getFullYear();

  // Data mínima = hoje
  const minimo = new Date(anoAtual, hoje.getMonth(), hoje.getDate());

  // Data máxima = último dia do ano atual
  const maximo = new Date(anoAtual, 11, 31);

  campoData.min = minimo.toISOString().split("T")[0];
  campoData.max = maximo.toISOString().split("T")[0];
}

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
      ebos: tr.querySelector(".print-ebos")?.textContent?.trim() || "",
      observacoes: tr.querySelector(".print-observacoes")?.textContent?.trim() || "",
    }));
  }

  return linhas.filter((item) => item.quantidade || item.ingrediente || item.origens || item.ebos || item.observacoes);
}

function pdfMontarPaginasListaGerada(opcoes = {}) {
  const logo = opcoes?.logo || null;
  // PDF da lista gerada em A4 horizontal.
  // O formato paisagem dá espaço real para as cinco colunas e evita texto espremido.
  const pagina = { w: 841.89, h: 595.28, margemTopo: 12, margemBaixo: 32 };

  // Larguras ajustadas para ficar parecido com a lista impressa:
  // tabela larga, títulos grandes e todos dentro do gradeado.
  const colunas = [
    { key: "quantidade", titulo: "QUANTIDADES", w: 105, align: "center", bold: true },
    { key: "ingrediente", titulo: "INGREDIENTES", w: 210, align: "left", bold: true },
    { key: "origens", titulo: "ORIGENS", w: 130, align: "left", bold: false },
    { key: "ebos", titulo: "EBÓS", w: 180, align: "left", bold: false },
    { key: "observacoes", titulo: "OBS", w: 150, align: "left", bold: false },
  ];

  const larguraTabela = colunas.reduce((acc, col) => acc + col.w, 0);
  const x0 = (pagina.w - larguraTabela) / 2;
  const fontLinha = 9.6;
  const fontLinhaDestaque = 9.8;
  const fontCab = 10.5;
  const linhaAltura = 11.2;
  const paddingX = 6;
  const paddingY = 5.8;
  const headerTabelaH = 24;
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

  // Mantém no PDF o mesmo destaque usado na impressão das observações dos Padezinhos.
  // A linha que contém o título do Ebó é desenhada em negrito; o restante permanece normal.
  function pdfLinhaObsEmNegrito(texto) {
    return /(?:Ebó Exu 11|Ebó Exu 7|Ebó Exu 9|Ebó de 7 completo|Ebó pelos caminhos de Ossá|Ebó Ikú)/i
      .test(String(texto || ""));
  }

  novaPagina(true);

  if (!linhas.length) {
    linhas.push({ quantidade: "—", ingrediente: "Nenhum item gerado.", origens: "—", ebos: "—", observacoes: "—" });
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

      if (col.key === "origens" || col.key === "ebos" || col.key === "observacoes") {
        setCorTexto(0.26, 0.30, 0.35);
      } else {
        setCorTexto(0.06, 0.10, 0.16);
      }

      linhasCelula.forEach((linha, linhaIdx) => {
        const negritoDaLinha = negrito || (
          col.key === "observacoes" && pdfLinhaObsEmNegrito(linha)
        );

        pdfAdicionarTextoAlinhado(
          linha,
          x + paddingX,
          textoYInicial - linhaIdx * linhaAltura,
          col.w - paddingX * 2,
          fonte,
          negritoDaLinha,
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
  width: 1920,
  height: 1920,
  base64: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/2wBDAQICAgICAgUDAwUKBwYHCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgr/wAARCAeAB4ADASIAAhEBAxEB/8QAHgAAAQMFAQEAAAAAAAAAAAAAAAECAwQFBgcICQr/xABMEAABAwIFAwIEBgAEAwcBAw0BAAIDBBEFBxIhMQZBUQgTIjJCYRRScYGRoRUjYpIkscEJFjNDcoKi8BcYJTRT0eE1Y5PxGURzNib/xAAcAQABBQEBAQAAAAAAAAAAAAAAAQIDBAUGBwj/xAAwEQACAgICAwADAAMAAgICAQUAAQIDBBEFIQYSMRMiQRQyUUJhFSMHFjNxJDRSgf/aAAwDAQACEQMRAD8A9/EIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCAGv5/ZNTy0HkI0N8IAYhP0N8I0N8IAaASbBOaLCyA0DgJUCbQIQhAnsgQhCA9kRoT9DfCNDfCBwxCfob4Rob4QAxCfob4Rob4QAxCfob4Rob4QA1vI/VPSaWjslQAx/wAxSKSw8IsPATfUCNCksPARYeAk9QI09nH7pHNN9gnWA4CVLQjTBCEJw31YIQhAqWgTZOycggHkIHEaE57QBsE1AApFGpEACEIQRv6CEIQC+go1Io0EgrPmCemM+YJ6AGydk0GxunloPKAwBLvoi1tiqNSKNISJaBCeGtI4Rob4QKMQn6G+EaG+EAMQn6G+EaG+EAMQn6G+EaG+EAMQn6G+EaG+EAMQn6G+EaG+EAMQn6G+EaG+EAMQn6G+EaG+EAMQn6G+EaG+EAMQn6G+EaG+EAMQnOYb/CEoYLbhADW8j9U9JpaOyVAAhCEACEIuByUDWm2CEXHlCbL6KloEIQmighCEqTAEIQngCY/5inpj/mKAHM4/dKkZx+6VAAhCEACEIQAIQhAAhCEARoQgAk2CABOj7oawW+IJwAHAQAIQhAEaE8samHY2QLvoE6Pump0fdAg5CEIAE0sJN05CAEaLCyVCEACHcH9EI5QBGpEmhvhKgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEI3oAQhCTaAEIQl3sAQhCABCQuDeUw7m6AJEKMbG6frHgoAVCTWPBRrHgoAVCTWPBQHAmwQAqEIQAIQhAAhCEDW3sEIQgT9gQhIXgGyTaDTFQk1jwUax4KUNMVCTWPBSax4QGmBfY2sj3PsgsJN0aD5Cj2x4e59ke59kaD5CNB8hLtgHufZHufZGg+QjQfIRtgHufZHufZGg+QjQfIRtgAfc2snJoYQbpyE+wGl5BsjWfAQWEm6NB8hPANZ8BGs+AjQfIRoPkIAPc+yNZ8BHtnyj2z3KADWfARrPgJpFjZCTaAe1xdylTGuDeUvuDuEbTEb0OQk1t8oL2pQTB/H7pic5wIsE1A7TBSKNO9z7IDTHITdY8JdY8FA3SFQk1jwUax4KNDf6Ko0/WPBTEa2P1sVnzBPUac1wAsUC6Y5CTWPBRrHgo0Rr6Ko0/WPBTEa2P+kjeB+iE1rr2Fk5Aj3sEIQgb+wIQhAfsCEISbQv7COdpSax4RoceSjQfITXLQ4NZ7BGsdwkIINikTFPTAd7n2R7n2SaCe4S6D5Cd7bAVp1C9kqaPgFil1jwU9fBr3sVCTWPBRrHgpRP2FSONhdGseCkc8EWQG2DXX5KA86t+E1CdpDdyJLjyhRp+seCmi7bFQhCB+0I5xbwmlxIsU8kDkpNbfKA2hreR+qemmRoNro1jwjWxGxyEmseCjWPBSaQJvYqEmseCk9wdglHDkJvufZHufZAumGs+Amk3N0IRoTQ9nH7pUjOP3SoAEIQgNoEIQgTaBCEIFBCCbC6QPBNkAGgeSgMAN0qEACEJHO07WQMbFQm+59kB/kIE9hyQsBN0qEDkxNA8lIbM47pyY5wcdkDl2L7h7BAeSbJqAbG6BWmSITfcHcJyBAQhCBGwQhBNhdA3bBCRrtW1kax4KBYvYqEmseCjWPBQOFQk1jwUB4JsgBUIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABHCEO4P6JsgE1t8o1t8piUC5smivpj7i17pNbfKCLMsmJU9DW9Elx5CFGpG8D9E8E9iPBPATOFImO5P6oF/o0vANijW3ymu5P6pEjeh3qiRKGk7gJBuLpzXWsLJEwa0Jod4StBabuTkj+P3Thoa2+Ua2+UxCAH62+Ua2+UxCd6jfYfqae6NY8FR73sEqaPS32P1tRrb5TEJrbQvqh+tvlNJubpE0vINk0X1Qpc0Hco1NHdMd8SE5MX16H6wTZKBvsowbG6ex1ze3CV/BNIlQgG4uml5Bsov/IalscgkDkpof5CH2IuCnL6GtC62+Uam+UxCd6oQcZWN5KQTxngqlqiWnY7JkDyZBumvpjvVFeXAtuEo43TY92WSuNgmR/2GvoA8E2QXAGyhLy0ndAlv3CnIvcmJA5Rrba90zVfvwkc3V3TvUPccZN7g7JpqWjkpjxp79lTzPDTyE19IX3KozMduCgyNtsd1RCUg7OClY7ULkqFyE93omJJPKkBHYqHWU+Pc3+yWMmLv2ZJpKCCE5pu0JJOyen2PSQwvaDYlKCDuFGRd105rx8v/VOHrehxIHJTfdZ5TZzYX+yg937hAreiqDgeClUMEhPKmStaGCBwPBQ57W8lNfeIXUD5NZKctaGv6VTTr3ag7cptO6zeETONrhN3oetil7RyUNcHcFUc0zt1LSvNikHP4VFx5Qo9yeE4SaRYhKmyLW5DuEy58lBladgkuPITktEyXQ8Ssab3SicHghUk3zE3TGSlrtz3RpDnWvpcQ9pRrHgqnjedNwVKRcWSaRG46He40eUe8w91SyylgO6ZFMXO5SNaD1K7W3yjU217qNhuE2R5bcKGT0L6kvus8pC8je6p9bvKewl4DSonJCuGiTVq3QkaNItdKmJ7G67He41oFyk9+L8yp53uJ5UD3Fp5U0Q9SuMjX/KUKnon3JBKqFMvgaELwDYpDKwd0kg5/RRJQ9ScODuClULHlp5T/cP2SpbD1Q+9kX7pus+Ahr7neyVpJB6ocNzZKWkJAbG4T2m43TRjjoR97JpcALEpzztZRv5/ZOXwhk9Ce79wm++L21KJ5I2BUbnkG11G32V5XNFR7hLtV9rqQSsO4KpGu1J7Of2Sp7JKrHIqgQeCl0m17KOL/opvo/ZKWY/RiQOBNgg73H2Q1uk3ugkSFQhCVPQ4EIQlkNkPZx+6VMDiBYJWuJNimjH0hyEXA5KQvAO26Brew1t8o1t8piECEgIO4QkZ8qVA9fBH/KU1vI/VOf8AKU1vI/VAo9BIHKE15N7IGyF1t8pryCdikTdZ8IGP4OJA3KTW3yml5IskS7Gr6TiRpF7oDgTYFRs4/dKDY3SDyRRkEHcdlIDcJr+f2QSRGoQhBIBNkrHG3xHskQgY3skBB3CEjPlCHOLeEEb+gXgJHPBFk07m6bqdqtfuga3ocCRwhCErexYAhCEhILod4QGuB4Tmu1G1kqABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQdxZCOEyQDCCOUM+YIebnYoZ8wTExWPUac8kGwKanDX8BSN4H6KNOa8jYp6Y1PQ5RvIa7dPLgOVHJuLlKSJbYw7m6EITZDxzOf2ThsbqMEjhPDxbcpoEmseCh4+FMBB4KUuJ2JTo/Bj6YiEIUsfgyQIQhKNBCcwAjcJqa2x6nroEIOyFE/o9SQJjmncp2tvlLs4KIPYjQn6Wjskcy3CkiP30NSg2N0l+yCbcqX/AMQ2tDhJYWt/aNY8JvZCg/8AIZ7Id7g7BOUdv/q6c025P9qZaD2THIdwf0Q0tLrXTnMbYpXrYm0mUFXyoqQku3PdVFVFc7KOmjDXC47pkti+yKyL5E+TYfsiJrdPCVwDhsol0xsv2RA8/CmA73twpXsuf1SNj3vZTeyK/o9ACTyLKQbCyQsbZKXMA3O6cmO9SOXa+yoaom9x5VbLI08HsqaSL3O3CjnL/g1w7KeF9yL91VRA2Bso4qfSdx+qqGR2GwVaTD06Ec6xCma8Bgv4UDwb3SSTgNI1Ja5exJCLTJzVAbXQKgO5VA6X4j8X9KSncSeVOTJaKs7kpoadd7d0+MA8+E7S3mydH4OGTguFgqYwuJuq2w8I9n7p6ZHJlPDG6wCqIzpG6XS1rbA7ppcG8p31ETemNq3gs2Co9DiqxtpTpJSSU3NgjpCp7Io5A0WKJJA8WCSRugpgcDwVFJliCGSC9wFNRNIG6GRtfyntb7ZsFHtISRPYeFDUPDQdk73LD5lT1biQd+6dF7GL6QSVRa4i/wDSVlXfclUk4cX3N0MuAp18LECrfUar7qMF7nXF+fKSFuogFVkNO0jb/mlH7SHUxs2xVQ5wDNSgI9vuk98O+G6XXRBKSGVDS/hRUsbhJwqxsQeLlOZThh1WTJvoYpbAMcGjbsopngD9lVOA0Xt2VBVai4i6qzY+MhBOXbFTwXJBKpoo+5KqoOwVVyfsSOSaJkIQpoRIvZEErDuVTysJ4Cr/AG9W9uUn4ZpNyN1ZgtCeyKSla6MkuU7ZBqGybOz2jYbIh33KnS/UPZEpBfumSRkWsAntcALEp7Wh3KbIPYp9DvCc0EDdSujAdcDZIWApF9HKSGJHHSL2SuBb2TDfkhPHeyHCTz54TjPbhU8jiLgHso9bvKbIa9Mrvca74gmSuuLhRxlzm3B7J9rizkx/CtYuuiF/zKKUEnZSvaQf/wBKaWg8hMKE4sjY0gFTR34PhIGbWA2KkDR2CRvQ+mOiVpsVMz5VApmOFrX7oTTLtexXNub3TDsbKQkDkpkhAFxZKvpMmxEJus+AjWfAT/ZDhyEISeyEl8BCc1oI3CQgjkJxE3/BEIQgjkMII5Cc03aEpAPIQBbhA0dH3Slwbykj7ok7IJYsadzdA3NkI4QPFLS3lIn3a5I5u2wQI1sif8xTJOymLfITDGXchAxr+EbPmCelEVjcWRocgb6iKRvA/RNa23ITjzsgelsBsbpXODuEiVun6kDviEQnf5aP8tAnshqE7/LR/loD2Qrd2WTS0t5Txa2yCAeQgayJwuLJPb+6fpd4QGm9iEANY0gpU8NATECxWgQhCB4JW8j9UiVvI/VAD0IQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABI75SlQ7g/omSBfSFjiTYp7fmSWA4CTWFF2LJoe+2xCj9weE4EEXSCK5NlIk9EUm38E1m/CcDcXTQyx3Tk5LsRJgSTykf8qVNL7i1k4sRXQ1CEJjYoIQhN2gFDi3hK1xJsU1OZz+yfFrQ1p7HIQhPi0MaBCEJ20N0w1EC10XHlI5pJuE0gtNgUaIpyaYpeb7I1nwFG9wIITVFOLGqwkT2fKFAnsfYaQonFoep6JUfukbewuns4snRT2Spv6M0N8ILB2T3O5bZN7XU38DbSGlhA2TeErn3Ngk3TVD+kXv2Nc+xQZDwNkrmajym6D9lIkhVJskjdvdSF5KhjaQ65UqVpbD2aRFO3dMjYLqZ57WTRtwmtDfydkrHaRwgO08pjXHuUyd5buFFKLRLXL3+Eux4KWwIvdU7JiTYhO9229ykin/Sb0aHySiMbq31Nfpde/J4U9RLqYbEq11Ub3OO/fyn7QrhpbKqOs9w2B5VXT/He6tdJTvuDdXWjeGjSVDNjdRRO2NtrkbpkrhHwpb7XUFRaxKqWPYqhshfJYC5UL36nWRK7ewP6JGQOduD3T8dPY/012KITJuFUQU+ncp1MwNAB/wCSlcQ0XJVv4DS+IdGCDuOyUuAHKhkq2WACVkutth3Sxa+EM5pdMk1nwFJ7h8KnddovqKb+KA248qRLZH7KRUEglNkAI5ULZi91wU50hJ2T9EM5+rHs0sNwpmnULqnb/mbDspRII2gFMkSVbkiOqg1bt8Kl0Frh/wDoVVJVsI0mygc9r+FBOSRcgmkK17Y26iUGoa87dkjqd0jdIKaKNzDb/ooXPRHJj/dH2/lMfpk2unikeexTmUhHKdGQiWykdTF+4H8pPwZ/+irkKZrW7j+00xtBViDbH/ljFaKeGjtyp2gRhL7rALBRyPvvdSpobJvXsErtW6haCXGyc5jn8JW2YbONtk73iitKxsqIiLcqQu2sVBGQRcHunatW11FKUWhqk0PLgbhRPi1m5KkDO5SuLW8hVbP2Jo+z+kQgLeL/AMKRjbC57JHTNHCR0lhqKhjW3IdKSSFc8gndHuX4smhwkCYHhh3V2FTIXPoqQ/4dke4RyoDUtYOUx9WHmzVOodDfzLZO9ok3umCPR2SxEt3cnkB7dwl+dDlPaGKRsng2ULwWOukbNc2smSF9mVDnjTumayTYBRvJLb2/tDCALFJHth+QlLQ7lIY2uFiEjXaeyc14J2TmxVYRvp9yQFG+nN727Kr9xvBSO0ngJjl/0mjLZDDGQA1Se2f/ANKGyNabgJffb+VMk1sVxbI5Ix2Kb7f3Ur5Q76Uz9k3aIpU7Q3QL21fsla3T3Tg0kX7I28n+E1vZE69CKRosb/dI1unulSEkFoUuLuU1/H7pUjgSLBLtk6+DEJ2g+QjQfIS+y0KOQhBNhdHstjZChxAsEOdq7JrTqF7IcCRYKSMtkT+iOeQbI1nwE07GyBvsj2WhrTY73PsnDcXUej/T/SkGwS7Qigx0fdEnZDBtdOSkiWiNCcWEm6QsIF0DhY+6coze+yN/A/lLpi6Y5/ZJY+CkBINyE73PsjTGuLG2PhCVztQtZK1wAsk0xHFiWPgoaLmyc12rayVAqWhNA8lI5oAuEpeAbJkp1DZASa0CFHv4/tG/gfygi90SIUbQXbJ2l/5v7QKmmSs+UJSQOSmx8WKPbPcoFAv34Tgbi6jQNjdAumSKNOMg7BNRrY5JghCECitAJsU4MAN0BwJsEqABCEIAEIQk2gBCEJd7AEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABNe4g2v2TjsLqN3xJkvoj+Bse/8AajOxKUOIFgkO5umr4M3tD2fKE9hAvcqJrjsE9PT2ApNzykQhOHJgk0t8JUJH8JExpadXGyXQ3wlQopA5aE0N8I0N8Jbg8FCaJ7CaG+EBoHAS3B4KE6PwX2YIQhSREb2CEIThATX8pyQgHlPXwrTW+iFzTcmyRSPF9gLJvt/dI2R+iQ2xPASt2dunBobwgtBN1E3sclskabtT2d0xnCez5f3QvpZj8FeBYmyQAFhQ8i1gUmrS07J45rojcAXbBAaeUB1nXTwbi6k+FVR3IYGu8I0OT0jnWCTZZjDQjWkFOTfc+yUOBG5CUZOAj+U1SWJ4CY7Yn9UjeiL8Yg2SPLXgDlI5xaf2THEgiyjlLolqXo9kcvwj9FCag3I3Us7XuadlRSj29z5UPsy/GSZPrLtt1G+Bzxe26ZHVx9yp2VUQsbj+UezY6VcpIbHBK1uwSl80Zvc/sqmKoic24cP5UU8sbh8JHCY9shVLbGDEZG7FyDW6xuVSVTgATcfyqZtVZ9iVBJP4Wq6H9Lo0h5/dVVPG7TayoKOZrlcIZmsF7qehaGXRa6HtjLTuFDWz+2079lK6pYRe/wCioa2T3TYJ82n8K7lpFIamQy7OVfQyudsTuqCOneZOOVcKOnIcCkhvaM61yc+ieTUW8lU8lhwe6q5RpbYhUkw3JVpD6od9joHEHlVAYXbhUkbrGyrIJmjlNlPRNPHUwOqIavKgqKnYm6lxGYNiu0BWmSoLrhRSuJsev0eh76re5ckbXgHkKhq59ANyrLivUTKJpLngfuqVtqRt1Yjt6SMxixeGP5pQP3UrMbpHHeYfytNY3m3T0BLTUNFvJWN1fqIoqR+l1Yz/AHKl+dbLUfH7LX0dFSY1SMbcSD+VT/8AeOn1WMw5XOdR6mKAM/8Ay1v+5UsPqTpJpbNrGbn8ymryI/wsR8ZtS/Y6Yk6jgLdpQomY2yQ7SLReD5zxYkQG1DTf/Us06b6qNdazxv8AdW4ZCMjM4iVT+GwWVvuP2cqjWbcq04XJ7jGvJ3VyL7DjhPdpSuqUYepUQNe4k2JTKmOS+wTqSrjGxKKqtjCa7l/CnHG2xkbpWstdRGeVjr3TXYjHuNQUEuIRcgjnymOzZZWH7PtFUcQkaOVBNixAu5yt9TisbQfjCseMdSR04Pxjnyj8pfo4/wBv4ZTFjDC+znqqOICRgs/YrW0XWbHS290bHyr5hfUjZwGh9/3UtVi2VcnjnF7Mxp5iRsUTuIF+6o8JqxKwXKri0PAuFpRmtbMyyhpaKWaWTT/+pQxSvbLc+VXOpQ8WCjNGGHcJ6kkVHU0yoppS8C57KrAA2Co4YizlVLZDbjsopNfSeEdISVoN7hRsY0G5KkcSblRqGU0Pl82OeQRYFN4TdZSGWxtsmxktkBIXu7lKJAB8RUEj3bJGuJO5T2wS7KkOaRe6UyE8HsomXspGttuVGWa0xjnW5umGTft+6dKN9uyj9ok3/wCiao7LkUtDxIDz/Sc0i4KY2IgbBSNaDt9keqEk0hwk7XKUEHhN9v7/ANJQ0t5R6orvTHtcSdyn6XHsmtaBupGEkJvYiWhuh3hGlw7JXP0m2yT3R3sgf2Fj4KSxHISiXfshx1G9k31FWxEbHYhCEeojfQAAcIJA5KRziDYJilS6IZPsDuSlAJ3CGi5snAACwTWtDo/BUoab7jZIpG8D9ER+j9sAAOEIQpl8EBB43Qgi4slD+kaE/QPJTE5McmIXAclMJJO5T3N1G90y+9k4evoXIIsntcLWJ3TEDY3QEktklyOCl1O8pms+AnJskMkBJJuU157Jya9IRWf6kepxNmpRrvukYCDuE5IVFtgCRwpOVGpG8D9EEqY5hAvcoc/8pTUIJYghCEEi+hayEISp6HN6DlLod4SDY3T2kkXKQaI1pB3CchCABCEIAEIQowBCEJ0fgAhCE4AQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCAB3B/RRqR3B/RRpjEfwjQhCiX0gX0VvI/VPTG8j9U9Sx+kgITdZDrFLraTynjktCoQhMf0cB2TC4n7J7uD+ijTGtkVj0IXaUB4JsmOcbfEUmsdinEfu/pO1wAsU5hD3WCiYSb3KfHs7bwnKLHqRJ7f3RoPkJA4junp2tD4yWhug+Qj2/unJuoh1r90DxQ2wsUy1ipLg8FIWg8prloRpMjc0k3BSaD5CkLABsElj4KY5DfRMj9s/ZOaLCyVLdumwG6T2FUUhLb3SucDwkuByUJyY5dCP+UqMvsbWUjuFE8C91Lroc3tCB1jdSRG5v9lGGk8BSRgg2S+w2KWxXSBpsVE545BITpgdXCgmdbYFI3/SeK2SNeNV7pxf4CpWzWcBdSteTuTsmeyFlFbKiMk890OadyiItLdkOcbkX2THMhUeyOb/omwAF1inSG9/0UbXFpuE1y2Ode0TTtYB/+pWPGJgy+kq41NQQy91YMYqSQ4ud2UEpaLeLjOcuykfiBabl1v3UU/UUUQsZFj2P4+2gjc50lrDytV9ZZxR4a+Qfi7WJ7qN3JdHXYfDu1G9I+sqSNpDpht/qTHdc0DfmqB/K466t9VsWGTuiGJgW/wBSxKo9Y5M1v8VFr/mSfmZovxyKW9Hd7+tKGYWbOD+6WDHoZnXZJ/a456I9TxxeZjDiGq/+pbq6BzF/xhsbhPe9u6cpJszsjjPwro3rhlbrAN1d4pHPbt4WHdM1xnjabrL6NwdGL8qZPSOezK/QSR8g3JToIXSbH/mpTG3a6Gysj3TfdNmPKD2VENAxoufCmZGxm22yp3YjHo2PbyqebFWgbFTVroWGPKX8K6ZwcLKlljJOypm4xGbkn+1LBXMe65IVl6SCyp1j2QuJ3UntObuClFQzTqB7KJ9Y0HnZVLHr4LW3ISvcXM0hUJiABupKysbpuH23VFPWiNhcXrNtu0y3VRJ2bKLGJBFGXE8BajzW60ZhVJI/3bWB7rP+r8fZDA60gGxXKvqTzBfR0U5E5Fr23Wbk5SR3nA4ErHuSNdZveoMYVUTD8YRpJ+paC6x9WT4qwtZiDv8AetR+prOuooquoArCNz9S5a6kzurKytcW1zjv5WXPNSZ6lx3Bxml0du1nq6maz/8AaDvHzqTAPVu6WraHYi7c/nXAdZm7XOb/APljv5TcHzkrYKph/Gu58p1eb2bN3j6/E3o9ccnvUhFickTXVxNyPqXW+UGZFNiUUTvfvcDuvFPIHPmq/HQxmvPzDuvQn035wz1MMF6o7gd1fryzzvm+F9E+j0c6VxWOqhY5r73CyEygxrTWVHWf4zD4Xvm5aFsqnx2N9PcyhXFkbXZ5nl4U42a0V01b7B+ZUVdjjI2EmT+1YOoOqoqUOd74Fvutadb5wU+FRvvWAW+6hllqPZo4HCWX60jaNT1VAx9nS/2rfX9d0VKy76gf7lzN1Z6loKBr3jEQLD8y1B11614qQva3FgLE/Uov81NnSR8bcEm0dp4vm5hcTXAVY/3LDOo84KKQuEdVf/3LgXHvXQXVbohjHf8AOlwL1Xux6YD/ABO9z+ZTQyP/AGT/APw/ovh3PgmYLa2ouye9z5Wx+i8ckqpGfEd/uuPsoMxn429jhUE3t3XUuUVSKt0Wo3uAr1N22YXI4Pon0bv6cle+NpP8LIWtJaCFZOnoo2QM+wV3kqBENitaE+kcTfD9/UrIANG4SStANwqWDEmg7uCJsRF7g7KT3KU62n2TvexgtdMEzb7K31OJDb/9KjbiO/H9prn0M9Wi9RnWNkSsI79lSUFaHNF3KpfM1ygnPfZFIiIsbJjibkXTy8E3umOPxFRqeipJtCIjuDYpdynaQOynU/8AokZdksJtYnsqgEHgqma5oFrp7JrbXUsWmXam2PfHte6jIs7TdK6YeU33Re9/6UnqWkmPaNItdPjZy6yhE1zubJ7ZriwKPUisekSoUfud9ScyQHkprj/0jhuRMmP2JKS5HBQ7g/omerJEtEUj7XdZNbNc2slk5soS7Qj1ZKl0Te59kuseCoNRO906Puj1Y2X0mRc2tdNZqvvdODSdwE1ohbEc4BAcCbBNfylZz+yF8IJPskZz+ycowSDcJ7TcXQ02Oi0ODCRdIRY2S6nDujS472TY/SYRCCCOUKRfQ+j2uGwSqMbG4S63eU8GtD0haCjW3ygvFtigBpFjZNc3V3Skkm5Qnr4PXwaWWF7pqe4EiwTCCOUooIufKE5h3QI3ocOAmuaXFOQm/dkM/hGBYWQlaLmydoCaQa7GhpdwnjYWQABwE5rLi5QPS2IGl3CXQfISgAcJUEkfowtIFykUhAPKTQ3wgeMRcjgpzmflCagZJgi5HBQhA32Q5hJO5TkxnzJ6BUwQhCB6ewQhCBQQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAPBUakTZOya0I3/CE7GyEoaXG4StYQbkpkYkKT2LGwOIJQ52k2sl4N02QW3UqRMohp1fFdAa0HndNEobsjVqN0umPcSRK0AmxTC8dgnxm5v5TWhumD2gCwPKhLgOVO8bXVO/m6RIr3PQxw1d0nt/dOQnaINsUEjhOiedVimgE8BSM2IS6Y+Mh6kUYFzZSO4P6IZPEa59tuEwyXdwkedrJo2TkkWIxRKHho3R7l9h/zUV97JCQBcqGaD1RN7ttjb+Uvuj7fyoQbi6FFphpDvc+ydfa/2UaeN2/sjTDSI5Hku2T43EgA+Ejm6ShhAO6kiNfTJfbDhymSwtAuj3AOLpr3lwsCpU2MclojY4B2nyqkNBZfuqdrCHalM25Fgmt6GQk/YbJZU0rBqtdVUkbj/ChfEXG4KY2W4MpxC0G6kjYDsSiSEhtykjY637qJyHtoqYWgDbwkLmh2/lIwEcpsoNiQo3NkQSlp4PP3UEkgZwkkcQeeypaiR1jzsPKjcyeuO32MrqgFhssX6ir/AG2ON+yvFbUHSQSsQ6yrfbgfYn5SoLLP17Oh42hStSNa5qdZMoaWQmS1ge643z5zxGFST6asbE/Ut0+pDrOTDKGYh9tj3Xmj6qM46mmqaofiHfMe6zLMrTPW+HwIuK6Ezg9T1TBiMgjr+P8AWteUfqaxSvr2xNqybns5c1Zh5oV2J4u8CVxBd5V1yskrcWxOJ2lxuQmRytM6a3jIqrej0W9OGYmJY3NA505N7d13pkFPUVVPA57ib2Xn96P+k6mX8NqjPA7L0j9P/SkkNBTucy1gOVaryF/08+5rH/G2b86MiDadpcd1mVHIGtH6LEsFp3UtON+FcxjLYLNc7srX5+jzzKqlbPoyVjw8XBUU0QP1BWen6hgtvJ2T5eoKYn/xP7SK6K/pnf4dql8K6VpDeVb6x7g2yR+OUzmEa1QVeM0tz8f9qzC+P/S1TjWb1ongMj37nYqvic5jb3WOu6kpIXWDv7Tx1fSlukPVj88dfR9vHWWP4ZCyvfr0k7fqirro423Lh/Kxl/VVKCTrH8qxdSdeU0LD/nf2oZzWibF4a2c0kjJMX6pgpgR7g2+6x6u6+aQ5jZB/K1P17m5TULnf8X/8lhsOctNUPI/E337uXP5dupHW4fj0m0mjbvVnUxqIHWePl8rkj1UYpOcPqNLjvey3U3rWPFIPhlvt5WmvUHhrcVwuawvcFYOVc0j0Tg+FUZqLR5feqGtqp66pBf8AUeFzLWirGIFuom5XY3qW6Akkrah7WcuJ2C5xxDoc09cXPj7rFtyXs9c4jh2klowyqophSmQ+FZGy1cdY1rSeVseu6ccKYtDNrKyQdJaq5pczkp1WS9b2dPbwe6vhmuR0+IMr4ntJ+cL0Q9LOKYg6KnDieAuLsgegRPWwkw3+Idl6C+nToVtDRwyGK1mjstKnJb0ebc9wKSfR1xlX1bNQ4dCHvtZo7rY8WaEFPRn3Kho27uWhocWZgeHA3tpatb5l+oM4DDJGKoiwPdX3laj9PLp+NqzJ00b8zKz2oqKJ4bVsFr/Uuac4fUSx7JQysHf6lzzm56tJi+Rgrncn6lz71z6lZsSfKz8Y43P5ln25rT+nf8F4h7xWom9syfUTUCKZjK7seHrmPNb1CYkyWQsrTyfqWOdQZmVOL6mtmcdQ8rWXWkdZiBc/4jdV4Zvf0667w9wh/qXGpz4xiqxHarO7vK3BkjmXilfVQmScm7h3XMuGdLVTq1sjo3croLITAXQzw62m4cFp42T7M5rN8c/HF9Hof6XupqiZ0Ac872XoBkRpmpYZSRfQF50emmNlKYXOda1l3zkR1HBBSwMdL9I7rcxrm5o815/iXXVJpHS2CS6IGqprp3FtwsawPHoZoWaZP7V5dXxzN+bZbsbV6nkF+PKNrbQ+KZ7nC5VWxokYLnt5VC2VmoKWKcE2PnynqwqTo29sdU0jju033TYaOQyC6q2SwsA1FTsmpDuLfsl99oqyqafwdRUmloueyqzE0CzXKjfWwx8PTBikQ5eP5UM5pEbxpTXwrRAL7EpHxWuSVDFicR+oJJK9r3bKB2pFaeHJ/wAJAN7XT7G11TipaE4VgG1gpa7dlf8AxJxZMbpmtxTDWt8Jgqmk7hXq3tE9dUl9Jtbk5puLqMuAAN+UsbtTtgrsVsta0iRBcW7hSRt1gApxh2vZD0VbVtkIlcTZSRuP8pr4rHYBOjjNrprSIoPXRM1xcUOcbkIZyQlcLtKTSJ4vZFJtv9lA3/NduppObqIbcIaRKOcwNGxRH3TSSeSpImEG5KZpoY/pLG0OG/hP0hosEN4H6If8v7I0Qv4RyMaTsmkaNwkebElDRr3ukaSRWkKHkneyeHnsUzQfKVoIFimCJtEjXak4OIFgVCXBvKe17S1HRNGexxJPKEA33CUNLuEq+kiYpaA26aNzZPIJbZN0lu57J4ovtjuUOYALpC8kbbJC8cFyXTDTBCTWL2CVO/g/+AkLQTcpeUuh3hG9BvQ3Q3wgNANwn6D5CNB8hN22MbGoQRp5Ql60Ry2xAwA3SoQmjNMEoeQLJEIHj2m4ulSM+UILg3lACoUac1wAsSgcmOUZ5KeSC02TCbEDygbJghCUAngJVoZpgz5gnprWkG5TkP6OXwEIQkHpAhCEDgQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgASPaTwlQhrYj+EenT2QnSdk1AkYhwmyEFuxSu+UqJ7rfD9lIkTRiRl/x8lPDttlEdjZPb8oTvUlaHsJN7lTR7EXULOSVK1+oprWyKSJH7tuFA6PfhSh1m6bJE1Iq2ogLSBcpFM9jdKjLLC4KVJFZrQMIF7lPbuRZRJ8ROqyURfSXhSO4P6KNSO4P6Jsi3D4QPJvZMLjqAupHje/lM0gm904tREc4hxsU0u8lK/5imuGoWukcUwf0UTACwSiUu3CjIsbJzPlCjcNMEtj2Ek7lSggN2PZRMO9kFx12BTPgg4kncpNTfKU7C6j3HJSr6RSaJEJjZBcC4T7jynkW9jyG2sUrXtabkphcXcqCWYjbZMbQsN7KiWdt9iojPGOT/SppJzyFC6RxUUmXYQTXZWPnBGxukEzbbqh91wKc15dbdQyeh7hpFcKgHhD5g4WVKwOJ2P9KRzbC91DKXY1R7ElcAVTThpaT9lNIeQqWpk0tsCmbZZqiWXF5dFyD3WDdc1jW0kpLvpKy/HqkNa4k91rHMfGYoKWW7gPhPdUcibSOy4XHc7InKnqorHPpJwH+V5feqyiqKqsqAwn5yvSz1E4rBWsmjDxvfuuEs9ek4MSqpXaAbuK57Iv0z3Lx/j/AGijh+TouorMWOuMm7/C6A9OuU4nq4XOp+45CShyxgOJa3Qj5vC6ByJ6RoMNlj1MG1lSWT39O5t4lun4dOelXoCnw5tMXQgWA7LuzKWOmo6CFgsLALkLJvFMNw6OENe0ENHddKZd9Y0/sxhko7d1oY+Tv6eT+UcXL1ekbzGIxMp7Bw4WMdS9Vsw9rpHTWA+6hgx/3aXU199vK1dnP1o/DcOleJLWBN7q1dleqPPuP4l23uLRescz3pcJlc11cG2+6sc3qkwyN2l+KN/3LijPr1E1GC1UzW1trX+pc79Resmvp6ktGJd/zqjLOa/p2OL4mrv/ABPVuT1W4TGzfFW/7lZ6/wBXeEMfpOLMt/6l5O1/rWxEQktxLt+dYhjXrZxj3TpxI8/nTq+Qe/povwz0/wDE9jIvVVg1Y/4cUYf/AHK5QeoTD5mamYg0/wDuXjl0Z6z8bnqWtkxE8/nW5+kfVdWVNM0vr9yPzLSrztorvxb8b7R6MYv6jKSljcf8RHH5lrHMH1Y09M1wbiY/3LjvqT1JVs0DgytPH5lp3MbPfHKkP9upd34KmeVtFmniaaHvR1VmX6tmVMpYzE7/APuVn6N9REmIVIaa8m5/MuEMUzO6ixOuLTM8jV5Ww8oepsZmrImyPfu4XCzcie+zVxser2R6S5b5kHEqRrjUXuPKXMrqGKbDJNUg+UrT+TGNVbaGIyOPAV4zS6sdT4XJ/mW28rnsu3W0dxxOFXKyMv8Ahzx6ga6jmq5gS3clc59Qx0z6wlllsTPbrc/jZgZfqPdaUm6m/E1Z+O9/uufts0z1rhsKMmi7TUcL4jdo4VndFTQ1bTYcqonxS1MXX7LFMY6gfFVjS7g+UtNr2dddgxVHw6g9Nk9F+OhD9PzBd85PVNJHhkRjLfkC8u8guupKbEIT7h+Yd13tkTmDJU0MTDJ9I7rVot0zy7yTEhKDijffW+Le3gzzG/fTtZceeorqiuZJOGTO78Lp3H8Slr8JsDe7VzbnZ0lPiJmd7ZNweys2XPR57jYtf50mcW5p9S4k+oeTO75j3Wq6vGqyapc10rjv5W9M2ugpYXvcYu57LTOKdNyUtU92jv4WRdkdns3jPG1ygmkT4LL7haZH3v5V1qqOlnYGuAO3BVrwujka8AiwV3fF7bAXHsqkMj9jt8via/xfOxcPwWjjc15YFsnLTFKPDJo7OaLELWEuImJnwuVd0/jdUyZpjedj5W5h39pHmvNcfXHZ3Jk1mdT0Ht2qAOO66zybzzgZ7LDWDgd15e9CdbYtTFml7uy6DygzExh1RC0Su7d10ePbp7PE/JsSP4paPVPLfNZmJtia2pBvbuttYTjYqIWv18rh3089ZV87oRNIeQusulsdBw9j3P8ApHJWvDL/AIeI5mAnKXRn78WbEzUZOFZMZzHocIcfcqQLfdYr1dmHR4VRPc6dosPK5wzk9QUdLJK2GsaLX4cp/wDK2+inXxe12jpyoz4w1psK5o37uVFP6kMKpTpdiLB/7l5+Y96naymkeGV3n6lhWM+p7GZZTornc/mTXkvf0sx4eEl8PTT/AO8lhU/GIt/3Kelz9w6dwArmnf8AMvMPC/U1jesNdWOsT3csv6b9SVe+VuutPI+pQSye/pI+DWvh6V4TmxR1li2rbv8AdZJh3WFNUsDhUArhHoH1CMcI/drhwOXrcvRueNJUxMJq2m/+pNhf7MinwKkukdPUuOQyjeUfyqltcx/yyLUHTOZ9DWMH/FN/3LLsO6xpJ7Wmb/K0aJpsxMnh51P4ZxDKx4AJUzSy1xZY9Q43HM34XD+VcIK4vWxU0ZFmLKL+FzZJqIaqmBl+yt1NNqcCVcYJGkXCvx+FK1OJM1wYQU8Thw0/bwqeR57JjXuuSQka6My2XRV3Dkum3ZQxyG91J7l+E0qKeiUNA4Sm1t0jXX2PKHfKUjLFctkT2klMLL/KFKmM+YJS0pPQxrd7OCcCRwU8sBN01wANgmyFkSRvBFieyktqNvsqcEg3Cmiluf28ppBL4NmaGkggcKNzw0fCFNK33N1A+M2sggktsT8QL2uj8QEx0J5CRsDncpjWhjWiXXq7p7eAmRxi5JKcX6TpFtkgJ6JGHayexzR3ULTcXKey1kEsZEupp7oJBBF0xI5xHCeuyRPYj3Fp2Kbe+6Uu1G6RSlhLoBsbqQEHgqNOj7oEa0PbyP1T1GNjdO1nwmP6Rv6OTXO7ApNbvKQEHgpUiCU9A7cG6RhJvcpHOttZKwbX8pX8Gxe2KASbBPa0W3CYDY3T2m4umEgaG+EaG+EqEAIdhsmkk8lPO4smOaG8IARCEIAASOCgC6BubJ7Wgb/ZI3oVLY0NNxsngAcBCEibbF9UCEIThfVAhCECghCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACCbC6EIb0I+0Mc7V2SJXNtwog4nYEoTQ6KHP5/ZU7+f2U5DjyCo3RtO4CkjJE0Hoj0E73RocpWNsbEJSGjcgJ3sO9mIzhOUJeQfhKlaSRcpH2xGuhxdZlkRvB3JTX8XUTyRx3QlsgnDbKkOB4KC0HsoKZ51/Eqk6CLhI+mQOpoboHkoDbG90tu6LHwk2hjr0CeHagQmJDe+wTZND47QOFxZN0OHZP7JS+MfMhTJ1PRGGHumybbfdS3DhdpVNOHni6b+WI72WgcLiyGiwso2tkvuCqiNjXC7kOxMFPQ1nKlawfNb+kx8Rbu1O0Se3clRufYjfQrm3OwUU3yqWO9tyoasgD4ShS12Qz2RF4G1k+OQAX+6pmtme+26l/DzXB7IdqRFqT7JZKgNCop6i7tj+qlqonaLgK3zRyNuTfZRymiXHTnIn94HkoMrQrXUVEzCfiVJLjYpxeWZQSuSNeqqXzRe5ZWsbq8opamNxsT/ACsOxXr6jpbtfVNsB5Vobmth8U1vxrR/7lBK6LNWribrobSNswe04XSyua1trLXFLm5hxsPxzft8SvFHmRhdVFcVjSSPKhnfBFK3jMip/sZHVzMaCS5W6WqDwd1YK/q1lRNohmBBOylhxG8QcX9lXWSvbos04klHZbOsK/8ADQvdfhc6Z3detoo5h71rAjlby6/xBraKVxd2K4m9WPWU2GsqDFMRZp7qll3KKO98eo/aK0adzpzNhkmkb+Ivz3XN/XvVNPWSSF0gPxHuqXNbM+rfXyNfUnk91qfGeuJap7v847nyuVyshbPorxfB3BdGVnqOip5i7UFlPR+atJhrm2qQP3XPXUfV1RAC5kx/lYuMzMUgqbCocBfysv8AydyPRpYcfw6aPRPLzP2Jksbfxvj6l0rkznOyvMQFUTe31LyQ6GzhxGKojvWO7d11x6Yc2ausngY+rJ+Id1foyTyzyfj4pN6PUjpPq8V2HNIfe7fK1j6i8VkGDTua76SpMnOpH1+FRkyXu0d/sqDPsCfApt/pKs3ZG49HnfFYlf8Am619PND1adV1lPXVQD3cnuuOer+tcQdXuDZH9+6629YFC84hU6QeSuRcVwB1TiBDm33WPPLUZaZ7/wCP+Lq2iM9Fnk6kxKeM/G7+VaazEcS90uOo7+VnFB0U57R8CrG5eQPbqkjH8JtebFSN/L8erqj/AKmG9O9VVdJUNJDhY+VtzoXMOocxkYlPA2usFxLoiCnJMLN1d+icArTWsjYCd/C1aMrbOL5HiYQT0jduA1Vfj2lrC46rd1ldFknivUENxRudq/0q8em3LGbGamnbPASCRyF33kf6YMNxHDony4e0kgfSt7GjK7R5fzrjiJnnpQelDFBU+67DXH/2LZeW/psrqGojecPIsR9K9I6X0j4GIQ44Wzj8qfD6bcKwx2pmHtFv9KnuwppHI43PQjZrZzD0RljVYVh7QYSLNtwsKzywmopMPlaQRYFdm47ltS4ZSkMpwLN8LmT1L4IIKGfSy3K5vPx3Ds9S8b5SGVJep5vZ+GoFbMA47OPdakw6olFbpJ5K3V6g8PkFfUAN+orTFNSmKsuW91zF0Xs954LTgmXypcTQk3PCwzGC59SQR3WaNYZKOzvCxfG6MCpBDe6bV0zrblunRl2TbpYsQiIP1hd3enGaWWCEHwFw9kxRl+IxtLfqC7x9OdAI6eAgdh2WlVLSPKfJP02dE4XhTqvDWtLb3YsMzE6GjlpJHui7Hsts9H0MTsObraPlVmzGoYGUjwGD5TdWZwk47PNMSz3zvU4Pzz6Uhp3yj2xyey5u6swyCKoedIHxeF2B6i4IImzODQDuuPuuqs/4hIxp21FYmStHvvitbjVEskcUbJQWtTMVkIjsFNShryLqmxhpaw7rPi37He5MVOkpaandVvDAb3Kz3oDLqpxOVmmEm58LD+j4vxNeyN24Ll1j6cOgoMVkgLoQbuHZdDgNs8n8m/8Aoi2ymy9yGrqkNLaMm/8ApW/Mssga7D3RTvoyNh9K3xkrkThc9LE+Siadh9K3zgWSWFw0zGto28Dsupx65OO0fOvknLVKTg2afyl6Snwd8Z9ot027Lc56tOEYUNT7EN8q5w5ZwYfATDABYeFgOaVHW4fRPbECLA8Ky9xPPnZXZJ6NXZ+Z8SYbDM0VhHP1LjvNDP2evrZWisJ3P1LOvU7VY04TNjc/kjZcp4jh2NV2KOErXkF3dL+X1+l7Fwlc+kZ7Q9VVvUcoLHuN/usiw3pPEq8B3suN/smZIZezV8sfuQk8XuF1ZlnkhRVUDHT0gOw5CPyqRtx4dwh7NHMFR0diNFEZHQOFh4Vsmxatwd5LtQt912X1pkBSikcYKIcdgucc5srJsFjlfHTkWB7KGywjWKvbRgsee9RgTwPxjm2/1LNeifWK2k0xSYkdj+dckZwYjiOC1ErWyOGlx4WoanN3FcLrS1tY8WPlJXkerNejgHbHej19y59YdPNp/wDxI/71u7oT1PU1e+Nv48m4/MvE7L71HYpSSNDsRcB/6l0RlH6oKo1ELX4me3Llo05iTK+Z4rOUG0j2fy4zbpcXbGDUXuR3W2MCxuGrjBa6915t+nT1BisbAX4je9vqXZ2VGZtLidEwmrBJA7rcxc2LPOub4CeOn0b3hcNAIPZVdJMb2JWNdPY/HWWHugiyuwqzrGg8raquU/h5xl0Sg2mX2I6xsnui0jVb+lHhBDo7u8KrkczT2upnIwranJ6RRSP0m/hEUxdtdR1AeZDbhOiYbWCZKSiV/wDHaWyrZJc91LrBFlTNa9qddwbfumOzSI65OMtD5iGjlQGUN5J/lEhc82JUE0ErjZqY718LsZPWyrhkDyCCpnRix37eFSUMUzSNSq3l4G57JqtHKfuRP+BR+8GnUD+yKgm9yVR1EjhexT1Ja7HultbRW/jAntqGnZWyGpadnHspqeXW6wKVySWyvpuXqV4e09kGRreyjcf8vY9lTan33KglcP8A8ffZO+qDOO6Gv1HUfKpJyedSmhLiywKRWplacJReipBB4KkVOzWO/wDaf/mEcpyn2PjFslSF9jZR6Zf/AKCc1hDbu5T1NInhDQ7WEa2qFz97av7TBOQ/Tfup1NNFhJ6KnWDsAnNdpKhjdcXupUvshsuuiQG4uke4NBumtJ3F+yhqS8eUa7IJPTJNY4SNdZ17qmEhva6ljLiLuQ3oq2EodqUreP2VOCRwU9kjgbXSNrQ2t6kTG17goaLkbqNsjnOsE8Xtumln3RIhM1lK0uJuUA3schCECEaE5zQBcBNHKRvQumwBsbqRvA/RJoHdLwmt7HJaBNk7JyCAeQhdMUazn9k5FgOAhOT2AIQhKAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEmtgNedrJgYAbp8nZNS+oewEXFkxw07J6RzdXKXTD2GtFzZJKLCw8I3B2Kjmfp3KeOU9sjHNip2/KFTscC4ABVLfl/ZAv5NpIC0uFh/yUckRAv/ANFIHhrt+ye5zS3c/wBI20xrmUL5TG5PhrL23UNc8F3wqGmuX2T5LoNsu8cge1OfIAN1BCx2i9krgXbWUD6E1sf7l+AnRkO+YqnIsnMcW91G2OVZNJZou0qgraosF7qqc4lt7q318LnggJjYv49ktDiIOziqyFzZnfsrBGJISSrlQ1WlwuVH1sbrXRcjC0C6ilOg7BSxzNeOUlTGHMunfRNdkQqRbdQT4oGC1+yimc5m338qgqrv7o2i1CpTK0YprOxTnVWrmytHuCAm6p6vHBANzZRSmixDAdj6Mkp5YwNRT5a+NpsSFhc/W8FM0632t91ZsTzVoKcHVUDb7qtK1RWy3Xw1830jY766E/MRyqDFK+FjCQR/K1bV524ZEbGpH+5WrEc78OfG7/ixx+ZV/wDMh/TTxfG8qU/1RneO9TxUgJLhsPK1fmJm9TYVC5wqGi1+6w7MPPSgpoXkVo4PDly3nn6j4WiRrK7z9apWZUW+md7xniFk4pyj2bUzI9UTaB8jW1oFv9S1LjnrRbQzuJxFux/OuUc3PUJJN72msPf6lzr15nziPuPDKt99/qVeeVo62jxeVUNep6VUfryiM4j/AMTbsfzrZmXPrFbi7o2f4g03/wBa8V6DPTGvx1zVyfN+ZbxyX9RtXSTQ+/WuHF7uVazLjoz8vxac3/qe2GXmcMOO+24ztcTb6ltfD8fjnpQ7UNx5XmV6evU9SyOg92v7j6l2Hl5ndh+NUbBHVA/D+ZQ15cfbRk5Pi9sK9pGx8yMVthspa/6SuDvV9ik0ralrXX2K7E6r6gbieGvDH3u3yuRPU1gU1W2d2gkWKiy700bXA8XOM1tHnXm3VVbcSk5+YrWlRWVIc7Vflbqzu6f/AAtfISzuVp3E4mREi3fwuWyrD6N8UwJeieiwY2yeoafhWK1uHVIkLmtKz0RRTixamTYDCYy8sG6zI2akeh24D/FvRhmB1lXSVbBuLFdT+lTqWoFfTML/AKh3XONVh0FPVNs3ut2emivjpsWgGr6wtGiS2eU+V4uoy0j1d9ONc6rweEk8tCyPOmlMmCTD/QVgnpWxNs+EQi/0hbLzWgE+Bym30FXp7cDyHDg6c+K/6zzI9XeHBtdUuI7lcpT0MbsTNx9RXZ3q9wvVVVNh5XJc+EObih2+pYGS9s+r/D4qeHBf+ibDqCFkIOn+lLVimZCRtdVYpDDSXt2WP4tVPiefi7qOh/8ATrs3BjOPwpKuMOmIDb7+FmGWmBMnxCNxi5I7LDKWvhlmGpw5W18oY6aaui3HZbeO1s8653CjVW3o6+9JvS0JnpbxfUOy9IMhsAo4cOiBZbYdlwh6VKKIPptFr3C9Acmad7MPit4C7Li2vZHzL57Nwpkk9G0xhtE2nAsL2Vhx2ipWRuLW9lfvbnMOx7KxY2yQhwd4W1kWLXw8WxJS/L3I1t12GCneB+Urj/1RPvRz7eV2J11E72H3t8pXIPqfgaKOf91yfJ9rZ7d4RNe6POL1BSf/AIhPt9RWk2jVWk27refqBjBxCf8A9R7LSErmx1ZBXG5H+x9QcB//ABIuOoNprDwsfxMa6nf8yvEkzfY57eVZKuZjqgfqoIHX2b/CbDyZja3EYzb6gu7PTw8exCPsFwpk49v+IR7/AFBdyentwbBCQewV+p7R5V5Pvs6y6TlYMLZvvpWN5nVrI6OQ6h8pVZ03XvjoG7/SsSzVxCQ0cm5+Uq5KbVWjzzjcaUs/2OT/AFJ4qCJ9+L91x51hXh+KyNB+tdP+oute4zDfuuTuotZxd5P5isXIe2fQXjdUlUisoXlwBVJj872RE2VXhbNmkjsqfqYxmEgDeyz6+7NHZ5EZKnZS9E4zoxeNh/Mu5/SDiMMslMHEfMFwL03ePF43D8wXafpExGSOWm3+oLocNKMzxfzC2Trkeo+RzaR1BE4EfKFu/CPw7oWg24XOWQGKSPw6IF30hb1wvEXRQtcTwF12Pd6VaPlPyWmVmU3syOojhdHYAEWWusy+nGYhSvDYwbrIsQ6vp6VhEsgFh5WGdUZl4PHG4TTt/lMsuUjHwMLIc/hzRnZky3FTKTTXuT2Wi6z08wRVhe6ktvfhdZdcZh9OVLnh1Qzv3WqupOssAbM5zJ2fyqjuWz0biOKt6bRZ8qssKLA5G3jAsQuiOgKKjp42MAbwFzmM2MLw6YBlU3nysx6Rz3w1gZqrB/uSxvS7OjyuLvljtR6OjqzCKGsoyHNabtXPvqN6Aon4dLJFENweAs1wvO/DKiAA1g3H5lg2cGZOF1+HyNFS03B7qOzITXRhYXE5Su1Ps85fUx0RJHWVAhh+o9lyx1d0bWR1cj/bO32XdOeU2GYpWTOLmkF5XPHV/TVJNO8sYFX/ADJM9T47h5OhdHPsP+IYU/giyy/oLMmvw6vjDpSACO6ruqekYg0ubF/Swiegkw+rJaDsVNXkJsuZPDS/G+juP04Z/wA1I+nY+rtuPqXfPp89QDKiGJhrBuB9S8Ysr+s6zDKuJrXuFnC267S9NGadb7sDXVDuQPmW3hX7Z5D5VxTgn0exWVWYoxOKMtlvdo4K29g1UapjZAeQFxj6aOtJa6CDVISS0d12F0BJ+JoInHuF1WJbtHgXMY34rHsyylrDFHvspYK8SyaSVS1MZZCSBZUdLUP/ABFr8LRVhyNkV9MgliDoS9vNlFSCTUdY/pS4dMJAGvKqJzDELhR2Tjorvf8AqQvfoFyOypZ8QDdrora+NzdLSFaqiqGo38qlZf8AwbVgynIukNZflVlLPG7kjhYtLjkdKPiP9qlk63p6a5dLb9Sq7yEvpqR4y2Uf1Rm8tTHGNiFTTYo1oNyFgFZmlQxEh04/lUpzNoak2ZN/aI5Kf9Ja+Iu/qM5nxpt7XCgfiHu/CO6w/wD70Mnddrib/dXTDMS9zdyswyNlizj5Vx+F7Zcgk91LFVtp+SFQOxANZf7LH+pOrocNic+SS1h5UkrtRIKONdtmkjMHY/Eza4/lEeOQvGzm/wArQPU+f2GYVO5jq0C3+pW7DfUxhMsob+OB3/OqlmQtm2vG7XHaOlo6qOcXLh/KmZUNaNIstN9MZ34ZiDQGVQPH1LLaHr+lqrFsl7/dNjdGT6MvI4S6uXaM4dWhgIHhMbigHJVjpceiqm7FSCqubjwrUbOjNlhSretF8bigIFgl/HPftblW2lfrNlc4adpZeycpdlWcPVkT5XA38oYdRBPlPMBPKBARbdWIzEctInp23G6qQwHjdU0QsLA7/ZVMTmt5KmjJMhlPY9sYAUVRGCpfcvwEx7uxUi/6QymilELb3UwYANIT9B8oawg3TiFrYzQErIxdPcLjhDARe6Y0LGvsA0A3SgXNkJ7PlCQk9RNB8pwFhZCEC6YISF4BsjWPBQCXYpFxZIGAG6VCY09jwQhCQAQhCABCEJ0fgAhCE4AQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABBNtyhNc6+yF2Nk0kI97U0OBNgUknZIz5gpF0RezHpCbcpUj+P3TWxfYhc4kkgpr26hunM+ZOc3Ub3R7B7MhjjAN7qo02CSOMb3Ke/wCUpdh7SKSqk0b3UH40n4dSkxD5SreHEPuN0qktDlv+lXYzG6qKWk0m9v7TcOiMh3Cr/baxmySUh6bYgAGwTXNHb+FBUVOg89ktPVNedyoJSQ5PRIWbXITHgA7KR0jSLBMksN1FKaRLF7G3NrXSGNr9iFE6oaDu5KyoaTs5QO1D9MjraZjW3DVbZpnRO+ElXeUskG5VBV0Ykddqb+VDPRykMpMSlDtybXVxZXl7LEq2xUDozd+26qdDQLApys38JvxDayo3JBVBU1jGNJLlNWOtGXOKwXrTrEYOHgvAAvyU2U9LZp4WN+R6Rfq/H6WJp1zAbeVh/UvW9FTNJNU233K1HmV6iqDAw9rqxgIHdy0FmF6wKVhdG2vbyfrVO3J0egcP43+fUjoLMHOmlw2OTRXDb/UtEdfeqRtC99sTtb/UtBZk+qYV0UpZXNN/DlzpmZ6gKqoMhZWdvzLLvykos9AxPE96/U64xv1huZIQMW4P51ZZ/WK94cz/ABU/71wLiOdOIz1BAqzufzJtFmfX1Eo1VJ3PlYjy25tHY4XiShFP1Oy+ufU/WYlA4RYgTdv5lz3mnm5jOJuk01LyDe26seA4lieO2a15dfwrpW5Z4vicOr8O4g/6U78rZ0uNxNWOtNGkusercVq3vD5HbnytdY1LV1lSQ953W+Ou8pqnD6d0slOQQL8LU+KYA6nq3B7eD4UFt3RtY/FV3LpGOUmBTEe6CVXwdQV3Tr2uZM5ulZLg2FRviALVaOuMDYKcuYBeyzZ5H/svvxuEl8M8yo9SVfglREx2IOFnC93LuD0ueql+JOhhlxIm+kbuXlIwVlBU62Eixut9emnM6vwnFIWyTkAOHdJG5p/TD5DxyH43pHtj0lmLS47hMb/xIJcwd1hGcdBS4rQyvsCS0rTuRmdVFPg8LJK5pdoG2pbFxXqqLGqNwbICCPKksv8AaPZzeJw6oytpdHGnqK6Nk/GSuji2uey5w6owWSlc8PZbddv539OsrA+Rsd+ey5RzZwf8AJCGWIcSsPJlv6e4eKYkfVI1ZSgNqdJKu07G/hL27KyMlcK8g+fKvU8rPwOx7LKc2meiXYUfw9GG9RVntVO3/NbC9PONPbjcAL//ADAtX9VTAVJu7ustyIrzFjkIB/8AMC1sZv1TZ4/5ZhpxktHrd6RMW9zCYPj4a3ut4df1DZ8Ee24PwLmb0eY0P8KgaXfSF0J1bXCXCHEH6Fpt/ozxCeJ650X/AOziL1W4Z71RUP08krkrG6RlLiBJb3K7Q9SlKJ3zm3lch9c0TYa15G26wcj/AGPpTxJ+mJExrEsUjip3N1BYVj+JGZxawq+4z9TNSxyoopJJi4A27JlP07i25uBa4qyohn1EnlbPyh6mlgr4Q59twtZ4nTyxm7W/qsly0qJYcTiDtt1s0PtHn3kdjdT2eknpE6mM0tKHPvuF6S5ETtq8NiN+wXlN6PcTeaikF+4XqR6aqkuwuG57Bddxsu1s+Tv/AMgOThI3rHQh1ONuyx3qOgc1rnALLqUg0ot+VWLqMExuNuxW7d8PDsO2SvNQdeU8ggeC36SuPfVBDL+Fn28rtLr6H/IeLfSVx56pAGUc4t5XN58Xo918Hs9po83PUBTP/H1BA+orn/GXyQ11rldCeoWo9uvqLD6itEVlM2tqzcLjsuLUj6w8bh7Ux2UT6mR0HPZWqoe8TAk91kVRhEjINQb2VjrKdzZdLhbdUoPTO7sx90mfZN1Lv8QjF/qC7r9O0jnU8O/0hcJ5O07hiMZA+odl3h6coSaWHUPpC0KDyzyfF22dK4AW/gGgn6Vh2abwaaQX+krKsIkLKMD7LEMzHg0z9RHylXJx1WcBxkEuQOQM/aL3DMSO52XLfVFAG4o8gfVwuss8WiQzH9VzD1dC1uIvcfzrByd7PoDx1R/Ei2UbWxsDbb2Vtx6KTQSR2V0aWMaH34Vm6gxMaCAFUqi3Po6XPnGNJTdNULpcUjA/Muy/SXhEvvU1vzDsuNejMQ1YzE0j6l3R6P2e66mIbyQt/DTTPBvLrU1JHoDkVSupsOiLvyhbg/xRsFJZ0g2atUZVvNNhkbiLDSFeeu+t4cGwt72ygEN8rfrs9YbZ898hhyys31RaM4czG4FBI9tXps091yJnT6sJ8HkkY3EbWJ+pXn1GZ2vfDUM/Ei9j3XAuf2ZWI188pjnO5PBVSd52HFeNpRTaNrdW+uCoZVPacTNtR+tYvXesqSqJecRP+5cfY/j2KVVc8OmO7vKbSz4lLF/4zuOxUUpS1tnd4PEwr6SOq6n1Uz1k3+XXnns5X/pr1K4gQ3TXu/lcg4bHi/vgMLjutm9BYJjFZosHG/2TfzevRvPioTq7R1fgXqZxRsI/41x2/Mqbqz1FYjXUrmPq3H/3LWHT/QuPPgDhE+1vCh6o6RxqmgJdG4beFBZayguLprsRR9XZp1GIVD9U5IJ7lWSLGosQuXuBusX6jpqyjmd7oI37qHB8ULJdJfZVJ36O54bEhclEvuPU1PJA4hgK11juDskqXFrO62LLNBUUpu/eysEuFxz1W/BT6slo3cviYqr4Y30zh7oa1hAN9S6m9NrnsqoQXfUFo/BOlmOqWOYO66H9P+BupqqIuHBFl0GFe/p4b5rgxgpdHob6Uama1MC420hd3ZWSh2GQknsFwj6WGBhpxbgBd0ZWyBmHQgnsF2GFkPo+V/J6lFy0Z5PHrhJVtbAY5i+3dXRtnRbKlnYC5av5Wzzp9rQ+Ku9nZp3TKjFJXt3cVSVDywnSqCvxAwsu/bZVbrmkT41H5ZfCarxQscXOk/tWvEepqamY4umFwsb6s6xbQxucHgW+603mJnzR4MJBNVtbYH6lnW5Sj2dlxnAWZbXRtHqzM2gorh1W0WHlap65z+psOY5zMRaP/cuds2vVhRRveIcRZffh6596/wDVPJXFzIsQFrnh6zLMzbO9xPFfWvSideY76mmCY6cS79nKXpb1Ix1FSGyYkLX7uXntinqEne9zjWf/ACUmBepKSikD3Vo2P5kkMwtPxj1X+p6z9E5z4ZiMbPcr2k7fUtn9N9cYdWRt9uqabjyvJfoP1kx0U7I5MSbyPrXReU3rDoK5kQ/xJpNh9au1Zj/hh53AaWmjvar6opY4CROOPK0f6g81m4Jhc0kdXawPBVlwnPuhxihDjWNuW7fEtI+p3MF9bhE4inBBabWKnnnbjoXh/HFC3s0Ln16uKnCsTmjbiZFnH6lrvpj1rVMmItY/GDu63zLn31QdTYh/itQ9sx3ebWK0FQZg4rQ4qCJyLO8qhPLbej0bG8Z96vh7EZPerL8Y2PXinI/Mulsvc/6augic/EAbgfUvF7JnPOuoRGaista3Ll0xlz6qDSiGM4hsB+dPqydsxOU8Z9V8PW/ojNSgroW3rQb/AHWd4d1VR1DRpnB/deb2U3qspZWRg4i25I+tdCZfZ/x4noDasEED6lrUXbR5vyfCqtt6OvcKxCOezmyD7WV/o5mvjAutLZe5hsr2xh0oNx5Wz8DxyGoawtcN1dU0zhM7EcG9GQaQeG/0lLTbcbIhe17A4dwlkcA3lSRn/DEmRlwYdv3SibXwSonuuSEgeGndWIyKNk9MqGSHuf4Tw7VvdU7XEbhSxnf9VbrkmiGM22Tgg8FCbH3TiQOSnbbLMFsCQOSgEHgpjzcpD+qXS0WVHrRJceUoksOQokI9UJ6knv8A2R7/ANlGhNa0HqSatXxISM+UJUgeqFa+53P9J2pvlMQgRrRJcHgpC9o7pGcEJtjflNkNbSH6x4KNY8FMQmiew8PaUtx5UaVnzBOj8FT2PQhCcKCEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAj/lKYnOcLEXTUACVnzBIlZ8wQA9CEIAEIQgAQhCABCEIAEx3J/VPTHclLH6R2fBEgcCbI1Dyo3yhlzfdK3oiS7JC4A2JRs7ZUrqkF+5T2zjsVDOxokUXskERDrp2ggXJSNk8lI+YDYKL8hKoNj4rXIJ/pOew6bgqldUtB+ZO/HDTuUqm2SKqWiOtjOk8KigpHOkubcqqnroybXSwSx6rtKVT6HqrS2yppGiNt7J88tmWUYmaBsVHLKHA7pHNpkUotFJWSDUVTsncx2x2VRPC55/ZUc0bmG1lFK5aGerbLhBVa7OcnTSAsuD/at8MpY2xPHlQ1eLNj+HWqdlqLtGNKwlnmeXWBUL8QNPuTwqSTFGEXL/5VpxXG42tI90A88qnO5rs1KcGUnrRkLcaY4X1f2in6gpQ7TI/ha3xnMCDCmEPqQNvKwnF88aajlJ/GAb/mUccn9i5HipS60dAVvUNH7V2PAVHS49FK/d/9rnaT1DU7zoFeP9yvPTWdFNWyBorAd/zKdZLZL/8AFfjjo3di2JsdTEsP73WhM/8Aqd9BQTuY8ggFbHourYcRo7iW+y016iIpKvDal0dzdhsmzv2avFYP/wBiWjgD1UZ24rhNZO1tW4Wv9S46699SmJOqHMNc/wCY/UugvWVgGJS1dS6Jru/AXCPXvT2LsxBxOr5j2WTkZB7/AOKcTGcI9GfyZ112JhwdUuN/9SsOOdUVWIu0+4Tq+6w3B6GtpzpkJV7p4XOeNR3WPfk/qz2PA4GGk9EM/vsPulx/lV+Ayyy1EbdR3civpi2C5HZU+C1H4eujudtSx4XN2HUR4aFdW9HVHpt6MZjRi9yO97crrjpLI2gqMKDnUjfl/KuaPR7jFI6SBjyOQvQTLenoKrB2HQ3dgWvRF2Ls8y8kyHgSbSOPvUHkrHhtFLIymAFjw1cU5m9PjC8TkaGWAJ7L1Y9TWA0L8CnLYm30m2y82PUDhDafE53Mj7lVsheuzW8Xy1kxTZrLBZG20JMcwV9a0m22+yosJndFVWdtYrIY66F0ehxCx7JHqleJGdS0jWuOdKPieSGd/Cq+ip5MAqg+5BvtussxKkp6lxGkfZY5jWHPpnaom2SQeyjyfHx/x29HQGSOaOJQ1cMf4t2kW21LrvLPrN+K0MbXS3JA7rzyyqrq6KuiAefmGy7W9PL6qopoTI4nYKyk9HmORVGrINkddYa2sw9zy0H4SdwuRfUNSMo3SgDuV2n1NSNGEO1N4Z/0XHvqap2ukmDR3KpZNekeheI5G5aObpqhn4p1hwVUmpe6lIv2VDUt0Vr2H8yrYoSaS9uyw59SPU5tOgwrqlznVBPhZPkk5zMXhd/rCx7qeG1Ufh5KyLJ1ujFYv/WFs47X40jynyipS9j0o9ImIvjoILuPA7rpDGcTMmFFpP0LlX0qV3t0cIaewXSVdUl+GX1fStJ/6Hjd2KllLf8A0589QZ1tmt4K5GzCYRUPP6rr/PGnE1PMS25sVyVmVSujqJCW25WHkRfse2+NxUcWJqvFml0xF+6bRUDJha1yjGJCyc3PdS4NUN9zchJT0dpCv3iUmLYNHC27gm9MGOmxSPSLbhVvU1WwQE34WO4VienFGAO7rVp+o47yTFSqZ3X6Oa5rqul3+oL1R9M1SHYXAG+AvIj0cYu411IPc+od16y+lasEmEQEu7BdVx0l7JHyV59S4qZ0/h5vTNv3arZjrQY33HlXDCpWPpmi/DVS4yxr2usOy6KS2j59pfrkGrMwm/8ADPI8FcY+qiRppZ7fddrZi09qV9hYaSuJfVawtpai33WPnVbie3+CT/dHnJ6g2tfiNQP9RWkGxObiG3lbn9Qcr24hOdX1lamwqJk1Zd/lcdm16Prjxm+KqiXIwxOobuaOFhuMRWrAA3utgSwwtoyCRwsKx72WVd799lkKL9j0iN0XQZjk7obXx3H1Bdxenmqa2miHGwXDWVdXAyvj+IfMF2dkBicYii0u7BamPDZ5v5LOEkzp/C5WmiH/AKVgmZ9WWwvAPYrLMDqTLQg3+nssIzTjlfA8tB+XstC2l/j7PM8JKOYczZz1DXsksfK5m60J/HPt+ZdE5yulZ7od2JXNvV8jn1zxf6iueya/2Pb/ABye6l2WqR7/AGyNXZY5jUzyXAjhZPDTPkFiNiFb8awVntOcRv8AooqavWR0XJNulln6HlP+NR2H1r0A9GA2pnOb3C4U6Dwdv+Ox3H1rv70f0kFPBTlxAtZbdFels8Q8jonZKR3L0piLKXBGW2OgLVefGYMmG0cxdMdIB7rMYcZipsFGmXhl1zn6neqnOo5msl7HhW7ZekdHnnG8S78721/TnfPfMx+IVU7GyncnuucesHnF3uLhe5O6zfMbF5qnEZQXnkrE4aeOYXcOVlWW7Z6nVxca61pGtazol9TVktZ3V3wPLl5IDmc+VmMlBTxSatIuq3DZoo3BoA5TFbKXTNbC4/2ZD0rlfA+Qa4geOy3zkzk1T1U8TTTjt2WDdFvifUN1MHZdMZCR0jp4SYx27KZbZY5Cr/GobMy6YyGofwDT+DHy/lWM5n5LUdHRSO/DDg9l030rS0H+Gt+BvyrX2eclFTYZKdA2BTboajs87o5SzIzHW0edmdvSMOHzyCJgFieAtRMMlPVGMO4K3p6iMUiNdM1pHzHutGOa6erc9o7rOsPYvGsZx1JlwZWTiMN1bKqopTK8G+6ozA8R3t2S0MpjmAJSU72dbnxSoZnnRVMJqqPUO4XSGTGD3miLAOR2XPOWxbPWxA2+YLrPIvBmyui0s7jsuhw3rR87+eSikzrz00UL4hTm3YLtLLR7mUEQ+y5V9PeAuibARHtpC60y/oXMootuy63Dk+j5G8lti7ZIzijmPtm6WbcXCjpWWjs5LLKAOVsKx9HnzinLooK0CEl7zsFh3WfUsNMxwDrWCyDqrFmU1O/47WHK57zuzSgwSCUuqQLA73VDLt9Tq/H+MeTYnotOb+a1JhlFMTPxfuuBvVV6k5qOaobTVzhzw5Zd6h/UhEWT08eIDk8OXBXqBzIreoayf2qtztRPBWBk5LSPoXxrxr2iv1KXr/1H4rWVcgNc8jf6lh9Nm/WYlITJUONz+Za7xSjxSsqHSOc4glMoKeqo37krFsym39PTcXxqKSXqZ9imYVSCf888+VZa7M6vi2ZM6/6q0Sw1FTvuU6h6OqsVmDGsJJPhOqyG2Oy/H64wfRcsOzXx/wDFD2ah4/8Act45J509R0U0LpaqSwI5cVgeX/p1xXGJGPFG43t9K3L0z6ccXwmBsv4RwsPyrXqu6PPOV4uEJa0dF5X55YhWU8fuVrgLb3crjmpmRFieDPjdUXcW+Vz+6bEuho9D3uZp8rHupc5pZGOglqzvtYlRW5LTJuH4f3sXRguf8TcSqZpGm9yVoWq6fezEDKGm11unq3HY8aD3ufqusIrMMZJIXhgVKWS9/T1vjeATp3oslPic2E04dE8t0jyqiizvrsKmbEKl23+pWvq5ktPEWxi36BYBidNUPn1BxvdWsfI/Yw+d4SNcH0dW5OeojFH1kTRXP+YfUu5/Tfm9VYmyHVUuNwO68p8lafE34nE0F1tYXo36QensRnbA5zXcDldHi2trs8L8i46NbfR6JZO9X1NRFAdZ4C6C6JxiokYwlx7LnfI/pyaKCAuYflC6I6Qw/wBmnY4Ba0G2jxzlqVFs2PhFeXxAE9lcXn3G7HdY9gwkFh2V8heQwAnspIy7OIvj+zHCFzgmGBwNlOxwtdJJI1WITM22vfaEjadh4UgNjdIwgtFilV2E+iuoaHCS+9khe490gtwjlS+xcqigLiNyUrJB+qZISDZDSGi5KfFpstpLRJ7n2QH3NrJmtvlKD3CeISKQG4uomEm9ynBxGwKBrQ9CRpJFylTGhr6BK3kfqhoBO6dpaOyQjFUakUTnW4TZDZaFQgbi6E0aCez5QmJ7PlCdH4C+ioQhOJAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhISALlADXcn9UiDuboQAJWfMEAEmwTxsLIAEIQgAQhCABCEIAEjnFvCV3B/RRoAcHkprjySgC6bK6zSPsgZP4Mc7SoJH6giWYDlMjJeb3Uc5aI4ptkbgbk2TmSWO6ndD8N7KCVunc9uVTsmy5CCJnTtDbhUlTXBhsCqaoryz4fGyoJ60vfY+VB76ey5XUiu/GOfvdOc+Ut2CooJmk3P8KsOI00bPjHHO6cp7LLrcdaRDIyc/EiOukh2P/NRYl1Lh1LAS5w48rF6/r+gEhY139pffS6Hxqcl2tGYNxgk2J5VTTVolNi5YDSdXQVUoDJP7WR4ViHuMBBSSs2VrajKGOY4KGuiZpuFQMxIsFt0smI3ZdyhlJ6I4Y73shrZvZjO6xbHcbFPdxcP5Vw6jxyOCJx1cBabzOzJhwyN59y1ge6oXWaOp4nAdr7RlWJZiwUeoPnAt5csJ6nzoo6dzh+Jbx+Zc9ZpeoyLC3SAVZFie60D1r6rh+Ie0V55/Ms+d8n/T0DC4GEltROrMws7YZ9Qjq2g2/MtN9ZZvz3cWVPfyuecU9R8uK1OllWT/AO5PZ1pVY5CHBxN/uqv5l7fTRjwcVP4bRkznrWTgfijz+ZbByvzdnqKljXVN7kd1zFOyu1h+6zPLLE62nrmBzzbUO6swu6KuZxUYR+HoRlh1ccTo2B0l7gd1WZmYc3EsLkBF7sK1Tkbj9Q6liBJNgFtnF6p1VhhDxy1LK1tGZh46qvRwj6pst46p05MF9ndlwvmrlzHSVUh/D/Uey9R8/wDp1lZFNIYx8pXDmefS8UUsx9scnssnIt6Ponw2mHpE5Gr8GZS1BaI7b+EtNhzXODgFdevXtoKp4A4KsWF9QM93QVh326R7fg0R0ipxWmayAj7LGn1QgrG2PDlf8erw+n1MdysOrZXe+H34cqVM9zNvJrjGjo6t9I+NSNrYLP8AqHdekuS2IyVGCx3dezB3Xlj6UMabT1sOs/WF6V5AdRxz4PG0H6BwulxviPCvL6JSjLSLj6hKU1OCSgE/KV53+oXAHurpyWHk9l6P5mRjFqGSEi92rjT1BZfOdUzPEXN+yrZX+xT8Wm6nGJxfPhrqWpNweVF772yWBWd9ZdIvopXH27WJ7LBKmP2qgtPlYVsuz33jE7qUTQyPdIC4JuKQxSM+JDZWstZW7GMQMdxdOpe3ok5etRxmjM8sKeD/ABKNpA+YLt3050cRpIQ0dguEcrK6STFIrH6l3p6XYJKikhv4C1669o8N5q30vaNqdZULm4O8tB+TwuNPUdG78ROH+Su8uqMFD8EdqaD/AJf/AEXEnqmwv2KictHcqHLp0jofEs5OetnJuLNtijreVdaSL3KPccBWzFTpxR4P5ldqGVjKO58LmciHrM9lqyHLHRhnVkFqg7FXTKqV0WKxbfWFS9TsbLO4qqy9LafEY3H8wV3DftFI4LyDvZ3t6XsUbFSQ6ndh3XSn+KCbDQARu0LjP0/dVso2RML7Wsun+mupI6+haNfLfK2GtRPMJ0qdxiObjHTwy7X2K5bzOw9/uyEtPfsuuut8PbXU77DkFc8ZtdNe2JCGeeyx8mP7HonD5Ua8ZL/hy91TH7U5J/MqDDqwMdfUr5mDh74al4b+YrE42zMJsEylfw6Knlox/pL1Tijfw5BdusXwrFgMVaCe6rOqPxBiJ3WM4bHO/FWgD6lp09tMw+fz4TqfZ296NcVDq+ks76h3Xrh6T8QLsIgsfpavHn0YQTMrqTUfqC9d/SaXNwiAk9gum47/AGR8v+bNWex1tgdQTTN+L6U/EZAYzdUXT8zXU7R/pUuIv+B1l1MU2kfPUoayH/8A1MHzCs6lff8AKVxF6uJIoqWoufK7YzAcX0j9Pgrhv1fQVElJU6f9Sp5dacT1nwqTraPNr1EYhA3EKi7vrPdaXouoYYq7S13dbM9SlHXf4lUaSfmK0LHFXR1+9+VxvIQSPp3x/OddUezZ7sdikoSdfbysH6kxdhqvhd3U4lrhR8HhYzizKt85vdYEYKU9M7xcnJUfTYOWGLB2IxgP+oLtb07Vfuww3d2C4UyroKz/ABKMkH5gu4PTjT1DPw7Sw7gLZxa0ed+Rcs1tbOtOjKeSoo2NsbFqoMxem3SUL3ln0rO8p+l31uFRylu5Z4V0666Jc/DpBo+nwtayluo4DE5iqOX2zz29QOHfgveFrblcpdV18UeJva531eV3D6p+jKiBk7ms7nsuFcxMErocXl0gj4yudyav20e1+N8vBwj2VeHVdK8DfsmY0YfZJv2Viw2DEIpBcGykx2rqY6c38KKqvvo6/N5St0/Ss6QraenxhjnOGzl2N6a+vqTD4oW+8Bx3XA9DjdRT4iHNdb4vK3XlHmNWYe6K05G47rThD1ieZ8nlVXWM9KaXMWCswoaJwbt4utK551T8Yhlax173tusXy5zGrMTpWx+8TceVk2LUNRi8JLmXuFHe9xIeMqxoWppHLHXuASRVkjtJ5Kwiqm/ACziuhMy+iZWh8ns9vC59zHo5cPc5um1ljS+nZxcJxWi01ePM121BVGDV7qipaA7usGmxB7qrQXnmyzToOlFTIwl3cJ8IvZNTk1VPbNsdBUM072FgJ47LpPJKgqqZ8LyCLWWnsocAhe+Mvb3C6ay6wempYI3NZwBurcY76KHK5VdtL0bUwHF54KBo1/StXeoHHpjh0o19is9GIU1LT6dQ4Wpc88SgqqGQNd2KLY9aOIwcVPKc3E4mz0xKSevlu76z3Wv8Dj9+Qlw7rYGb9CJsQkIP1lYRhkP4WcgHuqE4v4ezcLOtVJIuM9GGwF1uyszn+3VWCvNfXNjpbfZYy6ubJX6Qe6K4akavI2v8DNr5PwvqcQhAB3cF3N6celpKj2DpJvZcY+njDxW4lBtf4wvSf0s9FNmpoHmMduy28SPaPm7z67UZHSmSPTTqWnhJZw0dl0j0TTNjo42kdlq/Ljp9lJTRAM4aFtXp53sQtaOy6nF6SPkfyGf5LWkX2VzI28qgragBpN0+rqHEAq0YpWmOEk9vutVPaOZx6XKSMVzHxYwUczmu4abLhX1g9fVNBT1BZLb4Xd11pnF1dHRUUzS/hpXn16weqxXwVDWu+k91j582n2e1+DcWrHHaOHM9s28SkxaaI1BtrI5WphicmPVJdMb6j3V2zle+fGJXAH5ysU6fndDU2PnuuYy7GfW3jXBwVUXoyiHpSGaHWIh/CtWKdJe2+7Y9r+Fl2DYlE6nAeQjEpqZ5+ELDnZ+x2y4uEP4YjTdNOawOLFsLKPoaLE8Rja+K93jsrfRUkc8bQGDlbZyI6fviEUhaPnHb7qXHse+jB5bFjCtnTHp6yLwyppYZJKMcD6VuzE8jMLp8KLmUTdmbfCqHIKOKmooWkAbDstx45V0zcEc8lvyLpMZKVW99ngnkGVZVn/iS6PPP1T9IxYEZzHHpsDbZcTdf9S1NNiZha/bUV3x606llQakR2Ox4Xn913hEtRjLnaTbWVl5NjjI7zxfCVyi9FTgVfU18HxElXP8ABuEd3BQ9IYcIYQ1zVfqmGNsHwjss6Vr2e3cZxsVj/DBepsIbUMPw9lh8nTxkrBHovc+FsmvhbK4tsqfCumhU1rDpHKv4tj9jlfJsNQqekZH6fsv/AMRicB9nl47L029ImXUcNLAfZ4aOy4z9OXRTG1sDjGPnHZekXpewFtPTQjQPlHZdbgyctHzH5dBRctHSeVvScdPSw2Zw0dltvAsM9qFuyxPoOkEdNENP0hZ5QvaynAXRVf67Pnzmbm7WkXbComNbYqvu0bXVmo6tzSVUSVzuQlT1I5K2G5susb2hu3/NNLdR5Vvp61xFiVUsqL7hTxe9FKdfZVsZbdOLSQmRShwsle8NBv4VqEuiCVSSBnP7KUMA3uoGSC/CnabtCnUhYrQ18YN3EqJVChfzZPj2ydMala47BIns+UKyvgP6Pj7p7Gl254t4TGc/spm8D9EDJABYWQhCRtaGNrQoJBuEoeSbJu3dCYR7RI7g/ooH/MU9Mdyf1TZEUmKH2FrJwNxdRpzXACyaCY5PZ8oUYcHcKRos0J8fg4VCEJRyYIQhA4EIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgARceUj/lKaz5gm77AehCE4BC4A2JRrb5TX/MUiAHhwPBSprOf2TkACLjyhMdyf1SN6AcXNHdKCDwm6L737JWjSLXRsBUIQlAEjwSNkqEAM0O8I0O8J6EANa0g7hOJAFyhI8fCgADgeEqazi6ck32D6EL2jujW1I5tt7pqfpaI/bskuByUhe0d0jzsE1NJF2OLwRsU3umucQ5K1xdynaHa6F1ad7pkoLmlwI4Q5xOyY95a0tAUU5aGyjtFHOx7ncbKSnswDWpGgOJuEypaGNuFE2pISEe9E7qqHTpJ7KirKqMAkEKiqKl0biQ7hW+sxMi4LlWt0kauPi+/aHVczHPJv3VLNIxt3XVHV4i2Mai4c+Va8Q6lghY7U8bDys6dmpG3RhSetIuFf1HT4czVJKAsL6vzow3ConXrWjSfKw7NzNCnwymeWVABAP1LkPPP1Fy0fvNjruCdg5Mjd7M6DH4VzXaOlesvVRhdKHxuxJo/wDcsMi9TOG19VoZiLTc/mXnpmB6lcUqK58UeIOtq/Mp8ts3cXxKvZqqnm7hfdTe6JcjhlBHqVlvmZHjczPbqL3+63t0nNJVUrHA3uFwr6ZOpqyqdA6WQ7gcrt/K6uE1BEXH6Qm/kXsc1l4br2ZV7DmAOfcKixbE4oYiGv4+6uGLVUccBN+y1v1z1WMNhe73OPuobbWkM4/GlkWJaLdmJ1rDQU0ofOBt5XKWfebtPBHMBVjg91lud2bHtxztE4FgfqXE/qAzZkkfK0VXnuse++S2ew+O8CrEujBs+86pfelEdcfmPdc1dWZw1lVVOYytJu63KqM3us6iulktLe5O91qEz1FTiF3G93LJsyXs9YwPHYqC6N3ZY9R1WK1jfxEzjcjkrqLKbpc4vCwAXu0LkzJ2P/iYy4dwu2/TtNStjiEmn5QmxtT7Jsrg1UvZIyiLJ2pqWNLKcm/2V86RyVxKCsa9tM4DV4W3ejoMOqoYmmNpuFsfpjpzDHWf7DOeVahY/wCHA81X+La0UWS/QsuHwRiaMiwHIW0MQwVjaMgN+lO6doaCijGgNG2yr8RqoXRFjSOFN+Q8/nbNX/qjQedXT3vU0uiP6SuHvUR01LCJ3e0RuV6I5m4cyoppCBe7SuMPUvgJbFPaLz2WRlzPavDOVnGMYnnNm9TCGulBH1FYFRxkS6mrbGeGDOZiE1m/UtaUNGWz6SFzt972fRfC3fngmyCsdO6P4uArPVMAe0Ed1lOKUZZDcDssbxCB5NwOFDTbqWzocqSdWjbPp6xVlHXxN12+ML0Q9N3VkDcOibJPy0crzKylxB2H10b3O4cF2ZkPmMynZDGZhwO62sfMkkeac/gRvg9nZ1YGYlCXtcCCFpjOjoV2Ie5JHBcW8LYvQPWFNilExrpWm7fKTr5lI+ie8gfKVNdb+RbPP8JWYeaq2jgvOHo3/DmyF0VrX7LnTqZ7afEXMBGzl136l5qenZNoAHK426yrGOxWQg/Wsi76e7ePZUvxLY6KQvN79lQY3DJUOswElXDB2NqIwB4V0p+m31c1msJ38JuLY3bol53L9aHsrsmcJmdikOph+Ydl6J+lDpyV1DA9sfYLjvJPLmomxCBwhPzA/KvRT0s9EPosLg1xEfCOy6epN6PnvyLPjG19mZdWYK5mBu+D/wAs9vsuGPVrh5jkqC4dyvRjrjBGx4I/4PpPb7Lgb1hYX8VSWt7lNyouS0J4pzHpPe/6cGdW1DabFpDx8SKTHGmnDL9lL17hUn+KSkA7uKs1Jhs+kW1Lnb8duR7th8vGWKuyHG67XKbH+lN0tiAhqQ7/AFJanp+on30n+FUYT0vUskBDXc9gpMalxfRyXOcqnvs3plF1xFSPjaZbbjuuoMsethWQxtbLe4HdcY9B4LWQzMI1bEdl0lkx+Ma+KNzncBazg3A4qvNrlZts6Cm/42g1kXu1afzcwJ80UhbF2K3N0/QzVGGtBBPw+FjXX3R8tTTPtGdx4VK3Fc2X/wD5uuiOos4bzJ6elbWPBiPJWKUfS0tQ82hK6Q69yqmq6t3+Q7nbZWvBMmJi/emdv/pSV4jTKkvJfV72c79QdCVD4CDTk7eFYcKy8qhibS2mPzeF1xiGRb6iK34U/wC1U+F+n2Vta1/4N3P5VqY+GmzG5Pyhzg1sqvSL0pNR1tK58JHxDsvUr0xk0+FwM02sAuLvT9lA/DqmC9ORYjsu7siOnBQ0cTTtay38XG9OzyDnuUWQ3tm/Om6txhAB+lVtaZpAQL2VHgMAbG0tPayu7ITpsQt6tNLTPKcmUFdtGGdWYbLNTPu0n4T2XJPqi6Inr6ScMhJvfsu38Wwn8VCQWchaYzey0GKwyD2Cb37IvqUonU8By6xpfTxv9QeSWJ1tdUOZRON3G2y0vB6dcVlrNZw938L1dzG9NrcSqJHGgJu78qxGi9J0Pu3OGn/YuT5DF9j1/i/MFXBLZ5ySenrE/wAMWjD3cflWO1/p2xb8RqOHP5/KvU+P0lwOj3w4/wCxWrFfSFC51xhp/wBiwP8AESls6Nebtw1s8+csMg8Qir4z+AcPi/Kuxcg8pJaP2PcpCDYdlsnpj0ux4dUg/wCHkWd+Vbpy8yYioPbJpiLfZa+JjnNcp5IsmL2y95T9IS0eGRAwm2kdlk/U/SrKihcPZ3LfCyvpXpqOio2QiO1h4V2rem2zwFhZyFvf4ylXo8+ny/48naZwV6nsqZcQgmEVGTe/AXC+ZWQOJvxOVwoHW1H6V7GZk5Rx4zG+9Nqv/pWheuPTFDUSvf8AgOT+RYORg/sek8N5h/jxS9jzCOSdZAbOonAj/Ssd6syir2xO00ju/Zej+N+lqKIOf+CPH5VgXUvprEgcz8Cf9qrww2jrZea/lr05Hm/JlPibK7akdz4We9AZX4wZIwymfsfC65i9KYmrbjDzz+RbFy+9JbInMccPPI+hX4Yq1pmHkeRQct+xpzJDK3Fm6Pep3W25C6E6bymmmgBkpSfh32W3Mu/ThDRMYfwNrW+lbRoMoIKKlA/D8N8KPIwU62yCHmKx5fTiXNnKJkVNI4UnY9lxv6gOgZKaST2qYixPAXrNmxlPHU0kmmn+k/SuNs+cinTPlIpXHn6Vzbx37NHTYHmjsX081sWwauo60n2nbOWUdA189HUMMgIAPdbYzCyMmpamR7aVws78qweTomqwuQt9twt9lPHHf9Ohq5yN8fpuXK/rqmpvb1SAWtfdb76PzlwmnpWxvqWghvlcT0WJ1+Cus17h2V+wnrrFGOBM7/5UypkkWVmwktNnYuM520lj7VWOPK1jmTmvDiFM9jagG48rTjuvMRkYAZ3fyqCtxWtxAEmRxuorK5F3Htrb6LR15jDq+rc+9wSsXia50peQskrsIlqSS4FUjsEfEPlPHhU7IPZ2nDZMYy+mNY/WGOEtBWOUlUTiDd+6yXqXDXtjN7/wsWooCMTaD+ZFVb32aXK58VVpM6b9Ksfv4lTEt+sL1P8ASlhjRh0DtPYLy09Jzmx4nTNP5wvVn0qVDDhcDR3A3W7h1/sfOHnWX+SMtHWPSEMTKaNoG+kLMcMZZo2WKdIQ6oWPJ+nZZhho3AXT0VLo+VeWm1ayeZji0bcLGOra4UlI8l3F1mFSwNiuQtd5nSmOhkINrAq96aiVOO1Zckc8Z99YNjFQz3ux7rhT1K47DVtmAkvcFdUeonFXxmoOvyuH89sZdJJM0v23XP8AJ7Xw+k//AMeY0G47OW8zcPjnxCR4F/iKwaKjEVUbDus966lD6h5HdxWGua4Tl1u/hcplt/D7H8ew61jplwpqw0sAGrsiLGWPnDZHf2rVidY+Nm3ZWynxIvqw0u7rFlCTZdz7I0tm4Oj4IcSDGRi5uuhsjukJGSxyez3C0HkhQCuqIe9yNl2zkX0U2Wjjk9rx2VqiLj2eYeQcuopx2bYyuppKGCMWIsN1m3VXULYcDex0n0f9FasGwpuGU4Om1gsczG6iZT0MrDIBZp7rbotcYaPIraFyWbs5i9UdaK2aa77jdchdW0NMK5zi0fMukvUT1IJJptD7891yz1hjDnVhAP1FZmXLctns3jPHLGpiyoo54oAQw8KolxKEwlpd2WPUle5zbk9kS1mp3zWWRK5+x6VRk/iq0iuZA+pqPgHJWYdE9KTVdTGGw3N/Cx7pZrJ5mjlbyyf6Y/F1cJEV+Oy1cKbk0cT5Rlp0vZtP07dDzQ1EDnwfUOQvQf05dOtgpYS6PhoXMuRvQRDoHiAjcdl2fk3grcPo2FzLWaOy7TB/1R8oeZ5f7ySN0dKxQQU8bduFkcDmub8LtrrDKLEmUsbfiGwVY3rWlpmaHStv9yt6FycdM8MysS66xtLZmVM+NpsXqd5jtcOWEU/XlK59jM37bqtd1xSGL/xW2/VTpxUdmbZxl6l8MrpZItVg7uqsTQsHzrB4euaNjr++z/cp39e0jiA2Vv8AKlhZHRBZxl2/hnNJO3Ve+yqXWlA0uWHUPVkT2hweN/ur3hmOxzNFnBWq2mjOvw7a+9Fz2jJ1FSxzssAT2VI6oE27SOVI1p03sp09dma4tMqHSBwswphBG7lTmZ0b/wBFPG8zNBOyWNmmK36xFDS7gqSOF4G/lEY0kBSh9haytwk2iCVr2N0EG9rKSMcByEKR/Biu9hzm/lGyans+UKNzi08bKLemSJbFQka7V2SpQcEwSOaDwN0qEyfQxxWhA0W3CGs8hKnMAtdMTE9EIGG+wsnNBAsUqE9PQ71QIQhHswS0CEITwfSBCEIBPYIQhAoIQhAAhCEACTU090qY5unugB6EjflCVAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEAI/5Sms+YJ5AOxSBoBuAmP6AqEJmt3lPAH/MUiCSTcoSpbF0xzOf2TlHcjgpWuN9ykfQNND0x3J/VPSaWnsmyEBnyhKmklpsCk1u8poD0Jmt3lKH77pyYDkJNbfKVOG+yAmwuk1jwUjnCxF01Kk2HsiRI/5SgOB4KUgHYpBfZEakTJLN3+yaJwfqSN6F+kjhcJGlo7/0ml+ra6UFttwmOxIRRQ9Nc07lKHApskjWiyT8jFS0yN3zJrnaeyHSNLtkpAPIT/fZJ2ANxdMme1o3/hN90MNrqmrJz2Kjta0Pqg5MealsZ3sqWur2lhsVQVlW9pvrKtldiehhLpLfuqjt0adOJ7yRWVlawA72VhxPE4mNJL/7VtxzquKkicXVAFhvcrXPVublDQhwdWtFvJVC/Jil2dVxvDXXNaRf+sOvIMLie58tgL91pLMn1JUOEiSMVlrA/UsNzrz/AKWKmmbDiA78OXGGdueWIVVXKyCtcbk8OWJbkbl9PSeO8ccYLaN15x+p9uI+5FFXE3vb4lzn1j1LiPWM8gilc7WT3Wvj1Hj3UVbp9yR1ytxZK5Z4hjM8bp6dzgbchLXeas+LjSu0axgyOx3Ha8S+w8hzvC3FlB6a8WgqY3vpHcj6V0rll6fKeSOKSWhHYm7VubprKXCsGjbI6mY22/CnleYuZTB9GJZEZZT4BFCZYiLAdl1Fl/iDKCljiJ4C1JWdRYJ0tFp91jdI8puB56YSyqEDa5vNuUquS7OVy8SFiaN+47j4dAbP7eVpLObqh1NRSuD/AD3V+/8AtGpcVpx7VSDcditYZ14g+owyVzXHumW2qS6LvBcUq7Fs5e9QGYb4vxA909+64zzf60mrqiQCU8nuugvUZXVDJKhuo91yR19WSGpcXO5usi+SPd/G8CCS6NedVVT6qR+ok3d5WMRtbDU6iOCslxPRM5wv3Vkq6QGQho78rHtsSZ61g8fFwXRnGXnUsOHyseX7XC6Jyqz4osE0B1UBYAfMuOfx9Thou1xGyifmVi2Hu/y6hwt4KhWQky1m8Jujej1J6D9WOEwiMPrxt/qW4OkPVzgT2NBrm32+peMuE+oDGsPI1VzxY/mWXdN+q/FaWZrDiThv+ZTxyGeS85wTlJ9HtNhfqlwqpAbHWg38OWc9L5u0ePRjTPfV915DZc+qirqpYxLihN7fUur8hc/xXMgD8QvcD6lYV210cDk8A4y7R27jckeK0bnA3u1cz+pXplpoZ3hnN+y3L0T15TYthYe6oBuPK1/nwIMQw6UNINwVWyWpR2X/AB+q3FzPTXR5leoDBxDiFRdoBDitLMibHiGn7rp/1F9MF9XUObFy48Bc44vgs1NWudoIXO5K+s+kPGLHKpIixOnjkpRYb2VgqsNuNxwVkD2yFgY4KGopLxXt2VGuepaO3nBustOFVRwyUOabWK2flvm3/hc7GmpIsR9S1JjeuC5bsrHH1JWUdUCyRwsexWvjs4/l6/0Z6KZSeoaCnhiL6zYAfUth47ntRYlhh01IN2eV545fZhYsdEbJn2v5W4On+qMYrKJrXPebjyryTZ55P0hkbZW+orrkYp7gikve/dcvY+2oqK9z/Llvbq/AcTxkkuicb/ZYrNlNWSuDzROufso7KW0dvxnL00VrsxHouinme1hbffwt3ZYZYzYzIwmC9x4Vty5yeq31DA6id8w5auuPT1kq4viMlBzbskxcd/mMjyfyKn/FepFVkHkC8zQSOpB2+ldp5S5ejA8NjZ7FrNHZQZM5R0tHFC40YBDR2W78K6QipaUBkA2HhdRRQ2fNXkHkUXa47+mrcw8P04W9gb9J7Lhf1V9Iy1rqjTHyT2XojmJgBdSOYI+xXLOduWrsUdKDS3uT2UltDaJfH+YjVJPZ5i9Z5X1U2IyEQfV4VBh2UNW+1qf+l2VjmQnv1T3Gg7/lVV0/6eGvcA7Dv/isuzDbZ61j+URhjpbOSMPyPrKggfhN/wBFk2DenWse1rvwf/xXZGA+nKHU0/4cP9qz/pr0405Y3/8ADR/tVjHwWc1ynksbJdM4s6W9PVfHK21Ef9q3flZkRW0r4y6lI2HZdQ9MemyjFnOw4f7Vn3TuRtPQubaiAsPC01gv17OPyvI1U+mae6VymnjomNdT9vCkxrJ+SohcDTX28LpTCstoYIms/C228Kv/APs0pphpNKP4UbwWzFu8qf8A/scN4/6fZaipLvwd9/yp2B+nlzZNP4If7V21JkvRznU6iH8KWjyXooHgihH8JFgNFKflCa/2OQIvTm6Ru9GP9qr6D02N1h34IX/9K7Fgypohb/hG/wAKvpcr6Ftv+DH8LQow2l8M7I8jU0/2Oa+g8izhsrC2lAsfyrefQXR02H07QGWt9lnWF5e0cThamA/ZX6k6XhpGgCID9lr043RyWfyzm32UPTlE9lhIFfG0g1iwCdTYc2P5GKrhpng/E1WVW4s5e7IlZL22RuomPjsQFj/UPTkNWwh0YN/sssEYA3CpqqlZIPl7p0obQleZOqXTNTYtl3RTOcXU7T5+FUkGV1CHaxTN/wBq2rNgTZuIwmDBo4G2dGFiZVDkbWPzdkOtmtRl3RNFvwrP9qgqctaGQb0rOPyrZkuGQk7R8phwuE7CNZP+K2zSjzl332NWMyso2u1Npm/7VcaHoaOmcA2MC32WxG4PG4bxpzMJiBsWD+FpY+G1ISfN2yWtmM4f0uQwWZ/Sr2dNuLdJZ/SyWloWMtZirI6KItvoWs8f9TEnyln5X2YHW9Gxzt+KMceFjuPZbUkrHF1O3jwtuzYfEBuy37K2YhhsT2ke2FRuxdl/F5u6ElpnPnUGV1M8uYKdv8LDsVyThmJcKRpv/pXSlf0zDLJq9kcqmf0bTSDT+HCghhM3oeRT19OaKDIqBs4caNvP5VnfSmUFHTtb/wAKy4/0rb1P0LTNIP4cfwq+HpqClbtCApY4qihs+fsl/TCsJ6DpqUACED9lX1nSkYpzpYOPCytlHFGTeOyfJBDINGhNup3BpFCfL2ufs2ad6u6FFXC9piG4PZaIzPyK/wARDyKUG/8ApXZ1X07BUsJ9oG/2WOY1l3TVjTemB/ZYf+A3LejewfI3DXZ5qZhelx9X7mmhG5P0LTXV/pJrfdf7dB/8V6u47kzQ1BdehaeeyxDFfT7h9RIS7Dm/7VPDA/8AR2eF5XpJex5I4/6SsYD/AIaA8/kVBH6VcbhbcUTtv9K9YMU9MOGVG4w1v+1W2X0uYYGkHDG/7U//AAXr4dFR5ZXvuR5YH0y44x1zRu/2oOQOKUjbPpT9/hXp5iXpkwyMEDDm/wC1Yb1L6cKONh0YcBsfpVaeC2+0dLheU1PX7HnHiGU1XSAgwkfsrVU5d1DGm8P9Lt7rD0/hr3BmHnY/lWC4rkW+J7m/gDx+VUrePZ2PH+VVR/8AI4i666HqIY3ER8DwtbPwCeDEgCze67gzCyLndC61AePyrTOO5FVkVfrbh7vm/KmV4LTJs/yqFlf0rfS5RTR4nT7cPC9SvSkHihgB8BcAenjK2rocSgJpHCzxy1ejfpmwR1FRwh8VuOy18bF9Txryrl43RlpnV/RULvwkZ/0hZnhdKbDZYx0VBeljsPpHZZthsAbGCR2W9TU19Pn7lbk7GxtZBaL9lrHNeImglA8FbRxOQNit9lrnMGA1VNILKxNL10N4iT/KmziD1HYfO8VBaDwVwvnnSVEU8ocD3XpNnn0caiKocYb7HsuEPUx0s2jdM8RWtfssLNq9j6T/APx/kKMonG/VoIqHFw7lY6Kdj5Cbq+5hVbaWse3izisWocUEs5bfuuXyqNbR9gePZieOuxmOU2mI2WNthnFe0MPdZxV0DqyL4W32UGG9FT1eINLYSbnwsWVXq+iLnsyMK2zc/pawOesqKcubfcdl6K5E9H6MGif7f0hccekzL+Zk9PenPI7L0Kym6fGH4HGHRWs3wpKoJPR88eT8tNWNJlB1TCMNpXbWsFz5nR1WYopmCW1r91vvOXEWUFDI7WBYFcWZ8dcGKWce957q1v1ZqeFYssySbNP5v43+Klla6S5N+60N1HCZaouHlZ5111JJX1LwJL8rCpAZ5buF9+6zMmabPdMXDePVot9NTvDL24VHWPkidb7rJYqRnt2sN1ZsXpm+5YDusxNe5pVf/wARe8v5nS1jGkrr302dPtrpqdzo73suS8tcPc7EowWHkLu30odNl34WV0fhauC0meX+b5f4qmkdZZL9GxQUcMpiGwB4W88AqYsKgAG1gsDy4o4KLCo7tAs0K49UdXU2F07j+IDbDyuwxLko9nzJycLOQynBIyPqbMumwuAl09iB5WpesvUpS4ZM8fjrWJ21LV+eGeTMPp5hHX2sDb4lxvnH6lauKplbHiB78FXlkIkq8Xk0ujuio9ZdDRyBn+JcH86WT1w4dFFY4n2/OvKbHvU7iImJbiTufzLHcR9UmLi4Zib/APerEcpEtniUor/U9b//AL9OHOfpGJ//ADV7wD1mUNfO0DEb/wDvXjVSeprGHyX/AMSk5/Mtg5c+pPFX1DQ7EX9vqVmu5Mwszxx1pvR7X9D+pCixSOMNrLk2+pbh6DzKgxEMtNck+V5KZIeoiqmdC19eeB9S7AyOzxNQ+Brq3kjkrQquWji8/iXHfR33gmJx1UQeHX87q8slaWW+y0/lzmJS19JHqqgTYd1sSixuOoYCyW9x5VmNvRw+bgyrk3ou7iDIqqFoazZWynnL3aieVcIpw5gAPCkhPbMG32T0Tg2N04PBNlCx4vYuT2ncEeVfqkirL6StcG8p4FzZRqThWBkfo+1m2+yYntdcfEU19r7KNr+FqI1vJ/VKiw8ISLpEgIQhK4tjEtgnNcALFMLgDYlGpvlJ6aBpolQmtcSdynI0kICEISgCEJCQOUDWxUJA9p4KNQva6AT0KhCECp7Ef8pQzj90qLAcBAoIQSByUxziCSCgP6PQow8u4JS6nDul0xdMHcn9UrXACxUesl3PdPDSdwE1vQg9CEJPYAQhCPYAQhCPYAQhCPYASFwbyl4TXkHgpwChwJsEqY0gHdPBB3CABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEE2F0Jr2m5cmP/YVCanHukuByUJHgkbJ47pCF5B2slaSRcphBBsU5rgBuVIvgbQ5CEuk2vZMf0G1oXWfATlGpEyQwY/5ikT38fumKLbEb0CEITkxu2CkUaX3mp8RAdyf1SJDICb2QCCLhSpoB7Of2TZXkApWkA3KbM67T90muxsn6rZE6W/KjbKQeAkcd7BRX3uEya12QK5tlXFJqcFKqWB97DdVLb8lVZdFuuWwe4MFyqOrqwDa/9KqmYXNNvCtVeHB91D7tMsRSZMyoLtweVMJSRubKgg1D4iU+WqEbTcqWEixGtvoWsqvb+VUFRiYa03IVNjWMR0kRkeePKwvHuvaen1OMlrfdR5E/WJq4mDK1rSMgxXGmxAknj7rBescwY8PheTKBb7rFes86aCkjc11RYj/UtDZu+oGihp5dFZ5+pYl+S1H6eg8J43ZfJNxMqzd9QjMJhmtUgWBt8S5Pzc9Xpp3yMGIAWv8AWsHz79QLals7Yqw8H6lxXnLnBXTVUjo6p25P1LCyM1f9PYuG8T9ILcTf/XHqhqMdqnwiuuHOP1LG8MrKjrWuaSdWorlzBcwK2vxFodI4/F5XSPp7xmCSpgdUv5I5KzHk+z+naQ4aFNetHQWT2Qf+Jyxzvpb3t2XWOUGStDg0UbnU4FgOy19kRi+Bso4yXsvYLfWD9VYXSUrXNmaLDsVZquWu2cdzVFtfUUZpg1FQYLTA6QA1vKxzMnN3Den6B5ZUtBa0/UsZ62zdo6OgfHFOAdPYrljPnOatkjmZFVON72sVYd7n0jjZYcpblL6XPPD1dijqZYY68D4j9SwLoL1R1WL400Nrybv/ADLl/M/G+o+o8Uf7JkN3FX3IjpbqP/F4pJYX/ODup622c3l1+kuz07yVzCq8fpYi6Ym4HdZ715h78QwR7uTo/wCi0/6YMGrI6KBs0ZBsOV0NieCk4Vpc0G7OFP6uRo8XbGuaOAvUr07LHLUXYb79lxrmlh8tJNI4g9+y9LvULle/ExPOyHYgnhcQZ8ZZVFNJKGw9j9Kzr4vs9q8dyIrRyfiWMPiqXRknlFHO+pdqtyq3rPpOqoK57izhxVFhMraZ/wDmDhYV8Wns9q4ZwtiitmwOWsjuGf0rBjfSczASI+3hZzhuJUZjA1D+VLUU1HXg2ssuc2pHbvEptxtNGm8Q6fmjJsw/srTLh9bTSh7S4brb+JdKxOJIaFjeM9NRsBs0KavMcemcXyXj9du2kWnpPrKvwuoYDKRb7rprIPPCejdA01PcfUuVq3CnQyksCyjoTHarBahjy9wAPlWY2pvaOD5Lgox+o9V8l8/pJMOZG6pHA+pZp1B123qGlcz3L3HlcFZMZyFjI6d0x5HddH9DdcnEIWEyXuPKfLcjnKeLVd+9Fszg6OZiUcs7mXvfsuceuOh20873Nj/pdjY7hwxrDiQ0bt7rQecWCxYO2XWBexVC6rcT03gJRr1E5yxalFLIWEcFULpWuaWp/XWMx01W8A/V2WP0uOCVxF+6y40tWHpG63SJ1BTawSAsdp8AdXVoY0X3V9xXEm+2QSOVVdDRR1WJN1W5W1jUvpHCc/dCMGbAyXyjqMSliIgJv9l1Fl/6c6qrpowaM7j8qx/0wYHQ1NXTsexu9uy7yygy+wyopIHew03t2W1Vjex4pzHJqmbls5qg9J80rQ40Tt/9Cr6b0hGQA/gHf7F3XhWVuHvibalZ/tWSYTk9QyBp/Cs4/Krn/wAfJ/w4nJ82/AnqRw70X6TDSTscaA7H8i6AyqyQjwV0YNKRYD6V0Fh2UdBFYtpWf7VfKDLuKmcHMhAA8BPqwVGe9HG8p5rZkpx9uizdFdJR4fAz4LWHhZpTYa18WgN7KSjwr8OwR24VyoacsIDmrYqpailo87zeRlfP2bMN6t6TbVwu/wAvsVqfrDKdmIPdqgvv4XSFXhjaqO2kKz1nSUTySWA/sraxfZljj+ZdH1nKdbkJE6QvNId/9KrMCyLgj3NMf4XSNR0XA7YRN/hOpui4oT/4Y/hJ/gbl2dCvKWoa2aTwzKKnhcAaf+llmD5bU1NGHCHj7LZUfSkYIcIxf9FVx4ExjNOkK3VgpfwzL/IZz+Mw7BekoIRYxf0r5B07AwCzP6V5gwsRO+UKriw47GyuyxoqJkZHJWWS22WqnwJmn/w/6UzMFax27Feqena3ayqBStcbaQonjRRl2Ztj/pbqfB43Mvo7eFKzBo9diz+ldoYmxADSE9zQ9t2hNVEUUZZk9/ShjwSAi4b/AEpYsFivwP4VVE1zeSp2OsL25VmumKK8smf/AEp4sKijtYKpbh8bhZPjOo7FTsYRuFajCOtFWd0pfWUf+HtgdqTvZHIH9KslaHN3CayGw3smyjH2Gq3oon0znfKFF+Gde7hyrp7YHB/pRSNA2sk9EhJTUikZC1guWlQ1dKJjayrnNHN0x7dXH9qtZj+w+Ei3HDWtG6jdQsbc3KuMrCBuqeYbEBV1iR/4WY2eqKeOnba4UseH6ydv5T6Vh1XIVyp4mWvZW6seKGzydFNDhzAN1KKeOM2J/tTyM0t2KppA4HYqw4JFf29ntsSWnY8fCd1TS4ZqB55VSwuvyqgMuLqCVUWxVd6/0s8mDMdyE1mCi9yCrz7QJuUSNYxt7BOjTFfwcst/NlsbhcbeR/SZUYa0izQqyaoaHabd0RkSDdMlWkvhJHIl/wBLNNhPxfCP5UJwgh191f304b83/NRvgHIH8qpOtb0Tq9tFrp8PAFnJ0mEROG7eeVcBFvbSnOjIGw/tJDF/9Cq6cfjLBUdO07gTp/pUMvSVK9xOn+lks7CAfsqWTUCfhUv+PFfwsRz7a/8AyMem6RpGgDR/Spajo2lcD/lD+Fk+7zwkMZIIISfij/wmhy9kf/I1/ivRNMQbR9vCxbGsu6ecOHtf0tvVWHGV1wz+lSv6eEzr6B/CgnQpdG3h+Q21fJHOuPZLwVL3O/DXv/pWLYr6fYJCXCl/+K6xk6MjkHxRD+FST9BwuveIfwoXhxkdBj+YTrf04l6p9NUNWxw/Bk7flWB1/pBjqKnV/h53P5F6D1eWdPL/AOQ3+FA3KeiuCaVv8KL/AAf/AEaEvMlZHuRxB0J6WRgtU2QURFnc6V0TlXl4cIbG0REBtuy21HlhRx2tTtH/ALVcMO6NZROs2MX+wU1eN6nNcnzv509SLh0jTMp4WNPYLKqeRrIlZsKwmSnAcf4VyEMltldjUzhsjJVlnZBi1RqBsViuNURq2OBF7rJMQifqsT25VI+gDo+OVFOLZfwb1Ds0bm10ZHU0M9o99JXAnq46FkgZOfbPB7L0969wISUsrtN7tOy4x9WHQBxOnn9qD6T2WdkV7R7Z4LyaU0tnj7nTgjqPEJTYizyta4ZL7ddpJ7rqD1F5U10VZO5sOweey5uxbp2rwbEXPkYRZy5/Lq2z648Z5RfhW2Zv0xRtrIG6m3utlZd9Dw12IRh8Q/haq6Kx2OJrWyOAtblbpyv6ooxWxkyDYjusG2rUixz+dGdL0zrv00ZcUlIyCYRDgLq/BKWGgwgNaALNXLOQ2YOHU1NE0zN4HdbprM2aGLDNLJ/p8qKKUH2eE81h5GXkJQ/6Yf6jeoo6WimAkA2PdcB5+dVtkqpx7vJPddMepXMyOupJhFP2PdcKZw9US19ZLE2Qklx7qKc+2eyeA8YseMVIsc9a2tnLg66hEAG4VvwH3C743cq5VTvw7NRKxsizb0ev3VwVfRH79pPb+yT/AAs1cosDuVSQ1Hu1I37rM+jcEdidQxlr3Kqa2zGstVUGZBlL0Q+oxCJ7Y72I7Lu302YJHhdHCHtsQAufsnOgPwjo5nxc27LpvLyFmE0rJAQLNWjjSaPKfLo/5UNI3g3rJuCYTfXaze5WkM7PUQMOjlYKoC1/qVRmPmOyhwqRjZSLM8rir1EZtTvqJmMmdyfqW1Vk+pwPHeOOV6k4lZnN6hJcUlmiZVg3J4cub8wuqq3F5JHtkJvfurT1B1jVV9a8vkJu7uVDTSCtaBJvdWP8z9fp3+L47H1W4mB43NibpjzyrRJFiUj7WK2biPTsE5uIx/CXD+h4Z3D/AC+fspacptljL4KuNe9GDYDgOJ1Bbdrjc+FsTozp7EqeVpDSP2WUdKdBU4c0GIc+FtrobKIYg9hjpwf2WxRds815vArr2LlDLiOHOiklcQAum8qszJMJdE4VHDh3WvcJydqaehaYaexDezVRV7MQ6Ufpk1DSVp12s8v5LErk2kjvHKT1CuBjh/FjsLal1FlZmW3HIYw6YHUB3Xkpltm7JSYlHG6oI+IfUu5vS1mYMWbTxmYm4HdXa7dnActxy09I7iwipbUQNcCro1/tndYp0PiPvUEbib3CyYP93f7K3XN7POM7G/HNlTG8kqph3AuqKJ2k7qrheCAAtGma0jFmmmTp3uHuE2N4SganHdX000RJaAyW8IEhPFk2RhvyhrdJvdDXRZh0kSjcXQmmVoSe809lHtEo9CQOBF033d7J8RIpg/5ik7Ik+LjwmEEbFOB/CX3D2CfG+4AIUDOVIxhJBTf1I9pEyEj3tYLlRiqZe100btkpNhdRySiyHOD7kKGYFouUAvoCUg3AUkcjiQbKldKCNglinsQE9fAf0rmuuLpVDEQ4beVMmtaBb/gISP8AlKYkHiudflMc/tZK/j91G4XFk9LoctDg4t4T1GxhtyOU5rSDcofwcAYOfupWH4Uwbp7OP3VaW9kYqRxsLpUj/lKTYCaz4CNZ8BNSax4KdvYD9Z8BGs+AmjcXQlAdrPgIa8k2SBpdwlDS06ihfQHO4P6KNOLwRZNUgAns+UJic14AsgByEgcHcJUACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEAI8kDZNLidiU5/H7piY/wDYVPQIQhPBvY1zSTcBDWC3xBOQn/wZ7PYJ43bt4TWgE2KeBYWTX0xU9jNDvCehCZIUR4JGyZYjkJzn6XW2SFwcbhR+ojWxEIQlS0J6oE0sFtk5K5ukXunJ6F9URkaeSP5SB9tg5Eve6Y3kfqnpieqJWuJO5SSbhInvA038Jyl2MsjuJSv+ZNLAeB/Ckc0EoAA4RPsoKLUhYo7fEApmHsmNAASkgclVpQLcG0iRUlZTB4vp/tVHuE8OTiA9tioJVlqqxexapIfbYbBWjE6oxg3Kv9fHoY6yxXHnkA2TH+vw2sJKyXZivW/UAhpXj3LWBXP+aWZL8MbLpqbWB7rbOZE0opZSCuS/UNjNRSQzkP4aVQzbPWvs9J8b46GRcka0zl9RRw0vBxC3P1LlrNn1QzVAljbiRNyfqVk9TmY9bSVErBP3PdcodWdeYhX1b2mYm7vK5DLy+n2fSHi3jVMlHo2b1pm3V49JI1tWTq+61T1TSYjjE5cbkEqo6dfUV0gdJuszocAglhD5GAkDwuYvzP2+nrtHj9dda0jAsD6Z/AETvG91sjoTr0dNyRu962kq1Yzh8NNEdLQPFlg/UOKT0jyInEW8KOq9yZUyuI0n0dlZZeqz/DQyIV9rf6lujAPVfLXUzWjECfh/MvMnpjqzFG1oAlOx8rfmVeL4pWsja6UkEDutOufRwPL8Su9nXOO521WLxEMqidQ/MsJxGmrur5yxwc4ONlR9DdLYhi5jBaSCVvjKvJiSpqI3SUxO4+lauMvdaPMOVjDETNc9A+lKXqSpZK/Dy7VvfSugsrfRY2hMU4wu1rfSugckclKGlp4nSUg2A5augOl8vMNpYGAUw48LYppcvh5Xy3IxhJmjst8lndM07dNNp027LN6jA3yU5hdHfay2nP0vTQxFsUQAt4VkrsAax5sz+loRx2kZ+Ly6ZoPMrL78dTSsFPe48LkzPjImWqMr20Xn6V6I450uypjcHR9vC1PmVlhT1zHj8Pe4PZUMrHUT0XgPJvxtRbPIHOXIqqpHyvbQnn8q5+6s6PrcHnf/AMO4WO+y9ac3fTyzEmS6aInn6Vytm16WKh88vt0LrXPDVzmTTrZ7z455VW4pNnENPU1sUmgsIV7w3EKiw2N1tjqL04V2GzuP4Vwt/pVimyrqcO3fA4W+y5zIg4zPVcHn4WxXZixklljuW3VrxOjfLf4Fmr+mpIrt0Hb7KirsDcxty3+lWSezeWTVfXs15VYKHOJc1QOwp8PxNBAWXYhhzWm9uFZcRmZFeMcq9R9OQ5hVqLZdsvcZkoK9jRKR8Q7rrvIjEJMTihYXXuB3XF3Spe7E26R9S7F9LlPPPJA3STsOy04x2jzzJyq6p/TpfD+npH4RrbHf4P8AoudPU5htVTRzPMZFgey7L6V6YkqcBaTEd2eFoT1T5dTVFFPogJu09k62jcSPj+fjXa+zzZzCrZDiLmG/zFWnBHy1Etg0m5WzOvspK+bGX/8ADutrPZS9FZJV0tQAaZ3+1UY4y9zul5TX+FdmvsQwmqfHf2nb/ZXnL3CquPEBeB3IW8aH05V1dA0mjef/AGrJOkPTJiEVY14onjf8i2MXGXRwnkHksJprZl/pjZNTVdO8xkcL0CyJrxJSwMLfC5cyWyKxDC3Qu/CuFiPpXW+TPRdbQthD43CxHZb+PjpI8X5vllbvs3z0zTMmiaTHfYLO8Ew2L22/5XZYv0lhkzIWgg3ss7wWlkaxtwdh4WrXS2eQcvlL2emVVFhbLj/KHKrzhTQ0Wj/pOpontsbK507NYs5TRxkzkbciW97LWzBgTct/pStwtsYvp/pXN5awbD97qKSQONrKaNCXRVeRN9lF7DWfCQon0olPyKtfCX7hDKZzdyFarqQRytMoDh7b7sCVuHsP0gKvMdjx/aPZd2H8q5GnfY55nX0o2Ye2/wAqeMPbe2kKtERI2BugROB3HCkjWkNjkt9bLe/DQDcNT2Ug4LFcTDqHH9KMxva7YIml8H/5Da0UzKNoA+FTx0oB+WykaxxtdPUXqiKdrCOma4fE1ONMBsAnN+EWCe03Fymfj7KllkiD2EGIAbqc6Tyf7UZAIsU/1RX/ACyTGD4eFIyZwFi5JoHkprm2OwKcuhv5GPdOG8kJWz6uD+yhcxx3snRRkWSaI3Kb+E7HAm6c9jXDhNYw2snuOkXT1omrc39IjGLFMLGtNiP7RNPZRiQP3upFBMuwi9D3RB4sAmPpLjhSxyAbHwpWFpN7odcQk2kUsVNoPCqYxo5TZCNQIH9oMgHCNJIoWSknsJpHHYFRaS7dPB1FTMY0NUM0SKe0U7Ybu7KYCwsnODW72/tN9yPwo19GNNihpPCZK3axCka5um4/hRTSkmynitroPVlK+Bjn7hTQQANBt3Ubj8V1NTvu3Sf5TJxZNDeyR0IcPlUZp2825VTceVE/bjsVV9G57JlJoj/DN/8AopXwR22al1u8p43F1Z/HpCOxopZKVhBNlTVFG12waq8tJHCjdH8XKa0kV52SZb2UTGnZimjw9knDVK+Ej5VPTMLd1G0kMj7NkAwph2I/pJ/hbYz8quDTZl7cKN8mrkpnoi5CUl8KcUcdt2hMkw+M/F7Y4U5fvwh0xDbWT1Wv4SuyceykfRxC3+Won00N7aAqiZ7+wVOfcce90OsYsuSBtJEdwwJ4oI3G4YkiEgdYhVUQcHbj+kigtkc8qUuiNlIRYaBZVDaUGP5Rfypg2zAU9hGnlPcNFdSbZZ66h1OvpULqTTHbQrrUWvuFFKxpYVWsgaFFrRhvU9D78b43N7LQedeX0OJ00rfw4JIPZdHY7FqDgBda86ywMVTHamX2Kp2V+0TvvGuRli3Rls81/UJ6f3VPvytoLi5PyribOvJabDKqZwoyACey9jM1MuYq+llBp7nfsuPs/wDIY1rpzHRne/0rEyaGz6T8e8ojCpfseZtbhtVgs5a2MiyvXRXWFZRVjd3Dfyt59a+mivfVP0UTv9qxKL05Yth83ufhH8/lWJfR30buX5HG+OtmcZa5zVWGwx6pyLfdbBk9Qc0tLodWnjytJuy8xbCWG0bhb7K0YqMWoCWOLtlnWUFbDy6rbE9mZZsZpuxSCRram9791zt1ViJr65zg+5JKyHrDGasNIcSsEdUyTVZLr8rPtrZ6rwWfXQk0y74SHMeCVUYxK72fiPZU1JI+wICgx2ue2Ej7LKtpbmdquWhOH0dg5EtU1pPdbxyY6aNdVxOEd7kLnrpzEpP8SY0X+ZdYemalNdNASy9yOyI4zOU5jl41dbOiMu+jHwUEchh4A3sssq8UdhFOWatIAV86RwMtwhh9r6fCxnMuB1HSyOGxAKuQq9I7OPqy45+X6SNW5wZgtbTyRfiOx7rkbN7FnYlPI4S3uStw5z41MKiVuvi60N1VMal7rm9ymOTid1hcXVGHto1vVwyGrJ+6vWAwuOkvH8p02FB85Nu6uVDRsgivxZMdrR0VGNBQ20VjKSN4HwhXrA8Ka5w+BWCCs0zWJWc9DUwr5mNte6sY1z9jD5iUaq2ZH0X03JUVLGtgvdy6kyEyqkxF0d6I72+lYBkrlhLi1TC9sBN3Dsu6fTlkw2khhfJTHgfSupxJNpHgHlXJRqcuy0YZ6fycJ938D9F/lXO3qTy2dgTpXiDTa/Zel8PRlNTYOWmEbM8LkH1mdHwe1UFkfY9lq9pHlC5SGVJ//wBTz7pcdnwnqD2/cLbPXbfoq62llqKZrpz27rizqzp19P1I46dhJ/1XTHo/xL/DKunBcNiO6s1S7I82qNlez1aypxdtThUBdJyAtkUTmPbsQdlz3kv1e2TDII/c7Dut29NYoKmMOJWjXLo8s5rGUbXJF/jiudVk/X7e1+E6mLXjnso6sFuwV+mRx9kOxwqbcFVMMpcLq2xlxcL/APJVsBItcLVqltEHp2VLmvLdaheXg3VTHI3QA7woKmRrQknImr+lNJM9o3TBUuuP/wBCJ36uAo28j9VXdiRK47ZVR1Lv2UrXX3vuqaMb7qcaWjVf+0+NoKOh9yTfuk+JxvZRmcA2UsT2uCf+TY2aJY47cj+091o49X2SXHkJs5D2WB7JfYhaRRVdYR9SpBXHXfV3UtZBJ4VB+Hfq47oTbGF7oqj3QBdVL4tbbEKhwyNzOVck4WP0opKQg7D+1GWCPcq4PNgqKrZe9k6LHNJiMqrEAHuqmKfU35lbmg3Gx5VXTh1hsla2CWioMl9i5RSy6XWDk/2za/28KCYEu2CRJCj2zarglPZYlRRxE7/9FPHGLjdLtIBQPAQQRyE8AAWCa52rsm7bF9mIE9nH7piezj91Xl9EFSP+UpUj/lKQBh2BTGgE7p5FxZIGgG4T0tALwjlCVvI/VKA5gIvcIcCRYJUJyQEZBBsUJX/MUicAI5QlbyP1QA5gIvcJUIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQgmwuUx/QBRnc3TnO32Kje4Acp4xsckc7SbWTBL90atW91Ivg32RID3T2/KoWvtyntdfcJj+gpIkQmayjW7ymSJE9iOAJNx3RYDgJjnEO3KLnyUq+Ei+D0JjXWO5TwQdwka2xQAubJ5IAuUwmwuE0TanaXFNEa2OfZ17Jvt/dO5RYngJvsHQ1rSDcpJ7hl09MmILbXSprYNbWiBrx3PdAcXFMHJCljYD2UyTZGqEPaABeybLcglTNHw2ITJY7g2CdpfCOyPquiCMuc6xKna/QFHYNPCHO2sVHOvUdleFmpEde7XCSsRxrdxbbusxmhL4T+ixnGaOzybXVC1aOk4yxJ9msev8ADzPSSEDkFchepvBZBTVFmH5D2Xb3VWGiSkeC3sey5m9Q/Rb6+Ccshv8ACeywuTk1WeseK5MY2pnkP6rMEq310waw8lcxVuAT/iyHNPzL0H9TmVb5KqV34Tuey5N6x6F/wuoe409rOPZcBn2tI+qvDcuuz1RinR+C6A24ss2hpRBTX+yxzD5PwTw0C1lW1GP6Y/b1jcLlbbZe57zg0xtrWi3dT1RGpoWDY1RPqXF+nZZfiwdUnWdwUymwFtTBq0K3jTY/K4qPq9oxXpTAi6uBc36gukMlsHp2yQtcPC03RUUWGTay0CxWw8uevYcOr4mGYC1u63aHtHkflFKx4y6O8/T/AJf0mJxQEMBJt2XXmU+UUDGxyewO30rj30f5jUlc+mifM03cO69DMpKqkqqGJ7NO4C6Xja1I+ZvLspr2aM96K6SiwynYNAFmjsswoHxwtDLDhUlCxraUOb+VIwya7g911FNKTSPDM++y5tsuswZI21grZW0IvqIVXC552JKkqYg+P5ey0VQtFWiyUEmWGpw2OVh+EbhY5jfSMdWDeMb/AGWaezYWIUNRCyx1NWfl0o1sfNspkvVmmupsq6WqY7VTtNz4Wo+vMiMNqXSOdSs3/wBK6hx6SmhicXALVfXOL0ERfqLVzOVXDs9B4Dnc2M1pnIGZHp6w/wBxxZSN4/KtEZkZINo2vdFSja/0rt7q6ooq9ziwA7LVPXfTFLWwvPttK5XKrXse5cHztv4k5Ps4S6n6BfQPeDDa1+y1/wBUUzKEFpYur81OhooRK9kIHPZcz5pYU6nmewMPdUHDs9P4rm/yV/TVGOYi1hcB5WO+xNiFXZreSr7jWGyvmLdBNyr/AJe9BS4pVxn8MTc+Faoi9D+YzI/h3spegOhaurr4yIT8w3su5vSZllOJKd0kPYdlgmR/p+fXSwyGgJ+IfSu4cgMkzgsMT/wVrAdlrVQbPBvIOc/Ba+zYvROX7WYHG0xfR4Wus8cpG4nTSt/Dg3B7LpfpvpwxULYfat8KtHWPQf8AiAINNcEeFdlWnWcRT5Far2/Y82urPTYJ8Uc4UQ+Y/Sr9l36YR+IYXULeRf4F2TWZI01TVhxoRufCyzpHJSipWMcaFo47KpXX+3w135bKMO5HPnSHpapp4WB1E3j8iz7APSnRRPa/8Ez/AGronpzL2CmDW/hQLfZZfh/R9PGAfw4/ha1FbOR5Ty1zk1s0d0n6e6LD2MIo2i3+lbD6by2p8MLdMA28BbGpOnYGNsIQp2YWxjrGMcrbx4xSONyOesu2tlvwPAo4gBotZZPh2HxtAbYKCmowxoc1v9KoZU+zyFpV9nI5+e5MuDKaNoAISSaYuO6gZWkjlMMrpjubq3BJlGM1Jb2SPn1AojBkNgiOnLyFVU9IWC9lIoa+EMpPQ+GnbpGoJXwx2sAnEuaopHOPyqzXBFSyzSENMCeEoiYDZwSNeQNykLze4VlLRHXa29ErIALXGyf+Ha7cNTGyEjSVKxzg1MltFqM+gZBp7BNMLL7hP1u8pSARdvKgbbHqRA6MB1gUntAcH+k6S7Sbpup/5f6R6sek2OsDyEEbbJnxDyE5t3NsnJaElDaGAXNlI3gfogAk8p4AHZDTZBKrY0MJCPbvzZPOwummUNGxsm6aHKoX8P8AZJ+H3vZLHMXGwcnBzieUg9Q9RWsDRxwoZpNlUO4P6KCWPULNCdEWPXZQVbyCbJKYl7FJPTOvYhJBGY+ysx6RKrVrQ5odfdOL3NHKd7bhyEphJbuEraYSsjojEhd8yXe6QwkC6cGnuFXm2ijbNMkjbpGop3uDwVSzVrIxpDlTyV4H19kkluPZXWRFMrZphwFGwu1f/rVEytEj7F3dVlPKx4sVDrsswtiyZjnFtiUPjNr2UzI26NknCnrLcZRXwpQwl37qaKMt3SPa1punRSDupmuh0nFLom0C24THMtuQEGQjk/0klluzYqP0TZFGak9C2HhH7qmEpBsT3T/cJ8JZR0SSrf8ACoJbawSCMO3NlA15J3UjZHDa6rzInDQ/2h9v4Q2JrNwjU490F5IsotbYqjoa+Qatgo5nA2spC0HkKGcOFtilXRNHSERYHa6Zqce6BrI2UkUK0pIkbAD2ThSxg3ISRF9uFKNRdbsietlWcWNEEYN9KfYeEOa7gcpmh54amECgLK/Qz/komVGrYFE5OkNsomtIF2hSfSWER08m/N1E992EAJJy4HclLENYUFkUWopJdFsrYi8kkKwY7h8cjSNI422WXVlGHN2Cs9fhUshI0qBQ2tmzg3qD3s1f1J0oyrY4GMbk9lqjrfJeDF3PBpmm/wDpXSVV08599UattR0jFI46oAqF9Wzr8DyGVT0mcdYt6WqOqlL/AMC3/ascxr0mUZiJbQN/2Ltyq6KprXNMP4Vor+i6Z7SBSj+FlW4+zoqfJnP+nnZ1/wCl1lHC/TRjYflXP2Z2RkuHmTTS7i/DV6qde5ZQ1rHtbRg3HhaGzL9PwrQ8ig5B+lZdtGvp0vGeQtTXZ5Q5hZa10MjwIDsfC15UdEVsExJhPPhejmYvpbfLI9ww08/lWnurfTJPSOeRhx2P5Vl24776PV+G532iv2OT6Xp+eMfFH28K09T4cWxkEWXR2L5JVNDcGjI2/KtZ5gZc1dJq/wCGP8LOljP2+HaVc1qP01H03SEYnHcfVuu0vSFhbZZqe7RuR2XLXT/RtS3FGXpjs7xyu0fR/wBLVDZaf/IPIU8MX/0clzvM7l0zsLpnp6IYA14aPkHZajz0YKOCZtuLroPAcFmh6faHM+haJ9StN+FoJ3kbgFFlLjHWin45yXtm+zZw/nTXt/xCVgO2/dacxVzpH3HnythZyYrfGpYi76iteVxBi1hZVsNM964rJVlCZSMhabp03+WywVMKsiTRfe6lEnvu9sHe6pyXRvxsX4ylDnvnGkd1tvJPCpq2ugYWckdlg+AdKyVdSD7VwfsukfTxlp7lXTv/AAp5HIUuIn7nC+RZPrVLs6r9KeW8dUymfLCORyF3flT0JT0lJHohaLNHAXOnpk6OGH0tPeC1rdl2Jl/hwjpGDQOAu149JxWz5H8/5SyNjjFjeocLZSYU8gcNXGvqzom1Mc4IHBXcfWlCXYRJpb9K4o9VERgdOHnsVpT+nm/F50/ZHAeYHTV8ac9jfqPZbB9P5mw6viaLixCsPXEkBxZ4JB+JZhkvBFJWxFrRyOE+p9ndu5yp7O2sisdmNPAxzjwF0t0PiD5IG2O9guYMjqJzoYNDfC6ay/pJGRN1DbZacN+pwHNak3o2HhMhe0X8KpqGXF1HhMA0D9FUTNttZX6OjhrEvfRBFCCb2UzyGssUtO1p4CZWn22E8WWpW9IqtCslJFgopw52ypDi8cRsSnR4nG99y4WTbJMnrjsmFM8qRlGQASEsNZGQDqCl/FR9nhU5Pskakv4M/Dv8JXROtYodWQ3t7n8JRUMf9SbGzsT9v+EMkTgf0CWHUOT/AGlkmjaT8Sppq2OP5XKWNhHKLTK73TbkpWSXdYq2DFo/zX/dObijDx/zT1NNlaX0uM0bX7EdlC2hYX3so4q4SG9+6qopGnupIyRESQwiNospg+w3UbXttykc4k2BT9omj8Bs2rYqOYazb/mnOiIFwgN23G6kj8JV8IRCAblVEQA2sopHBp3SCpHIKUNIq9Q02+yZ7IedRTIpdZ3KnZwgYIyMNFrD+E5CTUL2ugY/oqjLtIunPd4KaQDykYm9MAbi6EIUL+kg73B2CahCEv6AIQhSJbAE9nH7prQCbFPAA4TtACEISgDuD+ijUnKa8AcBADU9nyhNaATungAbBAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACR/ylKkf8pTH9Aic4g2CZIdv1T38/smEXFlE5NEetkdidw5K0uaOUEWNkoaSLhNVktkb+j09nypg2Fk9os0KeuTl9HR+CoQhTaRJEY/5kiDcG1kcI0hy2CUPIFkiEaRJpr6OLydgOUnsgOvdDeR+qemSiiKTaACwslDiBYKMuOrYpQ/yo3EYpj3BoGxUMwt37qTWPBTZRqZcJi/2JoPbIGgOPClGlosCoSNJULpC0XJKsxaJ3plex4O1wnFzbchW1tU5pThVOITtJsrWaZXaGnhyjLGk8qOGRzm7lAJ18902XwqaSZJLKGR6PsrXWU7Zzuq6e9th2UDW6uVUnFGljWKCMax3CWTQua5aezX6TZUwStEd7tPZbzxmBxaQFhXVWAiqgfqAJssTk6k6ztOB5CVNybfR5+eoHJ6Cs92QwHv2XEefGVceG++9kR2J7L1hzgy/wDxkTw2Md+y4l9TWV74aaocYvJ4XnnI06TPqHwfma/07PNjrF9Tg9e+JjSA0lWRmMT1BBN1s3OXpQUeJzXj4J3stZGibDMG6Vy0owi37Ls+oOB5ON1a9WX7AmuxG0TwsljwyOkp9NuysfTDWxWeAr3iWICOC5I4S40dS2d1qNtRjPVMgpoXvYbEcLDML62q6bGmtEhADtt1fuq8RNQ1zAf7WAzxOjr/AHAOCt+hpJHlXluDGSfR3P6Os15qSupWGo4e36l6nem3NEV2GwB8oNwO68N/Tt1w/A8Rgc+Qizx3Xo16Zc/4Y4IIvxB2t9S6HCtcF0fMXlXDxcpdHqRgHVLaulY3UDdvlXujqhKAVz9lLmvTYxTRAS3JaO63T0ziQrYGOB+ZdPi5Dl9PA+Y45Y0mkZfRxMkjLinnRq0uVPRSOZHdRVVSdzey2657RzEK5N6JahsYJ0lWvE5hGw79k+WvawHU8KxY5jcDWke523VTL1KJp4uNOU0jD8xuopKOnkc1/F+65pzXzSmo5pGOm2v5W8M08ThkoJXB/lcc5/4k+OSd0bjye65HK9ts7nj8OdenomfnEJKjQZwf3UkvW9LXwfFIDf7rm+u62q6Guc1zjz5Vxw3MiqcwD3Tv91h20SlLs7zjMmdWoszzMqopq2CQMsbhc1Zm9Ly11W/RGTv4W7IsXnxwaSb3U9PlU/HZA4wXufChWI9nfYPLKmH05Vp8pqrEaoXp3c+FujI/ISV1XBrpHbkX+Fb16O9NDp5GvNGN/wDSt8ZU+niLD/ae6kaCP9K0KcNb+GdzXktn4mkyD0/ZEU1NTwPkpeLctXUHRuXdJQU7Wsh4HhU2XHQbMLgY0RgW+y2fgmFNaA2w48LUqxEjw7nuZlbN7ZZYcCNM0BjP6UgwBtU0l7P6WYtwVj2D4VJDgjWbhn9KSWM0vhx75Rp72YKzoiEy63R/0rlR9P09M0N0cBZPV0kdKzU4LHMXxqGlJBcBZVo1qMiG3lZuPbLhSUkERFrK6UrA/YDssLg6ugMlvc/tZJgfUFNNa8gVuv1RhZHJNv6ZBTUzri42Uxw7VvZJS11M+MFrhwqyCojc1aNM4lWOZ7P6RMpNAsoavDyQXgKv95gQ97HNI8q/CX/CGyUJ9ssLjNG/RZVdGCDd4UlRHGJbhvdMkcNtO1larlp7ZW/Il0i6U7Yg0O2Uj5WB1gP7VrZWOY0NupYKovdvur1coi++10Vsv/RRXHlSbEfqohE7VzwrcdaK9kWxr/mKQEjhK8EOsUrQ4dkvtorpNMdHtZSteflt3UQNjdSNO4KRtMnhJskT26QOUxCY4otKWkOcwEXG6j9sdypWcILAeNk3aRLGXRE6NrhZDYw3hP0O8I0O8JNoftC+390jm2F7pxcG8qMkgXt/abtjN6FtcWKgk3uE8u1G4TXNJ4SbbJY9hTtsb3U17bqOFpG5KWQ73HZC22I5dkhlBFtv5TPcHhQSzG/7JGT3O/8AzU0I9BH1ZO4h+1key1JG65BspCwvFgnfBskkuhjbE2KHvDduyaLxncqKeQEGw4SxW2U7Zskc5ru6jkcGtNyoWSnuEyolPskg9lIq1soW36XZZeosWbQhz9Q2+6xqTrlpkMesc+Vas0up/wDD2yAvtb7rT9XmiyGvLDNbfynxocpaMiWWvyHQ2C9QNq3iz/4WY4dE18QkJ5C0Nlt1qzEZWD3L3+63jgFR71Ex9+yLKFFGjj5Xsy7R7CwSyNY0arqFr+90ksjj3KqtaZr1WbQkxBOxSwtaeSqcl3nj7p8TnDv/AGptbiWk00VBaHcqKV2kWT2gvF7qOWJw3KiTfvoIRSkRXvv90ocRwmOYbnccqZjO11NP/Ut7WgBsna3eENjNxcqX2Li4sqUotshmxIXGTlPcywvdEUWi5T0KDZXc9MjUb/j5VQRcWTPbN9k700iSE9lKYrG1intj+EbFSmM33KUCwsmvok2gjiA2CeGgG4SR905JpSIpPYJHO0m1kqCAeQpYwRXlLspZgXBR3LdrbKrfGTwo3Qje/KcopDVN7KWVglUkEIZyOyk9gjhSxwO/pRyiizCb0M9oEXKpamJg3I/pXLRZu/ZUVWNtlBJaRLGcl8LZKA52myhfSMfc2VTI27tinNYRa6qWRTLtU5ItVTQ32t2VrrsOLTsFlTqdrhu1U8+GtduW/wBKpOpMu15TiYXWdLxVbS57OfsscxrLajq2kPhH8Lan+Gtta39KlqcIa7gD91VljxZpY/LWVv6c89UZH4fVNcTS3/Zaj67yApXmQNor8/Su0a7p2OZhBaP4WI9SdDQz6/8AKBv9lBLCg/4dhxnlN1bS2ee2YOQcVO15bRnv9K58zMyRkme9oo3bE/SvT/rfKSOt1AQN48LVHVXpyZWvcfwg3/0qlPBgn8PRMXyqTxk/Y83cHyEmbiTD+Ed8/wCVdX+mHKeTC/Ze6Ai1uWra1B6W2MqWyfgm7H8i2/ljkk3BYmk0wFh4S/4kEukYub5A7p7bKKHBTBgoj9u1m+FzN6qcPcaOoY1vYrtnHOl/w2HuYGdvC5c9R3Rr62Kf4PPZVMjGSib/AItysJ5W9nlznJ09KMamlN9iVrushcyDS5dOZ4ZdSRV8r/b5v2Wi+o+lX04cC3i/Zc/k46X8PpDhOTq/x12axxWqdTTkt8qq6bmlralpAv8AEEzqPDHR1Ja7zurxlzhLZK1hIFi4LHnU/Y08rmPRdM3Zkt0G7HpohJCTx2XaGROTkVE2CRsB4HZaR9NHTUdQ+EMjHbsu78mOig2lgc6MfKOy0MXHS+Hl/lfO6qemZ7k704cPiiHtkWt2XQvRb3sia0N7LXPSOBR0ULD7drFbF6arIqcBpXQ48fTSPlvybLnl3N/S69WVDxhcgLfoXCXrPxh9J+IcNtiu3+tcapIsHlc5w+U8rzy9c/VlM0VIjeOD3V9/TO4PG91to4z6w6sdNjzoy/6/K3N6boRiFXCb33C5ax/qJ1T1QWtPMn/VdX+j2gmr5qc27hW8eG2dhbFxp6O7sh+nWCmp3FvNl0P05RiniaGDsFqfJLBHwYbA5zewW5cMY2mjFx4WvCCUezg+WnqWjI8NcWsFvCmlc4ncKhoK9gaAQpqiuBaS0KaDSOJubUuipbIyIXJ4VFXVjZbtB5VpxPHXQuLbqgbj7TcucrEbUkT4mLK57KuuhBdq1KhfiBpT839qKtx2ANLi5Yj1V1pSUULnultYeVBfd6x2dHh8ZK9+qiZi7rKCmF5JQLfdUtRmRSR//wBw3/cubcwc+4MKke1tWRY/mWvaz1QRCZzTWnY/mWJdmSj/AE3qfGZzfcTs1mZVM+SwqG2/9SrGZh0pYLTtJ/VcRN9UEEYv+OP+5XPBfU3BUTNa6tP+5QQzp7+lrI8WVa/1O06Xq8VQ+GS9x5VV+MdUG9wudegs9MPrWsa6qBJt9S2v0z15Q4jGHNmBv91oU5Ln9Zh5fCSqW4xM6hpfdHzcqaOiLHWJ2VDheLwTAFru3lXP32PZqad1djN/TlcvFcX8B72U52Kq6SqDgLFWuVr3kkFTUmuE7qVWvXRjOiyMi8xzb2JUzR3vwrdBKS/Uqk1Nh/zViEmyzCp67JjKSLJRuLqmZKC42T9Y8K1B9dkrhodMzVwVTSEtdYFVF9Q2UZhJNyE/aE9eh1O823VbE4lu6oo4y0gWVZD8qNpkTHpjrAlDpBp3Chc8ajzylIn9JbjyhQ+4OwUocHcII9tiGQg22ShwI3KYlDS7hJ6rexPZ7HoQhGkSpsEIQl1ofrY9rRsUqaHgCyXWPBQAqCbblJrHgprnB3CBjbQpeb7cJTpdyf7TEJzSGqTHhoBuEqRnyhKmj03sEIQgcCEIQAIQhNX0AQhCcAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAJHfKUqHcH9FHICItB5CZwpEx3J/VQyGNaGOaSbhK0WFkqLE8BM/wDIbpCtFyngdgkDQDcJzfmUsHoVICxySxHIUiQgEWKsqQ9LQyw8Jj+bWUjmWFwmObfe6ciSOvo1CEJSX6K357KUgaOFEz5/2UwsW2umyIbPpTyb/KmgubspXNAFwon8prWyrJ6FYTwpC4abOUQdpSucC24Kj12Prk9jZXMAvdUFRLY2uFUS3cN/KpJoy51/+iPdLoupdDRLc/N/SniLSN1BHES6x/5Kphi08FKrV/SOVbfwqqZoA47J3tjVct7p1KwW7fupCwX5/hI5plWVT2QTBun/AJqidIA7Y/wrhUMGjk8K2vaQ/lRvsmpi4shr3Ncwkqw4rSGeN2lt9lkNRS+60/ooHYe32y1w7LPzYe0TYxLXVLZqDrfpf8VC7/J89lyb6ncvPcoagimG4PZd3dSYTE6Ii3Y9lz5nz0YzEKOZrY73B7Li+Qxto9Z8S52dNqTZ48+obLeeOvnc2m7nsuf8U6XlpqmzorWK9GPUPlAXy1EgpSdj2XH2ZfQzsKqXkxWsT2XH5GL+z6Pq7w3n3dGPZqyhgNKLHZQYxVvcwta7sqvFJhSvcw+VbtQrJNIKrwr9T6H4zI/JQjHcSp5JibNO6slXg7myGR0ZWxR082Rt9KtmOYCI4HFrLK7XJJGBzuN+WLMe6Vxv/B6thD7Wcum/T/m4KWeJv4y247rkPHHT0VSdFxYrLMpOuq6jxFjDIRZ47rXw7v4eHeRcMrIy6PZv0s5ptxH8PGau9wO67nyuxWKsw+FwkBuAvIf0Z5mTOqaYSzdhyV6aZFde002E0+qZvyi+66HGyEmkfN/lnESg5aR0RTPhEXzdlY+psYioYi8SABUUPWlF+Hv7zePKwXM7MKjpqKS07Rz3W9DJ/Xo83xONtd/7LoTq3Nmlwlj9VUG2Hlat6n9R1BHI5n49u23zLTmfmdH4OOcU9WODw5cn9ceoXE2Vz2srDz2cmWW+6O2wsOmCW0dn9W5/UmIRPiFa03P5lpXMLE/+875PaOrUey0L0/m7jWN1bYjO83Plb+yc6bquqhEZ2F2vysq6r2fZv1/iijUXUGWVdV1Xux0zjc+EmG5VYmCB+Gf/AAu1un/TdT4lTNkdRk8fSr/Tel6lZb/ge35FEsNzXwqWchCmfTOSuhcrK4zRh9M7nuFvbLrKXVoMlJ45attYL6eoaGRumk4PZqzzpvLOLDg0eza32RHB7I5+QquP0xronKmljjaTRjgdlsPAugm0paGU1gPAV+wHp+Om0jR/Syqgw+BrASAFo0Ycf+HKcn5BdZJ6fRasH6dfA0ER2V8oKV0LhdqueHUcJbaykqaRkJu2yvrDSXRxOXnzsk9klG0lo27KuZA329xvbZUuHbhXBvKSeK/Ux53JmMdUe5BC4+Fpvr/qeSje/wDzCLHyt39YwCSidbmy5yzip6iL3i0Ha6xbaPRlK/KloxyfM51LUEGotv5WQ9OZzwMtqrQP1K5w696gxDDql5BIsSsMdnBXYc+xncLfdUZWejMK/MaZ3vgedlG5zWvrm/uVlmF5uYZK0AVbd/uvOei9Q9XC8AVn/wAlk+A+pKtGkGs/+SZDM9XpsrQzmmegsOZWGyG34pv7FXKj6yoqgDTOP5XDmBeoaomcC6s/+S2H0nnsZdIfVje31LUoy039LMcxyOrqfEqaqsRIDdSzabAtK050dmvFWaP88G5tytj4N1LHiEYs4H91q13qRLXd7S6LvIC1hRSPc141eVUQRidgPkJX0hZuArtVhoV/siobVgNG6dBNrdYFW95LTpBVbhrNT7laMJ7J3BNE0keo3six8FTyMDfum6G+UspEUqeyINJPCkY3ulDDfeycNhZRfkCNegQhCWM+yTWhzCb2Tk1gHKchybHr4CHcFCbIbBKnsX4ISTyU1wJFgmlxJunpyWyJz2MZG69rd04xgHcJzTpN7Jfhdudv3S+qJIy6GgAcBRymwKkPOyin4KkikO/hSTOde102NxB5T5oydwUjInDdynUUkV5WqLKmmJNgVUhzWt3VLCdJHj9E+R7tt1FJPY+NikJPK3VuVSVEzADcqUtMio6trgSE6tPZUyppRbFE7T//ADVNXVjY4HEu7Jrn6BuVaMervao3nV2V6qpyaOSzs78afZpT1AdRfh/ec2XgFcvdQdemHFnD8Rb4vK3N6kMecwzjVxfdcg9ZdTSR4w+z/q8ro6OObgpaOPlyy/LrZ1dkX18JqmJrqi/HK626C6khrMOjHug/CF5xZGdZyRVMQMvcd12TlR1o6WjiHu9h3VfMwUo/DcwuTTaezfsNWxwuHJzpxbcrHMAxU1MQN7q9F2tuxXN21OL0dbiZqmPdLvcFPikF7lygaxzjb+FKyF/cJdJI3KrU0VcUrLcomkaQmRxHuiWJwFx4UDS9y3FraG/CfCcxzQeVC5xBtpTHSOAunslclorGubflTMeNO5VtZK8nlSCpcFE47ZDOSK/W3i6A8E2VNFLrH7KYOHN07WijOf7Eg2N08BrhwodZO2pOD9IvdMkPrs2PcwW2CieLOtZStffk/umvaC691XbLUXsazul1C/KQ/ALBN5SxEkx5e2/KNTfKYhWI/CtMfqb5RZp3somuJNipC4tAA8JRkfo4AA3sngAcBRtcXcpwJHCjmWIsWY2YqGcOcdgqyRxc21lEGDuoZIsQ0kW10Ja65HdKwfFYj91cHwA9lTywBtyoZQ2TRn1pEetjSmvlYRymvBJ2HZMcxxO3ZQSr2DtSJAQRcKCUAkghTQwOI3TnUjjueFC62JHISkULqZ77jTsqCuwn3r/BdX9rGtG9kx7IieyWNe2Xa8pwe0YNiPSwl2MPI8K3SdBQyu+KmB/ZbElo4ZDYDlTR4PERqsP4UcqFJmlDmrK46TNawZd04eP+FFv0V3oulYKOKwhA28LNDhcTTfSFRYlFHCwhvhM/xkvgx8tZa9bNedVYK11O8Bv6LnvOToqWtE/+Tcb9l01joMt2W5WB9X9Kw1sEhfHuR4VHIx9o7Xx7lXRNdnmt6hctZYHTS/hex+lciZlUIw6aRjo7WJXqP6jstIZaOd8cG+g8BedPqM6HrKGtn9uJ3zHssLIxdvTPeOC8hf4ktnMPVs2usc1g3usmygwqesr4xoO7h2VlxDpqumxMiWM21+FtrJDpmKmq4TIze47LGtxWmdJfzPvVvZ1z6UeiH3he6LsOy72yo6cjpqCEuZazR2XJPpmlw+ijh9ywsAuyegOoMMbQxtbK0fCO6mxq9SPLvJs67IqaiZ3Rxw00Av2VLiPWtJg51OqALfdWzGurqGjonPbM3Zvlc/515zHDo5PYqQLA8OWrCKb6PNJ4spvcjZebmf1FR4RNEyvANj9S4F9UuZI6okqGMqNV791S5ueoTF6uaWmZVEi5GxWoqjGMT6srdMhc7W5XIQcjQw6I0owzB+j6rFepPdEJN3jf913R6MehZaN9M6SA7AdlprKPJ6Wtq455KUm5B+Vdt+nHLc4WyH/IIsB9K06a/Us5mTGMNHSWWNC2lw2Fui1mhbBjj1sFvCxfo/DDBSRttawWX0kT9NgtF/6HnPLW+03JE1BTm4uFUVbGMhtfskpbjeypccrPZiJvwFF7aRz1NTts7Mc6jnjjBcX8BYL1D13TYQHa6gC33Vz646nipIHkvHB7rmLPPNkYfHPoqQLX+pVbMlQPS/HuBd+ujaHU+feG0DHh2INFr91pLNf1TUEEL44sTbex+pcnZ2equqwqsmpmYha17fGub8wvVNiNbUOb+PJvf6llZGdv+nsXE+IVxgmonUmaPqMbXSSuZiPc/UtQY16g5YKhxOIn/cufq7OWtxNpcai9/wDUsO6nzBrnFz2yn+VjXZm2dbjeKQgttHUR9SD774kf5V46d9SLmzNP+JHb/UuH5cx8Qa43mP8AKrMKzWroH6jOf5UNWT2Rcp43BV9I9Lcv/VSKR8evFO4+pdB5Ver2kkbGx+LDkfUvGmn9QGI0AaGVdrH8yzPoP1Z41RTtDa42BH1LVx8h7OB5LhYVwfR73Zdeo/C8WYxoxFpJH5ltzpnMWjxVjRFUg3HleLfp69XuI1NVDHNiBsbcuXd3p/8AUHHijKcy1oJNvqW1Vc5I845Pia030dx0FdHUNDtd7qsOnlq130H1zS4tTsLZmn91sCjqI54r35HlaFbTWzhczE/BPtFRA8junul30kqLZrSQqd1SddirVbRntKPZcKdxAvdTBxJG6pqdzpGg2VTC0uO6sRlogl2TRtJG3lTRxE7WTIxpuFMx4aORwn+zIZN66D2bcBOjbpHCUOBF7ocTwB2T0RNshn2GxVO5xJO6qZACN1TuZYXT09ohb0DXW5KnY4BU7W6lONhZKRt6BOj7pqdH3QIvo5LpNr2SKRvA/RBNEaGjTcjdNT3/AClMQTRBCEIGghCEq+kcgQhCWRGKHEbAo1u8pEJpLH6PYSb3KVNj7pyB4IQhAAhCEyP0AQhCeAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQg8GyZL6A1/IChUhv3TXNAGwUTj0A1PZx+6bY+CnMBA3Cak9gKns4/dMShxG19lJ6sB6EmtvlBe0d09PQCkXFkxzdKUuPISOJdypF9G+zTIiLFCCd0J5Kp6FDSRcJ6YHEbBRyPkvsUqWyOc9/CZzgBZQyGxv9k+O5PxJKjSGk/ZNl0iq032QuddMMmnYqnkq9L7A/0h84kaQ0qtOXqh9UX7Ej523tZM1tJ1Ip4xa7+VT1koidZp2VGV630alMdk/vNB/RPbUs5JVplr2xi5eFQVPUDInEe+B+6ieSkX44krPhlbK9jBzb9U0Yk0vsT/axA9UxjmcJWdSMkPwyg/umrLTFfHSj9Rl8tYxzdnKlM7S/aysVPi003DzurlRB0lnG/wB1Yhcmyu6PxsuDHh21lHODvZSwNaOU6UMI4HCW5qcSNSSkWHGKUyRn9FrPr7poYhC9hjvf7LaeJNde1lY8Xwdk0DnFl7jwsPJx/ddHQ8XmOiaZxlntlUyaknkFOCdJ7Lgr1F5fGilmd7IFr9l625qdHQ1dHKHQA3aVwZ6tMuGMbO+Gm89lzeXhaR9G+Ac2pSitnmPmBQzUdbIwAiz1Y8DMjqkNce62nm/0maeulHsWIeeAtb0tMKOt+Jtt1h2UOJ9g+NZquoitmU00LG04JHZWrHoGGJ3Cq24g32AA5UFfOZmuBOyqOOjo8ulWwZrbrCha6dxA7qi6Vf8Agq8Pt9QWSdRYc6WUktVsp6GKnl1kKam1x7OA5bjFKLOovTJmS3B6iAmQi1u67tyh9S8OHUELTXEWb+ZeVnQfVzcGlYWTaSPutu9P541dLA1sVadh2ctSjIezwryfgFOUuj1GHqypWUpd/iPA/MtdZj+qoYrG+CKuO9/rXD9HnjjlWPbbWPIt5V0w/qnFcXlb/mPJJW1Re2tHk2Zw6ok3o2bmRmBW9ROkYyUu1E91rMdA4t1BWaxC43d4WxOgOjarH3x+/A5xcRyF0LlL6eIq50bpKC97fStGubkYOTesZfTRGU2QeJyVsT30ZPHLV2n6ecoH4dDA6Slta3LVsDLD000FLHHK/Dm7AfStydM5Z0uDMY2KlA0/ZTKPsYs+YUW1sb0h0pBS0rY3Rjt2WVU/S9O7f228eFUYXhjKdoa5llfaCmZxp7LVpqXojl87kpysbTLFF0nTm1ox/CfL0xGwfCwD9llcNHFe2kJJqNhOkMTvwx2ZEuSsf1mL02E+2baVcYsPc1twrn+AYBfQE140/CBsrFVS2Qu+dj+iYfA4C106vjc0ApYHFp2VSGNnHxj+VeVSSK1sXop8Nu4DtuqyR+hw2RFTsi+UImZqF0ydacTPkmnoocYhNXT6AFqfM7ol1ZBIRDfnstywQtku139qlxXp2krY3NfGDceFi5eOiC2iTRwDnNl5PAZXinI2PZcxZiYXW4bM/TGRYlem2cuVVJVQSuZSg3afpXIWcOTrBJKfwvc9lyWdBwbMPLokjkJ2LVtPUkv1bHyrvhvVksWnU4gj7q/9V5eGhrJCYLAHwsIxunOHVGgbALnp2TjIxZRcTPsFzDkgI1SkfusxwLN40zmAVB/3LnnE+pDRM/y5rEKhhzJfTuBdUkW+6tY+XKLHVzkd4ZZ52s+DXVb3/Mul8l8x2Y5oHu32HdeUPQ+dc8NayFtabah9S7T9KmbLJXQiSqve3db2HlOctGjiyfuegmA1YmhbbwrjUvDYDZYnlx1DS4pQRSMlBJYO6yuRvussF09Em4HQ0P8AQtLqke6Q49/KuWFzC6tWIYZUGW8YP7K44TSSwsBkG60q5ddF6KTXZdSNYBCQixslhvo3UcrZCfhP6p8pMYxyFEGSX3T22bsVE02CWx2/ZIHA7IE8I2J3umPJ5YlUWkJLskTmcEqn9x4N7qeJ99iU9RexUnocSALlMkdcEp7wSNkwi+xUkVoa/hFc3sBwlT9LRuU15b2U2iuKHANsVDJNp3BTaiRzRsVQvnkLtynL4Pi9MuNPKHHcqVzQdyeVa4Kh7Tyqtkr3NBun+ra2T7/UkfGBc+U0lg2sl1Ei5v8AuoJaiOL53JyTMm6aTJmvA4Fk50g4IVukxmkj5kChkx2D6Zh+yeq3JkMclRZdC8N4CoqyZu6gjxaKQf8AiD+Vb8VxRsYNpAp6qJORm8hnJQfY6tqQ0GxWMdU4g38E/wCLsquuxyFsZLpRx3Wveu+so4KR4bPbnut/j8KdliWjzLmuVST0zQXqXxVgNQA7yuNuucVcMYeQT8y6M9QfVoqZ5w6a+57rlfrTFI5MRc8v5K9HxOL3Sto85nyz/P8ATaWTWOOFXENR5C7HyXxsvp4RrO4HdcF5T9QxU1Yy8vfyutsmOsYwyFrZxwO6z+Q4x+r6Oj47mNtdnYnRVWJKdp1LLoKhpAF1qjLvqNtRRMLZf7WfYZiOt3xP2Xn2diShY+j0HjOUUkuzJIHscFWQhhG//NWOPFII2j/M3VTBjkFheULHnTN/DtsPMT+svLGt7BSPjbI3hWyPGKc8ShVMGJwONtYVWcZRZt1XqQslJpBIURpQNyP7VY2eGQbOTH2cU33Zc9uiiMFibCyQwEgKukhAZcWuoLWdZyWMlshtl1oZAwtO6lQ4tG4RypN7KMn2Ck72TG/Mnpk/g+vexzL3Tw0kXTWgAKRoGlVf/IvV7QxRqfQ3wk9pnhPj8HS7IUKV0bQL2TdLR2UsfhBIib85T28j9UOYGm4CTUGkXKUjj9JEJA4O4KcBc2TWv6SxY1xs0prRcqYtYBuFG+SMD4VG4/8ACdMUi4sqepB4CcXuDibpRGZRchRtbHe2mUpiJ5siKGzvi/5KpfT2NrKGU/hxqk2THDTGvsnjgAN2ja/hOdDtbT/SpocZpWbOkClGM0B4mH8oVaESa7I6mldpuDb91bpYpAfm4KrazFoni0bwqVj3Su/VPVfYbceySjheHXcrixpI2VLTixuVWRkBu5UipSXZXc5ORBObXAVpxKGSS4Cu85aTdqRtI2QXLUOhFumbT2YnLgZnNy1WTqLp20L7AbrP6qkbG27WhWLFaV82oObsqtuOtHQ4OZOE00+jnjNjoB+KU0rPavdp7Li31BenSbEJJZG0N7k/SvTHG+m4Kq7ZIgbjwtedb5OYVikLi+iaSb8tWNkYmz0biee9NRbPG7rb061OFzyTfgbWP5VY8FwGfpqtBczTpd4XpJnd6esPjpZpIcPHB4auPc3cqKrC55XwUZFr8BZNuH18O4x+bjOvTY3oLOZuAMY0VOnSB3W2ekvWFHRBsLsQtYfnXHHUFLjWHSubGx4sewWNTY/1HSz2Y6TY+VT/AMZxZnZWRGzbZ6F4x6voKugLRiF7t41rUfXWc0vU73sZOXX+65kwfqPqmre2NzpSCfutu5VdJYnjkrfxETze3IVmql7OeybIJlJVdPVnUNYXiFx1Ovws8ynyXrKrEonPoiQXDlq3BlfkLFWvifJRXvblq6Wyq9O2F00Uc7qAAi30rTppejJtzlBa2Yhk3kVHDTRSPpQCAPpXRuXvQseFNjDYQLAdlcOlegIsNa2OKlAAA4CzvC8Eip4QTGAbK/XX6mFmchKS0mMwyAUzGtDVeqSqhjj1P8Kn9iNrDtwqGtqjFcNKmnqMDAn7ZEtFwmxyGIndYx1p1bDT0sjjJbZU2OY02CJxL7W+61Lmt19+Do5v+ItZp7rNtuUIPZ03CcG8m+PRh2d2b9PhkMg/E2sD3XC/qO9QUbBUNbVk3Jt8Sy/1R5wVMAmbHWkc91wbnBmZWYlWStkqyQXnuuay8txPpXxPxbaj+pjWc2ZdVjWKTSRzOIJPdajxnHK2pnBLnfysmxJkmKTucHXuqRvSvuEOLN/0WFfms9v47xn1rXRS4BJUSsGolVWKYVJURlwaeFX0WD/hyGtar5QYQJ4wHi6zpZLbNG3hPxL4axxDAZ2XkDD/AArE900UpiIIsfK3TinTVMKc/CP4WAY90sDWEU8e58KWi1v6c5yXHxUXsw78JW1lQGRtcblZr0d0Ri0jBL7D788LMsn8on47Wx+9S3uR2XVPQfpkpn4bG8Yd9O/wrdxZN6PJeephFtHP2WtTivTNYx8ge21l1dkDn3Ph1TTwyVjhYj6lg3X+Rf8Agcb5YKIggHhq1rRT4x01i7Ws1t0vXRY+9bPLs/HVj6PXv0655R4lFC19Ze9vqXWfRnV8NfRsc2S92juvH30vZwYjSTQMmq3CxF7leguR2b0ddSRMkrATpHdadUns4nlcBa7R1TBVNmiBvyFEGOdMAPKxzpjqNuI07NEl7jysvwimEoEjxutCt6ZweXV6SaK+kpPbhDuVUxRcbJsR0fA7hTR7m4UjZnN6QjgW8+FC6YtNlUS2Dbq31D3B+3hPi2RNlWyoAA3KnZIHMtZWtkjiq+kdqj3VqH0hk+h7mknZMc2/wqVJZhP/AOtS+pERtaG8JUr277ApE0b6gns4/dMT4hfY+UDkt9DmtLk5/wApSgAcJH8IJopDDsLpvufZOPG6bZn/ANFBKloNY8JdY8FMQgYO9z7JQ+5tZGhvhAaAbgJV9I5CoQhLIjFAJNgnjYWTWc/snJpLH6CEIQPBCEIAEIQmR+gCEITwBCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEE2F0xp7AQtDuUxP1jwUxO0gBCQuASe4O4S+o71ehyEgIPCVI4oT4CLEnZIXAGxUge0i90wRoRws0BNT9bfCa4gnYKWLQxrsjcwDcJE9/H7pieI9oEjZA42/6pJN9gmMjddLoj+sna3g3UdVctsE2WrbCLXVLJiLXCwKgslosVUuZTVUPxXuoYJBG/fypKiou3V/0VkxTF2UYLybWVG+TUDVxsL3ekX6bEI422LgrVimLwsaTrH8rCOosxoKLUXTWt91rvq3PqgomODqvi/wBS563LUXo6fB8cybmno2T1L11T4ex3+a0W+61z1JnNT0kzv+IbsfzLRuZvqYoo/cDa7j/UtHdaepWGWV+iuP7OWbPNe/p22J4rb6fDsX/7doJJQxtU3/csk6azUjr3tPvt3+6866P1Jxsqbvrjz+ZbJy89TVE6eNprvH1ohmbf0dleNWwh2j0O6a6ohqA34ws1wnEYpWizguQcsc+qHEmRhlZcm31LfHQvXceIRNc2W9x5Wrj5OziuQ4idfWjbLJA/goc4tNlZsMxgStaSeyr2VImcLFaUbPZHLXUzqfZJURNlIJ/pRVNA18OmyqJGkAOTJp9LE70UhlUpp9GDdd9PxzUkgLfoXI3qQy1ZiFPMTDe4PZdqdSNE8Dx9lo/NrpgV8MgEYNweyz8vGTieo+GcrZiXJNnk3n1kz7VXPK2Aj4ieFzL1r0ecJrpDptY+F6c5/ZXOdHUSfh77ney4az76Kkw6sncI7Wv2XK5dHq9n2R4X5HCUIrZoWpqfw5DXFENZHKLEq39UTOpagsvwVa6DFiXAB/fysS2vT6PYYcxTOvtl9xKkhlaXFY5idI1pJaeyv8MklVGGh17p7elKqu+VhNz4UCiYPIcjRKD0zDYamogmAYTZZd0g7EK57I2lxurrg+UWIVs7f+HJv9luHKL09109VC59GfmH0q5TBs8m5/Px+9snykyqxLHwz/h3G9vpXRmXHpjr5nxvdRO3bf5Vsz05enqOCGF0tENrctXXOXOTmHQRxg0jNmj6Vu4tUnrR41znJYsIt7Ofcq/TpJQvidJRuFv9K6fyoysosPZGZYbEW7LMsDy1oqbTopWi3Fgspw3pt1JYRstb7Lbppmn2jyDmOSrm24svXTuAUFNTNYxoFgrsMLhJs1o/hUeFU9RGA08WV6ooyXAFaVVW/wCHEXZEnJvZQT4eI9wE+BxiNj/aulVTN03sqKWDTuAtauvUdGXdbOcippZdSrGRB4DiqCgBDwbK6xtLmpPVEO5f0p5acAWA/lUk1Pudlcpef3UTqcuF/srFSSZYrs9S3siLVOzY2Uppj2/5prYiDwrbacSVzUkPj+Ibp7mfCkjbsCpW2ItZQyK8tN7IGEMeSU78Sxx0FwS1Ud2XaVZ5pZI5SA7hU8iMXEctSWx/UuAU+K0zmubckLROa2UENSx72wc37LoClnMjNLvCtvUnT8WJQEFg3HhcrnYynvSM/KpUltHnPnVlQMLbNMICAL9lyjmlRSUFVKNJ2uvUX1AZWCqw6f2oQSQeGrhjOzJit96dwpz37Llr8N+3w5zIoSZyF1Ji04cWteeVheN47WRk6SVuDrHLKvpalzXQG2o9lis+VFZXOLW05/hRQxJplFQezDOjOpsRbiTLl2z12b6WeuamCWD3JSNx3XPfS+RlfFUMl/Cnm/yreGWXTFd026N5jIAt2Wlh1yrn2XaItM9MfTv17FU0UEck4N2DkrfmGYjFUxNe14Nx5Xnjk1m8en/ajnqS3SBy5dJZfeobDKmONklaP3culou9TXps9TosaHC5aCkqZfajIaFh3T+amD4lG3TUtN/usipcZpsQb/lvvcdloxyI6NCN0WuhTisrCW27p7MTl+oH+E10URfq0qZsDCL6Qnq7Yv5JMG4k48j+lI2oEguPCppImt/RJHM2N1r7K1XL2JYPZVOpy52q/CVrwwaCeFAcQANrhNEpk+IFWlFNE3qVNwXX7XUrCB3VJG5wAP8A1UrZWtUir1oHEqQ93lNcDyDwoo5m33upTIxzNvCT17K9i/g0uJ2JTXN1d0trb+U1zrG1uE9dLspz2Ryx37qE0oJvZVoZqHKVsIJ4/pG0SwKB1I5nxWT2u0bEKtnY1rOP6VFK0gXtxykU9Mkl1DsJ6lsbL3WK9TdR/g2OcHcK+12t0ZA8eVr7rz3mRPLb91aqab6MHLbXZZMazFdDKW+7/atwzWbGbOmH33Wueucano5nnUdvutd4zmFJSvdeYi33Wpj0/kZz+TmfiX06YwzNaKQ2M43+6mxPMKCSEu95v8rk+nznFJJZ1V3/ADKudnhHLFpNV2/Mur4/i43a2jjOV5dxi1s3n1DmS2NjrTDjytRZkZoj2JAJh37rDMdzaZPG4ioPH5lqbMLM0yB7RMe/dd5xvBwjrSPL+V5Vzb7LVnF186rmmAkve/daA6s6hc+qc7Usn656ndWukfr5+61jjtW6Z7iCV2+Pxmq0tHETzX+X6ZZ0X1s6krG/5nB8rpLJXNTS6Fpn8d1xhh1VNDU6mlbdyt6ono5Y3F52+6r5vDbg+jWwuRcJLs9Kso8y45aWNpmH8rbeH9eQiLV7g/lcK5T5oOpY4w6bbbuttQZzwQ01jVdvzLz3k/HlKe2jveJ5Z7XZ0rV5hxxtuJRx+ZUBzT0Ot7w/lc31mecBFvxf8uVCzOaKok+Gpvv+Zclmcb+FaSPSuM5H2S7Op6PNZrnWM39q/YVmIJy20v8Aa5e6Z67kxJ4DJSd/K2j0NV1VVIz4ibrjsylxn8O1wsr2aN84P1R+IaAXE3+6yOirRMAPK1v0zDUDQSCs3w4vYxt/CyJy9WdHGz9S+k3bf7Kml+dI2pHt2PhQvqA5+xP8qv8AlSY2ctk7jcAIY43sSojLr2F09t7DdSQu2VWtkreQpA0kX+6jjHlTNcDt9lLKW4liqG0Db23Tg+wtZM9yx2QZPso0tyLqjola7V2SprOf2TlIMl0I/wCUpie/5SmO4P6J8fhFIYXEixCY8EnYJrXXktZTOLQzfwlI30JCNt08Eg3Cp3VTWG105kgkOyAT0TF2oaS5NFMCLlNEbw69+/CmLrMuExomi3oT2meUrWFp2CoajERTm7+AqSfrHD6W4llAt90xpJCqe2XaolEXxFY71R1BFBCQHDb7qzdS5pYZE0tZUC/6rW3WOaNPIHNjnv8Ao5NJ61svvUmYhoNVprW+6x2nznJn9s1P1W5WuupuqpsSa72nnfixWPYfDik9YHgO+ZOiix6L1Ol+l+uhigbeS9z5WeYO78Q0O+y0dlbQ13we40reXTELo4Gl3hS6RUt0i6MgsAbd0OlLbAKWR7RGbFUZlBft5UkeypJNdkukvAKla/227pIrab2SVD7N22SPt6HVWNMjle15sSqGrja4H9E6aV2u3/VGgyN5/lNnFNGrVNLstc2FtmcXKjr+nYpI/iCyWGisLkBUOKtMbSGjhUbK0Xas2cZfTU+Y+W1JidHK0R3JG2y5jzc9OrcQMrY6Mm9/pXbVXQurbtcNirJiGXFNiEhMsLTf7KjZj7OmxOYlCPbPMTqf0eVdVM5zcPdufyLDKz0SYlJUFzcNdufyL1imyVwiQAupGH/2ogyHwF79Romc/kVWeH/dFuXOx13I8s+nvRRiMMrS7DHbH8i3XlT6WJcKkYZKFw4+hd3xZGYBELiijv2+FVFNlXhtE7/Kp2j9Gpix3F/DPu5eM/jNK5cZMwYeIy+ntYDst09LdGUlHTMGngeFc6bpWKjHwMG3hXakpHxQ2+yu01Jfwy7syU/jKemw2CHZoU02mNnKfHG4d7qCtJAO6t+kVEqqTnLTGF5cNirTjL9DSfsrnH8h/RWXqOX24Sfsqtz0i9iwTuSNfdf4/wDgKWR+rj7rl3PzM91NTztEwFmnutzZ39S/gqSYa7Wv3XD3qJzA1PqIxKeD3XN5tukz27w7joznFtHPfqSzLnrJ5WNkve/dcm9bYvU1tY9wJ3ctx5vY0a+qku4m5PdagxGkjfM5zh3XG5+RrZ9beI8RWoRbRSYC4O/8QclZFT08LodRH6qx0lNplGgWH6q+QNf7OkH+1z9l7bPZcTjqY1LaKCtmippbC2yrcLxaAMsXWVsxmilfd4VgdiM9LN7d+9uUtbckZvI41NaZmtbiDJ2FoPPhMwjpYYnXtOguufCtGAPnxCUNFySVvDJ3LioxiqiPs3vbstXEr2zyfyW+qiDM49OOVsUlTA58BtqH0ruLK7J6jnwmNpg7Dstc+nfJKeIQP/DePpXYuWeXklFRsjfGO3ZdJiUvZ88eR8vVGT7Oec1PTtHW0LzFSE3b+Vcs5q+nepwiokqW0RFj+VermK5eQ1dJaWBpuPC0Vn/k9RNwueQUrflP0roqaWkcLVnU5L6Z55dGVNV0lWhp+HS5dN5BZ3SsqoYDUjsPmXPmdeGM6YxGbQy1if8AmrTkvmI6DqCKISnZ3lX4RKfJQrlA9iMgOszjVJATIDcDuugMGkAgBBXFfo26vGIUlKwyXJA7rsrAJTJRsIPYK7VpSPL+XqSb0XWeoDQNKfSVYOxKoqpzgL87eU6kD3bj/mntNy6Oat/VFze7WNlSTwlzlUxAhm6Uta7kKeCKspFG2BwGlVlK0tbcpWNa08JSR9JVuEdEMpIek0b3v3SB4ATgbi6e0IuwUdiOQpEOaHDYphIl0MAubJ7fg4QBYWQn6WgimmSJjnE7fdIhN0SxTB3B/RRp7vlKi0HyE7SJB1x5QNzZNa0g3Ke3kfqjSGPpj0ITnfIEdIifY1CEJJEY5nP7JyawHlOTSWP0EIQgeCEIQAIQhMj9AEIQngCEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEAI8kDZAcCNyh/H7plj4QAhcByVG+a7ebJ8lhuSqWaZrBypVFEmhX1JB3KY+queVTzSOcSQmxtkc7hO9USdJdlyp36gCpXXtsoKJrtIBCqnMAF1FJ9kUpLfRTyOc09+Ege63KlfF7nZRiMNG6ietg+x8bgW/EU7U0bKIutsEoL+/9p0WmL6rQ9/CaEWJ4CLW2UqIpIZJsbpBMLfClmIA3KhisSQUkpdBCPZb8XqHNJINt1QQ1ZJuXK4YvCXglousdrqk0ly82t5VK2xI3MShTXRW4hisUMXxyBYBmF1tR4fSyOdUAWHlU2YOYVLhNKXOnaLfdc2Z559UkFFO0VrRYH6llZmQlW0jt+A4V35MVJC50Z+0uFtlEdeBYHuuUM1/Va6J0jWYn3P1LA/UJn9JK+dsNbe9+HLkTMPN7Ea2eS1QTcnuuMvufsz6G4jxSLrj+pujMb1U1lRPI1uJk3P5lrTFvUTWVDnE15P/ALlojHus8QrKl15Sd/KoDidVIy5f28rLsve/p3uL4rWq/wDU3JV+oGuheXNrnbfdXbpD1TV9HXRg4k4AH8y5yrKypkBAeVbo8QrqWpa9shFj5TqbWZ3KeMQUHpHqR6cPVY+qngjlxO/xDly77yCz0oMRpYg+vFyB9S8I8iszqrCquH3Kq2l45K709NnqAdH7LHVo7fWtvGyIs8f5/wAelXJ6R6+9JdZ0mIwMdFODdvlZlg9cJngl23Zcn+n3NWHGaenaKoOJaPqXSPSeLsmiY8uG63caxS0eRczxTpTejOZqhvtAAqklmaQbuUDq5kkezgqaapaQfiC14JHL10+pHiZ927b7FYd1V062tjP+XdZRPI90luyZU07ZIviHITboJo1cLJePNOJzBnbl5TVGHzu/Ci+/ZefPqry+/Dy1JZS+ey9Wsz+m2VVHMCzkHsuIvVBlia2SoLISb34C5jPpez3bw3yGVaW2eT2aHTtXS1zw2I8lYXh2GVv4m3tO58LrTNnJOaWse5tKefyrA8JyLrX1YH4R3P5Vzl1Utns9PlH/ANP+xgfRvTlXW1DGOhJFx2W6+hMoZsQLL0ZN7dlkeXGQFV+IjcaR3I+ldO5P5CSOfEJaNw45aoo0Nv4Z+T5TD8b9pGu8tvTOKv25HYde4B+VdE5TemSGnfE92GcH8q3RldkZSw08RdS/SPpW6ukMr6KhYwiC37K/j480/h4/5J5YtuKkYZljk/S4TTs00YFrdltjp7pZlJp0wjYeFecJ6agpIrBlrfZXGmh9uSzW/wBLoMatx10eQcnz1l77YuH4QwNH+Xx9lXx0cTD8gU9K34N2qQU7nnhbtNfszksjMbYsEUYGwVRBIxjgfCI6UBtyeEhpzruOFehWk+igrdvsq3OZI2ygfA15sAlAc0Wsnx7usrsI/qO0nHY2GIM+nhVUUna6aIgW3RG0tNvuo3DQ16aJntba9kg0W3Su+QJjg48KSMVoqznKIPaDwmCPUef5Tmhw7JyeJG2RGBY6U9osOEFu+pOAuCfCZKXRYctrZHMbsIbyrTPBqmJsrs4AGwVK6PU8ut38KrNSaIfy6kQwARGxVQ7RJHY7qkrCWm4S0M2pp1lZ9lLb7QkrNmP9adMU+M0743wg3Hhc/Zt5E09bHI5lEDcHsuoZ2slcRfkqz4/03SV8DtbAbhZ1uD7dmNkwc3tHm1mJ6b5DVv04f9X5VY+mfTJJUVYDsPuL8aV3f1flbSVUznNpQd/yqh6WylgirAXUm1/yqusHX8M/8UvY5v6c9JbHQB/+F72/Ird17kf/AN1qVzxR6dIv8q7zwfoDDaekAMAuB4WtM9staatw+T2oOx7JtmK6lvRZUJJbPOLrTqiv6WqXiFzmhp7FUvS3qTxbDapsZrnCx/Ms7z4ygxD8XMYad1rm1mrn/Gctcew6uc9kD9neFWUmmTRbX07Fyc9TddWSRtlrzvb6l1rkzmzBi7IhPVg3A5K8r8v8TxTpyZvvucLELorKj1AnA3xCWrAtbYuT/wDI0yVWpI9JaWuhrIxJFMCD4KrGuBFtd1zHlz6qMOq6WNj6xpP3cttdJ5uUmOge3M038FXKctPpk9d6fTM5rXSNF2qjY+ZxN1V0NS3EI7i26rI8NYG3PK2MWfsXqJbLWA4uBI7qspiA0XT6ijEbS7wqEVbGSaCeFt0raL8NMuQsRso5pC0GxUbKmIt+YfsmyOLuD2UygOa0KyoIPKnhmc/ZUjGOLr2VdRwWtqCY112VLSW7g3num6g48p8oA2Cja3Sb3UEmjPm9skjc4cnZSCQNOxUbCCNk8MB3BTHJaJ62hJ5NTQLqHRrbchOnDgbW/pDNo91Fv9h1jTRT1EUYbv4WG9aYS2ppn6W8rLMRqWs2DlaK/wBuojLXeFdx5rfZhZieno5kzT6aqDNKWxna65xzVFbhUrg0Efou3uvulm1nuGOO9x4XN2duV1RUGR7Kc8Hsup470lJHAcvOyG9HJXUnWeJUUpJmcBfyrWzNOujFnVLv5WS5nZeYlSOeTTuAB8LUmO4fU4eXB4IsV6dwmPGWjyvl8qxNmcnM2edmk1J3HlY31J1NJWAn3iViIxSSF2kv/ZMqcSllbtvdeqcbgx9V0ee5uQ5N9kOO175Gm7uVjc8bpiSQrzXh74ySOQqGGHnUujoxNPWjnpzl7FHRUF5Qbd1mfT1QKAMIdayx6FrI3XCrTXsijG9reVauwYyh8LFGRqX02x0v12aGnDm1BFvurhU5yVQBjZVH+Vpyk6he1ntteq2idUV0lo3ElcZynHxSe0dhxWU/ZaZsSTNPFKmbQ2pcf3WT9HdS4rXysBkfufKwPpHofE8QnYfZcQfst6ZY5S1hbG91M69x9K8w5immGz1Ph7p6RsvJynrap8ZeCb25XU2U/TZl9t0kfYdlqXJzLmWnezXARx2XTmXXTkdFBGS21mheW8pGCk9Ho/GWtzRf8K6eZDG0hlrfZXKSD2GjawVXDoZGAOAqbEJQ5ulq4699s7eD/VEfvavhum2dr2UcLX6rlVcUN7GyzZSex/8AR0LDa5U7GG/H6IYzT2UjW2NypqpDlXsVrSBayXdo/ZPaW2G6ZMdiRvsrkZJlqqGiF8h1blSwkOAJKpnkl1ypYH2FipY/SxJJRKlrt9ipFCxzbWB/tS6m+U8ry7B/ylRuIsd1IS1wtdQvNzsUsSFpsY2Ml9wElXrDNlM1oG4Q9geLFOGSiy0Pc90lvuq2hdpHxqT8Cy97qCse2kj1ONrJVoZ8Kv8AERfmSyVlNE27pANliOKdY0dC9wMrdvusa6gzUpo4yG1A2HlMlrZPF9GSdbdS0tHA8xzDa/daCzMzfqcOkkbDUnbwVcOscyvxrXsZNe/3Wl+vpK7FpH+2SdSjkLrbIcfzxxOeVzRVOO/lUmF9cYlj04Y6Vxv91jsPQeKVcpcYnG58LNsvct69lWwmB3bsmlmraMs6O6ZqsXLA+MnUtq9I5PCRrJHU/wDSnyr6GdE6MzQWt5C3Zg+DUtJTtAjCdH4TznqJjHTWX8WGMBEQB/RZKyH8GywFgFci1jG2FhZUlW3UwhSJmZfJlJJVyPFmnuiEOcbkIipyDchVMcIaL3Uik0WI1p1bJqewABKKlrS3ZNJ0bjsmvkLvhuhbb2V4VvemUc0V33AU8bGtj2Q8WKACeyc0mjSjFKJJE/4bEKCroxP25VRBFc3SVJLGjSoJpNEctKRQsw2OPeya6BjX2DO6qRK9x0uFkySM31BQ+qRPCzS+hHAxzbaB/CqIaZjbfAFTFz2m3hKa2RotY7Js4dDJW7/pXiKO27BxuoJoo+Sz+FRnEZ76QD/Ckjne8fEqzgxinoHCMm1ggMaBsEr4dtQSsAItdTVw6JlPojELe4VLVwAmyryyzSf7VHOXGTcW3TprSJoTaeynNHaIu+yxnqtrmUzr+Cs0kDGUxA5ssG64qHNpX7WsCszK2ompxk5TyEcq+pjGPwlNUf5lhuvPT1C9WuNZUD3vO113L6scQLaWpse5Xm16hcakFdUNL+5XJ5slpn0n4NU3KJp/rXGjUzn47nusNnc+SQnsqzGa101USSmUtO2QaiuHz5ttn1z4zFxqj0QUw0Hcd1XsrGss29lC6if7mwVLiTn0rb/ZYalJyPRI5LhDRcamSOeIjk2WO1uByVdWBGwklyq8KxFk0/tvd/azTozpR2L1sZijLrnwtPGg2ji+c5VV77G5W5e1tZWxg05IJHZdwemPJN83sPfRX2G+la6yNyYnnmhkfRu3I+ld5em/Kv8AAxQ+7S2s0fSukwaJN9I+efNfIYRjLszzJrKuDDqSAmkAsPC3dgPT8NLGG+2B+yb0Z0rFTwRhsdgB4WVx4U2IgALp8eiUD5c5/nZX2tplOMDZLALx/wBLVWfvSrTgNQ4wDZh3W9sPoS6EXC1j6iIHQ4BUta3/AMsrdqS/F2YnFcm1k/ejyM9YtH+BxCpa1tviPC0Blfis0HU8f+YR/mf9V0H633yR4pUnT3K5ky9rCep2aefcUqS0dLlZqlX0z1W9CeOyyspAZOwXoN0jUNmw2I37BebHoKqpD+EDvAXo70KScKiP+kJ8Xo4PkbHOTMnlia5oun0kTW2Nk2SRjWi5S08lx8KsV9nM3N+xVpshIH2TWveeR/SVz7jdWoLsqybEdJta+6RsthvZGgE3TXAA7K3FbIiVji7dStIsBdQtcGCxT43tJBuEjQ+OiRABPASgsPdOaAOCoydaGH7oTntHKanb6BLQIJA3KEEXFkq+Eq+CFwIsCm6HeEuloOxTku0KM0O8JzWgDcbpUJrYx/RWgE7pX/KhgHN0rgCNyk3tkemMQg8p3t/dObRHpis+UJUAWFkJhJH6CEIQPBCEIAEIQmR+gCEITwBCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABNc8C4sleSBsUznlC0HRBUPJ42VvnDy6xVymh1D4QqZ8Did1PF9EykkQQi4sVVRMa0bBJHT2ttyp2w2HCG1ojm2xWC27QpWutz/Ci+UbFRzT6Be/7lV7GMjCXsVL5WgKB8mo/CqN1eTtdPjqQRzyqzbLEa2kSNdY3JVQ1zdPH7qkbqc4WVQ1waFJtaCyLfwcXAb3skLwo5HOKjc+3dOjZ2RKpv6NqH3NgVFcjgpJnuO91Q1eI+y3n+0SsWi5XjOTKisqoo4zrK11mR1NBh9O9zX2+Eq6dT9XRUcL9U4Fh5WhM8s0YafD5i2rF9B7rIy7dHW8PxU52Js1P6jM5TQtkYyrIsT9S4tzqzjr8TZNHDVuNydtSyf1JZp1dfXTRx1RPxHgrnx8WK9R1rmWc4OcucybXI9o8e46GM4zkjCOt5sXxuSRxc51wtXY90RiM73OdG7+F190tkLW41C1zqMnUPCi6z9OEmGUplfQkbflXOZcn2e5cHyeO0onDld0JUslJdERv4VPL0lNDEbtPC6F6zy7iwx8gfTgWPha96gwdkLixrP6WP7NyPVMCFWTBeqNWu6ecCQQqOp6Xke4kNWftwgSP3jT3YNE1pDoxsE9Ta+FjK4RTh8Nf4RFV4PVtLSRZy3rkvmpPhNXG11U4WI+pam6loBAdUTbK0YV1DX4VWh7ZHAAq1j3SUjy3yTg4qL/U9dPSJn0xstM2atPbly79yuzTosVw2F7Ki9wPqXgv6ffUFVYBUQNlry2xH1Lv/ANN3qujq6anhdiYJNh8y6nCuezwbnuAUt7R6d4F1E2tZs+9/urk10ksgsdrrR2R+ZsPUkDHCrDgbd1vXAjHUxtdqvcLoarHI8a5nj3iWNLoqYKcGO7gEk0J8bK4tp2CJQSsZa11ab39MGqXqYZ1hQNnpntIG47rnnOHLtuKPlPtA3v2XTuN4bJOxwa0m6wPqXo81b3B0HJ8KhkwUzsOJ5F46STOE+tvT82vqXH8IN7/SrZgHpliNQHGhbz+VdpV+VlPM/U6kB/UKXCMqaSKQE0Tf4WNZRHZ21HkTjDuRzx0J6cYKZ8bjQt5/Kt39B5QU1DotStHH0rY2BdBUkBbelG32WX4T01S04bphA/ZFeKm+kc/yvkU5v9ZFs6W6Uioom/5YFh4WWUNLHGAA0KakoI42j4LbKrp6MF2wWlXjKPWjhsvNlfJuTCNvw7BOp4wZfib+6r6WgFtwphhzGG4H9K9VQ0zDuujoihj4tZVMYbbhI2GzrWUrI73+FaVUPQzLJezDQ5OjG4uFNFEHDcDhI+MMdwrUYv6RpS2MkYy2w/RIwAOGyebHkIsPCsL4TQ9l9HNfYWsnKNOa4W3KaxZIl1jwUANcL2UZc0d04PIGx2UO2hriKQwGxCamveXG4KcOEu2RtJIQvANilEgAso5nadwf1VFNVuaSbpy3oY5aK17xyonC4VLHiQedN1VQSCQXS6RXe29lPUMPdqopHGP5Nld5YA9tw1W6ppHA7N/tI64tbYmpFE2rex25UoqzM232VPLSvL7aFNR0T9QBaefKY64jfTZG7Co6o3e0fuFW0eCUsADmxC/6KvpaRjGW0qYxhu2kKJ0x/wCCqhfSimtAOOFjPVuEtxyAxhoN/ssmxGMvBACpaOjaSRI26pZNSlHSElD+HPnX+SFLiz33pGnUe7VqXrD0uUxjklFAOD9K7bnwKgndd8LT+oVn6h6UwqWle38M3jwsW3Gce0V7YOMdnmTmbklNgTnPp6bSBf6VpXqrEcX6cm0xvc3S5ekWceVEGJRy+xR+eAuRc4/TziM80r4aF1tR4asu+uUTPns1flvnFjNFUMjlq3gavzLrHIHO0ymJtRVnty5cdV2VeOdOVTnew9tj4WQ9Hdd4l0jO0SzObpPlV4OcZDq9pnq1lxmbhtbTxh1QDdo7rYuHdQUNXGDHKDf7rzPy79Vpw5sccmI2IA5ct8ZZ+quDE3RRf4gDc/mXScfka1s1se1o7CmMdRCdBvcKxVmGzicvYDZY9l5mPDj0LD+IBv8AdbBiginiElwbi66erIi10addvRjkcVRE6zrqvpnEtAcOFcJKCI3NlE6mZGVbVqkiX8iFhia7sqqNrWtuFA2aKOPkcKmdirfdDAe6ik99lW1plZIfJUTjcpvvhzQSeQgPae6o2z2yk/o5ocdwVPDdRM+W6miBA3CbHeiaseQHbEKCq+CM6eynJA5VNWPBaWjup0v10Pn2tlixKZ+si/dUJD37Aq4VlLLI++kplPROafib3SKE29ozshrWmW2TBo6lpMrAb+ViHXGWlHi0bnCFp28LZLomNbayoK+Jj2kFq3MGydWmziuWx42xbOP86MkKU08jmUrb7/SuQs38qJaGebRFaxPZenGZfT9PVUcjjCDcHsuQ8/ukYmGdzYR37L1vxnOjNRPHedw5Js4Tx7pmooalwN9lRQU4b8L1sjMPBHQ1clo/KwSeilbJe3de38PbCUEeW59TjJlJXQgR7DaytFQ729wFf6gM9vQ7myoxhQqAbBddTGEl0YN0/VGPur3sPyqnra+dzbNuskb0r7jrlikd0g0kAxq/+GPqU67W59GP4DHVVTwwtO58LcOU2Xs+J1UZkjuDbsrD0Z0PC+dp9sX1Dsulch+gm/iYi6Aduy4Lyacaq3o7vgtzkjYGTeQENbDC91GOBvpXRfQXp/pqWCNxpmi3+lV2TXSVLS0UJNOL6R2W48HpIoYWtbHYfZfNXkHJyle4xPbuCxnOKMc6by5p8JILYgLfZZnh0Ao4wB2FlJFC07Btk6ankDdhsFxWRfKcXs9BwcSUJJkoqXOAAJSsBe6xKipYZNViO6roaYN3IXOTTb7OqqT9Uh8dOy1wFPDG1reFFr0BOZUACx/5KCUUaFS6J/bP2TtPw6QVHHPc7nZSE3b8KIxLOiCVzmOsClieXbOSyRlzt0RREFWYjtpIDSh17BUsz/aeWq4BwYPi8K31o1SamhTxI5NsWOU/yqhmqTgqgZKQ611W0rzsSVKn0Ik2TBjtNtRTTGQdypb7XSO0gXPhKtjlEImhtrnsllmhib8TgFbcUxUUUZJfa3CwrqfMmOgDrzgWHlGtsZNaZn8uJUkW7pB/KxPrrrClgpXiKUXt5WrOos+Yqa7BVDYeVg2PZxvxe7G1N7nykl9K8umXbMHruphfJJDOf2K1riWY1fUyFhkdb9VcKuapx9zm7kOUUOW9TIdftHc+FHLYQ3/C3YZXV2JzAOJNysz6d6BOLFrpIb3+yqOl8uJY3tJgP8LbvQnRrYGR6oLWTSeP0xvpjIynqGg/hW7/AOlZ1gOTNFg5bK6mb/CzzAMIgpIAfaF7K4Oa2UaS0IJ1NLosmD9O09GB7UYFvsr00aG28Jf8uBvH7qmlqfisEA5exO46iAAj2Q7ZQwSFzrgqoY7glBC4p/SF0AbtZNeCwXVQ8BxUUgBbuFPB9Img+tEEhuCVGnTOaAQCmR7mxKf7Il/UewXO6kbHexRHDe5U0cdrbIb2I5aBkdhxZK6Nlrv3TyNtlG4kfMVDJlaUv+kUkbCTZqYYgBwpDudk8NGncKLfeiJ2S/hTe208pnts/Kqn2x+VRmAjeyfIWDbZF7UPdm6VsbTwFJ7Vt9P9oAA4Ch/pOvg2QXaoQHMf25VQRcWTHR2dexUsdaB72PsCyyo6gAP2VWSGjdUsw1PUdjTLFe9lPM9+ggnssN68GuifYfSVmk7W2dssP65ivSO0+Cs3L16G7xeo3o4g9XMbhSVJHkrzL9REj24nUA+SvUn1XYY6ejqbN8rzV9RXS8rsRqHCI8lcbnf6s+l/A8mEPXZzNWPc6q3VZh79IFz2VVimAyU9SS6NW6aYUoNzwuHzYy2fWHA59apjovDHw6NR5Vl6hka9pawqnkx+z/ba77KpoKGbGJwGsLrnss2up+50ORy0K6+y3dP4JW1eItEYO5XUfpsy1nramndPBe5HLVhuT2TlTilXC78GTf7Lt7005E/hXUz5aI8jsujwqN66PGPL/JIRT0zaWQuT1OIYZTRja30rq7L7o2nw+njbHAAQ0dlY8ocvKWgoo2/hgLAdluLBOnooGtDYgNl2fH4yS+Hyn5b5E8i6UUytwDD2xQtBA8K4vpiZhZLR0/tkNDVXRUp1hxat2NaSPJcu33bbK2ipmNpQdPC1h6haNk2AVIt/5ZW1GOayDS3wtd5y0xrsKmjDb3aU9r1RVxpSjbtHkX63emZZ6uqLYu5tsuV8uOjK1vVrC6M29zwvRf1P5SzY1VzkUhdcnstHdEen2WDH2y/gDs/8qhlJnSVWtw7OjfQ90/LSRUhdHa1uy9B+h7w4RHq/KFyZ6WugTgopw6DTYDsuu+nomRUDGW7Kep/DNzGpFfV1Ej3fCVWYXK4bPVGYwXA2VxoImBtyFeraOdyIvZX62WuB/SjdZ5sP7SixFhwmAkcK1FlRocIyTa6HRFouSkdMGAb7p8TxKDcqwnsgl10Us2q+xTGmXVYFVU0YvcDuoww33CcNSJIS4s3T2l3fZJG22yl0NDb7JjWiZRkxHOIamBzvP9oc4kgf9EJy+FlR1ECSeShCOUNg/gsbSXXKnsPAUUYLefKe5wI2KikyMU6W72TXEE3CS5PJQm7Yq0CRwJGxSoTdv2F2tA2wtcoQhTDSRvA/RCawkm1+ycgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCAEfx+6aACbFLJ2TRcusB+6BddCvAHCie1ptYp7naUxztrkp8SN2qIsbQBdEzrWTDLp3CbrL90un9JK5qTBz7N34VFWTuNwD3VTM64tZUkzC7YhRWFqMUyidM7VZVEDy43THUuo3t/akji9v+FVk9iykl8K6Jx0gqRpJFyqP8SGjSLp7KsWsj3WhiTkypfx+6geA4/ukNQHA7qN9QAdgq87khzTiOmZ8BsFjvULxBA6Qm1lkkZ1tP6LDMyKo0WHyP42KrWZL0X8CXtYjSGdGYf8AhDZm+7awPdchZ7ZzvmjmhZUdjsHLYfqxzI/wz8S0TEWJ7rhrr/M92L4vJT+8Td1uVkZN7kepcLCGkym6urKrqfFXFpLruKzDJ/KeXE62Jz6Ym5/Ko8pejv8AvLVMlcy97dl1Xk1lXTYX7U8sAsADwsW2zbPQ8e1Qp0VuWuStFSYYySWlAIb3arJnRl9h8GGSAQN2abbLdNTitFglJoFhZq0rnvmFRmglYyQXsRyszL9FF7+m749bmzzVr/U4gz1wymoKudrQBZxWgsffA6pLSdlu/PnFnYjWzOjdy4rQ+NYfWS1DnNuVhr/+Q+mfGLIqMfYpRDTtaXNVBUPaZS37q4UuGVntEvaVa62N8NVZw4KWT7PTY/41lRb8XwttS0m3ZYnjuDexd4Ys8eWuFj4VsxXCRVxEAchSUzezhuc4uu5PSNe0fVNdgtY0xPIsfK6D9OOfOI0NbBHJVkDWPqWi8W6PldM4hh5VZ0hLP09iDHDULOXRYlktbPGvIeDhCLej2k9HPqDhlp4GVFY3cN+pd2Zc5sYZX0sRFSwksH1Lwa9P3qIm6adEw1jm2ttqXb+QvqvlxD2Ivx5Ow+tdFjWvo+cvKuLr9ntHqHSdWUtVGCyVpv8AdTsr21DwWnkrm/KnNt+NwRE1BOq3dbw6VxE1sTXl3IC1ITcjyjIpjVJ6MrfHDNHvvsrdVYFFUOPwcq4UdPJI4AnYq7UuFXaC7dE4exmLLlVIw6TpOIndn9J0XS8Ufxaf6WayYawbgBQTULbENA/hV3j/APolfKW+nTMdp8GijZ8I3H2VdTUNhwf4VcyjIfpP/NVQogO39qxTjLXwz7ORtk/pQMj07EKemsH2sp3ULnDYJ8NEWEEhW4Y6TKdmXKS+lVSOBaFPYEKGnbp/lTmwFyVbrp0im7nL+iaAnRRjue6G7kJ4NjdTKCQsZbHEaNwmv+PlOc8fKmp5MhvtjuUOaALhOSP4/dHtocmMOwum6z4Cc7g/oo0b2KPa4u5TtZtZRgEmwUjWFrbnwmJDWxpLtVrbKRrriyYhPUeyCctIbVbNJurVWF5BAVzlBcVTTUtzwn6RB7MtEWv3O6ulDI5oASMw4auFVRUmixAS6RIo7KmPdqbJTteNk6IEN3TkaD1Kb8Awu3H7pzaRrNxZTgEmwQ8FrdwmtIPUja4M58Jk0+kE+FT1dR7Z5UEdR7210ji/gqiyoL2zPSStbGLtslhidyiojNr3Va2ra0NlDoY0ki5KpMQozUA3J3CkdWNjOm/dKKgP/fhZ86k0VpRbWmY9X9E0te0iVoJPkLB+rsjsLxCOR34UG/8ApW2mOJ2tZMqIGSNIIBv9lnX40ZIrSoTWziTOPISkpnymKiHB+lcq5wZa12FPe6ngc2xNtl6i5g9CxYwXlsQNx4Wg80/Ts3Fw4toweeGrHsocWQqtxPNHEK3H8GrLBzwAVsDJ7NTFaDEoWT1DgA4XuVuPMn0pTxGSZlD3PDVp7HMrK7pGrMjYS3QfCfVN1liEvXo7c9P+edNGyFk9Y2+3Ll1f0jmrg+JYfGfxLCdP5l4/YBmvifSdSxgqHNDSOCt45ZerSrY2KB+IHgD51qU5jX9LVdzR6b0XUNHWxh0MoN/BTZ55JD8C5gyg9RUeLRxCasvf/Ut/dJdcYfitM0+4CSPK0K8x/wDSyrdl5kbOWndUjqaVkuu3BV4iqKedl22NwmzxRvbYDsrayfZfRk96Lf7r+LqaGUkgHwkdAGGyQRm4se6Yppsr7LhTEPYFUxi4t91RUl27FVrOP3V2tIs1ojrHFgsFAwe58yqKj4hYqFjC0klTqBM9a0IaZhFyFDLA1ouAqy+oGygnbbkKWOkZeRH2RbajUCQFRTtLwSVdJYwb7KjqIrcq7U0jmc2ltfDD+taNslG4HwuWM/8AD4w2fYd+y6v62IjoXE9guUfUJXxRicF/nuu38eulCS7POuaxo+r6OPc0aWOKqk2HdauxCeNkhDR3W0M0KhlTWShr/K1nWYS+d5IPde3cLnaits8j5XCfs9Is87Q9+q/KqKKWJmzvHlOq8MqI2loaqGSnq2ts0dl32JyNevpwuTiWezLxHX0w4IVXTTwzlrQOSsQfJWQyfEVV4fjb4HjWeCteXJU/j+lOrDmpm1+hKWJ1Q02+oLqLIeip3SxDSN7LkPoDqqMTsYXj5h3XU+QmPxmaEiTm3deY+V58Z1ySZ6F49jtTWztfLPD2MoInNP0hbAoIAGBa7ylxFtTh0IB+kLZVEy8V7L5q5aUlkS2e+ePUL0XRUMLWKop3tnGgqlMLyLHuquhpnRODrrAk9rs9KxaIqvoqI6ZrBwpRH5P8JQ8W3Sl7XbAKpKtMvQikUdS4tNmqKzrXB3VY+n1ndI2mAO4VWUOy3XEbR6nnS7uqxoaCG3UB0xHYJrpyBcBIoE+m0VZ9sHcpRpHB/tWuWqkDtipaesc82PlPSI30VssYIvdUc8Di4hVLZdQ3KcBG4XKkW/4N2tlu/Av13HhVUUQiZdxtZSyzwQtuVYMe6phpY3aX2t905fB8Wn0XStxinpAdTxsPKs1f1xRQAgyAW+61v13mb+GDw2a1h5Wpupc4qgSOa2pd/KkXZZjBNG8eqsw6R8LmslF/sVpvMTrGWo9xsU36brD35i1tfIWGdxBPlVlBQVPUDhqBOpKJZWkjXvVWL4vNKfbkdv4R0dTYpXVLWyajc91tulySlxICR1Ne/wBllnSGRH4KZsjqUA38Jj+mfbBlly66FlqnMdLETe3ZbWw3LJjom3g/pX3o7oOLC2scYgLfZZxR01PEwMLB/CZIKoswvDcu4aax9sfwsjwnp+KjtpbayveiNovpCjke0Xt/SaSvSWx0QbE3SOEySYRi7SFHI8uGxPCiETy67zsgido98r5TYpphub3SEW2TmvsP+SBVZt6JGRhnBUsdnC11ROne02KdDV6TuUm0PT2+yscNN7KJ/CUSiXcItfaylTeiVPSKWaPndJEwX/dVErHb7KIgt5R7C+xUwtACHSWNrd1AyoA2Pjyl9wOdcd0ew2UicyHwonu1G6QknkoTGyGT2hWfME+19kxnzBSN+YJn2RGL7Y8ppF9ipSCBchNfx+6lkSQWiF7QNh4TNA8qY7iyZocoH9LMUJHGL3uklADtgpGtLeVHN8ydEH9GyMGgm/Co5NnkKtl+RUz/AJimTJ6ymnHwn9FiXWW9O5p8FZbVnSCfssV6sb7kJAWbkL9Da43/APmTOVfUfhDaqlnNr3uuAM/+kA+sqHGLz2XpbnJ02/EaWUBt737LjL1AZdSN9+QRdj2XLZle0z3jxLIjVKJwB17hMdDI74bWWpuqKz2Xua0rfmeOByUFRI23crnvqSmkmqjH5K5TKx25H03wHIRdC7LZhTpq2uDd7Fy3pkxl3JjFTFqhJ1EX2WvMtehZcSrY3aL3cOy7U9MmUZlfC51ODx9Kr04ns/hPzfLfhoembU9N+Q0TxBJJSdh9K7Lypynp8MihLae1rdlj2ROW8dFTQj2G3DR9K6N6R6YZDTR/ABsupwMP9U2fMXmfksvyOMWTdJYMKJrWBllneGQM9oW5srXS4c2BmwV1wpry4A8LqMSn16PCOTzndY2VtPAA8XHJVeIAG3uqQO9t4uFK+tGjlaChrsxnKU2Pc6zS1Yr1fQivikjcLggq+/iy4kKkrIfeJ2UNnwmq/WRz3mTlJBi0r7097/ZYdhmQsFJViYUfe/yrqGp6XZWv1OjH7hQVHSFNEzeNu32VRtM0oXJdGv8ALfo8YRo0xWt9ltfChIIWstwrRRUNNROsAArjBjFPTuAJ7qSqS+CThOfxF+gp3Sbkfwq2JhjCtdHj9KWjfgKd2O0xFgRf9Vfi4r4zKtptb04ldJUaByiKoDxuracSjkPwuUkFQSdip4TRTtx5ornjWbqamOgFU7H2beyT8SAbAq5GSfZQnB7KuQgj90NaBuoY36u/KqYmE23UjfQkFp9iMF09K4aTa6aXBvKYWUloYRY2Qg7m6Eu2P2wSt5H6pErWkkFI2NfwejfuUHYXQmNpkTegQmO5P6obyP1SCbY9K0XNkie0gi3hC+jk+hrgAbBIpHcH9FGpBRQSDcJzTcXTE9nyhACoQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhACPBI2CAA0XISpr+f2TdvehH8I32/dRvOwtwpHixv5Ub9gApYlO1sY5oIukYRwnJuj4rgpZy0JVNphJHtfsmOibpuQE6pkLGgKnmqCIyR4VK2zRqVSk0DnRA6e6a7S0XdbyrTV4mYpbk2VvxbrKGniALx+5VCeRplqNM5svc0jHPOl6PcDd9Swx2YlDHcumZ+5Sx5iUdQdLJm/sVBLJRpV4FjXSM0FbHuNajdXR33cFi0fUYlN2v5HYqeCvlqHbHlUrMlNi24LjHsy6kqGOFweywfOZ2rBJXRchpWTYdM8M0k9liuaryen5iR9JVWdraIsSj0uPMD109XHDJKtj5bWJ2JXBknXravqsxe8d5PP3XaH/aGYVV1VdWGLUPidwuA6Hp6vj6wLnh3/iePuqN02j1Xgq1JJHfXpGo2YvDBJpvsF1/QMpcFwlriA0hi5E9Fpdh1DB7vgcroXM/ruPB+n3yslAIj8/ZZsp6ls7/AB8OVrSXwxvOTOehwUSQmtaCL/Uuacwc3R1A90MdZquT3WuvU3nxUNxOdv4u1nH6lqjojNJ+O4s2KSe93eVl5UvY9I4PBjUlo2F1B0vX9S1LnRMLtRVDDkdiEnxyUbj+y3fkt0zS49FFI+IEkDst1Yfk5Q1cDQ2lG4/Ks+EZOW0duudr4qKTZwx1BlHNhtI54pCCAey1B1jhDsPq3tfHbfwvRzM7I2OLD3ujpux+lcd54ZVTUFXLIIXCzj2ROL7Nrj/NPzTUVI0ITI6WwCu2GYeamLcKmxTDn4dVOj0kWKqsLxMU8fxeElW/Y7SrkI5dXZSYpg0cBLpGi36LEscZBBKXMtssk6kxx8xLIx/CxeajnxCYtIO58Lfw0zjPJoVyoehcF6nrqSsa2CVwsRwV1L6X+ssYlrqdvvvIuFz30blnV4hWNd7LjcjsuvfS1k5UxVlO80zuR2XQ46e0fMPltK9pHd/pjxDEKulpnPc76V2ZlvDM+jaSDwFzR6begjQUdO0w22HZdZdDYeKSma21tgtylex4jyMFFsyjD4pG2uFeKZzmtsBsqCjHCr2Os2wCuKs5K7tizTWFlTGa5sT/ACnTuLiQqV19Wyf+LsilDUCojLXyDbuq6FjS25HZWymJa9V8chsG3U8YaM+af8KnRGBtyke0W4SjcX+yC0kX7KTSIZJ6ISHA/Cla8uOklOcC0JsIBcpE9Ig9WTMIbypG6d7qJOa4jZJ7E8Gh1iT90paRuQkBsbpS8kWTPfssrsVum29kyQEnbykc4g7I9w9wk9m2OS0IWOsdkz2n+FJ7n2R7n2ThJMaIyOG/2pOW2ITfc+yUmzbqRELYaWhRvvbb+k4kk3KSxPAUi+EMn/BoaSbkJzI2nkJzWWsbpyBqS9hPaa0X0pzdAG6C64Aso3cn9U3tstJEhfG3ayjMgd8pKjkBJ2NtkBxbwnqPQvqiWN1nblPlIc3YqBryXBP1m1ika7FjEtWKxyk/AFBh0Mol+LhXWph9zYBMhpHMd8qc3sd6oq4GMDBcdlFVtAYbDspWDS0AlNmbrFgVXt0kI49FiqoX+7ceVVUbY2sGu37qrkpAQRbuoJKVwuqL7I5UpoZLJE0/CbKnklc4WapJYNO5UTPm4uoZVOSKdkVEc2jjnZ/mxg3HdUdd0vhtTf3Kdpv5CusBYAATulmDCb3VazD2uyFpaNX9fZT4bWUkjmUTTf7LlnPfJRrhMYKLextZq7uraWKqpzE7e4Wt+ucsqfGJHj2AQRxZZ9uG4/CGS0zyizMysxbDqp7m0zwL+FheEw49gVcHPMjWtK9JczvTBTYi18oobmxPyrnPNH05TYX7hioiLE76VWVUoAm0YnlFm1WYRLEJKsjSRyV1NlP6kKVkbGTV47cuXEWP9PYj0u9waxzdP2VDgea2L4NUhpqHCx8pVNwJ4S/h6ydF56YXiLWA1rTceVsbBupaLGIWyQzA3HYrzByl9QFY+aJklcew+Zdd5FZ1Q1zIYZqtpvblys05DHuWjpJwY7cEJGxajdrVbcL6lw+vgbIyZtyPKu0VVGWBzXDjytKqxSFWmx8ZEXxOUra+G+kOCoKypc8FjVSRtla/UCr1dyRNXJF8dK2QbJjw7nsFSQTE/CqiadwhIt2V+FicdjpS3LRIyWMD5lDVVLOAQqP3XE8qOZziR+qZ+fTFdKlEqGuLz9lBVljRyqiIARXKpK9zWsLr9vK0KH7dnPcjWq4vRg+Zde2LD32d2XFPqV6iljkqA1/c911rm7izYaKUB3lcTeoqsNVJPp33K77hqlCCZ5jy7cm0c2dXY9LNiT2lxO6p8Kw+or3N0Rkg/ZLieCzVeLGzT83hbBy86HnnkiBhJuR2XfYmd+CP04fJwHc/haaLLSTEqYH8KS4jwphkVWzxlwonfwuostMkYq2ijmkpybgbaVsvCcgaWSDek/8AirP/AOzRpf7SMqzx1y7SPPXHMjsRpwXuo3bf6VgvUXQGIYW8n8O4W+y9NOqvTnSyU7gyi7flWgs4sgW0DJXNpCLX4ap//wBsU69xkUH484T3o486fqJ8NrGtdcEOXR+QXWEkdVE18p5Hdak6sy9lwzEHObERY+Fl+UZnoq6NpuLELnOS5j/Ki+zoeL4x1SXR6P5B9Sx1NHA0y3+ELe2F1LJadrgRuuRPT51N7EMIdJ2HddO9JY2yppGWfe6855Sn3fuj1bhE69IycyO1WBVXTSu0i5VDTO907KrkJjZsubsXqz0HFt/VFU1xNt1LGQTcHhW+mqyToKuMEYLbg8qKS0jSgv6SAtIsghp22Ro0blQTTEHZQNJ/C1FP+BUAi1032i5l01srpex2VRCBosVH6pfCT4ikdSlx4U0NGGO3H6KovGw3P/NLNUQxtu54/lIRS+DT7cbdTuFZcXx9lE42lsAEY31LTRROaHjb7rU+YeYYpHPjZLxfugp3T0ujM8azOoaVpZJUAfusC6rzKpqiJwhqAf0K1J1fmHVTSnTOf5Vio+p6qtl0mYm/3T4jKbn/AEyXrHH5q8v0SE3+61zi2G4lW1X+W11rrYOEYJNi8jRpJBKzHp/KN1VI1zqa9/8ASpEtGnVb0am6b6Nr5XNc6J1/0W4ssuiZGGMzQE/qFnGA5MU8EbZDTWP/AKVmeA9DU+Hsafbtb7JS17RZVdJdK4aymHuQNv8AosgZgmHx20QAW+ygpIY6RnzbKV1fG36u/lNabZVsht7KhlJDHw1Nl0N3aFAMTjf8Acd+yQvLk1x2uyNL1HmYn4boc4kc9lC55BsAnxuLtgm+pDNifFc3UkZDvmKCBZI1unujXZVe/YHMBJsnNY1oOpA5SyC/7pr6HR7IZo2E/CFC+Jw4HdVHtk8H+kvtH7/wm+q2W4/Qow63xKpY1odwooW6dj5Uqem0Sf8AiEzNQu0KinY8E/oq7UdOlQz2O1kN7I5PRbJBIHbFVEBdbnslka0m9k5nyhIRuXZJGb7FS6A7gKKL/qp4+6H2J9Y0REG9k5rSDcpyEJaY5RWxXEEAAprtxYBKhSNbRLGK2R2IJv8A80Jz+f2TVA1omTQjr22UTwS4XVQGAi5KbIwX57JY/BrfeyJ1rbqmkA5HlVDxfhU8wcAQR/SZNNE9bRR1r27tvusW6iduWnv2WTVMTnuJVoxbC/xDwfBVK+LaNbCsVc0az6v6afX0r3+3e/2XNHqAy+dJR1FqffSey7SxLB2GjLNC0rnV0YKilmc2K/wHssTIx0eicDzDhYkeQvqe6MqaCrmc6AgAnsuX8VwUzYjobFw/wvQ31d5dSzyzaID37Lj3Ecu56XF9ToSBr7tXP343Z79wHkLVaWy95B9APqp4bwXu4dl376ZctWQQRSPp/HZcu5A4DBRuhfKy1iOy7m9PldhkVNGwubcAd02nGSkh/P8AOynjS0+zobK/pmKCKMNjAs0dlt/BMJEdO2zbbLXeX+LYfGGWkbwO62dhXUWHNhAErePK6XFhBRSPmPyPIybchsqPwThsWlV2HUrIhcnsqN3UOHk/+K3+USdRUTGBwkba3laleorRyMqbZvtFbXFrflO6oX1kcYLXvCo6vqmjLb+63+VZq7H4ZX3ZIOfKfO1RLFWDNrtGS09RG919YVVE1j37LDqTqFjXAF4/lXijx+Kwu8LOuvSHywrIraRkjYIGi9grZjlZTwRENcAqabqaBkZGsfysT6s6rDWOc2T+1SsydfBcTBunZtobjnUTKJzpDIAAsH6izmoMLmIfVtFj5WM5k5hyU1PKBJawPdcq505yVtDNK5tSRa/1J1dzZ1mLxjl/DsSn9SWDNIjGItv/AOpZD09nHR4y5ohrGkk/mXloPUlWxYhodiB2d+ZbqyK9SBqayGOauBuRy5X67eiW7iUv4ejGDY46rDX+9cH7rKcOqYy0Fzuy0HljmtR4nRRn32kkDutqYR1NFURgseDt5VyqxHPZ3Gyj8RmwqmSt0MO9lG/3Yze6sVHi8gkDgbq7Q1z6gAkK9Ca1s5vJxHAudA50mxKuLBpFz4Vsw1xD7W5V0O8d1Mp7MyUNMUlrhsopAnNJablMnkvwl9mInoQC5sl0nwkiNyLqRHsPT2hhjcTzb908Cw4Uia89kb2Mb/o3lFwOShMc7VtZIRtiHclA2KEIEi9skTmEC901KAbE27JV9HR+ji5pB3TCQOShNk7J48dceU9nyhQs+YKZnyhACoQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhACP+Upic87W8pvKT132MchHsJsmOaQNwqg27qKUgDnunbG/j2RaBbZKxtuVG+fTfdQyVTw74XKvZNoI0aY/EXtaxW2SdvtkFyfidS7Rq1LHsQxn8O1xc+37rJyL9M2sLElP4UfV2JMoonS6rWHlaBzdzxpenmyNfVadJP1LOs3uvoaDDZHGpA+A915zesnPybDjUiCvIsTw5Y1uVp9Hf8AGcBK+tNrs3H1J6yKKkrHQjErWdb51kGXHqfpscrGNFffUQNnLyC639UOKsxx7f8AEn29zjUtq+nT1PVTsSh97Ej8w5eqEsrb1s6GPjVkY/D226B6yhxqlZKJb3A7rY+ByxyNaT4XEPpt9QVLiFDC2TEGklo5K6k6LzDpq+CN0dUCSB3Tq7VKRj8nwl1de0jbMVTHE1YpmRVMnwmSIHkFPix8TxamzX/dWXH3zV7DGSSLcKxI5evDlXPbOI/VdlFL1ZUVDmU+rUT2XI1f6Yayjx41Bofqv8q9Xscypix0udNTB1+bha16/wAg8MomPnFC0EA72Ve2DaO34HJULFFs5TynwR3RVCzWzTpA7K1Z95se1hUtOJz8luVnGb5g6Shkjjsy11yLnZ1xJiD54mz+e6yrlo9n4apWxRzr6iurajEcTndG8m7jwVg2WHV02GYwySaQgB/c/dZNmJhk2I1D5HXN78rW1bDNgtQZWEix7LHuluWkemcZhSUNnob6X84sOAp4pZ27gDcrtjK/H8Ox6jjeyRpuAvF/JPN+uwbFYYjVOADh3XoZ6Wc9hPTU7Kis2sOSq1bmpmR5FgTspZ2F1N0VSYvhzmiMG48Llb1F5GCaKaWKmHfhq6g6ezDocTw9oFQ112jusYzMgw7GKGW4aSQVbnWpR2jh+KszMbJ9J70eWOa+Wk+D10pdDaxPZaoxqZ2GEt4su0/Uh0ZTNmmfHAN78Bcg5idNVJrHMjhNr+EymvTPZeL5WUKf2ZidHVHEav2wL3KzzofLKpxmeN7Yb3cOyossstKzEcSj10rjd3hdfZEZEumZA59BfcHcLoMKp7M7nOZi6XtlkyY9PT6p0b3UQ7fSuxshsixhjoHfgwLAfSr/AJG5FU8TI3PoRsB2XTPQGVVNRNjtSAWA7Lo8enR86+V8nW5y7KrKboxuHUsV47Wt2W4MFp/ZYAAFaunumW0ULGsitb7LJKWnbGA236rZpr0jxnkMqNknor6f5P2U8QLgP1UULQALBVdOAbK2l/w5yc1sbJAbW7qM0Zve39q4MjaeRwnviY1vHZSxS0Vp2PWi1mnMZunQyfFZVU8YDCbdlSCP4jZOa0Q1vf0rIpARyVKHNLON1RsDgbH91PFq73R6sGSfsmtYGm4TtrJzWm/xBHqyCUe+hqVvI/VODBfYJ2hyPURR7ERYXvZP0DyUwixso3ElS0MeN7+UikLQeUmhvhIuiRdIYhP0N8I0NHb+1Kk2MbGJ/wBH7I0N8Ids3ZSxTRE1sYnNaQblNUrWh3Kc+hPViJkrtO/2Uj2hrbhU1SXEXCb7CqPYvvgcJzXhyo2l5d3VTEOLo9iX4SJhYRvdSsA32Q9ursl31sVIiZ8wT0rIwDctRI0/SOyRyQ/fY5rQBuEbNF7JA/yo6iUabApjmhPVtjJajewKfDJq+IqicXajuqildtuVC5e3RJrrRV2B5CZNGC0nbjwnRuJcN0szhYgpjrIZvSLXVRlx27KFrC07hXB7G2vZU74wd0+FTZmX26KSR7g/YpC5z+/9qnxeuZREuLgAFaD1fTMdo98A/qrMcZMz539mQF5bySnRwxSfE9oKssHUlPUkBkoJ/VXajnZJECD2UFuIkxit2yHFsEo62LQ+Jv8AC1PmrlfQV9NJopWk78NW3pJLvtZR1eA02JQlskYNx3Wbdi7e0iaEvZ9Hn1nJkPJPJM6KjHf6Vzv1hkZidJO57KYix7BerHV2TlHibXkUrTf7LU3XXpsgkY97aAcH6Vj30erLUFr6ec+G4VinSk4fIHN0rZOX3qCl6VmjEtYW6SPqWdZ4ZHTYTBK+Gjta/DVyLmfR47gNbJ7TXtDXbbKktpknR6D5W+r6nrzHC/EO4+tdJZeZxUXUNNGG1OouA7rxcy3zSxzCMQb7s8gs4cldnemz1BSOdBHUVp4HJVqFvqRt6PRvDKqKvY143uriKaMNtpWn8uM5cMq6GL3K1u4H1LYmFddYZiDQG1TSfsVYWVFLsnqlFfS9RQaHf9FLVECAlQxVsVQ0OjeD+idUNfJAQOVqY2SnXoc1+/RbTPZ5CqIW+5Y2VMKKUTHUDurlRwta0XT1JykW42esexZInCAn7LFuqMabQRua53AWX1Ra2Bx+y1bmZUSuc4RErpeOS62c7yjc09Grs3OozUxSMY+/K5jzLwGoxmokIYTcldA9aUdTVE6mk3O6xGLoJ2Iz/HBe58LuMXJjXA8/zMKU570c54Vk/U1WIh/4fk+Fu3LHJgxmIvphtb6VsvpbJ6B0rXuoxz4W2ujstKena0imGw8KW3lFCP0q18VuXaLXl10E2io42OhAsB2WwqHp+Cmit7Q/hXPCsEpqOJrGxi4VXLBHG3hcxk8hO+fTNWHEQ9N6LBW4DTVDC10Q48LU2b+VcOKUspjgG4P0rd+lr3WAVDjWCQVsDmvjBv8AZNrzbKl9Kd/DwlL4efWZPp9qH1EkrKTa5+lYPhmV9XglbrMFrHwvQfqTK6gr4Xk0rTf7LUPW+UEVIZHx0gHPAU9XIOX9IquK9X8NYZY4xPg80UbnEWK6byo6ndWxRsMl+O65xPS8+HYkA2MizuwW6cmmzxSRtINgQprb1OB0WDiuGjovBW64Q63IVwfB7jeFb+mCX0bb+FeYtJNiuYvlqxnVYlfRa5YDA+4VXSVwaNJKfX0peLtCpGUMuvUL8qJyUvprw0louMlS17f1UQi9w3sovaexu/ZOjrYoP/EeBbym9JdFmtlRFTNZe4TaiQQMLnFRSdQ0MTLumA/dY11R1vSQxOEdQNvuoZMd+39KzGeqYaMkmS37rD+oM04qdrmie3PdYd1xmFu8RzfputUdSda1k8pAkdz5UMn2RS+Gx+oc2yXOAn2J8rAuosfmx2QvZJe/3WJTV1fWSXu7c3WRdKYLWVmkOjcQT4T4LZTvjtFlqemK7EpfgaTv2V86Zyzr9bXOhd/C2j0PlwKvS6Wnv+y2bgmWlHTsDnUwG3hTKPZWUfU110Fl++HQZYeLdlt7pbp2kgiaXRi4+ymoumaejaAyIC32VbCRTG1rKZLoljb6fS4xU0DGhrWj+ESQgAloCphXsa25cm/4pGdtYTPSW9liOUiCtEg2bdW4tne+26u0s0TwSXb/AKqlGgSXCkS2Sf5EWyOlo5WvDnFVxaS0IgeHAACynZGANx/KbJaGu1S+EAjcTZTxR6AnsY3Vwn6W82TGtkblsik7JjnBouVJNZo2KpnEvda3dN9SNrbJA8OGw5UkZ2soWAggfdVEbD3CY0SwiOawDlPEYIvt/CRHuW21f0m+rLCWhHaWGyTWL3TJnlz9im3Pkp2utD97RI6TY7KNx1G9kFxIsSkTH0QSe0RoG5sn6G+Eoj7hqCAWNhAv91LH3TGA2tZPYCOUfSWOxyEOIaedk1zhpJBTlF7J4x6GpWmxumtcSUOPH6qWXwfGL2OcQTcJ0TSb2TFJB3VaQPpClpAuU1wuLKR/H7piWK2NcuiBzbcqGYB36KackGwKhcCRZSuGxYT0U7oLqkrae1yB9wrm1oA+IKGpp9YOygnXtF6m3TMerNOgtICwnMDCoKyjka5ouW+FneJU5aTZqxLqOJ0rXR6eyzMiraOk461QmpJnG3qDyhGMulc2mBvfsuR8x8j5MNrHy/hOHH6V6kY9l9Bi8TnTUwNx4Wgs6sk4XRSvjoh34Cwr6Umem8Ty/wCNa2cK4RUHpQhrrN0rY+XvqEbgUjWGr0gW+pY1nT0RVYNVTRxUxFieAtB9T4tjOD1Z9syNAKqxhpmvlcn+evWz0Q6O9W9PDGwfj97D6lsHAvVxBM1o/wAQ/wDmvLPAM08apyGmokHjdZ107nLisWlrqt/8q/TL1RxuXiq+ez0ok9VsDXA/j/8A5qWT1YUrotP4/kfnXnmc48TkYCKp38p8Ga2NTSAfiH/sVPO9ojo4hN/D0JoPUnHXyBrK29z+ZZVgmbEVdGHGovf7rgHofMTFHSMMlQ/tyVuLpTNGSnpWmSqtYdyq08ppGnVwvt/Dq/8A+0mniIcZv7UpzhpIW2/Ef2uU8czybSRm9dx91hmI+pRscxZ/ifB8rLvykXoeNyn/AA7VlzlgmNm1P9qmreuosRgNpr3+642w31EtnkH/AOIj/cswwPPaGWIB1eOPzKi8lNl+vxhx/htLMGr/AB8UrGOO4Pdcu58dN1dRHK6ME3aVt2fNGlxE6RVtN/usa6qpIeo2ENs7UFdqv3o0KuI/D9Rw11ph2K4PXvl+IAEqbL3OWs6YxNhlqHNDXfmW9M1slJqyCSWGkuTc8Ll7M3LvGun6t74oHix2sFqVWfqU8vFjFnb2R3q+ia2GCSvO1vrXX2TnqCpMfjjH4rVcD6l4m9BdZY7gmJtjklkbZw7rtH0w511MD4W1FcRsOXK5VYc5l4if8PV/pPqWmxKNj2vvceVmNBWQloAK5byUzZixOKBv40G4Hdb86dxw1kTXNlv+i06p9HF8jg9toz6jqGs3VfFWsdYXWOUMkhYCSpW1UzJdz3VlS0cpfR30ZBJUAizfCRjXPVBTVBe25KuNM4OG3hP9jMnXpjoxpOkp6Y7Z2yVrgBuU4bsk9wdwmk7kpNbfKQvJ2CcmhrlpCOdc7JEITiIErWnYp2hvhLwnJaHJaHR90r/lKRhAG6V3y3Th6QxCEIHgns+UJGtvyE4ADYIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgTaBCEIDaBCEIF2gQhCABCEIE2gQhCA2gQhCBQQhCTaAEIQjaYAhCEoAhCDsLoAEJNY8FNabG6AHoSXuLhAde+3CAEk7Jo2N0rnXTHvtcWS/wAIXrY9ztShncSLH7p7O6jqBqabI9ei1DTaLfWT6GkhU0dcw/On4ldgJKx7Ea50TiWkhUMjaNSnG/N8LhjWKRthNiFrHMPrMYZTSyB4FgTyrr1N1QKeB2p/H3XO3qBzagwyhqG+/uGnuudy7Ejt+C4WyyxaRrj1JeoH8FBNTCqAs0j5l5zep7MmbqSSfTNe7jbdbG9UOdrqqtnjjqT321LkrrXrY4pK9r5SbuPJXOZGVFdHvHAeOTlFbRp3rlla7F3ygm2u6vGXPXtT03Wsc6e2lwO5VbjGCsxJzpQ3chYdjuBVNFPqjJH6Kh+R72ekQ8UhKn/U7s9O3qtfhnsxOxACwGxcu4ciPVizEGwRmtab2+teIfRvWGK4BVtPvuAH3XUHp79Q1RQT07Jax2xH1K5RdFnMcr4mo1v9T3C6DzfpsYpGWqGkm31LYOFYq2u0uNiD4XnFkN6l6eWKESVx5H1rrrKzPHC8WijYKoEkD6ls1WqSPHuc8dePJ+kToWBlKyl1uA4WAZrzUww+Ujb4Cr3hvVENfQh0Ul7t8rC8z55JMOls4/Ke6mtcfx9HLcViWV5q9jhL1d426nknEb+57rhzr7G55qya7ifiPddo+rmklnkmIB5K4i67jMFXKHj6je6wsnXqfRPimM7FEwnHJjO4kt3IWA9X4S+W7gzus8r54/e2VqxmmiqojZq562XfR7xxXG1yrXRgHT0b8OxNkoOmxXSeR2bxwMQx/irWI21Ln3EcOdDKS0W8bKXCcYrsLeJWyOFj5UcZr2/YOU4KE6fh6WZZ+pKJlOxslaPl7vWe/wD230uLU5YKpp1DjUvMzpnOyuonCL8U4W+62l0JnzVPlYySrcSbfUrkbItdHmubxMKLd6Oks05I+pNWmx1LT+J5LSYxVlzaYm57NWcdA9T/APesxtLtWo+V0BlhlFHi2iZ1OHXtyFax6nNmRk8lXhp9miso/TpNBVxSfgjyPoXYWSWTEdLSxe5S2tb6VmGX+R9NS+280be30rdfRWXcVLEwNgDQLcBdJg47X0878g8oqjBpMMsOgoqNrAIrWt2W5OnOnY42N+C1h4Vq6VwJlJYFgH7LOMLhbE0G3ZdHVFJHgvPctZk2tpjoMMEbBZqcyieTeyuEb2vbaymgbGwH4VfhrRxU8me3tlBHEWHS5SMeI+6mmi1Pu1QTxuCkRV/I/YlFczzdSsq2v2urRLrabm/8pYKlzTZSRFlOLRdiRJ8KBS6eyp6Ocl4JVxID9wpOmR1yKYQWNyE8DcBTlotb+1G9wYbFOWhzYmgeU5NErSnJf1GaYreR+qeo0I0g0x7jYXTLk7lCEzSJFoEIv9kJriK2tAhCQvLTYJyWhjWxUEXFk33Psk94arEJ/sJ6sX2x3KeHaUgIIuEr2bcpHJaESYkkgc2w/wCaic0O5Ti0jchJvdROXY7cUiEQEHYKWOM7X/5KQPalDgTsVIuxvuhGt090qUNLkOaWo2PUhEh4KHBxHCGgtbumTeh+0QzEi1iqfUXGx7lSVTyTYD+02FhLgdlDJ7HqSaFNMHDVbshtotlVNaPb3HZU88W+oJ9MfaY2U1Fdjmzhgv8AZIalr3WJVHJPpOknvZNLyPivZXpU7M++5NdFZI4WUEjwAU2KqEg0qGWT22kuKfCCMfIv0tmGZm4+zDad7nPANvK0VjmbraWvdGyp7+VmnqNx99NBKI3/AEnuuNutswZ6XGXsdMfmPf7rVowp2R6RhzzIqfbOv8vMwji0rWma9z5W7unX+/h7ZNXIXEfp764dW1cIfL3HddldA4iypwiOz9y0JmTg2VLbRNTkxkZD7LTc3unUFS/39BG3Ca12m6KaaNkl7LGnT2auNYt7K+RzHbFUOLYTS1lOWvj7eFJNVtDtV0+OpbUsLW24WRlY0pb6NOFsJLs0Pm/lNBj0cscdPfUT2XJecvpFqsQlmkZh7rEk/IvSGbAYKl5MrAR9wrZjeW2DYtA+N1Mwkju1c/bjWRfwf6yl8R46dVemWs6dldK2kc23+lUPTmKV3QtWA95boPlej+evp7omUkksNIzcEizVw5nxlLiGGVExp6cizjwFTk3H6RyhJIvHSHqqlwgRwur7advmW8MpfVQcUlYDXA7j6l539QYL1JQVrtDXgByz7J3q7GMEmYal7xa19yqk8jTI/wAij9PXLKrNNuOwsa6YG7R3W1qCq/ERNeLbhee+Q3qAgoHxtqau1gL3K6g6F9R2CVkUcJq2kn/UtLBzFFEkL4p7N2TBoF1Svro43WBVhw7MLDsYhvBKDfixVXTskrJNbeF0mLbCbEsyE3pFzrJzJSm26w7HcBOIklzb7rNYYLw+24JgwhpvsN/sujx7oVxKdlcrfppzGsuW1Dz/AJXfwocLy2bDIHGI/wALckvTsUu5b/SidgMEJtYbfZX45619KU+Mk3tow7AukIacAujsQe4WV4bh0VNHYBTx0LWn4AP2Uzv+HtcdlDbkOzrYxYka/qKcxubJceUTs1jSTZVV2uZqsoJQXn4QqMW1PY/8S10Q09E0G91JLSRuFiVLFG5uyJo3gagVLKxa+jXQpfwpJMMifGbjssQ6u6OhrY3NEf8ASzdshaNLimvoW1F9Tf5Vf86i+gWHv4jQeJZUCSsMghPPhZT0R0QcLe13t2t9ltD/ALp08x1aQpB01HTD4GcfZXFk7jovY2G0/hHg034WnDD2Cq24qxkm7lSvong6WhRz4VO1vub7KlapSkbEMf1RfqapZUtDgb/ZVDWHsFjVJi4w0f55tZOnzHwin2fKLj7prjIco+j2y84nIKeIvI7LXfWXXQwxzh7lrX7qfqnNnDDTvZHUD+VpPMjrr/EXv/Dym58FRtksbIpl86hzr9hxYyptv5WH4vnI6raWGqvc+VrHqOvxOWc6S43Pkqlw3AsYrpQ4NdYlQykiZWxZn5xybHH/AAvJuq2j6CqMUId7ZN/sky76OrCWe9GdzvcLe3QnQUckLHPjA45CZvY1rfZrLBMmKiYNP4Yn/wBqz7pLKZtCxokhsR5C2zg3S1FQxt1RA2HhVzsNga4OjYAB9lJVtPsjUd/THunOmafDGAlgFvsry7EKaH4GntwnYh/lxFsY3WM10tQ2e9zyrcVsitrSXRkzKlko1NUNQy51WVBhNY8s0uJVdPMBHqspF0zMubXZbcTrRAwjVwrFP1M2nebyDb7qPrHFTTNc7X2K1j1D1l7MzgZO/lTxj7FGWZCv6bYg6rjl29wfyrhh2Kw1LwC4fytE4fmAPeDTN/azPpnrASPb/m8/dJKHqhYZ0ZvSZt+kERaC0/2p5Ji3hY/07iTquNri7+1fH3lZtyq702X6rdga0Dkp7KxrmgXVunD4nndSUjXSW3R+hbi/ZFwAEg3/AKTTT6dxf7qWBgYN1I7RbZRNrZPGv+lPHBc3N1Usa3TwmamjZAeOAU1vZKoaHuYALqBz7OOykc8gcqGZpIuEJbH+r0ISHG4QU0Et2IUkbdTuUNNA+kL7e190ntjuVO2M2HHCR8ZvumNNshkuiH2/unDYWQnBgIvdNI1BgwC906210NbbYJHO0jhPSWiSCaGlxPKY476UrxcJg52UkSxFoe0AC/lDu36pUJX2h0QTonFpsE1Pa3T3Vdob9JH/ACpiUtIF0ifDRFJdDJGAm6ge0A3BVQ87WUTmbEnypkQqTTGNZqtunyR2bv3+yQHTv4T2yCQf9EkossQsW9ItOI0ZeCbKw1/TrpnFxasyfAx3ZRSU0IBu0LPuimjRqyp160YLLgDWRlpZ28LBevugYMUppGtiuTfstxV1Kx4LWt+3CtU2BMnJ1NG/lYuTU2bmJyzre9nB2dPpqmxirlfFRE3J+lc15nekOtMjn/gXd/oXrfiuXOHVzSZKdpv5CwLrXITC8TYbUjN7/SsuVckzcp5n362eP1d6ZMQw+Q6aR2x/KqI5OYjQSaRA4W+y9Lus/TbSQ6y2jb3+laxx/wBO7DUEtpBz2aiO0zXozoS+s46wLKPEKtwaYXEfosxwnIqr0teaZ3H5V0307kVFSPDX0g/2rM6XKGjpaYSPgaLDworpNI6Tj7qZy7OTocsqnBIfcMJFh4WPdUdWT9ORubrtb7rpvNXpeiwrDpXhgFmHsuJfUT1XFQTzRRvta/dZt1zj9O547j1e00WPrzPqan1M/FDnytS9ReoOSOUubWb3/Mtc5m9bVUkr9Eh57FarxXGcRq5nWe636rKtyEzt8DhFJLo6e6d9RVS9wP4vj/Usvwz1PTUzQ11aBYfmXGmH9R1tBs5zv5T6/r2ujGsSOH7qGE/aRrz8fUIb0d4dNeqT3p2B1aDc/mW/Mn82aXqZ0bXzNdqIHK8l+m81q+GujYZ3bOH1Lqn0055upJ4WzVZ+YfUtKqevpzGdg/j3pHpdB0hQdTYaNMQcXN7BaxzT9Kjcdhkljw+5IP0LMfTdmph2PQRRzVAN2jkrpfAsEwfHaNrtDHam+FtY25RPPuWax5bkujydzI9M1d0pWvqG0Tm2N/kWN4J1hW9BVjWOeWaTvfZemHqOyNwyswmasgpW3DCdmrzJ9UmCu6WxSZsUZbpcdwFermovTMedSvj7Q+HUHpq9TzzVU8D6sbEDdy9BshczIuo8NikMoJNu68GckM358M6kigdM4ASeV6i+jXOmGpw6mjkquQPqWjTajCzeMsnF9HotguIsngBuOPKmMrTLa6170N1tT1lM3TNe7R3WaYfN+JLZQ64KvqXslo4DMwZ41r9kZBRs+G6rKaVzDsFTYZZzAFVSaYt0/bOdu9VJk5kJSa3JjZWubqCPcHcKWOzMm/26JWuLuUqYGk8JWsINyU4Z2xyc5lhsmavisFOGXF7p6+D1DaG2PhFiOQnF4GwCa43ubKUkUQSlxIsmtdqNrJwBJsEC60hErWh3KXQRueyUODuEAKNhZCEI3oAQhCTaAEIQlE2gQhCA2gQhCBQQhCABCEIAEIQgAQhCABCEIAEIQgY/oIQhAgIQhAsfoIQhA5/AQhCBgITdZ8BOG4ugAQmucQdkrXF3Ka29ki+CoQhNAEIUfvDVa6E9BrZIhN90fb+UGTwE5SYkvgupvlI5wtsU1I7YXTgiKCDwUKJkljune6Pt/KCRxJA4ja+yVndMa7ULpzXaeydrojmtCJCwE7gpRsbpwkaTZI2RJbG6dI4sqeWVu7b/AKqepk0tsFbJJyH2PlLt62WK5afZDicbpGGwWJ9QsdDG5x8LLppBID4WN9WU5kp3EDsVRyWtbN/jrErEjRebXVD8PppQyQ7XXFXqc6/qn09SBMflPddg504PPLDKWg91xh6hekqipjqGlp3v2XI5/wDT2rxWcZSitHn9n71VWVGJyn3HclaVqcSlmn+Ik7ro3OfK+olrJZDETz2WjuoOi5sNnI0cHwuQyvp9J+NURnGPQ3CmCeKwFyR4VJjXTMlYwuEf6bKbDZn00gjIWT4f7NVEA5o4VB5DXR61g8dCVS6NT4j01UUri7RbxZO6e6nrunaxr2zOaGlbI6hwCCSFzmsC1t1JgzoZnaWd0+nJ0zL5fh4OD0jduVHqRrcLqIof8QcLEfUux8gPVJKZINeJeOXLyzpKyrwurErHkWd5W5sns3q3D6uJjp7abd1t42U19PGef8f99vR7mZIZ2sx/DYWvrgS5o7rP+p8WjxLDX2lvdh7rzi9MnqPFLDTxzVgFgOXLrPpPPGhx6jbD+KaS4fmWj/kpxPK8jx2dWR7pdmqPVB08KlszhHfc9lwxnF02+nnmdHCbh3hekmaOBU3U9C+VoB1DsuTc6cnn65pBTkjc8KhfNOPR6R4vZKicYtHFNfTTxTnW02TYRG9tnLYGY3RBwqSRwjItfstZyySRVBiAOxWK69tnunH59ddS7GYhhccxJ0qyYthvtxlrAskYXOZc3UNRhoqxbTyo3j7JeQ5mqNWtmuamKtjqD7JP7LNMuziZq4g8O7d1dMIy3kr57shLrnwtt5XZD1tZUwltI43t9KtU48m0eSc9zle32bc9LmEVFdUU4fGT8Q5Xox6fuhIpKCJ8lOPlHZcr+mjJCswueB76Zws4fSu/ck+lRQ0MbHR2s0dl0uBiM8S8h52WnpmZdM9G0sEbL0448LMMKwGONg0RABVGC4HqY2zeAr3S4f7DQ0hdNVSopdHjPIcnO6b3IbheHCOxLVeqaNrBuOypqaMtOw7qqGu2wVqMGmczkWNkokDDYFTx1AI5VEA4uBt38KaCN5dx/StQT0ZM+yrY0uNwLhJNTl29lLE3SwBOsebKdLRElstdRSu2Fja3ZU/sFu6vE0TS26pJqfnn+E4Rpv4QUjy2UNJ7q7McQ0EFWuKnc2YG3dXOP/wwE6IsE0SF3w3B3UEzgSRdSKKZu9wU4kEYQL3KmBB4Kgawu4UkYsbfZAD0IQgAShpO4CGgE2KeBYWQAjW2G4SOYLfCE5CBv/kRkEGxTH8qV4HKYWgm5QSRGJNAcUqeGgG6bIcDAQN04uJ5KRK5obwmsjkRvcRe52UT5Be11NIwOBKgdGdXKY1pkE+xbkcFSAnkJvtuSi9t1LHZFFS2TRuB7p5t3soA4MF78pTNfkhOei1GLJHBtrgJvKb71xYI9z7f2oJPsc+iCoY1ztksUWkAlLIWg8oDxpt/aWFbkyGVqiPLrDlRyPu0hOLxaygleG3IPKnUPxrZDbepR0UU0TjJf79k2Zr2xEHwqouaTqtvdQVco0lW67HYujHvtUIt7KSCbQ4klUeL4n7MDzr4CfNMIwdJWJ9ZY8KWmku/sVp4uM7bEtHK8jyagn2aS9S3Uf8AlzD3Ox7riXMbGScac73fq/6rp31FdStmM1n9j3XIPXle2TE3O1D5vK77j+Mfqno463l17/Tcfp96tdR1cP8AncOC7hyh61FThkLfevsF5wZQ46Kasis+24XZORvV2qngYZR27pnKYCUH0aWDySfezqvDKz8TCXXvdOMc3ulw4Vj6LxVlTSh2ocLJYpWOHm4XnmTU65tHYYeTGxLTLfVyvbyTypcNqnNda+10+thD9wkoaWzrrNsjtaNeqyPsXeCVrmAuUocxnxgKliBAAClkDvasOVl3UuX8Nei3SLH1pgUfUFIYfZB+G3C58zY9NIxr3H/gQdRP0rp6hicb6gm12HUtWwtkiB/ZY+Rx8pd6JZ7cdnm71/6PHiSSRmG8f6Vp7rLJWp6Oe5wpC3T9l6u4/l5hNfC+9OLkeFzj6g8jIKuOQwUu5B4ase3jZbMq+J53Y3mHiHRktoZXN0m3KyfLD1TYlHVxiavcLO7uVVnvkBiUMsj46V1gT9K0m3oPGOnqwye28aX+FFXQ6X2VlJxR6S+n71BDG2Qslrr3I5K6u6H6opa6jY/32m7fK8l8isxa7pueITTEaSOSussu/VPBQU0cUlaPlA3ctvFt9Oxim/Y7jgrIXsDmyg/oVUx1UQ+Zw/Rc3dJepyixERt/FtN/9S2V0vmTDjxb7UwN/BWqs5aNTGt2+zYFXWllyxUAqJ6l9gqvD4xWwh7j2VTTUDIZAbgqavK2/pqrTh8IKene22ocp74Y3/MFVVBYyPV4VG2rY55BWnC3aM66r9hHU4aNLQo305abhqm/Ex6tN1KGtc290+T6Kv4NlGGu8f0gh7hYhVEsYAuLJlwwbqrNskhRoiFISdVv3UzYw3hqQVUbdif7U1PaoPwqD2ey3CgdDMY9i39FOJY5BY2SOo9Tbg7q0YtiDsMBLjayng9ouQgki7up4Sb7BMq/YjgJc4AALAcazVgwxx1zAW8uWI9TeoGljgextS3+VOv/AOpPFF9zO6qgwqB7o5wCATsVznmBnpU0FQ6OKrPJ7qqzLzfdi8cjYp73vwVo/qKHEMdrS5hcdRTpSQyaMybnhX4lMYjVONz5WRdPzVnUTg83IK1x0hlziU1U2R8Ttz4XQWVGXkkbIxJEf9qrSZU/G97KXBcpH4tZ76Ym/kLM+m8kXNe0fhNgPC2d0b0hDTxtD4uw7LNsPwSkpgHCIceFBrbJYQ12a56eypFCGuNOBb7LOsCwkYcwN0W2V5LI27BigqTob8IUka2S70SSVUbW2vuiOoa5psVaal8l+6kpZ3Ab9lL+NjHYolZOz3R5VsrcKDnagFcYpTb4lFU1DWjcqxBNdFG/J1Eo6OibCbp2IvDac6eyU1DbGxVFidVandY9lYhBykYeVmqMTW2ZuNexHINfF1z9151saaWT/Ptv5W1s58YELJTq4uuUs1esPZqJR7vfyt7FwPfs47O5DUt7Mrocy9NWB+J4PlbOy768/FyRgz347rjun67P463vd/K3Tk31aKieIGXm3dS5HHfr8IcTk/2R25l/irqmljLXXus5pZHGPdanyhxETUcXxX2W1KOQGO6527G/E9HYYOYrf6OqYXPN0+iiexwuEr6iMfMpaaaJx2Kr+mls3abU3sm1PbtdI+VwG9/2UutruU2SHWNioWtmrXYmiEPLnbHZPaSDymuY6MnZMdPpNioXtMl90VLiCBvuk0hw3IUbZw4qdhGkbhSxZG7NIZ+H1bgJzIyzkKVnCCARYpG2Ce1sZ7tttX9IDi7vf9kjojc2vz4StaWJAD2T4TwLNtZKml5BsowEd8J2SEA8hKSSblInr4AwsPFkNit2CehOT0A1zbHYJtj4UiE7a0SJ9DWt/ME9oBO6RPa3TvdRyYjYpAIskLRY2CVCanoYRFoJ3TJBfZqlcLFM0BTJkEov+EOknaxTXExbgKp0N8Jr4A/un739Gw6lspjOfumSTkgtB/pOng0bEKFwsbBQWV7JnaN9sON7bpTTjs1Oj8lHuEEgBZ9tIK7v6Mc6nYzS9ovZW+ujgkuGxjcJ9eyR0hLSo4qd7iLlZtlLNLGtW/pjmO9L09exxNODdYXjOW9O6QuFKP4W3/wDXxkFqtuKYVHpPw/0oXjf03cbP9Zepp6ToanpfiNOB+ysfUdOKOmc0MAAW2cYwxrWkAdlrPr6nMcD7DyqN9LUdna8Jk/luUTmn1FdQtpMMnbqtZpXm/6kurGy4jM33eSe6739VVRJDQ1Ia7cNK8z/AFC1kz8Wm1OPJXO5aZ7747CDjFGoOpZm4hO4B17uVFSdKOnaXBnP2VRTxiaoGvfdZvg+EQtofcLR8qw7I6Z6vxuPDrZrbEOljEfiburHjPT0jmf5bbrY3U7qeJxFrK24LhkWL1Iha29z4UlK2zZylVCvTNZR9PV0NSJRE7Y9ln+XHVFfgNSwue5ulw7ranTuQT8bpmytpCbj8qg6g9P1dhIMrKVwsfyrThFv6ed8kq5yaRv30yeo2XDaqCF1aRx9S9F/T3ndTY7hsIfVgktHdeN3RFDiXTOKMGpzdLguyfTPnNPhMcMU1VawGxctGrJ/Eujg+R4h5e463s9Bs0eo6TEOnJgXtN4zyvMD1s4XBU1tVKwDl3C6x6pz+jqcCMQqxcs/MuNPUz1jFjBncXg3J3ulnnJy2U8Xx6dFajro5JocVOAdUCRspbaXZdoekv1Auwv8PC7ELWIHzLhHrrEWwY0+RjvrWcZIZlzYfiUUbai3xjv91Zx832f0r53HOuDTR7k5CZ5DGYYWCtvcDuur8vsadiFDFIX3u0Lyr9G+Y8mISUzTPe+n6l6Y5JYj+JwWneXfQFv4+Sp6PJvIcRJSlo3NhBaYgSVPVOa4Wv2Vsw6qDYA4KZs5lksFoqaPLsit7bKmEu4Cku4ckqSmhBjUggHJViMujJcX7DY3OF909oeTe6Y5waN0sVQwOAunJjoppEzGNNiQpQ9vCja9rhcFKn7Y9vQrubpDuLIQpFsPfQjWWO109jSDchI06TeyX3Psjb32L7bQrnCxF0kfdNJubpQ4t4T2hE9j0IG4ui4HJTJCghFweChNX0AQhCkG+qBCEIFS0CEIQKCEIQAIQhAAhCEACEIQAIQhAAhCEDH9BCEIEBNc4WITkx3J/VAsfoiLkcFCcwA3ukfweJc+SkuTyU/S0b2TXEE7Jgj7ETmOBFk1A24QCTQSO0u4QggO5TmDm4TfYUagmwunuA08KJwcTt/zR7ALrFr2VJJKWyXHF1O42byqZw1Ptzump6Y6H9JWSl3n+VKomR2AICmYA5PT2hJaHt4H6JsmzbpbhosSmTOu06T2T4/BEyAk3uCl9ztZNsRyEAXOykiS76JmOBAsnDY3TGNIsSOyenEEm2xXyADa6i94h19/5Th8WzioZ2Fr7hNf0hUtMWeYuburdMC59wFXW1MsVE2l+K5CZN9FiKbKN7i2MkhW7EmNqIiD4V2xBgjjP2VnmcXA77LPyGaOFKX5UaxzI6TZXwPAZe91zBnZlWJmTP8Aa7Hsux+pfZcx2u3K0hnDS0opJn2HBXMZ6Tiz2LxDLcL4waPOjOfLSKmdKXxDg9lynmp05BSyyaWD5j2XcPqRxSjpXzMaRwVxnmfUNrZ5A1t7uNlx2Wm10fVHjWTGMYmkq2BsFS4AcFXHCK4Ns3Ulx7BKr3nSshNv0VshZUwSWMZBuueu9vbR7dxeXXKpGUThtTBYnlYzj3TTappLRurhHiUkbA111OyobO25HKjjKUS7lxhbF6NaY10s+F5JCjwJsuF1IeHEWPlZt1DSMkBLW9liVdSTQuLgLBaNORJa2cRncZCxvo2ll3m/V4FJExtS4Wtw5dO5E+ouolqYo5K1xFxy5cBxYjU007XNebArZ+VGYUuF1DHuqiLO8rRjkvXZxef4/XptI9ZuhcwqbqPDGNfMCS0d1T9f9M0eN0T9EYJLfC5XyR9QkUAjgkruw+pdI9I5k4Z1HSMZ+JaS5vlO/OpLRzEsCeFZ7I51ztyeqJGzPig5vbZc4Y/lfiNLXOvTHZ35V6T4x0HS9UQn/JDtQ8LCsX9KEeIymRmHA3PZqkrimWJeQfgjrZ5/ydF18TdIpjt9lXdPdA4hVyhppju7wu2Kv0byG5GGH/arn0v6Rm0s7S/DO/5VdrojLs5nlPLH6tbNB5OZEz4jOwS0vJHLV2DkR6XaeYwvfRt4H0rKMrfTtHh0jC3D7bj6V03lXluzCYo70gFgOy1cfD2zzLlvJHNN7LHl7kLRYNDGW0rQRb6VtnpnABhDQxsdgPsrzhmFxQxNb7QCvNHhMT7HQukxcRRPMOS5ad+9lZgE7AxoLeyvbIWzNBAVpp6RlLY2V3o5WmMWWvGnUejjb5Ny9iaGlDdrKZ1OAOP5TI5dXHKqG3e0fdCgilNv+kMcDb7qZrGt4CR8bx8qc1j7bhO9SnP6SDcXTg4Btk0XAsi3/wBXUiW+hUgsDyEz27ncKVgBG6XS0dkaaDWyJsDNQNt1J7ZHFk6w8ISxD4I4XFk0xnSblODgTYFKnARNaW8p5ZYXulLWnshwJFggBiE8MFtwjQ3wgBUIQgAQhCBuuxHi4TE93ylMQPT0I5pdwhoIFilQgX2HR90SdkM4SvtZNaGtjEgYAlRcDkpNr+jJJNhp1bWQ4aQRZLrYPlsmSS7f9U8RQ2Rv5/ZRSSFvCkcdR2TXRA7uCjk2i1BeqI2SuBCeZCRxv+qVkF3cbXTpKcjceFHH9mR2JJFNJLvumtrI2bE/2oMTm9lpsbLH8Sx004J12t91p49Pt0YOVc4fDJpMQhby5QSYjC4f+IFrzFOunwPLRNb91Y6/NM0gu+qt+6vTwJfjMW3kfWXZtkV0LnECRQ1lYwNNndlp6LOFpfcVf9q4DNFk8Oo1XbfdTYPFXSWkjGzuXjGD7M1xPFI4Y3Fztv1Wp8zerGRxygS+e6k6hzJAidapHHlaSzVzNaI5f+J337ruuC4K2V25I8y5nl/vZrjPfqYSumtJfnuuYescVc+tc4O+orZWa/XX4yWU+/e9+60njuLsqahxD+69Uw+IjGHw4afLSlZ9Mzy9x50FYw6u/ldXZE9YfBC0ynt3XEvTGKupqtrte110Dk11uYHQgT23CyuX4v8AV6Rv8byrX9PQjLPqVstM0e5/a2ThtcJLHV2XLeU2YIMMd6rwt04N17TiBp/Ei9vK8n5Xi5xntI9A4vl4vXZsd0jHjc/wpaWWBm5cFr6ozFgjZf8AED+VbZ81o2Os2p/tc/Zx819OsxeSUpdM26ytp721hVMVRC8bOC05TZoiRwtU/wBq94VmH77g0TX/AHVSeG0zosfK9tGzRJEwfCopJ2u4I5WLUnUks4B1XVzpKt8oueLKCeH12aUbHMulvc2PhY11h0dBjLSHxg3HhXyOpDe6q4vbmG+6z7sSDElByOdMyvTVR4/TvLaRtyT9K5nzg9KBwxsz46IbXOzV6QzUNM9haYgf1WvszcvaLGaSXTSNJLfCwsvE9XsrWUSj2eTPWPROIdHTvMcRbp+ywauzWxvB6n2myPFjbld3Z4enGSvfK+Gg5vw1crZjemPEaapdK2hd835VlWKUCnKuWwyuz2xMGIS1T+Ry5de+nbOVtWIjU1N9xy5cKQZfYn04+xic3SfCzzL7Nqp6Me2KactLSOSqcspxeizjycGes+X/AFrh2KUjQ2oF7eVlja2nda0g3+688cq/V7+ELGOxG32LlvzoT1MwY2Y9VeDcfmV3Hym2tm1Vb+mjpCoaZWHS5W5zJInHZWPo/ryDG4m2qQb/AHWVNgZOwPD+QuixbmK9Mt8IkdNdXOAEM3SMpo2DYJXytYbArTTbiVm+yUQ6trhQVdKWtLlPTztkdYKSsaHQn9FHKOy3XFMxitqnRzWB7quwfE4orCR6tfUcfsNdMHWtutedS5lDBdX/ABFrfdROHZcjXFo3W/GaGKL3HTDYeVrvNLraip4n+zMNgeCtLY/6mH0r3QCt+3zLDuoc6JeoGljam9/unxgxfRIjzWzWqYpXiCY8ngrT+L5rYrUzmP3n7nystxTBKnqWQuDXO1FUkGRdbVyCRtK43+ylacVsYvpY8CxGux6VrH3NyFtjLrKh2LubJJCDfyE7LvIasp5o3PpHcjkLobLfLsYTGwSU/A7hR++x0tMsvRmQ0LGRv/Dt4HZbM6ayzgwtjT7YFvssmweiip4WtbEBYeFXHYbBJvZFrTKOKgjo2BrAOFIawxiziNk8gvB1DtsrfiIc03CdGI560VTq5ju6PdEo/RWlr3k2uquCV2nlWYw/pXttUUTTQMcE1lM1guAo31Dzw5QTYmIRpdJupVXJ/DMtyFF9lTK/QC0KgrJncgpDiLZLn3B9lS1FS0n5v7U0aW+jAzcxR32ONQ4NNyqLFKkfhXEn6UT1bA0nV25Vj6hxiOCjfaXhp7q/j47ckkctm8glFrZo3P8AxkQRzgO4uuJs6ur/AGquYCQ8nuuofUb1MGtn/wA0d+64Yzs6l9ysmAl7nuvQuK46Uoro4nPz9v6Wym6ze7EABIfmW/cgOpZJauEGQ8juuQsPxomuvr7roX09Y9prYLyeO60sri2o/CrjZ791pnpJkXiJloIdydh3W6KGc+yN1zf6fcfa+jgb7o4Hdb9wvEWPgBEi895jFddvw77iOQSh2y7VBe7dpU9DrBBcSqKOqa4W1Krp5m2B1LAnFpHWY2am/pc4rngqqabWJF1bWVjIxdz1IzE437NkCozR0WNfGRWVDm6b2Vunf8Ww7KSSp1mxOxUJGrclQOLbNOD9kLE95da6rYHagAqJjLOvuqyA6NymNeorr2VLSGi5Tg4E2Ch1l3B/tPDvBUn82CWiRCaHC25S62+UABIAuUw7m6e8EjZN0O8KMBEJdDvCNDvCevgCIRwgmwulATU0d0qjO5untcLAXSN6GKXY9gFr2TlHcjgpdR8qNyHJpj0HYXTWkk2ulc4WIumIUa519gkQhTRbTGtbFDSRcJHfDyns4UdQT2UqbbGyWkQ1XxDZUjmElVjmFzRt2UT2WJBCkjprRUkyFo0i10eyTv5SkEchSMc26inBMi9nso5QA+xF7o0tA2CqJIGPfqslfAwN2CpWUou49jTKZ1QWcD9VR1s/uAm3IVdIyM32VHUwNAJ7KtKGjax5x+ssGLMuwm3ZazzEpAaWQkeVtTFDFo097LXvXtJ7lM+w23VHIq3BnZ8Dfq+LOIPVdRvdSVQDeWleZ/qLw+RmKTODO5Xq76lunPxVHUH2r/Cey83/AFKdGhldM72O57Llsuk+gPHuQitHKkcxgqhf8xWc4Xizf8N0g76Vi+P4HJT1hLWEWcrt0tRzVJbBvuVgW19nr/G8hH0TLZjdJW4jO72mE3d4WcZJZaYliOKxF9OSC4chZj0BlE3GZW66a9yOy6r9PHpvpWTxTvoRtbfSlqikQcvy/pWVuSHp/FVhcT5aNu7B9Ku+Z3pzpY8Oe9tG3Zv5V090Bl3RYHhzI2wNbZo7K15t4fQwYTJdrdmlacItR2zzl81+fM9InmhmVluzp6ukkZFbS7sFYenevH9OVPtslI0nsVtr1JV1JBVThlvmK5W6p6idHXyNilt8Sy8u9QZ6NwfHxzK02jd+I5+yPp/ZNUePzLWGZnXz8WgefdJ1X7rX9T1DVyTBnvFVRpqnEKe7iTccrLnmvZ1UvHIfj3o1b13LPJVulPYqh6F6gnocXjs47PCy7rjpp0UbpC3+lhmCUDYsSa63DwtHDyVKnf8ATzvyHiPxb6PRz0HdbPlrKVjpD9PJXrv6d8ebPgNMNf8A5Y7rxF9EWO/g8TpmB9t2r149MnVmrBaUGX6BsumwL3LTPA/JMPXsjrnBp/do73VbQyNE9nLHui8QFXh7XB3ZX2lYXSagL2K6qmW0meJcjVKFjiZHTge0CAmzPABturc3F2ws9ou3UEuLi9tX9q9FrRnV40pMrJpLHlQmVwOq6pxWh5uXJTUsI+ZSJbJ/8Za1oqYKtwfpv3VximBbclWB1W1j73CqYcR1Wa0pVshsx9LovQIO4QqOGruOVPFPq/lTRTKfpr6Soe0hpuEhlHYW/RPd8UZ82T1sRx0tkJNhdI2QuNt/5SkdikDQDsjaGe2ieMngnskf8xSNJAv9kE3Nymt7Q5J62OZz+ycmsHJTkJD18BCDsCma3eU8Adyf1TmfKEzlPZ8oQAqY52oWsnprmC3whADUIIINihAAgbG6EIAeCCLhKkZx+6VAAhCEACEIQAIQhAx/QQhCBBus+Amnc3TpOybJx+wQLH6Nc4g2CVjzf9kxOj7pH8HkttTf1Se2O5SNNjdODwTZMF0xrmhvCROfwCmoEBSKMbmykTNMBH/KVE9+nt2UrhcWUb2Eusk0wIS4kWKRrGlwU3tgcH+kmhyWK2xU9CAWFk8NDeENbZIbg21KTTI5SWx2kOO6HQt0poIbwboEvb+U5DVIidCTuU0sDXbFVDhcWTLXNinpk0ZAwXsPsn6B5KVo2ACVzCAj2GSRA9oAuFTzykO02VU9htZUz2fHcpG9lTTUxYhcKVmk3BKjfII2XPhU/wCN+IgH+FDOSNKqDkhuNsZ7Di3lYfiOLGjLmu4sspxKp1xOB8LW+YVeKKnfKHWsFl5M9I3eLxXbYkWrqnqmlZG4vlA/dc958Zj08FJPFFMLkHgqlzpzp/wD3o/xRFie65WzQ9QLMUqpInVV7kjdy5jOtbR7Z4xxPpJT0YXnxjNRjdXKGPO9+60NXdE12K1JBjcbu8Lcxr6bqip+a+orNehcnabFpGSCnBvY8Ll8jtns2DkTxYL/ANHL78k8Srdvwj7HvpWO9UZJVeGDWaZwt/pXo5g/p+oBRAGhbfT+VYXmV6dmSRuMdGOD9KoyxvZ7Os47zCFUvVyPNvGukqqiJDo3Cx8KyukdSOMTuy60zVyDnoY5HtpLWv8ASucevOiavCqyRnt2s49lFLE0j0LjvIqcuC7MSqZ2zGx8KjqcNjqoyLKolpZWT+07yrlS4Q98eo/8lBKqUWbqcLo7RhtZ06xrySmwn/CxeN9iFl+J4E4sJaVieM4dNG8t3SKb3plLLwd170ZP0NmRXYZWN01BAFvqXTWR2eMzJIGyVXgEFy40w6kmgf7m9+yzHpHr2XpypY90pFiO6lhPUtbPOOcw5wg3o9ZMk8xcOxqmi/EStN7cldB9JUeC4o1tg03C8o8k/VCaF0UTa0ixH1Ltf07eogY5JCx1ZckD6lsYrezxXnLJ17W9HX2H5aYRXxNd+GbuPyq7YbknhT3BwpwP0anZUY/HjdDCQ8G7RwttYJhgfEHgBdLi1RmjyHluWyKZNOWzBsMyxosLIdHCNvssnwnC/wAKAGRrJP8ACQ7Y2VRBhMY5aFuUUJPo5a7k5Tj2y20VJJIQCCr5Q0elv7KSloGNtZquFNSgDcLZohpmJk5XsUM9MS3bm6ZFJJAdFldJIGhpFlSvp2+6r7XRRdiZU0IMm7gq+NgaB+ipaOPS0AKsGyj0ipbLbELgDayQPubWSubc3uliYQdyjSKz+jgwEXKRwsbJ6Y/5iha/g8A4t4StcSbFNTmc/slAchCEa0AgZY3ulQhAAhCEACEIQAIQhAAhCEABFxZJoHkpUIAjTgwEXRoPkJw2FkAIAALBKQCLFCECMjdte3ZRPeS4KV4vcBMc3T3SaQwGt1JTGCLXUbHHUdypm/FwnPrslj0ROjDSLFI8E2sFNI3S25UDpA124VefaJFLolY0BosleRpUQmB2Q5+1gkraTGzX69lm6hJbGSPK131TXSxB2krZOOQ64zYLX3VeHa2v2W5ha2jmeQi0jVPWvUdRSa3tcbhao6szIqYi5r5CLfdbMzEoXs9zbay5+zShqIw8xNK67AphfJRZwfK3SpjtEzs43wVGk1HB8q8YdnfdoYakcfmXOPUuNVdBO65IsVZRmJUQOIMpFvuvQeK4WtaaR5/m8nKUX2dR41m7HLSuP4kHbytOZi5k/inyN9/ue61/U5nTvg0mc/fdYZ1D1hNWSuIlO/3XonH8RXWk0jg+Sy3P6TdZ9Tuqql8fuXB+6wnEatsby7UkxXEpJZC5xP8AKs2IVMj2kk/yumqw4xj8OYnc/YvOFY0RM34v7WzsuusTRSxj3RsR3WjaatfDJueFfcH6tfRvBDiP3WPyWEpJ9Gji5jh/TtvLbNX8PCwe+Bx9S2thOdLREGmpHy/mXCPSGaz6djW+8e31LN8MzfkIBFQePK875Dik23o6rjuVkpLs7Aqs4mSR7VQ/lWmbNVzpDpqP7XNVNmlU1NmtnPPlX3BepquueCXnc+VxfIYChvo7/i8+Vkl2dF9P5kzVEzWiUnfytldE4/PVSsd7h3+657y3pKqqnY5wJuuisrOl55ZInOYbG11yd8YwkejcfZKUUbU6ZfNUMaSDus0oqfRCNt7K2dO9P/h4GDR2WSw4eRGL+Fj5NsU9I6jHi2uy3OLgbD/kpI6qaJpIBVaaBpdwnuw9ui1lmX2mnVVsomYnLK7QQVUOoWVkZEg5CjfSNhdqt3VRBVNjbYqm61bHbCyhJmNdQ5dYZijSJYWm4PZax679O+C11O9wpG9/pW831DJNmkKkxHDvxULmbbjZYebjrfRRtx1/DgTN70/01BJMaelta9rNXL+a+XFfhcz5YGObbwF6lZgZXjF3SH2gb/ZaAzY9M8mJCQsowbg8NXN20y9iuq3H+HnbSdTdQYFXBgleAHLc+UGdtdQyQtnqiLEXuVecyvS/WYa6SdlCbi/0rTuPdP4n0fVENjc3SfCmoTgTxk0egeRuf0EjIhNVt5HLl030TmnhmL07WuqGG4H1BePnQmelf09OyN9Q5tj5XQ+U3qulD4onVx3t9S2acj112Sfkf8PSmDGKSpAMUrTf7qCuqd/hIstB5R52R49BE6Srvcd3Lb9Fj1LWUol93stqvKjKKTZX95OXZeY8XjpBqe8c73KhrOuqNrHRukbt5KwDr3rNmFQPcyXgHutIdWZ+SUVW+JtSfHKsRug2XqZP4bw6/wAyYII3RRPBuOQVzzmt1rPM2R8Mp78Kz4nnHPjEun3ib/dULqSq6lOmxdqU8XGRp1y6NTdR4/jVXiLgyR1i7tdZH0FQYpXSMEuo3IWx8I9PlRikjZzSXvvuFsXofIB9C9hfSgWI+lS/qTtJ9opsqcum1+j8RFfjkLffSuTGDmmZJLA3i+4VN0Ll83CWNcIwLW7LYmGl1PC2MEWATbNehHOOo7LVRZdYPh4HtQt2+yrDhsdJ/wCEy1vCugLnbkpkrA7lZzntlZtlLSVDmkbd1WtlLm723UDaYRm6cXAG1lLFtjPfT7HSShnBVLUATjhMrJy19lJT2e0FWqltbGzs/UpxSKCrqBSMv9lcZLNFrLHeq6ow07nDwVar7Zk5NjKHEur46QuJeNvusTx3M6nglOqYCx8rDswOtn4e+RpfaxPdaNzBzanp53ls5AHgrZwMdXWaOa5HMdMds6QZnDRsfpdUN58q50uZ+GVTReoZx+ZcK4pn5UUs+k1bh/7k/D/UnURgH8cf9y6enhPzfw895Lmmm+zuTEcwsOjic4Tt4/Mtf9c5sUUFK9ralt7HbUuY6/1MyPgLTXHj8ywXq31Cy1Gr/jSdvzLoeP8AGNTT1s43L57b+mV575iNxD3gJQbk91x9mrioqq+Szgbu8rOOvc1jiIeBOTe/dag6ixJ+JVjnar7r07i+BcYro5fK5hSf0tlEXtqw8eVuvJLHTSVkRLrWstQ0GHueddu6zLpHE3YLK2Quta3daOXwP6fBuLyy9l2d/wCRWZ8VFHA2SYAbcldF9OZs4dLTtBqW8fmXmZ0jnU7DWsa2oIt4K2T036lZYWtDq4j/AN6865jxd3Sb0dPi89+LrZ6HQ5m4aGavxLP5TXZw4dC4NbUM/lcLs9T0j2WFcdx+dNHqLqZnXFaf9y4TO8dlR/DreO59z12d2jN2iqrBtQ3+VX4d1/BKQWSg3HlcQdO561VSQfxR/wBy2rlzmfPXytD5ibjyuTycB1y+HoXF8t7pbZ1VhfUQrHD4uVfKcmUCy1P0H1E6sljGrwttYJpfTtc7/msqypQOzxMxTRVw0wIuR2TpW+2NipgRazVT1UgF+VSn0asbE0KyQ2tYJ7JDe1lTRG/CnYQOU5PcBHJMnG4uhMaRcFPBBF7pBNodrPgJw3F1GnB9hayjDaHISB47o1t8p6+BtAWAm6bIwBpN07W3ymyPBaRZL2I2tEN/it9k4Gxum2+K/wBkqbIgTeyQG4uhI03CVQyJois5Q/5ihnzBD/mKRb0SJbY1xIFwka4k2JSv4/dNZ8wU0R2kSBxCJW3SIUnwbKKACwsopIw53PdSprm905SRUnBkDoRwU0Qgb3U9geQm6ClckQOD2R+2O5ThGHCx8JwYQbpygsZPUtMppKJoF7qjrYgI7BXGZwA4Vurnggj7qnN6NWnosdfSCQF11h3VtEZoHssVnc8ZsVjuM0QlDgWqpanJHS8Zd+KaZy5nr0u+qgnZ7ZNwey4Y9ROUxndNKYTex7L07zF6NbiEct473B7LmPPTJ81FLK8Qjdp7LCyqdnrvAZ3zTPJHNHpN+D10gEfDj2WP9GVIhxNjXD67LpL1JZUTYfPO8U/Dj2XN8OF1OHY6G6LAP8LAux3s9i4nMc4JHX/ppwLD8XbC+Zo5HK7UyuwLC8JpI3sY3ZoXB3pw6r/wz2Q6W1rd11Z09mzTUmGNeasCzR9SgjFVvbL/ACeBkZtOq/6b9xHq6iwuiJ9xos3ytE57ZyUzKWaGOpb8p4csGzS9SMFFSviZW72P1LmTNH1APxZ8rRVk3B+pJPIK3EeH3Rmm1tlsz16yZi9TM5s17uPdc5dQyyyYk8t7uWV9VdaSV87ryE3PlWOkoBiFR7rhyVz2ba5T6PZOA4a3Gik0UuGYS+oeJHtWT0NPHFT6S0bfZNgoo6dgsLImqhTxOJPZZbTbO6/xPWntGJZhyNfE6Nrey17hVPqxIMt9fhZl1rirJXuYDcrH+mqKarxVuhl/i8LWwoyUPU8m8srhFSOpfSVhslNWwTR3uC1epvpVq6yWjpYX3sGhec3o+6VnnqqfXFtt2XqD6bOmfwlDTO9u3wDsux4+Okj5l8mlW5M6my8m9qgjY48hZnBK2Nhc0jda86aqnUkDG+FlNBjAc0B5K6ymS9UjxPksZzvbRU4tJJHeVh3VpfjMzX3edh5VwxCtp3QkuPbusL6s6io8Nge8yAWv3Vr3USPExHZ/DK6TqCJ50vkHHlVrcRikb8Dgf3XPlfnLTUlf7Tam3xeVmXRWZ1NizGN9+/7p0btFyzjn9NqRPMxuD3VS28QuCrRgWJw1MbXNde4V+ggE7FLGezEy6/TpktDUue6xVyjJaBZW6jpvblsriQWM5Vut7Zg2zSkVMQDhcp4dZxbbsoKN1wd04OIluQpmROaaHvG90jeR+qR7xdJrChbWyNp7JU8MbbcKNjgRYeFI3gJY/STfQoAHCEITxV8B3B/RRqQ7iyboPkIFGp7PlCYdjZPZ8oQAqRx0i9kqRwJFggBpNzdIgixshAAhCEAPZx+6VIzj90qABCEIAEIQgA4Sa2+UPJAt5TEDH9HhwJsClTGfME9Ag2TsmycfsEpcXcpD8QsUCx+kaASOClcADYJO6H2SL6Pa4HZLwmsbw66cm+qHilxPJSXH/wBBCEeqEaTBpF/3UijHJ/VSJH0xgJj/AJinpj/mKQBWgD5h/KR5aOE5/H7qKTslguxk3pC6m2vdRvef3Q51thymcqTtFadn8FLyBclJ7gBvdMc4m4SBpJ//AFJBkJf9KgSFw2KVt9e6jDnNFrKWFus6j4QXINaJGtBANk4gEWKALCyCQAgc/hG9hsoHNGvdSyVHZU752l9iVFOW+kOhU5PY2vDfaP6Kzh5Ep3V0rX62EjwrWWgvv91Wslov0w1ohxGa0TiD2Wo86cZFJhsp9z6Cto41MYon3HZaH9QGIuGHS2P0FZWTPrR2fjmM7clHBnq4zAnpJ6jRUEWce64o6wzZmZir2vrD8/ldJesvFJI3VJDt9Tu68+szuqp6fFZSx/D1y+XL6fTnjHDqdCejpvKvNSGaqYJKoc9yuv8AIbrXC6tsQfKw3AXk10JmvWYdXM1TEDV5XU2RfqLfROiD6zsOXLBt+nT53HOup6PV7odmFYpSMILDcK749l3h2JU5cIGkW8LlzIX1ItrhBEasEED6l1L0R1/Q45RN1StJP3VilwktM8i5OrNxMhzg3o0dnNkjS1FJKYaEd/pXFmeWRc0FVO9tCeT9K9Uuo+naLGqZ1mggjwtCZz5H0ddDNI2muTc7BWJULWzqfG/J7FNRk+zyd6ty+qcLri40xFvsrLVv/ARhrm2suuM7skXUckskdKdgd9K5ezC6SrKGd7BG4AOPZZuRUv4e88Jziuitsx7/ABFlUNIO6tWJYb70t9NwimiqKaqLZAee6uz2wmHUSOFkzre+zuIZNd1Zj0mGNjiuG228LHscpKp8umEHnss1IjneY2kfyrp0/l8cYqmH2ibnwlqhqWzi/I41/gkzEcuKLHI61gZ7nz7Lun0gUmOvqoC8P7LW+TvpzfiU8UgoTu4cNXdHpc9On+Gvhe6iItb6VvYlfxnzB5TkqtyOm/TnR4g2hp/ca75Qul+mqKQ0LS5vbda/yey/iwqjhDogLNHZbkwjDYoqUAALr8GnejwDms/2saLfDTODyC1VLacAAqsfTRsdslMTQ3Uugpq0c/PIcvhSCMt3U9O+4smT7E/ooo5tP2V1LSKspyk9FVI65tZDIg7cjuoDOQfsqukIkjuVYi/4KlKK7JIo9BAA4Uyazn9k9oBNikf0in9BrSd7J3wjwEoFhZRpreiLWyTlMf8AMU9vA/RMf8xTY/RwAE8BOa0Dskj7pyeAIQhAiewRwhNc43IQKLrb5QHA8FMTmc/sgByEIQAIQhACFwHJQHA8FI/n9kM5/ZADkIQgAQhCABCEIAY5puTZNc0nhSkXFkxw0m10CNbIgAOApIzpF3JBGLXKVLvYkpaCQhw/ZUsxAO5VS5wAsqWoab3UFiCM1vRHC8+5ypHv3ABUEZLXXCV73XCij/sWOpIdURNmYQQsax7BxK15DOVlLAHM5VPWUjJGkWWxj2+mmYmfT7I0d150eajXaLkLQ+Z/QMhikd7B79l2J1F09FOHEx9vC1h1/wBAxVUD7Rdj2XW8RlRjans858gpapZ555odFzwTSEQnY+FprqejqqGZwsRZd0Zq5TNl94iA9+y5pzWy1dRvkcIrc9l7JweXCaR4/nwlFM0LVY1PFdrnH+VapMZdLKQXX38rIOpOm3wSOFjsSsXkwx8U1yDyvUcBRlBHFZ9mt7KhzfxHxE3VNV0ReLBqr6SOzLHwqltMx53W5CnaOenb+xj/APg73bhpVLVUskB7hZrDhcbm7NCt+L4IDuGrMzaOh9dzLFhdbNBw8rJcDxWrmnDGvcrFDhkvvaA08+FsDLvoiTEKqP8Ay73PhcLylahs3eNm5zMm6IwWuxBzHBjiCQt25e5e1k4a50DuR2VyyXyYbVQwufT3uR9K6Wy5yTp44Wk03Ydl5dzVsYpnqnBQlKSMXysy+kiljD6c8Dsukcs+lmU0cZMVv2VF0pllBQSMcIrWHhbL6fwSChgaQLWC8yzsr9mj2PiceXoi5UdExkYaGjZVZGltgo4pGhqHTjhYrbk9nXU1pR6JGNGxITntYRtZQRyku28qZw+HbuoLYsuQWijrmNIsFaKqZ8QNv+Su9YbXJVunphKdvKkrj619j5SRRQVc5fsSrnTyve3cJKTC2neyro6ENt+izMmv2InFNFJLh8VQPijBurfiHR2G1zCJqZu48K/iIDa6hneGixKyZ40frIpVQ12aYzOyVwvEaSQtomm4NrNXHmf3p1JnndT0R5NrNXo3V0kOIMMcm6wbrPJzCsbbI+SFpuPCz7K1AquvZ455g5R4vgVU+SOme0D7K0dJ4zieB1wbLM9uk+V6MZ7+mjCRSTSx0YvoP0rizNDKp2AYlK6GAgBx7LOsyvxsVVP+Gyskc9anDZIon1pFrbErqHo71DQPwxgkrhe2/wAS83MNx6swCu0h5Gly2H05nFiMEIZ+IO33RXyunrY5Y39Oy+us2GYvC9rKu9x5WmOoRV4tXl8b3HU5YX03mZUYnMI5Zr3+621l1hdNjksTpADe261sfkfYnhXoh6Iy4xDEnNkMTjc+FvDLLKWZkjDPTHtyFm2TeWGGT00bnQt7b2W38M6Kw3DQPbY248BbNOY9FqHRa+jsusNpaNhkpm3A8K//APdjD6YAxQNH7Ko95tHHoYbW8JG1jpeVejlLRInL22iJtM2IWay36JoMjHkjgKrLQ7skcxpbZJZf7QJPba7GR1DgRqU7ZA8bHhU7owDa6kiNt1SjJkE4a7JSSeSmvBvsErnAC9wmskLjb7q7W20VJ9FFXNJfeynpDpYLqSWEON7KN49pmyv1vrRXm9CzytF9+yxzq2ndPSuDRyCrvNI4vuoqmmFVFpd4VqtKJm39s5uzU6bq5nSuY091zRmv0/iUMstmO/hd79VdEQ10bwYeb9lpXM3JWCs914p7kjwug4mcYWrZx3kEWqDzz67ixOjmc749rrBcR6txHDw5plcLHyuss3cjzAX6KY9+y5uzHyzqaN8hbCRuey9W4ZQtaPGOXlNbMEq8za5pLfxLv5VoxDrutqTvO7ceVDjPS1XBO4Fp58K3/wCCyMPxj+V6bxuDB66PP8y6abHVOMVFV80p3UdK3XMHuPdOGHlh4UjIjHx2XeYGHXFI53IyJpl3oPZYwcJ1VV6D8Lla2VL2bAqaGR077HutG7ChKIY+VOMkTPxipp2l8chCbT9dYjTu/wDyh233VQ/DPdh4VBP01LLcRt5XKcjg0wi20blV85SRe8PzIrpniMVDj25Wc9JYlimKhgDnm6wDpLL+uqa1v+W7e3ZdMZHZMyVYh9ymO5H0ryryCqqEXo7HiLZ+yJ8venMWqA1xY/crfuVHSuIxysLo3DhZPlfkPTsgjLqX/wCK3R0zlJSYdG1zIRcDwvIOUnBSej1fhpTetlNlzhlRSyx6wey3NgE4FM0OPZYrgvTDaMtLWWt3ssipSadob4XK3yUuj0jAcvVF9EoI+E/qkkiMguQqWhnMnblXANBasyyLOkqUmiCOnIF7d07S69rKa2kbKNzrb25SJNRJ18EBINiU73A3YOUT5PiNghh1c+UgFRrb5S8qNSN4H6KMAQhCevgAkdwUqDuLJ6+CP4R90Jzm24umpjWyPXYocRwU5hJvcpidH3UUkSxHAkG4QSSblCE0miBAPKQNANwEqFNH6OBCEKR/BGtjnAAXATTulLri1kiZHsjkmNc23ATTccg/wpEhF9k/1IZIYkc7SLlOIsbBIWhwsVHYnofBa+FNUS2v8X9KhncHO3KrKphFyVQvaC4m6oWmhUQyRgtsFQYhh+phcGq6CP7p0kLXx6bKFLZfhf8Aika96jwb3I3Xj/palzM6OFZTPb+Hvdp7LoLGcMbI12ywfqbp5lSC0s7Hsq2RWvU7ThOUdUl2edPqRyPdiInLKG5JP0rjzMD0/VuG10lU2hIs6/yr2DzDygpcWhc409yT4XPGcPp5pI6SaUUXAO+lYd9Oj1/gOdj7RWzzrwWpr+j32eXM0q71XqCqaSmMH40g8W1LJPUF0C7p6SYRREWB7LlfrDEK+lrHtLzYOPKxcqPqtnuXBZFeUlszfMLOWvxZz2srHG/+pawxbqqvq5C50zjdRQVEldNpld3VVLhMWgEgcLnci7R6vw+FQ2nottNUzVMw91xNysr6ei0tBWPx0Igl1Bqv2C1TYgGkrIna5s7GvHqh2V+JT+3sD2VjxjEXNhcNXZV+MVmoDQrBU01XXy6GNcb+Ap6a/Yo8jl101PRYpMJq8brw1rCbuW1coMjarEqmOV1GTd4PCqMn8rKrF6+J0lM4gkfSu3PT36fGPpoZH0R7ctXR4WP8PA/M+S3CWi7+kXJB1DLAZKO1rcheg2UvScOFYbCz27ENHZarySyupsDax3sAWA7LemETxYbA0bCzbLp8ev10fMnP5E77WkZNE2OCK5NrKCo6mgoTvNZWTFerqWmp3H3QNvK1h17mrT0TXOZUtFr/AFLRlaoIwMLhb82XaNldVZsUeHUj3OrALDuVz7nL6nKGihljbiIFh+Zaszv9SbMPo542VzQQD9S4dz99VFa6onbHX7b/AFKB5cmzqsbxX8cf9TqfGvVFTzYuQ3FB835ltvJL1CxVksTP8RBvb6l5An1H4hJimo1h+b8y6I9N3qGqpayAPrO4+pOjl7HZPj7jD4e1eVWYsOK00ZNSDe3dbi6exWGpj2eDsuAPTjnUK2kgY6qBvb6l2Blf1aK+BrvcvcDurtOT/NnnXO8U60+jbLACQQpJHHRv2VJhVQJ2tN+yuEsQdF+y0qb2zzbLplGXRDST6XEXUokDnbFUjRoeQP8Ampm6mWeritbiUYKTJiSeUWJ4CSIh43U0cY33KansspbQRgjkdlMz5QmgXNk8CwspojtIEIQni/AQhCAGFriTsnNBAsUqEACEIQAhaCbkI0N8JUIAZod4QGG+4T0IAAAOEIQgAQhCABCEIG+yGydk1SEA8hJpHhANf0YhKQQeEiBoIt90IJAFygRSSFAHcpCBfY3TS/wErXAoFVnYqEHcWQo/fom9kCjO5KkQ1jSbWS+62OEh+ZSpAxrdwkLxbZLtMjbFf8qYmOe7X35QXkb3S+u/hE7dD9rcpr+bpnvfcpU9Q9SGdqmtCOAsduyYpQLlO0NT0yP0cin0gG4Cc0XIU2hvhBY0A2CRpMVVtMYGBxupYhx+iawEH4gke8NFwVHJFuuOyVzgAbnsoJpQ0cqOSZ1+VBLLq/hMcWiwqmxJqm11TmdxddPdH7l1E6NzXabJjX9LdUFGOmSulJbYhU3tgm91K6N5F2qIxvAJsqdhJFLfRYOq5hHC8j8pXOPqBxTTQSj/AEldEdXG0Ugcey5p9Q74/wDD5t/pKxcuXrs9G8Pq974nml6zsVLn1O/crz9zHBqMVl/9RXefrIi9yaosPqK4Y65wuZ+ISuDT83hcvmXLTPsLxHFTxktGEsp5YZA+O/KzbofqysoJ2f5jhb7qz0mCSPIL2cqWopJKAa47j9Fztl69tHXZvEKyrZ1Tkdnq/CJIGSVRBFr/ABLsLJr1QQNjiZJXeOXLyi6f62qcMmb/AMQRpPlbVy/z2rqCVjRXOFnfmU9N2n2eec3wUbItJHtJl5nbhuP07GGpDiR5WVY1FSY/RHQAdTfC84fTx6jqh88LJcQPbly7Wynzdw/GqGFktY1xLRyVrU3qXR5XmcVZh3e8emix5rZLQ4xRyvbTA3afpXIWc3p1lhmmkbR8E/SvShsNBjOHm2l1wtU5o5X0FbBK40rTe/ZTW4v5FuJ0nj3kk4W/jsZ5J9fZbz4LXSD2LWPhYNjMctJG5l7WC7J9TGWtNhs9RJFTgWJ4C5H67wqoiqpI2R+Vm2cfJs9jwua/+lNsx7p98lRXht73K6GyK6NOK1UDXRXuR2WmctOjazEcUZanJufC7b9LmVD3VFMZKM9uQmV4MlLRzPk3kUIY0uzf/psySp54IHvpW8j6V2ZlVljS4RGwiBo2HDVgvp96CioaKAGmA45C6P6ewaKCmbpjF7Lfw8GSZ8s+Uc7+aySiXXAKCOjpmBoAsPCv9HXBsei/8rH5DNAyzQbdlPQzvLbn911GJT69HkWf7Ts9mXx8xJvdPiJkbyrfTPllfZXGla4OAst2qHRnxk19I6lh7KlbDIeArz+Ha8XICa6lY0bBSPSJo2LZbGwOuLj+lVUzXMFvspDE3VcBOEYshST+D52poUOBNgpoeP2UbI7cqYNA3CR/CtJpvoR5N7XTVIiw8BJ6iA3gfomP+Yp6QtBNyEJNAJH3TkAAcBCcI+0CEJH37XQCWhUx/wAxRdw8pCSTcoFBOZz+yanM5/ZADkIQgAQhCAGv5/ZNTy0HkI0tHZADWfME9Fh4QgAQhCABCEIAEIQgBjmkb/dMe8Db7p7nEmyp3k6ue6RPZFJaQ9Mn+Sycy9t0Esdyldfshkenso2MJk4UkjDqGw/VVDImatQRM0BwIUTqaZZVmkJDCWj9k2dieySw5TJ5AQrEHopZLUkUFbTh7SD3WM47g7KhhBaFktTISbffwqKria9vF9vC0sW9wfRx/L4v5a2jSfXvRLJ2Sn2x37LmTPPoFjBKGxjg9l271XhkT6WQ6AuYs/aGNhm+AcFem+M8nJzSZ5BzGD+LZxB110eIah/wdz2WusW6e0ynSO/hbyzGha2WQ2HdatrWtfUua4C117zw+fF1rZ5XylL9mYbJSOpXe2QoX1IhfcK99SGmgY5wAusOq60ulIC7GnKg0cpdFxkZLhuIscNBKq5Yo6gLEsOq5fc2JWSUU8hYL3uqmXOLGQs7KqgwJj6gWYDv2W7ckejmT1cJcwb27LWXRkDamUGQd10PkXg9q6GzNtl5z5BcoRZ1vB1uyaOncj+h4W0cJ9oduy390t05FSQtBYP4Wv8AJjDGMw6F2j6QtvYXEGsFgvA+fzp2XuOz3LxvCXTZX0NDGwCzeyq9bo/hB2VN74hAS/ihMNLTuuHucrJnrnHxjXBaK2KS/J/tPO52VFBHOTc3srjSwusC8Jnq49m3CyLCJjhbZTpwYwbX/tMkBv8ACf7SN+xNvRT18WptwqL2rHsFcZ2uLLHdUjqd53aEN6RFLuRLRvaOSqsG+4VuEEzDcNVRHUCBl5Xfyqdq7LEYtksjTY7KkrYyYy4pKnqTDKUH3JwLfdY/1FmPhNNE5japvHlZ1s4oJaX0Ws6giw9x9x3HkrFeqM38Pwxr2uqWiw8rCMzM1KeCKR1PVC+/BXO2ZObGIVE0gjqHG57FZOU04NjIQ93o3TmHm9hmM0r4BUNN2nuuY81MMpsZnkdG0HUTwFapeusXqqnSZXkE+VesHilxUtNS0m/lcRyOT+N/TUx+KnYujR3VWU1W+R9XDCeb7BWml6Jr6Zl3xuFvsusaPLqmxKms+AWI8LG+ssq4KKncYIBx2C5h8woWfTTfCyjE56w/EZcCqwXkiy3HlJnHS4fJE2WoAsRyVqfMrApsMe94YRYlazd17X4LWlscrhpd5Whj+Qxj9My7D/F9PVTJj1HYVHDFAaxvPcrfHT+alBjUbTHUA3HYrx3y1z/xChqo2OrXD4htqXVeSvqTlkMQmxA225cukw/IYzM6T0z0FpXR10Alab3HZSxwaDYBaoyyzywivoImz1zDdovcrYtB1rg1fGHQ1LTceV02PyUbUEZrX/su7nhrbuCpvxnx21KnnxJlSP8AJk/hQNhqHHVutOu38j1scrEmV0lUAeeykp5tapY6GZ4Dj5VRTQuidd3lXI1MfOaaJ36vCWHY3KcXs0WJ7cKnLnGSzOFYg2mUbH2VJfcWsoJhqvYok1tbc3Q06m7hW67NMqTbbIHQ3NwnNZp7KbbuhzG8gK3GxMrzr2UVTBHKCCBv9ljXU3T0VUx50Djwstewd1Q1lMJLi11bovdU9owuUw1fU0c9ZnZax1rHlsA4PZc05s5Og+6RTjk/Su9+pemoqqFxMQNx4WlszOhqZzJHOgH8L0bx3mErEmeU8zwU/Vs87+uMqTTTPd7H9LWXUPS34KQjTZdlZv8AS1DStmLYhcA9lzJmNTxw1DwBwSvdeE5CFkVo8j5fAdDZrKpo2xttZUErGtJNgrliNWwvLfurdK4Ofey9Cw7konBZVqjLRSyEDt+6qMPcDICfCc9sAjJsFQPrmxTERlaEsmOhMaTkzLsMYyotDfdZl0t0OK9zf8u9z4Wvela8y1DAHbkronJHBm4nNGJI73I7LhfIc9QT0dfxuN+Vov2WWSpqJ45DSA8fSupsmcoI6JkLjTgcfSjKTLqidBFIKYcA8LfHR/S0NFBGWQgbeF4R5JzibcUelcLxUptPRVdK9MQ0FM1ojHHhZZQ0zQANI/hQ0dE1rbBv9K5UdPpNj4XlmZlSlLbPWOI4x1xXRJFTN07Afwo5oHNdcBV8TANrKaOCJ+5asad+md5h0qCKShaW9lXe+WMvf+k78NEwXaP0UE97Wamxmpm7XFMmZMJBuVFLKGbXVM5749gUwyOfySmyml0SvH9iZ0rSdQKfA7UdieVTBx+U8KppHsGyRPYx47SKyLYJyawttz/KUuaO6FDsi9BQB3KExxudkupx4Cd66QjjochDO2pPDWHcBCehrQxMLSBcp6a8i1kNkTWho3Nk9rS3lMGyXW5RS7HqSRJp+HVdIgPB2v8AshMTSJVIP2QlGnuUuhp7lSxmh3sNQiQWuAmWc5SeyaF31sehMs5pRrKRLY3tj01z+RZNJJ5KE8Z+PYrNnbpzxduxTAdwpAQRsmyWxyj69lJVgkbKhlY7VdXmSBjhsN1TTUzRc6QqNkNoswsSKFrdfISmJwUj2Fp2QHA7FVmvUZbJ2NaKHEKYOiOyxrEKEPkI0rLqogtItyqCWiikdqLR+6hm/bo1sPJdUTEK7pmOohu5o/havzX6FhrKCeJsY+U9lvLEohHHpa1YT1nh7KqlkAZvpPZU76k4nW8LyV1V6lvo8xPVzlPNHNMY6e4N+Grg3NTLeqpauRxgI+I9l7LZ65TxY5DLJNSA7G2y4bz6yLjp5ZnNottR+lczmVPs+jfE/IEvVbOAThU1FWlrm2AKrHgloaXLYeZvQRwaeUtp9JB8LW05mZUaC07LkczHlJ9H0PwPJK2KaZMYCW3uqV1c6ml03Vxo6aWdlg0lMf0rWVkw0RE38BUIYkt9nXX5346fbYYeJcTlDAL7rauWGTs2PzxuNLe9uWqhykymrMQrY/epSRqHZdr+njIiJscMstD2F7tW1iYLPMvIfKFQmtlmyK9OAgMEjqEDjctXX+VOXlLgVFHEYACPsqzoLLjDsLpY7UzQQPCyyepoMFguXNBAXSYtSpj2eD8/5DPkbHXWX/CDS4ZFq2GytXVOYlLhkbv88CwPdYP1TmrTYfG5rasC33WjM3c9fZgl9uu4B+pTzzq60YfH+M351ylL+m0Mw/UJSYdBI38bb4T9S5wzR9UUP+YwV5uSfqWis5fUNX+7KxmIO78Fc49c5z4pWzkCscbuPdULOWgj1fhvDfxxW4m3M7c9anFfeMVY4gn8y5azK6vrsUnkJkc69+6u2K9VV2KxkPmJvzurO/AnYmC9zb3+ypvk1JnUy8O9Ie2jX8NTWNrNZJ58rd+QnVNRQ18N3kcd1r+r6ONOS8RcK69HYq3A61l36bFWqcxTaOY5TgY1Qa0elfpdzOeJaWE1B5b3Xo16f+rG1dDE/wB292juvFX055vNpcVp4xWWs8fUvT30pZqMrKOna6qBuG8lbFFjkzxTybi1DfR310viXuQMueWrIxODTk/Za66Ax6CsoIntlBu0cFZc2tc6GwK36U2keDcliONzWiR1dpnt91Wfig6KwvwrdAxr3ancqZx0izStKuLMh4/W0VtLISbefurhALt1Kz0sjgbEK408jtPHZTRg9kbhoq0KMOdblLrd5UqWhjWh6EjCTe5Spw19ghCR9+10Ceo1xOrlPHATLnv/AMk5pu1JrscKhCEoAhCEACEIQAIQhAAhCEACEIQRghCED18Ai4sUxwsbJ5NhdJrHgoEaGJjnE7fdP7XTH/MUDHEROZz+ybYeAnM5TZDIwaY5CEKEsJAlaLuCRKz5ghj38FkcQLfZNTn8/smP4/dSRIpDXcn9Ux57JX/KUxTxKk+wTg8k2TUrPmCc3/0ij9JY+6e0aja6aw3HCW5HBTW+i3XHYEWNkJjn3GyY6QgEo+FhVJjnyfZQyTd0j5BwVBJIXcJsmTRh6ivmc4lMJJ5Sta4kbKX2h9v4UTZKn/whDi0bbpmp73/L3VR7Te9k5nsMO53UUpaHKTRE4OZHuFRT14bdquNTLE+Mhp7KyTwPdKRbuqt0tMdW9tbMe6vldNHJYdlzjn/QSS0Ept9JXTGP0J9p+pvZaNzvwpstBK3T9BWFl9ps9N8PvjDJjFHlZ6v8NeJ6i4PzFcWdWUP/AB8l2/UV6F+rvpN08s5a36j2XEfXPSroK2UltrOK4/N0fZ3hU4WURRglFhjXtuGf0qXGsItE6zePssqpMNbEdJVPi9G0RGwXM3y1Lo9Nuq3X0akxWGWmqjp7FOwvGaymqW6SeVf8awIz1Bc1nfwrf/gL6d+ssKuV3wcFv6czl8crGzbmUmZVZhEkbjLawHddX5GepOSkmgikrQOPqXA9FismGt+EnZZR0RmjWYfXx2mcAD5V6iw865zgvbbSPZ3JzPugxijjilq2kkfmWwOosaw7EcMdIJGm48ry5yR9R9TQ1cMb61wFx9S6pwL1FwV2Csa6suSwfV9luY9r0eePhnXepa1osnqfwinq2VD4wDe6476m6JdX4u+NkRILvC6pzL6yh6jgcGyg6vute9M9DNxfGGu9sG799lcjU5dm/ZyM8bH1v4Unp39Pz8RropPwhNyPpXf3p89PDMNhp530pFgPpWLelvJ+mi9mV9O3sd2rs/oTpCloaKJjI2izR2U9WHKUtnl3k3kElBrf0ly/6MiwqnYGstYeFsXDImMYAqDDaBsMIsLWVfQE+7Ybha1VPojxjPyHfJsrJaX3G2t/SfSUBDbWVfBSe7GHEKpgphG29lqUR0+jmMq3aKakpTGbuCrWNDbIs3iyA4HutKLaRme7J2EEWQ/gBRB9hZOa7UklomhMNA8lGgA3SoGxukj0x+9itaHcp4FhZCE8AQhCABCEIAEIQgAQhCAEIBFijQPJSoQAxzQ3hKzn9k5CABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAjO5uopWgEkKV4DuD3TNBOyIx7GPv6NZxZAYO6Ut07IUm9DNfsKwbomaCLpE15N7X7KCdiHJEXuEc2UE9QU6ckWAKp3Nc7bdMVmyvbBkUj3OdsFHUMAF1VxwbXcFT4i0tbdXcWTczD5GGqm2Y11QR+DffwuVfUdiMVMZgXDgrpvrfEW0+Hy/oVxb6pepHskms/sV6F49+k02eQ87+7ZzjmZ1DCKh41Dv3Wq6vGg+odY8lXHr7HZqmue0OPJVhwXCanEam4aTcr2Ljs2NVa7PMMzFlZJkWMU89e3U0EqwyYBVF5Iaf4W4sAy7qKqJrTDe48K/U+SdTOzUKTnvpXQ1c5GPWzDu4icl8ND0GCzRSXc0q9UdO9gAd/yW1cQyYqqNrnmm/fSsWxnpObDpNJZa32UlnNRmvpQfFTg/gzpB3tVTRwLrpzIeeASQkkXsFy9hkn4OpGo23W88kOo9FXCPc8d1xvO5kbIfTqODxZQsXR37k9UxmgiAPYLa+HOBi2PZaGyMxltRRQgP7Bb1wR2uAOBXifNR/8Aucj2/wAei4pFY9hl7J1LRvY8OT2nSRfwqyl0uYNlybS9j0jH6iPgdsBZTmZzRsE1rG34Utm6QNuUS7NKspnVkg2N+ER1paN1OKWOQkgKnqqQsvYKGK1Lstb62Tx1TJRY7bqZmi+1lY6msdRi52VI/rGnpf8AxJLW53RPW+gguzKJA0N1LDeueqW4VA54eBb7qPFs08Lp6cg1IBt+ZaXzczbo5IZWxVI72+JRW69S5UigzGz0/wANkkYKoCxP1LTfVvqXmM5jbW/tqWDZp9X12JVUhp3kgnytW1mF49idXrYx5BK57LsUHsdOttm5p81anqQaGzl1/ulp+iMQ6ks9sRdq+yxjLDozFZKmP8RC6197hdQZU9H0UNPGaqEcC9wuZ5DkI1wfZewsRykaUhyTraZonfSm33alfgzcDeGvZbSumuqcNwOlwx2lrAQ1c65qVUMNS9tO7zwvL+a5eO32dzx2C9LonwzrWmpohEXDbblOxTGabFqZzbA3C1a/Fp2zH49rrIMDxKWRoDnFcJPlIzt1s3bsB/j+GG5q9HDEGyGOO979loPqrKesNU+RkDuewXW+J0UVawiRoN1ZK3oKirWucImm/wBlp4l7skuzjOTxNbORG9JYjg03vaHDT9llHS2ZuIdOyNa6YjT91uPq7KT3IXGGm7Hhq091rlbilK57oad21+Au146O9HFZUPR6NvZc+rGooZIoH4ha1vqXTWTHqUbjTImPrwbkfWvL+fC+o8FxHV7bwGn7rcWS2aWI4FLGKidzbOHLl3GFL0SRlTt9T10y+63psWiY4yg3HlbFpJY5IQ9hBuNlwZkh6iaYNjbNX9hy5dO9A54YRiMEcTqtpuBtqXR4l6UiOvKXt2bfhfZlrKlrp/bJtZUGEdWUOIxD2ZQb/dVNX/ni7V0Mbk49Fp3praIhVOeLBPZUvYQbJlPAQbW/lTOiAFvKfCSZF7exLHMZ22IsnAWFlDE3SpG/MrERjTHpHOLeEoBPZJK21t1PHaGNMY4alFJH58KZguUkzfhNu6sVb2Vbo7iWvFDG2Ih3hafzXq6aOCX4h3W0Oral1PA4tPZc8Z0dQzRQzfGe66nhWoXKWzheb/1ZoHPXGIGiYB44K5LzKxpklS8Nd3K3hnd1JNI+f4/Pdcx9dYo+atcNXde1cFnKCXZ4j5DS5yZaiwVMxN+6mOEOcLi/HhP6bw2orZWkNvdZxh/Q1VUwgiL+l6XicpH11s8wyuPm5vo11W0LoYyBfhWN9O78QTuts4tl3WCIn2jx4WH4p0jU0cxLo7b+FcfKQ9foY+DOBF0XSH8bGT5XVHp99qOaHWbbhcv9PH8FWsLuzlv7JnqIRzRaH73HC4zn8uNsXpnb8Njvo7+yfnpfwcQ1D5Qt0YHofCwM3Fly7kv1RK+KJpcbWC6P6IxITU0eo9l4R5BS/wAjmmeu+P16aRmFJCOVcIIQBsqOhe1457q5xsDRdcPc+9M9X4+r9EDYuyljZbZKzTpG6XWA2w/lZtke9nQVV9CvsG7nhU8rR5Uj5L3JP6KCSUAgJ1MdM0aloY9gvyo3Q7bKob8fZOEIdsR/CJR/Yse+ik9o/f8AhLGHMO3nwqv8P4CY+E3sEumhsrOhBUFosSp43623uqaSE32U1PdotZSETaZKO6eGgcJrWEi/lPSP4RyBKHECwSITBjQJHNuLhKg7iyCMjQlIINimSdlHIY0OTmE3somfME8bG6jBfSRSN4H6KJrg5PD7C1ksfpMmI/5ikT9nDhNc3T3Ui+jtiEApjhY2T0HcWU0fg5a0RppeQeEP5ATU9JDlokZ8Wye0aRa6ZGbblPDg7hMfwSRKopYw4kEqTW1NeQ5thsqsiMo5obbgKnDbuIVwcABYhUTh8dx+6rWQ2MdigQyxl2yi/DG+yqri+9k5paeVB+Mlhkf+y1YhRl7OFi+MYWXl1x/SzerbqbbY7Ky1dGJXkWUVlbcezewcz0f01F170lBWwua6PkHsuYc98pKSenmeIt9+y7X6nwIuhdZt9vC0rmn0a+rgkaWc37LDzKNrZ6v4pzPpYk2eU/qHyndDUT+3CeT2XM3UfRM9BWPPtHY+F6eZ65PuqzO8UwO57LlXMjJKaKoke2lHJ+lczkY72fSvjfPQjBdnOXTvT8k0gj0E/sto5fZUPxapiJpibnwrn0tlTUx4iA+n21eF0Xk3ljDEYnSQDa25CpRpcWdRyHkEpUNRZBk3kLFC+OR9LbcH5V1Plz0dQ4DRt+ACwVl6XwShwila4RgWHhVeO5gUWC0zm+8BYeVfpl+P6eS8ndk8jY4x7M2rer6TB47e4BpHlarzVzvioWvEdS0WB+pa3zJz+poDIyOs4/1LnbNjPX8U54ZVk3B4cpbMxM0eI8QdjUpLbNhZm+pF8RcG1Y5P1LQmYvqAnr4pWtqr3v8AUtWZi5o1NS92md1ifK15WdVVNe8gvdufKyMnJUn9PTeJ8X/C1qJfOueuq3GKlwa++pYdLR1la/3HNNv0V5w/DzWuEjgTfyr3Bg8EEVywfwsiy1M9V4jhqlD9kYfHh0rLNc3+lkPT2GNLAHt7JK+CFj7tH9Kow6vjgAbqUULv21ss5+JXXD1SKfqihp4KRzmt7dlqjqHGpKOtcYiditsY9rrqdzGuvcLWvUHQ+I1tU4xRk3PYLZw57Z5dz9UFB6L3kzmXW0WOQn3TtIO69MvRtnJVTR00bpzwO6808qsosadikTxTPP8AmDsvQD0ldAYvhjqcvhcLW7LrML9tHzz5f6JM9XPT91rJilBTtMl7sHdb+wWD8TTtd5XKPpwbU0dLTxyAj4Qurei6tklCzUd7LqcVI+cObn/9r0XL/DjGL2VNKzQ6yu072mOwKtUzi+SwWvCJzalL1J6NgdY2VxgjFt/Ct9F8BBKuULgW7KUhch6Lg8FNebm3hLF/1QRtkgaG8JUIQM2gQhCBRr2gb/dKz5QgvANkoNxdAAhCEACEIQAIQhAAhCEACEIQAIQkcbC6BiWwLgOSm6neUEkm5UfuG9rIHodJNZpBTBIXd0knxC5TWuLUDvUm1gd/6S7He3KjG4UkYuAEz2YjQBgIuAEadPZPaNItdJJ2Q3sRRWxqEIUb6Y9LQJWfMkSs+YIS2EhXgk3+ybYHkJz3EbfZNttdSRIpJtEaa9u+wTjsSixtcKaJVmmMDD2CGfMni990xo+KyWXYyK0yWPunWNr2TGmxt5UrfiFj2UZareiGWzQVBI82+EqedtxzyqaQWFr8Jza0Xq9NDCSRymBh1bn9k4XLipI4yd7c/ZQSkFktBEwbCydKWs3KkbZjb9wqWrmaNlC5pBXuTIaqs0NJDlZa/G5Y3fC4qbFqxsbSQf7WO19e3USSOVVtuNnHw/yRL3S49faST+SrhSV9LMbmQcLWuM9WwYY0l0oFh5WOHO2koKgtdVNAv+ZU53pFl8ZZLrRuHH5aZ0LtLhwtKZwU4nppWsF/hKuhzpw6uiLW1TCSPzKyY9jVPjtM4l4Nx5WRlWqSOo8fxLsS9TZw/wCproyasE7hTk7nsuI83ehaykqJpG0pG57L1OzUy9jxpkn+Te5PZcr54ZEF0U746TyflXJZ0ts+ofDeaVMIps8+6ymqaWoLHsI3VLVtMkfxhbZzNy0lwiseXQFtr9lqzH4XULi3fxwuayP9j3PC5KvJrXZaRhUc8nyhFZ0zG5lwwcKSlxGJjtTypqzHoBHZhum1l+NcLGYninTjmkgbKzuo34fN7gdaxWT4ji7ZCfh5WM41XXuQtTHk9mbyHH12QbLtgHX1Vg9Wxzagizh3W4eis/a10LKc1rjsPqXMtRUSGWzb8rLegocRnrIxHqO66PD/AGPLuXw6qG2dldEdX1nUvttMhdq+63/kr0PNW1UUr6e93DsuefTL0liVfLTumhcQSOy7/wDT/li408L3Qb7dl0+NTtHl3O5kKotJm58gulBQUsf/AA9rNHZdD9MQNbGxpbbZYJlt0i6hgYBGRZo7LZeEUb4dNgb/AKLYqx9I8P5/NjdJrZeIKM+xs1Pw+jcJtxsqygZ/w9nDdTQQ6ZC7T+isKiOtnB3XtNlwprMitZP1EiyptbmsT4pHFu4UkI+pi2zbY5xueUl7d0rW6u6RzHfwVIpP4VdPex7CSN06zhuAmxgjnypbjyE4njF6GanDunNcLblI4NtcJtj4TkiSP0mYeblO5UTSTyFKBYWTh4IQhAAhCEACEIQAIQdhdN1nwEAOQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEHYFCHcH9EAQtJ1EXUrQCBso2g6ibKRos0JX0I10Mey53TC0jhTu4P6KNR2PSGJLYwtITXAWvbspC4A2SP02vdZ9k+9EsY9FHKBq4To6YGxIT3M1HYqeONoakhN7CUHop3Qho44VvxNzWsJdse6utQ5rG/FxZYz1XikdPTuLXcc7rVw5fvowuVrapejXWauLxxUczGv337riX1JyS180+h173XUebHUGpsrTJ57rmnMrD34zUSNa29yey9A4i30SPH+Xoc5s5Ox7pSrqsRcRETcrLMt8t6ieojDqY3J8LZEGVs1VVavwxO/5VtXKjJxzqiN0lMR+y62XK/hh9Obr4z8k/hS5W5GOr4o3vovHZbbwz0907IRehHHcLZWWeXseHwxtNPYbdlshnT1KyIARdvCxsryS2qeoM1Y+PqcN6OVOtMhooqR5ZQ8Dwudc2Mp56KeT26UixPZejnVHSdPVUb2+12PZc/Zt5WOqZpTHTE3v9Ku4fkM7obk+zHy+B9JfDz66i6Yr6CsNoXAXWa5Sy1dHVxF1xYhbO69yYqjM5zKQ2vyGqydP9C1GFVY1wltj4UmXyX5YfR3H8XKuzejprIHqv2oYWPl8crp7orGoqulb8Y3tdcYZYVjsMfE3VaxC6Uyt6mZJCyOSTx3XD8jYrGz07h8VwS6NxsYJbaVVQxmOO3eyt+C1TahgczcWV1bfRxyuakls7SmOkQXmJuL/sntNQTuCpomlFTI6KLUBsmPvou17JIZA1vxOsmT19Mwf5ko/dYzj/WcGFtc6Z4bbyVrfrTPXDqElrattwPzKKX6liUtRNhdb9Q0NHTFzZ2rSGYea7cOjk9uq4+6xrrLP2KvjdEKsc/mWnOu+tazGC9tPITq8FQOXeyal7Wy69b+oTEGSuiirHW42csBrMycZ6jm9szPIcfKtT+lcZxqoLzE4gu8LMeiMpMRdUMc+lcePpUN1qUS9WiXpjLqr6n0ySwl2r7LanRHpliqYRLNRj92rMMo8uxSMiFRT2t5C3dg+HYbhdGG6ALBcbyuSoJ9mjVS320adwXIaiwazzSgW+yrcUbD0vTkR2bpC2P1Fj+F0sLiHtGxWis3utG6ZWU8nbsV5Tz3LeiaTOo4vD/J3rRj2YGakjWvhZUcDytNdVdSvxSRzi+5JS9WYzW1VU4lxsSVY4opJjd68j5XlXOTezvcLEUYlLBDUS1F+11lWDRGOIXVqpWCJ1tKr4qxzRpYsDHvnZYad8IKvRdXCR5sAr505hj6t4Y6LlW/pvD6jEJB8B3+y2b0R0VM+VjjEf4XovC0ys0cFy0IkWH5WQYvT2dSAk/ZW/HfS9BiELnnDwbj8q6Fy/6GjMTPdj/pZ+zonDvY0OjH8L1HjMKTSPOc+t+70ebWZ3pIZSiWdmG2sL7NXPvX2XmIdGTOMMLm6fC9d8xMrMLrqGUtgBu09lyB6iMg21Xvfh6Qk2NrNXU00OCOUyfZPRxT07nDjXTNUGmoe3Sd91vHJv1VYg6tihkxB3I+pahzGyHx+irnvgon21chqsPT3TmL9K1bZpQ5pae6u1OUJGcnJSPTzJPP8YiYWT197kcuXSvS/VuH4vRsf+IaSR5Xk3lTnTPgMkf4iq06SOSum8rvVlRRsjhfiDeAPnWrXktF6qySZ3I18LhqY6/7psl3bNK050J6g8KxqFgFYwkj8y2PgnVUGKMa+B4df7rQqyFIuKWzIIYXabkJzIyX2TqJ8kjdThtZTtaAVp1P2J1DoaI7N25VNVP0H9FWOsOFQ174wCbq/CKZFYkmJBKCdynTSC2xVE2X4vg8qYvJYbqeMNFC+WomNdbSj8K4k9iuYc+K+OOKb4+5XSGYdQYaN5v2K5B9QuOlrp2B3crcwJfjaOG5f94s5ozeq/xNTKxhvclaOxrpWsr6+7YiQStwdVPfiWJPbe93Kq6ay6lxKZrxTk3Phd1x/I/jS7PLuSw5Wza0YflvltNKWF9Mf4W8+j8pBNTMLqPt4WT5b5Nvb7ZdTEcfSt3dI5ZRw07QYDx4XTVc/wDjh9MJ8E5y+HP2MZLNfAdNH28LUWY+UslEHvbRkW+y7+qssoZYf/B5HharzXyb96B5jpj37KSHkymun8FfAOK+HnzjPTFRQVB0QkWd4Wc5QS1FPVMEhIAcFsTMDJiopjJI2ldsT9KxPAOnqjBKo64yNJ8Ktkct/kQfZq8fxjqfaOo8meooIWRB0o4C6Xy96hZLTRhkgO3lcOZc9WGlqI4vc8d11Pkvj5r4oQZL3AXDcpYp7PROGx/Vro6FwTEXvsSVkVNOZGgFYv0vTOlha4LJ4InRNBI7LishR9j0zj46gtlXG47bKQ3Iso4LO5Ujy1vccLPkts3o60Us7i07FQl/kqSpceQFSSCbcgd/CkjFEynpaLjRgObqU7Rc2VNhmpzLHsqpoIco5LsjlNuQ4MB+GyX2R9kgcGm5S+81NexPZtEb4g61krYQANrp1x5Ce3gI2x3tsZa21kJX/MkRvcRy7QIQhNB6QJdLj2Sd1INhZBFJaI3N8jdRub+YKZ43umObq7qOS7GtdEYaBuAlTiywvdNTGuxPUcwgXuUocDwUxCcloT2ZIXW2BS/E9RA2N1IyQAXP/NOX0fGW+gQi48hNLibgDZSx+Ey6I3tJOwTVIozyU9PQo9nyhI9xFrJ8bAWqOV2kjZNl8Eb0DZ/i32T2zB211SiQOdYKWLb+VDJbGfSeRtxdUkkfxEAKt2IVLPsbgJvptFS/pEJjF7W/tOZGByEwveHXsnNmuLkD+U1Q7KymK+IOHCpaiiDQXgKq1nwhx9xpaeLKOde0XcfIcWY/ilKyoYRp7d1gPWfTcc8TgIr8rZmJQCJpLe6xbF6J9QSHNNlm30bXZ2XD8g65ppnOOYmWcdf7gNKDf7LRvXWREVQ9xNEP4XauOdNRTBxczla76x6PgaXH2+3hY1+Cmto9k4HyaUdQbOMajIuDDqj3GUYG/hZH0/hlN07GC9obpW0Ou6Cnw6Nzyzi/ZaCzYzEhwOKYNl02v3XPZVX4pHrPG5jzqu2Zh1HmfQ4XRloqQCG+VoDOHP8AMLZGxVvc/Utd5kZ/EPkYKwcH6lz7mTm7U4lI5sVRquTwVi5GQ4Ps7LiOEqtaejL8wc8q2rqJAytO58rWePZg1mJEl9ST+pWH1uPV9bO58hJuU6DVMy7jvdZduVP6escRwlcEuh2Izz4jJ85O6iosGmLw6x58K4YZQ65b6e6vsVHFBECQLhUZZEmzr68Cupb0GAUTYGjWP5VwrWsMdm2/ZWWfFvwz9LeE6PF31RDIyTdROcpMm/yVjrSKbGGyAEtHdWYSVTJe6zFmCTVsIOg3P2TD0PUvbr9k/wAK1VTJ9mXn5cJQ+lu6fp5a+Rsbmk3PdbUy+yXg6imjc+lB1fZYt0j0pPBWtMkZtfwuk8jaPD6eWFswF9lvYVbTSPKfIbdxloy3Jn0l0EoiqDhwvqBvpXXGSXp1psOEeiiAAt9KsmSFRgxjhis3kXXVWV+HYc+Jj4wNwOF1uDBpnzZ5ne4ezZU9AdBuwZkYZFbSOwW3OmnS0sDQbiyo8IweIxNLIwdvCuzad1PHsLLqMZ6Pnrk7Pe1tF3pKx0uxOylNO35gFa8LlfrsQr3BZzLu8LWg+jKmtR6GRM0i6qoJQ34QVA4AGwQwkOFlKUH9KwAv3untGkJkPy7p6CNvYtz5Kc0gjlMShxHCAX0ehI0ki5SoHjHcn9U5nyhNdyf1TmfKEAKhCEACEIQAIQhAAhCEACEIQAISBwPBSoGpaEc3Ub3Ubm6uE97iNgU21kD0iKTYWTWtuL3Ur2Bw4TdBbsAmy+jwUkfwgEpNDfCNTRsmjW9kgIIuEknZMEg8lI55J2KTfehm0OQmh5vuU4EHhKKKGl3CeNhZNj7pyAEcLiyaQRyE9BAPISpCP4R2HNkIse4SO4KmXwicdhpaeyQssL3Saj/9FPG438JX8E/GyMGxupGvsdkxzbFNLg3uk10R+zUux8guNioHxO3Kl1E8pspsw2UE3pl6qe4kADQbWVQwAMAHKo9ZDlURSgtAuqs7Btk9sbUXHCtGL1nssLr9ldauUNaQCsR6rxD22ka+ypuTbNXjqXZNIs2MY8LuBfx91hPVvXlLhbX65rWB7qgzF6zbgtPJM6YC1zyuWM9vUfHhrZwMQtYHus66/TPS+L4j3S6NgZtZ8UlE14bW223+Jc+dXephsVS4MxAjf8652zq9Vcss0sceJnvtqXP/AFL6hK+rqXObiDj8X5lm3ZR3HH+LSv1+p6DdJepx76trX4iSCfzrd+X+dVHjUcYNXe/PxLyM6az+roaluqvN7/mW8MrPVg7CyxkuJ2sR9ayL8ptaOpr8TdMN+p6eVGOYZiFJfWCSL8rXuYmB4fiNLL/ltOx5C0P0P6taKvhY2XE2m7eNSz/Dc48L6hjDBVNOoW5WPkW+60PxePt4+7cWzn31BZYipmldTUw3vw1cr5jZZ4jC9xZAefC9HOo+lqLqiMyMY11/C1j1l6d4sRDy2jBvfgLKnW5M9I4fmnTpSZ5113RmKRuc1sRG/hW2XpbFYz8UZ/hdsdReluZsrjHQG1+zVi2I+mipjdpNAbj/AEpa6Ozu8byOpR7ZyPP05W6bGI/wrdN0VXVb7NhO58Lrif0y1UhuMPPP5VVYL6VqyWdodhp5/KtGih+xDneUUfjfZyLhmS+KV9SNMBPxeFuvJ309Vhq4nS0fjlq6T6M9KE3vsLsL2v3at+5Z+l1lKYnnDPH0rpcOrR5L5D5JXLemY96YciI6aOmJogLAfSu5MnMsYqGki/yQLW7LH8nMmIcHhhJowCAOy370j0/HQRNaIgLfZdXiRSijwfyPnPfaiy6dO9MR08YGkCwHZXylwtsUgFlJRR+3H8Isqqmje54JC2YOOjybMzLLLO2OihDbaf8AkqgRi1xypGxgD/8AQlbFftt91L6rRnWWeyIvbJ5slY3Tt91L7W/H9pfatwAmuOyo1tibd1I3Ta9lGQQd05rxayao9D4wHEA8cqGTspHON9im6NXZKS+q0NBdtc7KojALdwogw3FxwpWkAAJyf8GtaHWA4CEIThAQhCABCEIAEIQgAQhCABCEIAEj+P3SosDyEAMDCRdOaCBYpUIAEJrni3wlJrd5QA9CRpJG6VAAhCEACEIJA5KABCTW3ylQAJHfKUpIG5SamnugBoNjdO1C2pMTPccBYlL9Yr/6Sl4IKikkta1010p7FIzfn+1HYuhn1iAku5SuDidk9jADfSlc224CoTrJYvRE06TeyfG8X3UbgDwSohIQ6wOyK63skkloTFJbsc1p7LXXXlZPBE4XK2DV3IN/Cw3rHA5MRYdDLrSxYNSMnkYOdLRzvmLFWV0rywHdYZRdCzYhP/mxXJPcLfON5dvmJLoT/CbgmXccMoL6cc+F1mHf6RR51mYDnN7RrXpzKaIyNLqYdvpW1ehssoKYMLYALW7LKsE6PpImi8IWV4ZhlPSsAZGAn5ee/XSIsTiv2+FNhOCw0NO1gjF7c2Vb+GuFWNga7cBD4dI2CwJZLlM6CPHxjAtVXQtkaRb9isa6i6Mpa9hL4mkn7LNHxA9lGaNrzYtBCuU5Uq3tMzMjjVY+kaS6hydo6sOvStN/stYdYZLNpHukhpgP0C66kwWkkbZ0Q4WJ9YdEw1MTiynB/ZW1yLktMhr4hVy3o5Joum6rDKsNDTsVtTLiWtjljY0HsrziOVcklUXtpu/hZV0JlwaadjnxW/ZVbrVYjp8HCcV8Ng9AiU0rDMO3dZO4tHCoMJo6bCaIB5As1WjqjrSlwyFz2zAaR5WTOSTNf0/GtF+qcTpaIXkeP5Vg6izEwmipXD3m3HO607mNnwzD436asCwPdaAzA9Ur2yPhFf8A/JJHvskrWzbmeOcUMUUopaqx34cuV+vM4MUnrH6KtxHb4lberc4arqeR0bKlztR8qzYX0ZinVEupsbnBx2UdvS2LZ0T4f1xiuMVHtiRx38raGXXS9Tjr4xURF17chUWXHp6xJ9SySSkcR/6V0tlDkm7DzE6al4I5CzLbfUnxttFs6FyLgqmMe+jG5HLVtXp3JChoI2ymmbsPyrYHTXStBhVG3VC0EDwrhV19JSxEbAWWJl5frF7Zq07T0lswd+C0eBs+BgbpCxbq7MBmFtdGJbbdir1mH1RTwMkEcoG3YrnvMzqmpqKhxjmPfuvNuf5RRi+zuOKwHZFNoruuc0p3atFUbfqta471ccSc4SyXv91Y+psarH/NIeVYGV8pcS953XiHN8m52NbO4xOP9EnouWJRw1DyQOVSQYcAdksdY1+5PdVtI9jyG6Vx8lO+ZqpfjiUYonOl0tbvdXTBunJ6iZt4yd/CvXT3TBxCRrhFytmdH5aukDXGn7+F0HF8VOck9GLm56j0UmW/ReosL4ew7LdnRnRkMYjcYgP2VN0R0LHRhpdDbbwtkYNhEdOxto+F7B4/xElro4nk82L2V3T2DNpYWlrQFdKi8bR22RQuawBlkYjDI4AsuvVMHjVCC6OJybHNvZR11H+NgMbu6wXqrKGmx17vdgDgf9K2FRU031t2VW6OOMfEAteOD0ZFtHu+zl7MX0uYRNSveKBhJB+hcuZz+m2TCTNPBR2AJtZq9NsSoqGtiLJo2m/lajzbyqosbppWRUYN79lBbiOPwoTxtS6PJLr/AKcxnpuWQwsc3T4WK4Fml1BgtfofUvFj+ZdxZ2el+oqxMYMPO4PDVy91z6XMfw2qfUNoXgXP0qioyT7CFLT7Ng5IeoPE/wARCyaudyAfjXbORGddHU0sLqqrvxe7l5fUGC430RVgyte3QVtbLv1E1fT0TI5K0t0kfUrVM3EsRjo9bunMxMHxKBpjnbx5WQU2K0tVYRvBv91505V+r4yvbE7Ev/kukcqc/YsefGDXA3t3WzjX/wAZK7GkdGP+JuxVqxNkgJtdRYD1FDiVM1wmBJVyfG2XkrdompIr2z38LRTSljrvvyqsyAtJspJ6ONvxWCpZamGMFpd2V6LTMzKk9GF5pzEYe/SPpK4xz7gqaqpma0XuSu0+vqb8dSua0XuFzvmTlrJidS/TATv4V6qyMDlsul2HJOH9HVVbi3xR3u/wt9ZRZWCYRGSmHblqvHTeSL2VokfRn5u7VvrK/LSnoqdmqlAtbsr9eY4row58W5y3ooOlcsqemgYRTgWA+lZlhXSEcUYAYNllFJgMUDA1sY2VZBh4YLBvdJZyM2tJlmnh1r4Y4OmY7WLQrJ1R0DT10Ja6IG/2WwTS2+hMmw9kzbOYNyoIZ9kHvZYfDKX8OZ8x8moH0kjxSA7H6VzpmFlm+gkkdFT2sTwF6I470fSYhRuY6AG48LR+aWTkVQ2QxUgNweAtLG5JyWtkUuH9JfDifAcLrqTGGtAIAcuqvTrDUFsAffssHmySqoMV9xtIbavC3Pk50nJg3t+5Fa32TMm/8iNnCwnXo6B6Jp2toWlw3sshfoLQAOyx3piqZHStZe2yv0LxLz+y5nIf/wBjZ1eLuEdAJS07BNfO66m9pruyifTnVeyhTTZpwm0hGHUd/ClZTtlF7JrIrchVMRa0AXRNpD3PvoIYhELAIlkDR+6eoZmlws1ROXYabKeWe5sCmCZ1wAkfC5rif+qdFCXndI5JIQqoQ4i/2U8e232UUDXNG6kBsbhNT2OXRIRcWUMgs6ymBB4UMvzoJosVvAQXgGyG/JdMcSbp3qyVLZIlZ8wTGv8AzFOB7hIxjTbJEx4AOwRc+SkuTyVG0NaBB2F0JryQbX7JBjWhp52QhNe8AbFBC3oUvsbWTS4k7JL33/5oAN9gnJCQlqRIxpO109rbDhNhO2/KenFlSEc0u4ULmFvKnTHgE2IT09kiewjeA2xCimaSNu6kAA4RYJRSkEZBBsFOzcCyCy5Pwp8UQtuE1xGtEguWKCRtzb7qo4Fgons3SJbKl62QOABIUD+VUyROJNlC6Ox+IJdJdlaMG2LGQBv4TiLjbum6HeE+LbnymSSD1aZR1VOXOu5UFZRRhpOkK71QBOw7KnnpxJFwqVyTNbCucGjDcWohdwssI6zoW+24Bo4PZbNxHDi5x22WMdSdPmdh/wAu+yoShtHc8Zm+kk9nKWdUMtPSSuDfK4O9T/UFVSuqWteRYnuvSbPPomSXDpdER79l51+rnoSvj/FFsDuTwFyPKwamz33xHkFZUls4bzH6vrXVcjBKe/1LC6KpqK+ovM4kE9ysrzC6RxNmJSXhOzttlZ8CwGeGYe4y264jOn672e++Oz2k2VseCRywamt3I8KNuEvh3WQxwsgpwCOyt1bO1hIb2WD+Sz20ep4mfVVFbJMFhZEfjKqa+S27SrXSV7mOsSrlQ082IyBoZe6lrqnNlm7mKvXey1VNPNUA6WX3V56K6arKmra18JNztssy6PyuqcXkaPwpN3eFvfKn03PqpGSOoD2+lXa8ae0cpyPkVVCbbMG6JyeqsRhZIKa4I8LOaXIKZ9Nc0Xb8q6eyy9Ogipow6gsLflWwmZE09PT6TRD5fC6GjE/RdHnGZ57jq1wcjg7FMopcHaZPwtrDwrdhPUE3Ste1rnEaT5XYWaeUdLR4dI8UwBAPZcVZ5x/938UlbGdOlxCvVVqDKV/NV51e0b+yVz8DMShpjVW+IA7rvf08ZhxYrSQvM4N2juvF7LPMKSjx1jm1RFnjuvQz0iZuSVEdPC+rPbutrFs9daPJvLMeN1cto9NOkK+KppmO23aFfnUzJorgLV+VPVUVdh8JM1yWjutnYfWskgBDhuuiptUkj5s5bGlRfJC0tO2M8foqtkoBsE2MB+4CRzS02WtTL2Ofdj1ol1jwp4SHO4VK1wtYndVNMb8cq4vhA1orYxbb7J52F1C0vBCkOoi6UjaI3NJNwnDYWRYngJzW35CBF9FZx+6VAAHCEEgx3J/VOZ8oTXcn9U5nyhACoQhAAhCEACEIQAIQhAAhCEAMBINwnNNxdI1pBuU5ADX8/skaATYpX8/shnP7JH8APb+6XQ1KTYXTHHUb2TN7F2xFGdzdSJjmncprYxsRCEJF9I/bsE9nH7picwjhPHew9rtPZLrPhNQgcmPabi6VNa8AWQZB2Cevg76K/wCVQvcRcXT3OtuopHh2ykihyhsT3Lc2T2ycXP7KmL9PJTBNYqT12Sxr2VT5d7BMJJ5TWO1i6eW3uR5TZLrRn3w9Ziayf5TnG8ZP2TQ0uOyHggEHwqdnwkpk/Uo5i4PIaE33zG291UmIP3soaqmLWEgLOulofFe0kUNfibWMc5x4Hla66/6nipgbvHfusk6vrjRxyOBtsudM8syDhrH2lItfuqE7Wj0LxzjldZGTRhPqVzKiosHm9ucXF/qXmt6pM76yCSqayrtz9S6K9RmcT6ulngM5PPdcA+oPGpcZqpwx5N791jZVr2fQPj3AxtUejUnXGbmI4liD2mcm5PdWOl6irKu7y4m58qlrek6qetMhadyrxgfS7owA5ixMi9o9l4nx2EIJ6KGTqauoJNYJ/lVdBmni1NKC2dwt91Pi/SLnsuGn+FYKrpqWIkEG6ypXxk/2Zp38bVBaSNsdEeoTFqOVkZrCP/cujclPUHVVUsLZqzYkcuXDWGYVUw1GprXbLZWX3V8+ATx6pCNJHdQNpy0mYeRwMbF7JHqjlXmfR4lRx+/O0k25K2tg9Tg2LRjdhuF5t5c+ow4XTta6sItb6luXoX1f08EjYpK/t+ZWKoI5XkePnQtLo7Fr+k8GqQQ2NhJVnqcqqCteXtpRv4C1n0R6kKHG5IyawG541Le+XPVmGY/ExwkaSVahSpP4YF2ZlYlf+2zFqTJKle7ek/pZN07kZh5laTRD/atq4Lg9DUtBYAdllmB9LQgte1o/halGKlo4/kfJr4ppswLpnIzC2aH/AITv+VbI6XyroaYNDYOPsskwbBmNcGho/hZjg+DNa0EWW5j0qK2eb8t5DfPe2WvAOlIKFrQ2OwH2WQU9N7LfhHCuNPhzGsHHCc6jaDYELXrl6ro4TKz5WtuTCgkaRuP7VxY9gA0qghoy0mxU8Ub2v3Oytwt70Y05Rl2VjHut+6ma6+1uygadtgpQSOFdU2yrKaZInNaCLlRh9zaye1wHKmGJ7Y2VgG4TFK5wdwoy0jlOS2ixEVrQRuEoaBwmgE8KQNLuFHJaYr6EQNjdBFjZCSPbGN7Haz4CcNxdRpWfME8QehCEACEIQAIQhAAhCEACEIQAIQkfx+6AFTXOINgmoQAIQhAD2cfulSM4/dKgAQhCABROe4v5UqY7dyAETtZ8BGg+QjQfIQAheSLJhcQ6yWQWBBTEASkDTcHdRO3ui58p53bsEkW9j/XSIOOQpGMF7JRGb3Kf3upGkyPWmODWht/so5Hi9gbJz32ZZUkknxblROtPslgt9kj7AfDuoGgudupGPD05jbOvdIqtD38I5YdTD+ipBQRyOIkb/SuTyA0kqhqqj2jtyrVa18KeRH3jooa7p6mlBIYP4VAenoonEtYr1HXhws5SNDJjcBW4WzgYdmJGT+FqpcNLDayr4aQtO6q2QNG+n+kE6eyhtvciSnDjH+EbQ1gsSmyObbcqGqkf7lwoZJ3gcqOqHu9j7K0loksHHZSxQlwVLTSEv3V3pGNLQXBTWf8A1ogqoU5dlM6med7FMdhralumRqubpIW7EJpfTtBcHD+VTle1LRpLAgkix1XTFK0l3tj+FRzV1DggvsLd1V9V9VUeGUzy+QAgHutCZr52QUDZBHVWtfurEbXKJepxVGPw2R1bmzQUkLoxUNH7rUuYmbVPLSSmKqHHZy55zJ9RdSZ3siqjz+ZYPDnHiGPVBpjM4hxtyq10/wBiO6vTMrzSzCra33Gwzk82sVoHqaXHsSxBxY55BcfK3fhnR9V1KQ4sLtX2WadMeluXFZGzOob3/wBKkpeyGC0zn/LboXF8Sqo/fiebu8LrLIvJtkrYjUUvcctWUZe+mGLDXxl1EBY/lW9+g8s4cEhafaaLW7JuR/qR3JkXQ+UeF0sLHOpWg6fyrN6Hpuhwtt4owLfZV+HwtgYI2gCwUGL1v4eN1iufzJesdovYdbcUUmLYkynZs+1gsB6x62FHG8e9x91N1n1Z+GY8F9tvK0z171fLUawyQ89iuD5fMcUzsOLxFKS2iHr3MH35Hj3u/las6i6hZVSEucD+pUPVeLVT5XkuPPlYhX4hO91y4rx7yDkJaa2ercLx8ZJbRUYrLFUE2VlqIiCQ1EmIOvZzlLTltUQL8ryXMyXbfo7D/BjXX8KelgmklDWjkrLum+mamqkadJ58JnTOAtnqGgtvcrcXQnRcDgxzox/C3eKw1dJHN8i1XFkmW/Qr3CP3IvHZbt6S6Liigafbt+yoeium6emay0Y2C2Ng1NDFEG2XrHC8RFpNo8v5XOlCb9Smw3AWQWs3gK8U9G1imgiY42CqDGWsvZetcPxsIRT0clfkzm9shhpy14eOyrWljwAQL2UcBB+HuknY6Marrt6cVRj8Mydm3snuxo2ICs2O4kYHEMKmqKt7fhuqKSifXOuU+VX8G/7IpKbEJql+lxPKubMChrY/81twR3UdNgJheHK7waYYgCmSx1KA1VpsxPHMp8GxZp92BpuPyrVWafpzwZ9C98dC07dmroB9axrrXCt3UEEGJ0ph2Nws23DS70PdKXejy69RuRzsNknfS0ZFibWauVOtMCxvBah7I2vAB8L19zZyLh6mbKW04dqv2XLea/o8llnlfHh/P+lZVsfxsq2QSOIOher8dwmvb7krwLi66pyAzrnw+aH8TVWtblywPq/0yVnT8hlbRkW/0rEK6PEui3XBc3SUld/qylZPR6Y5U+oDDJ6aJslazty5bo6ezIwrFogWVDCSOzl489IepbEsDqmQurnAB1vmXSWSHqtlrpI45a9xvb6ltY2Zr+lOVj30ehcuKCpj/wAk3FlbpoaiWTcd1guUuaNF1BSxF84Opo7rZUFXRzNDm234WtDL3/SCS/J9ZZcQwySZmlzCbjwrLP0BBWyapIb734WclkD7XAUtNTR6tgFYjld/Rqw1JmEUuWtJBZ7YR/CyDBcEZQtDWttb7LIHQRhukgJrYm8BWoXSZMuNiltopBHG1PY1nN1JLSk7gqF0Tmusne7YLFUf4OeI7blQxtBkspo6d8p2Kq4cMPN1HKRaqxot/CH8K2SOwHZWbG+k6euuHx3uPCydlOIuTwm1Lo9Nv+qWF8oPonlx0Jd6NY1+V9CZC8QC9/CKPpBmHn/LitY+Fnzmtc43Hfwo34aybhoV1ZLa0yF4cYfwsOFtkhs09lkWGTi3xnsqZ+FCPgJsjn0puFmZFn7dElcPVl5ZKy4N05zg7hWiGre4A37KtgqLixP8KKqTkWYdoqHnSdlGZiOUp33TJIy7hLbLSJlEqYJ9TblPbueFBTROaAfuqhrSDuFB+Rk0V0JJCCOExsYabhTlw02sopHgG9k32GSj/wAFa7TtZKHkmyp/c+ykjeDbZPjLsYVDBtdRyC/xKSM3CapSVPTEaPhsmuFjZPTXNJN09PZNFsalDyBZIhJL4KLrcnqNK12k8dkx/BGh6RzQd/slBuLoO4smETRE5xbwmWF7p72n+ExKvpVm/wCAnR901CeRe2mSs2PKfcHgqJrri3dOY6wsQgsRkPTZABuPKcgixslT0TxbI0rW6u6ekc7TtZPJkJoHlOAsLJvufZGseEBockIB5StOrhB2NkhXtSGloDdgozCHG4CqGAEbjugsPlNbGxgij9sDugsPZTubYXukUUpdDZQRRTH4rJWtGhJW7OumRSbWsqk3skp6lpFNPE1ziPuqDFMPifGXaeyucjgSbBUmIE+1+yg2mjeonJNaNSZm9PRVlLIwx3uD2XFvqgymhxGKpcKe/PZd5dYwtlY5tlonN3oduK0kx9sG4PZcxytfs9o9g8Q5F0yipM8lc3Mmo6Sulcaa3P0rTHUXTsGCPPwWsfC9Cc/sqfw4mkbCOD2XEGe+BTYZNKGttYlcFn09s+l/HeWrda7NXVuJxAlgcqNkLqx9mb3VorJ5zVmME/Ms2y76elxOVgLCbkLIhj7l8Ovs5OxQ2mUeG9IVNVICxjls/LHKKuxCoiBpnG5H0rYGWWSj8UdG40t7gdl1Jkp6cYoxDM+iHb6VvYmCpLejnM/ySVEHuRrzJn09yv8AadJRnkfSupcs8j6aghY80lrAfSs16CylocKgjJpWgj/Ss/jhw7BqY3DRYLZhxsdbZ5Tznl998nCp7Lf070nh+GQND4wLDuEuOTYTSxlpLRYLGOuc1qDBWPDakC33Wh8zfU5BRvkayt4B+pPlJVLSObxuPzsy1WS32ZrnbjmDxYVNpez5T3+y82vVfjMBxOodE8H4ytu5x+qh09NJGK3z9S45zmzXPUVZKRNqu491Unckz0jjMC+ulJotPS/VU1LjoIftrXb/AKQ8xnRyU494du687cGxVzsQD7/UuqPS91ZLR1MV5DsR3U9F7ckYvkWO41PZ7K5BZh/iKGnaZeWDuuielMaNZTM+Lk+VwL6Y+u31MdNH7h+Ud127lPUGsoIn87BdRgz9kfOvkFK/LI2Vh7iRv4U8zRyFBSu9uPj909zyefK6eiP6o4aVSFjYXu2VZBHpVPTqug5IVwryjpEjBewPhSAWFlGgbG6CEkAA4CEjXauyHHSL2QJpCoTdY8JdY8FAoFgJulAsLIQgAQhCABCEIAEIQgAQhCABCEIAEIQgansY/lICRwlf8xTXEgXCckmiRJNCkk8lAFk3WfAStJIuUjgtC66F7pHcFKjlQSWn0RSSRGgAk2CVwANglYO6RfSJLb0Jod4RYtIuU9Nfz+yeO9UhwIPBShrjvZNa3T3UreB+iVLbFGaHeEhBHKkTX8gp66JIkb3C1rqF5uTZPcNQtdMeNA2UqeidIppQ4lMB+IC6qCLiyiZF/mXUkWtE8dJFRTRlzdlKWFvZFOQ1o25Uzx3UFk9Mo3Q9pbILBu6SQtLTbmyc5p3AUMznR7g/0s621sWmtaCORrDZxS1WiWI6DfwrZVVn+ZuVVUdUHRWKz7J7ei3+D0W0YDmbFNHTTFt/lK4m9UmOy0DZi6UjY913Lmk9ooZTYW0Lz/8AWNUhrJ7HsVmXz9WepeGxla4s4bzw67L6maN0/wBR7rnXqovxate8jUC5bOzmM9RikrGO+s/81g9F05VVchIjJ/ZYWVb2fVPi9FcKk5GHydPwtYHGIX/RU4p4KSSxYFnWIdHVkcJcY3ceFhmPYPVxSkFrhY+FkXR9uz1bBuo9NbKef2KhtmtCttVgYnfcM/pVkNJNF8wKuNEAB8bViXppl1YELpbRZabpyKBpc+MfpZWfG45aOUvhJFvCzKoLSCBwrBjVCZ2u0t7KGu1xlotf/FJV60Y9H1jXUPwtncP0KuGB5n4rTVQc6seN/KtGI4FMHF3t/wBK3uoJYX308LXons5PleBhbF7R0dlRnpiFJNEH1zrBw+pdg5AepaKFkTJsQ8cuXmTgmPzYY5tn2sdt1srL3OOuw2oY1lSR8Q+patHb0eV8zxMKU0e0uVue1DizY2/jGkkD6l0F0D1JBi8MbmPB2Xkl6b88sQrKuCM1RN7d16N+mDqqoxmmpvceTqAW9jU+yPEPI8eNW9HSmFUcjy17GLJ6Ns0UYAFjZQ9I4cJ6Rj3N7eFkUeGNbtp4W1XjtR2eOcjlL3cf+FBHJOBYJ7XSndwVd+GY0WA/pDadrjx/SnVejn5z9n2R08pO32VQ2xI+5SNpGg3ZdTNhAsfsnwg9jFoVjRynhtzYFNaLXH3UgaAbhX4ddDXWIWEC45Q11vmKckeLi9+FbiN1oUfFwke0kaeEsIUiXemSRk0RMbpFinNcG8pXje4Cao5PbBy2I8uJuEgd+YpyQsub3USemLFbYqXS7kBIpG8D9FIpNitaEbe26VCEezEBCEJ4AhCEACEIQAIQhAAkfx+6VIQCLFADEJ+geSmuABsEAIhCEAPZx+6C9o5KGcfuopeUq+gSe6zynAg8KBvzBSBxAsENaAeku29u6VJo3vdIAqEITW3sBkjHOvYKN0bw0m3ZSl5BskLi4abcpNt9AU7ZADYuUrJWGwuopYA0XBUV7bp8Yi7bK02J+FBaRyFBDMAOymZKXXsl+DfYY9pAJVHOxzn7BXF4DmKEw6TwnxkPjPRTwsLRuptTRtZMe7SeFE55vtZP17EieyWaX6QVbKy+5IVW9zr3QacVHZPSUUNnDrZZz7oeNHdV+Gl/1jhVIwwNPF/2SmAQi47J+4taKTimVcToi3eybIyM7jyqA1L2nYp8U8jyFE61vY1PSHzxsLzsoH0RfsAq2KnMvxO7qZsDW8/80sZ+g11Kf0tkOHvDrhVMshpItTnWsO6qJZ4aVhOwsFi3WXVkFJTP+MCzT3TJXew+umMWLjXXNHQtcHzAH9Vg+P51w4Zqc6sAA+6wLMTMFkXuObUcX2uuds0M5K33JIIpzbi91Qsh3s0qkprRuvM71FQVLZI4a4cdiuecx8x6vGHSNZUOOq/BWv67rzEcRrS107jc+VkvSnTdT1JMzU0nUfClrm49FrWkYFW9PYv1BXFzGvcCVl3QGU9aKqN7qZ179wugsqfTtFiGh8tHe4B3atx9O+mqjonMmFJax/KnSXu9lK2O+zWmTWVEz5IvfpDa45C6m6Ey3wihoGSS0jb6R2Vv6Sy5gwcNtBax8LNYamOkhEYdawSp+nwqqKiOh6ewuD/wqZo/ZPlpWsBbGy36IhxBshtr/tTvfaO91HOxtaHOuM0WyokmpvivsrRjNcZYXNLt7K8V0olcWkK11WGtlJI7rEy1uLL2NBV6RqvrukqZ9Xtg9+FqvH+nqyR7tTHLovGOmGVFyY73+yxLGehmP1H2v6XnXNVbTOs4270kjmrqTpeb4j7ZWD41g0kDiNC6S6r6LYwP/wAvt4WputunBTPdaNeHeSbgno9S4TO+I07iVPNHL8N+SqjBZHNkGo91cOoaMQPPwqzQz+w+4FrLya6+ayDvI2qyk2b0TUwNkaXkdlubo3GqSKNgLxwFzPgvU34WQAPtb7rP+mswbaR739rt+BzHFo47l69xaOpenepKNsbbSC9lk9B1Ix5AZJ/C5y6Y6/fI5jBN28rY3S3Uj5tLvcPK9k4XOnJI8wz8ODm2bpwjEfetcq9Rujkjt9lgXTeLGUN+LlZfh9QXNH6L17hciUoLZyOdjestor2xBvxNUFZM8RkEqqjN2qkr2GxP/RdtVLcUYN24lnqXyvmuL8q64M6MMGsb2VveyzidKqKJ2lwF0jZDC5p9l1nAd8o/dUlZ7jYyQqiJ50/siVgmGmySUtRLMLNsx6oqZWvPxFMiqppJLEmyutZhQJvZQRUIifu3hVH++y3v2RU0uF09VDeaIG/N1auoMucGxVjtVI0kj8qv9IQ0WCnOkH4iVWlgxsWyGVaa0zmPOvIqlMUkkVC21jwFxd6h8nKmmjm/D0hBueAvUfrrBocWpjH7d7g9loTM7IUdQMktRl1/9KqS4uEXsz7sZJHkP1R0Bj+HYg9zIZAA7wVkuWPVGLdM1zBUSvaARyV2rmJ6R2tEsv8Ah3k30LnjMzI6o6alfIymLdJ/KoXT+Iy7a3E3vkJ6jIcOihZNXgWA5cul+jvUfhFdTRg4g0k/6l5TT9aYn0fU+2JnN0nysvy99SOKxVUcJrjbV+ZRyyHBENabketvTWZtFi4Ht1IN/usywev/ABdi197hcG5E58vqxF79WN7Xu5dbZV5j0OJRRh87Tdo+pS0ZspM0q9RRtLS9wupI4HaSSFDR4rSzxh7JWm48qb8Y2xDSFvY920Xoyi1opn1J9wx/dRSe45+w/pVDKUSSGUd906SBzBcNC0ozSF/BF9iUsTwb2VaZRE3c9lTROexvyqnqqh5Kiskh8alH4SzVbyTZypqioe4XCVnxN37pzIS77qvOa2W4JNdkVMx7n3cFcYIhbjlRxwBo3ClEgYEkstpaIbIRY2eEE8K34hC0i1lXPqB5VOYzUHdVbMhzeiq6lsoIIXXAIVbTwvJ47qoiomi2yqY6cM58qWqbQ6EdEUcLrWIThCQbliqgxpHCY9ouWqdpWE6XYkbbt2HdSaG+EkQsLBOTHDQvwjcLAg+FTzF1/sql7r3B4UT2NLtkz0GyIAxx4aVJE1wsCFKImhKGgG6dGC2M9UPj+EblNQlc3SL3Uy0PUULdun72THOA7of8pTE9LRKloEjyQNilQRcWStbH+qEYSRuUpF0jRpFrpUnqhHEkjF7ApzmgC4TYz3tynPd2UfrpkMuiJ4337qIgjkKaTsmO3bdCSRWmtDEIQnJbZDrsVpAO6eDfcKNPjNgCneqHxHWcNt1IG3B2/RNa7V2UjPlCa1oni2MOxsU17S7gqVzRuUxHsydSeiO1u6Ep5KRPHez0OY4Acp17m/lRpRIALf8AVJoY17ErSGt3KUOBUYOoXSqOXQqhoCAeUx4A7bJ6RzdQsqc7GnoHBNFBXsLnfAOyhY0gcK4mnadyVA+AtNgFD2xYQ09lI6E3LrKlxGMe0RbeyubmABUdbDqCVV+xoV2aaMFx+iklefhNlhHVfTrp6eQuiuCPC2riFA2V1i1WXHMFifTPbo7eFn5WH7xezr+M5J0uJxrn/l/+Jo5iym+k9l53+pzLaqZVTWpTyey9d81ujoqqllDo73B7Lir1FZQRVs0rvw/1Hhq4nPwVs9t8Z57Wts8x6zLusZiBead3zeFtzI/LiaaqiLoNtQ5C2Tj2TkFPVOc6C1nflWR5b9P0eC1LGe2NnBZtOEvY9bp5SNtC7N25G5Z0vsxF9MLgDsumuhenaDCqaO8TRYeFpXKbF6SjgYQ4ceVsepzDpsPo9XvAWb5W/jVV1LZxXO15WZZ6V/DY2I9UYfg1M55la3SObrVGZef+H0MEkcde0EX+papzr9STMKpZYYqsbA/UuP8ANP1Q1EtXIz8dy4/UkvytfCDi/DrbpJtdm6c4/UlLUVE0UGIdzw5c15lZ04hU1Dya0kH7rCcezVqMYnfN+IvqPlYhj+L1GJuNnc/dc9kZb2eucX4nCuhLRD1317W4k1wFS43+61zVPmq6sulJNysrqcImmBc8K2yYORNYt7rNeS2zflwcKaekUWEYbepa5jTyug8gy6mqIhxuFqLAMIAe27e63rkdgLpaplh3C0sKbnJHmPlWGowezuz0q4o8zUrCewXotkVJ7uDQk86QvOz0v4LJBU0xseAvRLIYGLCYWkdgu84yvaR8v+UVKE5aNtU8ALNwklj9s3PCq6BrXsuSo8WjDYiQuwohH1SPL53SjPRHTysDhcqsjnj+lysLah7Cb9lU09Xvse6sOCSI3Jtdl6jk18JwBJsFT0b9X7hVjeB+iiktMjb70J8LU17wQkmBJ2CZY+Co29MhcmPQgcBCVPZJHsXW7ylDxbdNQbcEpRziiQEHhCYHECwT0DQQhCABCEIAEIQgAQhCABCEIGR+jH/MU1/H7pz/AJikIB5T18Jl8GNNjcp2sXsEj2gNuAmM1Dm6UUlG4ugiyZqcO6fe6gl12RtghBIHJQCDwmJIZvsEIJA3KTW3ynBL6KnNdewsmgg8FPa0WBslj9EFTX8/snJsnZPJERvAteyjcwuPZTEAixTSwjhPTTJYyRA5t+LJWxbgp+kd0pBDeOydvQ/26GtcGG33UzXhzVRyucHJzJ9BtqUFr2JOO47KgkB9yo6vSYSQOyR1Qy17qKoqWujIus6z4RQf7JGP4rKYpiQe6ii6gigiILxdN6jkDWucCtddU9VnDGvJmtY+VmXycezpsHDllajors1er4G4fNeT6SuAvVt1DFXe+1snY91vnOvOaKlpZmGtA+E91w7n/mzDiMszBVg3J7rAych7PavDuFdLj0aE6swT/FMbeNJN5Csxy7ydbiRaPwwN7dljGBYpFiuOAl4N3LpzITA6WpfDqY03ssiyz8j6PaKrJ4dXRr/GfTg59BrbRj5fyrTuYGQdVSSPcKS1v9K9J4Mu6Kvw4AU7Tdvha+zByFhrY5HR0IN/ATpUtrYYflEY2evseZWP5eVGGOc10VrfZYnitNJhziNHC7WzX9PNVC6Z0WHn9mrn/rnJmvp5XB1E4fssvJo6Z6z4/wCQ03RjtmkKrFSwm4SU1RHVGzh3WSdSZc1VG4n8M4W+ys1NgM9M+xjO3eyyZQcZHevNx7KumUtbhsT4rho/hY7itAxhcAFm1RTCOH42dljeNNi1EBqs0T00YWdfT+NmLDDJ6iYNjaeVmHQuXOK4jUscyJxBcOyl6IweDEK+Nj2A3cusvT1kpT4y6FzaQG5HZdFiL2+HiPkmTD3l2VHpgymxeCsgfJC7t2Xpt6V8AlwmlpRKwjS0crU+Rfp8goWRSfgQLAfSup8suihg8cTWxWt9l1mDVtI8A8nuTbN39GYnGKVkd7FZYyRro9VuVgPTkMsJb2tZZnTTh8IbfsuiqpbjpniPJVxVrkiR5JNx5TmHa1lLFG1zbu3TjC0DYJ7o6MKcuyNjrchK1xLkuhvhAaAbhIqvUapMcGXF7qVh3so2Haydcjgp0eiZND3AkWCaQQbFPTX8/srC6GP6NQhCVtDktjmOA2+6dYeAo+90jpTbYqORJ6slTH/Mme6/ylDr7k7qJLYqTRI1pbylTWuvyUocCbApyWkNexUIQlEBCEJ6+ACEISgCEIQAIQhAAhCCQOUACEXHkJNTR3QAqa5hJul1t8pQQdwgBhBBsVGWkC5UxaDyFHICTYIAYBc2T2ggWKGM423T2sFviCAGpQ/SOErwBwEBoLOEAMfPZ2xSfiB5P8pHwE7jwqeSKQn4UAVLJml4upDKwKhEUwNxdKGT33KAfRNPJtwqOUnkeVW+2XAEpj6a5tbupCL2KWEnVyqyMkDYpraSzuE5wLRsLKOT0Oim2SRO3AKe+1uFTxzfF8ylMoPN0z3RL6shqOf3VPoKqXaHHdI2KzrlSxmh6eiARkmylgHtkGylEIPBSmK+wUjkn0MsmvUX3Ba6pqqQOvYeVM9pLbAKndC8k7JvskUn2ymEOo7qrpqdjTcpPY7qkrMSFKLl/CR2pCF2GlrbjhUWJYxDRsJLuystX1nT07XNdOBYeVg/WmZMMUbg2oH7FQu7fwemXnq7MSCijdaa2x7rTWY+bXuMfHHP2PdWDMDMaSbWI6g8+VqfqDqCsxKoLQ9xuVF7kkfgvXHXdXVyva2UkH7rW+N4LWY08uDCS4rMo+narE526o3G/K2B0Lk5NiLmF9KSCPCFuRZqno0V05lFiVZWNcIDz4XQeTOTc8EkZlpuCOWrbnQvp6p2xslkohz4W0OmMs6PCGg/hgLfZOUWn2WlNMZlp0NT4ZTRkxAHSOyz+Ckp4mBoYNvsqKhbBRMEbWgABVLaiN5+E8JdpENm2+id8cTWE6ANvCx/GZJGOIar1JUNDTc22Vuq2xT9rpSrJFsw6tlbLdxP8q/U1T7sYv3CtceGXfdo7+FWRwyQt4TfVj4y0MxO0Q1BU1NUCX5lLiEhfHY9lbW1Tad13OssLkJ/jRapabLo6ljczU4KzY1S07Y3FrQqifH4Y4z/AJg4WOY71VShrgZwF51zWVBQezYw6bpWdGK9ZMga14IWmcwI4XudYLYvW/VEEgeGyjf7rUXWGOMc9wL+fuvEvIZxm2emcInBLZrfrCJrXkAd1ik1M43IWWdQyCokO9/urXHh/u8M5Xl9+P7XdHoVF3/09mMye/FJcXV4wGsqxIACf5Vezph07x/lX/ZZBgHQ8pe3/IP8LreGxmpLo5/lLk0y/wDQQrKiWPkre/QWCVMkLC4FYHlz0O9jo3GA8+Fvbonp/wDD0zbx/wBL2zhMJ/jizzPOu1Yy59OYfJCQCOFmOG2DRfsrbQUQjPyq6wRFgFgvWOGp9Io5fLsUy6wytDLKOezxa38qmgdIXbnZVejUF2NfUejAuhvot1RT2NwE2ONzDcq4PhFrEKCSns64GySTKLg4sIpiTZVLJGt/hUmgM7BODzfcprlskhLTKmSQPFgFSTtt2VVA1rgLpZaYPabBIoMtxlsoW1Ri5Ckjq3SEbqKopy1+n7qO/tj9FOo6RIpeyKyRjJ7B4RJg1DMz44WnbwmU7y8i3lVoc0NsVBZFDZxTMM606GwyupXgU7blp+kLmLPnIpmJRSmnoxuDw1djVUMVRdpbcFWDH+hKDFIXNkgBuO4WbdDszLqfZnkVnF6ZsWfVSOgoyPiPDVrSiyQxnAKv3JIXCxvwvWvrf084fiOt4oGm/wDpWis0PTpHRGV8NABYHhqyMitlL8TjI5E6U6qrejGtMkhbpt3W38uPV+zBaiOGSuItb6lrLPTL2vwQSCCmc23gLnDHsWx/BMRJa6QAOKhqfox62kes+Vvq8ocaEUJrgSSB8y6B6E6/puo4GyMkvf7rxayNzpxfD8UhZUVbxZwvcr0J9NGfdHJSQtqa8cDly1Ksr0JoWaZ2vRuAaHWO48KqBY4btWDdN5q4HX0rL1rLlo4Kv0HVVBUx6oagG/G60K82Oi5C6LReJRG1p2VtrNOo28pgrJKk/wCW7+EraeaR3xKZZCkWIyQQAlVDHBvbZSQUgY3cKOqYIxYFRW2f8JPYWSqA2CidUF/BVLK435PKfS3Lhfi6h9nIRvZUxxOl3VVTUwYdxwinaAOFOSAE+EPZ7ES2xri1hv8A0o31jGmyiq5HAEq11NU7exKtwjoPVv6Xlla1xsD/AGp2yscACsepahxdyVdaN7nEXKsJaFaK5pBGwUb3aOU4OI4KiqSdPKcltia2RzVQG47op6kPfYlW+Z7tdrp1LLZ4ulcWBeWuDgk0HVf7plO8Pbe6lJANiU19DGmCbJ2TkEA8hA5fCNDuD+ic5oAuAmpNpMenojQn6AmHY2UpIpIEIQkfwR9skbwP0QBfZDdwLJQ1wPCYRy7YyTsmWuyw8KRzQQmFunZBWmRkWNkJ7gCOEyxHISr6QtP6CUGxukShpIuniL6Sx91Iwi1lHHxupGc/smN7LMRXOG4TEr/mKY8E8JCZCO5P6pEIUi7HpaQO4P6JoJ12unHgpoB13slQ+JKzj909rgBuUxnH7pHki1ioZDX2DpA02KYaga/3UcpJ5PdQuJubFVJR2wK5rg4XCHMa5QUr3cEqqay43SKD2JvRSyDkKkq/Crp4y3sqGsBAvZTRj/CaMlotdTECVQYnTaoXH7KvqHuDlDUAyQkaVWyIy0zSx8hJo1v1pghqoX2bfbwudM5svhOyRxiHJ7LrXFsNbNG67Oy1Hmr09C6kkJj7HsuVzKHs77g8+aktM8/s2enosIdKdIFiey0hi2YdPgGIFrpALHyul/U7QNo2VLmR2tdcCZ39RVGH4hKWuIsTbdZ0KdSPauEyrLopNnR/RvqQo6NrWOrP/kr71D6j4KnD3iKs5b2cvPOfOeuw2qDBVuAB8q/0OeNTWUml1aTceU+xqMT0zi+PjfJOSNsZ6Z0VNfJKGVTje/1LnHqbqSvxasc/3Hc9yrl1H1VNjchvMTc77q20mFumfqI5WFlXaPVuG4rHritobhFTVOAY8n+Vk2GU3utBe1RYZ0+1oEjmBXqCnjgYLW4XO3Xbl2dNHDrh8LdiLIaaEm3H2WJ4jjcEc+geVkXVFUGxuaDysHmpZKmrIaOSoqWpvsp51cI1GV9I4qKqrZGPzLqn06dPuq5oXhnNuy5kyw6QqKnEotMJN3jsu8fSrlxM/wBgvpj27Lf4+PZ4V5tbCEJHUfp06NkhNPL7fYHhdq5RxmkoYmEW2F1ozIzoIU1LA72PpHZdE9H4X+Dp2ANtZegcd8R8leS5CsvkjPsPq7R89lNWTCZllaqOVwba/ZVrA4gXXV472kefWVR9tlJNSm509ynUtLIH3t3Vxp4Y38hVDKVg30qy57KkkosSjYWtFx2Cq2OA2+6ia0M5G1tk9pF7hRSeyKfY9zSTcJh2Nk8OB4SqNrbItIjAubBO9s9ynISpaF1ojTDs/wDdTaR4THtbqvZKLsE8OBNgmIBI4QISISNcCNzulQAIQhAAhCEACEIQAIQhA1J7GP8AmSJz+f2TUqY9MCL7JCwDkJb6dyl1h5sErYN9jdA8lKNkIUchjY2TskDiBYJX8/smppG97FLyRYpE1zCTdGg+QgWO2iSPupm8D9FCwEcqVrhsEsfo7TFSFodylQnh2iM7GyErmkb/AHTHSNabFPSQnt2Lob4S2FrJrZGuShwJsCmveg/J2UtY3SbhUck9gbqvrRcfsrNXS+2SAq83tGlSvyQHSV9id1HJiBLTc9lbqqpIJKo5cS0tLSVTn8LFOG5WfBvU1c0U5dfsudc9uuP8Jppne4BYHutxdZdQNpqZwL+x7rkj1U9TFuG1MjZOx7rHz5KET1LxLiZXz7RzN6lc/H0f4hgqxsD9S4rzJz4dWV8jfxQN3H6llHqs68qRW1UQlJ3PdcidRY9W1OIueXusT5XGZdrcuj6E8f4hVRT0dE5a5oRnFGySTD5vK7A9O+bFK+aBonbyO68y+keoaummaRIefK6FyOzelwaqgMtSRZw7rPrte+zr8ji3bVtI9c+g+tKfEKFgLwbtHdZjFh1Li7NIY03C4myd9SVCYI2S1vBF/iXSOW2fGCVgja+rabgfUtzHtTjqR5bznE24k3ZX0ZP1XkxRYvG9zqUG48LRGbHppie9zoKLt+VdYYD1nguOU7Wxyt3HlLi/TuG4kw6o2uv9kmRVXNdGPxvk/IcfbqbPMvMn06y0sbnGjIsfyrSvVGUkuHPeRTuFv9K9VMxclaPF6d5jpW7+GrnrM304vj91zKMH/wBq5++nTPUuL84dta3I87eq+np6PU0MIt9lr3HaeZkhBBXZ+ZXp+rGOeW0R7/StJ9U5G4kyqLRRnn8qrQg1JFjN8sc4PUjXeVNBPJjETi11tY7L0Q9HmCRysp9UZO4vsuW8qslKyGric+kINx9K7q9KfQdRhfsa4bbjsuo4+L0jzbmOaVm22dh5T9MRfgoi2L6B2W3MCwIRRtcGLEsqaJsdJG0s4aFtfCKGN0TRYcLuuOri4JnhvkPIzeQ++iCghkicAGq+U73sYNkQUcbBawU7Ymhu3hdDXFJHB5VitKmkqLgXP6qqBLhcBUEcZFt1WwSBrbEJJrXaMuVbD2zflNIsbKbWDy1NcA4Gyga6I/RiM4Spmhyeo+hfjJE1/P7ILwRayapNoR/QQkcdIvZJrHhDHxB7i3jwmpJHgm1uya5wdwmvf9Jo6Ypeb/oUNedX7pqFGk9iy6RL7l+LKSPcgnwoGc/spk8i2yRCRnyhKgQEIQpF8AEIQgAQhCABCEIAEyZ2lt09R1AJZYIAZ7h+yc0ki5UTXBux8pQ7VwgCVKHkCyRCAHaz4CY42F0jpA11iE0ggaimNvYEjHHZye0ki5VGa1sbrHhH+JxNF9Vkm2BVHU7snAENsrVU9T0tLs5w/lNPWGHsi9x7x/KkAu41d7IDQOQFjVRmXhEJtrb/ACrfWZuYVAL++3+UutgZtYDeyRzhY7ha5kzqwouLfxDf5TBnLhmsH8QP5SqIj+GxHOc02ACVpJFysHizjwV9gZmkn7q64bmFhdY0WlG/3T2miopdmTR90yaMWvdUdN1BRz20PG/3VY2dk27FWslotw+FOIy06vH2Ti823Kkk40gJgic4KDZOn0Re6L//AK08VAcbBRz0pbuXKOKP4+U6LY2TKyOXbtynudpCjjaGgbJwBceVKm2V5vYhNzdChrayKijL5HBY7jOY2HYeHB0gG3lJKTIW0X3EsQFJAXbceVr3q7reOkD9TwP3Vk6xzyw2GNzRUDjytOda5sx4nI8Qz8k91BOT+jTJesM1nwzOEc39rX/UOZEtfdvvG/6rFcZx2qxCoLWkm/G6hoMAxGumDrEglQ+732KvpcHNqMafa5N1dMEywmrJQ8xE3PhZH0B0FPNKz3Y/HZbt6IyyjdEx7ohzvsm+xNH4au6YyYc57XmmO2/C250Hl3HQ6GOg4+yznCejaSjiAMbf4V6o8Pp6Y6msH8K3j/sLvTIsIw+moqdrfbA28Krexj22aid7Q3YcKJlSASD/AMlZ0TR3IpqqAtdqKSMNYzUDuFNVn3hZqo3tfFcE91DJd7LG21tjaiokcLAJlNFNI8XCmp2tkdchV8LIY99O6E/+lab0xaWnDG3KdKxrtrdkOqGAEeFA+paHbH+1NH1IGygxWIxsJAWHdQYuaMO3tZZvicjZICButedb0Er45HNB3BXJ85P1TaLWNJuaMQ6lzDdRBzfc4Hla66kzZeHkGbv5S5kSVVK54APdaZ6mxWr913Ox8rxTyHP9N9necTjuejL8dzJfUEn3efusNxnqk1sh/wAz+1jNbi1SHEEnlUH+JyawSTyvIeTzfyTZ6BgY/okZK1zqtyvWD4IZ9I0/0sZwbE2awCO6z/pGrgmLAbdlj0Y/5bNm/K5Qr0XvpnoNtW9pMV/2Wxem8r2u0kw9vCXL6iglDTYfwtwdL4NC5jSGDjwvReC4uU5Lo4nmuTVSZZulOgo6NjCY7W+yzbDcOjpYw0CyuVHhUccYs0cJ0lFpBAXt/E8d+OlHneRmq+bG0wbe91XREEAWVviaYn7lV8DC9oIK7vAqUYpGdbplZA1qmaNP3VPTNcx1j5VSt1LSM+z6I5oIuo3tBBun6xfhNf8AFeyhk+ytOKKeRgumNALiFO9htuo3NNrKNOW9FaSaHNl0fCFM2YnYqkDDf/qpoXAbFWINaHQkx0tP7gvZUk1I/ewVxbO22nyhrWPPCd7LZbg0W+A+x8/hNmrrus0pcbaYv/DCoqdjnHU5QWSJtbiV9I98puVV9viVHTVMcDdwnTYi1w+EWVGxvYz1WxammgmaWOF1g/XfRVHibJGCEG4PZZo2pJJB7qKWj/FyanDYqnOH5HorzpUuzjzO704HGw8w0RdcHhq5RzT9H1e10sseHu5P0L1rrejsOrm6ZoWn9QsL61yUwTEaOQ/hGEm/0qpbTKK3oqWUSS2eMeNZPYn0RWGY07m6De9lkHRGetf0XI2B1U5un7rsf1M+nmCKnqJKWibfSbWauBM5cu8bwXE5Pw8DwA42sFmWWyh8Kck4nVmWHrEqKiSKA4h4HzLpnKfPw41FEHVQdq/1Lyc6Aq8fwuvY6XWLHuSupclM1p8KEInnItblyijmyiwjZ6np70R1bHiULXagb/dZhDUhzQfsuPMq/UZh1NExktaLi22pbu6Wz4wbFI2tbUgm35ldpz/X6Wq8j1+m2DU2CjfI2QHdY3h3WFNiTAYng6uLK90TnVLdVir8Mh2/C1G12fAfTF7rgJ8UIYBdVUcYG1kr4NI1jhXqtssx2xYngCxTjK5w3UYZqbqvxyoTWRscWE8LSqr/AOk8Un8JZ4/cbbyqKWh1O/8A1qsbVCRSNaH7q4oJdjmtfS3xUWg3srjSsDWhL7AAuAmvmEI/dI9IjaX8KhRT3d8KbDP7xtdTiMO8JVqIzpFvmpdV9kxlMWOB+6uL4wLmyjMYJv8A9E72TEeh1JdjQCFKXXN7KD3B4T4zcghRv6IS6z4Cco0KNsBXOO4SIQm7TAE1zRYlOSOBIsFPvoftDEJdDkug+Qk2xQjd8QbbuplCxpa4EqXWPBSDH9Ec0AXCY5urupNY8FMQQS+DCLGya5urunuYSbo0Gycl2RyS0RhgtvdOAsLBLod4S6D5CcMitBH3UjOf2TGtLeU5nzKPZPEcWAm6a4AGwT0jm6u6an2TLoj0DyU0gB1k/hCcn/wkE0DyU0C5snoS7Yb0IBYWSP5snITX8E2iCSMkbHv4UYpyXb33Kq7A8hJYDeyjcdhtDYoSOBwp9gLEqL32MFiozUB55Keof0Zslls6/wCipKqFpbdTgl24PKJIi5hCkjFIVNotTaFsz7FEuGRhuhV7KV3ZR1DC3a/ZVchIK5tT2WWvwpvtGw7LWuYXToqqZ7LeeFtyVgcwj7LFeqcIE0LiGrEyK4tHV8Rmuq5bOAvVLlyZaapIj7HsvNj1MZfVcVfP7Ubrb7gL2Zz26CONU88LIdyD2XC3qFyAkkqpgaQEm/0rJsho958Z5OmTitnlB1p0niVPWEhjvm8Kmw2jxKmjAfdda5neneWnlfMaLufpWrMbyukog6MU1t/CycmTSPeeCy6pxTRrjCI5ZZBrve/dZfhlAWsa4t7KWi6HmpptRj2B8K+02EOYwMI4XL5c5b0egY2ZOOtMpY2uZCNLeyo6utewlrb/AMLJI8LfIwMDP6RH0NU1rrtiPPYLInFs1p8soQ+9mC4hTT1pNgd/spuluh5sQrmXiJufC2ZheU9XUOANMT+y2VltkhI6qje+k7/lUlNb2c1yPNbi9MteR2T8s2JQOdSmxcPpXoT6aspYaOmgcYLWA5C1Dk9lhTYdPDrpwCCN9K67yjoaXDIYwQBsOy6bjq3tHh3medOyuWjduWvTMFFSxNDBs3wtkYdTshhDR2WF9GVkAhjseAs0oXtmYAHcruMJOKWj5e5t2TvbZc6OxdclXBha5oF1bqdoi+IlVlO4HYlb9VjUDmZxbXZWQvaywuqhlSCLBUv4cyN1NKKeF+u11KrTOsfZXXL9gnMaRtfumsGhouU5rwTspFJsh90PILDcFGs+Ala7V2TXcn9U9fA+ih5JsnKNOj7pQHJHNG5SoQIt7I0Jz+bpjgSLBAoo2N07WfAUYdp+EhKHB3CAJUIQgAQhCABCEIAEIQgBr+f2TU8tBNymIALatkNjLdwErPmCega3oYQRyE1xIFwnOdq7Jr/lKRrY0Y4kgknsmsJJ5TiLiyGRjfdI1pB9QITvb+6NA8poJaHDYIvbdCEsfpKlsex2obpUxhsbW5T08bLpDZTZvKoaif4uVVzOJYVQ1DPi1XT18K8x8U/N3KVklzyqRnKniuTwkeyu5P26JKmxjJPhWPEWlzjYK91W0JVpmjMryCDyqs3o6DCf6JlkxBloy5Y5jVd+Hjc7VwFleMwFkJJHC1tmBif4ClkeDw3yqF01E6viqo32JGF5kdV+3C8me1h5XHXqm6+jdh9TF+IBO/dbVzwzYGGslYZbWB7rhj1IZyfjPfZ+JBu47XXPZ9jkfQXh/GVQgujmX1FVzsVxSo0yXuStD4h09NJUlwaf4W0Ou+o24piUhc69ye6x9lNDUPBDR/C4vNm09o9t4zDjGKWjF6PBZ6VokDTsrjRdT1ODSBzZCNJWUOwMPprsjWI9T4HNGXODVmV2/ttnZ04SeP8ADOuk/ULXYMWj8c4AW+pbey69Z1VR1MTHYodv9S47raaojJDbj91TU+L4nh1QJI5TsfK26LtI4LnOIV21o9fcifWC6vhh14pe9vqXWeVWdWHdSUjTPWtLj/qXhzkxnVieDiJslURY/mXYeQ/qqdRRxsmrwLEfWrM7txPLuR8XnFt6PU+irMNxeOwc03F1aepMvcPxVriYWm48LnPKr1W4dUhjZq9huO71uvpvPTB8XYwCqYbj8yrP1t+nGX4WZgW7rfRiPWvp+oMQDtNG03/0rWWN+lKiqJi84a0kn8q6ko8fwzFmXY9puqyDAqKrcCIwb/ZFeJ7S6Gy5C5R/c5Z6Z9LTKKdro8OsAfyre2UmUn+DGO9LaxHZbTwboqhdGCIBf9FlGCdJxwEaIrfsulw8VpfDkeS5SW32VnROFtoYmNLLWAWfYVIGMFv4Vgw3CnQN+U8K7UMjoyGldXhQcEef8llK2bbL4xznW08Kpij1N3CpKNwcBurlC0BtwtmL1E5+ctjI2HVuFM2zSE4MuL3TJfh+FJKXRG37dEmpvlKFCzlTKBvaGtAhCFEnohcVsEIQnKT2Ma0GkOG6YWEC909BFxZSp7QqbRA75kaHeFKQ1pta/wC6abdkNOQ9TGaXeEBpvYhPTgwEXKRwaQsp7Ghltw1Sx/cdkNaHcpwZY3ukS2hnsxUIQnJaFT2CEISighCEACEIQAIQhAAmTAluyekIBFigCD2r76f7RoLeGqfQPJRoHkoAaxpt8Q7J2lo7JU18gFwgBr42udeyKjS2NQyVTWGxKp6qu1MsmuIFvxOrERdZ3CseIdQew02f28qrxh7nAkLGMWhmkBAHKPUCgxvrA6jeXgrEMezIqadro2Tmw+6uWMYNUvBsD/CwvqHpuskLjpPfsnAWnHc1KuFxP4g8eVhfUmdldG0htS7v3Vx6g6OxGYmzDx4WFY9lri04cRC7+Eu2gIanPetheSap38qkk9RVayS34s/7lj2O5W4zHd/sP/hYXjnReMUTy4scLHwj2Yj+G5aL1D1AcHOrT/uWcdG+omSQsY6uP+5cgYhVYjhxs9xFlWdMdf1dFUMYZiLHyklP/pWUf2PRLoTOU4gWA1l7nyt0dH9UQYhACZwb/decmXmc0lE5hfU8EfUuh8sPUFCY2NNS3gfUqlki1WtfTrhr4pBqa4FRTyFoIY7+FqzpvOinrg1pqG7/AOpZpg3VlPiZFntN/uo96J1FFxnlq37C6jZJOx+6ukcUcjA4W3ChxSOOngMg8KaKbGS0yGHEWR29x9klXj1JHHdkgH7rBOresm4YX2kAtfutf45nNHSnT+JH6XVhQeiKcejYXX3XTKWmeRUDb7rnPNbOmSgdI1tWRa/dVHX+bLq2lkEc97+Cufsx8Ur8aleI3E3JTJReit6ok6mzyqqyqMTKtxBPlJ0/1JXY1MCHOOpYFQ9C4xX14c6JxGrwt15SZVVjnxulgd25Cr2RehpkvRHRcuLRsmliJJ+y2z0TlGai2qm/pXbLrLr8NTR6ofHZbh6P6fpqNm8e/wCiruDY9IxTp3K//DdL/wAPx9lnWA0AoY2s9u1vsrs2KO1gwcKN8Wk/Cl/E9kqROxoI3CW7RtcKBtQ4JwlvyFcojoc1sSofYEalTxuDncp9Q8+FDHzdWmtktaaZVtiLxcAJstLrBBG6kp3i2lTN5H6qOURzk4soY6J0R4UjwdPCrH2tv+yp5GtItfsoZLRXmy1V1Y6C+6of8Uc87OsqnF4XPJAVtipJNfCZ7qJGlsulA/8AFGz9wrd1PgzZ4nBrNrK6YZTuiAJCTGZWiIgrjufs3W9F/EqbsTNDZl9EiYPPt+ey0X1l0aKeRxMfddU9bNhkjdqAOxWjsxKeAa7Ad18/+S2Scmj0/ha0q0zQmNYKIZHACysFVS+2+w8rOOpo2idwHlY6/DH1EwDWrzp4s7rdaOxhdCuJSYVC8SCwKz7owSNkju0q39N9GzVTm/AT+y2L0nl7UhzCIj/C6jieFlKSejPy+RSi+zO8tKggs1Bbx6RljMTT9lqvono6ppg0lh/hbP6fpZaRrQRxZevcLw7g09Hn/LZn5dpmZ07h7YcPCZUarbBR0EhMQCqxB7rdwvVMPC9akcjKxexbbFzuFWUjiAAiSiLTsEsTTGQFs01evwX32isiN3Aqe4HJVE2fTwFKarVsCrqImtskIF7ITGPLrJ+6jnFkU47BMcy26fcDkpj5BYgKPRWkuhrmgi4G6YXad7pxkPYJhBeNkqbXwij/AMF92290+KoI/lRe07/6Ce2Ow5/pIW4fR80DaqxO6hlovbbZoVVT6Wj4kTvbpIv/AGmSROm9lrmZa4KiDQDcKpqI9Tja6a2lLuyrThJhJrYjGl24Gyr6OIBt3N/RRQUxafiUxeIhZOqq77BLZMSByqerjZKwtc24KbLVBo5ULKsvfpUWRVtDZx60zXmaeW0HUdLI38KHagey5bzX9HUONOknGGgk330rumemZOwhzb3VrxHpugqoyySAG48LncnGlrozraNnlL1j6Uanp6qkfHh5AaT9K151HhWJdHSOa1rm6F6g5r5S0FXTSyMpBvf6Vx7nxkhNLLOYaQ9+GrJnjzRnSqe+zmilz5xTAJ9Dqp4sfK3Hkl6oamrq44pq89uXLSGYGSGMRVL3R07+fyq09H4JjfSle18jXt0nuE1QmhupI9Sclc34MXMAlrQQbcuXQ/T/AFZhstG0ipbx5XlhlHnxN0/NFHPVW02G7l0V0V6p4po2RiuHb6lsYLaXZZom49nb9LilJMfhmBVRPOJIy1hvfwtBZe52Q4votVA3/wBS3B0xjjcTiZI1wN/utymZfhf/AAuv+a2ImxVjrKySCoLnHusmIDo7bKz4zhDZjrb37rXrs19LSv8AUioMQEhBB/tXyjcJG3Cx6goXQkArIMP0NjsXKf8AKtCu+MuiWeQRt3VuqagPvcq4VDGyCwKpjQBxsTsonYgU0ihFVKx3+WbKtoaid/JT2YYwd1PFBHELXCFYv6MciQAvFiEFgbuQlEjGi991BPVtHwkodmgQjg0cJ8RAtcqm9+/CcyUm17cprm2xyWytYGuF0ulp7KKCS4tcKa4PBSbbBrQmhvhGhvhIXkGyNZ8BIINQhCsL4AIQhAu2CEIQDewQhCf6oia2CEISkbQIPGyEJrbTEUVsBzunhoG4TE8cKORPEVCEJo4RzbjYJul3hPuByU0vse1kqekLtjeOQl0m17ILg43CC4kWR7MRsNLvCNLh2Stf2ITrg8FPE32MsfBTX3DSSFKmzC7CEClvqJwL3Kp21ZD+VPU07nKkFK4v/fypUkwLlSPMm43VQ64G4VLRExmyqnO1hD+jXIic8tGyt1bVPBIuVciL7FWzEYASbKjkfRPi2QMrATZxUVXTMrIiLA7KCSOUP44Kno5H3sQsu2LZNj5Uq5owPrToaOta9whBve60PmtkfT4nrkfQgkg9l1liVKyZhLmrDOqum4aqJw0cjwqNtO0eh8Hzc6Jx2zzkzc9PUbvcDcOHJ+lc6Zg+n78O+RzcPI38L1E6/wAsoK3X/wAPe/2WkcwsjGVLJC2k/wDisTJpbPd/HvKYwUU5HmtjuVj6KVzRRkfsrHN0NNG/SKY/wu2+rvTrJLM4toz/ALVidT6bpdWs0Z5/KucycVtnrGB5PVZBfscy4Nl7JMQXUx3+yz/pDKZtTp1UvNuQtu0eR7qCQB1MRb7LIcM6QpsGYC+MbDus+WNo03yf510zCuncm6OMB0lMOPCzrpzoTDcLc13stFvsnVHUWHYa0gyNFljvUGb+HYcxwZUs2v3TVCMGVp1ZF66XRtTBq3C8K0u1NaWrP+j8zaOne0GqbYfdcZY76h4IXkirA/8AcqPDfVFFTybV45/MtfEtUWjleW4Sd8XtHpr0XnHQhrGGub/K2l0tmTSVbWuFW03+68q+lfV5FDMwOxFv+9bsy09YlE9sbX4gz93rqcTJ1/TyDnPEE236nolF1dDKwETj9lV0fUzZXBrJeT2XK3Q3qOpcbY1jaxpuPzLbnRHW0eIyMcJQbjytmGT7I805DgJURa0bzwmvdNBcuvcKvpgXPusV6dxmJ9O0h43CyCjxOPsQrcLNnEZOJOuTWi5yENAvwkY5lr3VNPWNewaXJ1O92m5V2ue2Y84ODKtjhzfZK+1trcqCGUk7qUnuVZXwdB7BKCRwUlweChKOJLgclFweCkfx+6GcfugBJOyanP5/ZNQAhaCbkJQAOAhCAJEIQgAQhCABCEIAEIQgAQhCBj+iP+Upie4EiwTdDvCBBEIQgBWtuL3Q5ukXula4AblDjq2akfwWP0RvzJ9h4TWtINykkJ7HsmEiWxz+P3TE0yOPdIXm+xSx+jktDnP0nhAfqO6YSTygEjhSL6JJbRK5hsbqnniJJsqkm7LlRSNv2TovZUsWl0UzYSObKaFovwlLWn7KOKcB+m6X4iGMW5C1jgBYKiijEj9wquqGq39qGH4TuO6pXM1qpesdFr6lia2ldbwtJ5yvkhw2dzdvhK3d1N8VK4fZaezXw81mGzR6bnSeFj5Mts6/x6zVqR56epzG6xkk7Yyfq4XBmdeKYpPVTNOr5ivSfPrKupxGaY/h3G97bLj/ADdyGn92V/4J3zHsudzX9PprxOyHpHbOK8VirHVbnOBVRhAkMrQ9bX6pydmpah//AAZFj4WF430pPg79QhIt9lyWWmz2/iFCaXZX4dFA+mGshWzH8Ep6kEAA+FRDGJ6f/LAIt2Sf45JK6zisOcpRmdrSo+iiY9ifRBlcSxh/ZWSu6CmaSdB/hbLo3x1A+MIxLD43RGzQr1NzSI7uOhau0apjhmwJ3w3GnwrzgmbmI4FIGxzPAB7OUvUuBzVDnCNm/wCixLFsFnpSfdZZXoWqXTOZ5Pi6lBrRvjoP1WYnhsrB+NeLD8y6Nyb9X1ZUSQtfXu3I+tec0c09JPdr3BbUye6jrYqqH/iHCzh3VymD9jybnuKhptI9fsmfUMMWZE2SqJuR9S6Z6B61gxOON2sbgd15c+nvrepD4Gmd3zDuu8sgsdmroYQ55NwF0OLjqWjyPla40KSZ1j0pIydjHADdZ7gWFxzNB0ha+y4pZZqaJxG1gtq4BAYohsuqxMZLWzyTmL2pPRMcLY1lmgKklpDG+wFlewPCQ0TJDctC2KqVE5O6xtaZbKN0kcoBV+pgXRAhUDqENkBDeFXQP9uMNU8impEwFhZI9uq210rXh3dPYARchQy7DeuyNrLG5ClNiy4TXgXtZJcgWuo5LSG++5Ag37IQqzfZJ9BCEXHlSRZE/gAg8JuuxsQkL9GwPdNLxa4O6sxIHIc4gm9+yRM1uSKVLZH7koNjdPBuLhQhwItbdSMIGyRrrsfCeyUODuEqYCRwU8bhR7JQQhCA0wQhCTaJF8BCEJPZACEISp7AEIQlAEISPJA2QAqEjTcXKVADZHaWqlkmOonf+VVvaHCxVJUR6TwgChrJHE3vx91SzSnRbf8AlVc0et3Cp5IARwlS2Bbp4/dJBVO7CROflVzNKS7YKqpqdrbXaOUerAxyTpNk22j+lBUZYx1UeoxDf7LOKejY/fQqxgjY0R6R+iQDVM2TUE7t4B44TTkHRzD4qZu/2W2NELd9I/hJ77GmwCT2QGkOp/TrQfhXFtK29vyrT+YHp/ggikLaZvB7LsuuayelcC0G61117gtPPE8ewLkeEjkLrZ535m5Ry0skgjgsASNgtQYt0vW4XVkhp2K7zzG6AgqhI4U3c9lz9mHlgWSyFtMRueyicuw9DRdPjNbhxADzt91mfROadZh0o11Dhb/Urb1B0LPDI60Z2HhYV1HHWYCx0gc4WBVacuw+HUXSGfjKZ0ZfWn/ct35T+oGhrZ4mOrb3I5cvLHGc763AZy11aW6T5WT5Xer6XD66NpxUizh9SIaf0cns9ueiuuMOxmjY5tRclvlVfVmNQQ0DiJfpPdcH+nX1fsxSCJjsUB2H1Le+L54Q4jhGttYDqZ5V2lLZKkt9Fpzn6+FG6UNmtz3XPfUeZFVVVhZHKT8XlZBmt1dJjMshjlJvfgrAcF6YrMZrrtjcbuV5R2hLIajsvFHiVbi7dJJN1kHT2XcmMytMkV7nuFk+XeUFTU6C6mP7hbm6LyidRlhfS23G9lHKK0UvVmC9Een2Co0PdSN/2rc3RGR9LhzWH8O0WHhZj0n0hHQRNBpxtbssshgbCwNay37KrKCTESLFh/SMGGU4Y1guB4VQyb8E61uSru8amkWVtrKEvdcNUEoj1B7JabERKdKrWM1xq009JJG4GxVzp3lrLE/0ljBsekEkAaVE4EjZVD3GQ7KJ7CN7HlSwTRKuyL2yeUe2fspWtFtwkeLHYKxEetJDGO0O/wCaninaTt2VMdzspYYy1uop0kmiGcm0TSknlRv+UpDO08lROqmXAJVO7orb2MmoBNue6jGFtYQq6CVrxZpUdbUMhFy4LNtlrsswj7FPPLFTR3KxrqLHYYWuvJwPKj6v6mFLG7TJZav6s64lLXtE3c91x3N2OUGjoeOxVKSbKnrLqmJwc1r+3lac65xJ9QXWPJKveLdQy1bz/mX/AHVhraB+IPJ0k3Xi/NY8rbH0d1iaqh0a+xSjlqZC7STc+FWdO9Iy1cgLou/hZ5hWXzq14vATv4Wb9KZYthLb039KrxvD+802iLJ5BwX0seX2Xokc0Oh/pbg6Wy7p442F0Q/hVnRnQ7KbS72eB4WeUGFsp2NGjhemcTwcFp6Oay+Uk19LZhXSNPBGC2MbfZVxwlkIsArvAxrW6bgJtTFts1eg4XHqpLSOdvyZ272UVJEWuDVd6Zg0WIVridofcq4U9RfhdTVUlDRntsmdAx3IVNPBpN2qp9y/1Jr2Bw2CVLTBTLbO7R27JkMrtW6qJ4A47hNhhAdaymiO9iqpjexUzrW3CbFGGDjsleCTsla2O+kErye6ppZXA2Cq3sG1mqJ1KC7dv6KBxXsNlFepDE4vG6q6ePbeybHTaRfSp42aeyl9FoqpaD2dr7fwk9qx2spS4aOVHJIGnYpnoTRKermMRsFD+Ic8bJ9U0zG6SCC1gf8Amj8eyRS0OhZr5HdVMdMOSEsMADQbBTWA4CT8cRHLoZ7YAuVRV5OqwVVNUNaC0kKinJedQSOHqNU/Uo5ZHAb/APNOpTdwupRSl+9v7ThQvj3aFDKPsL7uRVR6dG6jl0F1iVETK0WUTvfcdlVsxtjZJtEON4FFidMWFoNx3C1d1vkZT4y6Rxp2nV/pW26d0vDgqj8OyUXcz+VSswUyvOnZyF1t6TaaoY54om9/pXOudPp1PTsMs0NJp034avT6uwOjqoi10DTceFo/PbKSHGKKURUYN79lSng6fRXnQzyO69OMdLV7/ZDmhruyi6LzqxehrGxzTvFiPqXUmdnpbnqnzytw49zcNXN3V2R9Z0xWOkNK5tj4TVX+JlS3dZ0fkRnw8yQiaqI2HLl2Xk1nPhtVTwiWqG4HLl5M4T1nV9HSAiVzdBW0st/V7LhEsULsRIsbfMrELNEDukj16wrrXDMQYPanBv8AdXKSoinj2de/G64Eyj9YQxGSKN+JXuR9S6ky1zhpeoqRjjWA3aO6uQydIVZst6ZtAt0m4CaK10Rtcq3QdRUUsYd74uQrbjHUtPTgkTBP/wAj/wBkscn/ANmXU9e2UcqcVTBuXLWTMx6WneQalv8AKhr83KWJp/4wceUf5H82WYZH/s2s2riLb6/7TfxLHGwf/C003OyBz9IrRz5V96fzKhxGQNFSDf7pyvb/AKWo2ey7NkOD3btKpqiJ4KTBMSirYARICSFXPYxwsbKRWJ/0mh8KKBribFShjrhSRwEOuf7SE2dcJ6sTJo/SWEFo3UnuDuFC2QhvKT8QPKlTJNFQHgmycBcE34VO15JBBUzJNuU/+jWKlPP7JEKdfCLemCEISjgQhCABCEJ0fo2QJQ0u4SJ0fdK/g1DSLFCVwIN7d0iYx2mKGl3CeNhZNj7pyjHAkc7T2SoIB5CjAjTS8biycQRyExzTcmyBj+iJbnyUlxeybJ2T09kUpMkD9uErXXKjAFgU9ndSxCMhyEIJAFynNdksZDXRtcdwmfhWcjlP95nlHvNdx/yS7kh5GI9Dtuyka621u6cGh/CDGG7/APVJ7CP4BFwQqKanL3m5VczSTZRyNANrKrYtyEelEoJqFluFT+y2J2wVxkBtuqSpYXKtZX/wqxn6SKSskaGkW7KzV7WytOyvNRTvkbwqN+Gvfe4VSdbOlxL4ximYbimBR1bjeMG/2WN4x0BBVNcHQA3+y2h/ggJ+T+lHNgsQHxMVGyj2fZ0GNzc6WlFmg8ayepJtTjSt/wBqxTGMp6Kmaf8AhW/7V0timC0zInO9sbBawzBfSUUT32AtdU7cGHrs7bhvI8y+xQTOdur+jKHDxI8RAW+y0hmpj9LgUUha8AgHhbeznzMw/DvfhE7QRfuuLfUNm/G+aaNtXtvwVyuZGMZNI998Ustv17vZjGZ+eDsPkeI6oixPdaL609QtZI97WVLuT9SsmZHWsuJTPLKgm5PdavxETVk7ruJuVhWy1I9x4/jPyUbaMtxfOrEKkuAqHb3+pWR2bWKxP1++/nyrNHgUszr2O6jxDp2SNp2P8KSq/wBZdMbl8PD1+F+iz3xahlDhUv2/1LMugvVTitLOwPrXj4h9S0nX4S8A3B/hWeR1Rh02uNxGkrbxspnA81w0HB/qenfpv9U8tbLE2avO5FwXruzI/POjrooS6suSB9S8KMlc3qvp+pZqrHCxH1LtP08eqOX8RBC7ETwB8y2sbIbkkeKeQ8RGO0keznQOYdPX08eie9/utjYRjJmaC197rhH0856nFo6dhrr3I7rrrLvqIYlSskMt7gLoKZ/DyDluMUNvRtSjmMgBcVdKd40cLHMLqSQ2zleYpD7WocrUq2jz/Mx9Mq2yhvBUzJvc7q2xTEus5VEU4B2Kvw20Zyjor2D4U4NJFwVBFKXAC6qGXT5BJDhsLITXPINk4bi6ZsZrvY2Tsmp7wTwExKKA3Nk9oIFika0WBsnIAEIQgAQhCABCEIAbrPgJWm4umJ7PlCAFQhCBGugJsLpvufZOdwf0Uaa3oRfB+gfZI5thdOTXOFiEm2O0NP2ShwablImv5/ZNe9DlFCvmvcXTfc/1BJYeEWHgJv7EiSQb9krRc2KRAJHCdH2GivAB2Qxt73KS5PKlDSeE9OWxjYDezU142Iuld8PKjfJvYKSKIpRTEedLSbKiMcnv62juq0ODtrJBJGHWITtMaqn/AAjaHubvf+FDI0xi6q5J4w27VQ1VSLkBVLYNluqqUumWrGpHytLbcrDOosDbXRua8XuFmtc5pbe3ZWKrbrlIA5WdbVF9M6Tj7HQ0zRuYWVdLXarwA3v2WkcwfThQYhDI80o3v9K7GxzBmVB+JvbwsWx7oyCaBwLB/CycnGhLZ6dwnk9mIops81s1PTOylmlMNGe/DVzvmhkFXxa9NG4Wv9K9YesMqaSvmeHU7Tf7LUuYnp4w+sjc4UTdwfpXM5WIvuj2jg/NIaivbs8hOp8qcVw6d5NM8AH8qxSu6drKKYhzHbeQvSLNL0x0uiR8dC29zw1c3ZoZFPwt0rmUtrX+lc3kYm5dI9b4nyKN8E2znKkc6mFnKp/xSGUe24q9dS9FVlBI4NiI/ZYTiFJXUsxBB2Kr/ikn0dph8lXbEvVRRUsrDKGgkrHMdwGCtBJYFc8NrJ3D25DwOEYu0mC7TZWKa25dlLlJxdbaMFn6WpnT6bDlZhl9gYpqqNsbfqVgPuOrNGrutrZL9JSYtXQjTe7h2XQ4VK6PJuct/V7OgvTh03UVM0Li0/MF6B+njA5IIYLtOwHZc7elvJeWohglEHjsu6sm8qJaKKL/ACrWA7LqsStR0eA+UZKi3o3DlpD7VBECOwWxsOfph2CxfpPAv8OgZGRawWU0zNEdl0FL0ujxrOsdlj2VX4k3t91X0jQ6PUVbYoyXi6ulMQIhdXISbRi3peokzAXbBDmgbhPcbm6gkeXH91L3oqNNEsLrmynJDNgqWBwDrKq0EgbqJ/Bq7EcdRvZIl0FIQRsoJti67C4HJTXOtwUaD5CVrS3lV/6O2/gqY4G5KehTL6RyRE5uruk9v7qT2/ukaPiseymi9ELjsZo22KPbHcqRzbnYIc2+4Cni2MlDXwjDLG91I1nBulDbDi5Sptjeh9cdPsE4tAbdNQqrk0WFoUFo33TtY8FMQmOckOS2P1jwUBwKYhOjKTF0SIUaFNH9hr6JEJgJHdL7n2UmtDHIchN1nwmuk3tujQnsSXHkKN51Dc7JvufZDzfZOSGTm9ChzQLApDKQbApjr2sE5jfJ4Q0hkZybHiYk2sEjoxKbE8pzGjVwo6mYMO3ZRPaZaj+yIamFjXWao30l27ofO5x1FOiqL8o7XY1t+2iNlGL7j+1KyjtvZPErSbKRsgtsEJsmS6JImtYLXTJGkG4KbJNpt2UkbmOZc/2mez2I4/0awFwsTyqetjfH8TVWN0H5QmzhjhY8pU0NS70Wt9ZMW6DdWjGMM/GtIcOyyB0MAde33UFYyAxkAjhOenHZarUU9Gruqei6d8LnaeVpfMro2lj9w+2OV0Z1U+nhp3l7wues4erKChdK10w2v3VVy70aqw4yh7aNG9WdL04leBGOPC0lnF0+YaR5jjtz2W7sY6ww+tq3RtmBvfusFzLoaXEsOc5ljcdkjSfZTtx1FnAefbqzDjM+MkWvwtE4dmhjOGY0GiZwAf5XWvqAy9dVtnLY7g37LlzqbLKalxF0jID83hRtNfCm4pHUHpez2xCEwiWsI45cu2Ogs25scoI4XVN7sHdeYeTkVdhFXG34hYhdtenSrq691PGXE3A7qauckxIzR0hh2Evx17Sbu1FbbyoyhimmZI6C9yOWq1ZL5eTYpDDI6Mm9uy6Yy8y+GGMY97ALW7K/G2TQtk046H9C5Y0mHwsc6AceFnVJ09RwMFoxdVlHTR08DWtA4UpcB3SOTZVS6KfS2nOhg27KR8w0XKhq5fisEx5c6PYn+UrW12P9EVMMjJOSnOiY9U9KSBYqe5HBTXFIGtEczGt+VMD7CwCdNubqF3zp8Yx0MbaKlgHPdKQCLFQteWqZpuAmNaFi2NcLGya5urupU17STcJe0iTfRC6IN3Cc+U6LAJZAQLFRTmzLhJKb0RNbIXXcoJmlu6lp/jd4S1gAjOyo2zEjFbKZuIimF3HgeVZuoeqA0Eahx5VJ1Hixow4grAOoeqXvcQHfssu2a2aNFcf6P646gkljcGP/ALWscfq6uYE7n9VlzKh+LyFhF1OOhXVpt7XP2XM8hRO6WkdDizUI9Gs6KiqqiWxYefCy/pvpMVbm+43+VlNBloYjcQ9/CyXBejXUrgdFv2XOXcJGx7aLTzpqP0pemehqeNrSY/6Wa4R0nTMYCGDb7KbCcJMTRtwr5RQaWcq5hcNCuXwycrMlJfSGjoo6UWa1VmsgeEukNNz+yje4EkALsMHD9V8MuUnJ7ZPFJf8A6KUgSDdUkZsLhVMTrm32XQ01OKIJaIJqQh2oJrXSRmwCuIia5u6jfTNLuFej0tFWTeyGGVzgqhjibA+E1tO1vCkAsLJjXexpG6BrjcpRTsG909CRN7Hb2hpcWmwKGvPBSHlIpE22O2x+hqbZuq109MbyP1SrsSUmojwLcIQTYXTXOBFgnFfewc4nZMczV/CcGEi6UMNwjeiVdDGQAXunCFoN0992coBuLpu+x/8ABWuLRYJHSlqEjm6u6XSGFNUAvO3lLDDqFiU8sJN9lJGLNTbmvQatt9iRwhnKeQDyhCqJslikU9QxtzsqV8mg2sq+X4tgqaSnA3snfSTSIWynY2T/AMQ6wCUREm2yX8PfkJHDaIpPoRlQ4mxOypcTwSmxVhjmbe/N1WthDU4/CLgKP8SbKspM1/1hkngeLUcjjA0uLeLLl/P70zUBppp4aLcA2s1dtzuc5paTsQsM6/6IZj1E9gYDqadrKhk1RT6Kl0VJnjJnxlTiWD1kzKaB9g4/Sufsbg6jwGtLxrAa7wV665w+lhmMTyvFCCST9K5dzf8ARzLAZZW4dwT9Koyil8Kk6kc6ZLZn4zQzsNRUOBa4cldqen31EmnjjiqKwcD6lx9j+U9f0ZUvcKYt0/ZUGH5sV3R84aZnN0m2xVedjRnW7iz1VwX1BUEsbS6sZx+ZUnVGfNH7ZAq28fmXnFgfqtqYwGur3cfnVyrfU7NWw/8A5c7j8ypzyZRf0rK2UWdlY76gYKYlwrW7b/MsLx71OMa4sFcP9y4y6u9RtQ1pIrXf7lgOK+oSqmlJFW7n8yrSzpJ72Twvkv6d7UPqQdLOA2tHP5ltDLPPsSTsL6odvqXmd0lnVNUShz6lxsfK270NnmaPQ41R2/1JFyUl/S3DLlF/T1lyzzioqyGJslS25H5lsmm63oKiIPZM03/1Ly5y/wDVV+BfGw15FtvnW8ugPVRDXhkb8Q5I+tWKeQm39L1WU9fTuCn6igqDZrm/yqmCqbNJfUN1z70ZnTS1zWn8Ve4H1LaPSfV0OIhpbLe48rbxshzL9dzf9M0mfY2aiOGRwumUsjagBw/lXGFrGttZa9b2i5Gfsi3tlkbJptwq2BmofEUgjhM17d0sj9BsFOk2x6fRNpZ5/tLpZz/1VP7p+/8AKjfVO4U4zSKstba4TVTMqzwfKmhdqF0CihxLrJyd7ffa6NB8hADUJ7WlvKVAmtkaUOLeE9Nk7JdsNIRzri1kiUAk2CXQfISCiBxbwla4k2KVrS3lKmNaAEIQm6QDX8XTSLixT38fumJrXYaG+3903hSJC0EI7I5xTGJWkjgJfb+6cBYWUkWxij2N1nwE17iWkFSIO4spU/8ApIkUsgPI8KNj3auVVSRna5Ch9scj/knb2PJ4HkbJZXuta/ZMjOndLIQQSPCjl0PSQkUjg5OcdRuVHE8E2CeeQoH9G+u3oPbDwo3UzeCVMw2Nj3SuFxsEJbIp0pPopzTMIsqeWINdbT/SrTso3xa3Jsq1olplOJQVWmJt7K21cwDSfCumJD4P0VjxKTTG4jws3KXr8NfFiptbLN1Jivs07rO+krnXPvriTDqOXQ/sVuzrbEPZpXkn6SuS/Uv1OyPD6gF+9j3XO5mROC0j1TxHj1ZPejkD1KZwSU9VUuFVY6jtqXGWamaNXi9fIz3yRfytn+p/qOpnxipDXnTrPdc2YtK6pxA6r7ndcjlWtyez6e8O4qUZReiXRUYm7U+5uVKzpnS4Pc1XvpXCYpowSFdcUoIqeLbwsS2TbPo/icKKx1tFioMAp/b1OaL28Jajp6mnY67Btwqh1V7EZIdwqUY0XNc1rklW99FXkaoQRYMQ6XpnSuYGj+FjfVHRkEVO6Vjd7eFmMlRNJUXB5KWvwCrxKmIa24IWxj+2zzzmPT1ZpenNTh1W4RXFits5K9eYlh2Jwh0zrXHdW9uVNbUTFwpyb/6Vf+mcuK/CapkpgI0kdlrY85KezxbyOqMoto799I+aszjTe7UcEfUvRnIjMeKqo4mGYHYbXXjrkP1PUdOywh7i3SR3Xd/pszk9x0ERnPLRyujxrJNo8U5etL22eknS+IMrIWPaRwsop9To7BakyV6oGMUER1Xu0d1uTCYQ6FpPhdHjyckeVcpFVzZSuY5hs4Kanj3G6nr4AHAgJlOwgg/ZXo9IwfsiqgZxuqgOLeFSxkgcqZkgOxKd+zEkiQkuKcCAACeyGuDhcJruSnRTZDKWh6TQPJTWkA3KdrHgp2mJtsUCwsmucQbBKHgmyU25IR8DbAbi6FCJgTp3R7n2SDyVztPZN1u8prXauyVA5Ja2OD3X3KcmN5H6p6bIaM0O8JzQQLFKhOAEEgcoTC4kWKAfYXLjYFGhyQHSbp3uX4H9pGtiJaF1t8ph3JQhMJEtCFwHJTXkE3CV4JOwSNbflAoiErhY2SJUthvYIQlaATYp8YiN6EaN9/KlBI4KYWAC6NZ8BLoYMnlO9nKEyk8kJ7wXm33Ub4SCpItJCNbHNcQeU8xNLb91C5xbwmPq3sbt2Ttiwn6jp3NjBBKo5HtJ2d3VPiFc/wC6omVz7/EoLZx+Gpjwc1tFdPGwtIVqrY4YiXGylrcYihiJc4LGeq+sKOiopJXStGlt+VmXyj/TUxca6b6RT9TdS0lAfilaLfdYX1BmfhkEbmmqb991q7ODO6CidIGVTdr/AFLnPr31MOppZA2tGx/MsnIsjo6fA43JbXR1fU5l4PPKdVSzc+Va8a6qwWuj0iVh28riKv8AVW+CQuNeP9ybRercyzBrq8c/mWHfNfDvuOwLo6bR1J1dg2G4pE4sax1ytFZsZRwYlHK+OlBvfsq3pD1DU+OaI31bTq/1LZWCGh6spwTY6gs6VMZnoHG8lbhx02cNZhZDSiR5bQn7WatN9X5IVUTnOFERv4Xp51NkvQV0Rf8Ahwb/AGWqOt8gaAh5FL/8VWli6PQ+E8lrm9ex5w1+XlXh07rwOFvsrHj2C1MUJAiOw8LsTMfJKOmnkEVL+my011plfPTyOZ+HNv0UddKUjpczl4Sp+nPNHgVVJiI/yzz4XSXph6RlmxCmD6c/OOyxbAsp55a4O/DHn8q6W9NuWj6Sup3OgI+Idlt4sNHlnPcpH1fZ2x6UOhYWYdA51MO3IXYnQuAw0tO20QHwrQfpqwFlJhsILbGw7LpnpaGJsAGr6V0WOktHz15XnucmkXCOn9u2ltlVwOANiVBLOGO0tCmp2Oe4Fa1ezzuyfsV0bTYG2ymbPpAAPZNjjOgAqKS7dh2Vyt6KU3sqmVOocpNJcdgqaF51quhAsCVZ11srTW2JDEb3IVU1wsASkDRovZNBsbqN9keuyQkDlNeQRskc4kWskUE0KCEIUDSAEIQpEtCdMUAngJQzfdEfdOUkQ0hCwEpHMtwnIUqehHFDQwdykc0C1k9NeCbWCSXaBR0I0NPKQ8myLEchChcUOBI4uB2SoTPVCp6AcboQhOjFbBvYIQhTxGNg7hR3PlSO4P6KNSNbZDJ6Hv4TE9vyoLATdCWhE9jbXCawPJ3TnNDeEMte5SiNbAsIFymukEYuTZOkkAFlQV9TZuxTZCwh2VEmINabA3THTtmN78qyyVL/AHPmVRS12nZxUci/XUXeGBjh8QTzSxgbdlTU1WHC4KqnV0DW2e4bfdN9tLQyVLUtkUkQbfT2UUlYynaS54CbX49QwRHVK0bfmWF9X5gYdSROtUNH7qOckkW6Mec18Mirup6SEnVMNj5VorMxqWnOkVQ/laX6vzlgp3uDKpv+5a66jz6ZC55/Gjb/AFqB2JMurBlJfDqaPNahjFn1bf3Khrc5cLiH/wCWN/3Li3GfUiIAbVw2/wBSw3qL1UyRXLcQ4/1pv5kTV8c/+Hd9Tnnhcd/+Ob/KtmIZ+4WxpAr2/wArz3xH1byNJH+Ijb/WrDinq7c0EHEhx+dJK5a+mjj8d+y2jtvNH1JYfTUMmjEWjY8OXHme/qV/EVEzY8Q5J+paXzO9V76mmeBiI7/Wucuvc/anFKx//GXuexUMJ7kbk8KMaukdIUWfE82Jb1u1/KzaizNjxiiaySe/7rhzBMyq2esDmSnc+VuLL7rLEaqNoL3HZXYraOdzaVDZtHrqggxmJ/wA3C091TlnFPK6RtMP1stsYZNU18YbIHG4VXL0o2pi1Ojvf7JHE5rI/V6NG9N5fOo68aITs7wur/S9085lbTtdH47LCsAy6hmqtXtf0uh/T/0NFR1sBMduOyYnoo/kezsj089OxjD4HGLsOy31SUccEAaxgvZazyKw2np8JhtbYBbUiezYA9lPXL/g+E3IhrJHQw3Gyo6eslkfpv3VdiABi/ZUVExvun9VYJUtk04dzZOb8qknjBAsE1sRDd/+SkHjogBwO6lUbRpUiR/BH8I5Wute3dQkHXx3VURcWKZ7Tb3SJ9EbWyOx8FTN+Fg1I0NQ8fChNMEtBqae6R58FRueWlJ7o72/lO0SL4Oe8OHKglBN2qRJ7bnEn/oo7BrRBtTnhUmJV7REQHqpxIlrdQWOYpUPBIWbf0Mj/sY31lM+YODCsEq8LqKh5u087LYdVRurXm7b3TqPo9krtRi5+yyLd7NGl9GIdJdLPFQHPjNlsHCOnYgG6oxx4U2H9PR0hFmWsPCvVFCGNBP8KWnHjZHci6rnGOiCLAIA2/tD+FMzBmsItHZXOBgeN1OIgeRZSvBrkVJZM0y2fhxC24bZPhm0ix2VZPR672/5qimhMRT44kYMj/L7Ie6XVwUjWl24UYFzZVMEYHdXq61BELnv4MaNIu7ypBUNbwUlQ2zdlbKmpMZ0g7fqr1copDHJ6L0yvYBbUnfjGO31BY9HWPJ2Kq4Z3uFlIkitKT2XdtQHcEJ+oWuSrfFI4G4VTE9zgLpkktiKRUD4uEpaRykh5/dPfx+6Z6ki7RC7lIldyf1SJ6+jiRRnY7eVImAaihPQ2S2g1EncpErhY2Q1uopfYh1oe0EgWCe1thuE1hDdkuseE1slSEkDSkAA2Cc0BxJKHNAHKapdjtdDUIQn+zGAGC+wQRp2IT2tGxTX7myZYtoVdsbqae6C5o7prm24SWI5ChSHrofZp3QWtIsQhnCVPS0SEbILOuGp74vhOyezn9kr+P3T1HZDLsopXOb/AAopZyAd1UzsaTZQOpS4JjiVZJ/woJKh7nWB2U8cLpGaXtB/VONBofqKkMrIxyqd8E3tkKit9lsr+k8Nrgfdp2m/kLXuY2SmFYpSyltAw3afpW0WVTXOtdMq4mVETmO3uFQtrWuhLKotHnZ6kvT3T0zJpIKAcHhq4G9QGXlbgtRKYIHCzjwF7X515XwY3RSFkNyWnt9lwf6lfTqJvff+DPzH6Vj5HRj5Fb0eYeLY1i2DTOBkeACnYdmNWlul9S7+VtbPHJR+ESTOZTkWJ7LRNfg8mGVDmO2ssPJtcTIs/Vlb1J1fV1LSBUE3+6sEWKVsr7mRxVZT0bax4Y625V5oOkYjGHFv9LHsytEat19HdO47PQtDjKVlOH5lT03wtqT/ACsRr8PbSt0tsLKiihnfJZvlUv8ALfsOV/7G2cIzfroZGuZWH+VszLj1C11JUxtfXO+YfUueMKwSskaHNB48K54fS4xRVbHMa7Y32C2MS6UtGjRZtnozk96g5aoRaq7sPqXXOSeasdfFCHVN727rydyc6qxqknijc9/ZdvenTqnFJI6dznO4HK6zBlLaNeiR6G9J9QRVlKx4eCrzNjDWA2d/a1Dlj1DPJh0ep5vZZk/EpJRzyuooX6mnWZXQ4kJ5raueFc3M9yzh4WHYFVSCdt+AsspagFgafCvRjtbJk2PfGQNm/wBqB8JuSPKrWAHlBhaTdIPKJsJPPlVMLS3YqQQtBuh4A4QA7W3yjW3ymIQA/U090amjuo3OLeEjXEmxQBMCDuEEA8hMa47BPQAgaBwEqEIAEIQmyAEIQmgBAPKaWG+wTkIAZod4SKRRoAUMJF04MFtwlbwP0QnpDf7oYWkC5Q22rdOfx+6a3kfqlFS0K9gO9uFCY7fT/SqDuLKNLti9DdFm8bqOQO7X4UyZLx+yY3/CQhYC03TtTvKALmyHDSbKJ/Rqa9hWu5JKkbJ5N1TueQbKSL5bo7RM4jnkb2H6bKF8+k2J3SSyOBO6gfdzt0SekJGCTG1vxRklY5j0ntRO3ssiqr+1sFi/VhLad5Cy8p7WzX49KViRrPMjFxFSyjVvpPdcZepjF5JaacB/nuuqc1a6RkMu9vhK439RFc50UzD91yuan2e7+H48U4nAHqKqg7E57u+orn7EawMxAm/fddB+oLDTPWTyj8xXN/UcE0Vc7Tflcnkpts+m/G7qqYxMw6dx4QwgA2VXiuPPqI7A38LBcKlrQQ1ocspwXCK7EXtaY3G/2WXOttnr2BzFEafXYjRU1cRaxpN1W4B0fXVsh/yXH9lnPRmWNVXFrfw7jcjsty5e5BTTPa51Gd7fSrGPS2zG5nmMeMXqRonB8o8QqZ2n8I6x+y2F0pkRV1TGtdQk3P5V1D0V6bGTiNz6I8fkW1ejvTjTwhjXUXcfStujHZ41zvklUW0pHJ3TXpeNQwOfhnP+lVPU3pwbhFK6Y4faw50rvnpzIajp4Rek/wDisZzpyipaTB5XR04FmnstOqlxPMM/mY5MnHZ5xYnhw6XrNLBp0uW7fTP1y/8AxWGP3z8w7rX2fHS78OxOVrGWs89lN6c31FN1DEy5+cLWxt7RwXMR3Fs9f/SfjBxGgg/zL/AF09hIIhZ+i5I9FTi7DqYn8gXXWG/+BH+i6PFekePc09TJcRAtwqeLtbwpsRebcKGE3F/stCL2c+vqJNRAtdDJLG1ykG5sn+2L3U8Yoka2TROdyP3TzumRbWHlPOwul+MgnECQOSkDgeCmlxdygEg3CcRpaHpzSS03KY03Fyns3BCbICncCHGwKcON08sBN0aB5KaSDWuDeU9JoHkpUCpv4K35gnpjeR+qemS+g0CE1uq+905PEBRpz3EbApqBUmwRYDgJjibmxStcANygclochCECghBvbZKxm+4KbJ6QjYlgeQmuZc7WUuln/wBFNeADso/ZDBrW25slQhOjLsBdBc3ZRkEGxTxJY6bpC0HkJXPsAjZqNz4RJCNJcLcIJ0NuNkx0xILdXZMdgEFRsD9lRySDcFV7mtfGXHdWWqm0TOF+6gtyfRD4Uu2XRHiGgXJ8KwYtisNG0m9lXY3iHtNd8Vtlrjr3qltHTvcZrbHusu7OUe2zsOI413TUUUOYWalPg9M8untp+656zd9TcFPSTQx1vY/UsX9S+dBwyCdra21ie64fzh9Q8z3zx/4gb7/UsS/ktvbZ69wnjCs10bMzh9RxqJZSKwm9/qXNOYOfE0k0gFS47n6lr/rPOOavleHVpN791rXHurnV8rj75Nz5Wdbnb/p6xxXhcJQTaM/xvOusfI7TUO/3KiwzOes/EBxqXc/mWsaqpkmBIeVbmVs8E9hIeVm2ZfsbVnjteLD4dkZKZv1VTWxMdUnt9S7j9PXXP4ungbLNcm3deWeRmN1MWIwkvPIXe/p0xyr/AAsEgJ4CfVenHZxXKYf47G0dmyYpSyUQJcN2rCerZ6CQOBc3hWWr65fR4QZJJSLN7laq6oznDMQdC6r+ryllkNrRQxLa8aftsv3U/StPi1Q57Iw6/wBlhmO5CnF7yNpB/tWd5XdUUPUFWxs8gcCfK3/0vlxQYxDG+CmDgQL2CZCW2W87yL0q02cfYB6bpo6sA0OwP5FunKPI+TDqqEilAsRw1dGUeSGHxxte2gbe3hZV0hldS0czCaQCx8LbxukjzflefVm+yTKDoyTDqOMaLbDstuYNSywMsfCt/T2BMoGNayOwWSwRMZGPh7LepTejy7lsz88mUQkcJwCO6vmGxNlYHHwrX+GDptVv7V1w4lg0tWpWc1OxFa6IaNIUEkZF9lVxi43CJI2kbhXa0QqRb7aXKppnat018I8KFsj2bAq0vgS6LkTYXTfc+yp4JXv2cVUNaCBsmSWhnSHxm5v9kP3KVjbHcKKXVclQSGSeuxxcAbJiYC6/dBL28piWyBT7HpWmxtblMa4k2JTkqWmOUyVrtKX3Pso2u8lO2Pf+04epJod7n2R7n2TbD/6KEDk9jvc+yVp1C9kxPba2yemI/gjztZNTyGnlNdYHZI1tjGxEIQk9RPZAhCEqWg9kCEJWgE2KlXSFEQQDyE8taAdkxCexrimwQhIXAI2PhBipHmw5SF/gKCtkLI7g2KO0SqvZHUVFiRqVBUPMmx4SPqC59ibpTGXC6a3tk9dJSTQkbgKjmqTG4g7K7Ma2xEgWN9YV0VDC98bgCAoW9LZo01KUtDcT63gwYWfIP5WIdVZ40WHROk/F2t/qWuc18zG4cyQyVViAe65Uzl9R01H7sceIkAEgfEqs7fVmvTx/v2dK9ceq+lo/cjbX2t/qWoOt/VtFLqaMRO/+tcU5mepyrM0gbibuezlqfHPUTiNRI4mvdb/1KvK01aOOX/Dtbqj1LMqnOIrSbn8ywDqTPKWpL3MqnWP+pcmHPOrqJLSVpO/lSjNh87fiq9v1VWV3ZrU8Yn/DeuP5x1U2oCqd/uWBdVZtVTYz/wAS48/Utb4nmK17Toqd7eVjeJdUzV1wZif3UMrmXY8XH/hlHUWctdCXkVL/APcsFx/1AYgx5aKp/wDuVn6gZWVgIjJN/CxWr6LxGvkNoXkn7Jit2SPBVb2XfF83MTxW7RUuNz+ZR4LFiuPVLSA46ipOkcm8arqlofSPIJ8LobJr041dVNAX4c48ctVynso5NyitGMZWZQ4ticsbvw7juOy6kyk9PWJOhY51GeB9K2t6d/S9E5sJmwzuOWrsDLv010NHRMIw5tyB9K1qkmjks+xdnI+G5E1lFC15pbbflVRVZcS0dOdcVrfZdp41kjTUNKXuogAG+FqfMToWKkbI2GnsPsE6xI5PIftI58wPBBT1mhzQN/C3VlNEyCoh0/Za+r8IdRVxAjtYrO8rXSNrIgW91Vmil6bZ2Pks6STD47O7BbPigkAvqWpMkaqQ00TBsNluSID2r/ZLS9y0Sxh69kNS0mJUkLTG/fyqqWTbSSoXFmq60ESr4TOmA5unvkaI7hUr9TrfZPhu4aXKRIUe2W44T2vLu5/lIGNHZI74flR0I2iUHYXTg0kXUDNZdfdTNc7TYlQyY19sEj/lSpHAkWChlZ6iEEoO6jBN+FOWC9iEnti9/sljcSxEibdTtjAbc/8AJMjAG1lLdum1+ye3tDZLsoMRi1xkjwsYxWmd7hWVVjX2IPBCtVXSNebuaq1kPYbrTLNh1CJJACFkFFQNjjF7Klp6ZkZu1quVO4gaSqU8fZahLS6EfTs03AF1C5oYbAqeqeWsuDuqQSOO6bFej0JKbRX0btrFVZcALqgpCRwe6rA+4tfhWq+/pDKWxzZGl2lUuINaDz2SvkHufCo5g+QpJP1RG5aI2AauAqynja2xKopSYRqJtZRjHYYDpfIP5UX5WJ7IulRE17CbKx4nT7ktH9qebqKB7S1koJ/VMgf+Ldcm4KfC1v4KpRZbGNe19rK40bL7EKuZh0AaLt3Q+mbH8g5WjGe49lSb7CJgabKoittYKng1fUnF7myCx7p6e2PiVsXP7qR/H7qOm+Jmo8pziSbX7pZfSZMjdyf1SJ+lp7JHMN/hCcmmOHJrOf2Sa3eUM+ZMfQD0IQovYa4glYbbeUiExsEtEiR/ylN1u8oLidiUJjhEIRYngKSMhGtkjeB+iDuLIHAQll2hEtDQwnlI5lhe6V5INgU258pIx12SLYIQhS62OHMbpAN+yVwuE3U4d0aneUhExj+bpo2Fk8tB5RoaggkiGZmph8q3VMclzYK6vaAbJnsRuPCgtSYKO/paKanlMl7KqI0jSeVWGGNgJACgma29lRtr6ElDaLdjNBBVUrmyNB+Hwucc/uiKWrgmcIR37Lo/EnvHwdiN1rXNfp9lbhz3NiuTdYeXDZm5Ve+zy79UnQUVOyqIhHfsuE81qAYfiEgaLWJXqZ6ruigKSqeafex7LzU9QOCSU2KzD2za5XK5sWmc7fBpms+mZ/eqw1x7rP4YY46PUD2Ws8OqDRVILdjdZPR9QzOiDHu2t5XL5DafRnyi9hjM5dMYx5Vd0zgb66ZlmXuqBmmtqAbXuVtvJvon/FKqIGAnjslx6ZTex0ISbMgy2ymmxZjP+GvceFszCPTHU1xa8Yfff8q3X6ecjm1jadxobggdl15lp6a8Nnpo5JsPb+7V1eBi7SNXGreziPoD0p18dQyT/DyLW+ldO5M5Q1GDRwwupSNIH0rpbBPT5g1EwaKBgsPyrJ8PyqwrDow6KlaHDwF12JjuKRu0VSS+GG9GdOy4dSMbotZZXS0j3m2m+yu9N02IbMEdrHwrnQ4GwG5bz9lu0rSNSuGl2UGDYcWuBIV9hgcxwN1LBh7IBcNUhFuVei/10TepI3gfonhzQOVTPqABYHhRmocTYFNEK3W3ykNn8dlTRPceSqhpda7UABYQL3SO4P6J9rjdGhvhAECVnzBS+0zwgRtBvZACNadino2AQCDwUACEIQAJpfY2snJNLT2QAoNxdCAANghI10AIQhN9WAIQhDWgBCEJy+ARoJsLoTXk3IunJbYCtOoXslTA4jgqSMAjdDWheh30fsonNJJKmNgN0xxB4/5KF/AT0RtF7jukIBCV72t3H9JGnVwmdaInJe40xgm+38JWAi9wpWgDZI+O248oT2WVMpZje6gPz/uqqWMbmyppB/mbBI/hIpdhUf8AhBYz1VAHU77fdZNUm0QWPdRguhcPtus/Jj0aWBLVyNCZuUzvalAH0lcYeouNzY5jbuV3Zmbg5nppXBl/hK4u9S+DOhinLmHv2XOZVfTPefEcmMUjgPOaH8VVTRnyVqJ2W8mMV5DIb3PFlujNuC2Lytt9ZCqsnei48axSNr4QbuHb7rmLaG5/D12vmP8AGqTTMB6S9ONfXaXtoSdvyrafRPphrGvjL6H/AOK7CyW9OVBiNBFI+gabtH0rcuD+meipwxzMNA2/KoViOT+Fa7zz/G6cjkTLT03yxzRh9CLXH0roboTIGGmjYTRtBsPpW8ejsh6KmLb0Iv8Aotk4FlRBT6QKUD9lexsPvbOP5r/8juScVI1D0llDDTsZelaAB+VZhhnQVPTPF4mj9ltqk6FpqamuIBe3hWjFsD/CSlzI7ALaqxopfDzTJ8rtzbH2WGl6ZpmQizBx4Wts8sFgODTgtGzfC2XjGORYZHZzwLeVpXPbMGjOGTRsnbfSe6sygvUs8XO6d3vJ9HAPqdwyOLGZmsby8rG8h6PR1FE4M+sLNM75IsbxKaQWJLjZLkH0g6XHI3+ztrG6djLTL/LySqPR/wBFX/7Ppr/kauucNFoY/wD67LlX0nYXJh9HAGtIs0LqnBdRpWOf4W7jNaPHua/32GLOsLW7KOlOw/RS4i6OTbmyZSllgNuFoQkc98aKhu4Fk9rS3lMG3CXW7yrcH0SkjB8SV/P7JrSbbeEulx3snEMxEjXauydod4R7ZHATXJaIRWuGwUjBtdRaXDeyUF9x/wDoTRUtjkDc2Tw1oG4TXbO2QPF0HyEe2Dyf6Sa3eUanHgprkAFlhe6RPPy7+ExI+2BImucQbBLrHgph3N08VLbAkk3KEIQP+DXtA3+6bunv4TEDG+xzXEmxTk1hF7Jyd6jHPQJzni2xTU15vx2TZpaGKwcD3BQSTyka4HYJVXUWh3s2CEIT1FoVMTRc6t0qewfClsBwE1xaHFNUy6GkKgmrgx9iVV1oNrqzVYf7nf8AlQy+AVra8OBaTyFb65nMqWGORzgU3F5fapSTzZZea9LZoYevZIwrrjG2UMb3awLDyucs7MzxSU0jGygWB7rZudnVYoIZh7lrNK4xzx69fPJLGJiSb7XXMZVk9HrvjGLW3E0V6pMyqutFQ2OU7uPBXEOaPUOKVFTM5r3G5XVGaNNU9QPkaxhddxWpsWyQxDFnvcKIm/8ApWBbbNvs924OuqvWzlrEq3EpZyHav4SUNBWVDhrB58Loat9MGJa9Yw8/7VT/AP2AV2HjU6itb/SqznKXw9X4zIx4w7NMNwWUQXLDxvsra7BZnT7MPK3bieWctHGQ6C3/ALVZ6XoISVWkxDm3Ca4yZU5bKrcHor/T50jU1+KwM9s8jsvRn05ZVzjCYJDCflHZcremzLuODFad5jHI7L0q9PnR0Denof8AKHyDt9leoqm1pHknN5tVUW2alzjwqo6ewSUtuLMK4qzKzMnw3qF8bprAPPdeivqk6Qc3p+f24/oPZeWnqHwivoupZnNa7aQp8qpfDhrs+Mvh0h6WsxRi2JwROn5cO69LfT5S0tfg0UjiDcBeNXpR6hrcPx6BsjiLSDv916w+lfrcTYLA10vYd1LTW01s5zlciydLSOoKDpyme0EN7eFdMP6cp43NIb38K0dOY9HUMYA6+yyrDpxKBZbmMttHmeZffBtNix4eIyGtCq4aEuaFJs0gEXVVTFpAW7RsxL73rTKf/DrAGydFGISLKtJFuOyo6t1itiqD0ZU7P2KiOpJNlMCHt3Vtjks7jt2VVDUCwFyrcE9D4zJZIyb28eFD7LVUMeCNz/KUxnsVKnol3sgjYGEWVQw2ASe2bcpWtLeUyTEfwlUb+6VpANyhxBNwq7b+Eb+EVhe6QtDuUpBBsUJNtFZoQMAN0qEAEmwTwXsCVnP7JWxEpwiI7JUh6TBCXQ7wjQ7wpEoi/sIlDiBZGh3hIQRyj9f4KvZilxdykQhIKCEIQR60CEIQGtggGxuhK1urujZIh17sufCYn2s2yaWEC6N6HJDXGwumOPcp7gSLBMe02IRsmiNL/AVLikpbDdVOh3hQYhTuli0ociRfS0QSe5JY+Vc4IbtuB27q3w0zopuO6usBDGXPhMciXbUeilrIdERctT5r9QOoY5RqtYLaGN4lFTwO1OXPmeuPACctf2KinJbNLD67kc3eonrmRomAmtse64bz26+qvcla2a+57rpj1EY1PK6XS48FcXZvzTVM8jSe5Wba25HWYtkFDs1L1b1BX19W+zyblWIwV87C4k8K+zUDXVJ1jurpQ4LFNFpa3sq096NOq6swF9JWRPLrlW+rxzEaWQxglbRHQr53Etj5+yoavKKqq5NTacm/2UDT2bFF9ZrQ9RVxcAXON1fumBVYlIGuBN1l1JkNidRKLUhO/wCVbKy09OOJyVEZdQnt9KZ6Nk88quKMY6KymqcfewinLtX+lbb6M9IlTir2OGHuNyPoW+8iPTbL7kHvUI7ctXYeT/puoY4YnS0TO3LEsa9voy8nka4wfZxdl96InsLHOws9voXQ+VHpBiw8RSOw4i1voXYnTmQ+EUsLSKSPYflWa4Rlph1DEGsgZt9lqUVNHF5XJxc3tmmMrckqXBGxg0um1vpW7cB6co6Sna3QBZqroun4KS3tsA/ZVTaZ4bpatKvoxcjJVi6LR1HgdJXUboWMHC0vmdl4xsUhbH2PZb9dQyAHUsS63wRtXE5ugHYon2Y837M4u6w6INPWOc2O2/hXLLnAnsroxpOzltfrTL90s7nCHv4VP0V0HJT17Xe1wfCqTW2NSRtrJvD309PGbeFtyK/tb+FhGXuE/g6WMFlrALOIzeMjwn0x/bY+WtFDWy6O4UcDvdNie6XEGElR0jHBw37q+k2N3pFeyBtrpxjDdwnQjU210SC3dO32NctDE2TsnISjHIWKyeBc2TWsIN05VpjkxXDSbXUZc6/Kfcnkpha6/Cp2tv4OEJJNygkAXQQQbFMkNj+yK0SRW0IZC2ycyUclQudbcqP3dL/3V2uO0SOKZUz/AOYP/wBCppaYObexUwlBF04DVspvxkE1oom0ul1yO6fcsOyq3xWF9uPChfH5TJVokhLRBM4yC1lE2K43BVRHEXGxCd7W9rBUrKk5bEnISnaGi4TpJ3DZObEWtUFQd7fdSKKRXlLQokub24UrHi+6pYrh2/8ASe+Qh3wlU8iyMUQStS+EON1DYaYuv2Wr+seuxhkzh7lrX7rOetsRFNhrnX7LljOrMJtHVSNEtrE91kTyYp62Qu5Jm1sIzRbUVQZ7w/TUto9E45FiMQdqHC4Z6TzUMmKNYZzu4d11Bkx1ca2mjIk5A7qxTkR/6J/kI3aZB2Ca51+SqeiqRLA11+QnySc/otSFycRXLfZPEGuO5/tEgaD+6p4JTc//AKVI55dt/wBVcrsTJK2VdLJaOyedzdQ0zHWCmIsbKZ9lqIIQhO0iXSGPAHCQGxupEj/lKjn9G/0Gm4ulUZJHZOZzdQP6O0kOQhCZtjdMEIQnL4ICdH3TRubJ7WlvKfEBU0vdfYpdY8FRueAdgpktixW2KSTyml5Bskc7V2SJyS0P1ocHkmyco05nP7JwEjWAi6XQ2yVvA/RCjIxjhpNrpE9zdRvdMTHIa4iOAIvbsonuLRcKY7iyiljOm901/sN1oppJiNj5UbXh7+Qio3VO2YMfuopQ9l2SRjsqp6MTC9lYupemmVtE5pF/ssjpZ45G2uiqhZJEdlmZFCaK99KnFnE3qxy7ElBVaYvpPZeW3qi6Amp8TncIj37L209QHRf+MUVQ1sV7sPZeeHqeyEmqqmd7aTz9K5bNxd72jnsrH7PL7FMDqaSrN2H5vCraChnLWjSf4W7cwsk6nD6pzzS2s4/SsKqelv8ADCQ+O1vsuWyMXcvhmyo0yl6K6YNbVMMjfqHK6y9NWWkFTVw3j8dlzz0DTMFY0AD5guy/SzRtNTBx27K7hYy66JKqdnZnpxyyooKWmvF2F9l1D0t0/TYfSMaxgFvstR5B4UTRwOaPpC3ph8Bjhbfsu143FX/DXxaI+3ZUQxsaA23ZTewxw3UUsrWWI2TWVg4v2XRRp0ukbdaRP7EX5U5sbW7hQCoLjt3U8RL+SnxWmWPXXY57xbcKmqZwAbHsp5InbnyqaopnFpJKnjv+B0kUonLnJ8byXJjKchxsp4YiHDhKNfZNAwHuqprQ0WCZDGQL38KRAgISBwJslOwugAQk1jwUw7m6AHOcbkIj7pqdH3QA5CEI3sAQhCABCEIAEIQgAQhCTWwBCEJQI0x277J6YTd/7p0RNodoHkpzTp7JEIkM2KXEprnEGwQ4gCyYoJB7DXja6IzYpHOJ4CRpsbkKJvRH/wCRUA3F0ari11GH6hYISRJXNoSax/lU74wCbKofx+6hkBOwUqiSVScmUVVIbWBVrxNpmiIV2njue1lQ1kIDSqt8DRxpeliMG6vwBtTSv+Hlp7Ljf1ZdKGGjqHhnm2y7rxambJTvFvpXMnqk6ROIYbMWR72PZYuTSmek+M8nKqTTZ5E51wVNNj8rQ0/+Ieyyn01Sl2MwiVv1jlZJ6g8up6fF5pPw31neyxfKutZ0zjDHTN02csWzH72egXcz70aTPTj02UVJUYTDqaPkC6Cw3p6idCw+2OFw3kJ6i8LwqlhikrALAXGpdLdH+pHBMQgjDatpNuzk2FUYv4cXyUsnKe4s3JheD0sEo+AWCyGEUMUYA03WrKDN3D6tgdHMN/uqiTM6EO//ACjb9VarjFfw5vI47Lue2bWjFPLHpFlj3VlHFFE5wA45WL0GbFDGy8lSB+6snXudGFQ0Mh/FNvp/MrcZwUSDF4zKhev+Gtc+OthgEMhjktYHuuN84s7JaiaWnFVf4iOVsv1K5vwYh7zIagHnhy5A6qxCsxrFXBjidT1FKxNaPRMGtU17L0yaXqiuvcnU5b99PGWhFXFM6HuOy1nkbl3V4lVROfCTdw7LtfJDKx1LBHIYLcfSlp6ZR5bI3Bm68hMBbhtNEAy1gOy3tQvtSNa3wtcZe4GcPZG3Taw8LY2HkCIArWplpdHlvKS95kU7nB+6dTuJN0tawF12/wDJRxksHCuwmY3rt7K4SbcJ7W6u6pI5Lgebqpgfc2V2qel2Oa0ieNtv2TksZuQQh/zKZvsrybYm3dG3dCEg1LoNvH9oQhAopcTskQhNbAE8NANwmKRNAR/CYnv4/dMSbSGtghCFKP8AgIStbqF7pECtrQmpvCC1p7JGtu/fhPIAOydEjchoaAbpHk3snKN7jynFab0IXgGyVru4KjJubp0fdD0yNNpk1wO6Ab8JjuT+qcy9t031RYi3/BUIN77IS6RJphqcBYFI2Q33KVQlzgeE1pND18JJWB7SLK31VI0kmyrvcsze3Cpp52XtdVpRHxWxKKkYALhWfrJraehkc3sFeoJ2AWP/ADWOdd1Ydh8oB7HuszNrTiXsKEpXpHJfqd6ldRMnAl4B7rhvMzrP8ViL4nTfUe6649XVTOG1IZ+Urz8zSx+WgxaR0r7Wce65bLrWj3fxXFXrEzbpDBKLqCra2Wzrne63T0hkRgFbRtlkpWEkeFzDllmzh2H1rPfqGix7uXS+V+fmAytipn1bO31LAuglLs9OjK2mP6/S/wBV6dsCcy4oGfwsFzDyFweio3yR0TQR/pW84cx+n6umD4qlhuPKwnNPrDCn4c/25Wk27FIq6mui7hcryEJft8OPMyeg6ShfIxkIFr22WuYOlrVvwQ33W6MyMTp66reGOG58qx9LdLRYlWtLWA3KsQoi/hdyuRunDszH059KyHEINVPwR2XoVkXhf4fA4o/at8A7LmD075bWqYZPa8dl2nlj0yyioI22HyhauNjxUTyfyTkJqbT+GFZ99MMxPAZgYb3Yey82PUnlIJcZnlFNw89l6zZldPw1OEyNc0fL/wBFxH6hehKU1s7zH9RT50R9jlKMidn/APQ45yw6aPT2NMIZps//AKruj03Zhf4dTQwGotaw5XK9ZgMOHYmXxttZy2jlBjNRTVkTGP2BCbGhJlvKgpUHotlj1f8A4gyNwlvdvlbn6WkM8bT5C5g9PtTUVsMN3E/CF1F0ZTubSxk+Fo0V/wDDzfl61CTZeKhmmxToHuAsCkrQ9o2CiilcLC36rVqi+ji8qxplwZJdlr/ymSRte0lRwvc4C6qGNa5trrbq7ikU1NtlIYtLtvKGuLSDdVMkQO9jyqWXUw2twrMFtFiElsnilubXVWx+3xFW2GQh3Cro3BzRdPkWYtE3KEMANgle22yrzEb2IhCc1lxe6gET2NIB5Ca5txsE9wsbJEDXHYgYLbhKG2GwQBc2T2iwsnJtsVRSEZ3TkEgclFx5Uq+C+oIQhKJ6gkLQeQlQgVLQmhvhBaLbBKhAjQzSbXskUhFxZMcNJtdAxpsRCUC/n+Eh2SbiCixQCUrBZDE5J7EiWg4SFzSDulO4smOaG8JrexREhaDvZKmlxDrJfZjkxNJ8JWR6tnJyAeCkb/oOZTT0TdZcGqjxCR0EdgVczJvv/KoMaja+E6PChk2x8bOzCOpcRmcx7A48laJzepaqtbMGgm9+At74vhs8rnDQefCwTrToySqieRFckeFG9vov1XLZwlnX0fUzCQuhJ2PC5OzRy/qnzyFtMTuey9OevMmZMVjkMlMdwfpWhuufTPPVVLx+CdYn8qryh2ateZ6wPOnEugq6KoJ/Cu58K69NdE1krwz8K7nwuwcY9Kcr3H/gDz+VP6d9K9TDOD+Bdz+RROG0WK85o0L0llNUVzmh1ETf7LavSPpfmxRjJDhhNx+VdBZeemZ7Xs9yid/sXQGXmRFPSRRMdR7Ab/Cm/jRpVckl/Tkro/0bNqHNc7Ce/wCRbjy89HVNSua52FAWt9K6u6Uyiw2miBdTAH/0rNcH6GoKWxbTjb7Jyp9iHJ5hRWtmi+g/TvS4L7bhh4Fh4W3+lekIMLgDRTgW+yzGLAqWKOzWjjwh9C2EfAE9U6ejBv5SVi6IqJgj2DANlcYXBwsG8q0ySzMdZg/pSwVdQ3lvCuQXqZU5qx9lyfAXdkCBrBwo4a4aPiSyVzLWup9kPt0TSwteywCtdfgjakHUy9wquKv1PACn9wvPCZMibMKxfoGKqJP4cbnwqXCegGU1QCKe1j4Ww9De4TG00bXagFF6v+htopsIwqOjgDQy1gq+NoAITbkNsEQuLibqWMdC7ZTVUOp3HCZHEWdu6ri1juT/AGoahjW7t8K1H/gNkYmLNgUe/r21KmmdK07BLTuJPxKb1RE5FW03CewA3uExpFgAU+Puoxu+9iudYbFMLyOXIkNiSFE+Q6uFTsemPTJfeP3QJC7gqJpJFynNOlQJbY9PY8uudzuUyYEi4Tg4W5SON9gp660mTx+FO8jhRTbcKeWKxuFAWvL/ALK5GKJutCwucbAqsp233cFTxxbi3lVkDexTpPSK8xxj1ctUb4mkgAKoGwsm+2L3uotsapNEP4e29kj2NA47KocQG2uoZS0Hc9lVn9GSbZF9lBUM7qfWx3ylR1A1BMnJqJWsba2UerSblRTT2PPZPnBaFbcQrGwtJJ4C5zPyZRTKU5+v0xLNvqFlFg8g9yxDSuFPUT1w9lfMGTHYnuus88cdacOmAkHB7rgz1DYkX1sx13u491yd2dqf0z526LX0V15N/jjLz/UF2f6dushJSw3m7DuvOnpPFZYsbb8W2tdh+njqswxQM9zsO6sY2fuSRCrns7t6ZxcVNKy773bsry12tlwtc5d48ypoInawSWjus/wyYzQ3XW4tqnFGnTJyiVUDHeFO1rdQ27pkYN7DwnF2kgrWpZdrTKynt7ZNuEvKjp5gW6R3KkWjDtbL0ECEJHF3ACePEe7wU0k25RYjkIO6imuxv/kB3BTmEC9ympWt1d1A/pJIfyhK2M2G6X2/umaZG2NQASbBKQBwUD4TcqSMXoaK1tuQnEgclJrb5SPINrFSqOxNobymO5KeRYbeFGb91JEli0CEIsebJwrfYrWk2Nk+wHASM+UJUPoQe35Ql4Q3gfokc4AWVeUlojEc/f4SmoSOJAuFC2AqRwuCLJNbvCGvB2KdDYjKSspyGkgKz1zpI97FZJII3tI/6qyYtTOJJYFN6k0PpR02JyR7X2V0w6vNRs9WEU03ubt/pXCicYSLqtbWtC2QWiLqzpyHFYHMMd7iy0HnDkHDi8Ur/wACDdp+ldLRWmjue6oMawOmr4SySMHbwsTLxnKO0ZF9Tlto8ts8fTMYjM9mG8E8NXJuamTdfh9TKyOjIsfC9k838oqSvppXR0wN79lx9nPkE99XM9lA7k/Suavxdy+GTKmTZ569P9P1uD4k1ksLh8XcLrj0qzuZVQB7fHKxXqD0/wBYzEy8UTh8X5Vt7ILLGswuthvC4AEdk3GqnGfwlrq0d5+ngNlwyAgctC3UyLTCAAtQen/DJKLDoA8HZoW4tQEN/AXccbHVfZp48UkUFdFMd2XVMHPbsTuq59U0u0OVHKC+TYLZ9dIvQSRU0rr2uVWxPDe/ZUEDXgbBVsLb7nwoHB+xI31onJBZymkAixTgy4vdHt/dPWkRezIRTWNwChkFn/KqhIGgG6BwMFm2slQhADCSHEjykMhGxKJCQSR5TCSTcoAdrb5S8qNOa4k2sgB3KewEXuEjWiwKckfwAQhCSPwAQhCcAIQhAAhCEACEIQAIQhAjeiNM+v8AdPTCBqtfunpaGNj0EgcouPITC4kWKSTQxvYONzcJEAWRv2KrSa2N7E0N8Juk6rWUjRc2KHCxsq8n2TQimhtrH4f3QXADZKkLAe6fWR2Jp9APiHxBQzXDrN7qcCwUMjC6UbKzH6T460+yKdoteyoaiMvBsFca1ha0aQqenj1fMm3RTLsJR1ssmI05Ebm25C1Vmv0f/jVK+P2b3B7LcWMUznO/y27W7Kw4hgP4ln+bH/Sybq22b/G5kav6cBZ7+nmCqbPO+hudz8q41zg6Gm6MqpZYYC3STwF68Zn5dQ4hTTAwXuD2XEPqtyJlqYqg0lKTdp4asqyt76OyxshXJdnDNFnninT1cIWVTm6T5W5spPVFXvfEyXEHcjly0h17kP1FS4vI8UkgAcbfCpujuhsdwiZgcx4se4VRxa+nQYmPGxbPQTLrPo4hSRvNbckeVltRnHIY7irO33XJmVtViFDTsZM8ggDlbKhxKomh3k5G26RP1Ndcb7R+Gx8dz9rKFh0VZFu+pa4659R+J1DHsbWu3HlY31XDiUsZ9u5utf4xgmLzvILXFRWWpIRcTJPpD+p+tMT6nncDM5wJVR0Fl9U4viTHyQk3d4S9H9GVctSBPETv3C39lH0FAyaJ74h27KvG1uWhb8OdVPSM79O2UMUIgkkpbbjsuu+g+jKSgpYw2ACwHZa3yhwGioqeI6QLWW68Dnhjja1rhb9Vq0OL7OB5iy2CcTIMJoGQtbobbZXeCUsAb4CttDUxkDdXCmdG9w3C0a2k9nBZKlJvZUsYZRuFG+MgmwVZHGGsBaoZ2i+ysxlooRaTKdpIdyqyntsVSaTr3HdVMRIGyuVy2JN9dFYwgAAFSABwBKponm93KpYQWAgq3B7RU32GhvhGhvhKCDwUgcCbAp4bQaG+EaG+EqECkZBHIQnkAixTXCxsowETw8FMQgTfY55BFgU1CE2X0SQJ7PlCNDfCUADYKYcB4KjT3AkWCYgin9GEkE790hceSUrmm5Nklr7JVrZG9ilxOyRFwOSi48p5FpsR2+wbdIxji5OsTuApAAOAl2OitAhBNhdRl5HLk1rZZh0iRRnY2QJPDkagTyl1omaWhQ1xGxSEgcoMoYLEqCSo3tdNkmQyemE8lzYBW2qe8PvdV72623Co54HOdxdQvplmiSbIo5n8XVj6yYXUMu/lX51M5jNTQsY6wqninkjv2Kzs3uJuYMPe9aOQfVfRgwVLiL/CV5l+puvkoK2Z0YtuV6k+pWgfXU1QC292my84/U/l/JUyTPEJ31dlymVs978Tx/ZRRxdjOcWJ4DiDiyoc2zuLrIeiPVtitDVsYa54sfzLBc4egaylrZXsjcPiPZaxGHV9BVag5wsVzly22t6PX8biZWxXR6DdAerysnpmNlxBxuO7lkGP+o+TFabSawm4/MuEeiOqMTpg1pqHbfdZ3T9Y1vtAOqHceVSjNxejexfGZyW9HQNRmK3E6jU6a93eVsnKDGaSSqY6aQWuOVyThPWEzCHOm/tZ/wBE5vuwlzXGqtYjkrQqt6Ic7gJ1x6R6fZB47hEZiIkbewXTXSnVeHx0rNMo2G268psnPVXFh08bZcRAA/1LozpD1eUs0DA3Exx+ZbGPfFRPJPIPGrL7Ph2DmF1zQx0DwZhx5XIefnVlHVTTCOQXJPdRdbepyGto3BuIjcfmWgMxs3RidQ8CrvqJ7qw7FJnOLx+ePXrXwbitQ2prnOab3cthZO4Y+evjdb6gtRdN4g/F6lrgb3cuish8AdJJG8x9wpq0mYudjThFo7C9NGHhkEIc36Qun+mQ2OCNv2C55yFoRSQx3bazQugun5bxM3Wpj1nm/NxaRe6sMfHt/YVBEbSHZV7me6wlQMpLSbLRrilI4nIr2uhzWGyewlvJTzHpFwOFE9zmm5/5LTgtRM9xaZUNcCLFQ1AYeyBLsgOEjuxUq+D1sjjj3/dVAb2AT44QBulEZHDf7Sk0W0OjY4WsVKAbWKZHta6kTJfSaIjrN+kI1fDqslIB5Ca4tDdIUckh4jiCbhIhCjf0CRvA/RI51trdkEkMuPCYXXO5Tl8FS2HdCawkndOUkfg5LoE6PumpQSOCnNaGtaHoJsLpmt3lKHAixKQQRzg7hIhCR/AHs+UIc3Ub3SNcLAXTlE9gN16drcJwNxdJpaeyUADYJi2AJjuT+qemO5P6qWPYCIQi10svojegQQOSEjrgXCYXEjdINlPQ7WOwTXOPKTW3yma+xv8AuhkPuxsry64AUbYjKbO4T7Em/a6dqDbKNrQ5TeyGTBYZRcsG/lW+r6Pp6i5ewH9lfY52W2ThMHG1kmkWIza7MLxDKukrm/DE3+FjeMZC4dUA3pm3v+VbaMrW9khfG/5mpHBMkVskzQdV6b6J8mo0zLX/ACp9H6d8Pp5AfwjOfyrfHsQOH/hj+EjqSAb+2NvKY6uh6vkmazwTJehpQ0x0zRb/AErKMN6RpcPaGCJtwPCyNpjbs0WTJJYPqIum/jHLJmmUVNQNi+VoAVXFI1g2ASOc3kFRPY5ztgnRg0NlP3fZUma7UlhILEcqGNrha6qoWstupFBsY3HRTilivctRLTwtbcNVQWg8hMmYXDYbKT8TSIfYtdW5zT8BVGZpQLkq41VI88AqkNFIeWFCjoVBhs5fMAVfIgAwK0YdROjmuW/2rwwfCAENJgSpkjgOG909U8ziL7pu0BIyRtrEd0rywDZUjpbG+rhN/EFx5TotNguypLjfYlDWl25TIHatnKawHAVhMRrXZHMxmm+ndUxZq+VVjmhw3Se00DYJ8ZaIZFIHujNj/wA1URyhzbAKOaIar3TGVEcZILgmznHRF8Kgi4soXsIJN0fi4yNnJj529nLOun/wkjIQyhpsnMlJP7eVA46jspIwR/CZTL/pNHT7J2nUnsY7myjh/wCqqmBlu38q8ppEiloiLdrkJPaYdtKlIB5TDYOUnsh+2DIWtPClj8KJ8zRwU1tUPKSUkMkVKa/m6bFLrtunP/RM90MeyCpk9tt1R1FU5zTY9lVVwJZsFSGAmMn7KL7Ib2JSvc83cVM/5So6Nmg2cP5U8mj7ItS0V7Oy34g9rIyVhvVuLingcdVtvKy7Fz/kuIWn82eof8Ohe33LWBXFc1LUWZOU9M1PnZ1Z/wAPK33fPdcYZ1VzqyulIPLit85y9bmR0rTP3Pdc4dbVzcSqZCDfdedZV7UzHnPsw3BB7WIB5vyuickOpDSyRMMlrW7rnuzaSXUdjdbAyy6r/DVcbfdtx3UmNk/uhIS7PQjJ3qg1MELBJ2Hdb56YmEtIHLjnIPrP3xADNfjuutMvq4VOGteDe4XfcfkbguzdxZfEZbAlqYiRsmQyN1WUr3g911WNNNGtXoWijLW3KqFDTuICmWrCS9SypIEWB5CEJUtiJbGvAHATU5/KaLlK10OSaQJzOf2TSNPKA6/BUWuw7KhI75UyOTsSnuI08pVHsZLoZ3sml/hK824O6j1Nva6lS0ipObTHh57pyi1N8pfdttdKNU2TBwtYhMe25u1QunIOxKdFPcfEk0vpN7PRI2IlOLLC900TtbwU73GubYcpu9k0d6ETmloG6akjDnXTLG9EmtrsVNcTe105McLusFUk2MHMNwlsDyEMabWAT9DfCfBf9BDFFPfsp3BoGyhksbqxCI9aZBqd5S6GSM+IJp5KfHuApFFkpS1FJGPlaOFTilOq5Cu3sNf2UVTSkN/ywo5w2iOWyGG0YAupCRIf1VHUNnibdUbaydj7ElULayvNFViuBQ4jCWSMG47ha163yXocTc95pWm9/pW0qGpMvzFTT08czTqYCs+zFjLtEEqovs5L6r9PdKKpxZRN57NVZ0Zk1HhtQwtpgLH8q6QxHpagqnF74B/CpoulKOF92QgW+yirxoxl8K7gU2XeAtw6kY0NtZqy+UlsR/RUGGwCmAaG2CuEjTI2ze62seCjEmrWkWxznGTdVUEQfa6R9Jpdqc1TwNa3sFoRfRZimSwwtA3HdTe3bhRxOb57qR8rWjlMb2SDTsbJ7OFE6QaS4FN/EEBGugJZHt2TQ++26gM33/pK2b4h8X9JAKpg+FKo4pC4c91IgBpjud1HLHbjwpkEA8hAFK1pB3Cni/6Ie1tuFHrMfdAE6FFHNq5PdSgg8FAAhCEACEIQAIQhAAhCEACEISPbAEjnW2Sprwb3slRHLYxx0i9kwm5unvBI2TCLbFBFLYIQg87JsgS0CE8NFgbI0tPZQvolikMShhIunaW+EqhcdkmtDPbP2T7AcBCFJCImtgBc2Q6NrTeyeGgbhNkJ7eFYjFgnr4QzFrxYtVM6LSbNCqX2smAtvvZOlHaEdgkdKx7P8xoKp6vD2Ftw1VzZIwObJkskRYQ3lQThHXZLC9xl0YV1Vg0dRA+ING48LT2YGS9P1CJBNTtdqHdq35iFCZpC4i4JVsr8MpwDqjHHhZVtabOp4/kvxxRw9mL6QsMqC+RmHMvc76FqDqT0tx4TI6RlCBY/lXozj+CYfOwgwN/haz666Jw2eKS1M3f7LOvrSR6JwvLVTaTRwZJlpNg9RoZDpAPYK4QYO+ANa8LePX3QUFNO+ZkIAH2Woutq+lwZrviA0lYt02j1TjfxXJdFO7CqCSD/ADgOFb5umMGe/UWtWCdV510mENc11UBpPlYZW+qXDaR5aa9ux/Ms6y1nS1cYrFvRu6CkwjDJQ9ukWKzbpHrjC8LLP81v8rj7FfVPh8z7Mrh/uVPL6pKeGIPbiIH/ALlArtPbGZfBfkq0onpV0FnLhkcbG/igP/ctpdM5xYbUaWtqgb2+peTHTfrHFLpb/itt/wA62vln6wxXVTGHFuSPqWhj5LTPP+W8WctuUT1S6f67pqyNpZNfbysowfHWykOD9v1XF2UPqBixSCInEAbtHdb76JzNgrI4z+KBv91uUWuX08s5fgXTvSN/0FfHNEBqUrI9b7nusCwXrONwAE1/3WX4LiYqmBwctOttvRwOThzplsuEkFhcDskgaA6xP9Kps17NlEYyzeyu1me5aJXs1D4UsYLW6SUz3Q3Ymyex4eLgq/UQTkmhUAkboQp38I1ti6ndynqNKHOJ5TB3bHpj/mKemP8AmKRrY9IRCEJEmSJIEJWgE2Kdob4UctbGv6KhJrHgpQbi6mEEc7T2TE6TsmP4/dAyQ0vJFiEne4QTYXSB4vaya32RtNCPIta/dI0G4Nke24kJ7RewTvbZH6jmcEJyRo0iye6waNk7fRLCOxkpDQQCqd7zfhSSX/tQyHf9AliWFADIfICex42N1ATcAW4QJNIAIU3rtCuO0SynUf2UDmk2UrSCLkoIB5CRoi/G2xYm/DYofEyx/wD0pj5fbF/Cpp8QF1StemT1QkuipkY32isJ6up9YkAWVfjg9pbdWTG6P8Q1zgsvKntG1x0nVd7M5wztwE1cUvw3+E9lxdn1l8KkSl0HY9l6G5j9NfiWSNLL3B7LmDPDoYNglf7Y4PZc7lRPefEM+pevZ5aZ75eRQzTAwW3PZc8dVdKQ00r9MYv+i7h9SnThppJ7R9z2XJXWlFKa2SIs2uey5nLg99n0h49fj2qOzXmD0b4JrBnfwsghlkDQ0t7eFJTYSGODtIVYygFvlssqSaZ67x2Jizr2UTq+WBtwVaq/rKtoydDz/KvNZh2q7QrRX9KPqrhoO6kha4mfy2DR6PSH4DnBi1DUtDahw38rbPQ3qDxOCJgkrDx+ZaLq+i6ijf7liRfhVtFHV0sXwhwsr9F7R5vncbRNttHRtd6iKmaDS+u5H5lbafNeTGK1rDUXufK0HJU4nNJoa53KzfLTAMSrMQiuHG5C1KZ+zOA5jFopi9HYWQUBxqSE83I7Lt3IboYiGKQR+Oy5S9I3QVVKKUuZfjsvRnIfoD2cPjdJEOB2W3jQ2eOc5dVW2bCyxwh9DGxum1gOy2xgcuhrW3WOYB0+2lYHBtrDwr5Rn2ZA2/C2qq9I8o5TIrm3pmWUUmqPdTsazVb/AKq24fUXjA+yrqdx1XVyEezkbdb6JXgA2t2VNVCw2VWWl+48JktOSNx2VyPwoyh7Mtmt5d/+pVVK0XuUGm+LYKeniLQDdSx+B6krPlCVCTWPBSjkhRsbp7XXG6j1jwUoNxdI/g5PQ73Psmm5N0IUUhU3sE/QPJTQ0kXCeon9HiO2bZQv+YqZwuLJpFtk9fB0RkfdOTWtINynJ6+DgQhIXBvKeuw0KhJrb5S8pNMjBCEJr+AK3kfqnpjeR+qeopACEISJACY7k/qnpjuT+qeumAiRxsLpUjhqFrpzTbI5MaXE8pryQNkqR/CTTIG232R2cfq/pMleeFIk9vUUhE22xkcnkqQR6+UCGx2Ce0FoS+q/o6Pt/SMMLTuU5smg9ksjtLeFSVMzmm4TdLZKm0VrZo3i7iB+6cHxDcOCsxqZXus02U8PuuFi48KeMOhyk0XF1TG36t1TVFe2xs5RfhJXG4dz90OwySRuxQ4DlNkM2LMj+pUhxB0suoHa6fV4DO43DklNhhiOkpvp2L7lfSyukAB7qvgjaRcq308RYOO6rYXuaN/+aX0Q72ZM6Flr+FGSWmwKUyEi2/8AKQbuF/KVR0Hsx43F0HcWQOAgmwundEW2NfG0jhNbDGeWp3ufZNu4fKmtIFPQOhY06mp8ZNv3TLk8lOa4AWKif0f7D9bvKhn4Kk1jwVG8auPKiaYe2ykmJDrJrAb8KqdDq5CG0++wRCLbJI9j4GbAqVIBYWTXfMVO0xX9JGu09kx7y2/2Sh1zayp6ucMY4hQzscURSXRSYnijISW3Vhr+oGxvJ1Df7qi6txk073EO7rA8Y6yZHIQ6Tv5VO3JSIJ9GyaHHTM8C4P7q701SZhytS4F11A94Bf8A2s4wHqWGdoGq6oTyokLk0jLYmA73UzWi3Ct9JXMlHwqtZMCFLRkRl/SauZK2zTsFIx/hUzpN7oEluFdjYmieM9lc0B2yJWDRsoIZ78k8KZszXCynjLZJ7FK5snBUTWPDrq4NY119kwwAc/8AJEm2HbIoXEWFlMXBvKhksx37pWyBxsAopSaB/BZzrFlG5n+VsnvG109gDo+FJU/ZkTb2UQc4O24T38KR0QB7JrgNAJT7u0V59lmx2UsppD9lznn7ickTJQ09j3XQ3VNQyKkkv4K5b9Q+MQx+7qd2K4Hm5aTMXMl90cqZv43UOmkbq+o91qaoklnlc477rN82scgdVPseXFYFQ4nTSPcCbry/Nsan0Ydjey1402SPcKbo3FKiLEGgHupcefTujJ09lbun62CDEBfyoMfIcZoSM9s669OWN1T5YG6/Hdd0ZR1MkuCxl35QvP704YxTMnp/iHIXeWTWKQT4NGGH6Qu+4zI/RG3iy+bNjwvOv9lVRO1bFUVPI1zr22sqtjrAFdvhWN6Nyt9lZEwaf2UihppCW8KZdHX/AKlxfAQhCmSHx+jX8/smg2N0r3C90nKcSJdBIdQ47JrOU5CTSF0hWi554SueReyQtOnUml1huEqSIJvQOedXCjLgBe6bLJdQl+9rJHJRRmTktkxeb7JzXajayp/cCfHML8KCVq3oZGXZMIdViE4QloTGVAClbOCNwo3av+lytxaGPYW//wAkBxAsE972OP8A+pN0HyERn30XIIcyR2lSwWsoWiwsnNdYp+/ZD5R6HosL3shCha7IpPQ5nCVxIFwmtOk3slc64U0VtiJoQkk3Kidwf0Uia5pJuFPEkg0mUkjiDt5Tonk22Ur4Nr2UbmFqlWiXaZM2QAEp7Xtd3VJcjgqSMl/wk8BI0NcRtc1jmnhWeoY0PV5nhL27FUUuHOc+4UMq0yKUeiGik0m4VeJNY5VPFhzmFVkNC7yq8qVshlHsYIdYuSf4QaMDhVQjbFsf+SR5byE1Y62M9N9lK2MNdYnhVUNtF1TPeNVgFNTknkqxGHqPUNCVHNgmt+VVL4QeyaYLb2CVy0iRJIiDiBYIJJ5Kk9ofb+EohvtYJie2KU0hdY2/5KIyuDtKrnU40klQvpxq4U0fmgIxxulYLuAUvtnsQlYw6huE0CSJoAFlKmRsIF/uiSQW2CAFMoBtt/KUOBF7j+VAkLy3b/qgCV8h2uFA9xcT+qHODuErYy7hACxf9VPH3UUcbgbX7qZrS3lACoQhAAhCEACEIQAIQhAAmteSbJyjQBIg8FNa4WATkCNbI0haCbkqR4AHCjc0nukbSImhnJsn6G+EgZY3unKKUhVEOEIQoZMmjEEE2F0jm6u6Ybg2CfGHsDXY7WbpwNwoi621knuOvcKeFYjTJ9Th3SEk7kpjJLjdJLIeG+FKokUlJDJngGw8+VA951bFLKSTcpBHcXunNIhk9DHSuBsCmOe8WIT3R3da6ljga4qGcehkZ/sQl7Xx2I3VnxmMhhLVfXUZFyCrdi1MNBBWVd1JmzhtqSZgWMySMkIv3WIdUyRincXO4WYdWOjgDnH9Vp3NDreDC6WQmW1vusTIs9T0vgaJ2yijC808TpKehmeSAQw91xbn5mA2ilmDZbWJ7rcedmdFNFTTx/irfCdtS4Y9QWbDaqaYNqOSe65zKuXsz6F8X4yUoJNGvc5M2ahss3t1JFjt8S0N1BmljlRWO9qpcd+xVw68xyoxepk0uJu7sVitPgctTMdTDv8AZZFt+vh7FgcNH8a6Kj/7RMfJu6d5t906bMzHXR6DK7+VMOjJXRhzWFQP6NmtbS7+FWV8dmjZw0VHWimbmjj1MbiZ+x8rYGU2fOKUmIME1WR8Q5ctdYl0bPGwu0n+FaqaGfBqr3RcWKvUXpvaZyHL8RWotNHpj6fPUm8RwNkrhwOXLsnJrPMYjDCBVje31LxUyyzlqMEqIojVOFrD5l2d6ZvUJ7/4dr6sn4h9S6XDsb0eKeQ8VBt6R645ddZOxVrHe6Dx3W6ukMScY2gu7Lif08ZrQ4hDGTKTe3ddXZe9Tx1cbCHdlvUvtHi/Ncf6b0jbVFWB7W3Kq3EOAIKxvDa73NJBV+p5v8s6vCv1s8/yaHBhIwuOylgbZlimskY99lKrtT0Z7j/0EISubpF7qxtgkxEoIHZIE0/P+6TTY9ImTH/MUoeALEJHG5ugXQiEISP4LtoVnzBPTGfME9RS3sQjT2fKE1oBNingWFlMAjmk8KN4JGwUqjTJNbE0iNzXEHZRk6Dup3kBpJVJUSX4UfsxPVE3vxna6kj0uAIVuZcuvdV0BsLJ0ZPY1wWyVJI/SLEpweQLWUMriee6k/g+tfsMMmq4vwmPtflBFjZNebMJT4fC5FIa6VrAoi7Ub3UFQ91+UtO8nYq1HSJFBFQ2RzdgUpmbGLkqCaYRq24pi4hjvqUdklFEldDm+iuq8SiILA4X/VW2oqbvNn7KwVfUbI5CXSBUknV8Gq2sfyse+0u14RlMU43Acnyva9haTysfoOo4Jjdrx/Ku1JWw1JsHLMsn7MklS6mWHqnDI6lrvgG4WjM5eiRWUcmiDseAuj8QomTg3HIWGdZ9IQV1O5pZe/2VG6tyWzquC5V4tiWzy99SWTtTWOnLKMn4j2XHeZOT1RQ1EzjRkHfsvYPNzJeGubKRS3uT9K5Pzz9PDY4p6iOjPBOzVhZGPv6e9+MeT+jj2ecdV0lPRSH3ISACrbXzU9FdpAvZb7zIyyqcPkkZ+GcLX3stF9YdKVzap4DXfwse3G0z3rhvK4OtbZj1TiLHy/CVPTVbHM3t/CoqrAK6C5LXeeE2ioazXYB38KnKppl/O5+uyP0uEwiqHaXsFlNH04yrYGww3/ZVmBdK1dfK0Frt/sto5f5US10kYdE43PhTVRkcDyfOQjtJmtensq6zEKkBtITc+FvvJb0+4hPVQPGHu7ctW2co/TcK6SN5oybkfSus8mvTXBRiJ78POwH0Lcw62zzHnubUovTLV6WcmJ8JZTOmoyACOWruPLHp6GioI2iIDYdlh2WeV1JhUMTGwBum3ZbXwXD24awMaF1GLW9HiHOck7W1svlNSD27Nb9Kh/CyifVba6uGHDW0H7KpfTh3Df6WzXHo8+ybW+hMPA0gAK6U3wm7vCo6Sn9vchVQfwFMlpFB17KppF7hSbOChiI0J4eQLKxH4V5L9tCGAEpzQ1jbGyVx0i9kx51AlO/9CeokpF/hKj1t8pUwNubFPFcdDx8XCc1r7gfdDGAAEKVnH7prYjWhhBHKAdrpz+f2TGfKE0jf0eHBo3ShwPBTCLiyUEg3Ci12Sp7HpC0HkJRuLoSikZBHKE5/P7Jqevg9dgkeCeAlRcDkpyehRmgp42FkIQ3sY3sEIQkfYgcJzX/mKahMa0BJyhNY4nb7JyQATC1xJ2T0IX0BhaR2UZL+N1OdxZJoapBrWyAscRx/CNBtYgqfQ3wgsb4SNbGOGyn0DyUNZY7XU+g+QkLCEeoz0IXkgIjDnXTng6jsnRf9UaFUOxrotQ3VNU0oPLVcFFUMaRwj1Q/0LSaUtddoU0LHjgKoDGk2sniEDdPU2hPQhZ7txsqmN+3xJAWtFiP7RqZ4/tDlsX0FldcWaFT+18fxBTOdYXTfmdwnJ9C+i2LGxtuO6lMd/lCayMAb3UjXaeya20xfVEZY4I3BBIUriC3lNLA5t/CT20g9RusAWHKb7l9iUHY2THcn9VXdjZDpofcfZIHA8FMTmc/snRmNb0xyEjjYXSB5JtZSa9gT0OT26DsfCa1pKcGWN7p6gtCxk9jxHGRsEjmtbayA7SoZprkC6FDsmi9skMjRuSonzBzrN/lRSu+HYpInEu3UnovUlXwqohdt1bsShmc12lXGDcH9E2oA0HbsszJWhrS2akzFdNT63G/BWketep30s7gJbb7m639mrRukikLW9vC5czVjnpppHWO11zeVc4sq2LRV4PmM2mnHuVPfytkdGZq0ZLddWO3JXI2PdaSYbUOvJax8qr6VzfcydrDVd/zLCuzXFmfZPR3/ANL9bUuItaYpwbrMqOuZPEC129lyRlJm3G8sa6pBvb6l0F0d1jDWQsf7g3HlT4Gdt62R13tPsz1j3Hcpwc0KipcRZPGC0hTsl1cFdHTfFlyNi/jKhk4BtqUjZ7EHUqKUlgJBuohVPGx22WrRL2RPCzbLzFPr+rup3EaLlWijq99z3VzZL7jABwVZ9dIsxe0Q1HxXsootTXXVV7Avv3QYGkWUM4bHEUrjI3THzdOic5sYa48p8UIjN7pCzU/90tS9WMku+iGR7m3N1TTVg0fNwqysjAiJ34WP4nU+w1xun3dxeiratGNZg9Qso6eUOktYbrjX1O9fwQOm/wA8Wse66Jzk6hkjgna19vh7Lg71W9Q1hZOWPPylcFzcNpmHlR66NH5p5nUktU9jKgX1HusNwzr6Fkpc+cWJ8rV+Y/UuIRYnI58jraysQ/8AtAq45CwSkfuvL8+uXuYlie9HQ+Mdf0stPdkw/lWXDOv4G4h/4w58rTf/AH3rJ4CPdJ28puC4ziE1eHBzrXVOmmXsJCGpHePp6zKijqacGoFgR3XfeQOZdLNhsLPxIvYd15J5IY7X080JL3WuF3F6duu6tkMMb5T25K7bjYSUUjZx10egvT+PU9c0ESA3HN1kEF5GgjutNZWdQzVsUfxk7DutxYM58lO0uHZd5xqekbVG2i40sbWtF09I0EMvZI2QE2Nv5XVVP9TRS0hxIG5QCDuEEXFkAWFlYTHR+kTwbcJvu6RueFOQCLFUssZB27pF/sSxexwnDtgVKwtcdyqQMsb3UgmLRpuE6TSQSZUuc0DkKnlcHcFRy1DiNlRzVckZ47qnZeolG6WieRxb3/dROnZwDuoTVOkFnKmMtpLkqjPMS6Mm2zsq3T/dQVWMU9ELySABU1ficNLEXOeOPK1x1/mDDSRPa2YD/wByqTzFv6Qq3TNgnrvDA/Qaht7+VWUvVdHUWbFKCVyxiGbhhxAtbVbX/Ms+y567OJuY4TXv90leT7svY9m2b8pJZJxra7Yqsa6ws4qz9IV/4ukB+yu1QSDfyFernt7Nat7H62+UAgnZUweSbbKphaHAE+Fej8J3/qSgE8III5StJB2CR7id7IUSvLQXHlFweCoyCBwkY+ztypooh9tE2kkXASEEcpGzdgUOkvvyle0PUwL2g2JTHhruOEjmlxuhrSNgf6TVPRLF6ZE9hDrAdk2QSMF2qctB5CYnfkJk9kUckvDlURPYRY2UZaCblDRpNwUewNdFQ5oI2CGl7SNkjHXbv4Q54H/80v0ha7GzvOrdRucCN+E6R2p10xw1C10+KQ1JCaGONwFNC0gXA7psUfFypgABYIl/6FHCS3zFLqa4cqJ4JGyVvyqtMBxbcnSNk5oAHCGcfulUa+gCa5lzcNTkKdPaAj9r/T/aVsdnX0p6EoCEtbso3gngJ7+f2TUAQuDwTzymP1uNwVPILtskjjAG47oAhjY9xVTEANiOyAAOAntaNigBbDwhCEACEIQAIQhAAhCEACEIQAKNSKNABwntJI3TE9nH7oAbI9oFrpusIl5/dMTJCNJkgIPCLE8BMa6wtZSNOk3soWtgloRCcQCNSGNB5Ca4/wAHbY07C5THA3upJt27Jrh8NvCnrQ5dkTwSdgksfBT0XHlWF0P9UxgdpO6UuY4XTXclIWAjYfun62I4JkUm+6Vty3bwgtDuVJHGLi6H8Ks6+yF0UpdcAqSAubYvFtlUNaAzhQSX0H7KCz4Qqv8AYbNVEbAq2YtOSwm6ZX1zoZC2/dWzEcUBY4X7LCyJ/s0buBW5yS0YFmZiRpKd7i63K5C9R+Y4oKWob+IsRfuunc5cU04fI8HsV57+rbrB0AqW+7axPdc9mWfT3Hw7j3b6to50z5znqRVTxitNt+65azB6yqceqi1kxNzusrzn6udVYhNH7tySe61rSaJ6j3HEG5XLZVnZ9Q+LcX6wXRFh+EGd+uobe57q8UmA0uoOawc+FUUtPG5uw/pTsaIDcFY9km2eqUY8aq9EgwqFkXyj+FSOp6WN9nsCqZa68ZFzxZWiskkfL8Lio0pN6IbpJIqMToqOSAkMHC111nTxQ6yxv8LYbKaaopyLncd1inU3SlVVF1mO3+y08SuSZxnMSi4s1PPjNbQ1ofDIQGu7FdCemXNKWingbPVEWcOStNY3l5WxvLxC7+FfsuqStwSpjcbts4LqcVNJHj3M0KbZ64elPOKlfDC11YOB3XfOR/XFPikcIZPe7RwV4v8ApdzIlpZ4opKgjcfUvTP0j9cHEPw4M1wWjut6mWkeQc9hLTejujp2Z0rGOBusqp2udFcLC+gqgVFHE4dwN1mkMohit9lo1vo8c5Jet2giEjJLk7KsjmbtqVudWDXZPilc/cq7U/6ZNkNFy1x+EuprtiqONztW5VS3gforSe0RKPQrrX2THWDgU5MeQTsVJH4OS0h2oeUahe10y48pW8j9UjS0GtD0paRyEie/5Ux/Bsvo1vzBPUY2N07WfATBq2OQhCe+hI/Qdwf0Ufeye7gpndQSbHr6Nm+T91RSbkhVsguwiypnxWd8qjHkLIzq5VVTsLbJjI9/l7KeNpFlNFdjWtj3cH9FE5urupSR3KhkkDTYHup1F6ET1Ia6JxN1HNC61gqmJuvcp5hBG4H7J20uiX8mizTwuv8AukaDG1XKopdiQFRTxFt9kOzRYqmpFtxOr9ppN+ywfq/qhlJGQX2/dZN1ROYWON+y0hm11OaOJ5923PdUr7zocGiMoopOqszoaFzi6e2/lYJiGe8MVWWCq7/mWpc1s0JqZ8rW1XnutK4hmpXT4qWtqifi8rGvu7N6rFWjuro7OWKsc1v4m97fUts9E9TOxJ7HtfcFcF5Uda4hVVMX+c7cjuuxsjKieqponPJOw5VeM0ynm43qjdETnSRh32VLXUfutIcL7q5UEB/DA2RLFHf4gnuO+zGjb6T6MB6p6TirIX3jBuPC0xmtlNDiNLK0U7Tdp+ldM1dHFI0jSFjmPdK01axzTCDceFFZjKaOo4rm548km+jzZzf9N5nfK+OhG9/pXOnVvparJa15FDy4/SvXDqrJqixIOJogb/Za5x7034e+Rz/8ObufyrPswWken8X5eoRX7HlVi3pQri02of8A4q1U3pRxGOb/APIDz+Veo2IenCgcSP8ADW/7VBS+mPDy65w1vP5VnTwW5HR//t6nHuR56dG+liu95gNF/wDBbryw9MtXTTRPfRbA7/Cuw+m/Thh1NKHuw5tvu1Z909kphtGGuFE0W+ybDE9X8OY5PyaM5bUjUmTuR0NCyMyUo2I5auiOjOh6OiiYBC0WbbhVOB9FQYeAGUwH7LKaCiEDBZllsYtCgzguW5md61Fj8OwpkGnQ0ceFc2Uzri7f6TsPawkB4V3p6JkvxNC3aI99HEZWS2+x2GQlrRsFcPau3j902lpgwWAVQQ1rdNloxSRiWWJvYxjNI+JMcHE7FShre4Se20mwUjkmhikt7HxXDN/KlYSRuUyJltypOylj8K8n+wJrnXuLJXEjhM5Ukfg6IJQ0u4SJWusUo5xZJHsbFPUbSCQfupAQeEx/SJoa8d00CwsnP4CadhdIRNdghNa8k2TlGCewTmuAFimpQ0ngI1skTQOIJuEiUgjkJE9dIftAlDA7lDWk72TwAOAlGtjfbPYhGg+QnIQInsYWlvKRSEA8hNc0AXAQKNQhCABCEIAVrg3lO1jwUxCR9AOLxba6S58lIhCexVoUOIO+6C43v/SS10W7JQ6He4O4Q54Ism2skfe2yBBrzZ105hPlN0uO5CcwEXuEuhVoVCf8H2QdNjayQQZYeAmv4SlwB3SPII2KbIeu/ox4JCYpLX2R7X+n+0R+CjNDvCdG0h24Uth4CTSPCcAtgOAo5ZdJUipqonlI/gR+6Y9s1zbUpGSixBKtwe4G90+GZwkAJUT+aHuKZXubfcKIsOo3CmjBe0EFBi72UHoyBpMg0OStaQb3T3NIPCZI7TbdPSaK8uhXGwTW/MEheDy5Jrb5U0Z6+kMn2S++0CxCBUNJsqZ2sm10MY+9wFKprQ5PfwqHvD9gopWlm5KAXg9+UlQ4kfEnxnHY+MtMh93sb/ypKY3eCPKg5KqKdjm7qWUo6J4y2VrB8N/sop5AxtigSFosTyFS1M33WTlEj/6WDrPDGVtJIdPLVzjnH0RJLHK9kXnsupKqnFVA4Wv8K11mN0iyopJHGEcFcpnJla7pHnDnRg9XhU8rrEWJWn2dZ1WGYhpMpFnW5XVHqg6TbTGdzYrWJXF3Xomw/EpCLizlxuXKSbMe/pnQOVGcElPPG01JG4+pdUZX50wvpow6p+kcuXmp0d1hU0lUy0xG/lb4y7zUqoI42/izYAd1Xxcl1y7KE7PX4ekPRuZ9LWU7CZgb/dZ1g3UEFfux39riDLPN+RzI2PrO47roLLTMeOoazVVDe3ddNhZvtJdkld22b3jtMB3uh1EHcBWXAupqWqjbaYE28q/0lVHMLtcDddjiXqaRp1TUl0RQ0z4zwrjQggC6RjGu3U8TGstZbMWpRL9bZKmuka07hI6TSeVG/wCM3O6a4lmK2PvffymHZ2/lOYCQAklbYHbdQ/GDjtlNiNWGx2usRx+oc9jtKyHEYpJLgKzV2Fyyg7Hk9k+S9ole6BpPNTDJq2OYNF7grkL1C5cVWIMm/wAom7T2XfPUvSL6zW10VyfstUZi5JnFmOtSXuPyrk+Wp9kzGyq0ePec+UlbS1EsopyBqPZaF6j6fqMOqnNcwixXqp6g/TW6Gknm/wAP4J+lcKZ15WSYTiMjRTkWcey8+y8Pc/hjWVfts1D0pgc2IvEYYTc2W5stcj6zF5GPbSk3t2Vnyh6HdVYvHC6Hl4Xf/pf9O8eMU8Ev4EG4F9lFRgP2+BCvs09l/wCn3EcPiilFGRYX+VdAZP8ARVdhcsQfCRZw7LpDAvTLS0+Hxh1A0HT+VV+HZIswuYOZSgWPhdTh4bgkauPXoveS1NJDHGJW9hyt6YS9jKZn6LXfQfSRodIbHay2LSUb2Qho8LrMKpxSNnHi/pVuq2hhACpm1BL+U8UryLkKIMF9hut6ttItlSag32upIZNY/VUwa6wJCkiDgAAOeVMmkCfZUEXFlE9pPw2U8bfhFwmkbkJyehylpFJMPb3+ypZJxq0hV1UxpFrq2zwSFxIuq2RZpDJTRO1wLbkqOdrHAmyjjMjRZ11T1tZ7YJLrfuueystRT2Z9s0ttjal7WNJCxvGup4MN1a32t91JjvVNNQQOc+cDY8laNzczapqFkpZWAc8Fc9fyCbMa+xP4ZJ1/nJS0bZI21IFh+ZaDzJzoFUXxx1N73+paxzWz1kdUStjrT+zlq2XMSrxmr0moJBPlQRznJlaM9s2xD1dV4niALJCQXefut9ZF4hVv9vU48hc45Y0bsSqI3OaTcg7rqvJbpl0TIX+2Rx2WlhXuctGpiy7OkctHOfQgu50rJqxnwWCsHQUX4ejDbcBZDOQ4fsuloaSN2vXqUTWkusq6laQ0AqBjQHbKqjsP1WnX2iw5LRJbQbprjyU5xOkX5Ubz99lOtaKljG3J2JUUhIF/unNdY7lMe4EWCeuipKfexrZCHWJuntdq2UP1/upWAWumzWxYzeyZSMZ2uo1KxwvdQyiy1WxkjS126anzEF2xTJiABpP8KJvRaTY1zOTdNGxui55QnKQ8e03Fh2Q4XFgkYQL3Kc3chSRbZCxGggWKf7QHB/pOs23CL3UiYxtIGiwsgt0lGoA88ILwdyU7vY1vY2TslbwEGzu6VNmtoammOj7pybH3TlBrskXwR/ylNbyP1Tn/AClNbyP1Ukfgo9CEJwAdxZN0HyE5CAGhljc2TrAcBCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQmvcQdigBkvNvumE2F0+TcX+6YQDsUx/QEa7V2UgcDsmAAcBOa0g7hN1sCVo+EBKmBxHdO1N8pfTQA/j90wi4snnS7ZHwAqRdBvRC5ulMc2291O5ocbtIUb2jxspFIkjJMiShwDSE6zQeE19r7J20yQRSMIuCo0Em2xTJPoikkTvkbpsqWR7dJF+ye59gQSqeXVY8/ZVZz6ZHr9kWLG9nEhYzjFW5gdfxusrxOndJquFhfVt4GuPGyxL1++zquGqjKaNT50Yl/+GS776SvNj1m4nKJKrQ4/Me69Bc6MQe7D5QHHgrzt9XYdUuqRe9yVz+b2z6N8LohVXHZwXmbXTOxOVxeeTyVjeB4jJJKGkrMMwcDqKnEJWtYT8XhUXSGXNbUzB34Vx/Zc5kVOTPorhs/Hx60VmGTPe0fdXGOllqG7C/7LIsNyvxBjWn8G7jwsn6eytq5C1rqN2/2VR4zbN23yChLWzAaPpSrqzZsZP7K6UuVldVOBEJ3+y3n0fku+Yt1UR7dltHpXIISaHvoNv8A0qavCfsY2X5FQq9pnMOCZL18jADTnf7K903pzq64i9He/lq7B6fyBiu0fgB/tWw+lPTpTyuYXYeP9q1qMP1OB5XySl7Wzz/xT0n1ElKZDh/A/ItY9bZHVHTLy40umx7BevGJ+nKhGFvP+HNvp/KuS/VXk/Bgsc+mkDbX7LVrr9NHE38tTkN6ezkDKqoqsDxuOLURZ4Gy9K/Q31HPKaUOkPA7rzkoaIYd1NpIt8a729DNW4z0rWu8K9XJnCc9ZCVbZ6mZUVfu4VA4n6Qs5mqgGFt1rnJrW7BYCQflCzeqL72WjVPrR4dyqSyG0VFK4zSfurpHTm1grZhulhHkq901nMuFo1N6MWyX9GNiICmA0G9+ycWActUcjz5/RWokK7HOe3Tyo/cHcKJ84a610gmDuCp4kiiyVpOrlTM+VQxkE/spmcfunMbIezglK/5ShnH7of8AKVE/hCMQhCak2BIhCCbC6VvYiWhH/KUxOL7i1k3fx/agmnsctCONmlRuaDupCCRZDRYWKaosdtEbW6e6kZ8oQIyzcof8pViCF2t9DZNlBJu66WaQi/6KIOJOwVqMRk/1WyrgfYWCkMhB3KpYn2NrdlIY3H4gUyS12Vozc30TPIeLWVFVsu0kBVDZgDpKbMA5hNuVRstii7U3HtmFdahrIHkn6SuVvUR1B+BjlAfbY911b1/Sl1FI5vZpXFHqkllYJmg8XWRfkR9jsuLlFwRyvmx1k+epkaJe57rX+CSyYjiodzdylzMrZRiMgc4/Me6oegMQh/xRge76h3WZZejr6KXKPR03kZ07JLLCSwchdx5FYEyCiiu0fKFxnkdjlBAIS5wvsuwMputKGCkj0yj5RwUY9ikyjymJa6/1+m8Io4oaYXI4VBVSxgk3/tWZvV0NVAC2T9d1SS9QMe4gP/taSa2chDAyE22uy7msY55aSAlEMcu/YqyRVPvPD2v7+VcqGpdswlTRSY78Vta7J5cNgc2xaP4VoxTAKWVpOj+lkMVO6QXumVOGuc0kFEq/ZBXlTql0zX9b07TiQn2+/hPo+nKV5HwrKKrBi91rfwn0mASsIOlVZYr2aEeVua02Wmk6cpwQAz+ldaTBIY2/L/SulNhhAA07/op/wZjbayglRp9oqXZ05vWyhhwqEndqrIsGaAAAnx079SuVJGC0AqxTX/6M67Jml9KWkwXe4V1p6YQsAKfBGAdgpZBq3AWhVFoyL8iTGg6d/wDmkvfdI52nsk132AVxfDOldLY5OaN73Udn+f7T2uDTv3T1HY2Nk29FRGGubdDhY2TWuuLhSawptaRYi9/SN/H7Jie8ajsmO+G905MmiNc4g2CA8k72TXyC+4QAXC4CXaJNonZ8qezghQxgg7qVrtPZDRG0Ofx+6YeCnuBcAQk9s+Ux9ETRELtN7JQ8n6VJoPkIDPJUY1QY1PZ8qT2z2KNWgWI4Sx+j9f8ABS0O5RoHkoa4OFwlTw/ggAAsEqCbC6YXEo0xjf8A0c4kC4Q03F0xziBuUrZNtggE0h6CLiya2QHlLrb5SbQ9PY1wsbJEriCbhNc7SbWRtCioQ0F3CdoPkI2gGpWi5sl0HyE4bCyRtaAaWAJqkdwf0UYJHCRPQjBCeHt8o1t8p20ItjErQCbFPBB4QlHDHCxskUia/kBADHEgXCTWfASFpAuUiekhv7A4km6VrbmxSKQC5sopSimP7SEDLG4KVPaLCyHNJNwlWtBtjEJHNLuE5sfwi5TukJ7aEUU8Qc3ZTFh7I0E8hD0P9kW58BBJ35QyOzrlVz4WuuCopaUWu08KJyjsVS7HQ1AaLX3U7JA7ZW9jXtdue/lVNO8u2SqCY6UdrZO9vcD9VTTjZVIcA2xCppgHI/H10VbFtFO+YMBJTRVMJtdFRSvc0m6t9WHUoMjnfoopRcSpLpl3bICLn+komsLBYTiWYNJhjiySUbfdMpc08OncAJhf/wBSrTyIw+kf5UjOdYduSmTkFtrqw4Z1fTV1gx4ufurzE/3Wgg8qOGZGUumSQsU3pDW21WuqumaXDuoTTEfFZVFM8MAarSv3/S1FNCzNIF2qiqGk8juq6eZrBuqUubM6w/tRWP3RY3sWniHs/qrR1LhjKygeHN+k2V7jjLG7FUWLvDKRwPgrDzak02yG5JwOLPVT0swtqPg7nsuDc3OltOITOaz6ivST1KYc2qjndYclcO5v9ONNXNsPmK4bPr9WzCyOjQGG4TLBU6gOCs0wDFpsPaAHWsrfXU0WGyEutysfxvrGmwwueX8HyudnKUZdGLc37G7Okcz58Oey8vfyt35Z58+zoDqoDj6lwVHm9Ttm0sm79nLOsvM15KqdrY5zuR9S1cG9xa2LXPTPTrLbO2OvdG38UDx9S3l0T1g3E42Wfe4C89ci+p62rmheZnWIHddk5MYlLLFDrcf5Xd8bke2jUx7Df1DL7kQN+VVXs2/2VtweQOpw5XEjWywXW0TbgbdT/UidKXv0g8qZo0i11SysdC7WTwpYqkSDSfCmba+l1fCZ5DeE0m7CbJLEG5HdOe4NZcqH0lJ9C/CH2Wud8SbPRQltyB91FPiEcTjd1lRVeOwtZb3P7U+vVEdutDanC6aV5+EK34h05RyizowbjwpY8bhdL/4n9qtbUwT2c1w4WJnVxmjLsjGXTNBeo/oChdgU0opxu09l5feqrpymoMVnIjAs89l62+oeqpv+7kzLj5SvKz1gRtkxao093lcfkYUvcyp0v26NPZJsgPU8TS3/AMwL1V9FWFUcuEwPMY+Qdl5RZTyii6oY8nYSD/mvUL0UdbU0eFwROd9I7p1GE9/AVTR2LT0URia0R7W8Kmq8GgJuIu/hPwrqGjqIWODhu1T1GKUrgfiC6enCfoujWhCOkx2C0bIHWa0BXwHSwbKw0GMUkT93D+VWy9R0IivrC0qavRdl6r1iivlqQ2MjbjyqGGXXIQSFa6rqqlJ0h6fh2KRTyBzXcq3BrRLvZfo4w4fspY4W2/dQUUofHypwSCpUxossoibdUE2IhjlNXyENsFZMQfKz4xwnKcUhrmki7xVTZ+6JmgC4Cs1DXljbv2Ta/q6io2XllAt91mZl8EuytO2K+lXiVWKWFzyRstcdbZkRYXI9jpQAB5UeYOcGGYfSyNFQBYfmXMGceecE08rYqrzazlw/JZcezOyLk10Zdm9n4yjic2KrA5+pctZvZ+yVTZQ2rHJ+pWTM/M+qri4Nmc69/qWi+u8TxGtLngusVytuWnIxrG2yt6jzDnxjEHD3r3PlZTlth82KVDDa+4WoMAwytrMQbrB+ZdHZFYA1k0QkAvcKSm1yfQkIvZvvIvL980kLjGeB2XXWV3RzaWijvHbYdlqr0/8ASsPtwTFgtpHZdK9LYTHT07C1osAum4xyczUw9+xeMDozTRAWVfK5w4CbBpY0iyJZRpIsuwo/mzfhrRH7+k2v3VXRyB4uSFbHtLn/ALqpppTFsStOE0iVyWi4TvLRsqaSoHGyH1DXttfnyqaUEnUPKkd0E9FO2X/CX3nJQQeCqcPJNhf+UktSKcanG4RG9FOUtIqC0E3SxPcDY+VQuxmJrdWpLTYxDUX0nhTRtrYsJJ/C5+5bkf2muqADYHsqf3w+2klBheWh9+yRtP4Xaeyf3yl1ahuVTMuXaSqmKMjcqGUey/DpdjtG179k1PcdI4TXHUb2TNpDxms+ApIHkkXUeg+QnsaQAU9SI2mydI51ghnyhNdyUbe9kE+iOSbSf/0pBOTsAE2aN32TWMNlZg9/SP8AYqo9xdOTIQW7FPSh2hzCbpyY12nsnNG+q/KhlFpksXtA/wCUpreR+qUnUdNkBhBvdC6HDkIQnACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCECPYJjyCdinncWTCwgXQN20NIBFimuFjZPubWSafi1XSOLbF9kI1oIuU5CEqiLtAg7C6E1/P7J6SE7BshCRzrnZDRqNkug3SSWyKW0xWO8lKkZGfF07QUiHxbSGljT2THx78qUsIF0iHLRLGRD7ZHJ/pN4UznA8JhGoWChnNaFb2RubqN7pHQ3HBU7IiBuUNIDSbKtJ9DfVtlrrqcaTssG63pA9jwPCz2uka5xAWJdW0bpWuI7g2VC6Da2dHxNjhctnM+ddIGUUt/uvPv1Q0onqqhluSV6Q53YBLJhkz9P0ledPqigdR4lOx/5zysLKr2e5eP8uqa49nKlR0EMWxcsEN7u8LdGTnpvZirY3OoibgfSsT6OlppuoGteAfjHZdxel3pLD8Vp4XCFp2HZZEqds7j/APaXXDqRrvDvSLG6la8UJ+X8iuWD+lRtO8E0Jtf8q7j6eynpKiiYPwzfl/KrizJ2mj3FK3+FJDCb70c7keev3cfc5H6T9OcdM5t6Qj7aVszp7IyKKJtqU7f6Vv7CspYWvBbA3b7LIaXoKCkiDTCBt4WhThb+mHm+ezcfWMjQ+E5RQ07m3p7b+Fm/TeXtLAG3iH8LYb+j42jW2MceExtHFQH4gBZXf8dV/TnMryS/LjpMxPHulaSnwx59sCwXCXrjw+lgZUu09iu8cweooKLCpjqAs3yvPD1ydXMrG1MbH8gqK6cdlrisy+MdSZwri72v6vLI+0nb9V3b6BaF009IbX+VcIUkT6nq4vd/+cXoR6AaVsdRS6v9PKijbHYvLZbdT2enOTuFFmBQXb9AWY1lIGuNwrNlM1n/AHfgsPoCyipiDncLVokmjx7Oucsh7LYyB0bgQrtQS6YxdU8kbGtueUxlUGG11p1S0inLTiXJ89xtZU089u+yi/Ek8Js95B8I5VyEtkcdIhnqBvYpkVRvz3UUkUmq3/NOhgeT+6sxTZLtFxp5CbFVjOP3VHDEWNCqongi1k6XZHPWuiZnH7ppc5wtZJuntbbe/ZRPsg+DLHwhPf8AKUxIloEP1t8pdnBRp7PlCRrQBob4Rob4SoTQGFpvYBK1gt8QTkJVFANe4EbFMcW2IQ4kC4TCbm6lihY/RkrGkcKNjGt5CmLQ7lAhDgVImtBet1aImWUvulreeyZoLXkIms1ihtn0V8apoikk+IlK6ce0bqlklOvlMfN/l3usa+X/AE1lVtIs3XE7f8PlFx8hXEvqpZ/47h912T1zWgUcg1fSe64z9UFUx8c17d1gZVvqdpwGE7tHBecVS6nrZn34cVgOA9af4fiILpbWd5WZZ7VbGVE5BHzFc/431I6jrXOElrHysSzK0/p7Dxfj7tgujr7LXO+KgfG01luO66Xyv9RlP+Hib/iAGwvuvLTBs1ZaORp/E2sfK2X0P6jJKIsjdXAWH5klOf6s2L/E5TXw9Zem8/KWakbevF7fmV8os4KWok2rRz+ZebPS3qqEULQ7EBcf61nPT/qupw4OfiDf96v18n/1mVd4e0tqPZ6K4NmPSygH8W3+VkWGda0j3Bxqhz5Xn/gfq8ooQ0OxBv8AvWTYb6z8OisP8RZ+utXa+SRzuZ4fPvo7/wAP6wpHMA/Et4Vyb1NSSN3qG7/dcI4b628LYAP8RZ/vWQYf618JkA//ABFnH5wrsOTTRy9/htye0jsw4xROdf32qeHGKMD/AMZq5Ao/WRhkrhbEGf71eaH1YYfUNuK5h3/OpFyMNlKXieT8OrWY1RtNhMP5Tv8AFqaTcSj+VzFTep2ilIBrW2/9Su2Heo6hlIaKxv8AvTJZkLJFSzxfJrWzolldC7iQFVtNVN2IcFpfpvOKlxIjTUNN/utgdOdStxFrS19/3VumxSMXL4yylNSM5ppWuF7qYEEbK10E12A32/VVzJ9rf9FoQRzN9XpIc5h4Iuk9s9gVIx2rulsbXsporRSdTbIxG4Hv/KfpB5CUX7hK0AmxViDSF9HEcwWbsE4AngJONvsnM4ulJYrSEII5CjlabEgKV/F007iyCSJTFovuFIGhvCV8Y1coQOHMBuDZOTWuOwAThuU9/BG+hzCTsSnJA0A3CVMGAhCRzi3hRv6AqY8C6XWfATS4E3JSx+jkmKwhuxT+VHsTcFOa43ATxr6Ff8pTE9wuCmJ0SGQj/lTByErnHcJEknoaKHEcJzXAhMTmd1B7DovsckLQeQlQkb2Sp7HtaAAQOyVICLDdLceQk3oUEIuDwUJykwA7gpmh3hPQiTAZod4RocnoOwunRQCD4BYlGpp7ppcXcpriQLhSJASFwtsUwknlNa8k2Tk71FS2I4EiwTSCOyegi4slS0OSSGxtDjupQwA3TGjTwl1kclRThtiNNj7jymvcW902+90riXCxSpaQ1rQxzrcFK2UgbuTEKXRGSiX7hPBB4KhbGXC+/wDCeHhnKZJIekOc0HdQyuI2Cc6obewKb8zlD+Nj4/8ASP2t77J8TA07fupJQA1U0tW2K6WM/Xoc59FST5UMhG26p3Ym1wsbJ0U4lOymjJIrzfRI9ji0gBWDq10sFC+QbWBKyRtrXurB12R/hUgv9BVbJsiolayOo7OXM6MyJsDqZB75Fie61pg3qFe2tETq36rfMp/VT+LE8zoSRueFytWdSYjheKFznkWeuYzL9GfYn8PQ3KjNZmKmI/i73Plb46bx+Ksp2u90HZecWSOcb6N0bZqgbEcldUZa53U1TExjqpvA+pZFeX6WfRKW4zOlIphI0WcnBxabrDelOvqXE2MAlabjysnir2TgOaRvwtqrLi0uzUjdFrZUVEnuDcqOnD9YA4SizrElTwBjOQtKFikieM9onjbZnxeFaOo5GtpnAHsrlNUsY3YrH8cnM7HNHdRZMfaAtj3E0FnrTPqIJtLb3uuN848GnZNO8Q+V3dmX086vgkGi91zTm/lu+SOZwiN7HsuM5LH2zDyo9nEHXjZYQ+zdxdaCzN6kq4JHsa8ixPddb5pZeVEJltEe/ZcwZudBVIklPtO58LlLsdxkY063tmm29aVba3T7rvmW5MjsYqq2riPuE3cLbrTc3QteMSv7Tvm8LduQ+BS0FVF7jSLEchPoraZEo6O5/TbTVEog1X4C7cygoZYaGGS3hcZenGshibTja+kLtzJ2pinw+Bg8LruMk0kaGMtaNvdLyyPg0v7Acq/MDrbFWjp+IMiBV2fM2Nu67nDl+iZ0NK/XZT18haCCVHh5Bdz2UVdUiTZOw3U43Wg2nEvR1oubfj4CosarW0dO5znWsqymaQzflYZmvj3+FYfLKXW0sKSL9Q32Yz1nmbS4Q9wdVNFvute4z6gaGB2k4i0b/mXPnqd9SMXTc0wdXNbYH6lx/wBceuynpax0YxVuzrf+IknLZFPs9NKf1C0DnC2JN/3K9UPqKw6IAHEm8fmXknSevina8/8A4q3/APiK7wevKCRtxirf/wCIs22G2UrIs9FM8s+MLrcHlaMQYbg9150+p7MKgr8RncyqB+I91jOYfrhhraJ8f+Kt3H/5xcxZsepWmxeokd+Oabk/WqTx9v4V3DaNr9JddUlJjzX/AIgf+J5XbXpZz/w/CIYWHEGjYbal5EUOecENf7oq2j4vzLceVfqrZhLowMRAtb61LVipP4J+M90+kfUfh89HG44m35fzLIovUFhkjf8A9pNv/wCpeRvR/rlipqONjsVbs0fWsopPXdShv/7Wb/8AxAtmEVGvRZhH1Wz1Hk9QeGRb/wCJN/3KgqPUnhu8YxNv+5eYtf67KUsJGKs4/wDzix6o9dsP4kj/ABZvP/5xRSTRYhE9WaXP3DqqUAYk03P5lnPRmZ9LXvboqwf3XkV0n64aeeoaP8VbfUP/ADF1B6dvU5H1DUws/HNNyPqSxjsmSPSfp3G2VsTXMkvsr5HKXNBJWp8kuqBjlJC4Pvdo7rbDYv8ALaR4Uj6Q1oiqiHWCp5KWOSM+4OyqKlmki6Y8aoLKvY2kQzXRi/VFfDhsL/bNrDstH5qZoT4bE/25iLX7rdPW2FPmgeWd2rmrPDAJ2wSkX7rBzrNxMu1mhc5/ULV03vMNa4WJHzLnHq/PObEax4NcTc/mWQeo6CtozOWuOziuUeq+q6rDsQeXyHZ3lcDyUm5Gda+zfuF9RR468e/UA3+6q8U6Yp62G7QDstF9DZpgTNYZvHJW2sHzFpaimAfIDceVgfjk5lb6ybDOmo6KqBEYvq8LeeSGHudVwjT9QWmsHxeHEapgj7uXReQGCGoqonaTyFtYVDZZrhs6/wAi8OcyihIj+kLemCye1TsaVrDJ7B3U+HQ2b9AW0aKmeImk9l1uBT6tGlix9ZF3ppGOFyVJJG1w2twqBs3tCxU8VWx+110MZpGqpaQkkLmk6bqNznt33VUJWEchQVDmatks8hRX0bJ9FOJZQ7lS/iLR/E7+VHPNHGzUTwrB1B1VBQQuvINvuqss1b+lO2XqXqTEYWH/AMQBWnH+qKWnh0mcX+5Wt+o84Kegc4fiGi33WC49nLFWyFsdSDvb5k+OVv8Apnzn2bgqOsYXMIbN/BVV0/1CJpQBJyfK0tgfWEuJODWyXv8AdbG6K9+R7SVdqtbHVP8AhtXC5/faDe6u8ceqLSB2Vn6ep3NhaXeFfIRZoC0quzWx2QspwH3sp3AaeOEk7mxuUclUwBWGui/7b0PLNTblN0t4smtqWlukFOZvclVZJpiuQukH6UvtEd/2TgGtPKVQptC+2xl3NCAL/qleeyGc/srEJaRWk/3GOjcTwhkRv8QUqFJ7EiWgAA4CEjnBvKUbi6k9mMlFgnMJTU9gsL+Ura0JH6DgANQ5SNeLfEUr/lKYBc2TGtko5pJO5TkgaG8JUoAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAg7goQga0RpHbNKVI/5SpCJrQjXADcpya1oIuU5AsQTXgngJyEzemTIYL9k5t7boDQ3hOaLmyVyGP6JcjgpdbvKdoHkpiRvYgFxtuUD4uEj/AJSlgIANz3ULWxy+jXtA4CVobYGySQ3KcwXAF1HJDv6HChkeGsO6ne2232VJVtsCo3EcpPZa62otMQD3VvxCn/Eg3HZVNcxwkLk+lYJQQ7wq00/6amNb6rZp3OrACcGlLIvpPZeaPq96flbiNS4RH5z2XrBmnhkVThckenkFcEeqzKeXEZKmZlOTuTwsXKj2d5xGZKVSezz4wJ78M6mDpAQBIu5/SL1/h1LFTxyTNGwvcrkLMHoOp6fxR8wjc3S642V6ynzen6Rq2RvqS3SRyVlzj2dOrZSj9PY7Lrq3CMQoYtMzCS0cFZ1R/gamMEaTded2SHq4hBggkxAbWHzrq7K/PSix6mid+Kab2+pW6bGlo5bkMByk5xfZvvDaOma2+kJKyngc7SGhWDBesaepiuyUG48q4RYk2d+rUFpVNdHMzxr4WNsdWQxxxGze2ywfrDEfwbXOBWb1szHxGx7LXWY0QdTu0nsU/Ja0X8CLlLs0tnH142Ggmj93yOVwV6ocVdjVROGEuuSuxM58NqKhkobfkrmLMLLSoxepfqjcbnwsHIkd5gQl6nKHT3R9VU9QiRtOSNfhd8eiHBp8PnpdURFrLVfQPp7dJiAldSHnnSuu/TblR/gk0LjCW2tyFWhJqRS5eputnZWUtUGYFA0n6Rf+FmT5GvFwsL6ApfwmHxR+AFmlM1jmXLgtrGk9HludWo2soq+oLBsdlQGqPnurpWUzZdrgKhlw4sFx5WvGXSZXklKHRNQSiYhpV2hpWaASL7Ky0LTFJYq+Uk7XMAJ7K7QytKPr8IZqFhOqybHShu9rKplnYXFoO/CGcLRjJ6BSeiNrLGxCcwWIt5SkG52StZsCkfwG9jk5rrclNQmDX8HOcCLApqEIGAns+UJiez5QgBUJr3EHYpC8jkoAdrF7WSk2F0xpBdyn8oAicCRYJhFjZSlpHITXNBFwN06LFj9GHcWT4CGixTCLbFGrT3Sv4StbiK8DWSAoqhpLU8PDimygkKnNsIr1Zaal2l1wqaeoIYSqmsadZ/VUMwOhwI4WXemzRqknJJmH5gVLzSS2P0FcY+qHEDHFMSexXYuY9Q2CklBd9JXDvqzxNsUMxDvK5fObTZ6p4lSpyijhPPvG7VM4DvqN91zX1jjEn4iQtJW6M98ZLqyduv6itBdQv9+d+/PK5LKuabZ9OeN8ZCypdFmqupKiC+lx/lUdNmFiFNUfDM8b+U+rog5puFZX4YfeJA7qlVke29no2NwMLI/6mY0udGJ0tgKh/wDuV5wzP3FWHaqf/uK1nNhjr3smx0MjNxfZTxyNfGOt8ark/wDU25J6lMXpR8NXJx+ZMHqqxtg2rZNv9RWoKmkmfe5KpzhUknlWoZUv+mPkeK1yevU3dSerbHWO3rpP95V6wj1iY214a7EJOfzlc5SYTNH3Kaymqojdr3beCrUct/8ATFu8Prb/ANTr3A/WBihLS7EH8/nWfdLerutka0Pr3/71whQYhXwPA95w/dZRgnVFdABaod/Ksxyn/wBMy3w6qP8A4nfeH+q2qe0H8e7j86yfpT1SVU1Sxprnbu/OuCcN66rmAB1S7+VmfRHXdY6riaKl3zeVbpyGcxyvi0K4N6PU7I7PKfFpY2mqcbkfUuysnOoXYlTxuLybtHdeVnpa6tqJqmDVMfmC9KPTfiRqaGA6/oC6PBs9tHh/k/GrHb6OkcJOqnaSeyrGuIKosCN6VmrwquU2dYbLo6o7SPH8hL8jKuF5uCT2UzSLglUtOSeSqg3ABBKser0U5R18HuIJ2Q1wbyo9TvKVrt9ymb0yGxaJdYJ4T2uAFlDwnxkuO6lQ1fCR/H7pie/j90xA5fQdwf0UBF3WHlT8qMs0nUQgeLHsQD4T0jRYbjdKl+kTeiRI/wCUpGvN/iKUPaTZGmN33sYhK4G+wRod4TGnscnsQmwumONzdSFhtuE3Q3wnIUYpG8D9EyTS2yGOJI32R/QJmcfukeB4Ss+VJJ2S72xjWiJ3J/VMLSXXTuUJLPhG1oE4PsLWTUKq2OXweCCLhKmBxHBRrd5TG9EiWh6EDcISp7FFaQDcpzXXNrJiczn9k5MByEE23KaX+FLFbAckc4bhN1u8pDublSpC6YJH/KUqR/Cck0xdMYhCE4cSITWuJO5TkjegI5X2NrJGu1G1k98es3TfbLeAndaAcwi1k5I0WF7bpVFKSGS+gnNb3TU7UA2wUTsEHWA4CpqtxAs3lS+7bbUkfH7ounKxCpf0oWSSX+JVcDwRZNdTABQyTNh3vwpHKLQ8qauRrWq0VsriSQVJLXmYgFN9n3drKn37DNMtzp5Q6wVwwuUuduoqihsbhqWm/wAojsplv1GSReWj4LqydX05qaCRoP0lV760tj+bdUNf7lVA5o3uFnZk2ola1/rpHKHqC6G/xH3SWXvfsuO81uhH4bPLKyO1nHsvRHNvpt1RG93tX57LlDPDolxjmcKfz2XGche1szLZ6Zy/hvVlT09WaRIRpPlbZyzzsqIpWN/FOt/6lpXMjBanD62QsBG+ytXSPUVThtW0SzEWPdc3PL1P6VFdqR6Q5MZv/i/aa+pPA5cuhuj+saeuhYDLz915r5TZsPoXxH8Xbjuuj8ts9NTY2mt3NvqWji5zb+k8bzs2jqopWhzXgqrBLxYLUHQuabMRY1pqgb27raGCYlHWxBzZAbhdbg5Ks0X6blLSKqojfyrdVUjpOyvrY2vZuo30rD9K2nD2iXdvRhGPYAyohcHN89lqvMXL9lVBJaIG48LfGKUzGtILQsVx7B4qtjh7YtZY2Zie5n3w30cSZo5QfiHSBtOOD9K5zzJ9P81VJIRRjk/SvR7rDoGnqXlv4YG/2WAY5kZDXEuNCCD9lzGVgNMyrKnvZ5o4j6bZopzJ+BG3+hS4Tl4/pmYF0emx8L0Dx/04QClfK3Dh8v5VzrnhlyenDI5lLptfgKpHF9XtELg0U2RvUraGuhhdJxbuu5/T7j0NdDA0SX47rzL6Q6onwnHGs9wizvK7O9KWZMs1VTwvqO42utLHXoWKF2d54P8A/kzSPCmrnODLjwrN0pjcNXh0TvdBJAV5lkY5lyey6nEvXokjfp9XFFtc8l1yT91dcFdGWcdvCs1ZM1shDfKr8Ee5w2PZblU00WV8L2LW2WlPVFjTsMwCqka4i0ZW6Yb+2LrQnq8pZZOnKwjb/KKmcNg2keLv/aPZ61+CVtWyKqcLauHLyyzP9VONDF5GNrZP/EP1/dd6/wDamQVDK+t0k7al5K9cwzDHZXSOO7zyn/jbQm9s2lR+qLHHuN6yT/eVXD1ZY3TDT+Nkv/6itDi8R2elDDMb6/5Ucqd/RjrTfbN14n6p8arWEGsk3/1lY3iWduKV7i99S83v9S1u5oG2tPYPhvrTfwxGumOjNTmxiDH6hO7+VdsJz5xOhIIqni3+payka0n5khZpFw5TQqSBUwN3UnqmxmmjDW1r9v8AUp2+rjHIj/8Alsn+9aJ0n86X277l/wDSWSWhyr/9m95vVtjkjCPx0lyPzlW93qlxt0wea2T/AHFaYLP9d0gjufmsonBNkiikjorob1X4wMUia6tktrH1r0Y9BXqArMar6Vrqpxvp5cvGfBJnQYlEWSWu8cL0j/7NGsqKjGaRrpCd2oUGmPij6JvRdj8mMYVSPe4m8Y7rqPTaJv7Lkn0CwOOC0Zd/+bC63mOlo/VNl8Gso8T+EhQPmDIf0TsalLGggqCF7ZIPiVHIt1Er2/SixRjaqncCOy0nnN0xHVUslm83W6sTq4aWN2p1tlqTNjqCkbSPtI3v3XL5du2zJu/pwF6oujmMZUnT3K4EzqwqSkxCZrOxK9F/VBi9PNHUNaQbk91wzmj07JjWIymOEm52sFyuVD3bMq17NEYRjNfh9YNIJ33WzOk+q8VmawEO44Vx6QyBrMbq2u/AuNz4W5ujfS1UsjY44c7YX+VVasVyZFXFtlBk+6uxCsiMjTu8LuX03YAXGBzmeOy0TljkPLhFRGTREWI+ldd5CdIfgHQtdDa1l0uBhtmtRVtHTGV+Dtiw2K7RswLN20zWR2ACs/QVIyLD4xb6Qshljs3hdPj4vpDZq11KMdlnxAlp2UNK6Rzxuqytp9TtwomRshUV0vRDZy10TB5a3n+1T1FSBy5U+JYrHRxuc59rBYX1LmFDSNdoqAP3WDl5qj/SvZcorRkHUmPQ0tK4mTj7rS2a2ZDaGCUtnOw8qk69ziayJ7BVjv3XPGcWbjpoZgKrz3WN/wDI7l9KM7dlFmXnjLFVPa2qPJ+pYt05mxUYliDWmdxufzLSOYHXNRV17wyoJufKvWTtVPiGJxAuJuQtCjMciu57O2clambFzC52+ohdK9E4H7UUby3stCemnp5zqene6PsOy6n6aw1sVI34eB4XTYFjnEs48XIvFBGIoWj7KvjdcbKhkd7TAAlpqvU7SXLoqN/DWr/XonrQ4m4/5qhle5u1/wC1XyuEjSbKjnYHGwG91c11otJ6WxIXutdVcLiRb7qngiGzSN1Vsja0cKvZFDHJjk7WNNvskIIG6jcdLiVWcNEikP4Q14vsVA6Yc3QyYOdsUqlroictyKrULXRraofdtyeyQSF3dPT2Tx3IJH2dayni+Jn6BU5AJuVURbMFu6miK0x7ALXsnJGcfulTxmtMR/ylNbyP1Tn/AClNbyP1QPHoQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAKNSKNAD2fKEqYHEbApzSSN0AMPOyEHYlCcnoa0Cc1pBuU1FzzdK+xjeiRCjufKCQOSm+rE9kiRNf837JgeCbIDrusmt9DlJbHXPkpEITG9EgJC4A2KVNe0k7BInsa1oantcNgkcwW+EJriWC/hOS2NJL2ChkZ7gsU01Fzp1JzCTc3R6Ng5FBW0RcVSSRmmYSFezE1502uqPFKI+2bN7KrbX0XKJ+rML6oaa5hiPdaYzfyxhxXD5nuhB1fZb1xCiJkuGrHeqMJjqaN7HxjcLGya2dbxt+tHmj6kMj3wxVFTDS9juGrifMehxjpzEZGwxOGlxGwXsdnFlbTY7SzQimbcg9lxjnZ6UG1FTJMKHkn6VjWJI9CwK5XRWjjvLbNLqHDcVjY6SQBrh3Xa3puzuxF8dOyWpd2v8S0LVemh2C1RqBSEWN76VnmVeDv6frY4dRbZwCSNmjUlxE7F8PQbK/Maavp4y6Um4HJW38Dxn8TG1+rt5XKOT2PtjgjBn7Dut79MdWQxwNBqBx5Vyq9NmFyPCTrhtI2TPiBbCSSeFhPWlcJo3NPCnq+sKd0W1QOPKwvqrq+nGq9QPtum5GQtGdgcXa59owjrrCWV5fdt7rA5MtoKyckw3BPhZ5ivUdFM4kzAqgix/D43bPasa67bO3w+Pmo/BOjcsqOke1xhaN/C3F0HhFFhbmENAsAtY0fW1BRgF07R97qplzqw7Co9X4xot91FXYtlTkeMusi0kdKYL1FR0kLWukAt91c29f0EWxnH8rj3FfVTR0V2txIC3+pY/U+sCmdU+2MVHP5lq0XPR57n8G4SbaO7aLrCjrHWbLffyrtBWQzRAh17rjzLX1LUuIyM1YiDe31LfXROYQxiBkjKjUHDytfHu9jnsjAcF8NmRxNJ1DlKakwXsVRYRiAq4wQVU1TQG373WvTL4Y91fqSMq3SPvdVsEpIsbq3UjLlVTXljgL2WnB/qZ0perK8bi6BulhAdGCeUFpG9tkjHxYiEISDt7QITS467XTkDQT2fKExPZ8oQAOaDv9lBI8ja3dVChfwgBsTzr4Cm1nwFTtIElz5UzSHcJNoB5AIsUw7GykTHcn9U5MVfSOTYkqNzr8p0vP7qmqZtIGlOenEl2kic6WjU0ppeXMNwofdJZc3/lOieCw8qs0tCKZR1nzfuqCsboic8Ktq//ABFS4g9rKU38KjdAuYycppmss05P+DlJP0FcFermvJjnbq8ru3NV+qilANvgO64E9XLbNnN/zLmOQq1s918Fxvyziee+eVSfxk7r/WVpirnMtUWLbOechbWTC/1nutSQsElYf1XD51T29H174rgR/DHonZhAqIwbb2TI+lA6S+nur9h9I0sbv2V2paCKwJIWDL2rZ61x/Hqa+GIv6PDm3Lf6VNL0q1htpWeS08IbyOFa6yGJrrfdMVxfs4t/8MVb0ZDKbloU0fRMDBsz+lf4w29g4KopGs9z4nBSRyGvpUlxTa+GLTdBsl/8ofwqaXL9jR8n9LYbvwzYwNuFSVQi0kgBW68oz7+NUV8NcVfScVM62numUuFthNrLJ8ZjbcqxyyaJLFXo5BzWXiRT+EsMIa4C4WZ9AUbXVcZB+oLCGyl8gDStg5YU0k1TF/6lpY1jlJHB85VBVPZ2D6VaUtq4Bb6h/wA16a+maB0dDAbb6QvOP0rYRIaiA6fqC9KvTjSmKggBH0Bdfxp8yeb+qUtHRPT7i6CMW5CuUsdjqcqLptg9toPhXOsZcghdhQtxR895ktWsSnFt7Kci7QFHSt2VQI9lZetFT3TI/bHlRyO0u0hTHgqJ4LjcKtIr27bJIyS25Tg4tNwoQ+x0j9E5rg3lSr4Piv1KguJ5Ka42F0NcHC4SpR2kN1nwpQ1pHCZYeFIBYWQNb2NcwAXTU5zr3Fk1PXwikwSAWdqCNbUaha6VjPbskabi6VRh1xsSnhwJtZM0x6f/AAa5x3CY95bx4Ur/AJVE5hJukHpkZcZDYp8YsQElgOAhOS6FJQ8gWAQXF3Kazj90+Puk+MNbEELSOVG9ul1lOmv5/ZNl2hmv+kKFIhV2hF9I0KRCbokBvA/RCcGXF7o0Hyj10AjADylI0bhA+DnuhzgRYJyj0AEksJKagI73U0FpDkwQhClWhdoEjwSNglShh7pdoNoja0k7hDwBwpfbPYo9s9yk9hrbIQSOEoc4nlOcCRYJhFjZMcg2yZgBG6amNdZO1tUbs0JsVCTW3ymvfcKtZboX6JJPoHZUz8RsSCVHUz2uBdW2rqtG9yqsrWhu0XdtY0t13CIMSBfpJWPPxcMYbu2+ypR1NBFJvJ/aSOQ19D36M0lnBj1XVFOwysJb4VjHWNM6MM9zc/dXTBMThq2/Ne58qT/KTGqxNkVPSSmU6h/Sr6en0kEqq9qO2prVTT1YgKsVzjJlha0TT0jTFsOytM+uOTSArjFijHtsQoZ42ynUG7q4mmhkk9FNMHGLUEQPvEQ5VBi1M0WUZg0MssvNi9dFK3oxLrfB2V8LvgvcLnHOvpGIU05dH57LqrEaUSRkOC0nnvgjW4fNIAOCeFwHKRktmHkbj9PO7PLBoqOrlIjHdaQr6z8NV343XQfqKIhrpwRwSucscH4mqIae6425tS2Zjm9mWdLdZzUjmhsnH3Wy+js4amgkjBqLb7/EtE4cw07buduPuo6zq/8Awx4/zCLfdT4tslJEsbOzv7J7P0PfGJKpvI5cuq8oM36TFRHHJUNO35l5BZeZ2S0dW1rahwsR9S6pyMz/AKljoSKp3buu0427pdmjjz72emWH9R0lSGhkg3+6usb2TM1NcONlzZlVmvNjFPE985P6lb06Qxk4lACXLtcW32j2bFU20V+Iw+8C1Wirw877LJJoBJwAqeWjaQbgKWypTCcdowur6cbVShzmf0qmHoujfEGvZ28LIxQx6ybDZSthAFll3Yakyo6oyZhuPdE0TqGRgi+nwuQPVjlxGaed8cXY9l3PikLXU7m/ZaCz96HOM0koawG4PZZl2EofEVLalGR5W9U4bVYH1C9zGkWfzZbf9O+aE+CYlCJJLWcBuVU555TSYbWTVAprWcTey02zqZ3SWJbnTpcqEqnCQ2taZ6l5NZ1Q4nSQwvqG9h8y3zgmMQYrRtc143b2K8q8iPUWYa2KB1URuNtS7z9P+aEfUVHCDPe7R3V7Hs9ZI06X12bpqMKD4/cCZQySUs3t2PKuVE5s9M0g8hIaJnu6gO66TGsbSLy6RXwv1QB32WifVlWW6eq2OH/llbzhNog3sFz96vakRYBV/wD+MrYq0yOc9NHiF/2lHTtNilZWveBezl5GZ19Pw4djMvtAbSHhet3/AGimMkVlaAezl5P53TCoxeRxP/mn/mrkYLQqezXVHQfiAQ5SvoG040gKWklay4CZVVfxcqKcETJbRSS0V9x/zUToXgWCrRKH8lO0MPIVZ6THqBbxC4Hcbp4gvs791VyNjB2H8qJz2g7bJVMeoaQxlKTYBuyd+CJIFlVUmhzbH/kprNDuB/CH8IWkmU0eG7X+ypqinLJLBXlhBGyoKvR7trD+E3SHJJoi6epTUYvEzw8L03/7MTA2jGKJxbyWrzV6Qa043GLD/wAQdl6jf9mhE2LFKI/dv/RD6QqWj369DOGtpunKN4H/AJQ/5Lpqd/wDbuub/RLI13TdGP8A90F0dVAmE28qpZL6MfZQYqY5QGkqFjA2HY9lHiQe2QWO19kGpZBRl8h4HcrHy7Eosq2vZh+Y+Nf4ZSyPMlrNPdcn54ZwGj9yETjk91uX1LZgwYXQT6JbWae688c985fexOWFsx+Y91zFkvZsyLX20RZodYP6nnki9y+px7rFOnsoT1FUCR0BOo+FTdFVM/VWJMaN9Tl1t6fcknYrDDI+AHURy1RPG938KMq22Ybkr6ZKd5Y+ShvuPpXQ3S/prw9kDAaH6fyrbmXmSkOCwNc+BosB9K2Ph3SMEMQaGN48K/jce2/hJTQ2+jm2bI+kwyQOip7WO3wrNcvejxQTsIjtY+Fs/GOj43uJ0D+FDhvTjKR9w0DddDjYnqvhr49RknSjTDAyO3AV7keNNirPg7hFZqrKir0nnZXrI+kNl6f6xCpfG0FxKsuJ4tFTg3cNkmP42KaIm9vutX9b5hR0DH6pePuuc5C3pmddZpF3696xjgpnlsoBAPdc95j5pTUz3tbL57pmZWdUDGyMNR2P1Ln/ADAzTgq3vvNe9/qXC597TZl22su3Wmac9RrBn5J7rTnX/Wk9YXs9zk+VQ471r+Imexrza57rGMRq5K6c73uViq5++iu5bLNiEU1fVFwBNytwenTpmSbFYA9htcdlhfTHSz66cH273PhdF5AdD+xWwv8Ab8dl0GE5SSHwWzsP059ORQYdT/Bw0dlvzDqYQwhoWp8j6J1LRwxkdgtwxgCFd5xSShtmxhV7jsp686G2CpKOS8u57qfEdRFgVS0UDzLa66KqejRjHRfIIo5I7E/2o5aZjTsURRuazlDbh13m6n/KLJ6WkDIw0XJQZwDYWUdXOI2auLKzVOORwuOp1v3Vedq2VpT0+i/unGhUzqlz3W8qwTdWU4bpL/7RTdT0z3D49/F012IfG0vMkhMmn7pKhzoQC1UsFcyqeHMd3VwlhErBcJF29iKW5DsPJqG2d4U74/bNkUEHtAEJ9SbvUi+F2vsaGAi5KlaNLQE1jdTQbp4FhZWI/SRj2fKlTY+6cnEbQEXFkgYAbpUIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEmgeSlQgNjHCxsgOIFglcwk3TSLGyA+gTc3SONhdBIAuUB4JtZA716BpLglQnPA8JUyGaGONhdNJJNykcRclMc652TyvJj0rLalGH2FintN7FV57/AIOiyRCQODuEqjJ02CEISr6P02gTJmgtunoDdeymiDiUTmWfe6e2XQLKaWHSbhU0rSGElTRS0M9dsqYZWH4tSSqkZKNN+ytQxAtm0Bx2KmNWSbKG6KSLcK/6W/GYmxMLxzZYXj+KBupjuLrNsYdrhJPcLVOYuKNwyOWQm1rrBy+jpuIh7ySMf6pxOjaXe48cdytXdcDp+vDvfDNvKx7N/ORuDOleZ7AA91zBmv6wYcMc+NuIWsSPmXOZE0j2rxzjJW60bYzKoumIIJCz27/YhaXrscwrDcRL4ZGCzuxWlOuvWV/iBfGMRvcn61ruu9RklZVF/wCMO5/MsyeQonq+J4/71ro7s6BzhpqJ7I/xDbAj6luHAM76A0rSaxmw/MvL/DvUg+hAeKw7f6le6P1iyU7faGIHj86jWa4i5XiysjpxPSPGfUNS0rS1tW3/AHrCOovUNBUOd/xbf9y4MxL1eS1AI/HuP/uWPYl6ppnEn8a7/cmyzN/SnjeHP2/1O76vPil3/wCLb/uVtq8/YIzdtWP9y4KqfU9UOufxjv8Acqf/AO8pPId6t3+9VZ3qTOhp8U9Y/wCp3RifqMGk2rALf6liPUPqLlnY5orh/uXIU+fctUCBUu/3KjlzTqatjrTu3/1J0LNyI8nxNyg/1N49e+pGrpZXNbX/APyWCt9TFe+uA/H/AFfnWg8w+uqovcfdcf3WC0XXNT/iIBkPzcXWtRZ0cLyviXrv9T019Oefdbi1fBE+sJBI+peiXpy62mxOgp43S3uB3XjJ6SupZqjEac6zvbgr1b9JOLufQUoe43sFr4k9yPLOe4T/ABot6O2elJiKUPB7LIadoqiAViPRVSH0Tbnssuw0jUCF0FD6R5Rn1/jm0VLaNsLrfZNlaA8Hwp5idzdUsl/c3WnCXRzdz1IropXBgt4UnuBzbf8AVU8bxoH6J4NxdK2OhIk72QkDg7hKnL4T6/UQtBN0qVvI/VPQNI09nyhMT2fKEAI9xBsCmPBI2T38/smpjYEZYAdxulZquLX5Tiy5vdDRpTegJRxumSggEhK1xJsUkh2Isnewq+lO8m+5VNOzWQFVSbiyiZGHv3TnLaHy+EPtu0XB/ZPjY4MJsql8LWx7IYxoiOyhchkU9lqrDpdY+Va8WntTkFXTEtiSrDjUh9gg+FWul0bWFBOSNWZsVr2002k8NK4G9X2IOEU9nfmXeGa7gKKYk/QV5/er2pZonbq/Muezl7nv3gsoVOLPPXPGue6tm+L6ytW0lVI2pJK2XnHGajEZtIPzlYLh3TdVUT/Ax38Lk8ylSPqjgOVrqqRW0eJStaPsq1mOyNbynx9H4g2EOETuPCoqrAcQicWljv4XOZWM9dHp3EeQUr6yafqJ4Fif7Vuq8ckcbgqOowev1kaHfwoJcErnWux38LNljyRuy5/Hk/pJFjU2rn+1UwY3I14N+/lWuXCa2I3DHfwminq2ixa777Jrpf8ABq5mmfSZkP8A3gc4BpepG4hJO0C/9rGRHWtfYsI/ZXXCmVLrXYf3CmrqkVcnPqcfpJiLJJGk2VhrGlrjcbrKaqmkMXynhWDEKN4eSQVehVJnF8jm17ZT4XE6aoa1bnyawUS1EILO4WpenqVxq2ixW/8AI/DHOngJYfmC28OvWjyvyDkF6tI7E9L2ACKaA6O4XobkPRCKhhGn6QuHfTNhYBgJHcchd55L03t0cW30hdjxvTR82eZX+6kbp6ebojYT4VyqTqtYq34GD7TNlWVLiOF1tO9Hgua3+Rsnp224CqG2vuqelcXC5VToGm/2U8mtlRdoa9jOwChey3AUyY0XNlDIc47RTgEOFwnp7mAuJujQPJUq+CpaASBvBTxK225UKEopOJGnupRuFSNJBt5VU35QgYxjyGk38prnm+xTpBqP7pjmgKRfCCbSERc2tdCEEW9sUOI4KkaQDcqJSIfZInoe74m3CZYjkJ7PlCR/P7Jm+iWP0jc23ATbf/V09/H7poFzZOXwelsczhPj7pjRpFrpzXaeySQNaHpC0HlKDcXQmjX8G6D5CAw33TkJvqhExNDfCNDfCVCY4Dg4QhCFHYCPBPCbod4T0jiQLhPUUNb0w0gN47JiUvJFkidrQqewStaTY2SJ7PlCBRbDwEEgcoUdQbNQNb0xxkaLi6Z74/MqZz3XO/dIHOvuUyUg9iq1tTHkbkJWDWLpHiwIuopMNtjC93lRvqA3ulkdpB/RUkrnar3VScuxjeisZUAjc/yldJqaRdULXuDgqlp1C4UEttie7KeeJzjdWXGmSRsLhssjIB5Vqx+n1U7iBwFXsTX0a2YHjeOmijdqkssB6gzOjoZHXqLW+6vuZDp6aKRzL7NK5kzc6wrcNkkIeRa/dVZz9SvKxo3FHnfCZwwVvfi62LlzmrT1jmA1YO47rz2mzfq6XELOqeHd3LaOU2ebxNGx1UOR9SrSyHHsi/N2eieD4/T4hACyUG47KerhbO27VovK7NltXDGHzA3A7rcmC49BX0zJBIDceVLj8gnLTLNeSpdMqqem9qQA8KtYyJrdyFTh4k+IJtRK9rbjst2jJ90WFYVT/bYAbqnkLZBdu+yopaqd3w7qsoml8W43UlyckQ2r2fRRVsZA4Wp88KJ82FT2Z9JW5KqAFputbZv0PuYXM3TyD2XI8rjbRmZdT0eavqewidlfUEMPdcudRTyUNUduHLtz1MdNuqKqoLYyeey4+zI6UqYKhx0O5NtlxWXi+rZj2VOL2YVVdWPpmOu9YT1R11rm0CXv5Vy6sw2ugifoDu/Zatx2LERXWdq+fwqNMFFkK+m0cvMVqa+vaI5XG7hwV1/6e8AxGuNOWtcbgLk3069PyYhiUQlb9Q5Xpr6Qsp6WuipnvgB+Edl0eBPTL9D0za2SXTWI0tLCHscBtyulsvmSUsDQ/bYK19FZZ0GF0UVomggeFmNJhEdFFaMfwu1wbW4o2qdtF0jqmOsCU94D2XHhWY1T45QCe6rYMQb7dr9luwfsi0JMHMdYBObctuUhlZK6/kp5AaxOdXsQuO/hR4jq0EALD+p+nTijCx8V7jws6dTtmbc91TT4fF3CpW420VbYHHnqMyhjkw+eZtIL2PZefefnRlVhGJSujhIsT2Xr5nP0pDiOEytbHe4I4XBXqYyelqJqh8dMTueGrCyafUrpJM4/y76nq8IxtrXTOFnDuvQD0fZtNjZAyWs7DYlcJY30DW4Fipl9ktAdfhbTyNzOm6aq4onz6dNu6oxfqy9A9dujcwaKvooh+JBJb5WXUNdHWM1MP6LiTJjPgVwgiNWDuPqXVeV3VMeL0TXe4DcDutrEtfqiyvhnTHExrn/1f0csvTdW4N/8sroBpAYHeVqD1UUEdR0jVOI/8k/8l0NNrURs12jwF/7R9k0OI1g3B+L/AKrynzhnkGKSXP8A5hXrb/2m1M2HEa3bu7/qvI3OST/8WlFv/MKvV2tj633owyKZwJsU2VznG5TaYl0lipp2t8IlPaLUF3ojjc8nZTCV/wApUbTpFgE4G4uqsuydLfYPc6//AOpQkuJ7qYkEGxTE0c1tDqeZ7Duqpkxc2+yoRJZ3HdP/ABOkgAqRN6Kr+lwE5bwf6VDUT3luVKybULhUswJkuUCr4XHo6Q/47E6//mBeoP8A2btYRiVEA7u1eXHS0nt4xF93j/mvTT/s253HE6K47tTZPSDfR9B/oZr9XT9Hqdf/ACguoJXamC291yn6FWl3T1Ef/wB01dVs2YLnsqFkhm99Fl6lqWUcXuuNrDutadbZr0uE0ssRqgLfdZXnHj0OF4U55kAIae64g9QudTsLdOI6oDc/UufzZfqyjkNLaRTeqTN9lfTzxRVl7g2+JcM9bS1vUGPv0Oc4F6z/ADAzTqepamSIT6r+CqbLnoKp6ixJspgLru7BYdK9paMz/ZmX+mjLWpqq6B8lOTcjsvRn06dAMw/DoHvpgLAchaA9N+UJonQSOpSOPpXaeWXT0eH4XGAy1gugw8X20PhV2jIoqBsUYayO1h4VQyMxs3CqAGMFiopZmOIF+66GrDSXRdjUk+iM0n4k/LdU9Xhhi4YrrRBpbe6K5oLTcKx+JQLtcFHstFHHpfayXEGlkZJ8KppYWmW6TFodTC0flVPLl6wFu/1Na9e4yaWBxL7WC5hzuzMGHslH4m1r910LnKyamopHt7Argz1RdT1VE2cB5Fie64/PltMx7/hrzNTO8RzTN/G8E3+Jaax/OVs8rh+Mv+613m7mDXmvmY2U8nutS4j1xiT6i3uu3+64fP8A9jHuZ0fhnXMOI1AHvg3PlZv0zTRYkWOG91zD0F1NWuqGGRx/ldIZP4oKww6jcm191m01/sR172bmy96U1vaTD4sulslOlRHNERD28LVmUOANr2McGXNx2XTWVPS34Z8btHFuy67jqU0jQqh7G5cs8IfS00Tgy1gtgwazGBusc6OgEFIxtuyyaE2bYrs8SKribWNH1WiKsjFr2UVM5jHXFrqeqdqabK3kujcrbv18LLZdhUNtuVFNUNaCb/uqUVbWt3cAoKnEoWMu+QfqopZv6/SvZakuyl6gxhlPA4l9rBa26p6+ho5HXnA/dV+ZvWlLQU8mmYbDyuaczc1hFNI2OoGxPdVv83cjJne0zaeJZuwxyloqx/Krun8y21cjbVHP3XJNdmpVT1mls5O/YrPcuOs6uqfGS87nyrVeRsdHI77OyOh8cFc1pD1ntN/mRg8rTGTNfJVQRuefHK3NhhL4gD4WrT+yL1MvZlZC0AWUFUTruCqgHTuqSolJfYeVP6mtWhzZi0AalOx2pocqCYkWIVXSvJZY/wAqVIknHXwmaSDyn8qNSN4H6JSGXQIQhAz2YIQhA4EIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABIXAd0qY7k/qkb0NfwcHA901/zFIDY3QTc3SJ9j4iP4/dNbyP1Tn8fumt5H6pw8kAJ4CV/CRrtPZOc3UEEciAmw3UakeOR90xwANgnbZUmhD2SsJva6ROY0bOUT+jYjgTfYqRMb8wT1G1oswBIXAGxKVNfyhfSwvg0yEcn+k+OQW2O5UZaHcpWjTwpo9itfwkediT4VFVP+A6Tsql7/gIKpZG6mEKeC0NUeyxfG6tt91X6XBoJHZMZRf8Xq+6qp26Rb7JLY7jsuwSXRa8WlDYCCVpDPKrfFQTOa7sVujGyTESVpbOimdUUMzbdiudzkdVwladqOCvVL1HWU9PVFkjgQ08LzZ9QmY2Ow4lM0VL7aj3Xpj6numXzwVPwctd2XnJ6hugy+vld7f1HsuQzpOLej6W8Lw42JM55d1tj1ZUlxqXkavKu+GdQYi8jXK7+VEOlW09W5hjHzK/4T0uwkaWrmr8hpnv/GcUnUtopazHa9lPf3XDxusfl6kxdsxIqHWv5WbYl01/k6dPZWCr6XOskRqnHKin2zRs4lf8LYzqXFX8zu48pzsXxGbYyu/lV0PTDyfk/pXCi6TMjgCz+kPJi/hLj8ZB/UWEVNe7cyu/lSR1NYyxMh/lZfF0axsf/hjjwoazpZkY2b/CI2ts0lx9UV8Mdixaqjd87v5V/wACxOaQWc8qkZ06wOu5vCuWF4YyHhX6G9kVuDW460WLrhpmubrCqOAjEufqCz3q5jAdN/7WKU0MX47Vf6rraoekcNzuDXFPSOn/AEgSFmJUwc7uF6wekuQ/gaV2rsF5O+lKSOLEqffgheqXpQxaFmG0rC4cBbGI+z5/8vxoerSO3uhq61G2zr7BZzg9bqcLlar6HxEOpG2PhbAwGZz3tN10FEukj575fGSskzKXP18JkkRJ1EJ9K0FgJTp+CtOv4cHlLUmRsksALqVj3aRuoG8j9VMz5QpRlPZPH3Tk2PunKRFtvSFb8wT0xnzBPSsZEjT2fKExPZwmtbHtaGybG/2SJ7wLXsmJPRsZKSQIQi58JPxjfyIO9kj9wlSO2aU1r1HxlsYd7hMtpO6V1w7YpriSLjlRznpFjrRJI9oj3Kax12HdUrpJS/RdTR3Dd/7VaVvqM9oroocUuTx3WO420OhcCeyyqrZG+Mk/2sR6mm9tjw0qnZcmjb45+80kaezjLm0cob+Qrz79WcEkr5xq8rvvOXEGR0Eoc4X0FcAeqHEPeqZmk8krMv8A2Wj2fxxuiMZHFPWPRk+I4q8BhN3+FleWuQ1Rir2OFJe5H0rIMLwePE8aALL3f4XW3pkygoMTZA6Wkab27LLnhSsPS6vKVhV6bND4b6Uamqodf+H/AE/kWOY96VayGZzRh/H+hepeB+nzDP8ADgGYe35fyq09Q+m3C3uL/wDDW7/6VTu4mT7JsT/8l1Qs9fY8qqv0vVzZDag/+CppfTFWtaL0Hb8i9Oan014Y6Qk4a3/aqOt9NmGCO4w0f7VSlxcn/Daq/wDyJFv/AHPMDEPTZVsFvwX/AMVZaj061kb7/g//AIr0wxv04UWotbhzdj+VY1ifpup23Iw0cflVZ8VLfw3cXz2D/wDI85sQyGqod/wfH+lU0WU1TS801rf6V37i/p2pgCP8NHHhYjj3p9hhjcW4f/SI8c1/DTl5zXKOvY4lxjoOamiJMNrDwsMxrp2WNzgI/wCl2T1pkfKxjw2hP+1azx3JKcyuvQH+FNHF9TGyvLIWf+RoDpnBJPxzS6Lv4XQ2SGEFlRANH1DsrbguS0sVUHCgI38LcWU2V9VT1cJFIQLjsr9GO9nn/M+SVy2mzpX05YaWGH4O44XcWT0Omji2+kbrlLIHpB9KItcFrW7LsHK6hbDTxjT9IXR4UfRo8a8j5CORGWjZeEWEbduynq3BptZR4e1rYwR4Uk7DI65XR1WdI8ly+22S0r7jYKtZ/wCH+yo6Roa0C26q43C1jwrG9lOEtvQiaYz2Kkc3bYfqmpPXfZOnsTT8OlNIINilfqvtdAbcXddSr4I3oi0O8I0O8Kf2T90eyfugT2IA11+FVH5P2UfthuxClsLWQI3sjSObq7p7mgC4CanbRBKO2M0OSkWZYoeCeEMbvco9kMVb2Kzj90oBPARYDhAJHCHIkUH/AEcdmWTUpcTyUiTfQ9LQjXauyVAAHAQl2iRPSBCEI9kHsgStdpFrJEoaSLgJvQx9oX3B3CXWPBTdLj2ScJPZAlpD9Y8FGseCmISikhNhdNLwRZIXE7EpEACEITkxrWwQhCRvYqWhzWEG6cmXPkpzflSCeoqjqASywUiRzQ7YprYaZRPY5pOyI9zYtVYYWHkJpp2A3AUbEcNjA0ngILSBchSObbhIRcWTH8E9NFFPwbKlkJsPhVyfExxs4KJ1I0qpNNy0N9SijDnG+nhVbGEN4UkVMxmye6NoFgP4Ser0HoyBU2JR+5A5tuVPO4tNtuU9kIlju5QTj7dCShJro1ZmL0+6opJC2O/wm2y5C9QfTk8XvERGwJ7Lv/GsAp6umc18YOy5l9THQlK2kmkjhF7HsqV9LUdlK2DSPOPr+efDK95FxZ3lSZeZg1FHXsvKQA4d1ec6unnQYjOPbsA49lrCB0uH1oLHEWK53LtdUXszLrfRNnbGUecntxxNNQeB9S6Zy1zhglgiD6nsO682+gutpqINH4gi33W7MvM3aqKSKIVZtt3WFXyGrDPhyK99Hol071rSYjE0tkBv91kcFVFUjYLljKbNCSpZEH1d9xyVvzpDqymq4Gk1A48rqsDlFpI2cbMU2jMnQRGP5d0sBbGNKpocShlbZsg48pdbpDdpuulhkq2JqKSkVUv+YNlheZWHCfDpAQNwsyja/bbsrJ1jRGoo3N032VbIxvzIiuimjjDOroc19VMRCDe/ZaH6o9O9T1HKfbo+/wCRdvdVdDMxCvcJILgne4Vb01kxh9Q0OFE0+dlzubxUpLozr6G10eaHWXpFxBlO/wD/AA8nn6FoTMX02V2E1bnPobaTf5V7b4x6fsGraZ4loGcflXNHqK9NNBC6V8GGt2vw1YD4uyLM94st9nnrkx02enMWjbLHazh2Xon6RetqDDm07ZJGjYC11yZ1Zl23pbEHStpdGl21gr3ljm9N0xXMi/Eloae5VinHlUySCcH2esnTPWGH19DHJFM25A7q/wBPisdQCBwuKMk/UPNickFMa64uAd11Z0Fj8OMULZ2yaiQDyugw73HSL1WXroyiSn95+sebqKRrojYKrhPw7eFSyuL59P3XUY1vtpGhCz26JKHXI+x8q5VsZjp9QUFPAxgDmtVQdUzA1w2WtFJIkkvVbIKSYvBaUtSbW/RP/DiMXaqOrlc02KgtS0Vpr2LZ1Jg7cRpHMcBv2Wh848oYq+KZ5pgbj8q6IjDpjYjYqh6h6YpcSppGvhabt8Ln8yG9kap2zy7z9ynZhLZZm0wFgey5X6h6ln6YxlzGuLQ13len3qtywh/AzGGmG7T2Xmn6g+gayhxaWSKncPjPZYM16MsKHr9NoenbOCabEYGOqXfMB8y9IPTL1i3EMOhvNe4HdeN2T2JYjgOMRanObaQL0W9IGbBDaaCestu0blT05arGSu9T0Dp6gPpmu+y1l6lGNf0ZVEuH/gm38LMemeoabE8JililDiWDgrWnqWxCq/7r1TGk2MZWtDkFpaFndFpNHhf/ANqMC3E67x8S8hc4xfFZP/8AIV7Bf9pvAJaite8b2d/1Xj9nECMdlb29w/8ANamNl+8tIlrnuRhNID7n6Kap2F7psOhpLgUkz3PG11pwfs9F2L7BrSRZSCN2iyZH9/CqoNNt7KT8OydTSKZ0bgbJjz8KrZWstcKjnsDYeUfi6ElNEbmEjbsmEEHdS0x1GxPdVBgjNiQoX09FZz/bRHRhzgSR/KbUNIlKuNNHEG7WVFW2NRYJj/2HprQ7pthfjVO0f/nAvTn/ALN6mc3EqLSOS1eZnSjLYxC+3EgsvUf/ALMSnbW4xQseO7VXyL1U9MhnaovR77ehKEjpqjc5v/lN7fZdMYtiMVFT6ybWC579HNHFQdIUjmbWhC2Tmv1rDg2CSPdOGkNPdY2RnR9eitLKio/+zVPqnzMgocLla2otZp21LzT9ROac+I4jNBHOTdx4K3x6ss8p6qonpI63a5GxXH3UH4nqjFHPBLy56xbrVYtFSdyktEXRbqzGMXbG5pdqcF2z6WMo2YkyKaWmBuByFz/kPlK+rrYZpaQklw3IXoZ6Xcu2YdSRaqa1gOyjx8d+xFGBszLLK2HC4InCAD4R2W1sLom0FKGAbAJMJw2KlpWBsYFm+FXsY32twutw6vTWy/VQUsjzMSGqnljeH2BVSWgE6D3SRRuL7uW3CaSLcK9EmHlzB8SdXPboT2aGDlUeJPJBIPbZRyabJfVhQG8oVRUs1gj7K1YdVubUWee+yukkgcNV9lnZUdoisa12a1zlwds+GSEM+grzm9YGDOY6pa0dyvSzNivo4sHkEkjb6TyvO71Y1FPWVlQxpBu48Ljs+D20jIyEviPOnNHA55cTlAiPzHssFPRVS+XWID/C6bx/L+DF657hBe7vCuHT/p7GIwB34Am/+lcnk4zslozHQ5SOb8BwibD5mkx2tZbtyVxR8dZDGXfUFdup/T/PQucIcPIt4aqjLHLLFaLF4gaRwAfvskxuLm5D68OX07S9NVP/AIhDDdt+F2Dl50taCOTR9I7Lmj0o9KPgggEsNth2XaHReGRQULLM4auuwcJwSNGqn1LjhNB+HiaOFcLkcFNcz226mhR+8Ry5bDXoi5GXp0ybnlUtc+OJhfdJPV+225csd6n6gFPE/wDzbWHlZuTmRrWgstiolN1B1bFQOIMlrfda+65zfhw+ndpqrffUsZzQzBNI95bUW2Pdc55tZsVQieGVZ5PBWBkcoomJlZigtszfNjPBs8MoFYbnj4lzz1bmNJiVW9onJ38rAswM1cRe97TVOtfysZ6c6pnxSsAfKTc+VShzMffRivkIyl0bWwD8RiFUHAE3K39kz03UVJhDozytUZM9PsxWeIuZe9uy7CyZy5hZBC9kG9h2XS4GV+fWi/juVr2Z/lRhMuHQxtLDvZbjwxgbAD3ssW6Z6ejoKdpdHYi3ZZJTSPZ8LeF2OLPUUdHi1NLsq6mTQyypGOLn7qZ0gf8AMVGGtB25VyM1I06+kPnj2G6kh2YkA17OUjGWttspyVvoWPupm8D9FGAL7BSDYJj+kMuwPBTGk6uU93B/RRi99kxvsauiRCEJwoIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACY7k/qnpLs/8AoJGtiaGDc2TtFwBfhKA07gJUiTQvwj4QnloKQtaO6cL7IapFGl1u8oEbTEezsoywnkFSh1zuNkv+WgilXsg06Ox3TmtLlKREeQge2OECKrRGGWN7pyd/lpqZ6bJYxSYj/lKZynu+VIweQhQaJRskZsDdJfS39E99/wBkBgI3UqjoVMhLnE8bfqgsL2mym0N8lMAtwn+w727KVkf+bdMrWkD9FVSR2GpoUT2B+zx/KjttWuiWMu9mP40LxkfdaqzSo2yUcu3lbY6kYI2WYtb9d04mpJARdYWYvdPR2HAyStizi/1G4Ix1HUOc0fKV54eoTCIjVzEj6ivTL1JUjGUVQNP0G682fU08QVc4YO5XHZ0H2fV3gdcZxicsdRhlJiDg23zK59OztlsSVZOoDJVYk9pB+ZXbAaGoAGhhXJZVcvY+leMrgqUXXE5o2ssLK1yOicLkBXOowmplb8UZUX/d+Z4sIz/CxrIyiy1kRj8RQxe1yAFWUs8MZuQNlPH0nVkfDCf4STdKYi0XELk2Em3ooKcav6SvxSFrLBwsAqCsxOI3vZOlwDEmNs6J38Knk6crpTb2XfwtCqL2RyzIfNlFUVrXO+EhSUVU4tIv2UzOkcQc7/8AJ3fwrlT9F1zYrind/C1sdNFK/kYQj2zBesZn6jYrDvxskVZ83BW0upuhcQljJ/Cu4PZYWcvcTOIgOpH2LvC2aW2jgud5SEovTN0el3H5WYpBqNtx3Xpz6Vep3mGlaJNtu681cjOh6vD54JI6dwO3ZehfpXwvEIqOmkexwtblbOIvZng/lWVH1bbPQbKyu/FULHXvsFt3peO5bcdlpTIKOaSjYJmna3K350/BGwAgDhdDjwa+ng3O3xe9F7p2FrQmTuF1LYiK7QqR5cXC91pw7PPct9j2sJN1UQiw0/dQs2tcKeLm9u6sKG/pXqs0TBlxe6RPYfh3Ub3AcfsnJaei9H9kOabG6X3Psow833S7O3BRKLY710Kns+UJiez5QkEFdwf0Uac/n9kx/H7p6RBP4IXkFAeSbAJjvlKRr9IslI0myZBF9k1g2unKCZYgv4Me0cJugJzzv+iGkC91WlEsLpFMWf5t/vupHCwt9kpsXXA7JKj5P2VKaI5pIoMRqfbjvcLB+qa/4Hm/7rLMWJDHfZYH1PrIfbyqNkGa/F3KFiNH574pIymm0n6T3XAnqQxKSSrluTyV3tndh8lRTSkN+krh3P7pCqqqyTREeT2UPps9R4zklCtbZpPoH/Ox6O4Pzr0C9HuE000FPrG+y4n6C6FrYsZjd7O2vwu7/SZg1TSR092+OylhBj8/k04tbOwumOnaR2GNBb9KixrpmlNwY+yu3Sccn+GtufpCXFwXEgD91b9FOPw4CWZZXkyl7GES9LUj5LBvKiqei6Z7LCPt4WTwYdLJNsP4VyjwZxYA5v8ASj/w0n8LtfNWddmrMSy7ppCT7X9KzV+XNK4Eez28Lc9R08XA/BsfsrfVdM6nEaP6TZYS18NfG8iuj/5GisRympZdR9j+ljeLZJwVGoCm/pdGz9Jn8n9KIdGMlNzGP4Vd4K38NWPlNvr/ALHJfUXpzirGu/4Mm/8ApWD4t6VWyvJFCd/9K7sd0DTyD44R/Cgkyzo37/hm/wC1Rvjk/wCA/KZv7I4OoPSeG1AP4E/7VnPR3ps/w+aN34M7H8q62jyzoWPB/Dt/2qvo+gqSEgiBosfCFhuD+FO/nIWrcpGp8u8rv8MDAYbWt2W6ekMM/AxtbbgBS0HTMMFtEYH7K70dGILAK9RS4/Tms7NjbvRdqE/AAp38AKlpX6RsOyrIxqtdaVcNHK5H0lpmDuVO1v0hNiB4AUjWkG5VqPwoqOmOUakQl2SJ6I0/QPJRqbe1t0qevgN7BCEJRBC0E3KVCEABFxZJoHkpUIIyNK0ajZPQgF9G+390ugeSlQgkE0DyUaB5KVCAE0DyUaB5KVCAE0DyUaB5KVCAE0DyUAACwSoTZACQsBN0qE0BjhY2SKRCdECNCV3J/VInACEIQAIQNzZO0HyEANT2fKEjWkG5TkACEITGuwBCEJukwEIBFimuFjZPSO4KZ8AieO6apExzdPdQNJyGtf0UMuL3TU9nyhI/hLJJoEUVV86qIP8AwgoqjlTQ/J+6q67HDalodC4HwVov1CYdHPQSjn4St7VDT7LvuFpjO6kknppGje4KivX6lXIXWzz1z66caKyeRrPqK0BjdA+nqz8Pdde52dLvllmcWdz2XO/V/S5jqHOLPPZcZyi6Zz+ZHcGYlg9XJTkEFZv0l1RPTSsdrta3dYBilRHhRJfsFRx5iUVBs6cC33XFqSVrOWimrWdZZfZwHC2xh8wFvJW8MvfUKwlrDVt7bal5yU+dUMTwyKp4PZy2JlnnFUT1jAKl25H1LfwLOzdxHrR6idA5rMxt7GiYG/3W1sEqW1UDZAewXEnp362mrHwPfITe3ddiZe4iKvDmO1X2C7XBs6R0FE+kZU9wY1UGJhk8Zb9lVzjU0AHsqKZrid1uxSZPZLsx6fpeKpqC7R38K84Tg9PhcW1uFW01OCNZCixFzmts0KK+r9SKK2xspglu2/7LBszcuKPqGkkcYr3aeyy6COYvufKrZKf8RCQ5vLVi2072E6nL+Hnp6lslm4c2eeOAgC54XFvXs9V0vjLgCW6Xles3qT6BjxPDJSyIG4PZeanqgyyrKPEZpYoDs89lkWxUTMti4/SX085tVkeKQxunPzj6l6O+mrr0YlhcTZZQbgd15J5YTzdO4q18122fddwemnOynoYYYXVNuL/Em1TSkV4rUj0IoKuKWJrg4bhMeQ6o1DytcZfZlwY1BGGTXu3ytj4VGaxrZh3K6jBuctGxjy9tF2o2B0YKnbEDsEyFnsssQkdWNYbhdFXYpI0LFtEjorC1uyoK+kL33AVW2tY/kodIyTbwlsj7IgeikpYQ2wIT6gNLSHHYhT+2LXaqDFZHsY4N8LIyqmkLDo1Vnr0nBjlFIxrLktPZcJeofIQ1Mk07aMn4ib6V6OYphb8UuyRl7jwtX5pZOwYhQSvdTNOx3LVzuRS03sdP4eSfVfQ8/R9a6b2S3S7uFsL0/wCdMuBYtFTmo02cOStkeq3KduFRVEkUAFrnYLkShxKs6f6p0BxFpP8Aqs1xcTNuPYf05Zztx7C4Yn1Addo+pZdnxURYj0lO5pBvCSuJ/SDmlLHBTsfOeB9S6VzDzFgq+kJA6Xcw+fsrNKeyKHw8jf8AtQqQMqK3T4cvHXOaA/45Lb/86V7Bf9pjjUNbUVha699XdeQ2c1jjErrf+YVv4XU0y/U+9mvoYSSQiSMx8qanLTKdk2vNiAOV0dPcjRrlsiZz+ynZ8IBCp43jupFo1/6kw+R7tlTy83+6lTHxlxuEk10MbRHTGzlM+QjkpkUZ1W+6JxY2VRxIn/sVVHIbWuFBONU9yUURNyLp7map9+LqvLrsRy0it6Ug1YpFZv8A5gXqL/2Xrm02LUT3m27V5j9HQ3xWI/6wvRr0AdRMwespHa7WLVi589yKN0+z6C/TL1dS0PRdOPcbtAO/2WMeqbOB1Hgs4jntZh+paXyKzoZT9MQx/ij/AOEBbV9liHqQzJfi2EzMbMdwe6wLPpRm9nNGdWadXjfUksHuF13nur7kX0TN1TXxvfETqcOy1o7BqnHuri4gkGT/AKrtD0d5Te8+nc6AXNvpUMYNyHQg2zbGQ+Q7IWQSmlPIPyrrjLHpKnwGnY3RawHZUWV+W8OH4ZC4xgWaOyziSi/BMtGOAtXGgXo1l3bUxxw/MOEw17XN0gq0CWd4G6qKSKQm5vyt6lfqX4R2i4UxuSSeFUODRwqWJjtVlVPaWxXJ7Ky5+qJukiJ3zJJKYyNt9kkbvjt5Kq2EABpChdyTE2ixVsLaR3uX4Vkx/ryDCIHB0oGkdyr71aDFRPlaOy5nz2zDfgwmaZiLDyquRcnEo5MvWIueGdkQo5Y21TflPdcPZ3ddDGsSlAkvd57q9Zy53GWeSAVZ7/UtMSYlU9S4ldji7U7Zc9kx9ujJnNGU5fdOMx2taHNJ1P8AC6oye9P9NieHNeaUm4/KtTenrLmrqqmGV8JsXDey73yJ6HiosMYZYh8o5CyHiuUxa+zQnUXpKgqruFCTt+RWbCfSc2grWyNoDsfyruQ9NUM4s6Fv8Jg6Hw4nV7LP4Wpj4c4/w0K6567NKZQZWf8Ad8Rt9ki1uQt64FRmnpmtP5VFTdP01C67GgfsrjEWsYGtC2Ka3FEij2LMRo0hWnFcQbRNLiVcKmXS0uPYLBMxuomUVO8l9rA91DltKJDa22QdR5iRUTHN9wCx8rWXW+b0IZIBOOPK17mvm3HQPkBqbfEfqWgOvM+oWSSMNaefzLks6ZWsfWjYmZ+ZX4uRxbMN791oPMjqOarjfpfe9+6s2P5zwVkxH4m9/wDUrJUdVU+LtIL73+65jKkpI5vOezA+tKupfK/buougJZRiLdX5grz1Dh8VVIdLbkp/RXTr48Ta4NNtQ7KhTDdm2Y1cE5nWnpfwr8c+APF+Lru/KXpyCmw+KUsF9PhcZ+lHCyx8ALewXdmX1GY8KiNvpC9A4WtvWjreOq+GSQ0rNAt/Ce9oiUsLdLCSoan4+F3NUGkjp4LS0RGRxN0geU+OFzjdKYbG1grcFpEqZNE8gXU7H6gAAqVoPAHZVMLC1ourMWLtEjeR+qemNaTv909I/oj+g7g/omM+YJ5FxZIGWN7pjXYgqEITgBCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgATfb+6chAbACwshCQuDeUB9BxIFwmE3N0rnahayRAeoIQhAa0K1lxe6doHkpiHEN7oE2O9v7o9v7pGS3Nil17/AGQHsg9v7pdA8lIXi+ydygNoYQR2SJznCxCal7F9gQhKGEpd9djlLoQ7C6jUpYQmyfIf0TRyeyB0wJLVFLJ9uyjdIRPp7JJyXcDsmTj0Txi0WrHwJGXssB60pnGkkIb2Ww8QpnPbusR6voQ+lkaBys2+J0nEWqu2Jx76m6R3+H1BAN9BXmT6mqeqkr52hp+Y9l6veoXpmWsp52BnIPZcD59ZOT19ZKW017k/SuYzaT6W8M5mvHjFbOAZ8BqpsVcdDt3+FnvRvRM87WOMJP7LbVJ6dquSvLzRfV+VbJ6NyElpY2F9J4+lcpl0NM+hOL8jrdKXsaPZlnLK0XgP8KtosqJHkD8Ob/oujxlK2ni3pQNvCkw/LyGGb44Rb/0rEuoejRu5yFkP1ZonDMoHyAaqU/uFdhkeJGf/AJL/APFb3g6Uoqcg+03+FesJ6eoJrNMbefCq1Ufsc/lcvcltM5fqshJZX2FGf9qfR+nSaU//AJGT/wC1deUOXdBUkEQNO/hZHg2U9C4D/hW/7VsU0M5nK8gsrfcjjej9M0jrE0R/2q8UvpjkLQ38Gf8Aau2cKybpJhtSt/2q/wBDkhTEj/hB/tWrTjs5rL8v1tORwNV+lB9Uw3oXHf8AKrdF6M3yVQf/AIcefyL0fo8i6Rzg11K3/arxQ5BYfcONIzn8q1aMfZx3IeUxs/8AI4Yy09JM1HLG78E7a30LqzJLJ5+CQwwup7WtfZbn6cyWoKUgilb/ALVnHT+WkNNIx0cIAHgLaxaXFnnXPcxXkx0pFTlR0/8A4bTNGi37LbWB7aVjWBYIKKMANssnwuIst+i2a1o8v5G1WF7YLxW+6hkgGpTwf+GE4x6gSAr9S2cnfD2IGx77KWNlt0GwNrH+U+MagArm9IrQq0xzB8JCa5oJseykTHNIN0zZch0N0DyUAACwSoSqSH7Quh3hOaCBYpNZ8BK03F00YDwLXsmJ7uCmJ0SKaGSN2JA7JjW35CmIuLJNA8lOI0tAwEcoe4C9inW2uopCRcqGRZgDjcG5TWuFtymucSLojIfsSopIn0tABcon+T9kgeWusAlfdzbFVZw9iG56RaMQiMgIssWx7Cvca6w5Wazwaux5VpxShDg6w5VedWxuPa4zNHZk9IOroJB7V7tK5szMyXfiFS8/hL3Phdu430+yqY7XH28LBMcy3gqpnF0A/hMVPR1mJnSjFI426dyINHWtkNDax/Kuk8iOjhhQhaYrWsshGV8EcgLKfe/5VmXQ/SIoZGn27W+yfGvRJk5k5R+mf9OWiomxnwFXVOFicaw3lRUFGWMaAPCvUUZEI/TdTRj6swbrHJltoMEaHXLRz4Vw/wALaB8qnp9LBvskqq1kbdipfYrOycSmfhrXCwZz9lE/BgDcsU0WIWeNlUGpEgCPbYLKnH+ltdhML+Wf0m/4RC0kBgV1bE13CbLEY26kvqiSOXL/AKW3/Do27aP4TTRQC4LFUTT6XEEqllqrnY/2jSJI5G/6NOHxB1xGEfhGDbQE6Cq1us/ZSPIcfg3UTrbY55KX9CKksPlTjAAbFqfAZCN2qUtud1JCvQ1XbGQwjuFVRgWsAoWgAi3lTx2Av91YhDvsjm9sqIAQd1Koo3HkdlISQ26e1oqNAXBvJSawSLFNcS7lA2FkyQ1vQrvmuE5pJG6YNz+6eAALBSr4KKhCEoAhCEACEIQRghCEAvoIQhBICEIQAIQhAAhCEACEITZACEITQBCDsLpus+AnRAR3J/VIg7m6E4ATw1pHCa1odynjYWQAmlo7JUIQAIQhAAhCEj+ACQuaO6V3B/RRpgD9bfKXZwUdx5T2fKEjWwGuFimSOaBuU6UuDtgoZOd0xQ3IH2iRjgQACleLhMh3/ZSHgpJxWhi6ZTTMubkIjfazbp017CwSwwgt1OKpa2x46UaobLXGZeDmtgf8F1sd4sDY9ljvUmH/AImIgt5SWx3AhuXsjkHODoglkz/Z8rmLMzAG0csl47WBXd2cPS8jqSZ7Yjwey48zzwptG2Z8gsQD2XHcpW/VmPk1e0Wci5xYiaCN5jdYi6586vzBxClmeI5zye63RnfVS1FRLDHcjUeFoTqjpmurJHFkbufC4Sdclac48X/7Nj+nuvcSq6kB0zufK33krj1TPVxEyHey556X6RxOCraTC61/C6GySwh8FXEHttuFp4snFo0MetxO9vTLWzyR05DzwF3DlJVSDDYy8ngLi70rYXG+KmdtwF2/lxhgjwmMg9guw4+x9GrVszGOUSDYqOcNB3CWnZ7ZIJ7JK4t9oFp3XW479kWWmT0Ya6In7pJaP8SbBNwzV7RLuFL+LZC8hm+6uSrU4E9K3JDGYZo5apPwwYw/oiXE4wy5skZWxzMI1brNuoSWy7KtJbZhmZOCQ4lROjdGDcFcaepHJOHE2TzMorkk9l3TjOHOrPh7Fa8zDyupMWw+UmG5IO1lzuXTrsx8ivZ5G5kZeVXS2ISSRQFoa7bZMy3zMq+n69sT6ot0uHJXTfqrylhw1lQ5lPY2PZcO9ZPr8Axx7Y2kAP8ACy1+sjN9dM9GPTJnQzEHwRy1t7gd123l1jtLiWERPbKCS1ePHpgzPqaOvgbPOQARyV6R+n3NSlqsHga6paTpG2pbWFc0aOK9I6MLmOad1Z8SqXMeQ0myTB+oIcQg1RuBv90yvikkdqb4XSY9ykaEpJopTiUkbrC6qaTEXveBc7lURpHF93KppKUhwLR3WnBpoh9VvZf6U+5GDbsoKukbKSCOVNQfDEA49k8lrpee6hurUkSQS0UMeGRRm7mforZ1ZhEFRhr2iIHZZBOBtp3VLXU4npyxx7LByqVofKHRxD6ucvDiFJUCKmvseAvPLMjLGuw7qJ87KZws8nhewGd/QTcVp5miHVcHgLi7ObJKRmIPlFEbXO+lYFsGmZl0TTeQGM1XTZiEzy0NI5K2xmJnfHTdPSROrv8AyvzfZau6nwd3SMBfC0gjlaXzhzYnpsNmhfUEENItqUtMGQRWjRnrnzAjx+Wp01AdfV3Xmvm4PexKRw7vK6z9RHXzsTmm9ya9791yLmJVsqKp7gb7rcxOpFut6MJjuyQu+6hrHukeLFT1Dg0EhUzQZDchb9HbNGt9AwEbp7XG+5ThBJbYJHRlouVoQ6Jt6FBB4KmiYHN2CgYQL3KqIXtaLX/tSSSaEGiPTLwoq1p5aqloY5+okfyoK4DfSqzQnqhlAbm5VQQBJYKnow5gVRe8m6o29MgsT3sv3STdNcyT/WF2N6V+tW4PUQWmta3dcb9NTMjlaSe+63xk3j76Opi9qTxtdYGZtyMu1tM9Yckc45H4XFCKw/IPqWZdS19X1TSaGuLtS5J9O/V89SyCMyngd12Xkz05UdRRwh0ZcHEdllODbIop72WjLHJWtr8bbUPoybuG9l3l6UssxhP4cSUtrAdljGTOSbA2OZ9Ge30rpzK/ouPBTGRFawHZSV1bey7XB6Ni4JRxUlCyMMAsFPU07JTuEwPbHGB4CdFVRk2utSiK1ouJr10MGHxtGze6mjpdLPlTtbTbSp4TqZuFpQXrEni9fCh9wMltdTVMp9i4PZU+KEQyAjynGUS02yjts9UEp6EpSSdRvsVU/iWtIu5UjZGxxEk8KwdQdXQYa0ufIABfkrKsyPVkErvTsq+vcdpKPBpS+UD4fK4A9YuZLKSepZBU+bWK6Fz3zuo6PC5o4atuqx4cuBPUZ1u7qWonLJbuJPdV/wDI92Z2Tc5Ls0R1z1fiGL426OOVxu7sVtT0+9BVuPVUMk0BdqI7fdaz6W6Mq8Y6ga6SIkF45C7e9K2VEccVPI6n7Dsk9Pdmb7m4vT/k/HR0kEr6SxAG9l0v0jhjMKpRCI7CyseXHSMOG4dFaOxAHZZnFSiNlwLKxVh7eyxU3vZWQuYLOIU7quJrOVaJKuSMltlC+tkc6wK0YVOKNiqcmi5uqRI4qoijDmh1tlQYeDI4au6urWAR2CeoaJXEo8Vja2ke4DstC57YvUUtHLocdmlb9xEa4HM+y0fnt0/LV0cgjbe7T2WVyD6Kl308/fUZmBiNFJOGzOFie65BzJzlxKGrlDql3J7rsX1L5fV0hnf7R+Y9lwlnf0dX0dVOQw8nsuJzZPZStekQ4bmzVVlR8dWee5Wwui+s3VQAM97/AHXMTayvwyrIcHbFbMyo6lqamobG9xWHZByZgZUXJnRmFO/xORoG91sLoXpB01VG4Q/UN7LW+XL3VE8W17rozKzAxO+Muj7jsnY+O/yFSqhqaN++mTpo00kJdH47Ls/oynEeFxAN+lc4en/p0RmI6LbBdO9P0whoI2eGr0LhqGtHX8fXrRW6DpJAUDmkuII7qrsLWURj7m66yMdGu+ggi24SyxgcjsnsLWAbpJHhzuVLH4KiOOE32ap2NIsCEkPP7qRSJ7FCwHAQhCcAIJA5KRxsLpvzH9UAPQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCBsgTZOycmydkCr4MJA5TS4k7Eom+VRh5AsgmS2iTUfKcHC25UbSSLlLugZJaHue1ovfsoXyOcbhPfu39lE5xbsgrzkOZKGHlP93vdU9t7pzXW2KCFTKhkgI38p1x5CgDiBYJzXF3Kcvg72ZJrHcpQQdwozsns4/dOJItsVPbwExPZ8oTZD0xTwVDK4BpB8KZU9SCTYBNJE9Mo5GAy3aO6RzQeVLp3vbdRSOLXbpJSXqXYvZHVRfBYbrG+oaMSxubpWTTEGK4KslcPclLXbrNvmtaLuHY4T2aczI6GGLRvb7F737Ln7r308nEKlz3UVxc/SuzMSwiGVx1NCxLqjp6jAJEYv+iwcpb2z0PhudnRJJHG0Ppvo6N5kkoG8/lT5sr8Pw0WFO0WG2y6B6yZhuGU8jnhostCZm5oYRhE8jBUMGm/dc9kxgn2eu8NzeblRWnpGL9Q9N0FMD8LbLC+oBQYcx0gc0WVr6+z/AMMiJDatv+5ah60z+pZo3NFW23b4lh5Omei8ZlXSaTezYGJdX0schaJgLHyqnp7rmlM4vUN58rmvHs5w5znw1IOx4Kt+FZ7SU03xVVrHyqVMV7HS5EFKs7y6O6rw6fQ18w7d1tXo+pw+sazS5puvPjo71KxQSs11o/dy37lV6lKKeOL/AIxpP/qW1jpHn/NUNp9nZ/T9DR7ANaVnGB9PUs7QRGDt4WgctM4aLGQ0OqW7/db7y/6ggr2s0PBuPK16Un0zx3m3dXv1ZkNF0jDcObCP0srzRdKRNA/yAFXYUWyBtgr5SwNtcj9FsUQTR59lcjenpstFJ07Gwi0I2V7w7CI4wPgA/ZVVPTgn4QqynpyOQtaqCS2jEyMyya7ZEyjYwWACq6OEgjZSNgLhfSp4WNZzyrcI9mVZa2iaNxa0C/7KeJ12/EVSOcQbBTU7iWWJV2EWUproV3zFPbsBZRk3cns4U+hnppEjSSN0PNgkZwQkLiUwY3oRKGk7gJE9nyhN+AnsVCQOB4KVOFBRqRRPdpF7oGS76DUL2Ul2Hx/CptR13v3UrHA2JPdK3sbFaJVHL3S6nHuk+YbprWyaJBILm32RBHvypHxi9wERj4rNCb67HMDDY8BJINIIU5aDymSMCZ6PRFPbRST203turfUMDnfErnOANlRTNHhMdaGVxcXstlXSMf2Ct9VhUbhfSP4V8expJFkx1PE7lqb+M18eekWCLA4C8XYP4VwocLjhsWsCr2U0IdsxTsijaAbI9EWJWi07AwjZXKJ7PaVubIwcKQ1GltmuSSiinbH2JqqQtB0q3VEsj3WPlVL5C9nJUBic/eyaoaK89DIhdyrKZ2pwaqeOFzXcFSM1Ru1DynqBUky5xR6Bf7JZbe2bqiNY5vLioqmueWFrSVJ67QsWRYgBfYqi0FOllmcbFOghe82cP5TlX0WIDTESPg5VXQRkW1hS0tHdwLm7W5VWKZrQAG8JVWMnF7Br4tOkNUUjgTZPfDY8JDGBuR/aNa6HwTEibq2+6lDSzYpkfwu2UrbOHxIJNskjFv4UreAo42uvx2UjQQLFBDIR/P7JreB+ic/n9k1vA/RI1sjkCezj90xPZx+6kXwVfBUIQlFBRqRRoAU8/snM4/dNO52TmggboI39FQhCAX0EIQgkBCEIAEIQgAQhCABCEJsgBCEJoAhCE6IDHcn9UiV3J/VJynAOj7pyRgIvcJUACEIQAIQhAAkfx+6VI8EjZAAz5Qkl3FkrQQLFJJ2TWtsCneHNPKlg4CYd+QpIeyT1YEhAPIUMzb8eVMopATx5Sa1IBkbSDb7qRNY0g7jsnImtIP6MeBqOybIC1moJz/mKJh/lWAVL/wAgX0bBJqFiqbEKYPAJHdT0wIdupJIg8bhPnDcRsltGvcysEp5sJlvGCdJ7Lhv1QdL1EjpxBHtY2sF6FdWYS2rw97NPLVzXnRlM7GHSNZS3vfsuY5Clz2ijZV/08vesssa3EMSfqhJu89lQYf6eJ646nUQO+/wrt2o9MNTUYh7jsOuNX5Vl/TXpdbFTl0mGjj8q5G3BalspPF77PP6pyAjwmD3X0QBHfSpekun24TirWWtZy7KzqyWhwTDpHMog2zT2XJ/VcT8Exp+llgHKKFXoxVSkdb+lTEYWfh4zINgO67sy2mikwWMtN9gvLb035mvw/E4I31FrEd131kvmzS1WHQRPq27gX3W5gzcJJkkP0ZvKQEm7e6ppdYOk8KPC8ZpsQiD45AVVPa15Fl2GNbvtFlNS7KujjD6TS3khW6fVSSEvP8q50R9uEFWzFo31DrNC2a5KS0WqfVNFtrcRe42ae/YqXCp5XyAuPdR/4XI4bj+lVYfRPhcLjhMurWi7L9kXpkTZIQ4jsrbiNC18UjXAWIKu1KGmLSVBVxggghYeTRtMpXVpxOTfVT0A7FGTmOEEFp7Lz5zzyokpcQklFNaxNzp+69dMzuiYMbhkBhBu3wuP/UTkkwRTTMoux7LnrKtSMedOns4T6Lml6ZxFvxFulw7rqrILO11GYKc1pFiPqXMGb+DVfS1fIY4i3S49lj+W+bmIYZjUcDqlwAeBz91JTuBJUnFnslkpmTHjFPG0z6r27rd9DFHU0zZNOxauBfR9mdJijadstXe9u67r6RxWOqwqN/ug/AFtYlqb7LsGm9MrpsLbI3U3skpaERu+IqqdUN9r4SqeKdz32W5VZHrQ5pb6KwwHTZhTTTOtfVunt16O6hmqJG3F1ZlJaJYQJYohb4jdRzNDth/CgfWPa0uBVFFXyum3OyyshbJnHaIcf6fhxCJ4ewG48LSeb2VtJVQvLadtyD9K6AY8StsR2WO9YYDDWRG8QNwsi2jZRuq/4eaHqRy7qMGp55PaNt7bLz59SUddTPqdFwBdexvqgyxbiuGTCKl88BeZHq3yhrKFtW4UhHJ4TYVOKKv49HmVnVWz+9Lqce/dc89UzvkqHanfUulPUVgc2F1szXsIAvyuYOqam1S9oP1FamNW9oljHss8g1ykJWMDHW+6ZG8ukU5A5K2q+i6k0VUIaI7kKlrXNNwE904YLAqmml191ci2kPT0RXI4KmY7T3UQaTwEXcO5TnIGx5ncH7FBqQTZ45TNDnNJATBG4H91E2x2+iuhkYWbD+khlGu3CSlYdO4TKgtDlUsWyOUdlzwuZwkGk2+JbsyOppqytjbe9yNlofC53GdrQfqXTvpV6YqsVxWBojLrkdllZdTbKFlX7HbHpX6ErayelLWG23Zen3pJymL6amfPBfjkLlP0V5L1FVDRyOor7D6V6iemfLBmFYdTmSlta3IWa62mNhUbKy7y9pqGiYfZAs0dlnVLhMdJGAxoG3YKpw7D4aWAMYwCwUtVtCbKxXUtdl2NWo9lvqyWcHsqeEv17OT6n3CSCefumU8MxdcAqzVFDYlyobgWcq5paBZWxr3wsueUjK6Qutf+leXSHp6DGzd+x5UdM13t7u28JK5k05BbvZU888lHAXPNvus3JkRWS0Li8ghpnyXtZt1zxn9mY3AaWUtqLEA73W0+vOu4qGilYJwPh8rh/wBW+Z8vtztiq/PBXPZFun0Z91vfRqjOvP6pmrJoTWuILj9S1FTYjVdYYqNLi4OdvusI606jr8YxtzXSucC8ra3p06KqcYxGAugJu8X2UWPNSkULJNm0cnMmX11RFUNpQb230rtj0/5bjCaWHXCBYD6Vj+QeT9NHh8U0lGOAeF0L0v07TYVE1jIwLNW5jrbI19L3gtKyngbGBwrhJAHtu1W5k3tyWB2urnTSh8fPZbtNa9TSoa+Ftq4gCQBuqeKCz727q6T0mp2qyjfTBguQiaUTRr6EpCAbK5seAwD7KwyVJiks08K5UVSXxjUeyqStSkSymkPrCNJWvcxoqaWBzZh2Kz6vnYyFz3O4C0lnj19SYLA8vqALA33WRnSTKlj/AGOf/UH0zhlXBMWMFzdcP55ZX09ZJO5kAPPZdO5wZ5YfNPJTmqabkjlaknnp+sqlzGND9RXHZcPaRWnFs4p6sybqfxzjFTG1/wAqu+X+WeI0VQ0inI/Zdk0npuGOyNmbht7/AOlZRhHpGfAGvbhZG35VWhjezM62jbNMZP8ARVZ78IfD47Lq3KLo2UGImLuOyky99N8uHyxl1ARY/lW+8vsqBh7GF1La1uy0MbCaYU4/7b0Znk5graOOMFtrAdluzDGaaZv6LA+j8EbhoaDHaw8LOaGcCFrQeAu34zHUEdBjRUV0VneyZJIBtbunMIIvdI+MO7Lb9Wiy/pC5xAJSMdc3twnOYbkaUgYRw1Nb0ITtItYJUyzh2KeON0nsLtj2cJU2PunKRSHL4CEjvlTQTcbpwo9CEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIGyBMf8xT0x4N7oHRGv4/dNDNQvdPIB2KAANggkG+3biyQMPdPQgbIjc2211E9hJVSWtPZMfFc7BBXnHZT6Cl0HypSwDYhHtg8BBCoEbQQLFP0HyEvtW7FSWb4TojvVjE9nH7o0t8Iu1uycSRTQ9nP7JyjuRwUaiN7pj+j0hz+f2TSAeQkL7i90xzyCCSmv4SIRrLv3Gyo8TAjdcK4MsRdUWKNJaSAqdknEcpv6UQnBYWlW2tIY8uUxlLX2VLiLiInPWddPs08Re8lst2JVzYgbnt5WCdcdVU9FC5z5Rtfurn1njv4GJ7jJazTyubM883jh8MjRV2tfusLKta3o9F4Dh5ZNib+Fi9RGc9Ph1BOIamxF+CuAM//UVVRVs5bWu5P1LO/UTnVLWtqIm1xNye64jzk6mr8VrJi2oJuSudyLH7H0F4545OcY6QvXnqRxKSoIZVv5P1LDq/O/EMUZoE7rn7rDMSwesrajU4k3O6mw/pGoB1aSsm2yOuz1bD8asrrT0ZTFmLVuhPuyON+5KtOIZiVMchdG9w38p3/dt4iub8eFacQ6YmeSdJP7KtTOPt2Wp8Tco9lfFnBiFI9pbUO/Zy2jlD6iq+mnibLVvtqHLloXEOm6iK5LOPsmYNU1mFVTS2Rws5bVLTOa5PhZyi1o9QcgfUO+tkiArTyPqXd/p7zYgroYA+ouS0d14m5EZm1tBURN/FkWcOSu/PTDnRNqp2yV3Yd1s0HkPkPBSin0eqHRvUdPVwxvD+bd1m1JURyxhzSuX8nM0W1tPCHVV727rfXTHUbKyBumS9wO63cbtHh/NcdKmxszjDJWF9iLq5NcwnYd/CseEOMha5XiAgc+FrVI4nJ/V7KwWLbBROa4uuFIxwtyne0CL2VuC2Z0paGRsNgSnjbhOYxoFkOaL7EK3WtIYprY4CwTmc/sm/qnsb9typCT2TRIzj90wixsntBA3SSdlEyKQ1SAWFlCdQv/Sfc+Smt7YQ7Q5rdJvdKhBNhdPFBQTcKRxBNwkIuLIEaKdPi5t908ssL3SBpIuECJD0IQgfH6B3FkjdLHXuhztJtZQyO0nlKlsc/hU+4fCRzg7soGyWbcc2Sh73D/8AWneo1RbQkzQ4/uqSSMEkKqc7V2TPbLj+qVxJPRFBKwtdwmtY47H/AJK4OpQ7kJHUgaNlFKOiaMlEo2RG+5/pK5ukqoEQ72Uc0W9woZdMmU0ymkvHuEMm+kkJ0jgGm/hW+R7/AHLt4uq8rFFhZGU46iXSAiTa6q4qdpFwrRS1Ra2xVdBiDWDdH5kVJY9xV/hhe6HU7dJUJxWEC5t/KjkxmBx0g/2nq6OiF4lz70OkgBItuoX0xcbAIfXRg/MP5T4qyHVdzgnxtQ6OJavowUTiflU0VK5huQpRXUwbe4VPWY1SRcEJ6tSZNCixvSRUaywbBMdVEHc/0rPVdWUcZLdf9qKPqSlm+V4T1JNFuOLPXaL62rv3T2yCTa6s8GJsl3a5VdPUFxH9JrYk6PUuTYmmxunNbbhQwSk7KX3PsmexVl+pURcfsnKOF4dx4Ty6ztNkqZA+xH8/sm2IFgU5zSTcJGuDeU/TE+iJ7OP3TXG5unM4/dSIBUIQgASaB5KVCAEDAN7pUIQRghCEAvoIQhBICEIQAIQhAAhCEACEITZACEITQBCEJ0QELATdAYAbpUJwAhCEACEIQAIQhAAhCEACa/mychAEWgeSlZ8JACdoPkJpFjZAEijT2cfulTH/ALCjBz+yRSKMmwuifwY30NeByg/GzdK4EiwSNIHwqmluY5fBjRpOxUheALpXt03/AEURYXnYq24pwHa6I6ljahpY7uscxXomkxCW74wQfsslcwtSs02uVh5VXtIZ6psxH/7LMGBD/Ybf9FUjojDoIHRthHHhZKxxebCybM0WIss67Cg1vQrrho5o9SXQscuHTCOL6DwF5654dCz0WJTSMiIGo9l6z5l9GN6go5GaASWnsuPvUB6f3yRzTNpeSbbLnsij1k1ozLv1ejhro3qafpzGG6nloa/uupcjc83sfBCavuPqXNGcPQdX0pXyytZp0uPZWrK/MaowzF445JiNLx3RQ/WXRU/Ieu+TfX78apY7S6rgd1t+gDpomvPcLiz0k5nw18MEcktzYcldmdMYnBWUEbmG/wAN102FN9IsUyUn2y7RgBmlLHTRSO3KpquqbHGS1RYXWySSbldBVNbRajPUtFwfQRM30j9bKnlY2N3w2VQ+oJ+AqhqpxqNirb/ZF2EmyojmLBYFJLK6UKlinu633VdDCHAFZ+RWPnDZQ1eGsqoyHjkLUOdmX1PiGHSn2b/Cey3dIz22klYx1lhrMTo3RhoJIPZYWRQt9FK6tI8qvVTlDIKiofFTHk8NXJtV0jW4Jj/uFhAa++4XrRntku3GmzuFMDqJPyrjnOL0+zYZPNUMpLWJNw1UdaZSa0V3pOzHbgD4GTTgaSOSu/Mp87qSuooYRVNPwD6l5OU+M1vRGJe217m6TvuuifTznlNNVQQyVh2ttqVmiXqSVvZ6fdO40MWpWvY4G6vVPTBp1LUWQnW0GMYbAHy3JA7rcUT2Oj1tWxj2bZZgk2VAc1jLHwqGW75Nh3Tqiqa2zbp1OI5QCr/5N/C1DsinptUZsOyoY6Nwl+VXlzWNamxwxar2UFi9mSrWija18TbgbqOppvxcRB8FVtWY4xuik9uQGyh/Ht9kU600aszEy8GNUssfs6r37Lhr1mZAa8NrJfwJvpP0r05koIHtIewH9QuePV30bQVWBVcntN3jPb7JkqkmVnU0j5q/Xdl7JgGIVQEOm2rsuA+rGvZiEjXD6yvXH/tOujaanxCscyMbauy8oMyKMUmLyi3DyrVEdSHKH9MapRqm0lVNS32xsqakcBMVVVQ1t2WnH6SNMppJDp7cqO990kjHA2RwN+wUyb0Joezj90paHcqL3LcKSO5+JL7dCa0O1aW2URk+Pcd08tJN7pro7utdRfke9Dk2yqp5Ph4UExc59ip6Vthukma0v4Q1smjDaEwVzjicTLcvH/Nd+egfpCLFcTpLx3JLey4N6WpRNjMQI+sL00/7NXAI5MXoi4Dlqp3x9hjq32z2P9DeTcJwajm/C/QPpXeHQXScWDYdG0R2I+y0X6HenaRnTNE4sH/hDsuoBHHDEGMbYDhUHV2Iqooo56gxfCEsUrpm7ptc1gdc+U6g9sm19kij/CT06EfSa+ymp6QMHCm0AOsngAcKWtaIfxot2IRua27VSwRvc/ccq8z0zJY1DFQtYblWWJ6IhLNLRssa68xZuHYe95IFgVl0sUft6jYWC0r6iOs6bBsJnDZLEA91k5XRBbW0jSeeOcEGGmaN1U0WBG7lxbn3mNF1HUSRRzh2ongq4+qbOSoGI1EcNU62o8OXPOF9R4j1LjIjc9zru7lc1kv1Zl3Q0X7p7oSfHsWZI2EnU7sF2J6UsohTy08ktORu3kLX/p5yudiRgnlp73sdwu1Mj8txhrIJBBa1uyZif7lGUTbuW3S8OGYSwBljYdlk+kxvICjweFtNStiA7Ks9n3Be39Lq8SO9aHRitbRA06pBdXWhZZgVsEbo5bkd1caacMbYhbME1EuUfeysIB5VPW2DCAg1YCSQ++1Vb56NKDSLPPE4y3+6mjqhAwF5VRNSNB1ELEuv+pWYFRPeXWssqdv7aI7JFR1x1lBhmGyu9wAhpPK4j9Wecj2Rzsiqdxfhy2BnVn3HTU88H4o7AjlcVZ55hS9TVUsccxdqv3VDIeyDfszU3W2ZGJYtj7o21DiC88H7rdnpiwGfqCth94E6iOVpfpnLOtx3GWTiIm778Ls70kZUz4fNTOkg4IvdqwrK/aQ9R2dF5UZI0dRhsUz6a+w7LaWGZMYSGAOpwLD8qyHLbBI6HBo2FgBDR2WVMhDDtbhaGLiRkux8cVPtmE0eVeGUrgWQD+FeaPpClpgNDB/Cv22q1hypY2tJ4WvViR2PjRFPotDsOFOPhFrKroy5oA+yrZaYPHCY2k0C9lvYdeixCLj0VMDho3SmSx3VOHujFk105PCuyj2OKguF90XB4KpPxBJ2upIpTe338qvJDW/+FVrHgpVGDcXTmvFt00EySPunJkbgeO6epESr4I/5Smt5H6pXOFiE0bG6kFJEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEISax4KA0KkLQ7lKDcXQgPg32/ugssL3TkO4P6ID2I0IQgN7BFx4QhAeohAPKcxo4SC/dK02KBPQUs32R7f3R7g7BHuDuEBpAWAC91G/n9k8uJPKilbd3Kcti+o4PNrkJHPuLWSbWslDCRdK0hyXQhNhdMLi7lSe2fsgR/oo38F0gjsDa/ZU2JD4SEplMUqjrKgSCyz7YgoSLU6H479lQ42/wBqlfZXOZwYbqydSVIFI83WfYto2sGDc4ml86uoHUFFM8OtZh7rz+9Uubz6F87BU+drrtb1I4oY8MqNJ+gry29XuOz/AIuoAkPJ7rnMvts+gfDcOElHZpHM/Nd2JVssbqi93HutZ4lVR4rMXuN7qw9TYnVz4q/4z8/n7qowp1SXNJJ/dc3kya6Pp/xnDpUF0VjMBpS4Pcwb/ZVjMOpI2Wa0bDwqWtrp6aLhWtvUspl0l3B8rHtls9TxqaHXpl+dSU+i1hwoThNLIfkCtYxuWR2xVXDiM1tRSUr9iPIxsaKKfGOnqZ0RLWBYTjOEx082zeCs5r8Tf7RDvCw/H5JpXlzWrdx02cryNeP6sk6R6m/wSsaddrELqv05ZxiCeBpqAOPqXFVYKr3dbbjdbCyl60q8IrodUpFiO63MZNs8k8hx6pQk9Hsb6dc2PxzadoqAb27rtXKDGnYlSxuL73AXkf6S80nyy0rHTn5h9S9PfTB1CMToISH32HddBjR6PnTyrGjFy0dOYC3TG0u8BXPVaxHZW/BQXUzXAfSqxx0mxWrBeqPGcvubKuCa5FyP5VXG4kK1xTAbK4U8rTEFYrMi1eqJhbuluPCjLye6A8jndXop6KTs7Hp8ZsLqIOuVKz5QlaJa7GyRp1C9kP4/dI1wAsU3dRtFldiONhdN1u8pXuG7U1JpD0tFQkcCRYJUJvsxhGQQbFCV/wAxSJ67HaQ67C2328JtgOAhCdpINJAkde2yVCRLZG5eozS472UUoJ7KZziDYJhbq/VPSSEVnZCwm/Kla4AblIYw3cJE/posxe0Psz7JQByAo0usjumsVkg5umyvDtgoJqvQdKY2oLhuopyWhIrbJZqiNjLd1STVLACbqCskcXc91R1E5Y0jUqFtmkXqqE0Pnqg51tW3hU75WA3JVtqsREJJJVrxHqZkDSdY27rNtv2auPgznrRkZmaLua7ZRS4q2L/zf7WIydfU0bHB0rf5VgxbM6kidb8Q3+VTnmKBp08NkWS16mwKrqSKIG8w2Vsqut6eIkCoF/1Wq+oM3aKOIkVTb/8AqWC4/nZDBqkbVt2v9SrPkWpHRYfitlv+yOg5MxIWk3qR/KR2adHHt+LH+5cnYj6i2MLm/i2/7ljmI+pQscdNaOfzKxDkTch4MprtHZldnDR08Rc6tbYDysQ6j9Q2HQXAxBo7fMuO+q/VO6Gnc38cBt+daa619Wkjah1sSHJ+tS/52+xs/DVT8id/D1D0k1RpdiA3P5llPTGa0eJOaYqoEHwV5g9P+qaSvrmM/wARHP5l0vkRnA/FYoT+J1Xt9Ss1Z++jPyPHY1QbaO7emuovxrW/5l72WZ4fI0sa4laPys6idWRMcXeO63HhFR7sDTfsFoVXe5wvJ4v4X0ZDTSMLbDlS3HlUlAy/xX5CqX7uAUz7Wzm5rbJ4rAW+ylbY88qKEfBdPSKWmVmtMkTNLj2T+/7IVmPwbvvRGQQbFPZx+6CwE3QAALBOFFQhCABCEIAEIQgjBCEIBfQQhCCQEIQgAQhCABCEIAEIQmyAEIQmgCEITogCEITgBCEIAEIQgAQhCABCEjjpF0AKhND9+E64PBQAEgcpjjc3Cc/j91EXkG1kAO16drqRUz5DqBAU8bi4b+EmlvYDkzQTynoTZd9BpEZIbymAjXe6Kj/qmNfazVF6d7AmkcH/AClETHB1yNk2PbdTJ/tpaF2QztBBsP6VDP7rQQ1XCXa6ic0O2sqs6VN7YhQ0s0jD8aDUvfLYFVE1Kew4VPGwMkueyhup3Ae0nEJ4RK0tc3t3WuM3OiafE8MkLKYEkeFsyQg8K0dSUIq6NzSL7LncvGT2zOyIe0TzI9XGVk8BqJWUthc9lx3U4dV4DjjnaXNDXr1S9S+XX+MwTsZTXvfsuEc6cpKjCKuacUpFiTwsr8ThIxLG4mdelLNn/CKiFk9XpsRe5XoDlDnPQYhQwxfjGklo7rx96X6urOkMTt7hbpK6byA9RE34mCB1b4+paFFriNhdJM9PcLxaPF4g9slwfCvNJTxtF2N3WlMicx249h8I9wG4Hdbqw1+tgcfC3MS9ykaWLZ7vslqA6MbqhnD5idG6uVZH7kRACgpaYtuXBa6sNqqKRR08b2OBcO6ucEnttu47KlrAWO2Ca6oJitdLKKmiy4porap/uxfAeVbRTayWytv+qkgqnatHKrG03ut1O2VC/HTZTtg2zD+puiKXE4X3gBv9lzv6hMpqJuHzvFIPlO9l1lVs9uJ2y09nlhpraCZun6Csi6lRKv8Ajts8pPUD0VPh+ITPp4SLOPAWHZOdV4ngXUMbJpnNAf3XT+fuX7KipmcYu57LnDGemTgeImoYzTZ3hVo6iyeGLpHfHpjzwpoKSnikrRsByV1X03m7h9dRNP4tpJH5l5H5Z5tVmAVUcTakgAjuulsss+a+rjjjNUTsPqVyqzTJVQ1I7mm63gnfqZMP5VRh3W0UbrOl/tc/9KZg1OIQtc6Unbyr7U9YywQ6zJvbytGFraL1WOzd9T15RtZf3x/KoRmPRxuJNQP5XPuKZo1MQLffP8qxVWbFXqIE5/lS+yL0cTa1o6SxXM+jsbVI/lGD5nUl9JqR/K5brc1Kw7mc/wApMPzZq2S/+N/aNpBLBf8ATsPDuvqGSMvkqG/uVpH1V5hYYMEqmCZv/hnusKp846iKk+KoI28rSXqRzZmrMMqWfiSbsPdV7LNSIJYL0eb/AP2l2O0uIVdWY3A7O4Xktm45n+LykD/zDb+V6U+ubGpcTnqjrJ1B3debmaWHudikjyPrKs0T/ZbK8sVxXRhFFYzfErjK1rmWYLqkjgETyVMKgBtr/wBLSU+yrKEokU0Oobc/qoZIHNaSqphubhNqhduyf+Toi1LZRNaDe4TgS3hDW3dsOVK+DSExz7F02RiQ3tcIcDe9lNDStJ1EqX8Mw7I2t7J66G1sjie9rUBxL7lPfFpHwprI3Pdax/hDsSRZVTRWdNSOhxiF4/8AzgXph/2b/ULKbFKMudwWrzY6ZwapqMRj0Rn5geF3/wCguCuw3EaV7tQtpUE5potwxZSj2j6HPRX1/SRdN0bTKAfaHf7Lpg9Z0j6ETCYbrzq9J3Xk9BgtK0zHaMd10xR5lyzYWG++TYeVWm0iaPH+xtzFcyaNkxYagfynYR15E93uGcWv5XPGN9dTfi7ic8+VX4ZmJJFTAe7vbyoXJ/0dLA0joirzBp4m6zUC1vKpGZu4c2T2zUtvfyuesbzRqGUxHvnjysMkzSq/x9/xB58ojPRRlierO0MN68o65ups4IP3VTUdV08cer3hxflc09DZnVEsLQ6a+35lf8bzQlp6M3l7eUsrpFWVL2bK6wzZpcKpXWqgLA91yN6pM8I6ukqIWVoJN+HK1Z8eoSXCo5GNrALX+pcmZmZ0zdRVL4zU31O8qhfP3IJVSkYFm9X1vU2Mylj3ODndlfchsp58SxSKWWmJ+IchVvQfRp6trWyOj1aneF1d6fMimU8sUv4Tx9KyL6lJlKzGZtP035PxU9FAX0f0jsun+l+kqbC6JgbCAQFY8pehosLoIg6K1mjsth/hvbjDGBGJjr32VHib+lqLval0jsrjRAPYCfCp6qjIdq0qfDyGuDSF0VC9NEaxlFkskEYN3AKOVur/AML+lUTtaW7JlPZtwSrruaQ+MFFlKXmI/GbfqqumlY9uxTKym91t28qJrhRwl7zwFm5F+2WYrRUVZa2MkHa3daG9R/VseF4XOXT2sCtndV9fU2G07gZG7A91yJ6sc1IZ6CojjqG8H6lmWW7ltDLP2Zy76hM3yyvnjZWGxcRa609gWKVHVuLBrCX6nKkzcxWoxrGZGseTqf2Ky/039AVFdikT3xk3cOyhlL26I1H/AIb79P2SMmKmGZ9Fe9jwuycmcpGYE2GR1IBa3ZWD0zZatpqGF8lP9I7LpPCem6alpmaYwCB4S14n5GTQg2S4NDDS0jY2gCyq2uJdYFQCD2XaVUwgWutjHxVFFmMdoRx08p8LydgmSi6SF+k3stKFCRIoIr49xY7pXW0m6jhfflSkahYK5CPohXEp5WFx2ChMLwq0Rkb2P8JHRgixTvbb0NcS3mF+q4BVREzT8wUpjF7AJPbtyf6SuCYz1Q+MAlDrXNkjXBnKeQCL27KN1aQwVuwFk5jiTYpjb23T2c/sm70yaP8AqI5rrk2RpPhPQpE9jgQhCUAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEzQ7wnoQAjQQLFKhCRvQASByk1NPdD+P3TE32Ynqh3+WmpWt1C907QPJSp7BLQxCfoHkprgAbBOHezGPuOClbe26VCd6jXMVum3xIdp+lIhHqN90BJA2TbOduU5CX4g92xoYO6cB2CEouN7KNyY5SbDS4dkn0nz2Sue6x37JE1tscntlFUxuMl7dlR1Jc0kK4zFUdXDqNyFVmu9lqL6LVVSE7LH+qJiKR5vtur5ip9nhYr1dV6aGQ/ZZl8WtnQcZD2sic2ep3E2R4bUN1b6CvLX1WmpqsRna25u4r0r9TVU6annsfpK86/URQtnxGW7b3cVgZVez6C8SlCuMTkk9GVdXiZe6Im7lmvTmU9XVtbIKR1v0WddG9CMxWvawQ3u/wukMr8gI66gY51IdwPpWDfi+zPduN5qrEqT2cg45k/VOgOmkdt9lhdXlJXRVFhSO58L0gq/TBBJA4mjO/HwrFsQ9KsAn1CiPP5VmXYekaq82hW9KRwlQZS17nAupHceFfIcpKz2rmkd/C7UovS7E0/8A5Cf9qr3emiKJm9Edh+VV6qZJjbfNYz/8jg6syhr5HECkdb9FQVeSlbIDejd/C7xd6b4i+34I89mp/wD92JsjTahPH5Ft41bRh5flEZp9nnF1Jk7W0MbpBRuAH2WK0tBNg2JNa9pbY916F5r+m/8AAYdI5lER8J+lcj5pZZOwfFXEwltneFsUdM4TmOd/JF6NmelDqqWLEaVhlPzjuvXP0V406rw+n/zL3DV41+nMOosagjBO0gXrn6Faxz8Pprns1bmPPpHi3kOZ+bezvvpgsdRMJ50Kpq43OIIVt6We40MZv9IV50/5Woha3vuCPH8r9bWyjjjfr4VzpmkNFwqena3Vwq9sY0qzW/hkWva7GjcXS6T4Stj3AT3N08K7CXRRdb+jBG6//wChTNabWQABsErXW2sllJk1deuw0uPZIpFGo2yyn6jHAl1gjQ7wpGfME9InsX22CEITBBj/AJkiksDyEWHgJ6+C7YxrSd0r7DYBKXBuwCje/wApyGSmkKSALlRk73ugknclJrb5T0tEE57FTmckJgIduEoJHlA2El7CEXt+qbNsL/ZPTZLGwKN6NCtkPa6Qm1tu6lsPCT2SQLhMkxbH0RPpvdOoBMdAYxYhV0VmNt9lR10uh2xVe2TUdkEbGpFFWRG2rhWvEJNAIPhXeskBgJWM49XCGN51cBZF1j0dBgxlY0jFus+oI8MjdI59rLSuYme9FhLZGOqrEf6lfs8+tRhtDI737fCe64H9Red89DNUaK8ixP1LEyMhRPUuA4Z2a2jevWPq6oMML2fj7bfmWr+qPW3RNkdbE/8A5rg3OD1IYnHVStZiTuTw5aVx31D41UznTiDyL/mWRdlHqPG+MK1r9T0oxz1p087CBiXP+tYxi3q1hq4nMFedx+dedb878am2/Gv/AJVVRZt4rK0F1W/+VQllPZ3mB4pFa/U7axT1JB7nObWnf/UrHUeoJ07nEVh/3rkWXM3Epnb1Tv5VdhnW1dON53H91LDNSOnp8Wj6dxOgOt88Kh9M8tqnfL+ZaS6wzlrJZ3n8U7n8ys3VPUlY+jcfdPC1Vj2MVck77yHnyp1mdGTn+Owri+jfOV+Z1ZWYxGDUu3d3cvQH0i9RVFaym1SE3t3XlXk9i07MbiBefmH/ADXpP6LcYcWUd3dwrmPlqTPMOd4r8aekemeSszjRxuJ5st7YDV2hbv2XPWSNd7lBFZ3hb36ck9xjbnsumw7vZbR4b5DiuMnszTDqguYCq1rtW58q3YVp0AOKr3G2wWsu4nA2rUiqhd9KlDCRcFQU++6qW8BKolKf0VRqRRqeD6GD2fKEqRhFgLpU8AQhBIG5QAISa2+UqABCEIIwQhCAX0EIQgkBCEIAEIQgAQhCABCEJsgBCEJoAhCE6IAhCE4AQhCABCEIAEIQgATJvlT0yb5UAQl4BTonF5soyDc7KSAEG5CAJ1BUG11Oo52Nd27IApmvFxcd1UwvBGypXNIdYBVNOCG7hAEqRzgNvslTXtJOwQBS1LtN1HEdRupqiMkbjuomNLXWATPVgVkPypxIAuU2H5U5/H7o9QIpHhx28pYuf3UTnEOO6Vklhyl9QJakhsRNlapXEy7Dv5Vx1iUaVT/gyZT8KSdf6ip6KWWodGd1HJOyeMg+N1VV1AdBICoqemcHFtli5NDK1y2ujX+YXSUOJNlJiBuPC5S9SGVMD6Sd8dKL6T9K7nrsFjqmOD2crVmc+U7cWw6ZzKa/wHgLGsx2jHuqaW9HjhnX0zPgOJSvjjLbOPAVpyl67rMLxuJhlI0vA5XTHqsyLq4qmZ8VEfmPDVy4eisR6exf3HQubpf3Cg9fVme00z0e9ImbTXU1M2WY9u67R6R61pMSo2FrxctC8n/TjmG/BHwxy1OmxHJXcOS+aYxKKKNlYDsO6uYtjUyzjz1JM6rhqWTxAg9k9kjGiyx7pKvfXUbH673ar2Innjut2uxs3abXJEGJVDBuVRGoDhYFVGI0UrhwVSNoZbi7SrsDShL2RW0DA5we5XVj2aAB44VmgEkAF9iE9+IiEajJZNsj0S/hc+0XOpZHJERbsteZr4bB/hk0jx9JWQYl1tQ0DHGaqaLeStTZz5y4VHhs0Mdaz5D3WJkpfwtY+BZKXaOXPUHWUVHPNe3dcl5kY3Ty1EjIiL6j3W6fUH15/idVM2Ca9yeCufq7B63F60u0EguWRa9M0Xx2v4UXSdBV12JNLAbF3K6IyowSspxG54d2WE5V5byOmjlfB37hdC9FdF/h4WWjtsOyK7UhI8e2zPegnugpWBw7K94tXPczSOLKgwKh/CRAHawVRiBYW3Dlfqt2i9TgP/hjGNiZziW3VlFFUSuJAP7LK5aL8W+1lVUPTYcAS0G6sxtNarj3/wANf4lhlS0atJVBS09Q2oAF9lsvFumm+3tGFZ4emwJySxO/KTf/ABr/AOFkqKGrnorRA8LTmd/T+Jy0EzS127Sum8P6fibBaRossJzV6Ip66jl0xA3b4UUpJvZDLjnr4eR3qw6HrZn1BdETyuA84ui6ilrJX+19R7L2T9TOTP4xszm0l7g9l5+Z/wCR88U81qE7OPZTQtSKF3HP/hwliNDLBO5pHBVIYnA73W0uvcuZ8PqZLUpFieywWtwOaneQ6I7LQryE1pmXdxk/qRbaaO53TqqP4dP2VVHT+0eLIlia8fEpPy76Kr49pFrhg+NTyRFo3VS2mANx/wAlI6APba39pXPfY2OC0/hQMY4cFSMY4nlVjaTwFUUWFyVMoY1l7nso5WpIu14E2+iHD8JlrHaWtusu6PypxDF6tgbATc+FlGWOWFRiszP+EJvbsurMg/TdJW1EDpMOO9uWqL83/DVq41v+GoMq/S3iFfUwvNDe7h9K7k9MHpurcDfBL+D02t9K2hkf6XaRnsPkw1vI5aur8usi8PwqnjLaJoIA+lNduzShxj18G5J9MVuEUEMehws0BbswhlSKINJPCoenOkIMPgYGxAWCyigpI2RBptsonYTrjWv4Yri9DUPm1b8plOJ4o9O/CybEaSIkm39q2T07ALC3Ki/INnx718Mcx0zyRFrb3ssahweskqtZaeVsRuDsqxdwVZQ9Iwl19ATZT6My7j5Fs6JhqKZoa8EWU2YmOPosMe4Ej4Cr9BhDKBpIACwjNuQvw6RkbvpPCjdpmz49p/DkT1Idb1Us0zGyHa/dc5nqSqnxUNe82L+5W+c7enKyvq5bMJuStLy9FVNLXiZ8JFnXUTlsjfGt/wAOkPS4+nqXQOmA3cOV6CZBYXh01PFZreAvNfIrqWLp+SFkkmmxHddxenjOTDohEx9Y0Gw5KjdfsRy4uT/h2rgOHxU9Gz22/T2Vx9hp5WFdH5i4fiVHGWVTTdo7rLqLEYqqIPZIDdWaaYx7MbJxLKX+y6IMUe2FtiOyttLWn3u25VZisElSToN/0VLQ4RKJNRBVtdGZPHKw1YcN+4SRvL3XCf8AgXNFiFLT0gA+IJk56WiBVPeh8VnM3WN5g45HhGGSyF1rNKyGeRlJGXSPAAWkvUj1/BhuE1DY6kCzDwVm5FnWh0lqJpDPj1BxYKZYzWWsCPmXGmcefLupamSmjqy7USLalS+rDNmudX1DIKt3J4K556TxPFupceayRz3B0ipOWytY9G0um+j6vqzEmzNjLtTl1x6XMk5aeaCaWl+ofSsS9J+TLsc/DOmpL3I5C7yylyWgwOkik/BgWA+lWKIew2DbM3yk6Xp8HwyNpiAIYLCyzqRzWRbBW6hw4UNKI4mW2VSGySR6T3WrRD1Rci9LRRVtbeaw7Kvw4e5Hcqjdhkj5g43/AIVzpqf2YgAFpVV6RJEZURm1gomxuaqwxa+QnNpgRurahpEhDAwk3VQz4bXQIhHuAkLhYi6G9gOdO1psQj3A8bKiqZrPtyiGZwN/shfRdMrE1zS4pGSg904vbbYqZLQ1rZG8E8KRnyhMT28BJLWhPUVOZz+yGtBG4ShoHAUWuxwP+UpreR+qc/5Smt5H6pyWgHoQhKAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhNl8AR/H7prPmCc/j901psbpjegHoSax4KNY8FJ7AKmv5/ZDni2xTHusLk9k+MwFQdhdM1uPdBcTtdSRktEUvg7WPBRrHgpiE72QwkG4uhR3PlPYSRukb2SIVKXXbpskQmipAgmwuhRucSd/+SRrZIvpE8l0lwOFFUEWv9lUmPa4VDXyaAQmShtFmvTZZccbudlh/VkD5KOQAdll9Y4yH4lZ8dpGPpH2b2VG2nZ0PHTULEzj/ANS2HSw0k7yPpK87M/aoNxiSNw+or0+9T+DsdhNQ4M+gry/9SNOYccms3h5/5rGvxtnrvC5rqgnsTIihp8QxWJrmj5wu/MicuKaswWFwhG7R2Xnv6f8AF20mNw63fWOV6aelzG6GrwWnjc5vyhZs8dKXZu5nP2wx2osyY5SwuhP/AA7ePCsuIZRQtff8O3n8q37h2G0dXT3Y0HYWVNWdIslfcQjnwq92LGf8OPr8qyYT1JmiIMpoGi4pm/7U2syqhLT/AMO3+FveHo2Mcwf0qbEekGNaQ2Lt4VdYCT+Fn/8Abrf/APY0FDlPC+e5p28/lV2pMpKUC34VvHhbUi6YbHJcwd1O+hpqVpLmgbKzDHSfZKvJcixfqzmzOnJikfgskgpW/Key83fVb0E3CsVnDIbWcey9d8267Dm4LLG9zfkK81/V7hNNiGK1BgYDdx4ClUVF6RdWdZkU7n9OZMkqSWHqWJtuJgvWn0F0kjsOprjs1eaGT3RMo6jjeKc/+KP+a9T/AEN4SaPD6fVHa4C0MeSOM5qTezt/pKl00EYPZg7q7TsDYrBUXTNvwLP/AEhVlVJZu5WxW9xPMsiTlcxtHyf1VwG7P2VspXEvs26uTDZgurkP4UJrsGNNw5OOwukb9jskeSOFch8KzX/RQ4E2SqMEg3Ce0ki5SyJYrQ9rgBYpqEJj+Dn8FZ8wT0xnzBPSR+CR+Akc4tNrJUx/zIaSF2L7n2RrPgJjjYJiTbGOQ9z9/umOPJSF4BsmuNzcI9mRSYF5OyGtvsSkSg2N1JGWyF7F3adPlPa25UZu/cBSsNjbypHoI/7AWbJj2jkqVI5gd2CZL4XK56IFI0g3uUCMgW0pS0gXIUEmWJdoaXAGxVHiNtneVUPF5FT4nESwEdlUulqJWjFuZa8UqRDSkkrXfWnUTYWSNa/6VmHVNSYqRwvwFpHM/qF1GyV7n7AFYeRZ0ejeNcf/AJNsTRfqn6/dSYfKBLbY915l+pbMurnq6hjZdtR7rtj1UdVuxCknbHJwDwV5w5+4m6TEp4yD85XN5trT6PpTxvx/ajpGjMwMcrsVxCRocTcrH6XpXEax3ue2TdZM+hiqcSL3ja/dZl03huHCFuprVz918kz2bhvH9a2jWEnSFbTjU+E/wqmiwSpY3eOw/RbZxPAsPlhuxreFZ5cIpmgsa0D9lnzyJvo7vH4SMO9GFQYTM42Db/sr1hOGzxkam/0rgaKCjfqdZV1BNSnghLHIaL7wYwi1os+PUEslIQW9lrrHMJkZK86DudltzGJ6cQEEjhYRjEMEznEWUscpxls5Hl8WLTWimynpHtxqLULfEF6IekCqFK2lt20rgrLyhZFirHN23C7a9LmKCmdTMLu42Wji5Dc9o8f8gw0oNnpxkJjIko4ml3YLpDpGpD4mH7Bchen/ABe8EIDvC6vy/eamCPf6d123GTbPnTy2mMW2bEwxxLAQq5jiTuqLCo/bibdVz5AflC6qvtI8mv8A92VVK6/ZVbeB+ioqbgKqY4Bu6c/pmP6PTGgE2KcCCLhKli9MBnyvsE9MPxOsEFpbypl8EF1nwEheSLJpIAuUmseEAOUiiYdRtZSoAEIQgjBCEIBfQQhCCQEIQgAQhCABCEIAEIQmyAEIQmgCEITogCEITgBCEIAEIQgAQhCABNlF2pyEAQ6B5ShobwpU1zSTcIAGuJNikeLkhLoPkJWiwsgCL2QTqspWtDeEqEACEIQBDMLm33SNhBAIBUzm6v2QSGN3QAkbdLbFKQCLFI2UONgErnaeyAIJmBpKhleWNuqmQa1SVPwjQU+CTYj+DqGQveQVWhosDZWqlqW0zyXd1I7GqZpBLwP3SzTIosr526oz+io4ogHmypavq6giYWl448q2DrjDopdTpR/KoXx2S69i+zROa24srdjNA2uonxPjvdtuFSVGYOE+1tIPvuoI8wMKlBj1j+Vl2pPpla+KaaZzx6g8oKXFGSyupgbk/SuI8+Mp4MCdNO2nDbE9l6bZhuw7GKRzmkcFcZ+qrpuB9FUCNovvwFj2xaZhzrcWcSUvWk3TWJezFJYtf5XUnpUzmqKisghnm2uBu5ce5mYbJhOLyVBBsH7LNPTtmWygxaFnuFuhwvum0b/IJTD9z2gyW6jZi+GROa4EFg7rY8Zvbhcf+mLPrDo6KCnmqbnQPqXRWHZs4RVRscJxvbut6mTitG7RBrozmRjXtII7KnfExt7BWeHrnDqll2TD+VR1vXFBTtc50w/laNVkf6a9ONZL4V2N17aMOdcbfdayzFzbhwCB/wDnNFge6oc0c7MLwyORv4kAhp+pce+o/wBTNJBDK2Ou7H6ky+5a0jqcDjJSitrszPOn1gNwdszW1zRa/wBa5j699ZcuM1clMMRBubfOucfUB6h6rEZpm09Y43ceHLSeBdeYzjGOAGSQgv8AKw8m1fDqMbievh2dB1lJ1lUB5l1aj5WddH9BitLX+zfvwtN5CU9RW+yZr7kXuuuegsHo6DDo55APlCxLpbZcs4p63oXo/pZmEMYXRWt5C2BguKQU8dvCsFViVG2C0ZA2Vrf1E2mkNpP7TIyIY8W9/DYFX1cyBpDSOFQO6vfMbatv1WCzY6+rdYP/ALVVRVpLQ2+9uVbhNov08XrXRnNB1EwuBv8A2r/QdQx6BuOPK1tS1LofiLv3KqR1O2mFvct+6sqzo16OMf8Awz7EcfY9lgrT/jkTJNR/5rEn9YMkNvc/tQzY17u7JLp/5Oyx/wDGP/hnberIQ0N1BUmMV8OIU7mE8hYNJi8odcPP8qroccLvhc83smu1JEEuLf8AwwbNnoamxeOQe0DcHsuSM8fT5DiDJpGUhO54au7MUp4q6O7rHZa+666Jo6umfqjaeeQm/wCQkVZ8Tv8Ah5GZzenL2J53CkPJ+lc6df5SOwuR94COey9Xc7cqqSSWdzYGnnsuO898sWU80pZELAHslWVp/SnZw7+6OFMa6ffRSkaCN1bTRHwts5jdKfhJHAM4J7LA5cLewkFv9K7Vlpoz7eGe9pFgNGb3snto79ld34YedPCnosIdUP0tb+1lP/krRXjw8vb4WyhwiSpkDAw797LYeXeWD8TqYyYibuHZP6L6NfVVMbDDe58LpHI/KcyzxF0A3cOypzydy0alHD6Xwyv04+nltbLCXUh7fSu7MjvTrS4fDBKaO1gD8qxf015W09I2F7oG7Adl190NgVHQUMbdDQQ3whXf8NWjiH/wj6I6GosFgYfZAt9lsHCa+kgsxpGwWO4hiMNHCWM8dlZ6fqR0U1y88p7t2jRjxaX8NpxY5CyO4cOE5nU0bNg8fytds6qDm6df9pruoyTcSf2kdg58av8AhsKq6iikFtf9q3VmNsG7Xf2sOHULj/5n9pv+OanWL/7UfutEM+M1H4ZxQdQtY0aldaLq2NnBWuRjjBHYP37bpsfUvsOuX/2op3pLoz7eKet6NgYx1oGMNnLCepMYdi7HR83FuVbcR6jFUNIfyfKZh8zHO1SO5VWV/X0z3xD30jAutMvX4kXStgve/ZaezB6CdhbXyezYj7LrQsw+WHS8A3C1jm901S1VHK6Fg79ksLkxFw8m/hyVV9VT9OVulshbpPlZ9lj6m5MBq42SV9rEbFy15nF0zPSVEssTDtfgLn/qrq7E+n64ubK5ul3laFc0x/8A8PJ/w9fsi/V9BXMhhfiLTsPrXWGWGd1NjdLFpqGnUB9S8CsmvU1W4TWwxyVzhpI+td8+lr1XwV0NNDNiBN7fWrSaXwyeU4fdfw9UcExuPEY9YcD+6u0c0bSAFoTJ/OTDsRw9jjVAkj8y2VTdd0UrgRUD+VJ7prs4LK4y2EnpdGbXEguPCZJqjYXACwCtGHdX4bJHYyjjyqPqfMbCMJw+Rzpm30c3Va2WuzGsplCXaMYzZzNi6eopW+6ARe+64p9Smfrq1lTSiqHcfMsx9U+edMwVIhq7bnhy4Gzczn/xLF5oBUk6n2+ZZ1m2zPsXei05ouk6uxSSztWorI8gsj3VeLwzvpibuB4Vny9oG9Q1jJXm+o911x6euhKOCSGQsG1uyhUGVJo6D9J2VcGEw0znQWsB2XV9BQQ0dK1jGWsFpzJ99DhMUTdhpAW1T1Rh7WAGYfytfCrWvg6lJfS8mPUNkrGWVjn62w2nZvIPtuqaDMLDXPt7o/la9dffwst77MqbFft+6eWbWCsLevMMA06wT+qkg6xonPJLwQfur8K+iRMvQZY3uhzw02KpqfFqeoYHtdyFKHCcampWmhyY58ot/wDrULnkk2so3OcTYE/yk0lu5Cgl0KD6cynUErKYg2KnpZGltiFI/QRsB/CIy7HJsgZGW/snE2F09/yqGUkCw8K1H9h2tiCVxdaynabhUl97KpiN22SyS0JpEgcQLBLrPgJqFE12Na0xS8kWSDY3QBc2TtB8hAg5CEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQmy+AI/j90xPfx+6Yon9AEIQkAEjm6u6VIXAGxQA1jb7HsErmAC6UOBNglUsX0RyQyx8FFj4KehO2mGkNDBbdKAALBKhKOSBCEpbYXugcNc4g2TE9zb73TO10/SDTHEt02uqDEKfUTZVbAXSWHlFVDpZqKSXzQsJvZjlZTuDuO6ocUpC6kfsr5UxtldYDuqLFICymdcdlWk0n2bmLbpxObvUlhgnwioYOdB7LzF9TPSc4xieQxm2o9vuvWXObpqTE6OaRouNJXCvqMylmxGaZ8dNwTuGrMtS2ei8blL8aRxr0H7mDYsx9yLP5/ddv+l3NZtFTwRSVAFiOSuRepukanp6vcDERpd4WR5c5mTdOVDI3TFtnDuqU4Jmpd/9sNHrhlP1vR41SsvMCSB3W0KWmpaqMObp4uvO3IT1NQUhiZNX24uC9dRdH+pbBX0jHvr2m4/MoowhF9nLZ/G3WftB6ZvCejhhHxWVDV0tO+4IC1vP6gcGqm6m1bePzK3VGfeFMdc1Y/3Il+P+FOnjMmX19mwsQooIWF4ttda1zH6xp8DEmqQCw8q1dQ+o3BoKV96xt/8A1Lm/Pv1GU1aZmU1Z2PDlUt9fiOk47jbq3uRVZ4Z2tMUlPBVA3B4cuVOvJ/8AvhiT9Z1anJ3VeZNVjFa6Myl1z5V3y36OrMfr45nRkgkHcKBLs33qqHZX5K5ONmxOKo9g7vBvZegvpg6MGDUcIay2kDstO5GZPuEcD3Qi+3ZdXZY9Mf4HTtBYBYDstKis5LlrYy2bX6flEVO1p22CrakNey91acKkL2ho2srj7p06CVs1Q6PPr63+RtD6S7X7K5NBewKgpG6XB5CuMUrSwCytRRQtWmIxpG33SSgg2Kk9z7JHO1dlagmirJdkSc11trI0HygMtvdO2mPikOQhIHA8JkgkhQbG6drPgJqE2PwbH4SJj/mKemP+Yol8CIx/CanPBNrBNII5CjbeyOX+wxzTcmyRPf8AKUxJ7MY1sE+122+ya1odyntHAUkRPXYRt7FPDQDdKG2CO9lKmKqgQltte6YXm6G00P7iyRljyFG8uFweE6N/eySc+FXlvRPB+xTuP+Zb7qPET/lbJdR9233RXNBguqd63HRNXFKwwDripMUEhva11zrnXjAjp5gX/Se66FzEu2lkXKmfdcYWTtv9JXP5a0j2TweqE7YtnJHqHx4FkzNfOpcL51Un4mtmmHdxXXmf2Iukkl+LyuUMxYvxk8jbckrmMzbR9ceMUVRrWzSFUySnqnEN2urrhOLujAaQrpW9KunmOlp5TIejalhDgw/wsK+D0eo4OTRVpFScZkexMdMZWa2jdPdgdRGNJYf4VfhGATTkMLCsucW2b8eSpjD6YziAqJCbNPKioY6xrrBjuVs6gywlxBoLYSb+Ar9hGRFZOQRSu3/0p0a2jHzeaprX00pi0VW6E2iPCxiqp6oyEGM2K6fxP09VgpS80juPyrXvUmT8+HTO105Fj+VSqLRxudy0Lm+zAOiKWobXsdoI3C609N8s8U1Pe43C0R0t0YKasaHx/wAhdL5AYAI54A1vcLSw02zzvnrYuttHcPp4r5nRwAk8hdnZVTOdSREn6QuPPT7hbmRw/D3HZdhZYMMVLG3/AEhdxxSaaPnDy9pqRtXDrPiaL9lVGGyo8HdqjaLK4vYWcrsK/h4ze9TaJKRu244U/CjpxZo/RSJz+lB/R7OP3SpGcfulSx+iDR8/7ok7IIDfiCQuLuVKvgCEA8pug342unISgAAbwpFGpEACEIQRghCEAvoIQhBICEIQAIQhAAhCEACEITZACEITQBCEJ0QBCEJwAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAJHjU2yVCAGRx6eQlk2tdOUNXJoalX0B1wTYFRTU5e+9kU0mt37qoIBdv4TvbTEfwx3qOYUFOZCbWWqOu824sDD2mrA0nyti5v1v+G4K6e9tiuA/VFnkOn5Km9WG6SeSlb2iGC1I3H1J6nKWllc04mBb/UsWq/VVSA//tVv+5ed+ZnrEbR10kZxIC1/rWucS9arAdsUbyf/ADFTtTLcVtHqTVerKijbc4u23/qTaD1aYa6X/wDarf8AcvJ/EfWr7rS0Yo3/AHqGh9Zj2nUMUH+9ULIbILYJo9gT6oMMraTR/ibTcfmWnM8s1sOxqjm01bXXB7rgPCvW37YAfijbf/5E3HfWLTYlTua/Emm4/OqM8ZszZ1+z0ZVnR1BSzVMtpRuStc9NZiR9NYkJmVWmzvK17mB6gKLEZHv/ABjTf/UtVdSZ0QseXxVbR/7kynFansSmlRntnpHkt6uIcGMQdi1rW+pdF9E+tWnqY42/4wD/AO9eIWC+pSow+qDWV4AB/Mtq5f8AqzqoQwvxIbeXrR/HKPZvY1Sk0e3/AEt6sqapgB/xUcfmTepPVLDHBIRig4/MvLPoP1jAQNa7E2/71eepPVuJaN+jEW7t/Omys9UdtxmD7tHT+f8A6vGRGYMxa2x+pcQ58+q+XEamSIYmTcn6lrfOf1E1GKvlLa+978OXOnVXXVZjmJkGcm7vKzr8rT1s9J4vhfdLo3rRdVTdb1mkTF+p3lbayqyjfU1EVWYCbkG9lpL04YeayqhdNvey7lyiwGihoYXmMXsOyxL8rbOwo4LSXRlWVPSr8DjjJjtpI7LduG9WtpqFsBfw3ytf0MtLS0/wACwUMnUb2yaGyKgsj8kixPg5P+Gw6rq9rWECZWio6odNJYSLFJMXklHz9kynrJC+97/dSKYyPAvfw2DhGKe9b4/7WQ0E9wCXLX2CYkILFzgsjoeo4WD4nj+VNC4t08F/6MmrsQdDFfWsbxbqN8Lj/mqPGOqYTCdDxwsOxnHTK82f+m6mV6Rp18K4/wAMmpuqDJJb3u/CvFHjjnNB9z+1rKlxR7JNWvg+Vf8ADMdaWgOf28p6uWh8uH6+GaTYoSLh39psGOCEguf/ACsbOPxabB44VvruomsF2vUE70Rf/DN/wzz/AL1taLe4rZiuNsrInNuN1gk/V7mnTr7eVJSdQS1Dfm5VaWQJ/wDCN/wxrM/D2Vnu/ADcLk7P7pIye65kPY9l191Qx1Sx7rchaGzpwRj6eQub2PZMWQ9ivx9yXw8/80ekne+8Oi7nstXV3SjhM60Z58LpbNbA2GrkAZ3K1fWdPXe6zFLDLcWQvxpv/wATVc3TrmG3tK5dN9Le5OB7R3+yyuv6eLXbxn9grn0ngrfxTdTO6sLOIv8A9Ze96Mmysy9ZUVET/wAPf9l1Tk10GymMTvw1tx2Ws8memYZpYiWX3C6ryu6SgbBG4M7jgJv+Um9liPjrivhtTKKKPCoIyWAWAW4sF6wp4Y2MMg2Hlajw2P8Aw2D/ACzwFPD1JLHIGiQqWOQizHg/T+G2sT6rp5mlolF7cXVm/wAWDpCdffysIZj00kgJkPPlXCHFRo3fupVkDv8A4l/8MujxU7ESf2pP8YPGr+1ikWNt4Lv7Tn461g2I4R+ca+J3/DJ342Rw/wDtI3GzfeT+1ibscDvr/tAx0dnj+U2WR0Ry4h/8MvGOkHaQ/wApJcYcR86xFuOb7v7+VKMaa7YvVOy/v6Qy4RvrRkP+MOa6+vg+VPD1K6Mf+IsVkxYAEtcP5VJUY65jidf9qtO97GLgG38M6HWwidZ8v9qkx3E2YxSuDSDqWucU6il9wFsnfyrv091H7kYbK9LXkaZNHx5/8MOzQy6dicMsrYL3B7LjT1F9B1GDvllERFr9l6HYvV0NTRua6x+Fcr+qPp2iraWZ0bBwey0qclDJ8C1/Dgup65qOmsT0mdzdLvK396b/AFNz4bWwNOIkWcPqXOucHS0sGKSujFrPPCx/ojHK/p/EGaZCLOHdXo5SZicjwX/1/D21yA9XbnUELXYr2H1LoPp/1UiaNhOKdvzLxfyk9QlTgtPG2Sttby5bowL1gCmjaHYk3YfnViFnseecpxH40+j1dp/VbDTQXOKAbfmWEZn+r+J2HvYMWF9J+teceJ+tQRQkDE2jb861x136zpapjo24kDt+dWPT3PNOUxvSTR0jn/6m5cVnnYMTuCT9S5jxfM12JY6XurCbv8rT3W3qQOJyPc6tBuedSxCizfjkrxKakc/mUbx2zkblpnfuRvXsMToi+oHI7rsTJzN7DaCOIvqmizRy5eTGW3qBpsO0f8YBb/Ut1dK+raKkhaGYi0bfnSxxn8KvqpM9ccC9SGE0dM0R4iwG35lWn1SRF++KC3b4l5T03rSEJBOKNsP/AN4qs+t+HgYo3/8AiLTxqlBEkIaPUTFvVJTNi3xQf7lZoPVbSMmt/iwvf8y8xca9bkboiBijePzrG3+ta01xijefzrTqjtknqj15w71T0NQRfFW/7lmPTHqDpMQka0Yg03P5l469L+tJ9RM1gxMcj61v/Jn1QOxSoiH+IA7D61cUehN66PWbo3MeHEadmmpBuPK2V01Wispdeq+y4k9PuazsYjpwagG9uCuxMr64VmFtffkKOxaQsXsyAxf5p2SyNAaQQFK4f5h/RRVRs26oTfZJ3sIC0d1IHA8FUkUhJ2typ2SWO6ZGemSL4SP4UTmkk7J5kDhb/qkuPKu1y6Hx/wCEQiIdchTRbWCRLHypG9iNaHpQCeAkT2gAX8qN/RkgDQN7bpUISDG9AhCECghCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCE2XwBH8fumJ7+P3TQLmyif0ADSeAgtI5Cc0aRa6HDULXSAMTX8/snEWNk1/P7JUtgIzlPAvsE1nP7J7PmCkjHoa/oBhvunaG+EqRxIFwnJJAtMYdiUIO5ukc7SbWSjhUpJIsSkuDwUJyQ5IDuCmEEcp6QtDuU5jn2RsNn6gkq5S5haSiQlt2qnle5xtdVpzeyNR0ymazVIVHiNP7kRBVUGhu6hqZWkaT4VSyfRdoscWjBuqsA/GRPidHcFvhaGzcyipayGRzaQEuv2XUtTQRVTSDvcLF+qehYq2B147/sqM2dLici4dbPL/PLJB1PNNM2iI3PZczdd9PVvTtW97I3NDSvVnOjJeOsgmLabm/0rjfPT0/VL5Z/ao3d/pVaTOmxuTU9JnJuGZy4r0zONNS9uk+Vn3R3rExeFzKeTEX2H+pYfmFkTi9LO/wBumf34asBGWPUFBVamxSDfwoLH0akciE12da4J6ta2ohDRiDuPzKXFPVBXMiLxXu4/Mucumelcbia0SB4t5V+q+lcYqYNDQ4/sq6nsvY8atmb9TeqfEZQ6IV7t/wDUsPr8zcS6pfcTucXfdYzU5U4/W1AIikIJ8LYmVuReLTSR+/SvPxflSODZpO6mqJNlx0TXdRVjZJoXG5HZda5B5LzOfCfwZ4HIVtyPyDkh9t76M8jfSuvMm8sYMMZEXU9rActToVvZzfJcko70XDLDLb/DYIr01uOy23g3T7YoQDHZJhOFQ0kTWhlrfZX2lfG1titbHr/6cFn8hOx9FPDA2mO22yeJNT7gptVJd1mopYy51yFrJaiZErPbsuNK64AVfTsNtwqGljN9h+qr43aW7BPiilc9j9DfCNDfCjfOG8lNFYDsp0n/AAqt9kjACdwh9r7IiNxdD/mKT4PE4TWggg2TkDYWQ+xX2tgi48hI7hMSxS0CiVCY/wCYp6a5pvdMkINSObq7pUKGY2RHILAhMa3UL3Ur2gi9k35dgAoxEtiNaQdylBsboQpo/R8YbHggi4TZTbf7JLkcFRzPc7vspoL4Sxj2TRHUEjhY38plMSB++ylk4TpL9iG+OnsRnKV4u1IzlEztLL3UU4tRI65IoZNp1LVkOhABUYZrkvvynVR0xcqnaui7W02jX+ZTdNFL+i499RVQ5rp2g9iuxcyGe5Qy2F9uy5A9QFA6WSYBvYrns1dnsHhFqg4nDGeQkfNJYckrnfqHCJqmrd8HLl1Zm9006WR5MfcrT0nRTZ663s3u7iy57Ig2z6l4HMSoT2a4wPLuavkB9m9/sskiyem9jWaXtzpW8Ms8p4qosc6lB/ULZtRk1TR4WXtox8vhZF9XZqWcy65/7HD/AFF0B+AeQ6G37JOlelY5qlrAz6luHOvpiDB55GiEDST2WvejpmNxZoNgNazpVdlmvnJuv6bZysyhZijGEwA3+y3d0zkBTe0xzqRvA+lUvp3w6mq6eJxa08Lo7CMIoqeka4tHyqeqhM5LnPIrqWkn9NJ4tkLQ/wCHu/4Vtw38q5/zmyap6F7yynA/Zd041HSNpXABvC54z2gpHvkDWt4NrJ8qYp9GThcrkXy3I45m6K/BV1tFrO8LcmR9JDTTQh/YhYf1z7GGymewFiVJ0B13FRTsc2cCx8q5jVJND+UulKh7PQLIOspWsiaHDkLrbLhzH00ek9hZeePp3zRZUVEMf4m5JHdd55GYx/iVFE7Xe7Quv4+Pro8C8qk22bpwL4Q0lXWoINrK2YREfbaQFcJDpduupreoo8hyNO1smg+S32UiipzdqlUqabM6T2xzXAABIWkC5SDYpznAiwUkRy7GoTdTtVr905OAc1pBuU5CEACEIQAIQhBGCEIQC+ghCEEgIQhAAhCEACEIQAIQhNkAIQhNAEIQnRAEIQnACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAkf8pSpsl9OyAFZx+6psQUsZcLplW3WOLpvskwIaR1nKsa7U/jsqaliAfu1VIsJCB4SppgzW3qSq3UnSckg/IV4yf8AaIZmVeDy1wjmcLE8FeyvqhF+jZB/+7K8Nv8AtMIJDPiBBPLuFJ/4kaX7Hmpnl6iMTgxmdjat4sT9S1HUeovF5n2FW/n8yhz/AIZm4/P8RtcrV4AtyoXFNlmPSNmzZ84vYuNVJ/uTqT1A4o11zVv/ANy1cGOe4gFI+N0e5Ka6o/0jktm3v/vFYswbVcn+5Nd6lMZsWmrk4/MtSam/mSBgJ+ZJHHiyL8abNn1vqBxKpBDql/8AKtNXm5W1YN53fysH9na+sI0W+r+FIsZL+B+OKRkrcwK739fuu58rI8Fzbr6Ro01Dx+61u6ItFwVVUeo2F1HZWki/hS1Ykbu6b9QGK0zw38W+3b4lmMWe+JVlLpNU83H5lz3hkbtQ+JZdgjJZA1pcbLCy/wBPh6v43UrpJaM9xbrPEMYu4yONz3Kb0/RVNbXNcbm53UXT1BFIxrZRcrY/Q3SsM07ZBGO3ZcvlXtbPdeD41Sgujb/p1oXUkkJcLcLsfLbGPZoIm67EALlbLCiiwsxkC1gFvXozqT2oGNEtuFh23v8A6d3RxMfX4bpd1DaItEn9qlgxJ0lRqLjysRpsfM7ReRXCkxPSQ4u/tMot2y9XxCn/AAzWkqtbQSVUMqGMN7rFabHg1v8A4ikk6iFtn/2rbuY58Mt/DKDj7aYX18fdQS9blhIEu/6rDMR6iJB/zFZKrqF4eSJtkK5/9Ja+HX/DY7+spJxYynf7pjcTdOblx3Wv6PqAOcAZe6yHC8VY9rSZE38z/wCltcSkvhkzZbDVdI7HXU4trKtE+MBkez+ytNbjYLiNakWQ9DZcWl/DKm9UvLre4f5UFVj73G+srEnYx7Y1a0w4415sXqCd3f0jjxaT+GSPxUyOvqV5wLEmj4XOWvzjG9g/+1dMHxxw4emflLNXE+38M7xKsp3xG7uy07nHJDJBIG2+UrLsU6ikZEbS9lq/MbF5KqN93dkOwv1cLFrtHOuZ+HtkqnuFvmWvajCow53w9/C2h13H70riQsAxKMxyOFrKJ3tE/wD8Ev8Ahi+J4Ow76f6RglCIqoAN4PhXKskaW2IRg0OuqBDe6j/ymD4GG/8AU3VksAx8VxxZdU5a1jI6WME24XKuVFVDTSRgkdtwuhuiseihgZ/mD+VNHI2NlwkUtaNtVOItbAbePKsMmL2qdj/aoJepY5Yf/FVskxaMzF2tTxvf/TPs4pL6jMKbG2tIbc8Kubi7nC4cVgjcbY1wPuBV0PUDQ3/xFJHIZny45f8ADMBjDgLakyTGHfm7LFhj7SLiRRzY+B/5nZO/yCNcd/6Mo/xlw4cnMxd17lxWHf8AeEX/APE/tSf94RbaRNlftfSSPFprejLX43Y21FLHjZN7P/tYiMda47y7qRmMho3f/ag/KTR4lS/hmH+OAtN3/wBqkqsWD7kOPCxp+OtA/wDE7KF/UDePc/tR/l7LtXDRa+F9mrRI67iVLTY3+FPwv/tYrNjwHyyKFmOGR1vc/XdCt2tlv/4WPr8M2q+rpBTOBk7eVpzOPETilPIwm9wVlGI4w5sRHudvK151xijJI3Xd57qRZDRn5PERj/DmXNTpIVNVI7T9R7LUeN9Of4fO54HHhdCZgVFPrkcQOStOdaaZXP0Abq7jZDlL6czyHGRUe0YTJ1JWYa20Urhb7q2Vmb+LUTi1tQ/b/UqrFsOlmDi0H9lhWP4TMx7gWnldBjz7R5Z5BgekHpFyxfPHGCw/8VJ/uWLYlm/idU52qpfvfurVjdDLG1zli1Y2QOIuugx4ey7PBfIK/wAdj6L9VZj4hPMbzO5/MpqLr+rjOr3T/Kwqdj43a3E/qiKoeDs7+Vf/AARaPO74tzZsqlzhxDD7aalw/wDcrtReovE6ZgBqn7f6lqGaVz+6he4kbO/tLHHj9IoQ/wCm5ar1N4rp0trH3+zlBF6lMacbmtk/3rT9r2u5ODLfX/CkVUV8JNaNtV3qOxl4IFZJx+ZUY9QWLkhxqpP9y1eAXcuTxTutfVsrFa18E9Te3QPqGxF1W1r6p/zDly7G9LmdlZW10AdVON7fUvNDp+aSnxBgjeeRwuzfSJVzmspyZDvZXI9oiktSPaz0bddTYiKL/MJvbuvS3IytdUYHHc/SF5QehQyyGhuTb4V6tZAwOb0/E630hQW/BF9NjE3Kp625BCnNw+32VNXSNAO6zrCZlPGbFVDObqnpB7m5CqgPAVNSfuSx3oChPIGncdkxaVL6FHtdfa3ZOZs5MZ3T28hTsVvZI3kfqnqPhPJNrtUcnpkcvoqEwucdkrLoXaI9d6HIQhA8EIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQmy+AI/j901nzBOfx+6YCQbhNAkQmteLfEU5CWwEcLiyY5pG32UiQ6e9k9JICNrS3lKnPAA2CQAngJRrXexEhIAuUpBHKR4JGyBww7m6EEEGxSFwHJQOj9FSg2N03W3yl5Spjh5N23HhIwb3Ss+VK1v5QlcloRvSKebYkKB/zKrli1XuFS1Fmb8bKpMWOiGaYMaQqGWQvcTdVErxvf8AZQuZrd8I7qrZ8LMY/wDBad5aRdVE4jmZpLU2np7W1BTaYhzZU5/WSbaZifVXR1Pi0L2mIG9+y1D196fqXFmvP4RpJ/0romUQOZa1yrfV0dLKC10YN/sqrXRdx8ucWcLddekCnq3ucKFvf6Vq/qT0Xxwuc8UA/wBi9GsW6boag/8A5M03+yxjHOgKGpjP/CN/hRT24m/jZjX9POyT0tOo3WFENv8ASq3B/TY6ebQ+jHP5V29X5S0k9y2jb/CiwjKOngqA40Y58KKups0v/k3BfTmPpn0hU9S1r3UDf9q2h0P6TKSiLHChaN+zV0d010JRUsTdVK3+FktBgdJAQGwAW+yuQp2ylfzcvhqvo7JSlwVjf+HaLf6Vsbp/p6HDg0NYBYeFfH0MbLaY04QaG3IUqpWzFuzp3DGxAgW/5KOeV0Js0pXS6X6QldE6YCwurtK0Z04exFHOZCB57K64fTam8dlR0mHEvBIV4o4fbAGlX4/8Kk16EtPT2CkkGhpKUauyJxeMqRRZUlJst9TOQ6wULJXawSdrqaeEudwmR0++6lj8KzffRcInB0YTlHE5oba6kTWtMnT2gOwuk1jwUp3BUaQf/wCI5zgRYJqEIFXwma4k2KcdxZRp42ahjBrgAbBIlcdRvZMk7KKSEfwV/wAqZt3CEbqJrsZtr4CLjylAJNgl9u/JT4/Ryk0NTHMBG26l9sjgoayx3U0XpEkZNDGDSBYKRp1A3SFhunAWFk/6JPv6AAHATJjqaWp6jl7o6a7GxgtlMLtlsD3SVwPt7BPBDZbHyisc0xqnbFFqHUkYJ14NVHKPIXL2duFCeSV2nsV1P1rF7tM/9Cufc2cIdI2V2nz2WHkwTkeleMXfjaZxhmzg0bXPDmeey1OzCGNxEWYPm8LeGeUP4R8hIta60a3qGmixYMe8fOse6mPw904rlpV1a2b+yP6UjrIo9UfjstuY10TDBgrnBn0eFrb07Y/R1LYmNeLm3db7xiKKbAiW2N2f9FQljxcHsr5vLXyyotPo8+vVbhLaKedwFuVy/hnWDcM6g9pzxYSLr31rUYp4amUdrrzu656rkwvqGRwda0h7/dZNlMYv4dxxFkr4LZ6D+nbNqho6eFpqG7gd10VR5zYYaED8W35fzLyhyxz7qMJZG11Y4W/1LZ1N6qaoQBgrzx+dRqPr0jYyuDqyUm1s7n6sz3pIWPjZUt8fMtR9f5i0uNh8hnb/ACuZcS9R8lYTqrCb/wCpUbc4pK9ukVRN/wDUlSeyTD8fUZroyLNvqxj2vZHJxfutaYfmLNQVYYJbfF5UXXfU5qYXSGQnne61pPjT5K0aHcvV/HiiDmeMjCprR3R6U8yJavFYGmb6x3Xqt6UMWFdh0Bc692BeLfo4q55sXp/iPzjuvYn0ePkbhVMSfoC6fC11o+c/MsRRUtHXWDxs/DMfccJcQls+wKiwQl9Gwat7IrWFsu66Ov52eCZXsrHoq6Nxc0XVS1oIuQqOikaGgKsbuywU6RWr212Dg0cJqa82cE5SLSJ0tCFoJulShhIul0HyEj3sY/oaz4CNZ8BK/j90xOW9AO1nwENcSbFNQlAkSOdp7JW8D9Ejm6u6RidCF57JWkkbpCw9krQQN0Lf9G/0VCEJR4IQhI/gAhCE1N7AEIQngCEIQAIQhJpACEIS60AIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEJC4A2KAFSP+Uo1jwUjyNF0ANTJvlTg4O4UdULBJpAOp+f3Uun/ADNV+ygpXAbKo+q/2RpAat9TZLulpG2/8srxb/7RbAmVstfqbf4nL2j9Ssn/APzcotwwrxz/AO0FLC+u/V3ZDlpDoqJ42+o3pCOPGah4aOStC1mHGCYtA7rp71H6TitQbjkrnTGGxicn7+FC5MnSiy2QUQBDiFVswqOobc7KEVLGmyniri1tgUsdsmUINENTgjIRdvKonU2lxAVznrS5tiVSF4c8n7q1X9GfiiQtgJFrJTSWNwFVNLLcf0l1t4U7fQipUnopTTFVVDRuLhsU+FjXPsQrthdO1zhYd1mZE+ujY4/BTsRU4Ph7nOA0rM8DwiRoa5rFRdO4UyRwIA3WwunMEje1t29ly3IWS0z2zxTj47XRX9IdNieNsjwtodF0UdGWtsNliGGhlA0Mb2WRYLjDYT8wXHZd0j6A4Tj9VrSNrdPYg2ItAIWedOdRuYGt1/2tM4J1EHvaA5ZjgeMmzd/7XP3WybPRMHjvya2jdmDdTfCLv/tXyLqZukASf2tP0HUboQLvKu8PVtmD4/7S49z2dBHiEltI2YOqtHw+5/aZN1YRy/8Ata2f1Y65Ief5THdUe59Z/lXfzMeuJT/hsKfqgygjX/aopsaDzYuWFsx5zrXcf5Thjljcv/tH5Otkq4lJ/DNKXFix1w/ur7h/UpiaAJP7WsmdRhhvrVVT9UgDeT+0juSHPiv5o2k7qTXHYv7eVbqvHd9Xuf2sG/73ADZ/bm6hm6rDtjJ/ai/O/wCEM+KT/hmT+ozIdOvg+VGzGzqtr/tYS7qUDfX/AGiPqVrn7v8A7UTvewjxUUvhsGLEw831b/qqpmPfg26g9YHTdSNaPn/tOq+p2uYSX/2mSyJJlunio71oynE+tnPBYX/2sG6x6mMmpofz91acY6sEbnfGscxPHxWA/FfbymvJl/00quLj80WrqmpbLqN+6wbGBqkdYLJ8XqTI43KsFbBqubcqOWRLRdhxkdfDHZ6cufyqzCaf2pgQFMaMF+/nwrhh1ED8VlH+ZsV8ZH/hmHRdSKQMl1WP6rafS/VsjY2t1/2tL4dUvp3taDwsswLHPbAuVZhfogs4pa3o3NTdVve23udvKlHUWp19f9rXFH1MNG7+3lVMfUm//if2pP8AI/8AZk38Sn3o2I3G7/EZP7Tz1HpFhJ/awFvU12X1/wBqM9Ti/wD4h/lOjkNGVZxS/iNit6kIFjJ/aSTqO/8A5n9rX7upQGXEn9qI9UXuNfbynq9lf/4rv4bBPUJ7Sf2njqHSP/E/ta7Z1Ofqef5Su6oJG0h/lO/Oiaviu/hsNvUZ1fPx91L/AN6DxrF/1WtR1SQbe5/JT2dUdzJ/abK8u1cTr+GxpOpSW31//JU7+ogXW9z+1gbuqhYj3P7UT+prG+tV5ZD30zTp4pb1ozyXqEjiS/7pYOog34nOH8rAmdRiTl/9qCr6pMLdnn+Uz/JZYnxa9fhnuJ9UtMbmh448rXvW3UhLXBr/AD3VrxLrZ1nD3O3lYj1B1M6ouC+/PdPV8mzEzON/9GP9ZYm+qc8BywDGKd0pdfdZZi7zUOJ+6sdfA0A3V3Euft9OP5Lj9RfRi7sJa8lrm8/ZW3GOjqSdheWD+Fkcr2scrbi9W4xmxXUYl0vZHmvOcbXKlto1r1Z0hTsY8NAWsOpMIZRzGwW4uq6p3tuF1qvqs6pXXPK6vDt9vp85eXYNcJN6MNrGl122VMGhrtP3VbVkBxuqR8rb7BbtXaPFsyCjaxSwJrYCDeycyZvNk8StJspH0iqtIb+H1WdZSRUfuG1yla8WU9M9urdPglJdjumRTUAY3VZU8kjmt0gK5VMrTHZW+Qttv58Jy6I2XrofCW11c1zx9QXa3pJ6ejZW04sOy43y9eBiDAPI4XbPpUktVU+k+FNGTIZb2er/AKG6RkBoh+i9UMh3aen4xb6QvK/0QyOcaIH7L1NyF/8A9ej/APSE2x7iJHZsN4+MlUddEHAm6rHfOSqGvcWg2WZb8J/6JQsDRbyqpjBq5VFRyOdsL/yq2JrgblU0+9jlsV7Bp2KZ7f3U2kuFgk0FtwtCneh+0Rtbp7pzPmCNDvCUNINyrYr1ocNzZSDYWTAwkXBStaQblRy7I29sG/OU5CEi+DGtghCEo4EIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEmseCkewFQgG4uhN7AR/H7pic5wIsE1GmArW6u6emsG105HYAmP3OyR+5NikaC03JulWx3r0SEAixTWuI2J2Trh4ICYlW/6Ryehzi07hMcdIvZLwmucCNk9LY1T2NJubpknP7J6ZIL/AMJ6S2WYaaEuDwU+O7gomtINypY3gE7JGkgmtLolayzL3QZNHCQyNsBZRyHx3KibWitZKSG++XSaSO6SoiY9pI8d01z2s3tumOlcdh4UEmmiOM5spTTBzrEqeOkjYLki6cIiRdRye5G63lVbO0Wq7ZfCYwt0/CVC+mkO9lLBI0Nu8p5q6QNILhf9VWai/pP+TRaqsviB3VDLLJfUCVdK4077lp79lT09LHK+3a6ryjEtRsX1FrtNI+1iql2Fe/EAQVdm4bENw1SMhYw2ITfTaJf8lx+GPnAWMuCz+kjcEia64Z/8Vf6j22glQtfG42AQoeo7/Mcl2UdPSuYLAdlURxFgBJKqo4mO4CJaYltwP2S+zTK0rtvZTveLXJKilqHW0WU8dM4mxQ6gBN1Yr7+jPylNFTiXcqspaawsiOkLSB2VVFHYcq9WloV2tofBE1p4UzSAf0UTWlpvdMfPpdYFX4paK1ktdla19hsmySahYqBk4tyh0oKektmfZZJIHNa526c2MDZNBuLpWEA28pzRXjN7JGxDkFP7WCaH2Fk4G4umP4XK2AvexTXNAF05CYWV8I0JTyU9Nk9Cgnt3bumJ7PlCcRiOYb/CE0ttyFImv4uo5diP4Mc0W2CRrBb4gnIUY3tCBoHATg0nhIpG8D9FJFIEtiBoA3CRzb8BOQpF0PI+EJXixSJ0Rkn2Cik7nypVFL/1SfCWD7IJGu16goayS7dN+yqncH9Fbq2Ujsqlz6LEGossPUkDpYXNI23WqsxunBPSSuMf0lbgxC0sZuOVi3VeDMqaGT4b/CeyybYe3Z13EZn4pI88PVLhL8Oine1lrAriLq3rOTDOoHNM1tL/AD916N+sLo5zsMqZWR8B3AXldnp+OwzquVjA4ASnt91lWrR6nhZ79FpnVfpgzTc6thj/ABPcd12dhfUrMQ6bDzLe8a8tfTd1nVUOKwiR5ADhyu7ugMx2T9OsidMLlgHP2VGxGpRcrbE2ab9bDfxFHUhgve68ys58OqIsWnma0/MeF6c+paN2O0cxjF734XC+bGWdRV18zvw5sSeyzLYnqfjko9I52wvEcRgcAyRwt91eY8exUCwmdx5WUT5aigk1Pht+oQ7pCnDd2D9gqbT2ewcfiVW1oxyPHsTJGqV38q94L1NWxEe5KVOzpOnZ9I/hQVuGxUZs0AJEaixKauyrx7qeSopyz3CdlYsIMlZXM2J+NVTqIVDbeVfeiOkJamtiLYybu8K1TLTOH8jlX6vR056McJczEaZxZ9bV68ek0up8LpwBb4GrzD9IXRU9PWU7nRkDUOy9TfTNhf4bDYGnY6Grp+Pe2kfNXmsYekmdNdN1TjBHvtZVuIOL3bFUHT7WMpWG/ZVdXJ8QAK6uuD0j51zEna9FRR8BV7C0NtdUFHwCq0cbqX1KCWkNfz+ycmv5/ZOTSQez5QlSM+UJU9fBj+iPBI2TSCOQnpH/AClKIMQhCAHtcLAXSqMGxuntJIuUCP4KhCEDF9BCEIJAQhCbL4AIQhNX0AQhCkAEIQgR9IEIQgb7MEIQgPZghCEB7MEIQgPZghCEDk9ghCECghCEACEIQAIQhAAhCEAI4kC4TCSeVIRcWTHAA2CAESvcNFrpErmXbe6AGR90yq3CljYN91DWksFggBKb5lVfV+yo6aT4uFVtcXP38IA1X6mmGPpiV/lhXi9/2ieKmnlrxq7uXtH6ozbo+Qj/APNleHn/AGlVcY58QF/qcmyFT0eVHqJx8Oxaobr7nutCYlWPml2dyVs/P6vdJjk4J7lanhd7koJ8pmuyRTEc1+nVZLG6QjcqsmjYIrqKNrTeyUlUuyF0ruEMcXccp88Iae6jjdpcpodSH+zJgSBuf7UkALt7qIODhzypqWwUk5aiT4yUrCpgjIdsFesHhcXN27q2UzQXhX3BmC4t5WRfJ6Z2HGUpzRlvTLQ1zbjwtk9LFjWC47LXGBXaQQs56eqS1jTxsuVz5vTPdfEceLaZkVWTcaSlpZ5w/wCbumskErQf5U9JHd3C4/Llpn0LwuIvxxZknTlTJqaS43Wd4NW+3EHF26wDBAWPFgspopz7YF1z18mpHpXHYqSRlMePNaN3nZOb1MS+wlWKzzyj5SU2GomDruJUVdnqdVXhRaXRm9PjhlsPdVZDiBIuXf2sOoKuRpBJV3pqwuZa6sq9Lsnjx8f+GQf4qIzfUf5Uc2OgX/zFZampfY6VQVFZKL3JS/5CJP8A4+Jkv+O7f+IEM6hINhKsQGJSE8p4xFw4Kjd6kI8CKZmIx8kB3u/2g4+Sd5f7WJxYk4gApZMQN9j/AGopXkbwIN/DJZse8S9+xTqfHhz7qxCXEn2tdEOJPbvdRu7bBcdF/wAM8j6hFt5lFWdSOLbNlWHf4zKNrn+VHJi8rhbUdkjtTLFXGoumLYvJISTIVb2Yg61tR/lUklQ6YEpjSRwEx2pGhXgJfwqZn+4dzfdU9RC1wvZStJ7tSluocJrtT+FhYMS1SU7g64H9KroPg52Uj4BqSxw6Twm/l7F/wEVAkZqB1BVVNiJh2Dv7VtlBaFD77mnunK7fwhsw4mUU2NuB/wDE7KuixvYXf/aw+KqcLG/7KqjrXgWB3/RH59GfbhRZlZx34biT+0xmN/FcyLGDXygW1JWVryfmT1kbKE+Pj/wyh2PbH/N/tQvx6zj/AJv9rHn1jtJ+JRmqJ3Lk/wDymRf/AB0f+GS/46T/AOZ/BSux4tZ/4ixYVrh3v+yf+Le5u5R/kj4cdHa6MnZjmr60442QNpP7WLtrSwWv/SPxrvzD+E15GzQXHxX8MmGOkG5l/tDsa1f+YsYfWuAuHJoxGQDn+lG7dsnjhxRlLeoBGN5P7VLW42ZmkNkWOPrpD3UsErni5SqbYs8aPqS19ZK4n4zwrTVyOfuXK7Oh90WsqDEKT2mX+ysRkzFy8WLZZppACQ5ys+LPJJ0lV2IF7Xm6t1USWk2V2iz1ls5DlMNOL6LNWMce6s2LRyFhIV/e3W6ypMQo2+2RZdDh3baPL+ewdUs1x1NC8sdcLWnU8TxI7ay3B1VRN0PIHZax6ppGh7tv5XZYFq6PmPzTFcZSNf10TtR+Eq3ytIP6K+4jANZH3VrqYAHErqKbNo8A5Cr1sZSDV2ulbqvvdSCNoFrosA4WU/sZLWh7A7SE+Jzja3lOaRptdJEA03ClrEiwrHuDdiqMueebqrqTdt1TEAixSg+jJ8uy81zOfmXbHpTLxW0979lxXl6GtrmE/mC7W9KpBrILHwpIkL/2PWL0Obmiv9l6o5BtJ6ejPbSF5Xehz/8Asv2XqnkH/wD65H/6QksfQsUtmwnW3v4VvxFjrcKvcLk/oqOvGoLNu2TpbI8LiuC5wVcABwFTYcA2M3KkmlLdgqqi/Yd8H++1h3Ka+djjcOVDPM47KFtQ+9j5WhUuhkpaRdWygmxT7X//AJq3RzvJBKr4XFzASp5LQz8hK02G5S3B4KjT2cfumf0cmmKSBuUmpp7of8pTW8j9Uoo9CEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABM0O8J6EAI0ECxSoQgCNCEIAUOI4Kc4kC4SNaCLlK/hAEbibEpGv/MUr/lKYgevhIHHkIJAFyho+D+Ex7je33QQWA51zsjSef8AqmudpNrJNZ8J0SBz0Oso5dV7hSNsRe/ZI5ocnp6J67CHWTtdSR/fwgwgpWsDRsoZz/haT9kPLTpuB2UZDj2KmabtCa4Nb3VaUiCUNlHM14KiL/b3J4VTPK2x/wD0q24hK4MJCglYNjEqoa9hdp1BTTBhi9y6xlmJGOo0udYXV0qcfpIqAudI0WHlV5Tei1CmTLX1N1M3CoXESWAHla6xnPSlw+csfWgWPlUed2YdFhuFzPZO0ENP1Lh7N71FzUOJyshreHHhyhb2XIcfZL4ju3B8+cOxKcRfjmm5/Ms86c6ugxBokjlBv915hZT+obEsTxtjPxZILx9S7ZyL60qMWo4TJJe4HdNa2WIYFkX8OiIsRD2A3/tONSHNvdWOjq7wag7tdI7FSDoB3TtdDZ4zSekXWebV9SbAfjuSqWnqDKPiVS2SOIai4fyh6M9UWuRdaYxgC/hTaoiLGysUmNRRbah/KiPUTCdnBIorfZZWFZL4i/v9ocEJhkitsrH/AN4GE/E4fypI8VY/6gpo6Q7/AA7Euy7CVgPKBM0HYq3x1Yk7qoiBJVyt7RBbVKKKoTXFj/KhlaXXIU0NO5+yl/Dhrdx2V6Ml/ClMpYw8X5T26r73Untjyl0DyU9S7KVvwa1xBsTsnBw7FJ7f3SPbpHKf7MrpErJAeSnNkFwLqmZIb8KZvITS5WTprni210rOEjmWG10x9MtKT0I3c7p6bGLuTy0g2G6rzYvsx6EJhc4Ei6nGj0KJ7nk7f8kMc8Hf/kka2BI/5SmIe92k7pmt3lN9QHpWmxuo9bvKcHDYXTknsB/uDsErXauyRrQRchOAA4CUR/BhNzdIggjkJjnG+xTl0QybQ9Nfwk1O8pzd27pJImqb1sjkb8F7K0VMbnPt91entvYAKkrYY2fFZVrYk6l0Weppz7ewVuxKiE1O9pA3bZXuQsLS0q24ubRuEY3ss2a0zWw7X0kct+qvpUT4VNGyMHU09l5e+pDJmodjE1a2l+sm+lexuaXSbcdpnsnh1XBtcLk7Ob06x4nJM84fcaiflWVkx0ehcdl/quzza6Mweq6exUExlulw7LoXL7radlPHAZiNhtdVGY2QRwWpkkgoS0g9mrHemOkMYp8SZE2F9r24WbNHXYWQk0zZOL0TuoqKzm6rhapzDykYYZJzTDgm+ldKZZ5fzV2Hs/EU5JLRyFW5j5QAYS97aP6PCoWI9B4blI1TR5pZm9Ntwqoc0sAtfstaVtY2N5aH8Gy6Z9SWXVVTVE3sUhuL8Bcw4v0pjMdc4GnfbX4VKUT2PiOdr/Guw/FHSTq/tY51Fir2y6dQWW0nSmIOhs6B17dwrXieX2IVU+1K7nwof6Ws/n4Rg9Mouk4psSnYwDldC5F5YSYrVwEwA3cOywnJ7KCuqa2MOo3cjkLtz01ZIPZLTl9D3H0qzQtyPMub8gjJPs2f6bMmTRNhl/DAcfSu5smun5MNpYWabWaFrfJzLNmHUkd6UCwHZb+6MwZtI1gDLWAXU8cnvbPCvKuUjbFxTM2wRj/w7W37KrlaWyfFuoqBhjiFvCrIoDIbvF911dUk0eL5k9yZPRcD9FXs+UKjhaIzuO2yqYpQbAlStozk9jn8/shnP7JbtPhMeHA/CFE/qH760SITI9XdPUq+DRHHSL2TSbm6eQDymOABsEN6ARCACeAn6G+EnsAxPZx+6NDfCUADhOAEIQgAQhCABCEIAEIQgAQhCRvQAhCEJ7EfwEIQlGAhNdqB2uk1u8oAehA3CEACEIQAIQhA6PwEIQgcCEIQAIQhAAhCEACEIQAIQhAAkf8AKUqR/wApQAM4/dU1dx+6qI+6hrmtIBsgCkpTZ91XxPvJa3ZUlK1pdx3Va1jWvuB2QBq/1Qxl3R0lv/zZXht/2l1I51RiDrfU5e5/qYF+j5B/+7K8T/8AtIaCJ8lfdo+Zya+xujxaz8pntx+o27larYfadcnut5+ozDmR41UFrRyVo2pYWSkHi6T1Yu18HPqXPGkJ9MTe5Kp2WDrkqaM3Hwn+E5LQqmS1F3M5VISWnlSySObtdRN+NwCX4Sp+xJGTcKqpOVAyIgcKSHW0ptkv1LuLLViLrRjU4C/dZLgdObDZYvh7ne4N1mfTEesNDh4WTkS6O34p+00ZFgsBBG39LM8DpyQ0Ky4JRxlo+ELK8JpfbAsOy5TPlvZ7/wCHQ24lypaZ2gXH9K4UFG4u4UVCRqDVe8PgZp1ALkMuR9G8HT+iJ8OhEVir1SSWYAPCtDTodsrjhx1EBc/b29npXHVfC4RAPFi1SexYXsq3D6aFzRcb/qqmqpIhEdI4CquWuzrKa9otAl9o28Ktpq7QqKoj0vN9k6J7W8lIrGWVXougqvcFrfooZ2l42UUTw4/CVVwRAi5Cb+VkqqZbzTOb4UTg5psSf5V3ngYG7BW+qh3Nmpn5JbB1dkTSdIN0XJ5KY1kmqxbtdVMcVxsEjk0NdG+ime136pQw+VW+wPCZJAWgkBN92WKqUl2Uha6/lKGWNyVK5jnG4T4YdXIQ59E8al/BIYi4BPMBBtZVVLC29rKWeJjeOU2U9luFcU9FD7duLJzRYWVRob4SOa3Twm+5L6R/4RBgcLn/AJJkha0cKXYeAmFgcCSEe4OK0U7t91E5jSbqd7DrIATmw7bhOUtIoTh7MpWtLTuFM34TdSeyPsgs2tZI5pkEqWxCQW3smMf8R2UgYbWAR7PgJVLoglj7Y33Psmudfe3ZSezbdHt9tKNsZ/jMhB1H5VIXDTYJ3tf6f7R7X+n+0rkSQo19IykLx2KlMVgTp/tRlhdy1Cl/0mdXRE6TcpPc+ym9oHbSk/Dg72SppjXVoge652CqaKQXsUR0zTtb+03aNxIU1ZXnF+pcY5GgcqjxGRrmW+yidUPANiqOrqXuba6vVox8mLZbMUa1wuFaahhAIsVdKkl9yQqSoawNuVYitHPZtaktMtPtWddQ4hCDCVWPMeo2VNiZIiuFrYU37JHnnkNKdLMN6mitG8E8Bav6tgAkddbQ6okd7b9+y1d1dK73XBdrxz+Hyx5xVH3kjB6+M+67furZVMs8hXXEZWgndW2Z7CbrraW/U+deUgvyso5IyN1CWlu6qpHx3tsqeZzCNlcj8OdsgKwlwsCntBAsVTe44HZTRS6+Sp4fCuloKo3bf7qJnyhSVXy7cXUcfAukb2GtIyjL1j/xrRf6wu2PSe0isp7+AuLcvw01jCLfMF2h6Vi/8dTgfZPgMPWX0RbmiH6L1OyAeRgMbf8ASF5Y+h1jyKEkflXqdkGwjAIzb6Qnv4KkbI7/ALKlqwCxVFz7lr9lT17dtgqNq7JE9EdL3TpGOsCm0Adc3CqtIPZQRr7HN9FulhJuo/YPYK4SQ3vYKMsANiFdqWivJ7IGR9gVVs2YAkEbBwlAsLKUg9nskZ8qew7WTGcJ7BvdRvWyxDehX/KUwbG6e/hM5QSDw4O4SpGAi9wlQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEJHkgbFADJe6Y1txe6ed+UAAcIAVuzSPson/Cd+6lHB/RMe0EXISr6R2ET3A8JErwBwkTypNj2fKlJHKSPjfypCwEpJfB9X3ZF7n2QZABeynDIwLlU87QB8KrS2aFYe8LbqKSe211TTySNOxVNLPJe9+6qTk9k/wCPrZXzR3j1gqkni1xEOTKWue5+iQ7X7p2JVsMbDpcBcKNraEqocpmFdW15wxxeNrLWeYGcDMJoJA6q02B7rMs0MWjgopJHPsQCuG/VPm3V4QKiOnqyLE8FQTejs+O4d2xT0Reob1KCSOalZXHcEfMuMsxswa3FcVe+OVztTvKocxc1MQxnEZGyVTidRFrp2W/S03VtY0zxl1z3VWUzpa+KjCPaNj+m1lbWYxDI9jt3Dlejvp3ZLBh1PqHYLkv0/wCSr6OogmZSEWt2XaOVOBHBsOiD26bBCmtkN2HWovo3Jh9X/wAJYnsqaStEE+t3AViPUbKSPSZQNvKsGO5j0NJcvq2i33UkrFoy6eKuus6RsRvUkMY+ext5Vtxnr+npGm81v3Wn8czrw+kY4ivbsPK1n1z6iKaNrwzEh3t8SryyIpmxj+KWSfs4m/cWzfpIJC38RwfzKKizcpJt/wAQP9y4q6j9Rumocf8AEtgfzJmD+pWNrgDig3P5lH/kLf014+MuMe4nemF9bwYiLxzf2r9h+OteQBJf91xt0B6jIKmzW4kD/wC5bj6EzfpsRkYDWg3+6nqvTZl5vAOCekdC4ZiIfbdXulmDgLbrXHTHU8FY1jmzjf7rPMCq2TMBLlpV2p/DhORxXS3tF+p5RYXHZTGzm3uqVuzbsSiV4FlZVpzdn0msBsE0sJKiMjr7lPbIT3U0J9lGxC6TeyHMdY/olaQTvynhhcFZi9oi9dlK1h18Koi7fqniJg7J7Y2kXshvRPWtAGki4Q5hA3TwAOEj/lTJdk299DGgAiwUijS3PkqJrYJ6Hpj/AJinpHC4spQTexiEpBBsUiBy+iP+Upie/wCUpickP0gSt+YJEJdCNEoeQLAJ6hY4Db7p7TpN7JrWhorztZROFnFSOOo3Ub/mKREM0DW357J4AGwTQ8E2snE2F06QtLe9BceVS1w1bKcm5uop+yr2dsta6LZVwFrdQVtlBe/S7+1kE8Icw3VoqqbS64HCoWJbL2K9GO4/gsNUwgt7eFg3VPQdDiED2OiFz9lsbFphEwl3hYniGLQe45r3DlZ2ZFa6OowbZpHOOaWRFPWukcylvf8A0rXeHenkQV4k/B8HnSusMeqMMqLiQtN+VaqWhwd0twG3/RZTrejp8bLnHWzWnR2WQwuna0wW/ZXHqvohldhj4HQ3u09ls+HDqKRgEQH7J8nTsdTGWlo4twonj7RrU8zKmSezgnPH05HFZZZBSE3v9K5w6q9K74apzm0B+a/yL1e6lyspsRjOqnabj8q1t1L6fKWd7nCkb/tVWeM0js+N8sUY/wCx5pxem2Zj9H4J3+1XbBfSpJXTi9ATc/kXdtV6faeKXUaNvP5VkXSGRlFHK1zqVu3+lVJY7TL+T5P+SH05Tyu9JTsNljmOHnj8i6kyYyXjwj2S+ltptyFtzpjKzDYGNb+FZx+VZxg3Q8FG1pjiA/ZWaKPX+HBcr5ApSaUik6TwCKjhawM7Dss5wenLA3S3sqChwoxPAA2BWS4RSsYG3C6DEi46PPOTzHbt7KuhdIAPhV0p3fB8SggijbYgKo0XF28LdqlqJx1ycpbHqSHlRt+Hsnh7eOFYUyJQ0iVSEgclU7ZQO909r9RT+mI0SoUYFzZPaCBYqQYDnBouUx7u/lJMCN1G75VHKQjeiWOQgWJ7p4cLcqni5/dSqNyETJEjnaTayYhSxkh6Wx3ufZOBuLqNDSAbp/Wga0SITdY8JdY8FGtjG3sVCTWPBRrHgpdMTbFQkDg7hKkDbBN1nwE5Rpshy+DtZ8BOG4uo1I3gfokj9B/AQhCeN0wO4smOaG8J6EBpg3gfohCEBpghCEBpghCE2THL4CEITdsUEIQjbAEIQjbAEIQjbAEIQjbAEIQjbAEj/lKVI/5SjbASPuoq35QpY+6irflCNsCCk+b91W/X+yoqT5v3Vb9f7JU3sDWfqZeGdHvJ/wDzZXih/wBo9Wt96vufqcvaj1RSaekZAP8A82V4i/8AaQazNX6fLkq+j1HrZ5KeomaKTGajfuVoqua10lx5W6M/mSnGqi9+StN1EDtdiO5UqSIZdIozGPKfG721K+E2NkjICR+6X1SI/YilcXb2SU7ACppYnAXTYmuLuFDLaJ4sqYYg4Ap742t/lOpgQALJZ43E3UU31o0MVr30VFC7S8O+yzHpSpadO6wyka7UFlPTIdGWknuszIXR3XDSSmkbKwGUENN1lmGyNDBfwsJ6ekJaBcrLMOkLmgX7Lls9ds+iPDPX2iZFSOs4EK9UMwDQB4WPUTyLA3/lXihJIAuuQzIpn0nwSj+NFyifqfYlXOgdpICtVPu+6uFLJpsFg3Jno3HOPWy+U1YI7WKuBrGOh57KwRSXKqY5ngfMbKhNM6uhwZWTRNmPw7qI0zhyCimqbOsSrhExkwuFE9ovRUWihha6Mi4VdFUANsiaja1twFRyOfG4tvsVG/2fQ9RjorHVDHDm6hkaHnlQhzgeVPA4EWTWmieMIsZ7A8JQBGLWUzhbnwonNvvdJ2yVUx+joTqKe5ovZQxuLTspXSX3S9r4RShp9DHxtaNkRtDXbIuTykc4tFwj9hyi0VMbwze/ZJNJrG5VN7r/ACla5zhclJpj1tMfrHgpDMAbWULnlvc/ymuOo3KEg9mifWH72KW+1gFDGSBse6nj7o0xdvQgi3vbv3S6D9k47koTtEqgtDdB+yNH/wBXTkI0hPxwGOFjZIpFGlB1QYAXNk72x2KalDyBvuga6Yi+390FlhcpQ4E2Cc9wLLW7JUMdcV9IjY7JjmhvCeTYXso7k8lO0iFqIcclKCLJpFxZAFhZGgVaYjn2NgmSXIvZSObcKOQbfoVPWyK2paInvttZUtQNrkcKodyVS1TrBXYNGFlxjEoKja4VvrJNiFW1TvhVvq7lpJ5VmC9jkOTthXHZQvdZ5t5UNdLeIhyWV7myblUmIzERHda+FX+yZ5hz+avxMxjqhzND7+FqvrCRvuu3Wyeq6gmJ1j2Wq+q3vfKbldxx0Ph8vebZKcpGLYi1pJKtM5DXmxVbiLn3PP8AKts+q9xddXRHSPnnk7fa1hIxp7qF0bd90nxnygse7YK2ta0YM3sR8TWtuE+mYC6yBE/RYjlSU8Tr3t3UsF0Q9NiVTB7eypmuOwVbUxODVRvjeDuE34JpmXZdfFWsbfbUF216UoWmspz+i4ly3Y78czb6l3D6S4XPracW8JYN7Q3SPV/0OsaBRD7hepORIAwCMjwF5f8AohpC1tEbeF6h5Esc3p+P/wBKml8F6RnpJEht4UFYSW8dlU/X+ypq17Q0qrNbGN6EovlKqGjUbXVJSSjsqpj+9lHGPY5PoJBpFvsoiy5vdSyEEEqJzrG1lainojktvYoFk9o+G3lQXPlTs+UXSvoYodigWFk9nH7pobfe6c0WFlDvbJorQP8AlKa3kfqnOFxZIGEG6cOHIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAbBCEIAEHYXSax4KQvBFkAGs+AkLiRYpEIAEIQgY2CR/wApSoQvo19oic0EXuk9vflTG/hJpHhSJkEouQ1jBZPR+yQuDdymy+E1MOxHja6jl3YiaewsoxLqG5UElouxi12QTxXbpKoZ2FoJt/SuUxBNwqWexZayqWR7LEHvpljqq19O4lWnFeoXMBu/t5VwxpoaHELXPXHULcMDy91hbyqspqPbOk4rCjdNJmN5ydT+3hUpD+AV5z+rLqmepraiNrr/ABHuuuM6szYnUUsDZexHK4jzqmdj2JykbguKzr8jXZ7BxHEQWOlo55joa3F+ovbLSQZP+q649LOThrTBJLT827LT/QeXjJcbZO+C/wAYPC7W9OWF0WD0sJc0CwHZZtmYifM4uxL9Ub1yyypw7BsOimdCAQ0dlldbidNg0Bja5oDVYf8Av/Q4dhwaJgLN8rV+aOd+H0Ech/GAGx+pRPNjD+mPhcLmZt+nHoynMLOODBoXETtFge65zzU9VLKJ0jW1wFifqWtc8PUVE5sjYa7z9S5CzdzyrKmaX26lx+I8OUU89NfT0jiPDpvW4nTXV/rEe33AMQH+9an6q9XFRUSFrcQve/1rk3qrNfEpXPAnf/KxB/XuJVM13yvO/cql/nbf07WrxLS/1OouovU1VS6nis5/1KzR+qOsgP8A+W2sfzLnOs6hrZYyS4qwV/UFayQ2c7+UqzN/0S/xj8cf9TubLL1fVFNOGyV45HL11DkZ6qhX1MIdWg3ty5eP2Cdd19DVBwlcLHyugMiM7amhq4Pcq3Dj6lfoyjg+a4N1xfR7j5O51xYnDCTVA3t9S6J6E6zZWxNtJe/gryk9NGfJqm00ZqzyPqXeuRPXwxKCMmW97d1r1XtnifP4EozfR1ZhdW2ojBv2VW5l91jPSmIGWBjr8gLJ43h8I8rRqscjzbJplXY9kEziOEsUh2ulfHc7pGsLSrtc9mdOJURjVYqYADYKljfpNlMJgBuFerf6kSSRIns+VRt4CeH2FrJ77JoRHJH8JQbi6a5wIsEx/B2khqEITopaGEiEISCx+iFoPITFImOaG8JV9JF9ENu6Y+19k53ylMTx4IQml9jayNbAdwntJPJUYcCN9k4O/KkkuhunvY9I5oIvZKwaxulIsbJq0Q2LbIuEriSSE4sHZN+o/uh/RlaaYlwNrqnrHFrhZOke9slgNroqrOA37KGf0uR01ohZNqZYlUtay13WVQGAWseFT4k/24nO8BVJrZbpWmtGG9a4k2kgcS62xWj+usyG4VK8++BYnutjZsYvLHA8Ru7FcjZ79ZTUTJnNkIIv3VG+PsdlxtKnFGRdQ5/xRVLmGtG3+pLgGfMNRK1prAd/K4lzDzrqqLFHtdU2+L8yd0JnlUVGIMYKu9z+ZVPRI3fw+sej0s6C67GMuZpmBvbutpYFB+Kja617rkz0wdXVGNOhD33BA7rsfoqiElDE+3LQk9E2ZGXc6okrsBjkiu6IH9laa3panluPZH8LOfw8TITq8K1mON05ZfZRWVRaMqnkLYvpmAYl0NAXFwph/CTCulGQG4gtv4Wwp8LhkbcAKODBmAGzRx4VSVKNBcva4abMew+gbC4D21kNBACwDSFDJh5gkvbYIkxSOjZuRsPKWEHFlS+yV/cS4tjhi5ICnjroorfGNliGI9aQQEgyAfuqB/X9M51hK3+Vo0vXwz7aZ67NnYdXtqHAB6ufuBrQbhavwbr2JrxaQb+CswwrqWPEYgdQ48rQhZ0Z1uPJvei+yVAtyoDUyarAlU8cpe7Yqqhpi+xKswlvshcYw+ksLy4i6q4QNF1Tsh02tb+VK17mDTZXIfCtY0/hM02N1ICDwqYTOvvwnipY0WunS+FckkANrhQuAJITjUsd3THPN9u6gk9DZIewNA7cpNR8pmp/5f6TlGNF1O8o1u8pEKSJLEUuce6Gk35SXHlK2xN1NH4Oa6HnshCFJEhf0EIQnCCgkcFGt3lIhIwF1u8pEIUUvoAlDnDa6RCjg9McvpJcHgoTA4t4TxuLqVNMcCEISgCEIQAIQhAAhCEyX0AQhCQAQhCABCEIAEIQgAQhCABCEIAEj/lKVI/5SgBI+6irflClj7qKt+UIAgpPm/dVv1/sqKkBDtx3Vb9f7IX0DVXqhu7pSUf6D/yXin/2izIzJXhwHLl7U+qKQs6UmP8AoK8Rv+0ir/bmxD7FydH6WYrUEzydz/ZCMZqAbclaWrzGHjTbkrZfqCxv/wDHJ23PzFadfXue/UfKmi9Fea2XBrmE2JU0MMRbuQrX+K2uE+PEC3Ygp0mtbKzUi4zU8RFtv5UbIYWu7KifiLiLC6Ya1wOq5VeXaJo/+y7xtYBdK50YtqIVpbibhsmmvc7Y3UThIsVT9HsvtNJC1wJIV/wWsjaW2d3WEQVj3OHKvOF17m2FyqeRW/U6ziMzViNpdP4pGNI1BZngtWx7QdS1JgWIPDgblZ109ixOkElcpyFb7PojwvNW12bEw97XkEFXygYAFi/T9WyRgJdysnw/XILsF1yOXB70j6S4LN3WkVsYsVVwO3VC9zo9ipaScl3xeVhWw0ek4GU9Iu9OdSq/beGagqOkcH20q6Qt1R2I7LPsizrcXJbRTNLhz/KuGHVLmuAKgNE47gKengLTuOFWkjThdL+FzuJI1QVkbRuPKqRM2OOxPZUtVMx17EKLRPG9pdkLd+Af3U0L2A8qmbI0bbfylD3A3G/7IcdlqvIRXe41wsCFE4OPy/uoBJIHC4/pSNlJBuEigWY2scy190644BUfKAbG6H0TJqRJcDkpPhdsmudq7IBINwhMV6AsN9gj4m7JzTcXTX8/sgRerGkA8hAYCbAKTQ3wgNANwEC+qGaC3YBSXI4RceUAg90CNJIDI4XO6b7z/smSXuQAmWI5CBPyMn1vHN/2Sh7r9/3UTXF3KewG97Jvs0OU2OLneSlLSBcpzGg2vsh/ylHsL7tkWt17ABIZCDY2Q4G52TH8pU9jHNpEoeRuf6To3B5soWm4uQnxmzkq+le27SJS1p2KjLWNG6UuB5KY5zT3UhQWRuXYiB+gTTIB2QJPsk7LULRXu08AKOR4I4SyP24UEj/unwbG3W/qNkIF1SVDwQf1U0jnHa/ZUlW9rPmKtQbZy/IZKX0oal/xKlqQC3/mpamaNxvqCttfWmNp0+Fo46lJ6PPedzYqt6ZT1OhhOoq04vVRsjI1BPxDEX2JWJdRY6Y2uBPfyujw6+0eQc5yEfwy2yj6lxGIhzdfZa76llicS4OCuvUGNl5d8RWF43ir3ki5Xa8fTLSPmfzHkIOUtMt1bLAZCNuVSSPprchU9ZOS4m6pHSEv5K6aqGkeG51/tY9FcTTkcprXwatrKkdLZMY8g3JVnWkZ3s2i8Rmne0NFk6GKNruFaWTmL4r79lK3EHnex2Tk0kLDRc544i2xsqWaCLmyp318jxaxUb6t5GkgqN9j3pGX5ePjjr2i/wBQXcHpIni/HU/xeFwN0fiJgrm7kfEu0/SLjuqup/iPAT49NDGv6eyPohmjcKIX8L1CyQLP+7rLHloXlB6G8XY4UQDtxb/ovU/IWsMmAxgnloUz010Rs2MXAP8A2VBiLzbZVvLiVR4gwaSoWuiJvZHh77/Me6rY3AnYqhoxpHwqsh+ZMiu9ipv4SlpIuRso5Q297dlOQCLJj4wDclSKRIltFOp2fKExzQTynt4CWXY9RWh7OE5Nj7pyh/oPpghCE8a32CEIQKCEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCECNbBNe4g7FOTX8/sgVDUIQlS6FS6BF7IQhLY1sEmpo7ocLgpiX1RE2PDgeClTGcqQC5ska0EXsRCd7f3THEgbBKmhVFsS5D9yqapqCCbFTSyWKpZRqNyla2Wqokcsp7FI2Yje/ZK9jbKKRrgPhUc4vRcXrok97VsmSi7LhNiab7qoEJLLqpNdDdpSRjfUADYXm3AXP2fGOfgIJXCS1mldA9VgRwSEHsuUfVBiU0UU4jP0lY2VJxZ2/jy3pnMGbvXkj6mWP8QeTtdaYxHEqevriZJAbu7q5Zv9R1ENdIXO7nutS1HXcVPVEyTAWPcrAyrmtnuvj1Tsikbx6Ijw+GVkp07b3W4emMxaHAaQaakNsPK5SwPNWgpabV+KaCB+ZJieebRA5jKsf7lgXZJ6Zh+O1ZaW0dIZjep6HDKWRkWIgEDb4lyznR6uqmWSVjMSPfhy1pmfm7iFaZAyqJB+60X1ljtdiszy6Y7nys+eU9nYcb4PTFpqJnfVOfOIdQVDmmtJv91h2LVtRjALnSE3WLYbTzCbU5xNysswqFgYA8DhV3lv/p3mB4vXVFaiYvifS89SSbHdUlN0VOX3LOFsaGmpn/M0KU0FMz5GC5TI5T/hsLx+GttGvqjpN7YSAwqxYl0jOXGzD/C21JhrXjZipZen4HuJcwceFYrv2zKz+GqjB7NJ1/T9RREyFpH7Ku6U6oqMHrmATkWPlZl11gkMEJ0MHC1dir/wdZqZtYrWxrdtHk/kfF1+r0dr+ljNmYVlMw1Z+cd16k+knrZ2IU0BdPfjkrxN9MPUEzMUp26+JB3XrL6KMdmkpKc6vyrex7U/6fPnknFRUn0elPQOKNlo4yXfSFm1FWhzWi61LlpiRkooru+gLYmGVQ0tGpbePNNHiHM4v47mZCy0tyP6TnMsCSEzD5GaRcqecsDLgrRr+nKzXRSOksbXKfDJqcGuNlTyvIdsU+md8YLj3WjWQaWy4ttpFkqRhBbsUqnj9JojmuAFiU1CE2SEa/gIQhJHaIyRCEJRUtghFwOSmFzj3QPFeABsE13B/RI9zgOU3U490D4/BE0sJN05Fj4Ug/2GaXDZPhYQNwlsfBT0j+DZPaBCEKNLRBtP6CR4s1KkfeyUOv4IWNLbkb2VJM0g8qr1AM3PZU7w2QkBQzfZJCXZBfS27iqDGpA6ldp/Kq+WMi43VDiMLnxOYBe6rSmkjSp17JmnMz43SU8lx2K4v9R9FUkVBDTa5XeXW/TrqyF9mXuD2XLnqCyzmqKWoc2mJ3PZUbpLR2fFSR5d56PqqPFJTcj4isXy26smhxqNskp+cd1tz1QZf1dBVzv9gixPZc54ZUz4PjoBJbZ6zbLNHW1Yzuj0eonot6ypnCmDpN7DuvQHL3HKeXC4XavpHdeRHpCzO/AT07X1NrW7r0Lyozep58KhaawceVAr2mUc3gb7oPSOh8Ux2MRnS/geVYT1JHHOSZP7WDV2Y0UrDaqH8rHMYzDjgBc2pH8pZXLZSxPGbpLTibmi6vpbC8o/lVDesKBtryj+VzTiud0eH6tVda3+pYf1F6rKfDb3xMbf6lBPJS+Gh/8Apl0v4db4113hcMBd7w/la86vzaw2kbIBUjYfmXJXVvrWpoo3MGLjv9a1J1x6zxUa9GLD/cof8pS6NjC8Lsqr3rs646yz7oqZ7g2tt/7li1L6i6SSfQa7/wCS4CzB9X03uOLcV/hyxfp/1ZzVGJNYcVJu78yt03dlDL8blV/D1f6JzehxORmiovx9S3ll51E+tjaQ82Nu681/TTnTJ1DNAPxhdqI7rvjI7E31lDFJrJuAtSmWzl87jnUvhv8Awd5ma0/ZX6miAiB7rGunJfgbq8BZLBPG5gAK0aviOGzouNmh1rOt90s4YGAjZRzTNab3UNTUFzeeytRl2UoRcmNkqWtFgqd8shN2lRlxc7ZTRQlx3Cnf+orWmLEZL7lVcRuRdRiHS3hKHlm4Krz+kb6KkOaAAQkabG6hbNqG9v4Ti8kWUTT2J7Ikc4HgfukSN09il3U0Folg0xjgQbEoYd054uNgms5U3/iPfwentaW8oa0W3CVESJoEIQpl8IH8BCEIfwj72CEIUMiSPwEIQoH8JF8HM5/ZOTWc/snJYsUEIQpogCEITgBCEJH2gBCEJEtACEITgBCEIAEIQgAQhCABCEIAEIQgAQhCAB3B/RU0vKqVBO0XuAgCOMAHYKdu0l/soWNdfhTIA1T6moHT9MTMaOWFeK//AGj3SVdVy4h7cRNy7svcPOfBzimCyR6b3BXnF6v/AE7S9TvqyKDVrJt8KC3v/wCtHzr+oXL3GBjlQ9sDvmPZafn6PxeA2NMdj4XsNm1/2f1XjeJTPZghNyfoWtKr/sxcVqHEjp93P/5tBVsfZ5ff938Wa7T+GP8ACfH05irjb8K69/yr00//AKXGLsk1P6ffb/8Axqdv/ZiVsdr4A7/+Gh9oqznJHmYzo/F5N/w5/hK/ozFw3/wD/C9N4/8As1qxlx/gJ/2J3/8ATYrDt/gJ/wD4aa0kQ/ksR5hO6SxZnNMf9qpKnA8Up3WdTO/heoU3/Zo1r3bYC7/YqDEf+zDr5dxgDv8A+Gmt6+E1E5yl+x5nQYfiA3NO7/arnhtHXl4b+Hdz+Vei8H/ZdYi+w/wB+5/Irph//ZaYiw6z0+/z8ip3zlo63i4w9kzgDBcKxI2P4dwv5Cy3BaGujLdURC7fq/8As5MQwiDX/gbhYfkWFdTek+q6ec/XhhbpP5VzeXGUz2zxjMjU1pmjum6edkLXPuFmeCYlFBFpk3R1F0VUdPOMIgLbfZWH3ZITpJIXO5VB9B+PcmnGPZkc+IxTSWbZTxX0a2hY9hsxlmGp3J8rKKKDVCP0XOZVWj1/is6M4onwqqtIA4rJKEte0XPKx2lphGdZ7K40eKsjcGFw2WROPbO0w8jejJaaCMtuVHVNbEDpHAVNSYowtA1pKmtbIDYqjamjqMWcZRKaepeXWB7KJz5CP1TtOt2wTxTOAvbtxdRbSRNYu+iOJjr8KpiFhYhMZER2T2gtO9+UbTfZLjxlvbJCWEEBqSwHARYWuD+qEjaNaEf1FaLkBPTGfME8kDcphPHpDHDe6Qm5SuII/dN7/snIgtbFBPYouTyUDuhKFb2SDgJHcH9EgeLJS5pB3Ub6LC+DQewPdBaW90nAv90Ek8lNIrAs08/8kaW//QSOIHdN1O5ulWyum0x/eykjAJGyjsTwE9t2hKWa2iVNc4EWCGvFtymB4JTtE24/wWw8JjwAdgna2+UWa7dNIbO0MQlII5TXEgXQvpTtipRGyEtN7qnklIOxunzSEghU53ViOtdmd6NMnZJrG6c12kcKKM2AKkBB4T9ItVroJX3FrKB7SDqJUsjgAqeoqGtbzwE6MUQZUtRH3YW3J7K04sHvaS0qSfEhG4jUoX1InFmu7K/RXs4Ll7tN9lhqaiSJ5u48+VQ1tSHsJcVdcYpPhc5pWKYxVSQksB7raxaU5HlvO5LjB9kVbN7oLWLF+o8Cr6vU6Fh/hZd01hFTjFYGCIm58Ld+XPpsqerImf8A4cXah+VdNiU6aPEfI86XpLs4txvpXGG6j7Lv4WG45g2JwOIdTu48L1CP/Z81+JQa24K43H5FjOP/APZo4pUSk/4C8j/0LrcJM+efI8hWSa2eZDsFxWoPw0zv3CR3SuM31CmN/wBF6X0H/ZkV52/7vu5/IrpH/wBmDXvZq/7vu/8A4a36Un9PMshbl0eXR6axjg0x/hJ/3bxgcUx/hentX/2Ydewm3T7uPyKBn/ZjYhq//YDv9imetaKjbR5kHp7GL2/DH+E89N4tG25pTt9l6ct/7MOuJuen3f8A8NSj/svsQnbYYA/j8igkSV6bPLv8BiMbtJpXf7U7/DcSd8X4V3+1em1T/wBlVib3lzen3b/6P/1Ij/7LDEowA7p93+xNTJdHnX0L0TjGKVrXNpXfMOy7Q9J2XOLwVtOXQngdlvDoT/s1qvCZ2uOAuFj+RdJ5IeiyowOpi/8AwciwH0Jy+DJdG2vQ705X01XRCVptsvVDIyIwYHC21jpC459NORU+Az0zzRlum30rt7LLCXUGGxxOZawCetkMvpmYNxdUla1zmk3VXsAqWqIDd04ry+kdELbFVkRs+58KipiQdiqljy25JTH9Hw+FUTYXTHnULBRmYkfMgPJ3BTG3smiInt+UI+E8AJeEjbZKCkUakSL6NkCEIUg0EIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQkfaAY/5ikUlh4SaWnslAYhvxGyc9oA2CaPhNwlS2DlpEiRztKZcnlIXAd/4R6silNCSOB2+6icbm4T3kWu1RpVEryntjmON7FTRkbFUwcCbBSRPPBT2ughZoqVG6wvdOY7sf2TXNP1DlRfC5BpkErNQuFE+MlpAU8gIG6aBdpsN1JF6LKeihfG9rrgqeCMG+pSewS65CkdEI26rJLF0N9nsp5Y2sdcBPBHtkqmqKktduU6Oo1MsSqMyRJ7MU62qC2GW3grk31NVAfDOS36SuuOsaVskEht2K5X9TGFsME5t9JWNmNRPRPF4qyaSPOf1AYgKaomcAeSuVOvuuJ6CqkLJSLO8rqz1LUTWSz2HcrizNemmdUyhh+orkc6ej6X8V4z3ri0QtzfxCN2gVTh/7lVUeZVXWnT77jf7rVs1HWmoLQSsi6Wwau9wOfqXMZE2e3cNxjikZrWVkmJx3cSb/dWOs6dfM/VYq/0lG6ngaXjsmS1sLTpFuVm2SZ6hxeJBRWyyU3T5hNyFWR0zoxYFVzquFzdiLqmdJqcdKqyk2dLVjVxW2NdJJF9SkgxHRs9ypKsybgK3zzTM33SQU9i2ur0Mnp8UhfyQpDKJXEsKxKlxCVsgBuVlXTVPLXPHwE3WjVFnEc04pN7LD1rhr5qVz7dlpvqDCpzXuYW8nwul+oel5JMPP+Qfl8LVPUHSQbiBJh7rXxnJfDyHnLYer2XD06UUtNi1OHA/+IF6t+iWrENJTgn8q80Mk8CEGJwnRb4wvST0cRPiigFvC3cb2PC/KJQkno9E8q6svpYiDtpC2bhkj/hAK1Xk+xxo4tQ+gLbeDUxe1psuhw09nz9zqX5HsvdBI90YN1UPfIRpcUUNNZmwU08IaLkLarT2cTc4lLoJdcqRsR1DSluy9v8AopY3NvstGooS+k0YIbuU5nI/VAaSLgbJWscNyO91ZJI7bHoSamnuhzrDYhJrol10KBc2TvbPYqONx1blTJrWiNrYISax4KNY8FIGkI/n9k1PBBFwk0HyECjH/KmWceP+Slew6TuE1oIFigNsa0AndP4TvbPYpCwgXS7YewicWgDlNOwukDy42IR2NlLoVCQOBNkqQYmCR/ylKkfx+6bJ6QpFISNh4UbOVK4AtumRNsd1TtlpDovTCZg0qjma1wN1WVJIbcK3Ty2cRZUJ26L9PZbMWw2OVpu0fwtV5sdDUtdhsx9oG7T2W36i8jSSsT6xphPSSMIFiCqV1nWzouMvnCxI8zPV3lTE41L2wW2PZcFZhdGOwnGHvDCAHnsvWj1TdIx1MVQ4sHynsvPLPfo5tPWSvDO5WXda0ezePYyyUkYbk513J05Vxgy6bEcldYZWepEUkUUT60beXrgPGcaf0/VuLXEaT5VZg+edRhYFqpwt/qWbPI0z0qjx6FkU9HqNQ+oykqIhetbx+ZUPUmfVKaZzm1bePzLzrw31S1EYDTXu2/1qoxD1Pz1MBb+Odx+ZVpZbRqY/jNan/qdUZj+ogQiT26wcHhy58zI9SFcXPEdb5+pah6ozqqMUc61S43/1LAsf6gqsTudbjf7qnZna/p02N4vTKK3EzXqz1DYxPI4Nrid/zLEMUzlxaoY5xqnbj8yxGtw+pneXFrjdQS4FUGInS7hQxze+jQn41VCr4WzrjNXFXl3+eTz3Vl6QzPxT/GYw6c7u8ql6ywh8bzdqtPTWESDFY3hp+ZbOLkqSXZwPNcHFNpRPSb0J9dVNbPR+5Le5Hdeufpmrm1WCQvcRwO68VvQ5Wf4fVUeonZwXrf6Y+toosIgi18gd10eLb2jyHn+L9YPSOv8ACakNY2x+lXWirnGSwKwrpvGxVwNc13LR3WSYTKZJh91tQmm+jxXksd1t7MgLjILlNlaXNTmMIYP0UzGB2wKsJmFGSTKSKns/dV9PC26aKXT8QH9qSI6DchWU/wBRsnvskfA3SqaaKxNlVGQO2Ca5ocLFMa2yGRQ6XB9rd/CnbwP0UmlnhM0JPUZtAz5gn32sho4CdoPkJUnsli0NQxgDkpaQLlDPmClWiTex6EITtDZAhCUNJ3T0+iFoRCSQEDdNZ8yH8GaY9CEKGfwcloEJzXgCyRxubqLWyUVnJKcmx905KkAIQhSxAEIQnACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACiLQ7lSpHAkWCAIRs7908c7oOxshAqWy3dR4YzEaUxObe603mDktR4655fTatX+lbzezWLKCTDIZTd7Qf2QSp/ro5Qm9I+EV1QXyYaDc/kVyovRj03trwpu/+hdPwYRSRnX7Y/hVHsQgWDGjxskbIZfszmKp9F/Sr4yBhTf9itVX6LenbnThTeP/AM2usHQxc2B/ZMfT05HxMb/CbsglBv6ce1PowwVrrtwsf7EyL0Y4O5wvhQ5/IuwDQ0TvmYz+FJHh1GAD7LP4Sb2NVWzkim9FeBEjVhQ/2J9V6KOn9G2Et/2Lrj8JTN/8tv8ACDS0p5jaf2SPTJY1+rOR6T0XdPMeA7CW7f6FdYvRv0vHDc4W0bd2Lp91HRg3Yxt/0VHiBhiB2aNvCrzr9kauJkSrktHH3X/pBwAUT/Zw1vB4YuRM/vSdDTmoMOGkWJ4YvV7FaKmxGJzC1puD2WnM2coaLFqad/4ZpJB+lULsbZ3/AAvMOM0pdHgp6jcj5MCq5yKVzbX+lcpddxDA6t0ZFrFex/rU9OZa2qmhox8p4avK31M5V12F4rKWx2DXHayxMrF6Pa/H+eUXHs1hgWNs90Xcs/wOsZNStIWoaaCqw+o0SEixWedJ441kLY3v4XJ5mM02e38BzTnFbZlxmtdt+VSkStl1g90kVZHM4FruSq5sDXRXPcLn7atM9R4zP/JrsKWveBa6rqaofKbFW1sBa+48q4Yf8FrrNugeg8dc56RdaaFpAVT7TQ2/2VLBUCMD9E91bcWVCUWmbqh7IkMLE0sBTWVOrunBwPCbvX0uUx0NLdJsEW+G/wB0+19gmODhyVG5Nl7aSAbbpXEFvKb2QnR/9iqW10CLb3QhSEc1sEIQUCQXYIQgG26ZInT0g7fuhCE1Echjr6jdInkXFkgjIN7905LZE1pj2Xupgwab6eybFbx2Tnmzbp/qN9/Qje4N7dlF7g7BEzg4myia4N5Rph+Vk4NxdKHECwUTTwbJ2seEjiPU9j3O1dk1/wApTXO1dk0usbFN0xs9a2MnYOVT2J4CqXnVwme2AbWUiejPnKKZGx302Ti8NFrpfb072UUziD+yljtleWSofBJJAe6pK1xDDpTpagjuoJqhh5KtVQbZi53IRjB9lpxCV7bqmhxIQfOf5VXimktLwsTxjETA/S11t1t4tHR5pzPKwi32XusxmOQFt1Z3YZ/itSA2+5VHRTSVUgaHcjyto5S5a1eP1cL2x3u4dl0eDi7fw8m8h5ePo9MveRWT8mKYjFenJBcPpXo96SvTJT1kNOZaAm7R9C1l6U/TlLPJDK+jB3HLV6UemjKCLBaeAPgaLMHZdHj43Z4N5Fy+oy7IOi/SNgcuGxl+Gj5fyK7VPo06fmvbCm8/kXTHS3T0EFJG3Q3YeFfo8IprEljf3C6Gin0R4VynKq+1o5KofRZgGoXwpvP/AObV7p/Rf02Ixqwtv+wLpyGkpI37Mb/CnEdNf5WrSh0jAnPbOU6z0V9Ou3GEt/2KlHop6fBN8Jbt/wDu11x7FM76Wn9kj6emb/5Tf4S+z2VLFtHJjfRdgBs3/CW/7Aquj9F/TsZ3wlv+xdSiKlBt7bdz4Un/AAbTazB+yjf0SqWkcuy+jXpoDbCG/wCxU03o16dcDbCW/wD8NdWiKndwxp/ZIaWmJ/8ACb/CQm92cnRejfBI3XbhYG/5FfcC9LmF4a9rmYeBb/Suk/wVN/8Amh/CUU1P2YP4T18EctmtejMpaPB9JbTgaePhWwMOw2OgjDGCyrGxxxj4WgJsjxdPiRyI5JDbYd1T1HxXup3NuE0xEi1wnELiyGnYALqZrdXdOiiIFrqVkOm/b9kj0SRT0QOABsEBxAsFJNHuSLKMgg2Kj1skXRKzklOUQcCbBSt4H6Jg/aBSKNSIX0RsEIQpBoIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAJHuI4SpHtJ4QNkN1u8pzXXG5TdDvCQgg2KdpP4RpyQpcSmuNhdKkdwUvSGttiaz4TSbm6E190u0RSexHONyEiEI2iJpiNbpN7pzTY3TQXX3CUAnhHshIpkzX32UpAeL3UDGkWt2UrXaUx9lyttIQgcFNLBa4Tibm6RzrbW7JVsn9hrRc2SVTiItkrB8SJxdlrJJPQ6MuyxV8rmvskpah19+6kxCnL3kjZRwQOBuOyoWvSZcqabKPqKMyUjzbsua/UXhTp6SewudB7LpPG6sfh3xW7LRuddH+Kp5Ro+krBzZPR3niU3DKWzzJ9S3T8hnn1NPJXF+Z2ENZVyh7fqNzZej/AKkuijUe89sXnsuE88uk56KeZ4jtZx7LkM1/T658Ouq/FHZoxuG0rKnU5o5WUYFDQ6GgNHCw/GpZ6OqcwHgqowLGp2OGp/H3XNWts9w422r1TRnWJ+0Ke0fhYXilRLFOdLjyr9HiZqY7F3ZW7EcOM5Lw1UJRkzsMXLhBfShpcQcB8blWU9dGXblW2XD52PIa0pYaOrLwBdMjXJyL8uTgo62XtntVGwPKdJgJqB8DSqjpjp6sq3tFitodIZWVeI6QYb3t2WhVj6Of5DyCmiD2zVmF9CVdZO0Micbnwtu5X5N4hUlh/DO/2rcGWPppmxCeN76O42+ldJZXemyChZGZKIf7VoU4++keV895lRFPcjlDHMiayPCHPfSv+X8q0JmNl4/Cq9xfCRYnkL1V6/yco6PAXj8K0HSfpXD3qO6IioMQmLYgLE7WWhVTqSPLuQ8khlJuL6NJZT4eIMWiaW8PC9EfR5h5ljgIb4XB2WmDn/vBGwAf+IF6Qei7plxpqdxZf5ey2sev50eW8/yCmn2drZUULoqOL4T8gW3MAgHttJHZYPlxgphoo/h+kdlnlE/8OGtC6LFhpHi3NX/ltaRfKVga2yWpYHN43VLTVgDN1MJ/dsL9lqQORseiH2De/wB0+OOzuf6U7GggA/8AJOEVnXBV+r/Uqy7Y5mzQEj3W2sl+UfomuNzdSongIb9kb9yhCcS66HM5/ZTKnAubKRNl9IpfQQhCaIPZx+6VIzj90qABJpaeyVITYXQNbAuA5SOeNKaSTykf8pTkiP2Gudc7FIDbcIQbApw2UuhzQdV7JyY1+2yemNaEi/bsEjhcWCVCimSjS0aLWTA0hxKlUaoXD0MqB/lq11URL7tCuswuwhUUkfxHYrLs3st1S0UboXlh2usc6lpnCF9x2WW+2ByCse6tAFM+w7KnYm1s18Gx/nSOVvUpTMME4LR8pXnz6hoIWTTfCAblehfqT/8ABqP/AEleePqMuKiax7uWVkbPo7wehWKJxtnBP7M0hiP1FahxXqGri1MbK4FbhzVovfmlv+YrVGJdNulkc5rb7+FhXTaZ9GcZxkJ0rosNP1Bi3uH/ADXc+VcabHcTePimdv8AdTUXTErpBeLv4V4g6Xexn/h8Dws622R0GPw8d/Cjw6rqp3gyPPPdZJh1OJW2cqWhwQREBzVd6SnbCLALOssZ0uJw8dLoc3CYZLDSE+ow2mjpyC0XsphK2Pe6irpPdhOk9kyux7LWRw0fxfDXvWmFwySnSza6suD4fDTVjSW2IKy3HsPllcSGn+Fj78MqY6kOa0/wtrEtaaPMfIONVcXpHSfpd6jiwmsp3GSwDgvSX00ZqUjoadn4oct7ryaygr6+ilhtcWcu2vTH1VXNfCHzO+YcrrMS59Hgvk2MoRkeseV3VMGK0kYjluS0d1tjpyIvLHFctemrHpqmGFr5CQWhdTdJya4I3HuAuhx7PY+eOfhqbMkewiIEBNgk/wAwbqRzwYb/APVU0UjRLz3WlGXZxTg2+i6Mc3TY8KOXSb6fCIzqZyj2x3Ktx+EbRFZ7TqAQ6sY02c7dSzO0sO3ZWSsmf7nPdSJbRDN/8Lt7od8pTg4E2BVqpasgaSd1X0ri7co9UQ7KprQLGyC4Dkoa4WG6a/nlDjomgxxaXj4UgaQ7cKSLhI/5imr6TRETTI0d05Qv5/ZSbHEzXN1cp+po4Kp28BSRi4t907SImtodK1zuAmtjcDchSoSb6GEdiOQhOfz+yao5fQBCEJqWhdscwgXuUocCbAplieAlaDq4Sjl2h6EISp6FBCEJ6ACQOSk1t8pJOyagB+pp7pUxvI/VPQAIQhAAhCEACEIQAIQhAAhCEACEIQAJNQva6VJo3vfugBUIQgBr9IaeEzU090rxqJCY8aRe6AHam+Ux+rkeUrAHc+E9reGo+D+kQh0lrKJ0rwd7qu0NUEsTXbqKTSYx6IWzuvuCklk1jbwnNjaTa6cIWg3UTZGQBsl9gpYzKBd11MxrAbn/AJpXuaG2uEJ7JIopair9sWVK7FC3i/8AKWuIJNirZO7SbApy+kvr0V7MUIddx/tUeLVT6lpEXJTGNMg3U9JSWfci6kcNokqbiylwuinveVp/dMx/AoqulePaBuFkDIGNZ8Isqara1rTfuEfjTWmXqsiUbE4nJ3qiyhhxvDKlkdEC4sNtl5SesD0u4m2tqJ2YY613fSvdrrTo6lx2KTWwOu0rlf1LemuixuglfHh97g/QszKoWj0Lg+ZlGS2z5381crK7pqplJpHN0uPZa+psUmoKj2nOIINrL0V9Z/pqlwV9VJFQuFnOOzV58ZjdJYhgeNSj2XANcdrLks7HSke6eO85+q7L703jklQ9oL+/lZ1QyiSmG/Zac6crqmnqGhzSN+62jgeKwmiaXO3suYysdJnuHjvKqxLbL1G1gHxJ7JGA2aqBtfHI0Wd/aWKpAPzLGyKdHsPD5sXrsurZxb5kGW/BVAyovwVLHLtysmcHs7GrKTRWRyOBtdVUMhO91b45AqumlHdV5wZo49qZWNubI0kgqNswOwCcHg7WVeSZYnctCFulIBfYJ7yLcJsexG6WI6qz2QaHeEaHJ6FInsnS2RkEcoSv+YpEovxbC4HJSam+Uj+P3TUx/RPZkgIPCACeAms4/dPDi3hMY/6hTpAt3smgE8BB3N05nH7qaKI5ReiWHSB8Vk2eRliAUijlFrp6X8K0/hFLcm4/5pic94Hw+URDUQVJ6lZza+jgx1hshw08qqY1tuFDUMBSOA6NmiEvFtk0uF7uKabMO38JpNzcqP0f0e7E0P1gmyUuA5KYxtzdK+1rnshReyhkPQTTNDdyqKpqG77hFXNYEX4Vrq63QTcq3CDfRzuZk+iZLPWMjG7la6rExGS4u2UVdXB/1K04vWD2DY9lqY1D2cNyvJOEX2V2IdRUphLNQvbysMxisNVVER73PZE076icRtPJWR9JdBz4zVs0xl1yOy6rBxU/p5FzvMfeyToTpHEMXqYRFA43tddv+kbIuprm0xnoCSSOQsH9PXp7mq5ad/4Nxvb6V6O+kf09MpIaWSSjItblq6rExFFHkHkPNfo1s2R6Y8iWYdSRSSUAGw7LrnoDpJmGRRhsAFmjsrZlhl/S4TQsYyGxAHZbJw2ghpmgAcBbteOktnhXO8zK2TgmVdJJ7EAHgJ5xJzdyqOqqo43WDkz3WyjYqzBM4C+xexUDET7l9XfypG4g9xs1W9sd3Xuq2jhbsVKnpDINP6VsEkz7E3U0hdba90tMGgBoCle1tv1TXLZBdrWi3TPkYbi6p5559ezjyrlJBrPCb+CBO7QmptEVK9UUtHVzgWe4qqjmledrobSi42VXBTtY1SEwkV7bpQWk7KTQ1NMYYLhPXwBji69gkDXHlPQnJ6Aa5gt8ISFpAuU+4HJTHPG7b/2nLYqj2PiLQ3dP1jwVC2QNFv8Aqla/V3Sa7F9SU6SO3ChfGHHZvZPG5slc0N4TWhr6KezhwCpm/KEaB5KUCwsmNaAFImtaCLlOSL6AEgblJqae6H/KU1vI/VSAPQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhNa8k2QI1sckc0FKhMc9CeqI0jr+BZONr2Ca/wCUqN2tsRx6GJHgkbJzWlycGAclH5Bn4/pBpd9/4QGu8FT6G+EaGpymN/GQhjjwE4Mda26fGQDcpz3ADUnqWySNKGsIaLEpyj1at7pzXEmxSezJPx66HAEmwTZWn+k9psboJubqVSI5JpELQ9p3KeZGHYlMkedk0NLu6itloStv4QVNMZPkHdQtp/bYXOHZXFjWtZuqartosFl3WaLtTaMWx10YkcFrPMbDI6yKQab3aVszGqQmRzie6w3qnDxIxwPhYWVL22dnwVn4rEzkbOzoEVkclqe979lxF6jMoJ3id0dIeT2Xp7170iysjeCzz2XNOd+VsVRFM78NfnsuYy109n0P4rzXpGK2eUHXeWFZSVcjnU7hb7LET0/UUb9oyLLtvNjJ1hfM5tL57LRPUuV81PI+0BG57LCnX7M9x4fm1KC7NTUUr43+24FX2hiZUMF23VVN0HVNrCBGefCyTp3L6rl0tMbtz4SLHbOufNwrhvZYaXpI1+0cBPhXfC8pK6okBbSOsfstsZfZRT1MjdVO48dlvnLr09/j3R+5RG3/AKVLXh6kc5yPl0ad/sc8ZeZJ1s0kd6E8j6V0VlTkPOHRmWg225at1dCem2mpDG78H3H0rcXSmUFNQNbpprW/0rTqxG/h5lzvm/vtKRh+VmT9NQxRl1E0bDsts4R0xh+GQjVC0EBXHDsAiwqn1e3aw8LEevevYsDa9gktYeVdqo9F8PJOS5m7NtbcuihzfrsLp8JkZdt9BXn36nHU9dXzNpwCS48LpDN/OGOqp5YvxQvY/UuXet5H9S4s4NJcHOVmFPeyms6Ua9bMEyn6RqqjqGN4hNjIP+a9MvRZ0s6Kip/chtYDkLkPIzK+SWvhlNMbahvpXob6WejjQUkN4yLW7LVx6zleY5BtPs6S6OwhsNGyzbfArhU0sjJBYGwVX0/AyKka3izQp6pg22W1TBJI8zyb5WXNsoIn6LA+FXUjwXXuqOSP4vCqqNoABsr8ImZZ96K+MbA/ZOeHAXCSNwtpCdLJ8PCuR6johS7IjUNGx/5JHStdwVTPJL0+LaylRZrRNpf5/tOSNOoXslSPpDm2gDgHbHdSKNrAXXUiZvY2WmCE/Q3wjQ3wgjBnH7pUhIaLBN1u8oEfweTYXKa8g8FIXE7EpEEbehCQBcph3N0p1d7pFIMBI/5SlSPFm7ofwjkJHubKZRRA347qVMf0dX8BCEKOaLSQEXFlHZSJrwBx3VOyPQDJODZRPYN3f9FI5zSOVG/VwFmWw7JoPoje0FpWMdYOb7EgusmmdpjJWJdUl0jXtA5UDijW45f/AHpnM3qJpZJoKhjRf4SuA/UN05UTTTOEZ3v2XpHm/gAropdUd7tK5Czyy8jc2Vxp/PZZGXX0fSfguVCHqmebuZXTk7KmQOYfmK15V4O2KR2sLo/Pbp2nw2aZ3tgWJ7LnrqDFKeOofFcc8Lnr4bR9L8PyNSrW2UlHTU+rdo/hVUr6eGM2A/hUuHyiQggcqpq8NnmjuxhP6LLtrbOtxuToTLZV4rHE4hpCgZj+nupanpeumd8MLt/spqHoCvqP/wC2d/Cz7Km2dBj8vjxX0gZjLqlwa0q74fSS1cYAbyq7B8rK98rSKV38LYXSeUFfNG29G7+EyNY/J57F/G1s11H0c+sNva5PhXGgyglrZGkU97/ZbvwHJKrc4F1Ef4WwemclXM0ufR9h2V+jaPNec5Cq5NI0xlzkTUF8dqXv+VdPZGZTVeGSxO9kj4h2V86Fy1o6Ix64Ggjm4W7su+msNpms+FgIt2XQ4lutHhvktP5E2jbvp3wuTDI4vcaR8IXT3SWJRsgjYT2C56y5lpqTQ2N44C3F0tXSPawtd2XTYluz568iwmpvZsttaJItimxBznggq3YS+SRg1G6u1MxoO62qm5HAWwVTaKymms2xUwlaVR2Oq7RsqiBpI3H6rRh8M6zSY+VpezbwrPV0zzKduFfCyzd1BLTsd9O9lPFFKxuK0WiKnIdqsrhAQwWT/Ya3aybo09lL6lVyJmvvYWTgLmyjjIuBdStBvcKOaJ65bJGkA3KQ7m6E6zQ2/wBlEW4kb+f2UcnZPcbnlNLQ7lKnokGtaeQpoztv2TAOwT2iw3Tk9iNbJA4O4SprO6clImhr+f2TUr/mSJfUaCEIR6iJ7HR905Nj7pyTWhQQhCbIfH4CY/5inpj/AJikj9FEQhCeAreR+qemN5H6p6ABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgBjmncpkrS5uylcCRYJpY7wgCBrXNddSB5A4SlrT2TjG3Te3ZNkK3sidOW7KKWpt3UkoYL8KhqH2Ju5QyZG/o81e53SipJF7/ANKgLyX3BTw8hQOQL6V4qiTYFLJI5zVBA0GxIVZHEx3IQnomjot1Yxz728K3VFO+/B58LI300Z7KN+HRyb6VPWu0SOa0WSCF9wq6maWDdVD6JsfATSzTsSrgnumOMoA4VFWyF4s26qCHckFL+HZLa3lKlsa7fR7KKHD5JmFzuCsd636QpcSoHxyRNJLTyFnUZgp6fS6w2VqxEw1V2gXuq16j6mhhZsoWppnnl6yfThBj1LUvhoWm99w1eXXqS9JFXQ11TUsw2wBJ+RfQZmPljR9QUkgkpQ7V5C5F9S/pSw+uoqqeLC2n4DuGrl82nZ6349zKSSTPAHrboCbpOrcHw6dJPZY5B1JLA/2Q+wBXa/q/9NlThVZO6nw0ixdw1cWdWdF4hg1e9hp3Ns89lzGVQv6e5+N87rWmXbCeoi+zS87rIKOqMrQb8rX2FSSU04bLcW8rMMJr2lgGpYWTVo9u4PndpbZf4HOcR4VVG64VJRuEgBCmeXRi/wD1WPbVvtHpGFy3ul2VUTjewKq43OI2Vrp6i5sVcqSRruT2VSVZ0+Hm+5URvtYuT/c3TNTfKC9o7qnOrTNV2uSJ3OBFghrhwVTtnJda+11K1wIBBUDi0WseTaKhnCVRxvNtz3Tw4HgoiadfYP8AlKaGEi6c/wCVDDcWCcOktDDsbKNSuaQSSO6iSfwhf+wDc2Una6Y3kJ6YTwRIPsg37BI3gJbgclPjJCtDX8KnlkIuN/5UsjieCoHbk3Uqe+ynYtEb373PdTUzg4CygkFgVLSAg73ViKeihPor2fKFFUqZny/soKtwDeeyX1bK0rfUoah4v+6i9ze6ZVSkHYqm/EG9krh0RvKUStNTp2TJasBm5VHJUG6p6mrLRa6WNWzPzM+MYi1tWDc3VkxCs+I2d/aqK6qOkm/ZWaulc4khX8envs4PlOVUU+yOoqHyH4T3VLW09RUM0NHP2VXQxe7JZzf2WUdO9JnFKhrGwl1/stvFqTkjyzm+biovsw/pnoqtxCuYBGSC7wuoPTvkLV4tVQ6qS+4+lSZLZBvxapgecPJu4fSu9/S36aGQugc/DPHLV2nHY6ejxHyDyBRb7L76X/TS1kVM6WhHyjli7gyfyqgwGlha2na3SBwE7JXJ2jwihhJogCGjstx4Z05FQxANiAsPC6unG1HZ4xz/AJDGbcIvsbhVE2jhDQBsrg1riy47hU9bIyAhoS0lWHWuf6U7T+Hn9tvvLbKSqpppJ9NzyquloJWtufCq6eNk0wdblXSKkboA0pN66Mu5bZZ20zw+1v6VVBTvDQVcvw0QN9O6DHG0WATCH2aKeNxYNwpWS69rFI9o2NkM0sN7Ju2Nb9iSxHxWTg4O4SNka4WJS2a1Ojtia0B0t3smumDeyV5BtYqGUE3AT0tMT20SCrA4P9KSGX3FStZ+YKpp2gcKVfByeyV3B/RRk2F09xACY7g/onL6SL6ROdpTCeSnP4UMjiL7qWOieK2D5fi5KkZJwCqV5eSpYdV90rW0DXWisabtCVNYTxdOUUiGSaJE0sJN0uoeUa2+UxrY0GggWKSTsnAg8JsnZIk0wGoQhOFWiQbi6EDYIQICEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAmucCLBOUaRrYq+gDY3T2nUL2SN0kb2TgAOFFIVtMY4WcUiV4+JIq8voiegQhCaOWmCRzgOUOcALA7phJcdypEtipCOdbtykL7i1kjiDayVrRbcKxBpIfpCs4/dKiwHARe6RvQP4ODwBayUO1ApiimlLDYHlG9FdrY6R7RsU33Gt3uoHucfiuqOsqpGggO/lVbrNImpo2yumrmNvv2VO+ta4WN1aZ654Ju5Uz8TDBcv/ALWPfc9mpViNoq8SY2UuI7rGMco2vcb91U4l1TFCHAzAbeViXUnX1JThxdUgWHlZN1kUuzoeOwcpyXqi1dV0kDIiSAtJZq0VBJTyg27rLOv838Npo36q1otfuueszs86Fz5I21zeT9S5zLsjJ9HrvjfG5cEpSMJzA6aoqyeRvtg3v2Wr8eycgxAkxwNN/sstxbNPD6ucuNS3nyrh0t1VhmIPAfI038qjBKTPW+NjfTBbNQt9Nr56kObScnwsy6S9MchLT+D/APit29Pw4PUuaf8ALN1snozBcHmDAGMO4WlRR7C8pzVuNX/TVWW/py/DPaX0g5H0rfmXuS9PStjaKdoIH5VmHSfSdCWtcyJv7BbG6Y6Zip9LjCP4WhXipPbPHue8qtfsosxnBctoaZrbwj+FkMHR0cLB/ljjwsqFDFGwaYxsjQwbFg/hX6qIo87v5jJvlts191ZhBpaGQtbYhvhck+pPqCpwt82kkbHhdq9ZUrZaCWzey449UPSktaZyyI734CmdK/hscflKdf7HGfXPWmIV+IugbI7c+Vf8oegqzqbEI3yRF1z3CZWZZVU+OnVTkjV4XTPpYyfDqmB0tJ45CI1EuZlRhXtGZ5H5EmCCCV1GBaxvpXVWVfS7cDp2N9u1vsqzLfLSjosOi/4YCzR2WZswJlAPgjtZX8evo4LkM38knpl2wyqswNB7K4hoe25Vhw5zmyhoOyvsLx7YBK1aYmBcv6U00dnbWT6ZhTns1O4UtOy3LVaXTKViJYAdrp8nFkrGiwsE4xki5HCniRaKV0RBvskDCDe6qJANtkzSPClT2WICMO1k5AZfgf2lLSNyEorYN+YJ6j4S63eUyX0YnsnQhCbtEb3/AAa/n9k3bsE9zdRvdJ7Z7FKNexqEpYQLpEu+hjWxH8fumJ7gSLBN0OTtoTTQrACL27pJW6inNBAsUOBIsEbQxxTGsPxKVgB5TGsIKka2yaySHTGuaG8JS0Bt0rml3CRrSDcprWyZPQ0kDkpHN1d06SMuNwml2kAKCcWxz1oi9seU4RDTdOa3e/8AScqc6nsWL0UVVEdJCxrF6Yvc64WXTxhzCbdlY8QpQXnbuq8qv6XcW70mjU/X3T/4hkh0diubM9OjwKOVwj7HsuwupcMbKx/w9uVovOzpf3qKUCMbg9ll5dW4nr3ifLuqcVs8oPVVgr6aWoDWkfEey416shqWYu8C/wAy9JvVFlVV4jPUGOAm7j9K5B6pyExN+Kvf+DPzflXPXUs904/yL0r+msOj8KqKx7GhrufC2z0plfPikTR7DjceFkOWmQ9eKiNslH3HLV0/lP6fXyQxl9GPl/KsyzHkbNflih9kc54T6epqkNJozv8A6VmGBemiRzAfwJ2P5V2F09kDBDGzXRt/2rKsOygoqJt3Urf9qpTxpMml5qor/Y5H6X9M7XTNEtEbD/Stm9N+nGnpWNIpB/tW/KfojDKUg+y1tvsqmaXBcKiLHvZcBRKpRfZmZPmWXa9QNNMycpKCx/DC/wCidU9L0mFRF/tAWHhZ31L1dgsIJbM3b7rVGZGaWGUtLI2OYX/VSJRRNh8hm5f+5QY111RYBOWmRrdP3U3Tuf8ASw1DYm1LefzLmPOfOAQyyPiqjyeHLWXTue1Q/FxH+Kd835lcx7FFicjiSsqbZ6x5NZsQ4xJG0Tg3A7rp7LzFhVU8br8jyvML0sZqOq5qcvqDwOXL0ByU61gq6GBvuXuB3XS4V0WeHeUYenLo6IwSoaYxZXqElxsFiHTWINmiBae6y7DZWvAv3C6aiWzxnNrcJsroIw5u5UzWaBZNYAGh107WD3WnB/wxrJDnO1DZRu+YpHHTyla4P+G3ZWotaKck5fCN/wAyRzb7FOczS+3/AFT3RhzRpUnskROmWtkDBaQD7qqbwP0UJiIF7p7XWFk19iw/X6PvvZOf/wCH+yY03F/unavht3VVvvRch2RITyAeyRrSDcpqnslFa0bFKhOa4AWTlJCN6Fa3Sb3SpoeO4ShwPBUkXtEb7Q1/zFIlePiSKVMYICdRCVJb4tV0qUaumOj7pyY12nslD7m1kxjtochCEyQ6PwEx/wAxTi8A2TXG5uhJ7HCIShpdwl0HyE4BG8j9U9NDCDdOQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACCbC6CbC6aXgiyAIy8g2Tw8lv7KMtcSdk+P4bXTZC6ZFNGXE2/wCSo6mnc65srm5zSOFG5gPYKvZ2xri9lojpH6twpfwblcGwNvqt+yf7bPyqCUWIolJFTPb2VTGC02TnPazlIyVrxslUZJki6+jk4kRhNSSm7bDwrNSftpiS/wDRTVEpJ2UYaZNypXMJcd0+BgB33V3rQ1SIHU7iNgUMb7arSARayhLATf8AhNTeivbLZT1UTpY7g9lTUdAZJL3VdMNLCL9lFSzCFxB8qC7WuxtEpRmUeN0DGwFrhdaxzM6SgxjDpYjDfUzwtq4rUNlZYDsrLV4ayrhLXMBuPCxcmPt0ddxWbLGkpbPNn1T+maPHRO9tATqDvoXnX6gvSa/CqioqRROFnE/IvfrMHKSjx2ldqp2kkHlq4t9Vvpvp3UdU9lGzvvpXNZtTTPXvH/IK5NaZ4V9d9AS9P4jI0RkaT4VkoqiSlkay5XVPqlyfOA4nUkQ2s49ly31FAcMrS1zbWK52+s9t8f5+DaTkZRgNSZmj9FW1cwDdIWH4N1Qyl2c7urieoo6l2prrhZdlEt9Hr3E8xCeuy8QSOablV1NWabBWOnxNspACrYnutqVSePPs9G4vkYNLsvLaouCeyYuNi4K30jnSWaCqtjTG4BxWfZVJHXVZcJxKoGyljk4vbhQEaYw4FOifqNgqU4tGxjWJoq43nv5UrPmChYLgBStIZa6hfRsVMc/hEXKaXgnlOa+wshPQ6U0hZOCoFK510wsPIS9aIu5PaEabOCkaATYpgZbcnhK11+EzTJoNIeXFpsEjjqN7JEJ0fo+T6EedrKF43upvbLiSEySMtuSpoRZUskmQyDv5T4HgEApjiHHSE32y0g6laiULdIuAnAZyqWtqAb2d2TS4hvPCt9dVFtwf+anhFbMm+cYoiqZgTuVSumDXcpssxfuLqmme53wgKdUORiZOZGK6ZNNU2FwVR1FQ6TYBQ1VS6EEG6t02NsiPxEKWGPPZx/J8s609srXiSb4SFC/DpHDdvKhg6gpid3hXTDsQgrbNZbdW6qJp9nlnM8/Dv9hMFwF00+kNK3tkVlgcYroWe0TqI7LCMv8ApSSvrGhsZdcjsu0vSdkxJNW0sz6Ycg7tW7hV/t2ePc/zyaembk9MXpoZPDTTOoidx9K7ryTyRp8HgjJpbWA+lW70zZT0tNhlM51O3YD6V0vgXTFPh9MAyNosBwF3HGxTS2eFeRc7L3cd9spcBwiLC4GMDLWHhXyFrJY7hUeLPbTR/D28JuEVrpBYnuulU4/j0ecX5UrLNsbiWGGab4Qd0tNg5jYCSrvDTNk+IhOqIxGyzQo3pjI3f9KKkpmxvG/dXNjmMYLlW+KJ5k1b8qqfDI4bOTJDbZJ9j3PN9v5Ub5CbkIcC1tionE3P/JM9ZaKU9gZXuNk4RvPxf9EkRAO4VQCwC3/RM12PrevpC0EHdSSPO2wQbX2TJNjf7J6Q6xp/BvvOStOs3PdMb8yqGMuPCckyLTG+0Txf+FLACNiOyVmlosRdMfKGm4KlXwkSaJX/ACqJziCQhkpfsh7S4WCfEliRTPAFgVA55d2U8kBO5KjdTkDYD9VKnHRYi1oY1oIuVJE3UUjY3AWUzWht/uhtBJrQ5nzJXP0m2yRnzBJM0k3CYQsZJUG1rqWM3aqSRjtlVwDTFY+FGRkrOP3SSdkjWnYpzgSLBADEJ2g+QjQfISbQDkIQlAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABRqRN0HyEAI3kfqnpGiwslSNbAa/i6anP4BTSbC6hdbYj2CEjXauycXAiwSKpgmxjmd/6TSSL/YKQkDcpjiCbhOUNEsSIgjkJ7eEObfiyc2IgblP9dLYSk9iJzmWF7oaQ0WKcmSQxtkap6kjVyFUSENuSqKqk1vsNkxsFKO+xJpWtYrTW1jS87qrxF7mR7KxV3uAGQnnlZ980ujYxK1IbiNWGMJB7d1iHUXV34NpAfx91VdSdQMpInNc/gFaQzYzPpsHglc6ax37rDyrEmdlxfFWXyXRceu84osOjkP4gC3+pc9ZteqqPC3SM/GgWv9S1b6gfUpDhfvltaRa+2pcV51+pubE6mUQ1zu/Dlz+RkRPZfHvGPdLcTpTM/wBYDZWyNZiI5PD1oXrD1PurKh//AOID5vzLmPqvOHE6+YtFU83P5litT1HitY8yGd258rEtnt9HtPDeLVRrW4nT49QpkqBetHP51mPSPqOpqQtL69u3+pcWMxnEmb+8dvupGdW4zTH4Z3D/ANybXNJ9nSy4OmFfSPRvpT1XUccjG/j2+PnW68q/VFR1EkQNa3cj6l5D4fmtjOHSte6pft/qW28oPUNXRzxMfWOB1i93Lbx5p6OB8j4uSg0ke5WSub9B1AyMCoaSbfUuiuk62mrKZjmuG7R3Xkx6VPUM/wB2D3aw9vqXoPk7nFSYhh0H/E3JaPqWxRZHaR88eT8PYm5Lo6DbRwPj2cqepw+NlyCrb05jf+KUwkZJcfqro9kkhtdaUYp/DzG2NlEu2WLHcNFRA+MdwtJ5sZUvxoyEQF1/suhXUJtdw5Chk6WpsS+eMfuFLGv+klHI2Vv6cUR+nDXifuuoj835Vu/JLKmPAHxuMFrAdluRuV9E5/uCBv8AtVfQ9Jx4VbTGNvslVMhcnk3OP0uvT0EVPSsiHgK6TUYmjJCtFM98bgLcK+UNS18WlwVymqX/AA5u2/2nst9PQaJ7W7qvYwtAaVIyNrZC48Jz7OPwrQhVKKEdmxugKanjF9ymsjPN1M0gFTKGivLtgRoOyHSEA3twnncbKnnd8JCkXwYRPqru037pzZC6ypQ1xk3HdTMa7YkJ0dJj4ySKmPe9k4i4sooX2FiFKlbEb2McLGyROcwk3unJGEfhIhCFENBCLgclN9z7J6+A+xxAOxSaW+EnufZHufZKN0K5t+LJh2Nk73Psm6m3uT/aA9Q/dCLg7hG3dHwT1FaDcbJ6BwEJW9iAhCEhIB42Ubmb3cFImydkj+ARtLgd+EpcLbFKRcWTC0hQTWw7GSTdr3VLWwAtLrKaQEG5ChqJx7du6hnHa0TVLckywYtSiRjiW9lrjr3phmIwPYY73B7LZ9eNTS1Y9i+G+6Ddqzb69o6zi8p48lI5JzNyDZjssh/BXuT9K1TiXo8jqakynDBz+Vd0V/TEEpOuG+/hUb+kqG1nQD+Fj20ndY3kE4w+nHHTPpUp8Nma44aBY/lW1ekMqqLBoWMdSgWHhblrunKGmaSIwD+ixHqrFKTBoXuLg2yoWUqK2zXxuTuy36wLW/CaChb8TGiysfUGMYdQtJ1tACxDr7PDDsJdI01TRp/1LR+Y/qYow10cVa25B+pZl8orpHY8VweVkyUpmzcxs2qHB4H/AIepaCPuufMxfVA6gdIDX2t/qWs8z/UE6qZLatHf6lzTmtmzW10spiqdj4Kx7ppS7PSON8Onak9HQ/UHqyfUPdGMR/8Akta9d+oiWuheRWnf/UubZutsWnmJM7ufKpqzHsQqmFrpCf3Uamd5geJOqO9GTZjZoVWKOfapJuT3WI9K9Uyx4o18kx+byrbVw1VS4h99/Kio6B9PUNlO26lgxvK8I66WtHbPpgzObRywA1VrAclehvp0zYiqI6dn4sdu68e8oetHYNUxAy2tbuu3/S5m86SppozUjkfUtzBk00z588t45xlLo9Y8tupm19Kwtkvx3W0cGmLmg37LmP099YDEKGH/ADL3t3XR3TtVqha4eF2WG+uzwHmMZwkzJTUERfMmxVWo8qlknvFcHsmQSnVda9fZx90dMuL5dQToTc7HdUetyrKQFwuVai9orQWvpI8Euvcp7QSOEJzObKRvolb6I38Jtk942v4TEPeio+5aHM7pyRnH7pVVmmWq1qIIQhRa7HewIQmufpKdENbHIBI3Ca14dyQnKaI310gJJ5QgoU8SMEJHGwuhpJFynPoY3sVK3kfqkSt5H6pv/iC+j0IQmksfgx3J/VIldyf1SIHDo+6cmx905AAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhACP8AlKYnv+Uph2F0AF7JWtJ3I2TWu1G1k9rjcBNkL7MXQ3wkcy3CchQtBtkek+EOBaLlSJk3ypvqgb7KOrnaDsSo6eosbAptWDfhR0zXBwuO6NaEb2XOJxe1LI0jkJKUEAXCdNfsFNHoCnO5Kkh5/dN9v7p8TLb3U8XtDH9Hpj22GyekcLhKQNbZSVMhY2xKpI3hzrkqpr7htwFbxNZ1vsqtz6FhpFVNE1zQFLSUTNHxNVI6Y7fqqymqQ2K5WPdL/pbha4r6UWOUMYgIawcLnL1QYDRvwOof7bbkFdAdV9RRUlM5xcNguVvU1mTF+AqITKLWO11hZktnTcJmfhn9PMj1kdJRVNdVlsQ79lwXmj0g+CueWwnk2sF6D+pLG6bFsRqGBwNyeFzZ1DlS/qaqPswF2o+Fh2w9j1zg+ZSaXsci1OG1VM8n2nDfwnYbNUCqEbmkC66axT0o4i6ndOKF9ub6VrLrrJus6V1zPp3jT9lFGmUl2e08Dzsek2Y9Quija03/ALV2Mg9oFrhwsIqcUmoakwvuLHurlh/URnAZfsknjaXw9b4nmIvXZlmHSu1D9VWzOkJBBVkwqscbP8q4yYiLcrDyqdM9G4/PjKK7K9sr9FnHaylgcBurdFW+5sVOycAbd1h3Q09HWYeatrsusct2ixUgdq7KgpqjsVXQHUVTsizpacpSRIwb3Sm3c/2ntjuSEyZml26g/orvWxbbXSFwBsSmuk0jZMMhJvZLpss1Wr1HucSdjsm6gDyk9w+EohcU+CYsp/8AB7Xgjcp3JsmsiIG4TgNBvayWMWnsf+VKJI1tm3A/VRTuFjunOqA1u5HKpqicEEghTR+FKyzbIpn6TsVA+pffcpXv1G5UczQRcJ+22UbpjxVOcLalRYjKyxud06WQxqlqmumaT9lfxltnOZ+SoplIKlrXkEqaCWAkueVaq5z4XXKoKzGXRR2D1tVVto4rO5GME9sumOGKQExELFcUpah5JYDsrjQVs2IP0i5uVmXS2X0+POAEBOrwFerx3/DzLyDmIqL0zVEVJiZnDRE4i62Bl503XVUsZdA7kLcHS3pZr8VcyVtC83/0LZnS/pcr8GiZI+geLb30KyqG3vR4ZznOJSf7FPkDl8yoqY3VEPBF7hegPpe6PoqWSlAjbsAuTOisCPSUobLGW6T4XSWQ2adNQVkEZmAtYcq9jw1I8p5jmVLfZ6SZHUNNTYXA1rRcALbDb+1Zo7LnL0/5kxYlRwBsoNwO66CwnEhVUweCDsO66XDm4x0eX8nlRuu9tlNjlO+WPYKDCY3Qmx8q7VT4nts6ypooAXlzfK3YT/UyJNN7LjSPIZueyfKBJtfk+VBGS1tgnslAd8RT1INvRJFE1p3HflOldpNgAhha/ukLQTcqRPoXXQvt6xu1Ry09hfSptQa3lMlnbYhOaTQ3og06drJWk6uUFwcbhLE27t1G4gShotf7JskYOwb2T9NrAeEJ8Y9aCWiFsBDr2UzWG2wQpG8D9Eeoq+jCCDYqnqTpPKqX8/sqWqaXFOHr6JDJv83dTtkBG5VKxrmng8+FOwEDcJU9EhKo5QSSApE17eXXTk9gRtYTy1KSG8p7OE1wDjcpRdsQPA3ul1a+91GRY2CdHcblNkNb0OMGr6VJp07J0fdI/wCYppG1scz5UqRnH7pUj+CghCEwAQhCevgAhCEoAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhADXkEbFMd8pSprnWuLJV9AGEAblKHA8FNa24vdOa3Sb3TtIVLYOIsRdMQ91iU33PI/tGkSxQ5O/zE1Pabi6H8I39GEn6krHONrlDxckJWsAAP2UUkJP4Mn4KopNPuWVbObA7Kikjc6XU3yq8/8A0QpP2Ia+EOjuQsW6iqjTxPsbW4WX1bLxWWB5gVTaKjle42sCsvI6WzpuKSlYos1Rmp1c3DoZCZrWae6409SOcQgp5mtq99+Ctz+o7MmKhjmjEwFgfqXCGefWE2OVEkcct7k8Fc5kpt9nsvAwgvVaOffUZm5X11TURx1LiC491zN1DjOK4pWuAc83K6N6wywxDqSoe8ROdqd2Cx6D05VrZvdko3c3+Vc5kQ7Z7xwEqq4R2aKpOl8Sq3CR0Tv4V1b0jWRRAmM8dwt7wZPNw+Oz6a1v9Ks/UXSkVDGR7VrfZY97ls9Y426p1rRp9vTVSRu0qGq6clAA0rO6uCCnLgWWVnrKmK5FuCmVT2zWkoyjpGB4rgs8TSSFJ0rWVOF1TXiQizlklfDFVM0hoVqqcK9j42N4K2cabTOT5zA9629HQ+QOcc+EzxB1aQRbuu+/TN6iHVJpoJcQuLDly8keksfnwyqFn2sR3XU/pozXqIMQpozUeO62MaT90z598sxNKS0e2+SOYrcYoYWtqNV7d1u7CmfiIxId7hcO+j7r/wDxClpQ+YG9uSu2uj8RjnomG4Ow7rpqEpaR8/8AMY06W3ovMtIwRC7UtDExjiNKmltJECCo4o5GuuB3V9Vr+HKyl/0uMTWgWA7KSShbMLlqo4ZntIBurnTSF7LHwp41v+lWxv8AhQvwtkbdVlGHNgfYFXOob/l3Vnq2PMvP9K1WtFTXZXx1YfYXU8TNVjZWymil2ICu9ICI/iG6tPTRK5fqI86BsmfiBe1z/CfJvt9lBo+K9+6aM9mVURcbFEkLXA2CWH5E5AhSimdr/dPEBvwp0IAj9m29kpaRyE9IQCLFADEJXCxskTW9Do/CRMdyf1T0x3J/VCTQ0RMfIQNh/aeoX8KWPwevgz3jqufPlP8AxA8n+VDLZtyVG1zSdgn+rHJbRVCe5tcpwcSL3Kpw4E2G6licSAEjWg9SVr7bFOUfKeXBvKY9DZIka4bBKowe4Kc14t8RUfsMHISa2+U0vN9inAOLgDYprnB3CQknlCA+jmtIIKcQCmanWtdGo+U1xAbNEA3/APUrZOw+5wrlK+w3KpH6C6yisWkWan6lvngDr3Coamja4ccq9ywa27BU5w50n0qhaky7Xf6/0xmvoWxtLiArFiEzYr8LL8bw+VkZ+ErBOry+ipZJTtZp7rNsr19Og41u6SWzGOsOp4aKAkyDhc2eoDOOHDqKYR1FiAe6zPODMEUUMrRPawPdcP8AqRzXllFRC2qPJ7rKytaPZvFeH/JOL0a09Qfqcq6KtnZFWO2J+pc5dR+pbEa2ch1U47/mVvzsx2fFK2Z3vk3K1KcPnlnLiSVzeVNJ9H0r43wFbhFtGwcQzYrccJZ7zjf7qz1MkmKyEPJN1acNwt4ItdXmgp5YZBqCwbbdyPXuM4emEF0LB0kxzNZb2SnpljXbhXynlcYtvCp6moLCUkZbR0UePqjDpFt/7uwjewVh6ipm0Lvg7LJ34gRcaeyxnquf3ml2nsrMH/w5HnMKuUGkUGHdVPw+qFn2t91076UMyZnYlTR+6fnHdcbYrVvhn1NvsVvj0kY8XYzStc8j4wtvClp7Z86eX8VGSlo9tPSF1HJXYdTkyE/L3XZXSFUH0zN/pHdcE+ivEHPwqndr7NXbfRmJAUrR7n0hdXhW7+nzL5Px8qpMzkzbAX7qooxq4VmjrNbRurphEpe6xK3qZ9Hm2XR6lyEQsLW/hVdKCRZMih1C5CniY1h/ZX63tGQ1qQOs07lJrA4KiqpCO6jZKCbXViMU0P10VXITXt22TYnEjlSI0VpRakI3bbygusLkJxaA0FNf8qr2R/XosR6iNJ1OBCemMIB3T1X1oRPYj/lKZxe6V1+90xziCRdOSJogZB2Ccx1t1C8kWsU+JxNrlSxHSSaJmu1dkqRg2SqeJVn0MdyUoeALJHcn9UiV/CD/AMiRSWA4CjUiYTIEIQgeloEIQgUEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgBH/AClMT3/KUxAEakbwP0QGg8NCc1hB3CPo32QjXaRayX3Psl0tPZI9oA2Cb6i+yD3PsixfuEjQCbFPAA4SeoeyKSeIX7fwkigGoEBSykfUkY5uoAI9RSaMBrbBJIATuE5nyhMnJBFika0I/gy13WT2C1h91Hc3unsfuLnuljJaGpbJbDwE17RbYJdbfKaXnuU7aD1KLEiGtLfsrNuZjv3V5xQDQXfZWQP/AM7fyql8loifRXxQ6mgnuoMXq20FG6Qm1mqpjeBFcFYTmx1J/hWEzETWswrDvnpFadvojX2buadPhtPJG6osQD3XEnqUzliqBPHHUE3J+pZB6os9X4ZUTwtrbc8Fca9eZl1fU2IOYKguDnHa6x7f3JcbOdcvpj3WmMVnUeOPEV3Bz7LbXp+yPm6oqoTPSA6iOWq2ZKZPzdY4lFO+lLtTx2Xd/py9PLcEZBK7D7Wt2UCp2dnxXNOEl2a6qvR1Rv6aM/4BlzHf5PsuPfVz6YJMKpKmSHDwLA2+Fe0zcvKR+BtpzSN+TcWXNvqf9N9N1Lh9THDh4cSw8NV2rD2tnp3C+S/sls+eLNLLevwnFZQKcjSTw1YZhkdTSVOiVp2O916TepX0a1WGVc85wk2N/pXG+ZeS9T03USu/BFtnHsi3Dfqex8D5J7NfsYTh+JxtaAXAKs/GtkIAdysVxFtXQVhi0EWKrMPmqpACbrms3H0/h7RwvOxnBdmWRTBrQQVUwzXF7qzUMsosJD+yudK7VuuXyanGR3mFyyk0tlypnX3/AOquNLUBqtUZLNwpmVIFt/7WbZA7TC5ByiX6CQO3umVTwdh2VHSVZ0gatlM6TWNiqno/Y2q7vbsY8lNbclSCO5sQpoaYO4Cf6s1aXuJC0EnZVDC0N3Cc6FrG8Knkk0m11JCGgtlpFQ4gMuFBJJvsoXVg+W6aJC8bFP8AVlaV+kEkjiFDK+wJKmERIv8A81T1LC26b67ZWsyF/wBIZJtrpKeoDiQSoKl+lpF+3lQQT7l1/wC1LGHWzKy81QX0qKyRjdye6gbVQNbqLtgFbsYxMx3AcrDX9QSQsIa5auFU202cFzHLKCb2V3U2JQhrhGVi09XLUyiJgvcpzq+bFKn2mguud1n+XGU1V1NUxe3RucSRbZdRi43to8q5rnlCDexcqehavGHxn2Sbkdl2D6c/TpUYtURaqK4NvpUfpw9LtW50DpcNO7h9K9DfTB6Zo6NsMr8O4Avdq3YYfWzxPyHyZS2lItORfozpqyjidNh7blo5Yth9ZekCiwjCHSR0DNmflXVGWWXlJg1JHC2kAs0X2WRdedEw1uAShlMNmHspf8OSWzw7mPIfy3OKZ45eofoWTo2slEMNtJPAWr+h8w6vC8ZYHSOGl3ldt+rvJmXEJ6iSOi4vwFxF1T0FV9PYw4iFzdL/AB901U+r2cByHJylvs7u9JWckb4aeOeo8cldwZedcUmJYc0tmBuB3Xj1knmVU9MVMTDUlulw7rt/0758OxGKKF9d2HLuVepaijmp5rkztJtQ6qeDG4q4UUeiOzuVhfQHU8eKwscZb3asyE3w6mlaVVvRaqu90VLjp7KGSSyi/F22ulZeQhWY2lldk8E7hsqtrg4XCpGQkAOUgm07AqzGWyXbTHTS2uASqSSocZNKlle5244UYhu7VbdWEt/A9WTUzS43uqtsewsVDTRkC9v4VTwla0IR6g11ilcQeAh7Pi1WQATwEukwEQNjdKWkchIk0LH6K5wdwmuYHcpUrLd0nwk0xgiaDf8A6JwZfhoT7NPYJbAcBN9g2xjm6d7prhcWUpAPKZpd4TPfTEGtbp7oc0u4Tixx7f2k0lvP/NSJ7Q5NDDGT4TgLCyVCURvbFa4N5Q43N0iECD2cfulSM4/dKgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgR/CNMc07lSvaANgm2vsnJ6GL6NZxZOJsLqMu0blRmoubXSb72SIiqZTq4/tJA4v/Yp74xKbgJY4NAvZPJU9FRFx+ykaAW8KCJxB3OylBPYpGiKX0VzQCkTZHOvyhriTuVFICOpudx5SQRscwuclmsQVTSVRi2BVeS6GpfuLWEEbLUeemJGjwioc11rArakshfESFo71J1xhweoAdb4Ss3Jj+p0/Cr/AO/Z57erHMGeKuqImynk91zLT1MnUmLCN9zqdxdbX9WuJuOL1H+Z3K07lriEb8eja931hc7fFuR7Dw0vSKZvbKzICPqGFkjqYHUL7tWcYt6WaemovcZRN2b+VbP9MWD01bh0LvaBu0LeuJ9C0s+Gn/hh8vhZt2M5RbOxr8lWDKMDzhzByUkwtshZTAc8NXPuZnSklG6Rpj4J7L0rziyvifDI5lL2PZca53ZcyRVM1oLfEVzGVVJNnrXjvPLIjHTOOupcLnjlcGtWK1OGVjpD8J/Vb3x3LuSardH7F9/CpIMmJ5LSGlJv9lUri9npNeZH1TbNLQYFVEXcz+kV+EiOAl/grc+MZWvw2kdJ+FIt9lq3r6J2FNe327WutjGi9jMvIqtr0a/rSKSoOl3dbUyD6ilp8Wg0vPzDutHY9jjzVOseCthZA457uNwMc76gtvHXaPGPKMOFjbR68+iHqqZ1PSXkPI7r0Ryyxx82Hx3de7QvMD0SYjaGk0u/L3XpHk/M6WgiJP0hdJi7ej5+8lwowTNx0U5ljBPcK4UjGv5CtOGgtp2K5ULnF2y3KYb+nkGY/WbSK11Gw8KeDSy2yjMhaN05p1BW1VopqXsiWWzht4VLJSNeb2VSwG1iEvt/6UrXqMaSIoKdjGjZSagDpATtB4smOY4HhO9tg3sVzS7hIGWN7p/Df3TGvJNko1vRK35QkeSDsUreAke0k7BA1vYz3T9/5R7p73/lO9kfZMc0AbBAjehweSLglK11juSmMBF7hOQJ7EgIIuhNa4AWKXW3ymy+j4/BUx3J/VPQl2mOInOIKifxdVD2ajeyj9sHk/0pE0OTWilkGs2KGU9t7cqo9gXune39/wCk/wBkL7aKZsOncqVrQACPCeYyOEoYe6RvY/2TGjkJ7m6u6T2/unJkhrkAFhZCE1/P7KHsjHJWgE2Kja4N5Tg8eVIlsBzhY2SJC8XTXODuE9JD0hzjYXSaz4CahNa0GkD/AIxYqIU/x6jwpUKvaD9l8GlrWC6dG6M+FFUO2sooJCX2Kz7WkyJSmpdjcbgZJTOdpWp81pfYw2drfyFbZxd9qIn7LT2b0hfQTgflKzr7P1Ou8cTnkJHEHqR6nqKJ07WvI5XCudGPVVbVTa38uK7a9TNG6V81x5XDmclMIJZjb6isDLnpH1H4ZSm4mhusKBlXUP191i0uDxxu+Bn9LJ+qKlzap4HlWVkuuQXXL5c3vaPpXgdQhEbhdExj7vb/AEqiqMDHWYpXRgw/ArfLDKZbl3dYs5NyPRcXJrhDsr6aUhmkf0mupJal5a0E3VThGHvmAAF91mvSXQ02ITsAhvf7KaCKWfzdWPF9mF0XRtZW2LWON/sqPqDLHEXREiB38LqvLzImWvhY51GDe30rP2eltuIU3xUQ4/KrlcejzzlPJ6ZScdnm/iGU2JVNVZ8D7H/StsennoOfp7FqeSRhFni911XjnpHZSF0ooht/pWIV2WsfR1Xr9kN0HwtXHkkeb8vl0ZUG0dh+kLrqLCqCngkkAsB3Xa+XvXtPVxMaJhu0d15NZdZ1Q9KVLIPxJbYj6l1nkH6iGYvNBEKsm4A+Zb+Lc18PDPJsKi5vZ3/gNf8AjmsLTsRysrwqMMAd3WrcouoI8VwyGfVfUAtn0E4dGC1dLjT9o7PD+Xo/Fa4l8hqAGgKeGQSOCs4q7bBVuGymR1rrTqmjlbq2pj686DYeVADY3VTXC3wqJkJtclaMPgiW0S07zp3CqIxqFyqZoNgFUQuFrEJskRNd7HPP0qO+olpUknZJpAGryoJ/By1ojc2xsE9IS2+6NbVXb2MXTB/H7qMsF9wpNbUhGvcJ6J4vrohfGNrlOYwNAITns7XSxsLbKSI5voVhunJQ0u4S6D5ClRBP/gwsBN0mjflPLSOQgNuL3Tn8IVHsROa4k2KNB8hOGwsmD19BCEIJAQhCABCEIEbBCEIBfAQhCBQQhCABCEIAEIQgAQhCABCEIAEIQgAQhCAAi4sm6B5TkHYXQAwHSSl9z7JuoOcQErPmCCMXWfASFxIsU87C6j7XQArfmCVziDYJgcCbIc7SbWT9LYumNlbqF7pI2AOG6E5rTcFJpJDx4eQLJHkOPxWQoqkHsoZg10LdvlK0gnlU4Lj3P8p7GvtdRJ9CRKkhoF7qnnqQ0WCJXaRyqOVxeee6ZK1IdJdFVNH+IptQ5srUyhd7pc7ZXKnqAyPQeEzEZIoKZ03ADSql1u1sr2x3HZZ8Zxulwqlc6SQbfdc6+pXOGgo8MqI46ltww7alX+o7OaPpqCeJlSW6b/UuBs/vUdNi1TPSNrXG5ItqWHkSbMW+bbNW+qLMWoxnFJ2wzXu48Favys6exDqXH445mOc0v8LIKrCKzrrFdYBcHOW/PTr6f5G1lPMaPe4PyqtCLkyqpyUujoH0c5D0Ypqaean3NibtXbHSnQNFhFAz2ogCAOAtb+nDL1+B4ZTl8YFgOy3zRxCOHT9laqpUma2JdPZb4oCG+yW7WsrL1P0RSYpC90kQNxxZZbIyJnxEWQGMkYRtay1catfGdTh59lbUovs5G9QfpswzqGhllFCL6T9K83PVZ6WPwUtR+HoT8x4avbnrDp2nxGlfEGA3aRwuYc9fTbB1FHNKKNp1E/SpsilKPR6b4/z8trbPADNHJCtweumk/CuGlx+lYG/A5MNu18ZFvsvUr1O+kh9AamaPDxtf6FwznBlRWYDUytFLa1/pXK59K7PbuE8kUYrs0vT1jTIWO2sVX01cxr9LXKx47BV4dVOu0jdUtFi7xJdxXH5VDcuj1PieejY12Zi7EgLbpzasOFwf7WLyYzcgAq5YZW+8Nysu3HcVvR6nxHKqcV2X6hxAl4YVd4Zm2vdYvHOGSAgq5UteS0AlUp06Z3OFlKWuzIqcNkPKrYY42tBv/asVLWlu4KuEdYS3cpqq2dRj2xcSorNIFwrVUykbWVVUVOtvPZW2omBKk/CJfakhjnkvuB3VRC4jlQwAHdyncG6dk9VbMO/KUf6OdUiMKkqqwOvdU9fV+0NyracTa6S1/wC0jp/4YeTykYr6VdTJrBIVtqqw0n7q4RObIy5KsPU1SI2kN7KWipuWmchyfPQin2UuJVzZgTfcjyrFU0tZXv8AbhY43NtgqyggqcRqWxsBIcVvDI7IWp6rniL6TVqcOWrexaNNJHk/PeSJJ9mvMqMncUxuuY51O83P5V2/6WPTDLLV0zpqFxBtyxbH9PHopMntTOw4cD6F3HkP6V4MCZBI6iaLAfSuqwaf2R4zz/km6pL2LHkJ6aKGnpYHuobEW+ldW5bZcUmAQtZHABYflVx6Gy4gwikjDYmi1uyzahw+Om5AH7Lp6qE0tnh/K85K5tJk2GYa2niaWjgKbFKh0tK+mc3YtsVUMqImsDdk408dSw2HIUkqf+HD33Oxt/057zrypgxyGWRtPq1A9lxB6jMgmYYZ6xlKQQSflXqXjfTUVTC5srAbg9lzR6ncrmVeG1DmQDcG2yoW1JMw8tS0zyh6iq5+l8TdHct0uW5PTlnSaKuiifV23A3Kwr1KZdVeG4rO6KO1nHgLWnQGK1+AY2wPcQA4d1UbUTn5yakex/p0zPpsVo4S+oabsHddAYbjEVXC323A3C80fTJnE6njp4n1ZGw21LtvKHMKLGKWFpn1E27qSqzs0cKe5dm3xGXH4VWUkAa0Fyp8McJ4A8d/KqpZBGwgeFehM3ILrY908Qd7ZKp6lxY67FbKmsl/E7Hurnh7fxUfxq7VYmiTWx0BL2gFVkVO0tBJUbabS64VRGLNV6D6HhtGLAJBIb83TZZQDZRF4uCpUtiPWicvJFrIBI4KY2QaeE5LpCJIVztQtZIkfwmJqW0OS/4SITWuA5Sh4Jsmy6Hr4Pa87BOUY2N0/WPBUTY16E1nwEazbhNQmbGtjg89wkc7ULWSIUsATQIQhSCghCEAPZx+6VIzj90qABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgASOcW8JU1/ICBH8ELiRYpAbISO4Ka2MI6nYXsqQm5uql7i8JghDj2THLQ9PYU5OwU4a1wsSkihDbFSIVmmSJjRE0cJXHSNkqE/8ALsa12NA18pjyWmwUqjUbkPSRTTzvsdlSFxkksVWzRDv58KllhPubKNsSMf2GTWjhP6LQvqW0vwmpufpK37UU5NOe60D6mYHswaqI2+E/8lQyPh0nD/8A8x5U+sKoEGL1Fj9RWk8sKwu6kjsf/MC2v6z610WNVDSfqK0dlbidupIyT/5gWBcv2PV+Mlqs9PfSFMX4fTA7/CF1RTYeKjDLkdlyP6NcSjfQUoJ+kLr/AA+vp2YXyPlTJQTgVeTlYtNf9NVZrYFCKSUlnY9lxF6hWQU1dMNI+YruPODGqeLD5nahwV58eqPrGnp6+f8AzBs491zGbXub0ep+E3XKEdmuIKKhrK0uLRe62J0RlzR43E28A/hc/wCD5iMOOe37u2vz911b6eMTo8WgiBcLkBUIUrZ67k8hKmnaMV6/yKL8OeKekPB+lcs56ZCYpBFNKylfsCflXq5h2W1DjlANcTXam+FgGbnpfw/FcOmkFG03afpWvRjtJHJPyuErHFy7PDLrboXF8MxOSKSBwAd3aszyFwOamxqCSUEHUF1V6k/TNS4FVzTNowLEn5VpbonpX/CeoGQsjtZ9th91qUwSMnkOVhkRb2egnocjcfwcf3C9MsoKcxYZE4DloXm56GqJzZaQEd2r0xyngDcLi1D6AtzDT9jxryuyLrk0bRwtpfA1tuyudJF7ZAPdUWEkMjaT4VfHIC8ALpMbs8PznuxlQ4aha6lhb3Kazn9lMwXAAVqTKa6QreR+qc52nsmlhAukUf0B2s+E0m5uhCak0xQ7WSBgBulQnEbXY9vyhKTYXSM+UJXcH9ECDNbvKRCEumMb2CRx0i6CbJrjdGmN2hzXXG6VRi/ZSJGv+joSHh4KNQ8piFGnomT2SJrwANglZ8oTS4kWKkXYjemDfmT7DwFGDY3TtZ8BOaD2F0jwgNbfZJrPgJpPcpNaD2FcLO4TrMdwEwEJzO6QVNMQtI3tsmP5/ZSv+UqJ/P7JEtCjCQOUam+UObq7pPb+6kS0PS0OBDuEuh3hEbABf7p6UUZod4SEEGxUiY/5imyAQmwuVG6UE2+6e82aVCWm+wUMl7IkikLINTNvChgY4SXI7qpbHdnxJo0tkCzMhKJHL12UuNO/4ItB7LUGagvSzD7FbexmxpTY9lqzMihdNSykd2lYeRLR1fjclG9HE/qNw9j/AHTo8rhXPfD9EkzrfUV6D5/4HM9sp0E8nhcJeovDJaYTnSeSsLJf0+o/D7FCMWcm9XsLa54HlWujoZpnjSCrh1bK84u+Mj6leukOnZcQLdMZN7dlz2RHs9z47lIVwXZaHYbPFDf2zwrVOydtQG6DytzHLGplovcNO7cc2WLYrl+6lqgXxn5vCzJQ/Y2//nWoaTGZb9OTYrM1hiJuQunsl8kn174pHUhIsOy1pkV0tSCvjbK0fMOV3Fkp03hVLRRODG/KFaqrTkjief5y1VOSK/LjJyjoaSMPoxwL7LOR0TQUMVvw7Rt4V8w+WgoqdobpFgsf6y66ocMB1TNFh5Wgq4wR5LZn5ubkdb0Y/wBb4XhdJh73OjbsD2XIXqN6hw/DJJzC5otfgrdOcWdNPDQStjqRwbfEuGPUnmu+smqNFRe5PdS173s3aca+VHZhPU+bslFjpZFWEWf2K6Y9HmbVRW4hStfWO5F9152491TU1mP3D73cup/R31RJRYhSue8dr3K1qJ60cTz+HYk+j3N9MvV4rcCpg6e50BdC4LXNfThxcuHPSVmHHJhNI0zD5R3XW/SnU8dVQtIeN/uujxbdRPF+cw3KWzOPxjC75ldsHqBcEuWH0lW6d92n+Ff8Jlc0C4WvRI4LLqSkX2pd7jwQntj+G1iqaJ+qxKrBINIsFq1vaKevURkQBuQngAbhND7m1kF5BtZPb7IpolBaQLlDradlG12rsnajbSoJ7ES6I5LDdR63eVM5mruoXN0qHW2Ma0DXEncqVj22sFCnx7C/3T4/RFNIlIB5CVoBNlGJb8WStkIKkX0X8qZKGgcJU1rySnJ4N7AgHlAAHCLjyi4va6Aa0gQhCBF9BCEIJAQhCABCEIGP6CEIQLH4CEIQOBCEIAEIQgAQhCABCEIAEIQgAQhCABCEIARxIFwmlxtuUOcdwkIuLIAiY46zupWHcEqNkY1blSDYWTPZka+kh3GyicSG7FSM+UKMgEWKeh+kRBzy/Y91LpuPiG6axlpCbp6f9HJbCw8BCEE2F01ipILjykJYW7+VBJPZx3CY+pFuUyfYrXQ55Y1xKc2ZgbyqcuLuUxxJdpuqcmkhhNNIZNm/uo2xgm6lijuL83SvAa0uWfbZpdA+yF0kMJu91v1WIZn9eUeC4PIRUgHSe6bmH1e3A2SP12s091yn6ic+zBSSwsqwPhP1KhZf1op2yetGkvWZnV7ktTHFW8k8OXCPU/WdZjnUL2CZzryW5W1vUB1xWdT104ZKXanHutZ9CZeV+NY6yV0Ljqk8KpL9jJtW2b29MmX8nUE8L5aYuuRyF3/kXknDS08MxogPhG5atH+jfKBsDKd80J4byF3t0J0pSYXhsdowCGBS0Q7I417ZUdKYJHgtEyNsYbYeFkNJUargHj7KCWINhs0cJMOJEmkq5BafReqg4/CXEZJNPwlQNnnERAurhNA2QcKE04abALSpWi5CxwZFQ0klUD7rf5VJjfRtLXQPa6nBv9leaOUQbEWVS6ZkjDblWZa9TYx86yDTgzl31A5B0OO0c4bh7SS09l55+p30laHzyswvseGr2Qx3puDFWPbIy9x4Wic+shMNxWglkFKCSw9lzWfX9Z6Jw/kcoxjFvs+erPbIepwGplcKIizj2Wgsaweowuoc0sIseF6y+s7ISjwoVEjaS25+lecuc/RzcNrZwyK1nnsuVyKty2ew+O8/N67NVUpfLILkrIcKicxitlBRhk1nBXqnkZGywPZZ11Xsj3HgOZbS7JNTmyWBVfRv2sRurfBIJJLquYWNFwVnypWz1ni+Rcki408pB3Kro6k6fm7KzR1I2sqmOquOVF+I7PGzv1+ldJUutYE/yqeR4JsVH+I2TTIH73Uiq6DIz9plQybTybIfWi2ztlQVdQY2kBUIxIh1ro/Gc5mZr9SpxaVzwS0qwy1LopLk91d3zNmZurDjkgiuQVPGlM4HleXlXtbK+LH2Rx6dYGyoqgnE5dIN7rGKrF3Mltr7rKMv3NxKvYx/lWY4zjpnlXNeQyW+zOsqcsZsVxCFxpi4Fw7L0M9F/p+jqX0r5MPv8Q5atDemPLuhr5KV74xc2J2Xph6QsusPoYqYiIbEdlr4tR49z3kUntbN6ZL5GUGG0ETv8PaPhHZb06d6JpsPgbppgLDwoui8MpKOijAA+UALL43wMgGl3AXUYShFdnjPM8zkZFvqn0UdPTtp49GmyZKyVzrtGyJq9n4jQCFcKSJksdyt6rtHL32yb2WwGYEXurjh1QWjS4p7qRhdsFE6MRSW+6s+r0Uffsq6gNlZ5WuM4ulYsSwiX/JBuD2Wc1GJewQ13dUWLQRYtSGJ/BCz8iEdFLLmpJnmz6l8k31lTUSNori5+lcc5jdEVHSuIOlbAW2J7L2MzZyaocWpppRBclpOwXA/q0yUGHOmfFTEWv8ASsS36c9KO5HPWV2a9XgdfFEKkixtyu9PSVnAcTbTMmrNyRyV5o1+HzYBjVjcaXrpb0p5mPwyup4zPYAje6irlpmji1uLPXvofGYcQwxsjZAdrq7VEzT8N1o/IzNiirMIjifUtJLQLaltmmxmLELOieDcdldhNvo2ISekiSaMOmuB3V3wlpYwCyt9NA6V4cRsrxSwe226vUyLMVsqGAG9wmySaLgFMdUBhs07pjpdZ3IWnXJaHNNDZnknYprdRd3SlhcbhSxRjuTwrUZDX8HMa3QLhOQBYWRcHgp/YQWxhcTsSkQhI+kSJJAlZ8wQ1uoXunBlje6jl2gfwVCEKF/RgEgclMc89ksnZNCZrRE3oXU4d08EHgqNOZz+ymi9IT2HISgXNk7QPJT09kkfgxCEJRw9nH7pUjOP3SoAEIQgRvsEIQgUEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAE1/P7Jya8d0j+CP4NJA5TJHEghpTn8fuotZ1W+6hk9MYNsRyErSAblOLQTcpihnPQqeiRsvAupAQeCqVziDYJzJDYiyg/Ix6ZUIH3TWPHBKHSAbXUkbOh677B7rcFQul0jcp0kgAuqWWYHYHv3QrNE0YbJJJmm4uoRKwP+Ipqjexzn3al3tB6/sVsskZpzZaE9Toa7BKkNG+k/8lvKQObT2cVo31FU01ThtS1oO7T2Va9NxNriEo3nkP62qJ5xepeG/UVznl5Uvg6jjJ2s/wD6rsD1ldD1tVWVL2wuO5PC5RwXpLEaHHw72nD4/Cw7l/T1LipbSTO+vSF1rHR0tO10wFgO66zhzAiOGDTOPkXnv6f8WrsJZCXFwsO66EpszZIcODZJrWbvcqhbdpaR11fGQyoraMmzp69LsPmDajse687/AFT9VzzV1Q4TH5jbddQZq5mwSUUjXTjcHa64u9QWOxYnUTPa8G5PdY1z29noHBYKxktGn8O6vmp8e1GYiz11d6a83mYc+BslXa1uSuHsdxJ2HYm6YG1ncrK+gc7pMFkbpqNNj5UEYrZ0md7WVaR7N5SZz4TWUETJath+AbXWcdSde4FU4O8iaM3Ye68qcs/WDNQNjjOIcD862i31iz1uHe0MQ5b+ZaNUtR0eb8hg+t3ul2Zn6p6zDcUfP7Wg3BsuW8I6ZbN1O18cP/mf9VmXVua9V1dM8CYuvxYqryu6UqcXxmKX2nG7h2V6mSctGDk5E64vZ136JOnDHJSkxdwvRrLfDTFhsYt9IXF3pB6KkoHUznxEbjkLu/oWjbHh8bT2aFv4i00eceQ5rnW0ZHSRvZGP0VdQtLn2IUcQBaBbsp6Utjkse66Cl6+HmeRub2VxjDGggJ7dgLJr3hzRZObwP0U/bRQb9R2oFvPZNQgj4Cka0IpbE1C9rpU1o+Moc4g2CdpE2hyEITX0yNr+D2fKEp3BSM+UJUgxrRGkdcDZKg7iykI2tDLl3JSWslc2xsEiBjQrOU9NZz+ycka2EfgJQLmyfYeAiwHAUXqWfZABYWUZ5KV5N7JE9RI3IEJHfKhhJG5S+owU3HASHURx/ac0AmxTtA8lI+mO9WyNoIG4To7k7iydoCQkN+VIOUHsV/ylMPG6UvNtyk2KRNEyRGeUAXNk8taeyA0DcBO91sXfQNFhZKhxAbsow9wNzx90N7IpWqLJCbC6ikeBc/ZOLyRZRy77ApOxPzIjc8utf/mpYW3I1BNZG0ndTsDQNlG9ocrd/Bsuw+EKklcQ/lT1Li3lW6qmdq28+VTyIqYx1Tl2S1o9yAtKwXrOgM0UjA2+xWXvml088q3YnQsqo3ahvbwsO+h7N3icn/HsWzlbPDpAy08jvZ5aey4J9U3SPsRVLjFaxPZeqOZ/RsNTRSOfCD8JXAHrP6WhooKkMiGxKxMnHaZ7/wCKc6nWls80uqenXSdQua1h/wDE8LdGQ2V7sWlhBhvuOywzGqGmHU7muaL+5xZdRelHp2kqqmmHtg3IWHdS2z0aXkv4a9pmRD0/3wH3G0Y+TnStK5q5WPweR7jDaxPZelOF5aUNT0y0/hm39vwuZvU3lTJAJ5IKTYA8BULMSX0u8X5hDJbh/Ucg9HYwensTDS+1neV0dlfnpRUNKxktWBYcaly5mNRVXTtW94YW6StbVmfGIdPzuiFY5oB8pFH1R0cZf/ILX/T0dxL1KYfTQENreB+ZavzG9QseJB7oKw9+HLi2o9TNbUxFrsQd/uVLDnZU4gC11YTf7qVWFzG8a9pqWjbeZub1TXRyRCpcdz3XNea/UNRiD5HFxN/usqxHqGTE2l5kJvusO6koxVOcHjlTVzOjXF10Y+mjWFPSyT4oHuafmXRfp7rnYbUwEOta3dag/wAGhhqA8M3utmZTyTRVkQZftwtOqR5x5FhQlF6R6Wek3MmSJlLTmY9hyu8cqOpnV1FGGyE3A7ry49NVfWQvpnMcb3C9DfTbX1dXSwiVxPC3Ma3rR89eQ4vpZI6l6QpTPZzllMVH7IDrcBWboOC9Oy/5Qstmp2iPYW/db+N/rs8lz2o3uLKKF+naylZVWNieFTvBaSAUwuc117rYrekVUk0XNkzXBKZB2CoKaZ3dVYeCNypNp9EMo7ZK12o2spGj4Qqf3Gg7KQSgjYpk4PQ30aRKkc3V3TWvJG3dSsAN7hQEcokNrbKOS5JspXjdRPJFyPKVPTKc9oRztPCGPOrcKKR1yAU+MbX/AETlJbIoye9FRG8HYBPttdRRf9VN9H7qRPZch2INxdG1uUzURtdMdK5rtN07XRLJbRMntcNgoS9ykj3Nz4SDV0h6EIQKCEIQAIQhA1ptghCECpaBCEIFBCEIAEIQkb0AIQhJ7ACEITl2AIQhAAhCEACEITfYBjuT+qjds66lc0WJsm2B5CRz0AA3F0Db+U1moHe6co1LsYnpjvcHcJqEKZfB4IQmuLgdinxHRFJAFyoppAQTeyeXE8lUlcXAHSkffwciKpmDSd1AJtR035UM7pXEhJTMfq1OCimwb2XWGPVHqUMzi2S33U9E+w0vKSsjY4FzVRue0RTlpbHQPba91TYhWRxQvLnWsFC6q/DRlz3WsFr7MTMiDCIJh+JAsCse+zSK08iKWjWPqhzJiwSnnAm3DD9S85/UNnlJUYhLA2qPJFrroH1eZtuxB1QyOsvseCuAszq7EMbx92h7nAvP/NZbnuRTldvoyHpx0vWGIgkF2p/6rpPIfIZ1ZLDUfghuQd2rV/pbyylxSrp3z0xdcjkL0f8ATxk5Rw4dTudRC+kH5Vaqqc0V3FSLv6f8rv8ABqaNxiDdIHZdAUEQpKZsd+Gqz4X0yzBKa0EQG3ZV9HPLJKGOv91owo9eySqvT2VxvMNKIYDG66qoYmBgsApPZaTcj+FLGvstxrEjGoJBHd9z5UzGBtjtZRyOaHcqzD9QnHSIqv4GgqlgrXB1ndlUzf55AG6p8QgbBTmRuyWy7S6GwnKHaHPxunifZ5CwrNbqXC48Mfrkb8p2urZ1/wBcwYBFJI+cN0g91y5nj6k/ZnfSMxDbcW1LDypOXRp4+eq5J/01H61K6gxeGpZCWndy8v8A1C4T7ddUkM21Hey7yzo66/71U8nsy6i+/BXKGd/QUtbQTVTqck2JvZYdte2eneOc96NdnH+ID8LUGxUUNc1x0lyuvXGB1OG1MmqMixPZa/qMWnp6ktDzyqk8Zv4e/eNc9GWuzNqepaDcO5VUKsuHPZYjg2NSTShr3n91fRVCwsVSnhtM9s4nmIqKbZdoqza11MytHlWptQ0M5QKs3vdQ/wCKdjj89CMfpfoagEfMp2PJFwrJSVZLgCe/ZXWnnaWXJTv8ZtE8+ZjYvpFiT7MP6KwSVJbPpJV5xGYG4vssexF4ZJqaeyhjQ3MxOQ5eEYPsusNRqi3d2Vk6kl+E7pn+MGFhBk2Vkx/HQ+49wK/ViS/h5L5Bz8I77LPXzuNRpHN1mWWOIGmxCN7j3CwVtUyaa7nDlZf0fGXVLPZG+3CuOncUjxLm+fTb7O8fS31pT07qXVIO3delvpR66pZKenHujkd15Den6XEqV9O8BwAAXe3plzInwf8ADtnqC2xHJVvHrPJuZ5dz3pnqj0ZjIraNmh/IHdZlBBI6mDtR3C5lyfzpo6qmijNaCdI2uugOjurY8Zga1kodcBbuPW09nB3ZzldslkZKK0A+eyyOhYY6cG/ZUj8PDniW26roSGxBp7DutmuXqLO1TQ6GS8liVTV7y2W44umTzObJdhKGXlF5N91bU46IlBsp6ikfW7jsljp3wt0OCrI7RbbWTiInbnuqtq9mV7MeTLPiuGtraV0bmjdq5b9U2UbcUoppGQh1wey65qYmmE6fC1zmP0kMapnskgDgQVl5NLk+ijZi6ls8eM8MnK6ixSV8cBAa8/SsU6Dx6q6MxFkUriCHc3XevqMyPhMM88NCL7nZq4Yzm6Wm6ar5XCEsLT4VB0uLJ6lro6o9Pmfz45Iad9cdyB8y7kyS6wZ1DSQvM+ouaO68Wsp8z6/CccjikqiAHi269HfR7nIaqmpo5qy4LQNynxk4stxlpndVBG1sbSB2U8tQImkE2Vm6T6hpcUw2KVsoJIVxqj7zXFp/hX6prRaUkokL6o69Skim17m6t9pTIQR3UrHSR7dlpVT2h3uXaNwI2UzeB+ipcNdrHxKsc1obsFbi+hX2hpsACTyo0jxId0qmjJaHRWgT2fKEBgtuEaR/9FIK3oc1tylfYDYIjFroeDymtPY1vYgaSLpEXPF0JjQxtMEx3zFBLhySkTCOXwQuANinNBJ2KaWgm5UoAHCcmvgKLYMaRYKRI3i6VSJknqRov9kJ4AsNk4dvQkfF05AAHCLgclAntsEJA8Xt2S3HlJtCP6CEISjgQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEITNbvKAHpH8fuhpJFyh/CR9oH0QyPAFvuoybm4Tpf+qhc43Iuo3W5MjJmG4S6b9uEyC45VSAwjwop48mh6iU0rQGlwUJcByCqubSBYlUctgdlTnXKJLGDkD59G9ymisvzyoZZOxKjk+S4SRg9bJIw19JpqrbYqmknHIKa0SOBNiqaoeYj8Sa+vpbqj7dFbHMHi5KlinjYbFWOrxmKliLvcAsFZ5+uaanJ9yqAt90qsSLlfHWWLaRnMzmPhNv2Wt8zunW4rTyxll7hVMWa2GtGh1az+Vb8WzBweta4Crab/AHUd10XAu4OFkUXbaOQPUhkazEhNIKMOvf6VzDN6cC3FTIKEbO/KvSTrGjwXH43B2h1wtd1eVOFSSmSKmZz4WLdNfw9F4yXrps5FwjLSXp6K4gtb7Ky9b49UYNTvaHEWC6s6uysY2CQxUw42sFzXn70NUUUM2iIj4TwFiXSe2ej8Xk1pLZy9m7mxUQl8f4gjna65/wCsOsn4tJJ7kt9z3Wx86OnsS/FSARO+YrS+J9PYr7rg2J3KzJyaO8wcmEopIwPrqskM7gzcnuFhk1biFM4vYSN1tmty/rKz/MmpyT9wrbUZVTVF2spSf0CbC1Jmz6qUTBsC60xWkqGtbK7+VtToXq/F8QDIg95ubcqxYdktXSVLdNG7c/lW6cm8iqySaL3KN3zDsr1diZy/LyphB7M5yZ6LxDqCVhfEXarchdg5A5GyCpglkohvY/KrV6ZMg2gxF9D47LunJfJGkoYIZZKNos3wtHHT90zyjnMyuFbKzIjLsYZDAfZDbW7LozAaf8JTNaPCxrpzpOHDWsFPCAB4Cy/D4iAA79l0NEkkjyPkMv8APJoulGS4C/YKpZE4yAhR0LWKraze7VtUTObta9iQMLBupBwEgaTu5Kri7KNnYIQhO+Ijj0MPxOsEoYQbp1hzZCPZE3sgQhCHIG9kjeB+iEwOcNro1u8po0RCE5rQWp3sMcdoakcCRYKTQ1Nc0NGyPYb6DGtINynIKEqexrWiRCEJhJpjH/MkUiboPkJyYmkNIuLJAABYJ+g+QkIINinbQmkAJBuEus+AmoTHofFPYpe5IL9yji5SBwJsEyRJrSFIuLJWMFuTykQmgntCuaG8JEJHDv4QJL4DvlKifwApNYtb7KOTsnr4VLOwYdrILLm4KGNtupWcfunLbGxW/oxjB5UjY/CQkDco/FRjZJOO0Twil2NqIr8q3z097WCuJkbLsCkdTDkqtOD0Woy0tFnlaA3hUkttRurpWU5AJAVrmie6QgLPuqJ6UvfZi3XcLJaJwA+lcHetzpwS0NTI1h+pd9dZU7mUjj9lyL6o+kpsaoqhrYr3usfKq2z0rxvKVMfp5LdaYZLRdVvJuB7vj7rpT0k4/BR1lOJXAbjkrCs5soKykxeWpFOR8ZN7Khy2x+Xo6uYJZNOk+Vi3U9noSyY3V9HqZ0L1DQ1/T0bGPaf8scFYNnP0dSY7QzXjBJaey01kz6jKSOGOmqK8bACxctvx9fYb1NSf5Uwdqb5WfYtL1Za46mVWQrYHB3qkynNF78kUJ4PAXBOcOBV+HYhLpDhZ5Xr16iOiY8bopXxxB12nsvP/ANQOT0wqpntpvqP0qhOD2ey8BJaTZyRA6pDtLnHnuVk3SNNNPINbu+yrMZ6Aq6GrcDERY+FNg1EcOkaH7WUTg3Lej03j5w9ezNcHwBr6cOPhWvqPBmxONldMHx+GKAMLxx5UGLVEdY8kPH7KSCcWXMt1urRhM9H/AJ1rd/C2Vk1gM1XiEQaw8hYkzBnVNYGsF7uC6G9NOXz6uuhLob3I7K3XZpnl3Pxg4yaOjPTf0TUgUzjEe3Zd7+n7CJqCkiJYdiOy0h6dsro2UlO78P2H0rrjLLo5tBSNAitx2W/iPbPm3yh+tstm1eiMQEUbWu8BZa7EGviFj2WE4NA+nOwsr3FWOY3SSuixZaSPH+QqTt9kVj6l7pdIHdTCIvAJH7KlpaiN7xcK5AscwELXhLZQW4/SOCA3uAqhsR08/wBJ0LBZS2ba3/RWYkMpJMp7b3UkbTbcIdE4p4AAUj/10N9+tCtFuFNH3UcfdOVNpoZJjX8qF4uSCp3cFRuFwkKlkdkL4xa5KGXGwTnsdsnRi2xQvpCoP6Oi/wCqke4iMprW3N05zdQspoluC0hgN01zb3N061kKR/CZvoVrQ7lSM2Nkxh3spGsIN00YOQhCABCEIAEIQgAQhCABCEIAEIQgAQhCTSYAhCEaQAhCEoAhCEACEIQAIQhRsBH/AClMT3/KUxMf0AQhB2F1HH6RghMcbm6RTxJUiS44ukcARfwkY0/MnHcWUq+i/wBGNaHcqOoiBBUrWkHdOew6Tsk2kLtFskpdTuEsdKGu3CrhBd9yE2oaIwVXulpbEk9Ip47h4H3UkhAYbqL3g03NlS4tisVPTOOr6Vm2Wx1sqysikzGcxeq4cEoHu1gEA91x16hM9DSGeJlUBuR8y2/6jcwPwVFMGS8NPdedHqRzYmdWzRic7vPdYmRJtmXZPZZM4czKnqLEJI2yl1zblYZ0tl/UdR4o2Z0Jddw7K2dK1T+p8VGo31PXV3p4ybbiZikdTg3I3IVWMX7EKbbM19KmTzaR1O6SnI47LvfKrpKmwzCInBtiB4WpsncrRg0cThABZo4C3z0438LSNhtwFr40NaLNUdvZcp6dhjLVbqejcyovba6ul/c5StgjJuFqSj7FxQ76GxRkNv8A9FI1odynNaGiwTg0u4RrRLpkcrtDNlbMRq3R3IKuk7SWFqtdZRmQ2I7pJPRFZ8I8LrnzPs4KfG5WjD3m42arfPURYX8TjZYl15mfQYbh0rXTgbHuqVlulpFVz9U0aI9WfWsuBUVS6Oa1ge6858385aqs6gkh/E/UR8y6l9aGblNWUdSyKe5sfqXnl1BWVuPdWv8AZudUm38rMsn/AAZFvZuXokVHU7W3Jdc8K/8AX2SMmIdOySupTuwm9lkvpSytrcWZTulpyb27LqXqzJOOn6Oe+SlH/g/l+yqOv2ezrOIyVU0eKPqWy4HT005MOkgnkLkvqatFNiL2X+or0X/7QrpmLApqvSwDTq7LzI69xhseNyMvxIf+akjQ2taPXfH+ahW0tmTdN4n7lSGkrKX12hoIctW9MY8I6oXda33WYsxuOUNJeobMZntXDeQwcFtmUwVhe25KkExLtirFSYox4DQ5XGnqg4Dfv5VKVLiztsfmYyS7LrT1JZvdVbcWLG2LlaGy2be6paqtc02v2TFDZprmIKD7L1VYkH3OrsrBjWJhlyHdvKZPizWRm5/tY5juNCzhrTqcT2kcjyvOvvTExTqP2wQHf2sVxXqpxkIL1Bi+Lar6Xd/KxLFq97pSbn9Fu4+En9PHPIedb32ZXhnUYmqQzVuSt95C9MSdQVcXwE3I7Lk7AsWc3F42FxsXhd+ehXplnUFbStLAblvZPycH0+Hj/KcpKxvTOmcmsmqiPDYZm0zvkBuGraFM6t6MibIAW6Sug8kMhGT9KQz/AIQH/JG+n7LBfUdlw7AMOmkZBp0g7AKtCpxZwWfmTm3pjMnvUXU0mKR0slX3A3cu/PS5mfH1DBAZJwbtF7leLND1vUYB1Z7fukASefuu/fQ5nT7gpopKo3sBu5aFc/U578tjt7PTyjmjnha5pBuB3S1ThGNisNy+65psTw6G8lyQO6y2c++A5rloQtjKJuVWKUP/AGNjHuO38KZkIsE2miIFyFMx7WyAFWYSTReqW0KylLhe6p65hp2kquNQxjRpVJijvdi+FPktollH9SgZiQILClloYq+KzhfZW8wyCW9u6u+HRu0WKqTi9lKcezU2buWdNiOHzkw3uD2XnX6xMoX0tZUSQ05sL/SvWLqXCW11DI0gbjwuSfVDlCMYbUFtMDcH6VRtTiypJOMjyKxOkrun+oQWsIs7wuqfSjm5U4W+njkn02tyVhOemSk2EV8lQ2mtZxPyrAuj+r39H4g2F0hbpdblUn9FU9nrtkrnWyroII3VIN7D5lvvpTH48YptYcDceV5benrPoTSwQfjD8w+pd7en7rpmK0EZdLe4HJUtc0mPjPTN1GBhN1DM1o47qWnkEjA4HYhNewkrUqmt7LUX/SfDxpG3lVhcSLFU9EQBYlTyuaRsFoQkmuieI53/AIR/RQgm5T2G7UqsR7RJ0gBuLoQhOG7bHs4/dD/lKYhLpjGwQhCY0NGydk1P1NHdNcQTso2v+DZaaFa0EXKckZ8oTgCTYJv9JI/BzPlCVI0WFkFwBsVIOGKRvA/RRqRvA/RSBrYJH8fulSOGoWukfwTSGJW8j9UvtnsUBhBum/GKOQhCehNoEIQgUEIQgAQhCABCQvANkBwdwgBUIQgAQhCABCEIAEIQgASaB5KVCA2AFhZHKEJNoCGVl72HdQGI6t/PhVb+LKNzOSnxDQwNDeFLcHgqIuA2RG6x33TnvQ759JHsD+VR1LdIVaDcXVLWMNiLrPu7kPjP1ZbJyS+1lJC3WyzglMfxaiE2eoZDHttbyq+9Iu1r2Q5+mMXHCsOP4kyGMm4UmJ9QR07Dd/bytd9e9d09JTvcZgLfdUrropG5xnG3X2rooMwMyIsKhkBmA0+StA5k+peLCC8CsaLD8ysGf+crKVtRoqSLX+pcOZ/5/VEdRK1lW7v9SzZZaX9PUuP8ZnOC1E6e6h9bLKGpLRiTefzqPBPW3FWThrsSabn868wuuM+cTfVucyrfz+ZUnS+fmJxVLS6rfz+ZV5ZUX/TTfitkXv1PZHo/1MUWNBuutab/AOtbV6Q68w7GWgiZpv8AdeQ2V3qVqoJIxJXuG45cuqclvVDC722S4hyB9aozyNyJ6+BsjBrR3XiTKSspzpANwtMZzZZx43DKWQXuDwFcOjs7cNxakjJqgS4eVlcWMYdjlPfU111XslGz4LRj5GDPX1HBubXpynqp3vFETufpWn8V9N00Uzi6hPP5V6Y9R9CYbiYd/wAO03+ywTGckaKoeSykbufyqnOltnXcfyFdaW2eetRkBKPgFG7/AGqrwX01SzSb0Rsf9K7jlyBhdNf8I3n8qyHpzICn2vRt/wBqIYzf8NuznqK6+5HGXTnpNEkrH/gCf/YtzZW+lr8NJE78ARuPoXVHS+RNNE5hdSNsAPpW0OjsoaCmDCadot/pWnj4bf8ADz3nvIqpRepGsskcmI8GMeumItblq6c6M6dpqekZGG2s1UmB9GUtI0COMDjgLKcKoHU2m3Gy16MZxPIeW5Wy9tbLjRYXHHGAFUim0nbZTULC+MKobDc8LUppOPna9vY2khLbO+yrIub/AHSRsDW8JzeR+q1KoaKc5+zJ38fumIQrceis10CBubIAubJ3t/dLJjUuw9v7o0DynIUaa2P0JoHkpikQnbQEaE5zTclNSgCez5QmJzXCwCAHJC0O5SoQA1zABe6anv8AlKYnRI5LokQhCi9mSAhCE5fBGkwSFoPISoS/BPVEaYXOB5Kc5xbwmXvum+xJH6KXE7EpASOEIUbexX8JOUIbwP0QkTaI0wSO+UpUj/lKeJN9DEEA8hCFIvhA1sGjcBSBoANkjGg2Ke4BrSLpd9D4R7KaokcxnKtU9a73LByra97jcAFWqojk1l1v6Uij7Fr00uyvo612wLlc43l7ASVj1K57H7q8UtWwNsUSgMb/AITVMbXMtZUE1M1ji6yr5ZWOFgVT1Aa6Mm6q2Up9lip6MW6ppjVRe2Be4Wpswcs241TSaoNQP2W6K2lD32cFb8QwlkkBAZ/Sx8ijfZ0mDlujSOAs/vTxGIJ520G+k8NXB2feA4h0ZXSuhiLdJPC9ns3eh6TEcPma6HcsPZecvrNyRqqied9JRuIOrhqyrcc9A4vPViSbOL+lc9MawfFGwmqeLO4uuqvT9n9UYl7UVVWE3sDdy4560yvxzAsTdKKZ4s8/Ssvyc6kxPAa6Nk7i2zhdY+Rjv2PQuM9XqR6MyT0PVeE3cQ/U1aUzhyQo8WZJJHRA3udgr1kxmQyvpY6eSe5IG11uWh6Wp+oqTU5l9Q8Kt/jJnb4fJQw/230ebOauRpw6aVzaC1r/AErQnXPTdRhEzgyAi32XqtnJ6fqetpJZo6Y3IP0rkXNn04zPqpAykPcfKoJ0ep1OL5NFJaZxt/iNbA8s0OV3wd+IVrxeJxufC3D/APdjr5ao3o3fN+VZN0/6ZqyBzCKNxt/pVaUUka3/AM9+evSZrzoDoWsxarjc6mJu4dl2Z6YMrW0ckEktOOBe4WIZZZHy4XIx01IRY92roTLuCm6bazU0NsAofbUjm+TtndFnUWS+DUOH0UALGj4Rdb56VxLD6enAMjR+65F6ZzloMGhY2Spa0NA5csjp/VJg9I3QMRZt/rXRYd8IRR4X5HwmRlWyk/h11S41Qk2bMP5Us+MQEfDIL/quXOnvVJhdVL7f45hv/rWd4BnHR4s5pjqmm/hy3ce72SZ5zl8HKqX/AE3VRYkS+4dcX8q90WI6gG6lrjpzqmOraDrG/wB1mOEVjZLEuC2arNmHk4P4l2jKqacloN1O2QkbFUFDLrjAaq+MaDcq/XJHN5MfVklwOSmtJLudk5xY9vwpjSNXKn10UVYPBLdgVIo1Iq0ltknswTXMudk5CY1oR9jDGTyLpGxAG5CkQBchKkIorYAbbBLY+CnNGkWulUkSVJIiLW3sQm6Tfja6mLATdNcADYJ+xdjQ0DgKUbhMa0O5TxsLJBAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIEb0BIHJSa2+UjwTawTSCOQmSQo5zgRYFNQhRtaEb7C4HJTC43IulfwAmkkDZRr6CWgSsAJ3SN1EXsnMBB3HZTxJF8HI4QSByUbEcqVPQorLE8JzyA03TWva2+6SR127qOWiNv8Aomto3BUVU5rhuhzjwDsoKh5I2KqZE9RIZ2fqWnG68UcbnF1rLXfXOZVNh8EjXVNvhPdZZmBXfhMOkkcQLAlch+oXNaDBvfa6rDbA/UsC236Z1lhjPqVzXpqqnmjjrAbh3dcH5yPqsfxKQxOLtTzws/zhzmdilc+COq1XJ4csY6TwWfqysY4RF2pyoybkyjJ7ZDkDl5iNRikTn07iC8chej/pWy29uhhMtL2HIWivTxkdKHwTvoTyCTpXduRnQ9PhWHsuyxa0dlaqq9miStNsznp3pimo6VlogCGhXMwNpz8IsAVWU8YY0NA4CgxFpDSByVsVUqJq1VJJCxTtLdiEhqbG4VHAX3IUkbJHP2G11ejB6Ligkyuhl1gC39KeMEX2UNK1rALndVDy1lyTso7P1Q/0EeARuqeZrSDaybUYhGw2BCpa/GKalgfK+QbDys+y3SILIrXZgmbOPnBKZzzLpsCuPM/s+X4fHPE2vtYn6lun1UZpRUdDKIpRs0915n+pHOOrqcRmgjnPznus2yf/AAzZR2yjzpzRquq6iWnbUl4c63Ks2SuUVR1R1DHPJSl2p43I+6w/ok1nVWNMbJdwc8LuT0j5MMqJaaeSlJuQb6VUl+w2MdG8vSlkFT4bh9PK6hAIaOQtzZz9J02FdFTNEIFoT2+yzjKnoalwLB4gIgCGjsrH6mKiKDo6ps4bQnb9leoocomnjydcdnhV/wBqTIynqK4NsPnXj/mNjJHUEo1/+af+a9b/APtTq0SVFeAez1445kzTM6lmuDb3T/zWnRjbsNnE5WdLWmXTCMbdG8O1lZJQ9TvLQPdP8rXeGVMjjsVeaKqmZYWTMjFW3o9H4XyGWkmzZeDdQlzheRZbhGItla0l17rVOBVztQJKzjAK64bdyybMY9PwOe3BdmbNqGGPnsrZiVdE0bHhRmv0w7OVixjFALtDtv1VL/Hft0aMuf6+jcVxsMJb7lli+M40X3GvlMxTEJHSO32VgxWv3J1brTx6EtdHLclzylvTFra8uv8AGsexOpvK43VTNW6ri6tGIT3cbrborXqjzDmuT/In2Jg85djUNj/5g/5r1C/7MHDBWYpQiRt92/8AReXPTLTJjkJI2Eg/5r1W/wCy7kijxSgF+7f+ilvqjJHn+Re5o92fTbl7SVnQkB/DA/8ADjt9lqf1j5Qyy4PUexSH5TwF0Z6RvZqeiqWO/MA2/ZXPP7LWnxvBpW+xclhsLfZZVtOu0Y9kPY8JM2cu8UwPqp83suaBIe33W4PSjmDU9MV0LZqkt0kDcrZPq1yTqMLxKaoZQkDUTfSuc6Svn6Tr7Nu0teqz2omdOjT2eqWROflNVR08Lq4Hj6l1L0X1ZT41SMeJgbjyvIf05Zxy/joIpau1nDly9GfTj11Hi+HxAzg3aO6bXY/bRPTN7OiGEFgcPCoKyokjluD3VTQTe7TtP+lQ4hE0g25WrVPejboltEEdZJM8AE8q4mIvg+IdlbaCF7X6nN2V31AsACuqW0W38KSLDw95+FT6GUzbFVNMwabkKDEYibFvlRWRf1FSyO+yKd0b4y0m91g2YXQlNjtNI4wB12lZm0hw0338JJ4GyROY4cjdU7a3L6Z9u2cDeqDItpo55YqHsfpXndnX0PinT2OSmKFzQ154H3Xtjnf0HS4rhcpMV7tO1l52eqPJeRtbPNDRm2o8N+6zpQ6KvsznDIbq7EMJxiFk8zm2eOSvSP0qZr0zaCBktWOB3XmkcGq+mMYLvaLQ1/hdA5BZxOwiWKB9Tp45coG2h0Z99nrH0p1xRYnAwCcG7fKyaCZs8Yew3BXKeRubEGKshaKtpJA4cumuj638ZhscoN7jlT03d6LdM3J6LpG97HWBVSJXOG5UOkOcbp7XBouQtemzei/DZPE88EqRUkUpfKAOLqrWjW9j5AhCLjyp0tkfswQi48hFx5CeI+wQi48oTWgGO5P6pEruT+qGtJUJGPjAIt9k8NA4TGnTwpEx/SePSEc4AWB3TCSeUruT+qROT2KCkbwP0UakbwP0Ui+ACEISgCEISNbAEIQlIwQhCByYIQhA4EIQgBrmkm4CVgIvcJUJG+gBCEJvswBCEJU9gCEITgBCEIAEXHlCY7k/qkb0I1seDfhCRnyhI5xBsEwVIHkeUxzhYi6HuIN/Kbyd+5T4t6HpaI7OPIKVgIO4UuhvhI5gAuFJJ6Qkhvu6dr8KKd4cOeyJSACqdzzqsVnWsik9EFS8xi5VlxvEvZhcdVldsSkHtWHKxTqSW1M837LNtsaR0HGVKzWzCuuOshQxv1TWsPK5vzqzrbRQyt/GWtccrZedWLvo6WV4fazT3XB/qTzInpZJmmfbUe6wMq9o9o8X4uF0l0Ynn7nj+JNQBW83+pcbZv8AXs+KVkmiqJvfdZFnDmRLO+Zragk3PdaPxbHZa+pcXm9+yxLMlqR9CcF47XOtdFsxc1NbLq9wndULHVNEdQe4ELIKCjEzbvbym4ng7XNOht1XeTs6qzxWtx6RRYV19XYTKCKhwAK2Zl96jq3CqljTiDha3daZxfB52ElrVZmSVtFNra48qP8AP7PpmLkeMxrXw9IMnvVbM6CBj8TO4H1LqrJf1A02KwxiWvBubbuXjr0BmXiGGPjaZiA37rpfJT1ESYc2JstYBYj6lJG5HNZfjsY76PWnp/q+gxeIFszTceVk1FR0VY0EBu64gyi9UVHMI45K9t9vrXR+X+dlHiUUZbUtNx+ZXKrlJ9nB8pxNuPtwNw0nS9FK8Ext/hZDhPS1DDY+21YFQZn4bFAJH1Db28pz898JpnFpq2C3+padHq2cHyNmVWnts3HheE0DGizWrIsNpI2MBYwcrSfTWdNFidQ2OGpabnsVuDofFjisDH3vdbVFaaOIzb7O/ZmS4ewkgBqvdJTFzW7Kio6RzdwFdIA+NoJC1a6FrZzOVbsraOm0x7BPddjtgn0ModHZEjC51/8AorMKUjHlNtixuu0D7J7fmCRsYa3UErfmCsRhoictk2lvhGhvhDXaglTxm+xNLR2QXBvKVNf2Uc5L+Dl2xC5x7pQ4W3KahMi9itdEgIPBQmx905PGg7g/oo1I7g/oo06PwARwhCcAut3lO1t8piEAPJDhYFNLXDshnzBPSp6GS+ghCExIeCEIThG0gQgkDcoBB4KA2hkouLKncwt5VU8EjYKF7SDuO6hkPiRhpPCela3e4CV4AGwTQkNT2fKE1rTe5Gyegjj8GuaSbhNUij4UgS7Q5rgBYoj7pqczupIkGxyZIXDhPTZeB+qf/SetIp5g0usQoX0jHgmymfu4XUrQNIH2Ui/UuN6RbJqYMuGjsoWvkj4PKuFQ0F5+FUc0ZJ2Ce+1sqy6kOjnedieyma8uAHkKnjY6427KeCNxduoZliqS0UtcyzuByoyWmEhzRwrjU0evlqp56BzYjYLOtimTK1qSMI6ww38aHsAFiFojOHJWj6hif7tI1xIPLV0hiNA50xDmqzYvgNLUR/5kIOyz5VbOs4rP/C1s8yM9vSpBH7s8WHDk8MXM3VuUlT05WuMNMW6XdgvYHM3LLC8YpJGCjaSb9lynm96cxVVMhp6Dl21mrPtx1s9I4/mFGtHMeRsOKU+JRRuBtqC7bydw+atw+Nr2b6RyFqXLf07VuH4k2Q0RADh2XT+WHRDcGpGMkisQ0chUp1xTRet5mTremWnqfoNlbQkPiBuO4Wm+schqbEKpznUrdz+VdV4jRUjafS4N4WB9Vvw6lLnENVDJSiyTjOUvtkonNVT6eMMpvi/CM5/Kof8A7LMHw0WfTs2/0rZvWHW2E4e1+qRosT3Woutc5MIpC8fim7fdY9lkEuz0/hoZmQkkVNXhuEYawlkbBZYN1j1tS4W1xhmA037rF+ss+KINeIqwbg/UtJZh5yS1JkZHVne/dUJWrfR3dPDW2V/uZhmB6jZ8IEkMNaQR/qWrcT9WeLQVJH+Iv5/OtW9f9T12JSSSNqHb/dap6hqcYdUFzJXq/j5CS0YPJeObT2js7oD1cV8tYwOxF/3+NdUZE+pltb7AnrybgfWvInpvqnFsMqQ81LhY+VvPJ71B1eC1ULJcQIsR9S3cXJ0jznkvHVFtpHuBlLm1SYpBGRU3vb6lvXpXqKOpY0tk7eV5Uemv1Qip9iJ2I3u4fUu78k814sapoiasOu0d1uUZP/TzrmeE9YPo6mwCvDg0k9leJZxIy7eVr/pbHRPCxzZL3HlZdQ1fuxfN2WtVemeS8liSqm9lxpHuvdxUjrl+2ypqaUt3cpmPJeDdacJ7icvKLUiZrrC1k8HuFGpBwE1rZJvQtz5KXWNNimkgC5TTI0Jge+h7SAblPB4Kp/dueVIJfhB1dkD4zTJ76mkpiSJxcOe6k0tPZOiSp7GtIBuUOIJuEht3KZqINr7XTh2iYODuEqja/wDKU8OB2vugQVCEIAEHYXRcDkprnG5AOyAF1jwUqjS63eUAPQmh407ndDX/AJigByEmtvlKCDuExvYAhCR5IGya3oBUJmt3lBJPJTXMB6EwuJ2JRqcO6PfsBX8/skadJvZISTygkDcpfZB8Hax4ShwdwoDIA4kFAmI4cnxl0Mb2VCEwSE8FBJPJT12Nb0PTXm5sE1Jrb5TvViewqEcoTHHaFUgSagTpslR7e+oXVdR7JE9jmNGngIeALWCVl7boLQeVLHocimn1HhLE7TGdRUkkNwSqeoa9jSAnOQraHMcXPvfZLUTgN0hUsc5YbE908yNeb3uVDKWitKQB5LSSFSVOIwwMLpDb9VXPaxjC5x2Wsc2+u4enqR+mcCwPdUcyTUCtdNxLJnr19RUWETsbOAQ0915m+sLNGpdX1LKeqIFzb4lv71GeoRgiqIG1++4+ZcI53dUVvV2IymGQv1OPC5qyTbKDlswegxevx7HQ17y67vK6+9J+WT8VqKeSWnuDbkLm/JLK7EcVxyOWWlcQXjsvTH0cZPR0sFM+ejAs0HdqK/2Y2MG2bqyayhpKXCIX/hWgho30rcXTmBf4XHoaLBTdN4LTYXh8cMUYFgBsrkSyMGwst/Go6TZero9e2SR6R3VPWgO2ChdVvMukFTM+Nu60fRov1/COCmaXardlUNETAQW7pYA1t0k9m3cCnx6LKkkinLy2o5VRUEvg25sqQvvJf7qqYQ5oaT2VTIs0hfZGL41XSURdI8nZarzQzZjweCVjqnTYfmWyc06hmH4XLP7gFgSuCvVfnFJgzqlkdYRa/dYV9pXsktFh9SeccWKwzRNq7mx+pcRde01V1Jjjywl2pxV+65zhrsdxKSAVRddxHKvuUPQ1T1diccr6cu1OHIVPfsUJ/S6enLKOpqcSglfTnd45avTH0q5aNw7D4ZHwjYDstI+nfImOjNPK+htxvZds5S9KwYPhbGiECzQrEK/Z9joRTM1w+nbT0bWNFrBaV9Vda+HpqraXf+UVvFgaI9I7Ln71eGX/ALvVgZ/+aK3cepKKJ7Zesejww/7Tyq93EK0B2x1LyUzSp4jjMpa0X9w/816w/wDaUtkdX1hcD9X/AFXlLmmwNxeS3/5w/wDNaEYaWyjGzViRjGFVDY5dLlehXQRtBBCxkudG4vZ2QzEJTs9LOtSidHgZk6J/TM8MxqNknPdZbgXUcVhd9lqeDEnMNw7+VdMP6gnicA1x/lUp43sdrh8/6w1s29L1CwxWEn9qxYpjbSSdf9rFW9R1Do7FxVsxLHKkki53UKwd/wALNvkHWtl6xTqOK7mhysFfi5kcfi5VtqMQc9xLnKmkqi43CsV4qiYOXzMpppMr/wAXqF7qilmMk1kgn23CQEF9wOyswh6s5fIyp3S7K3pkWxWK3/5wWXp5/wBmXWOp8Uojq4LV5j9Lx3xSIkcPC9KP+zbMn+LUgBPLVHZNJmdJOUz6FfRDjLqnp6jiJ/8AKA/pdEY/gUeLQe29oII4suYfQk14wSjvf/wh/wAl1o0NcwX32UGoyWmSKncdM469ZuTlDJhUszKRpdY/SvL/AD66BrMDxOaRkJAEh7L239Q/StNjmDlj4A4lp7Lzy9VGRLamGolp6Le54Cp316iylkUuMTizKjqKtwnHIx7hFnjuvRX0jZsMip6eOWq8Xu5efeLdC1/SuLOeYC3S7wtt5HZvT9O1McT6stsR3WUv1ZmVtqR7DdCdcUWK0MeiQElo7rJ42GqfqB2K459OGerMX9iJ9de4A5XXHRuMw4lh0crZAbi6u1WaNrHs0y+CkY2IkN3+ygpCff0vKq2vBjIurcJjFU3v3WjXYtGj76Rc3Wvt4ST6XRFx7BQsnL49WrskMxc0tCspqRHJdFBTtd+LIvtdVE8jWHTbsljitKXAd06Wn1uDiklU2ipdF/wx3q7DBiVMY9ANwucs78nIMXpppDSgk3+ldUy0TZLBzbrHesOk6Grw2TVTgm3hUrKH6mfKDPI71E5RnAayaWOmDbE9lz3/AN86vpfGhCJXN0u8r0b9YOXMAgqZIqUbNPAXmpnT01XUHUUj4onCz1i5KcSBpxZ2D6Tc4p56mmbLVk7i93L0ryQ6pp8V6ag/zbktHdeJHpw6yr8DxCBskxbZw7r0y9LucxOEU8EtWPlAsSs6N/rItUyakdiQy3dccJ1W4lgDVjvR/VNNi9O13vA3WUaI3MBW3iXe62atUnJbDD47M1kbqpdI0m6p/dbHHZqZA9znblb1Ml6kj2ypJ17BI9jg0kJzQAL37JHyNIIVyMkN9SOz/v8Ayiz/AL/ynxubvunCzztupVMPVjYmONrqXQfIStaAOEqY3sNEOg+QnDYWTnN8BNUEg9WCVrg3lNLgOSjU0900XfYp3N0IQnR+CgnB4Aso3P8AylK1wtuVMkBJrHgprnB3CbqaO6NbfKX1YqQqVrrC1k3U3yjU0d0vqx2kSjcXTS+xtZJqPlIk/wD6kTiPadQulTGuI7p9weCkBLTBCOE0vN9kCt6HIJsLqMyEclGsHbUmN7D2Q73Psla7V2UetvlK135SmvoPZMkQka66VCe0KCEEgclR+7c7OSgPLwDZNc4O4TS8X3KUEHgp6+ACc1wsAmo4SgSJjuT+qVr/AMxTrDwka2I3ojT2cfukc3uAm3I4KY1oUe9uoJhGxCcwk3uUrmjlPj0KpaZEGG91LYBm/hU80wY7ZyjfWfDz/SSyXQv+w2dpMlwVDMyzdV0jqg6uUSyXjtdZt0hFWy31LC+4JWK9V2ZC8A9isnqZHNuVhXW1W9kEm/ZZN8kdPw1cnYkc+eoeo0UMxa76T3Xm36rcUe2acNeRue69CPUTiEn4Kax20FeafqtraiWsmYwn5iueym2ns+ifEKYx9dnJ3XdVU1NfLd5ILvKx+jwSeqqGuDbhZZX4JVYhXuHtk3f4WVdLZdSvhEj6Y3/RYN299n0RwmRVXFGCnDDSQi7bH9FFFG150v8A3Wb9Y9MSUETrQWsPC1/V1ZpZywjgqnJs7ui+iyBLX4BDVD4WjdWDF+g3Fpexllk+G4oyRwa5XZ7IZoNOkbqrKxxYXY1VkH0ainw+bCpLBpFlWYb1vX4QRokcLfdZZ1D05HLqkEaw3E+m5myktZt+ilqyIt/scvk8X7yekbKy59QGK4fXxtdVvAuPqXXuRXqWcaWL3q0/KOXLzrhoamhnEjCRYrZWXuYtfgsbAalwtburkb1GW9nN53jkbYNtHpTXeo0jDhKyvIFvzLA8Y9T1S+sLI8RdsfzrknEs+6xuHeyK43t+ZYnTZq4piOKnTVuNz5W3iZKfR5R5B41GCfR6cenTPafFcYgjlrC67hy5ejHp7xuPGMKgfe9wF4uejzGsSrMYpXPlcbuHdev3pFq3HBKb3X/SF1OHYno8K8g4/wDB7HSVLRDQHW7Kol9sMDQN0lJK2Sm+E9tlC8n3edl0NSWjy66Um+yrohcfuquwPIVLRCyqla1oqf0a03cldwUBoBuAl0kjhO2humxIwTeydocljAF7BOTZS6BIjIsbIUlh4TXNJOwUDTZInoahLod4TgwW3CSP0RvYkfdOQABwEJ4gO4P6KNPcRYi6ie4g7FOj8AchA3CE4AQhCAFZ8wT0xnzBPQNa2CEIQJtgm6z4CR/zJE5ITaFLyRZKwbXTUrXW2shoE0KXkHcJr7P5TyNQTOFC0iRMQAAWCdIwbblNLrEBKon0OfaAbCyEb+EIXwEkCY7k/qnpjuT+qfH6QyETmc/so37OBTlPEgT7JE2XgfqnN4H6JHC7Sna7LVT2Uz+U6ORxIanPtcBMY3SbkqTa12WtpoeYQ4k7qJ9Lft/CqI3g7BPIB5Cb7NFeaKIUwB+6kYwMttwpZOD+qiDSZLpsuxYSeh4BedwnyRt9si3ZOYBbhRVTywEqpZ32SfWWvEKRrnnZWTFqE6SR4V/qJxuSrdVTRybEKlYtM08a11tGHT4EayRzJBtxwscxzKqhrpi+SAH9QtlGCKMGS39K2YpiEEIdewsqVmv6dBj517lqJrg5bYVhLTI2naLfZUNbW0+FgtaAAFe+s+rIKSFx1jgrRGY+cVJhok/zrEE91j5VkYro7bh8TIzf9/hlvVuYUFHE8OnaLDytOZiZu0ccUh/FN4P1LUmcXqRipRM1lYRYH6lzZmH6mpagyRtrT3+pc1l5L3o9d8f8YTa/U2ZnZnz+H9xsNYOTw5c1dfZ7V0z5bVh5P1LD+vc2KjGpn3qHEEn6lgeI1E2JXOo/F91h25Hf0924HxtVQTcS+43nLiM8xaakn91aX9a1OJm75Lknysen6emlk178qrosDkgsTfdVHf2duuLrrh8K6pmfVXBbe6tmI4VDIwudGP3V39ttPH8QVBiNUHRkMIVqm17MXP4+Gu0YR1A2KhDnMAFlj1F1fV0eItMUhADvKybqDC6qvc5sYv8AsrPR5d4hJUtkMLtz4W1j3ySPO+V42D30dCemrNLEKWrhL6gizh9S9KvSxnK58EEctUL2H1LyjytwqrwSeNzmEWIXYnp4zClw2eFhlItbutzHukzyjyHjoRg+j14ys67jxGkh/wA0G7R3W4+masVMAcDe64h9N2ZRxBlPG6Uk2Hddj5cVxqaGN5N7rfxbTwHyLGjCTM1YDzZSQOJdyiFpLL+Aovc9qay2qZya7PPLqop7RXE2F0oebbBU/wCI1jnlSRPBburveilPoe+TsoZHubuE4m5umSC/8JmmVZTewje5/JUjXWIF1C1pabgqVjrkH7pAhPsqIX2H7qYyNAuVSOeGbqOSq1GwKdEv1NtFTI8228pGEm91FHKHhSM+X904suP6jw4t4Uke5v8AZNa0t5TmfMgjHoQkLg3lAA/j90xSDcXTXNNyUANQhCABCEIAErXHYIAJNglDCDdMa0A5I/j90qjUUnpgCEIPGyhlLQDdZ8BGs+AmoUf5OwHtcXcoePhTWu09km6fGfYj+DHCzikTnNJNwla0t5U0Wxg4OLeE5puLpoBJsE4CwsrURshHOINgmpz+f2TU8Y/g5rjcBKTYXTWfME87iyH2NTY0vsbWTw8gbWUSRztIuoHFpk0Wyb3Lc2S+6Pt/KpJJ7C91F+JPkfwl10SouAkBNtv5TZmNeLKjbVFgBVRDKZo7hRvtiSei21odE74fKbRSOkO6qq2L3FaqzEYsJa6SQ2AVeyWmULJ6ZVdSYrHh+HPkc4Ahnlcb+rPNp2G087WzgWB7rdOb+cFJRQSwia3wkcrgH1h5p/j2zsgmO9+6z8qftEqXWSkc6Z6Z01Vfi0sDKm93nurdlV09L1vVsdIwu1uWvcawuu6kx+4JOqRdY+jbJ2onnp3zQX3HIWBIhr7NuenT04xgw1Joz2Pyrt/JXoWLp2niaItNmjsrXkllXBQ4ZG4wtFmjstt0WFxYbGNLQLDwpseG5GhXUn2XOnLGhrbqeeLW2wPZWM4mRUho8q8U1V7kYLl1GLB+qTLsYLXYyKhtJqIUssXttuOwUjHguFhynTMJaT2sr7ilHQr6KEzO16U6oc50aX2m3uU52n9f2VaXwiss0UojcAXFUmIY/FhzbvcBYdyq6vlbBSvkPYLRWeebMPTlPIRNpsD3WVmTcemQu6SGeonNyiosFnayoaDpP1LzD9WuZEuMV9S2Ga4JPBW1/Ud6lzWumpGVx3uPmXMWOCp68rnOaS7W5c5dY9kU7to170lhFbjvUDSQTd/hd5ejrJcVf4eWWmJNh9K03kT6d6qsxKKd1Je7hy1ehfpjyqHTlLAZKcCzR2TaX7SK/wCZGy8vMrqbCaGF4gsQB2Wy8ApzSM9lgsB2KfhlPDHRsY0Cwap4iyF5AC6DGq3otwlpIr4//CWk/VXhvv8ATdW4D/yz/wAluprwIgVp/wBTVbEemaqI8+2f+S3K4KMRmTbpHgr/ANp7SmmxCtAH5l5M5msMuLyjf/xCvY3/ALSrpabF8QrXMb+ZeW/XmUGI1GOP0RbGQ9lYS60Zv5fWxSNNYf0/NWvLWMO/2VXLl7iD94oXG/2XQOXHp1rq4sLqW5J/Kt8dCejGbF6dr5KC/H0J0Yr4TLOn7bODqXK3F5Bf8O//AGq5UWVmKRkXgk/2r0awr0IvcP8A9mDj8ifX+iGWl3OHD/YpIUqTJ48tKC+nnpFlviAbYwv/AIUNXlnWuZvA7/au9MQ9I0lMdqAbf6FZ6z0tzN+EUIP/ALVoV4akvhDPmnv6cB4nlziMbyRC7b7K2ydE4lE7SIXfwu98R9KbntJNAL/+lWCs9Krmym+Hj/YnW4CjHYr5eMo/TjKj6FxB7dToXD9lHVdL1NG+z2Hb7LtB3pkfBASKEX/9K13mNkfNh4fppbaf9KwcmMqn0QrkvZ/TnbpykEeKx6vzhekn/ZuNjbjFGL/lXBTehK2ixxrRER/mePuvQH/s5sCqoMbo9Y+pvZZNlu5dl/HyIyez3z9DcZOAUZb/APmmrquG/tNv4XMnobphB0xRF4/8of8AJdLVFQI4tQT622jTVkGtlk6/w1uI0RjIvtwue8z8pY8bhma+muN+y6OqZ21h0OH8q1Yv01S1NNIdAuQeydZFuD0Ucm6M4tI8r/U/kqzA55pYaUjk/KuUMYxar6Xxcsa4tAcvVf1V5VNxKGdzYAfhPZecmf8AlHV4fiUsrISLOPZY8oJMxV92bF9K2d09LiUDJKq24+pek/p/zWp8WwuBjqhpuB3Xi/l3itX0ji0bnPLbP8rtX0y+ogUgp4JKw3BAPxKJS9S7TM9OqHE4qmLU1w3HlOdT+47WFqDKjNiDqCmja2a5Nu63Fhk4qKVsvlqt49jk/ppVTcnoN42aLKKN7tdiqpwDzZJ+F0nXZa1L2yytksUQI1fZRTyGM2CnjuRYbJtTEzQXErSrin9G2ReiKJzX8qnxakE9K5nkJn4gxyWUpqg9lj4Tbq1GLKE46TTObvUll07F6OotETdh7Lz2z6yJmGITT/hHck/KvXTrbpSDHKSRjmA3B7LnHOX0+w1tJNM2kafhP0rks+KiyhNHlnQYO/pPEwXtLdLu66LyCzuhwuSCldWAWI+pYR6k8sajpqtndFFp0k8BaAwbr/FOneohD7zmhsnYrlpz1LQtbbZ7K5DZsx4pDEGVIde3ddHYFiLq2kZJf6QvLr0gZ3OfJTtqaknccuXoblVmFQ4phcQEoJ0DutfBtl0aVMmbGlB0F6bTzDV/+tQRVrKqIe2eUrY3t3C6rFnuJdj2Vr6kBtgmNk1O5G6oZ6h0exT6OUyutfdaMJbHaZW2J4ClpvmSxNszcJQAw3urC7WhOyW4va6FTvlDSTqUf4rexP8ASbL9RdMq3OAGxTDubqOOW/KkBuLhVnITTGv5/ZNTn8/shrSDcpV8GP6K03aEjnkGycmP+ZOj8HR+CISEgC5Sg3F1PEcltghCDfsnjwRv3Rv4Qgcl0O9w9wnA3F1GntcNgjSGtCpzARe4TU8ODuEx/Rj+iu4P6KMmwupHcH9FA/5ikGSBztSRI/j90xRkDkyRKHFvCja62xUjRq4SP4LX2ySM9z4T7jyoxsLITOywOk7KB5LePKlTTGSeyfvbAY03F04OLeEhGk2To+6cm9gOQhCeAKRRqQmwugbIFE5wHZK42ubJhNzdDiMbaHtf4SlxIsSo2u09k4G+6RfBFJtlNXMI3b3VC8v07/8AJXeZrZBZUk1M0jjz3UNpZh29FvjcTJYqokI9vlUlRIIZDb+VFU4oyKMkuWXfLovwq9l0R4g6wOlYN1u2R8ElvCytmKw1LnNcf7Vg6sNM+J4G+yz5xU0dBxf/ANVy6OXs/cJmqKKYNB3YV55epTo6oqMQltETdx7L0/zcw2mqKWUOZ9J7Li3PLoelqcSkcWA/Eeyx8mrbPoDxi1fhUjjLprKmasrrugJ+L8q270zkhM+kaWUp47NWxOh8s6N1U0+035vC3z0LllQGha007Tt4WLdT2d/Vzf8AjrezhnNTJKripXuFM7g/Subuu8uazDqt59pwsfC9bMxcjqTEqN4bSjcdmrlvOX01SB8z46Mcn6VmXQ9V2dPxXkv5pLUjhCkw2amqLPuLdlkNMWCIaytg9b5L1uEVT3CmtbwFr7H8JrMMu21rFZNp6Pgcj+aKTYlW2nkiLb9la6jBYZ72be48KndiVQ12hxVdQ12poLlVcjqKcaFkdmM43gPskuaz+laWxVUJIYDZZ7V08VZ2VOemWvYXCP8ApSV3tPTK2bhw/Ga6xesr2bG9lXdB1MkuKN9wX37q7dSdPNjBaY7Ki6VoPwmJAjytzDvb1o8f8oxkos7l9GBhbW0jrC/wr1o9LWItjwemDT2C8gfR7XvixClF+4Xq36WsRdJhVOLngLtuOm3o+afKqI7l0ddYLiWqADV2CuBlY6xvcrFsArD+HAueFeaSd8hAXXUNtI8UzMf0m9F6o5FWK30ZGkKta4N5V7aMZxSY9OBGiyYHgmyc0H5vCaNaQsfdOSBwdwlTW00NA7C6b7h7hOIuLJui25KTTE2hWknkJU0PF7WTk71Qie2CEIRpDhj/AJimloJuVKdxZN0HyEJJAAjAFrpdA8lKhKAmgeSjQPJSoQAgYAbpUIQAIQhBGNeCTsE1SJH8ful3oX132MQhCPZjlBMeXNA5Ucjxc2ulTHcn9U1rY9R0IXd9/wCE5rt9ymoTJQQqWiZoa4XBSFhHA2SRC1lI7g/om+qE3pkaY7k/qnOcWph3N0qWiCb7GvaSdghhPBunAE8BObGXKSMnsj9dscLW2SO4KX5dkyVxaLBSJtlmuPqiOQgHcqMuN9inSuLjZMG5snstJEkJN+VKS7klMijF1K42bYJpUulpjCR3/tIWjlpUchIO3lPYToumTbRFGwfBc3uf7Ta50ft7pYn3NimVkOthKo2zcUWq2pNMs9dILENVpqJwyS7j3VwxR3sgglYh1H1AykDhrtt5VCyxnQYWL+dpIumIY9SRQEGQDbysD6w6tiYHiOYfyrTj/XMMYdecC3+pat6/zOp6R0h/Et48rMybvWPR33C+OynYnogzbzHFFTyF1SAA091x1npnWI3zNZXdz9SzPP7OQCllbHUN+U91xBnJmjUVdZKGz3u491y+bluKPfPE/FK5tbRT5uZxTVUszBWk891o7qDrOtqp3O/EOP7p3VWN1OI1D3ayblWyiw11WC6QLl8jKlJnuvFeOV41aaRTxYvLPJ/mPJ37q7UT5JWgMuqZvTzWy6h5Vzo4WUbAT4VX1c32d/x+Oq4JaJ4GuYLyBMq6wN2jTKqua5ulpVBK+QvOm+6fHHDkLI0x2S1NcZI9A5KMKwWqxB2n2ybqtwDpubFKhpsdz4W4cs8oJcQljJpnHcdloU4xw3IcvVHabNe9OZRVWISh7qQkH7LYuCenv36YPGH72/Kuh8vvT+HxMJozuB9K2pheRcdHQ6jSHZv5Vp00eq2ee8pzNftpM4fxbKw9ODU6m0kHwrpl/jLsHxNjC8t3Hdb4zrywFNFI9sFrX7LQNRg81FjOkC1nLQrl6nA8rZHKgzuf0i9XCtqaZrZu47r0XycqfdwqFxf2C8p/SDjZw7EKZj3/AFBelWSXWcb8KgZrHA7rXxL9SR4X5PhTblpG/qaVghN3DhUFTOwzmx77KgocbbURbOHCUPLpdd10mPb8Z5dbiygnsuDaoNI3U8NQ14sCrY5xeRY7Ktw9liCtJW7MuNHu+y4xRueL3/pEkenchS0rr/DbulqGA8KXaZWvx4xXRSOIvsnRPa0bpHttuoZHAE2KjcuyjFNSKiZzS2zTuqN8MpcSApoDc7lVkbByAiMv+mlVtIpKZj4wC5VsLmOba39JHRavpKI2aDb7p8npE/s2TAE8BOa0De26SPunKNTY0DxsmaXHlK55Bsla4u5T1PYACALEpTuNkx3J/VPbwP0Tk9iPpDNDvCNDvCehKN9mM0O8I0O8J6EB7MQNA4CC4DkpU14JOwSNdCp7F1t8piLEchK0ajZQyjscIg8bFPDB3QWtANh2UThsCDg2QlkjvvfukYNJAUTqTHaF0uPZIpFGnxrSQxoc3Ta3dOsPAUYNt09jtSmig9ULpA3H9JLgbEpQQOVDUSflCsxG+i2OfI26QOB4UBJPKdGSHbJ43019J2gggkJ6RrrhKkb0NUNCOaOzVHKNtP8AKkcSBso3uv3UKlti/CknDiSAodD27qubDr3ATn021gP6UyjF/R6l0UJcBsSqilqoY2aHP3KpsRhkhaXNVsZUTNl1vOwUVijEilZpF8n+JuoHZazzi6shwPDpnumAsD3Wb1nUlLSUZMjxsPK5j9WGZtNS4ZUCOoA2PdZeRYo/ChbLfw0L6hM/IKaomjFeLi+2pchZqZgnq6rfEycv1OPBUnqGzGmrcSnEVT3I2KwfK3C6vqrGGtcS4F3dZN10pdFST2ZhlPlTWY5i0U34UuBffhegHpMyedhjKaSSjta19lrf0zZHmcQSGjJ2H0rtbKvoOPp6ii/yNNgDwqcYORLVDZsjpLCoMOw5kTWAfCFW4rE72bxhQ0U7YwGE8K4tjbPHYrQoqSSRr0/66Map4yJ9Th3V9oiC0AeE2bBwHlwCcxv4Zq2aLPRFn+FdE+KIanm1kSVUMrS1jlZ6/EdtIKShnlc4Hm/Ksu1yI38KuX3Wy7DZOc/4dzbfe6WSRxaCWqx9UdRx4TSOe9wFvJVO65wRSnHvYzrbqSlwzCZtcwB0FcE+sfNhtLFU+3WWsHd1vzO7OSCCinYKpos07al57+qjMX/G31EMc9737rms3Mk2zNvt9Xs5vzPzMrcZ6jfAypc68h7rbfpg6QqOp6yEzRF2pw5C0hg/RdXj3Uwm0OdeS/C7k9GGV8lLU0rn057fSsqEna+ypG9yZ03kDkbT01JDUSUI7dl0p090pBhVIxsEIBAHAVvyt6Xho8HjDorENHZZqI2wAX8LaxsZJbLcIbWyKjMkDAH9glnrGMOolMq62NkZ3A22WM9QdSR0cTvjHHlWpZCoXQWWutdGR1HVtFSw2kmAt91oz1HdcUNVhdTCyYElpA3UPXOZbqHW1s9tzwVpbr/qmo6h1sEpOr7qSnk3JlSV07Ppxf6uOg6jrGuqHQ05eHE8BchYr6VsTrMUMn+FOPx3+VeoFflh/wB4ZiZKfVq+ydhvpcpKmQSnDjvv8q2Kcn3RDKX9Zwrkx6VpoZIvxGEnkctXUOXXpyipKRlsMFtvpXQXSHpzw/D3NDqPTb/SsxHQ9FgcQijiH7BSvIcWV52tGl8FyMw1rNL8Obf/ANKZ1F6fqGaEmLDm/s1bupMJga+9lcXYTSyxEFt/2VvFvc5mfdkNHHPU3p6ja5xGGi3/AKVh+I5G0dO8mSgb/tXafUXSlK5hPtD+FrDrDpSmY51mf0uywMdWR7M2eQ2zmOsybw912ihH8K1VOQtNK/UKAf7V0I/penDyS1KcCpGC3t/0tG3Di4/Biy382c04pkRTQ07r0AH/ALVpXNrIMVAl9ugG97Wau68cwOjfHp0D+FgnUWXtJiWoGEG/2XLcjxq1ssQyWjzVxP03VDsbDm4cfn/KuuPRXk9V9PYtSyvpC0At7LZByBpZ6wVAor/Ff5Vt7JnLVmCVEZ/DabEdlxOZQ6pdGjRyEos7y9IVdDhuAUsEjgCIxyuh/wAbHU04Ade65PyTx5mDQQs1gWAHK3/0x1dDWU7Q6Qfys2GXKt6NrGz3LpmVlrQ+4T7OcwgjYqkpqxktiHDf7qolqdMeyuV5Cmi7DUu9mv8AN3o+DGKKW0AcS09lw56k8kJ5femjoe5+leiGI0v+IMc1zb7LUmcWV8OK4ZI78NckH6UkqkyGcdHjpmr0vV9MVz3e0W6XHsn5Q5nVOEYlGx9URZ47rffq7ygdQS1EkdMRZx+lcjmkq8ExkjdtnrIyn+NdEP5HE9Q/SLm1FijYI5Ky5Nu67n6PxaKtwqJ7JL/AF5C+j7MQ4bWU7Z6i1iOSvSXJnNGmrMLgjbO03YPqVbHyZKZfx7ntG7Yy4vDr7XVUWh4AHZWTCsZbWU7Xttv4VzgqHgbrpsexOKZrVy2ipa+Jgs42KoMQknkktGdklRO4v2UlM8PFiFpU3sll0imbDp+N4/lMfURX0sO6rKqDVGSPCskzXQzXJ7qW23cSjb8LiA2SIgi+ysXV3T9LiOFyMMIJLT2V4gmD47E9lHUua+Mx32IXOZ6U4spz046Z56esXKl076p8dJ3dwF585k9A1GD47JN+HIs/wvaTPnKul6goJpPZuSD2XBnqJ9PH4aaeqZSkWuflXI20fsVluLNC5GZiSdL18THVBbpcO6789NufbK2KCF1eDcDuvNLqzDp+j8TJaS3SVtv0251z0WJQQOqrWI5cruJH1J43NHstlx1DFjNFFMJgbjysyexjo7gLmD0r5rnGoKaB81wQL7rp2Kojlpg9rgbhdRhy2tGjj3eyLbiDHA7BLhwe111NiUL7amt5UFHI9vI7LoaaE47LKs7L1G9pZcnhJJeQ/CqaCXVsSFWROaBt48pJv0Y5S7KSoa9t9lBd2r7q4zMEgKhNJqN7Jifuh6extMXHY+FUtIsBdRRxlp23UjbX43TLK0kK0K4tHKT3meVFUkh1gojtyVERNbZWB8em6YQXG4UERu4C+yqWfKnJtD/Ujka4dlJEwFo2HHdKWh2yLaRYDhPjNjd6F0Dy1N9sDm6UG4vZClTY2NgwtIQGk8J7m32KQNDeE5PaJlJtDfbd+ZOZGeVLcWuUhNhdN9mMcxtrHdOGkcEfymk3N0iRsY5DnSMAIumEBwuAkLLm90oGltgmewjeyN7HHgFJ7Un5f7U7Wh3Kdob4SCfjRTe3b5uVJGABZPcADYJEj+Do1JPYIStGo2uhw0m10wk0hE4Obbdv9JqE32YjWhrxd1wErBYbhKla0EXunKYgiEIUqk2AJDJvYkpVC8ElPg9kVk3H4Pc/f7fomOJcfh/pNTotin/Xor+7bHEEbpPxMYFibFE8oAsCrdXyOjaZQdwopvRapr9iudXxxu+J11FU4pT+38Lhf9VjdRjEj5CC47KCTEzb5/7Wdfe49GxRhKa2VmK1JeS5jljeMYw6lafdksP1VXX45FDG4vcP3K1dmjmVR4fC9rpmiwPdZGTfpHQ4PHStetdFw6gzNpcJcSyqAI+6xfF88MP9pwmrm/uVzzm9n1TUJeW1rdifqXP/AF96qRRskDcQAt/rWRZmuJ6BwnjX5ZraOtcyc68GkpZAK5nB7rlzNbM/DaqufadhufK0R1h6s5qpz424j5+tat6mz9lxCoL/AMYDvf5lnW5zkey8TwCopSSOteiev6IVDSJm8+V0Jld1th9XTsaZm8BeZfTefElI9hNX38re2TfqPeXRsNYOR9SgVvu9D+Q4twhs9CG0dHjdNaMNdcLCuvMpIMRgkLqUG48KyZK5zwYvGxslQ03A7rdtDLRY7StcLHUN0WURsj2cas3J4u/9fhxBnF6evdEskOH+eGrlbNPIutgmeG0LuT9K9burMraTE6V94Abg9lonMv05UlUJHijvz9KyrsDR6J4/5nGbSlI8rMcyrrKNz3GlcCD4WPVXTdVRO0mMiy7pzO9PjaJ8uijOx/KtA5hZanDJHkwEAX7LKsxu9Hs3FeTfmgls0fTxSQygPB2WQ4f+GfT2fa9vKpOo6RtDLa1rFUFNibWNIL1H/jLZs5HKKdYzq2jpy0vaAsYwprBiFgO6vPUOJtdCQXXWP4JVxyYqG37rTxK3FnnPkM43VyOufSNC44lSkcXC9WfStE8YXTBo7BeXXo0pGVGI0gHches3pVwL/wDDKV+nsF2/GLtHzH5hP8cpM6K6ZoJXQNcQeAsjipPbjAYN7KPAKEQ0g+Hsqy2h9rd12uPFeiPDczI/JYyTD45B8wVfpNr2UFFY9lWhg7qy0kY7lshbs7dSDVbbhIIwSCQnnZtvskehrYkfdOTY+6cmqKQj7BHKEJw31Q0sN7hOHG6EIFS0CEIQKCEIQAIQhAAhCEACEIQAIQhAxLYJH8fulSP4/dA8YhCED4/ATHcn9U9Mdyf1QKIhCEj+ASx8j9Er3WFrdk1psAfsg7i5JUa+EbY2TsmpSSeSkSkTWx7OE9nCia4iwupY+6VfR0RX8fuoZuP2UsjgBZQSODu6miiaK2MTiw9ihlt72TgLlKSt6FjaRullcGgX8pSNI2UUr+A4pNlK57ZDI6xJ+6Vrxov9k2Wx/cqNz9LbA2UNkiu2kPbVhhIJ4Uk9W0xHdWepqC2WwdyqiHXLDdZ90uixjy3Is3VFd7UbzfgLSebHWYw+N5EtrA91t3rgPbE+3hcq+o/GaqhppnNe4bFZtkj0rgKPbRrLNHPtuCmT/iyLOP1LnrMf1SRudJqrj3+pYd6hsxq2nmqGuncLOPdcg5oZvVsVXK1tW7n8yyMqXR9B+L8Qp1KTRvHM/PZmMse1tUTcfmWhuqcYfi1S54cTdx7rBm5iVuKTaTUON/usk6fZJXgPfc3XKZ309u8cwo0taKN9CXPu8KaFgg2AV3raBsLT8KtFVUxwuLXFc/ODcj1rDjX+NIlZK0i5Kpa+pc35Skhn95+lg7q4QdPTV7Q4RE3+ykqg2XLMqrHr+lmo/eq5wweVmXT3QVVijmFsd7/ZVHSOWtXVVrbUrj8Q7LpjJjI59b7JkoT27K/VVtnnXkXkNUIPTMLyl9PtdW+1I6kJvb6V1HlB6e30zY3y0g2t9K2jk1kRRUtFCX0I2A+lbu6ey7ocMhAbTtG3hbNVP6nz9zPlUle1swLpPK6noYmg07dh4WVT9I0kNGW+0OPCyWempcPZvYWWP9RdW0FHA9rp2i33V1QhCPZyzz8zOtTjs0Nn50fTyUsuiMcHsuResulRR4s94j4cey7Bzg6zw6rikjbM07G+65gzFraV1RJI1zeSqza2dVRi2zr/AGLrkXjwwbFYtT7WcO67ryMzTphRwsNRvYfUvMfDeu2YHiTS2e1neVvnJnP/ANqSKL8fwQPmVrHt0zmub4J2wb0epvRPW0FfG0e9fYd1ndDWR1MYLDdceZG5uuxZkYZWXuB3XS/Q3UH4uCMulvceVv42RuSR4zzXDyx23ozmGE8lVsB9oblUdFUxvYCHhVTjqb8O63K56RxFtfpvRX01Y22xVQZA4fsrPTOcHbq6U13WurCkZNu5PQkrbi4Co5WkE3CucrG6bX/lUc0B5smykyCNG5bGUzS537q4wWDRsqGBmk7Duq2IgtsCmxntlv01ElcWi4AUR+f9097uSFHc3upXJjddEzOf2SkgC5TEpJIsSmp6EBxubpEJzACNwnJ7AanNeALKJwOo7JzL23UqehjWiTWPBSjcXUaXU4d09PYg87C6QODuE3U490AkcFOS2A9Ca15v8RTgQdwkAa87WSBwbuU8gHkKOos1l+E1rY9NDXVAud0Nka42VG55JuClikcH2TGhS4WB3skczcusEkRJbuU93B/RN9WKumROdpNrKOQnkFPcCTsOyjf8qdGLfY8QEkgEqVnH7qEchShxHBUsY9BroUvBG11A9ri43Klt/wDV0haCbkKQX1Ivb+6WOM33Kk0N8IJDT4QN9Ox7GFtk9rdQvdMEnwpzHm2xTWmNcWkNlcGgfqqOap9sm57KqlcHNsrPijiCQComtDHErqfEY7gEqtE7JBcLEoqiRsu7u6vmGVYc2z3pv5FEbLorJ4o5QQ4f0rJ1DHFR0r5gbWbdXmWZuj4SsGzY6h/wvCJXGa3wHuq12RHWita+tGos4834+nY5IxVWtf6lxH6n89n4rT1EEdWSSSPmWS+rnOqTD6ieMVhFieHLjHqzMap6mxB0JnLrvI5WVdb7Mp2aXZaMeixHqvFnAanapNlvr0r5OVRxGGWWnJu4dljeSOWEnUlXFKaUu1OHZd0+nTI2Og9mU0IFgOypJe8iGME2bw9N+WdLh+GwSSwNHwj6Vu8YbDBEGMYBYdgrVl9043CcMia2K1mBZIYRsCFahR+uy9XV0W00z2uurnQOs2xTKgxxt3smU1Q0Ps07d1PCtxL0I6KueoA2KpKj42pah4Lr3Swt9xWE2iRyLXPRve/ja6uOG0QYLuHCm9gX4TnPEEVybWCmU0RSn2LVBkcJNuAtD+ofrxmB0M590i1+62x1T1ZT0NG8mcCzT3XFHrMzWjhoKlsNWL78FUM61fUZ+Ral8OfvUJ6hXNq56ZtYeSPmXNGP9R1PWOKe22Qu1u8rHs68w6/EsdmYydxu88H7q9enzAKvqTGoTJEXAuHZc3cvdmVY/fs3NkBkPPi9XDVSUt72NyF3Z6d8o2dPmnc6nAtYn4VYvSxkzT/4ZBM+jFwwHcLp7p3o2DCYmFkAGkeE7Hx3sgS0ZJgbI6OiZG1oFgpMXr2RQl+r+1ba3EG0DAC61li/U/WcbIHAT8fdbsU416J45Wo+pN1D1hHTMcPdtb7rXHVvXQlY5rZe3lWLrfrt/uvaye4P3WE1OPVNfKQHk3+6xcyzQ3f5EQdV1tZi8zgwuPxK24d0pV1Mo9yM7nwsw6W6f/xCQOkjvf7LP8F6EpxpJiHHhUaMhph6aMI6R6BjaWvmhHI5C2TgXRdAIQDE3jwqqPAYKBu0YCngr20x0hdFiZLaILF0Ulf0rFACYWjnawWNY10891w5qzgYrBI2zgrZipglF2hacZOZQulpGuZ8Ikgktba6lZEY23cr7iMUIde3dWLFqpkDTpW5x1Lc0Y2RPRbsZfH7Jvbhay6zh1vdpPdZljGLE3aDssQxx3vXJC9H4yh6RkWXdmGzUj9RtblUWIMMDCfsr9VMZHdxCxzqOuYyN244XTPB3Aqq/UjGsexX29i79laqHFaeaYBxG5VB1XipaXaSf5WLRdQPgqL6yN1znJYL0+ixDKRujAGYdLpLtO6yzD6rDaFofGWghaTwPrcxxgGX+1emdcyyNu2Y/wArzflcRpssQytM3r09mOygmYxktrHytt5fZtNeGB1R/wDJcb0XVk3uNd7xWbdG5h1FK9n/ABB57lcTkQ9JGxi5XZ3h0xmDDUsFpb7eVmWG40yvYAHXXJ+WeYz6ksY6p5t3W/Mvcd/GCP8Azb3AUdVyT0dDjZKetmy6RjSzUQqTqLCKetw9zHMHHhVdA7VAHeQircHxlvK1PypV9mrKKdeziz1c5VsxKGodHTg3vw1efmaeUlVh2LyyCCw1eF7CZtdCQY/STaqcG/2XG/qEyMbTtnqI6HexPyrCzJ7KqgcadB41V9IYkzTIW6XDgrs30356ksp4Jqs9h8y41zHwqTpvEpDIwt0uNldMm82psMxiGFtURZwHKoUT1NbLNcfVnslk71lBjtFC4S3uB3W04Y2CHUPC4w9I+aZxGmp2Pq77DYldf4LirKyha9sgN2rqMa1epqUzS+j62Ox2TqElpsQle0yn9U+OIx72WjRLslc9roqHtuwi3ZWfEKY6rgK6++PlJUUsLZP5VmT2V5pMsrWyMuAmSSOa4g8/ortLSN7NVvqaVwlvpWbfW5lWcNltxfAf8VpHMe3n7LQHqJynhnwyd4pxfQd7Lp2GNhhDS1Yfmr0zDiuESgxAksWTdgtdoinVpbPGn1QZa1NDXTuih4J4C05lxV1/T/ULPcLgBIvQn1MZLitfPIKLz2XGPXmXsnTWKPlbBp0uveypSh+IhUWmdlekPNuKgZTGScggD6l3L0BmrS4zTRME97gd148ZQZpzdOVkULqst0uHddrenTO9uIPgjNdfcd1q8ddsmhZ6I79pJoK6la8AG7VDPBHECQP4WNZcdQ/4thsZEt7tHdZJVteYrgfwusotXqWoWOSIjUtbxyqzDpzJyrK50jX2crrhD2uFwUy6Sky5B7LnazE1ODm2sSglljx/CZX8JhhIAuUy9ySEF4ebXQ1ovZJY+hyeiOYFzthwojC/sq1kTTuUe1ftZMSbEX0poY3BwCqmRnTuUntad7JQXW2T4xYrY8kAXUbnDmyeXtAuSoXPseVJGJDOWkO1jwUBwdwmag7cIBI4Kek0yFTRIhIHC3KNbfKXTRPGzaFQhCT1EAbmydoPkJG8j9U9NaF9RrWkG5TkEgblIXNtsUDktCoJsLpmpw7oLidiUz1YoONzdLH3TU6PumyTSAckd8pSo5TAI0KSw8BJpb4TfUVvYxOj7pdDfCUADgISaYgWHhCCQOUmpvlSR+AI9pO6h02O+ync4WO44UBJPJUkRHD2GPvrsAkBN7EJ7mg7piPZEMq/UZNfTsqCucJIy0KuncNJCt0zryEBQWzSLGPveiyV1GWEuAWM9QYn/hkZke7YLNMW0NjJPhafzn6hZhmHSu90C11j5NnR2XEUq2WtGLZh5zUmExStM9rDyuTPUP6lY4BK2KuPB4erb6kc7pMNlqY2VlrX7rifOfOHEMYmkbHVON791g32bPT+M4v2iui5Z0+pmqmmkY2tJ+I/WufOt878RxESBtU83P5lberHYxjkrnNDzclYZimB18Dz7rHfwsS+fZ7F43xtUUtoqZ+vMSqpTeZ5v90x3UdYRd73fyrZDRFr9LlcI8LfKzZZ1lmmenU8fFV7SKum6rqYy34zt91nuW+a0+GTtDpyLO8rV9Vhc8IuAdlDTVlTRP1h5Fj5T6rOzJzeP99rR6B5B+ouOjkia+rItb6l2lkl6gaDE4oI31QOoDly8Xeic1K3B6poFW4Wt3XVXpw9QdQKunY/EDyPqWpXL2WjzbnOEkk5aPYTpfGqDH6IOY4HUFD1N0bBVwue2JpuPC0l6cc3W4tQQCSq1XA7rorDsRpsRodRIPwqWUPeOjy3IWRgZHtA5uzey6pvYmcYG8H6Vx1n30WynkmDIh37L0TzTwSOqglLYwQQVyJn50WJnzFsF9jawWPdiv3PWfGPIJRx17M89sysBmiqX6Wd1gv+GVgJs3uukcx8vJJat/8AwpO/hYdDlTUSv/8AyM2v+VR/4r0egQ8ghKGmzR+OYXVmnJ0lWLAMOqm4sAWnldC4/lFOykJ/Bnj8qw2iy4kpsXuaUix8KxTjuLMPlOXhOt9nRvoip5G4lSNf5C9gvSlTM/wSmJG+lq8qPR30w6lxGl/yeCF6wel+EwYLTtIt8Isuo49OMkfPvl+QrFPR0Zh0TG0235VDVyNY4EJtLVFtN83ZUc1Q6SbSexXY0z6R4hbFptsu+HTtIsrg1wcLhWbDXFtjdXSGQlmxVhz2UiZB3FkjXA2F0qcAjWlvKVCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAmkCR/H7pUj+P3QKMQhCBya0CY7k/qnpjmncoHCI7/sg7C6UNLuECSHgWFkEXFkHZIXAGxTGtEL3sYhCALmyQQG/E7SpraBcJscdviv3Tn8gJV9JEuhkpJaSqd77HcKaR/wkAKmlaSdlJtksPgNlJcAqqIgjZW9gIeL+VXQRuDdRKeJc9LokVPPzspy8BU8zrpraKM2RSdlE8azpUzr2v8AZQmM+5qVWx9aIpdlHU0f+YHWVxoYAILFMmYJCp6dzWR7lULPrJMb/wDkMT63gaWyDyCuXfUl0y6so5Sxt/hPZdW9VU4na837LSGb+BNrKaSMt5aVStj1s9V8Wsj7xizye9VvRNXGal0LDe54C4RzZ6fxKKtlDozs49l65+pDKkVDJ5XRAgk9lwhnzlLHDUTyNpgNyeFi5KZ9NeMZFddKTZyb07Q1MFUA8Hnwtr9GMLYQSOyx+u6fbhdaWllrHwr/ANMVTGWaucyqnJ7PUeMzYQ7TLpjLHltwCsXrcPmqJ9geVsGiwaTGAGsZe58K+YPk5X18zS2lJBPOlZLxm2dJLyCNFf0wPpLoaaulZaNxv9luvLrJOXEREHUzt7ctWWZb5E1dO9j5KPbblq6XyZyTErodVKBx9Knrx9HFc15pGuLSka2yy9MAlkZKaMnj6V0plfkRT4RHGXU1rActW1Mu8naaipowadt7flWwIujYMPg1CMCw8K/CnS2eJ855jK+1wUtmK9LYBTYXCxgbaw8K5YrjEFDDyBsqbqOsbgzXSatgFqjMbNino43sM9iGnupHkKpaMLGw7eSuU38Zdcwsz6fDad7vfaLX+pc3ZrepCGjkliFYBufqWM54Z9wwwyxsrd7nhy48zazkqquslfHVOI1HhyrTzNvtnr/jvi8ZwT9TefWXqIZWzPb+MG/+pa66lzOFfE5/vA3v3XPdVmDiVXXgiZxBPlXV/VU7qKz3G5ChWR7M7WXjqqj1EvfVuYb6WpLxNax8q85W53ywYixhqvqHdaX61r55ozK1x3+6x7pbqWpw/EWuMpHxeVfps7MvO4NShpo9dvStnYZTDepBuB9S7sykzOirqaFrJhcgd14pemjPBuEyRMlqiDt9S799OGe8NXJTk1ZIIG2pbOLY1JHjflHAQUZbR6J9PdVGdrWudysxoKls8YIPZaLyv6oZj9NFPHJ2Hdbh6eqf8sNJvsunol7RPAeawY49jSL9DCXPBA5VfT2jAJ7Kkp5WNZqupmyiRvwlaFfaOKsrf5CqdKHC4IJUbhqFioWymN2kqoYwvbqCVx2PUfVEWjQdk9khF72Q9hJsmua4C6aoPY1y0yaO7uVJoCihlA2t2UwNxdOe9CPTBCEIQxoE8NDeE0NJ3T09fBBCwE3SFlt7pyE9bAj37oT3NumlthdSJrQ1p7EQhI52nspI/Boqez5Qow4E2CUbG6VpASKOobrZpTw4O4Spgq+lAacg2snR09viIVU8DUdklgOAk0mPCM6QlLyUiEvqP0I5xbwo3DULXT5OyanpLQ9LY0Msb3TkISg+ugQhIX2NrIEFUb32AJTw64uAoJo3OBsU1ySFTSAT/Ha458qVlQLbcqhAe125KkivqBLu6b7psJNaKx7TYFUFXSOlubK5xOjfGASo3e3r07Xuo7JLWyFvssT8NLDcj+lTVWJMw8but+qyCpawgtA7LDutKKWKF07SbC6yMi/1K9kkiOuzCZQNc6R4t5JWkvUTnPTjCZ2Qzt+Q8FWzOnNKPAKaaEzaS2/dcc53+otj3TUT60m4I+ZZFuVtlRyTNP8Aqp64qsdxWZscl7uPBWpstulKzGsbYZGkgv8ACyrqCo/76YmZGu1a3LbHp5yYlrsSgcKe9yOyjja5EWtm/PSJkzFMyne+DuPpXdeXWW9Lg9FG4Q2s0dlqn00ZanAaamc+EDSBf4V01h1KxlM1rWjZvhWqkmyemtykSUsTKWla0CwAUVRiLGd+FLXSaINLRurDWGUk2WlWvb4X1XpaHV2LGV+hpP3VVhLnPAcQrRHBI6UFw78LIMKi1Na0BXoUbQ74SyQPeNQCWIlh0kdlWFrYYTcKjEoe+wSWVeqIpzSJTKQ3VdWLq/qJmFUUjy8CzfKuVXUtgiLnHhajzz6vZh+FzubJww91kZF/4ynZYa6zlz1hw2CWM1QFgfqXDHqPzWn6knnhbPcOcbbq++pXN2eOtmZHUkAE/UucKjrB/UuI+wXkkv33WLfle7MnKs7Mcky8m6mxv3jGTqf4XUPpQyGdBWwTGmOxHZWfInKV/UFZC8wA6nDkLuHIjJduAwxSupgCLH5U2qPuyKD2jb2R/SEWAYNC0x2IYOy2JJpZHceFbenqeOjomxBoGlqpupOq6TCYniR+4Hlb2JQlHZHdP0RjOZnVBw0EB1ue60n1tmgY2ub73nurxnLmJTz+4I5P03XPvVWP1OJVBZG4m57KzbW4xMiV+2Zezqd2P1nt+5e5WYdN9ITVGl5jJBWucsMGq5q9ksgPzLpHobBYnU8bHMF9uVzWbDbZq4s/ZFF0/wBNnDmh4Z/SyihqBAASOOVcqnCI6aAPDRwrTUght2/wsqNbTNFw2uiukmjqm6QVG3BRMbglUdA+V0lidrrI8NjBYCfC2cTor2QRZ5MCDL/FwrVisQpwRqWXVlK+QG3dYr1PTyRhdPh1ezRkZK0jF8VmZv8AF/Sx7E4xOCLqvxeaUPIJ7q2veHA3K7ji8T9k9HO5Tf0sNfgjpCSFYcXwpkbDqWa1MsbGHUVivUj2uJLXdl6Fx2P2tmHbMwnGKVrNX6LCepqdz9Qb4Wc4yRZ2/AWJ4uxr3HUuzjjL8SM92fsa06gwOSa5ssOxTBpKZ5cQts4rTRaTfusM6opYyHELA5HFTixVbowwVj6R3z8FXGgx8E6NY/lY71BK6nlcG3VspMWMMnxP/teaczhfeiWFz2bRw/Fi8j4hsshwXE3xODr9wtXYR1HFdo93+1mGAYqyrAY1/J8ry/k6XCTNbFvZvbLLq8wzMBl4I7rpPKjr3QYw6TbbuuMOlq44bad0pAG62T0bnTT4ZOyF09rfdcs7XCw6TCv/AHWzvjAermVNG0tcP5Vzp8UdUuIG+65oy0z1o60R0xqb3I2LlvjoXGIsUhbO117hWnlPWtnV1y9opF/rMMZXQua9vK1NnhljS1+GzSGHbQfpW66bS4abcqx5gYW2vwqWENuS09lBY/ZbLyoSh7Hkn6tcsfwNVUPpoyLX4C5k6cFXg/UTWkkWk/6r0x9S2TkuJ++804Nwe36rhvM/Kap6YxWWt9nSGuPZMqr1LY1xSOh/Spm7/gzqaOSoAsRe7l3tlRnBBi9FFGJwbgd1439F5jzdNYiwe+W6XeV2H6YvUGK2eCndVk8fUtaiz1WmJ+X16PSvCcQZWQtka4bhV5N2XWu8ouq48aw2JwkvdgWwWgPivda2LZtaLNU/aJSzSObJcKeCcGyocRqGwyWv3U1DG6ZuoK377Y/6Vp0kagVE6kEpTmRuBDSVVxxBnKsV1KfbBx2UgohG291QY5h7KyifEe4V1ryWx6gd1QNcZLs8pbsaLgRWQ18NA5y5Wx4lTyO9i9wey4S9UmVf+ENnnbAQRe2y9Vep8BhrqRwcwG7fC489YGV4qcNqZI4RwTwuU5Ctx2VZR0eUfUXUlX03jZaHEaX/APVdCelTOGqdiEDDP9Q7rSXqE6GqcMxqbTERZ5tt91TZEdXnpXGImzyEaXDuqeHd+Iqy3s9tvTXmCMSwuFskgN2Dut8wVMVRTtfcfEF50+lnP+jZBTxGr7D6l2fl5mVS9Q0kTI57kjyt7H5BL6yzRJozeuax0l2cqowwPhILu6ipaMykTE8q5fhgY7NHZaEMn8iNOpPWxXVIduClbNq7hUojfG/SVUwU7juVZhYtFpaJWMF9j2TwwA3uliZp2uiYhgJ+ye17Ia/goeG7FL7oPA/tUhqA5x+L+0jalt9nX28pfg5aZWndv7JrXaRayZHJrGyV/wApT4/Aa0Rzy6bW/wCajDrgFRzEl1ipYmGwN1NHRWt+j2cfukaS47lI4nUbFKzn9k7XRV32OaNRsnaB5SN5Cemk8GwQlLS3lITYXTW3sspLQDY3T2uLuVGHjujWBw5JpjtMlIuLJjhpNrpBLY8/yjVq3RphpghO0HyEg+F2/ZII3oVrARdLbSPhSe59khltyENDd9i63eEB5Jsmk6jdK35gotIftD0JshsLqP3T/wDRR6oVLZI55BsjWfAUfufb+0e59kvqO0h7nahayRR3I4KCT5SqLQfBz3bbH9VH7n2Sm5BFk0tI5T9JDo6YOks39lHrN7pzuFA6drXabKGT09Ia47YVLrNuVbaib2tT3dt1cZ4nPj1X5Cx/qOrFPA9oNrBULpMu4lCnJItXVXULKene5rxs3yuYPUnmIY8PnjEvF+62PmvmIzBonsfL2PdchZ/ZjjFo5mRyHe/dYeVbvZ6Fw2KoNNI5W9SHV82I4nUMbKficRytP4Rl3VdW1ezC7UfC2N13glV1HjTy0E6nra3p8yVfPURPnp73I5asK2b2en8dONcVs0xhPpPq56X8R+Acb7/IteZt+nifBWyPNG4WB4avVrprJjDosHDX0jL6fyrTPqMyFpqmkmkgpG/KeGrPsTfZ2/C8nH/KUIs8jupOm5cIrnMcw2H2UuDwukaAWrfOduSU9BiEr20tgL8NWoarCzgb9MjbWPhZ1sHs934uP56Ey21+Ggxm7P6WI9QU01OXaWGyziTE6eouwEfyrZjOHxSxElt9lHFtDcjC/b4a2mxOqpZ7i4sVtXInr6qpMTgaZSLOHda3x7D2Mldpb3Vdl5WuocWiDXWs9aWPZtnN8nxkZVvaPVn0kZnSyQUzHVHjuu58vurRWYcy8nLR3XlN6Uus3U/4e8h2I7r0FyT6vNbRRtEl/hHdbNTUvp415BxNK30bj6meK6BzebhaXzMy/biYkd7V7jwtyYbIcTa2O3ISYp0Z+JjN4+fsnf43uziq814UvVHFHVORH42rI/DHn8qfgfphkqGBwonf7V10Mpoqup1up28+Fl3TmVtHTxNaaVl7flUqw22X15I649s4X6p9MLo6Fw/BO4/KtS4t6cXUmIue6kI3/KvUnqPJ+lqqRzxSt48LUHV+R8UtQ726VuxP0p8cNx/hnZfk8Zw6kc9enDLE4VikFoSLOHZeiGQGFOo8MgYW8ALn7LfKr/CMSY8wgWO2y6myrwwUlJGy1rAK9RV6M895bkv8lPs2NSRaoNP23TX0XxB33VRRtOgfpZVQpdQBW3TLRwV0t7IqGmIGwVeyP2xZR07PaFip2y37K77FEGfME9MZ8wT1JGQAhCFIAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACR/H7pUj+P3QAxCEIAEEA7FCEDvZjHsP0jsnMBF7hKla0O5QJJ9CFNe0k7BOOxshDIiNPaBYGyNA8lKBYWUYqWx0fBQ8Em4CVnH7pUfB66IXRixCjfCTvp7Koc0Wump8W32SKRSugDXA2VS06Y9kaG+E0nbSB3T9tsbPsjefiJKY8g8J8nf9FEmyZQs6YEX5SOaNJsE5oubJXtAYSPCqz20NivYo5JSwqnlxEsabFTzsLh4VBWQODDpCpWItUV6kihxbEfdBbfkLX3XGGOrWuOi9ws4qKVxebqgxLB/wAS3dt9vCrODb0dzxGVHHakjlTOrLx9fRy/8LfY9lxR6gcopb1BFGeD2XqN170WyppHtMfI8Ll/PHKZlUJtNPe4P0qhkU7ej2fx/n9wXZ5L5m5dVFBWvcKQjfwsa6dwKZtY2L2T81uF2tmv6eJq6aQx0buT9K15g/plxCPE2u/BPtq/KsqzEbfw9KxPIIxh9LVkzlbLjckVqQm9uy6xyp9MkNXTRyzYcL7fSo/Tzkc7Dp4BNSHkctXYeXfQVNR0cY9jsOyhjx/tIyuY8sdNLcX2aj6c9NlPTlunDwLD8q2T0PlRHgj2EUlrHwttYb0vTtYCIe3hVb8FihGpsdrfZMtxFWzyrP8AJrsub2y2YNh8VFAGlgFh4UHUGK09PTuBcBspsarm0EJJNrArS2bWbsOCQSXnAt91Uskq4sg43At5DIUijzi60hpKSYioAsD3XFHqFzsdhz5xFXcX4csmz69TUBFRA2sb3HzLivPDNuTG55RHUX1EjZy5rKyH7nvXj3j/AOKmPRYM2s7q/E6qSNlY43ce61ZXYxXYxK5z5CdSjrzPidYXude7lesGwFvth72hUJ3+q7+ntPA4caoJaKPBcAkkeJHj+lda3D3Mi0NVyp44qSOwCpK7EWa9NwpaLnLs6u7GhKHwxzG8EqKmmc1rSdlhOJYLXYe8ye2RbfhbdoTDVjQW/wBKHGOiWYjCSyI7/Zb2PLaRyPLKmuLMG6A65xDB69rRK5uk+V2f6Ts6qt9fSwS1Ztcclck0uV9XHVGRkLhv4W4ckaWr6YxGGR92hpC1qbNSPHvIYwvTSPZf0xZlRVWGU7TVA3A5K6j6Z6hhlga4zA7DuvK/07Z+RYJHBDLVgaSOXLs/KzP+gxinjaKxlyBw5dFiZS1o8J8i4N3P2SOomY4HMAa/srjhdc6Ru7lrPprqtmJRMeyQEG3dZtgmIM0g3C3aLFI8vz+MdEu0ZNE4yPFyrnSge1ZWOmrW6hurzSTB0ex7K5HTOeyIuK0JU2adlCXE8lSznW43UTm24T4w29lCUtDqcXcNSqeFBTtBdfupyLd0soDoSbYIQhMUOuyUUOI2ungg8FRpQ4t4S+oxrQ9CBuLoThASP4/dKkfx+6AGIIB5CEJ8XobIQNA4CVCE/wBmNHM7pyRnH7pU19i/0Y/5ikJA5KV/zFMk7JV2x4uoeUah5UReQbIDyTZSaZISOBcbhNILeQns4/dKQDyE3aQb0RncbKF8pabalM74SVTT3vdI5aG+zYrqoN5cgSmQ3BKpZQdrbKSBxAsoZ26+DXPRWMIA5/tK5pIsLKBshaN08VI72VWVxH+Rf0hnp3u3CppGTRC4urj7zbX/AOqY/S9hF1E7exXNa6KKkqqjUQLp/uSiTU4nlSQRBpJFklVZrSQktufpsrysm+xXSh3Llh2aWMx4dg73ulA2Krse6rgwYOdK8Cw7lc/+ozPqgpsMkhbVtBAP1LnsvJ/UqWX7WjmP1nZojDG1Toaux34K89sw81K/GMbkaKpzrvI5W+PVzmn/AI46oZDOHXJGxXLeAdP13UGPa9Ljqk5t91iyueyJTTN4envA6/qivhvE5wcQvQz0yZKPhbT1MlF2B3aua/RPlBI6op5JqY8jlq9Ocksv6PDcJgJhAIYOyuUSbLVUHJmSZfdMU2FUUbXQgELN6cM9uzfCtpoBSxARDjhPp6x0fwuWvRvWjQqr9WVFYA4WKphh4mNwE91R7rr37qoo5WNtc91r0QJ5LSIY8EDXC7VXU1E2nbcBTe/GRcFQT17WbXWpGWlorzevotVIwRlrlaaiqZTDXe1lcf8A8qbqurH1Wz8LQukB7KDIn+nRStk/v8Md6u6zhpIHgTAW+65o9SeZjW4dOxtUN2Hur/nhmo3ATO19QBpJ5cuNM+c/osRfNTNqgSbj5lyGdNt6M6yw0nn51NU4pic7Y5SbuPCxDKbp+sxPqCO8Tjd/hXp9HP1fiZLWl2py3p6fsg5nVsNU+kO9j8qy6q5TmUbX7m/fSTlk57KaSSl8XuF230h0jS0OHsa6AA2HZak9POXzcEooHOhtpA7LfNKTHCGgLew8ZeyH0pR+ltx+WHCaJ0rNgAues6c0vwD5WfiLbHa63fmXXGDCpN+AVxP6juoZ46qYNl7nut2EYwiUMqze9GPdWZmOxWsMX4i9zblSdK4NLjk7ZA3VqK1Fh+KzVmLgOfe7+F0VkZhrahkRkaDwqmRekjFb/cznL7oo0TY5HRcfZbZ6cMVEGji1laMMw+GlpWOa0cIGIujn0t7HysC+cZs2cOWmjPqidlZTBjd1bZMHc4E6dk3pqd1Q1us3WSNgj9u9uyobWzaU+jFW4e6BwNu6vGHEBtgVHintxm4UOH1rQ+11oYsl7aK1s1our2GxuFjvU1F7zSdPbysg/FNLeVbsXdHJEd+y7fioKbRi5M0aq6lpfZeSBbcrFMQrXU+rdZ51fCxxdZa56la+MOIXp/E4aaRzmVJMtuIdQEA3esZxrHHPOzkYvO8PIBVhr6hx+67nDxvXXRg3TW2hcQqzJGXErGcVqDcm6utZV2jc0lY/idU0XBIXT11//UZrf7Fix6tMTDY9lhOP4kXteCf7WSdRVYcwhYFj1WWFxJWVmU+yY12dGOdTSAtc++9lguJY2+lkJ12sss6grWOa4OdyFrTrKvaxr3NcP5XC8the0WNVjLjSZgmKpEfv8HytoZcdVOrCxwkvx3XLjsbmGJXDz83lbpyexwER63jt3XkXOYTjvo2MWz4b+qeppaaiv7ltlieKZpOwuqD/AMSQQfKMVxRsuGnS76VqfrieqlnIjceey8wz65VT2dJhW/sjp3I/PV9TicTDWn5wLal6Cem/rgY1hsQdODdo7rx9yQrq6jxaJz3kWeF6O+k7r0UtFA2aXgDuslZTb1s7PEntI7goHMc1rr9k7EKSOqhcLchYfgPXcNRAxrJAfhHdZNg+KmtA73W3iy/Kkjo6n7V60a9zGyqixykkeaUOuD2XEPqwySmo4al8dFa1zsF6Z1FJHLT6Xt5C589TeWVPjGGVD209yWnstb/F9Y7K169TxSzPpa3pnGZGhjm6XrY3pizQkoMYhbLUkWI5KzT1M5BT/wCJVEkdM4bk7NWlencEq+jMZa8tLbFRNeplzn6s9d/TDm5TVOGU7XVguWC+66NwvqmOupWujmBv4Xll6cs8X4W2CB9Xa1hYuXcmSOa1NjtDC19S1xNvqVzHm0yWix7N2yufVy35V6wyIshG3KtOAGOshEzSN1fILsAb4C1af27NKt7Gl+mUD7qtYQY9TjurfObSX+6jmxQRDSXbrWph+vRbhHZJiVSC4tBFuFFRx6zeypnymZ2o9yrhh8Vm6j2U9qSgEq/YWqpGSR2Lb7LSfqI6HZieEzBsF7g2W8Kudre6xDrvDG4vROj03v8AZcvyVcbPhUtgt6R5O+qnIyV0lTUxUO9yb6Vxv1LhGIdJYs6R0bmaHL2Pz+yYZiNDUSGlvdp+ledXqlybfhcs74qYtIJ+lctbCVJn3RSZh2RXqDqcFxGGmdXltiBu5eiHpNz3OM/hmuxC97D5l46xf4l071CCCWhr+/6rsP0fZ0TYTU0zZqm1iOXKn/lyjL6NjJRPaLozHxieGMkE17tCyGCpHJkXK2UHqUw9uERNlq2XsOXLP5vUhhTW/BVM4/MtvD5DrTLtWUoo3U+oh13dIE52JRMZ8LwtL0OfFFXO2qm/7lfsLzIp8QsGzg3+62a8vZYjkJmxWYk577ByknklfHcE7hWTp6vZW/EHArIGlro7E9lpUXqS2Sqz2LDWVk0L7AlLR1sj3AE7E+FU4nQBx1gKkhibC8X/AOamc9skjLZkNANUQJU7g0AjZUOH1TQwNVRLNq4UsJEm9jJImvfsngACwTWbklOCsp7KtibGPaSTYFDAb3T0JzfRB67Y5lgdzunAXNk1rb/EVKwWF78qP2ZZhELAj4gmOsSQnuNhso3EgXCQsJCObbgJoBPCXXtY90BwablL7D0KWgNvbdEfdIXFwSs4uj2B/CZMdyf1T1GdzdLH6QyBBAPIQhEuiNdsNglbzq7JALkJ5FmWUJJFDXnUNlFwpEx3J/VSRitkqWhEJpeQU5P9UO10CCCW3AKVoungWFk19DGxoZtuop3Fg3U6p6xCWwj9InSkggFUp/8AEUziQLhQaryKvYmiaCRUyPIh3WF5hVYpqCWQOsdN7rL6iQthWvs16gxYTM4HhhWdkP8AU1+Mh7XI5F9SfWslNNKDOQAD3XJfW3WIxCqfD797u8rdPqu6gnZPOA47Erk2oxuabGCJH8vXPZJ6Nx8VBLRnXRnSLcbxJkntaruXUmSPQMNBFFI6mAtbstI5D09PVVUOsA7hdeZc4LAKGN0bQNhwsexM6Gu+UImUUGHU7KIMEYGywPNTpenrqOVrogfhPZbJfTup4tXaywDMnH6akp5BK8cdyo24qPZf4e67/OUoP+nF3qFytpnCaZlMOD2XD+dXTLsMqpAyG1nHgL0VzhxzD8SEsTXAkg91yxmblFJ1RUPfDTl1yTsFTsgpM+mvHOU9MeKm+zjXXURVJHtn5lfaaikq6MlzD8q2tjXpyraSZz3Urhv+VWbE+h5MBp3RviIsD2VGdbT6Oupy6r5ds0p1NhDmyvOjyrPgUb6fE2uHZyz7quhY2R2yxmhwwmtDmj6lPRF+yKnKxrWO2jpP01Y+6nkhY59viC9AvT11GXRQs9zloHK83cjXvpKqKxsNQXe3pprHTGAX7Bb+PF7R89+V5f43I7hy3om1lNFORe4WfwdNNqIx/lD+FheTULpKCBtvpC3RgWDmSBpc1dDj0KS2zw3leQdc97MWo+kI2Ov7A/hX3Culo9gYVkAwdsfDFU0cIjfayv14qRzWRys5R6Za6npSOSl9v2RuFhmPZcRPkc8Uw372W1wdtBChnwhlTvo5HhOnjbMO3k7F1s05heXxp6sP/DWF/C2N0nhn4JjG6bK6P6cbGS8R/vZTUdIYnabcFRKhxZCsuVvRdKcfBsFVQa7WKhpGWAF1WxtAaLKaMWindNb0IGkncJ4AHARccXQp4MrCs+YJ6Yz5k9WIACEIUsfgAhCE4AQhCABCEIAEIQgAQhCABCEIAEIQgAQma3eUa3eUAPSP4/dDSSN0P4/dADALmydoPkJGfME9ADdB8hOGwshCACwPIQhCBH2hjmncpE9/ylMQJ6ghCFGOHs4/dKmA2PKcHA8FAA/5SmO4P6KQgHYpjmc2G36p8fgqeiJNe4EWCe5tuFCXC9r73Sj1poC7ayYdjZShg03smODR23TW9mdetSEBsbpwIf8ACmHbkJrJB7oAPdV5D6Ftjn0t91TVFM3TuOVcJjYC3hRug1stblVpx2aEYpLZYJqMe7uE92HtkaPh/pXKaiAdctTHuihZd3ZR6afZbhkei0Yt1JgMUsBGkceFqLr/AKAirnPHsg3+y3jiM8dTeJtirDW9NiseS6IFQzips6bieVljr6cuY1kTTV8p10rTf/SoKD00Ye14k/BM/wBq6Zq+iI2uv7A/hSUnSMQFvYH8JFipnWx8ncK+maN6YyhgwOZr2UzRY/lWyunMHbAxrdA2+yyeq6WY02bDZSUPTsjT8Eac8VRMvN553rTYyjpY2tAICZisTIoHOtwFdmYPOwbtKsfWhmo6J7vDVlZdXqZGPf8AmvSNVZsdTR4dRyWfazT3XCHqnzemoY6gMnIsSBuuos/Op5o4pY/cI+Erz39VeLT1InAkO5PdcrmPR9AeC8dG31OX8586q+sxWaIVLvmP1LWkuOVWNzXe8m/3Tsx8Irp8WknGqxceyi6Rw6QStEoXL5EU03/T6a4Xh4uuKL9gXTD5nCRw7+Fkn+FtpILcWCfhZjpoAABwqTGsXcGFrHLHsUvfZ3GLxf4kU1a4CMgFWiGgqK6p0tbfdTQVE1ZJp3N1nOXvRMmI1LXOhvf7K1jfRmc1RUy2dJ9F11RK1ojJufC270VkvWYrG0Opb3P5Vn2U+SP4+WJzqPkD6V0xlrkRT0sEZkoh97hdHQ9RR4v5HzChJrZzBTemZ7YfddRDj8qxnrTLh/R8Tp2RadI7Bd/4tljRUeGkilaDbwuX/U3gUNJSTtYwC1+FcU2uzgHkPKfXZzLSZy1nTFf7YqHNDXdnLpH01ep6eprYYZa91iR9S4Tzcr34Vistn2s48KuyQzeqcGxeO1YR8Q7rQw8ht9mZnccrIvo97Mgc1KbG8Pg11NyWjly3903jDahjdD+fBXlZ6S/UhLIymidiN7gbFy71yXzQGMsgLqnVqtvddRiZG1o8n8j4yNactHRtFM/SCCr9h9UTGLnssbwCoZX0jXtN9tlfae7GW48Lars2eOcjFwnouTHh5tdTe2LXsP4VugmLXjfurlE7U291bhLoyWvZjGN0nYqTVvZNDTq/dK8hvfhTJbG1pqQ5Ca1/5incp2kWQQhCa1oB7PlCVIz5Uqja0Rgkfx+6W4PBSP4/dI+gGIQhInsAQhCkTI30OZxZKSALlIwEXuEr+P3Sir6McdyVFK7VbZS8qKcBo2TloeQu5P6p0YuAAog4l9ie6qadoIuQpfiHr4TRNsLEIc0jf7pWcJJnEDZQN/0jbI5Tz+ip5ACd0+WW17lQPmudiopS6InISSJLHFpASB4J8oEttrhU7Z/widm2PcAGmwVNO8tOyklna0XLrK0YzjMNNGXCUX/VZ91iiQzmkXH8UI23c/hRnGKZr9JmC1t1hmhDhELyaoC33WqOp/UxDhcznnEANP8AqVF5GmQO5pdHUhxOjABMzf5UGJYvSRUrpXTDZvlca4p616aCQRDFW/7lHV+s+CqoHsGKDcfmTrsqX49Ec8mWjYPqRzYgwKmmMNVazTw5ed/qR9SVXPUzU7K1x+Ii2pZ56l/UqMVpZwzEL6mnhy4WzK66qOoMbeBUFwLt91z+RbspufZdMY6greuK8sLi7W7utwenrISbFauGWSlvdw3IWvvT90PJj+JQl0Jdd1+F6H+mPJZsMNM99CN7fSqCk3IlrfZsX0wZKNwOCB/4YCwH0rrvpOhGH0TI2tAs0LEsueiosKo2D2ALAdln9LGyJgFuAtXG3vs2MaPe2VLtL4CSOytVRKRIQ0d1d2BhiJ7KjmpY5nHQN/K6TBh7TSZqQS+lJFMfKmbOWjlJJSOh3soHOOqwK3Z1fjEmVrKmQt2Kjme9x47qSliJFynSsZpPkKjbe4FC6Q2CuEEZDzbZYnmZ1ZR0uDyEyC4ae6bmB1nSdN0snuThpDTyVyznz6k6ajgmp24gO42csy7MlJaM22x60aP9Z2ajqOWqbBORu7grg/qLMDFMc6kdD7jnB0luVvD1B5gu6yq5gyo1aye61hl9lLVY3jzKg0xdeQb2WdNfkZnTbRu30vZcO6jnglnhuSRyF6CZJ5GwUdFDL+GaLNG+laG9JOUE+HGmLqSw+Hsu+ugunqahwWFvsgO0DsrWHh7lobWvaRF0t0zDhNKxoaBpHhXuSSOKO7rCyfMz2Y7Nbwsd6jxKalhcQ8iwXQ0Y/oLZuK0jGs3MZhbhsrGv7HuuIPUFO+rrZmtP1FdKZs9YyCKWJ03lcwZlVIxGukeXXuVFkz9YmNkSezWHT2FyDF2vIvdy6hyKpxFBHfwFofAcOjZiDC5n1XXQOVBbBTx6fC5PMy2m9so9exuETaaRo+ytck1qi5PdT0k5mga2/bsoaqmdq1NasWWWm/poY79TLukK1jmtGpZa2cFgbfstbdOVr6N41utZZPDjwdYh6b/kbL/5kkVONFxJsVaYZHxSaiVXT1ragfE66tldOyIar2V7EvbmirZciulxbQ0guVDX42z2iC/ssexXqERXGsC3a6xnGusTED/nr0vgH7yRkZF3/S6dRYkyV7vi7rB+pXMka4gqPEOsBKSDN3VixTqBsjT/AJgXtnC0bgjnMq3ZZMbaA8kLGsSlEW11c8Zxhtz8SxTGcVDjs4Bdzj0LSMK60jxGs+FxuscxOsJvuqnEMVaIyC5Y7ieJNAJMi01FqOim5dlr6grRpIusC6kr2tDzqV56qxvQHAP/ALWvOoceDtbdf9qvZVtEcptLZbepcScA4td28rWnVNZJPqF1leO4qJGuGvssIx+pa3VZy5zkMROL6I1Z2YtPG6Os1f6lsHLzqT/DyxrpCLW7rXtbWRiS9+6Si6q/AvBbJbfyvJfIcPSb0auLZ2dMYZ1S3E6YRB97jyibpl2JvD9F7rV2WnWZq5msMt+O66Ay/hixZrAWg3C8V56hVwbOlwrP2RRdE9JSYfVMlEZ2PYLpLJzrGfA/biEhFrd1gOG9KRQxtd7QCyHAaV9NVtaw237LzqN3/wBujtOPs+HYeU3Xk2JiJplJuPK6F6ElM0DHX5suSfT9HNJLBcnkXXXOXtK9tFG4jsF2fDpTaOwx9eqMvIaYwPssUzA6cixigki0g3B7LKZnFjRZUdUz3o9LhyuzlVuohyn7dHHGe3p8jxMTztpAbgn5Vwl6i8qZulKuSWOn06SeAvY7q3pahxCgl92naToPIXCHrTyypXQ1EkdKO/ZYeSnGWmYNzaemcBdM5mVXTGLMhdKW2d5+67T9IedsuIy00bqp1i4bFy4NzP6ZqsMxx5hjLdL+w+6296U+vpcAxCCCaoLSHDkptUtMdjzbZ7VZO4zFjGDMl9y50jus50Nv8PK5L9O2eUcOGwxPrRYtH1LpXo7rKkx2JrmTAkt8rfw5xktM26bFrTLjX3iO6tFa90j9lkGIQslZcdwrTJS2kuR3W1BpRNKtLQ6gic9oJ8BXmmjLYSPsrdSOYwgX3V1ie18Xw+N1Xts30SzjpFlxmpfFJa+11HBE2sjDXBPxuIyScJ2D0z2tBI/lZ0oKxlO2KMd666HpsXw2WP22kuaey4W9YWSEft1D/wAONwey9FK6IOaWvG1lzZ6remYqyllHsg3aey5/k6PVGVk9M8Zs3ssDhmLySthtZ54Ct2X3U83S1c0CUt0u8rof1JdEtppZ5WwAfEey5J62xJ+C4hIGEtIPZcPlScJGbOel0dS9KepeqwqlZGK9wsB9Symh9WNXLIGuxBxuPzrhH/7R61jtDKp23gq+dOdd10soLqp38qbFvkkQfnaPQ3or1LyzyMDq52/+pbyywz4iqyz3Kw7kcuXmL0zmXU0JY78Wdj5Wz+h/URNhT23xC1iO614Zj6SJa8hs9ecs81cOqGM1VI3A+pbUwXqaixJjTFMDf7ryoy09Xr4Hxx/4r4+pdN5O+qeOvbCH4iDe31Lbxczv6aVN52g9rJo+b3VDUYe4v1BYxlzmJT9S0bZm1AdceVm1NUQ1A0k32W9XYpo0q5qWi3QySQEAnhVlNU+4QHJtdCxo1bKCknAfZW4yJ4yReYh8N01+x28qBlSXAAFVDWlzdRViMhGIla26NDk5gI5Q5f8ARkY9i8JzXACxTU12q+10zb2WYxWhS7TymOI3Ke8EjYKNw+HZPHpbGuNzskQhCHoe1w2CkZwoRyFNHuE72Q1pEgcHcJrvmKcwEXuE13JTivIaXgGyUG4umOab8J4HYJH8GR+jo+6STcpxAaCQmOJIJuiPwnX0QuDeUwG4ugku5KOFKSpDXMJN08Ak2CROYDe6BX8HAWFk1zuyco5LgkhMX3sryDcnlNqSHMskEhB3TZZL7EpYi17ZC6M2O6pXNtIq+zSy4VFUf+KFDd2SpuLErHXhsFrvNY68KnYTy0rY1Wwexe3K15mozVhcoYN9BWRkfNG9xckrEzz69VuF6p5zfm65ExamdS4sX34eu0PU7htVJPMTGTyuRercLlZXuPtH5lh5CPQ8DuKNiZF9UijrYWOd3HJXZ+UnV8FTRxR6xwFwDlzPLQ1rDuLOC6jye60FMImvnta3dZdi2bXpJxOncYxanhwx0pcPl5uuVfUtmwzCBM2Oota/BW2usMwoh0+4xVQvo8/ZcKerXMh4lqB+K7nusm+xqejpOC49qSkWTFM4v8VxkxOqCQXW5W1cqsEw7qiBj5WtdfyFwpDmUYsdLnVJ2f5XVfpdzdpZHQwyVI4HdEGmemU5NmLDSZuPq3I+hqaR0sVK3ccaVzjnVk/PRPkENNawPDV3V05Ph/UGGMfdrg5ixDMzJ+ixylkkZStJLTwE9wT+F3jvIp1XetjPKnMPoiuopnF0RsCeyxGiwp0NTZzOD3C7Nz1yQZQGV/4W1iey5sxzpT8BipZ7drOUtNfZu5vOqzGa2XrKeme2siDB9QXdHpchlEkAI8LkfJjpb8VWxWi+oLvH0z9FFnsO9g7ALdxqk9Hhnk+U7XJ7O0ciaEOoYHOF/hC3zgVCxtM0hq1LkvhTqehhbot8IW58Kpnx0zTZdJjQ0jwbmspym1sJ6VrWk2H8Klgp2iffhVtY86SAqSAv9z91r01prbOZd0pIqPYBeLK4QQxtaNlRbjgKVksjRcusppUxKtu29la+mjkYRZUUtE1jiQ1VME5d8IPZOc2/P8qnOslreuynhYWlTtfY2QWC2wTXANFyq8oNLZHZNuY8kk3T2m4UAkJGxUgPgqCMnsUkBsVINxdRjjdPYfhVyuWwFQhCsR+ACEITgBCEIAEIQgAQhCABCEIAEIQgAQhCAE0DyUaB5KVCam9gIAALBBAIsUqE4BAwA3SoQgBus+AnDcXUakbwP0TZACEITPZ7ACLiyY4WNk9Mf8xUi+AIhCEaRG5NILgclFweCmv5/ZEfdGkM2yVpuOUp3FkxvI/VPS60PUmxpY2x/RUr4i2TYbXVYozDc3ugem0RMBPwlBispvb0jZImNMjlD2eylmaQP0UDARIDbuq6WPVuohB8d7DlMcUx0IKIoBeLqdrSGgAJGtDRaylG4uo/X/pK5NlNUtu0/orLixe1pAV/lj1A7BW3EKL3QTZMcNsXaMYY2Qz335V3w6mbI0B43SxYVpku4K40tIGkEeEx1r+E0LnCPRTVWFxOZcN4VvkpjE6waVkZjBbpKhfhrHbuAUqRJVmP4zH3UvuD4gqzDqKEC5CqaujDeAooGujNgU5paLjt94dMSsijibdoH7LX+ZcpNDK1g7LPq1pcxYb1rh/4qmkFr3asfOgtF3jbFG9bONM/6eeT3bDsVw16hMDkqzLrb3PZekGdPRbqiOV3t9j2XEfqM6T/AArZzo4J7Ljc6rez6T8GzVV66Zwf1x04xtVI0xd/CxaGiZQTbABbMzPkho62VjrXBWsMSr2vqLNPdcffCbs0fUvjucp1rbLnJiYjg2PZWOrxKSoqNA8qrZDNUR/CCdlLhnTFTUVQJj7qo6G2dhdyUK6/pVdL4Y+eVri0/N4XRWQ3SMVbPGJI+w7LVvRvSkkbmao+4vsugsnIIcKkjc6w4ViqnTOU5Lkvz1tRZ0llH0XRUjYXe0OB2W9+naCip6NrrAWC0V0F1bS00Uf+aNgsyrs1qbDaAn8QBZvlbFDjCPZ4X5Bg52ZktJdGSZkdU0mGUT2hwFh5XGPqW6wgrW1DdY3J7rNc5/UHCIpI21Xn6lyZmvm4ManljbPe5I5Vh2LWzV4PgJQqSkjT+ceGQ4jLNODvutO0OMVGBYx/lvIAd5W3+qHyYlE86r3Hlal6owV1NVumt3S02JSNfN4iMaukdQ+l3OeqoaymY6ptuOSvUX0f5lnGoaYvqB27rxGyYx+agxiBjXEWeF6hehPrGeRlI0yHkd10OHc2eG+YcfOEZaR665V1cVZh7DqBu0LNqynbFEHt8LTeQuOSVGGxkvv8IW4o5TUQgE9l0uNOUkj5y5jHsjcylppi+e1u6vUUjGMGo9lbYqMRv1/dSzTOaAAVsVJtGHGqZWvqA3cJnue4dV1SRTGQAFTN4CtqLiiSFLjLbKpuknc/2pGhhHzKg91w4To5n3sSl9doZZtMrDYd0jnaeyijlLtiU5NcdC19/R7ZDfYJxebbprRYWTZNjf7KGX0SXzoka4BBcSoRIBxdPY8ORFN/SKM9vQajqtfunJQy+4H7od8yelHY6x6+ChoIvZKGAG6QPsLWSk6mmyNaG72DnFvCQHXsU1IJBfZA9Loc8aePChlu8WspdWre6CAeQl+ClK2Aat1URMDdgUskekX2ULptHCe3tA29FU0ADYpkhve6pzWhu5P9KRs4lbsFHLUURspqs2791BEQ43JUuIAtaXX/AEVJSF5PP9rMvs0QSbRNKdG9/wCVDPOYoy8lTSsu3fdWLrDGYcLw573OsQ3ys621pdsqWtw7Lf1F1vDhwIfI0WHlat68zppaOJ//ABLdv9S17nrnfDg0kzW1NrA/UuSs2vVN7RkYK48n6lk33y+GbbbI3fnH6gYmwTaKxvf6lynm16i6uMy+1W9jw5azzC9R0uKOkjbWON/Dlp3q3r+oxhzgHuOr7rMnkNS+lGd80Zzi/qLxaSvI/HG2r8yraT1DYr+G0mtP+5c/1zqt8/u2duVVRVtRDTfHq4TJ5EpIgnfNs2Z1pmnW47E5r6gm/wDqWFYRRuxTGAXb3Kx9+LvfdhJ5WX5YwGsxWNx8hQb932Orssb7OvfR1l3DPWUzzFe5HZem+QWXlPS4TBOYbWA7LhX0XYMxklK8jx2XpPlDEyPAIg0D5RwFbopi2a+MnLRl2HUraaLQ1trBTslc6QMspIrb7dlGywl45WzXjxijcq0kXCFgMWknskbTNh+IG6SKQhoNkPqC0WIWni//AFz2W1N6GPa2V1iFHJQxNOq6HyXN2hRyGV4K1p3OUSKdjSKiDQNlQYxiMVDA+XULj7qGvxT/AA6nMkhtstQ5p5z0uDwTNfUWsD3WNlz66KNtq10a89WuazcJpKh7KkNIafqXm7ndntWYhissDau/xG1nLenq/wA5v8WbUthqjYg/UuEeqsVq8Wx5zmkm7vP3XPWWyctGfORsTpE1PVuJMbIS7U5dcenTIaKthgq30hJNjfSudvS/0VPieI07pIju4chem/poy0hp8Hp3viHA7K/iRc/pWcdmRZMZbjBIo9NPa1vpW+cEpvZpWM8NVv6dwOmoYtLYxf8ARX6nh020jsuowqVFbZYor72Q1tO0QOefC1dmfj7sPgka3wVtTFLtpXgeFojO/EBTwSEutsVqNLQ+2pSNCZqdYSzTSgu+orTuM14q6p1zyVkOafU8TaqUB/c91riHHRPXc7XXO8jL1izAzK1FMzDp7CffnbJb9Nlt7oJzqRrGDwOy1X0jWNeWkDlbU6QmbZpsvOuRyX7M5qy5wl0bUwCUyRNJ32VbWFtrhY/hOLCCFoHhTS4+HOt/a5uWVP26LuPfJ/S4PqzEbg23VTRYq4uALlZZK3327f8ANS0j3A3stXDlKxdsnsyPWJl1LWNcN3dlSY7WwxwOcXD+VaHYo6lZubLFururtEbwJD/K7HisJ2SRlX5k4sperOoWwPe4SD+VgOP9WOkkLGvVB1f1gXyPb7nfysMq8fdPMSXHdeweP8Y010ZN2bKX9MgreoJb3D+SqOXHnSt0ucrQ6v8AcbyqKsrDFcA9l7NxGG4wWkZV1+0V+K1gc0nV2WI47ivtus0qbFMcc1hGrssRxnGNTzcrsqMeSXwy7JtsqKrFdQJc7+1YMZxYNY7f+1RYljejV8SxnHOofgcC/stB0dFaUmWvrbHxGHFrlrbG+oSZHAv/ALVy62x8uLgX7XWvcTxYySOse6RY6a+FeUpFwr8Wa+41KyYnaoBLnKjnxB/uWuVFUVx0DdY3IY8UhIy2yzdQU4ha57TwsVnq5jLa/dZZjN5ojq7rHn4aHyauN15Z5FjQUGzTok0ZflZiFRDWsBcbEhde5GPbLHE9xuS0LkPLunEdYwW4IXV2RU74WRX4sF83eXTdfskbmJdJTR0Nh9JHLSNcR2VbhNFCa4XAO6teGVuqjZbwq3DKw/jBvbfyvGZ5Xrd0dpg5LSR0j6f44o5Yf2XW3Qmj/DYyPC43yIxEslhF/C66y7rDLhsZvyF6B45ke0kdlg5Ep62ZXUvCpJ3ENu0KWUmU7IEHwjUvSoy9oGrNRmihq6d1VSva7u1cz+qLLk4vRzERk3B7LqZ7GiO328LB8xei4sepHjQDcHss7Kpi1sycqpfTx8z9ydkoa+aYUx2cey1Jg9Z/3OxMSl+gsdex2Xo36kckY2QVMppm9+y86/UR0rW9P4vMYQQA48Ln52OEyhStSOhshvUNJ78VKawWBA+Zd8em3NEYrFCTUB12j6l4lZc5lVWCY1HEZnCzx3Xoj6Ms6GzspWy1BOw5KsUZk4mrW/Vnprh1X+Oo2SbbhTMoRLcuWFZa9bUuJYTD8d7gd1mTMSjLCWLcx8xzXbNOq1aD8FE1+xCkMop27KljmkfJc3S1T3Bl1pRkpomdoPa2oku7sFVU0bImbK1R1bmv0gKtgqXOG/dDUV2QSbYYnLojc4dhdaD9Q84mpZCezSt74nc07yRy1c9eouuZT0cpcbfCeVzPLyk2ZmW+zgf1Me2/8Q231FcJZ1UmiumezyV2n6leooDLUN1jk91xXmvVtrayUMN9yuBzU97Mi19GsIWyOnsVlPS0by4bKzU9B/naiFfMMkbRWOlZ9Vsoy0UpvRkU9TLSw6mHsrJWdcYhQSnRIRY77q5PqBU0/wCoWNYxhplmOlp3K16rG0EJGW9MZy4pR1TLVJ/ldPenvPete+nbLV23HLlxhh+BPbKH6Tsts5X4jLhL4tMhFvurkcl1/C5XNpnrz6Zc6XT0cMTqkEGw+ZdZdFdSU+I0zZfcFyB3Xkv6cs6mYKyKKapI3H1LtHJrP6KtEUf4vYgfUtnEzbXo1se6XR1rNapADTymMw8sNwVYehuqYMbpY5A+5I8rLYy3RcrqsOz8i2zSrk5dlDKHQ/squjqdTACoqpzXHhMieGbj9lrRS0W4pP6XEPa4XBSqjjqC4bnuqmF+oWP7KGW0x7gktoehLockd8PKbpiJiOcW8Jid7n2TSbm6cm9aHPaELATcpDGOxTjuLJ7Wi1ypF8I3JojZH8QuVOxgAuk0WFxZMMpbe3b7p6QJtkyje7c2Uf4goYSSD90r3/BHFtEgNxeyVgBKROZxZInvoYo6HEXFkx7QNk9Mk2N/snLokWyJNLnDsnuIJvdNLgNlKiVSWxRci9kocRwURuFrnumTVDGjhNb0G9ska+/KcY2uF7jhULq8MNh/acyvBAubKtOzsV1NlWYGHuFDLC1IK5tt1S1eKMZ+qid2hYVzRUGzG2uqKoI16uVC7GWuNt901te154UM7d/CxGr/AKPqJ3GLSsNzAo/ew6U2udJ2WWzzDTqA82WPdQ/8XE+IjkFV2to08T9ZnGXqC6XfXyy/5R79ly/1dlnLJVOc2En4vyr0FzPy8GIucRGDf7LUmLZIiSRzn0w3d+VZ19S7O34y7ZxzQ9E1WHVOoRkWPhZpgeNzYDCJHOI0jutydRZKtptcjaYbDsFo/Oumk6TpJSBbS0rEvi09He4NUbUtkHXHqANFQPp31I4I5XIXqJzRjx2aY/iBuTwVBm/m9PFUzQCYj4iOVoXqzq2qxqpe0TE3PlYWRD2kd3xWJLaUfhQYhjrmYi6Vkv1eVtfI3NeowOuitUWAI7rSEuFVUzvcud1csBrZ8GqA/WRa3dV/2i+ju6eKdlfaPVL05Z+QYpSwU1TVjdo5cuiIupsIrcK1mVhu3yvJvJnO+XBJYmisLdNvqXSfTnqr9rC2xPrjfTb5lYpnJMwuQ4pRltfw2R6kqzCZKeYRhtzdcZdXUwrMdcIWXu88LZmZedcvUZe1tRqB25WF9I4dJ1BjUbiy933WtiQT+mPl5Eq6tM2x6Zcvn4hWQufEfmHZehuQWWbaWmhcIuw7LnT0oZXlxp5PZG5HZd+ZS9FNoqGMGMfKOy6PHrXWjynyHNik9szroDBG4dSxkNtYBZ9Q1AEAbbhWHC6H8PA0AcBXSmlDdluUw1E8Y5K2NljZNUnUT90lJF8f7qZkesXUrYdG9uFoVdROZsscZdEggZo13HCpJXuDtI8qodIQ3SSmmME3PdSrY+qxzfZFTzOa4FV8MhkaAfCpmwAWICqKcho0qGa0y+0vXolMYGwUcsWpvKmYbndNcNiFVsjroga72U+jRsnM5snlhAugN1cKCNYo8G4uns4/dMaDsE8CwspYpoBUIQp4tgCEITwBCEIAEIQgAQhCABCEIAEIQgAQhCABCEJEtACEISgCEIQBGpG8D9FGpG8D9E2QAhCEzXYAmP8AmKemP+Yp8fgCIQhOIZfBr2knYJWAi9wlQgaA5CkuPKjQDY3QPiSJNTb2uk9w9wmk90Eo9zmgHfso9bUjn8gWTHOtxZDQ71JAWu2StAuNhyo2u7gp8brmxKb6oRrRJpb4TNRHdPc4jhQudqFrJrQ1vQ/USOUyRoNrhAcQLBBcXcpvqJ7MiMAO5aAhvwWACJHnt5SNJIuQkcP+EU7B3uW5snx1TSLX7KCQcn7KAuc12xTX+vQ2ux+3ZUVYa69lRFul26qfcP1IZTe8b2THLo042OMChqgS21la8Vww1NO74e26yGooidgo5aL/ACDcKjdH3JMbI9Ldo0Vmn0gyWjkd7Q+U9lwd6senRTR1ForWJtsvSzMXC2SUUg0/SVwt6tukX1EFSWRk7nssHLxtntHh3MOPrtnk/nhTVTManDWm2orWUVBUVFc1oadyugc+ejaqLGpwYD857LXGCdL2xNvux/UOQuXuwt2fD6f8c5tKmL2XboPLWfFo2f8ADk3t2W0+nMgZ3Rtm/AE7flWa5A9DUNaIWvjG4F11X0hkpQVWFskZSjdo30qD/CX/AA0OW8mVMfpx6crJMHi9w0hFvsqN3Uw6cl069On7rq3NbKAYbhMk0VMdmHsuHc83YjguIysYHCzionj+v8MXj+feRb6tm1Om8+I6c+26sAt/qVT1Vnq+ooXNjruW/mXHTsw8Voq5zTM4AOV4hzLqqxgjfMTtY7qGUXFnd42FRlQUmZlmfmPXYg+TTUuPPdahq8Sr62ucXvJBd3KyerrW4l8Tje/3VPFgtK0+64BRSsaRsVYNVFfRaZ45WwXf4Wv+unsa5wstq4s2ljpCGkfKtTdetL536L8p+PJuRlZ0Iuti5Wy6schAP/mBem3oSbJ7dI4E8tXmZlBhNVL1BCQw29wdl6n+gTA3ujpA9h3LV0WHPTPDvMoQ9Wemnp7klZh0Yd+ULelDUBsLTfstP5L4S2mwuItHLQtqhxigH6Lr8KXSbPl7yBReU0i5srGu21KGrnN9irfS1JdLa/dV80LnM1fZdDQ46ObSSfQ6lmA5PCnFSCRYq3kmP+EMqDq/fyrUpJRJPx+/ZeI9Dhv3CSQe0NVlHRSB4Bv/AGpqoamEBJFoz7o6ZG2qbqtf9VUxzsk2BVrdFIHk227qoptTTz/SWST+DYJNFyDgeEyS5vZLEb7nwle3uq80RWvUeiGxHIUkem+yRwuEkfdEf4U9uMif3A1tr7qJ8wB+ZNkcR/CgfI66c1oe5tlUyUOPzJ4cbbHZUkTztwqqH4gLpo6P0XsopCQbBVGgWsoZYxfY90fGTobHJbYlSax4Kp5Lt2BUfvnyl2P6KqWbU2wKp3gm901sxcbBTxMDxcpPb+CepSPjcTbwpIZdAsSpKpjYwSFbnTu12PlVLbCKaK2cCaw7KAMbCC69vupIZWlm5CpMcxKCjpHyOeNm+Vk3WprZBL/XZRY11LS0EJL5QCPutK53Zt01JQTRtrALN8qHN/NOLDGShtQAGk91x3nz6hLyVEH40dx8yx7rWZ1zbME9UGckr6mcMrj37rijNLM+tqKh/wDxbiLnutjZ2ZkOxipkLZr3+65/6s9yvkc4eeyyci4y7SiHVVTXVRDpybnfdXvB4BVytMhvusUw7C3sqNTh3WZ4JGI2t24WTbfplKWy6VWBUfstJAVsxejpYKU2twrpWVB9sC4Vix98jqZxaOyRX+3Q31RjNVURx1BAd3WwsnqyP/FI/iHIWocXqpoJ3E35WZ5P465uKxhzu4VqmSbJK1pnqJ6NZBIaQDuBsvRzKGE/4BE4jloXmR6GsbbUT0YLh2Xp5lG/V09ER+ULexYqTRs4rXSMyha0E6jsoHVUEcmkkJ85dHG7T4VgqpZ3VNmrZUUjVjNR6MmpqiGQWuFLMGO7KzYY6UAX/tV76kDk/wAlSKUY/CSVyS0TNEYKbI+NpO6h/FstckKnrsRghhc90g48qR3JRK0rl6mKZrdQ0+GYW9wlAIae64P9Tucn4OWojjrrWcfqXSvqazEiw3CpmsmHB4cvL31VZr1c2JVDI5jYvPBWVkXeyM6duzDc280Z8er5acVRdqJHKx7oLoCo6ixNk3sF2pw7LEsAfV9S42HPubyLrv0zZRjEDC91Pfj6VmqO5DI7kbJ9LOTD6Samk/BntvZehOSnShw7B4WuhtZoWrMg8ooKGCB/4e1mj6V0l0zg7MOomxMZa32XQcfTst1VKf0rIKJrBfSp2AXsOb7Knraw0x0gJKGqMpDj+ZdLCHrFaLkalH4S4pEDSPv+Vc1+pKpNPTTEOtsV0vihAonn/SuX/U+S6lmA8H/kp4LaIr46RxFmpj0hxKRmv6isXwCpdPVguceVWZsSPZicjj+dY50virW14aT38rl+Yeos5bkXo3Z0WGgMLj/K2t0xNFHG0l1tlprpXEmiNjgRdbDwHFpfaFj2XlPJ2S92cdkz1I2ZT4hH7Ys/tsp6V7amQWesKp8ZmAAJKvWDY41jgXHv5WVVW5sWjIcVozjDsOL2A8qqlgbTMLieFTdNY9SStAe8ceU3qjHqSKNwZI3jyup4zHe0mLdlPRZ+peo4qSMj3eAtV9a9cRkvAn8qtzC6nIY/RJwPK0t1b1NO6V3xnletePca7JJ6MPKy9fS5471KKiVxEv8AatAxMOIPurGZcec6Qh7+6acdjZw8L3PguLUIraMiWU9mYxYk1ovrVHiWLt0ka+3lY07qZrW2191b6/qQOB+Pt5XpeBixgiJ3eyK3HMaY1pBf+u6w3GOoWNcTr/tN6h6gaGOIf2WB9QdR6bjX5XSU0xaI22y6Yx1NF8QEixPG+oi/UBJ28q0Yr1C8vP8Amc/dWGvxd8l/i5ROC+DGmU3VOLGYu+Lz3WJzyOkcXA91dMYlMt9+VaTtyljFepBKLIZh55VLLr/ZVU7m33Ko6qpY0LE5OK0EIvZS18zWRnUeFZnVsbZSL/UqjHK4CJ1isSqcVe2awJ5Xk3kfUGaFMXs2zly5k1awA9wus8mMOvSxOaOWhcaZRYi+TEY7nuAu3/T2xlZSwtd+UBfLnm8/WMjUp2tG1sLpXsohcdkU9X7FZzwVkEmFx0+HBzQPlWHYi+WLEdIPdfPduVL/ACWdFhXPaOhMjcWBmhs8chdiZW1vuYZHv2XDGQ1VMamEOvyF21k8S7ConH8oXpfi97conb8da5JGyaYgi5Ury3SbBQ0m7R9gnSHST+q9ex9+iOnjtrRDVayLC6pnQGVmh7b7bq5RxiRlyE0xtBvsnXV7RFZT7Ps0ln70B/ieFTyR0wN2ngLzT9XeUdQ2eqkFGbi+9l6/dYYRFiWGyRSNvdvhcfep/JKmxZlRIynvdp4auVza3XJlCVHpM8bcc6brsD6g1+05tn+F0l6YM1HdOS07JarTa3JSZ7ZEvwutknZSEWJ30rSU+N13RleGMcW6SstXOL7F3o9gPTzn9R19FTw/jwTYC11050d1NDjNM2Rs4Nx2K8ZPTL6ia2nrYIpavhw2Ll6OenXO+DE6CJktS0kgfUtCjKaaHLI0dUQyRABwclnLJGqx4Z1PQVFK2UTtsWjkqsbj9CWX99v8rfozItaTLMcmLX0qI6WPVc/2q+CGJjQrVDjVE87SN/lVjMRgePgeD+6uxyYslhfF97H4uGClfb8q5Q9XWMnD8OndrtZpXUON1mmjkN/pXHHrQrZ5cNqGx3+RyxOVsU/hmchcm+jzc9SnXx/xOeETb6yOVzpilScXq3km9ytl+o2LEH47MSHW90rV+CwPbUn3Qee64rNimY07BrsEMbPc09lQVErKeTS42ssqxJ8cVJ+y1/1XXuikPtngrF/1kVpS2ZHR4rCY9OsIfJFI7VsVgVLj9WH6bnnysgwmvnqIxqJ3Vqub0LX9L86uhphfZV2E9ZCle3RJ38rFMSFZJszUqako8RDw4h38J/5JbLcG9m/Mvc1JqaoY1tURYjuusfT/AJzyiaLXWHgclef/AEnTYmJmvaHWuFvvKTqTEsNlj1FwsAugwJNxRqUy/U9b8hM44JqWBslYOB3XQXT/AFhTYpC3RMDf7rzEyPzcraYQMdOe3ddj5FZjSYt7LZJibkclddhTa6NKl6OkTCZmB7d/0UToHt2cFNgVSyooWv5u0KoliDt1v1SejTg00UDQ5pAAKrKU7bn+VFNEGm4SRS6DYlTemyXfWivc8W2Kikkvcakz8QC29+VG+Q6iRZOVS0NS0Pa6x3Keo09vG6hcexZtaHtaCAU9gHBTGEAcpwNjsnxiV3JbHmwb+yhkB7DspQ8O+EpHtA2+yeSQKex8FSRtItsnaB5KXYDlISAjVp5ckLhblRvkuf8A9CbrXYiimyUPudnIcS4bpkZuVKGAi90nsxr+kDmu7bKGUSB1wTyqtD2MLL33R76EXZDC8e18fKpauaMOIuCosQqnwPLWK21Vc47kqGdpfoocuyaoqo2i5cFQ1HUEFNcOlH8q14vi/sscbrXfW/XzcNY9xmAt91RsvRu43GTtS0jZ8nXFDE0h1SP5VlxDMGic8gVI/lc5dS59x0czmurB/uVg/wDvAQTzWFa3n86pzydF2XDzivh1XQdV09TKLTj+VkWH1cU7QQ+65o6CzZhxGVgbUtJJts5bv6Lxk18DXh236pkMjbKNuDOtGctibLGfCoa7DWOaXNCqqaZ7mAJzyXGxHdXIS9kUYuUJGG430+2pcdUQP7LG8S6Tp2tuYBytnVVDHI25Cx/HKFoaQAnWVJxNvAzXFpI051d0vA6GRogHHhcf+rbot8lJMIoT8p4XcvVFGbSALnbP3oo4zDK0Qk3aeyw8qlb6PTeGy9xXszx09QPRGJwYpK6KJ/znstSU/TWItmcZYXc+F6L5v+nQ4nUySuoibkn5Vonqv0+Ow2SQtpCLf6Vz+RU9nrnA5dCScmc5DDHQ0/xxbgLGselkhedIIt9luzqvLaqotUbYHDbwte4zl1X1EpDYX/rZVPxS2ei4/IY34vphOA9UV9FVjS9wF+xWy+l+rsYrmsY2V534urNhOTtfNO0mmd/tW4sqcia+oezVSuI1flUlVT32c1yvIY+nph0l03jGPyNDo3uuF0HkRkhXS1sEklC43I+lZfkV6cHzvjMtCd7fSuvMn/T1TUDYXmjtYD6VtYtfaPMeY5OHo9MuPpsyzdhdPAX0trW7LrbojCGwUzWhnAFlg3QHQsGEQMa2K1rdls7BHMpWBq6GiPqeKeQci7G1svBjbHCAPCii1GTbynh5mCmpqY31fdbNcdo89yLdlZRizBfxypHOBFgkiGlo/hAaT2VyPwxbJNsaWFxFgpo4b727JGjt9lLEdrfZOkybHF9sabAJpAj3T3HSLqOSQONgEz6jRW9D45CTs7+lJp+I3GyhgG91UAgqGa6Gv6Mc2x42SWA4Ckdwf0Uaj9UIPa0bFKhvA/RCVLQAhCE9IAQhCcAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEAI/5SmKRFh4CRvQEaE57QBsE1MHp7BOj7pqdH3QD+Dkx/zFPSFoJuQnR+DBiE57QBsE1OIZfAQhK0AmxQJH6IhOc0AXATSglj8BMJJQZSNiUnKelomj0B4KjJJ5Kkdwf0UaUkFa6x34sntdtcJjQDypGAXAsgjkkh3uX5ugNsb3Rob4TmgE2Kj0QyESPBPATnNIPCROSTRE/pA5pHKQDwpy0HkJhbY8BKlohlF7IyLiyhMRN3EKrDGncpHtY1v3VeyP8ASSuD2W6qkMYTqLEWtu091BiRcQS3yqWlDr3IVT6y38jovjaljxxynSAOgNgqGiuXWKr5XMZEQSklDYle/cxPq6gFVA9tu1lzH6g8u/x9PNaHVqv2XU2OuLwWsCwHqnpOHGInNqIQbnuFTuo9kdtwma6JJbPKnP8AyCe+WorPwY5J+Vcq9ZdOf92MUdqj06XeF7A+oHJmjlwuokgoh8p7LzZ9UeW8uE4lO+OlIsTwFgXUam+j3fgufUaVplH6e+u4YMSgp3SAfEBz916HZFOpMcwGFwcCXMC8megccqOnsejBJbZ69AfSTndTsoqenqasABo5coFSky3yfIzy62k//wCh0LmTlxDimESRCEG7T2XBHqn9PEsdRPUx0fJJ+Vei7eusFxfDA0VLCS3ytRZxdJYP1HBJqjY69+ygyMaP1FfxzMyI3eth46Zh5W1uGVcr/wAMRZ3ha9qmVWGVXtuaRY916EZ55G0bnzyQUYIubWC5NzSykno6qQxUh2vawWVbjNnvXEcrFUpNmtKbqJ1O0AuVYzqsyR6RJZUdX0ViUbyHQOAH2VFVdO4lF8McTr/oqMsaR0f/AMipL6VmIY3JKwtEl9uxVkdgNRjdVbRe5V4wHo3F62QCaBxu7wtxZV5MSYhURumoibkchS1YrizJz82Ea32WfIfJiepxKnk/CckfSvTP0XZZy4XDTEw2tbstOZD5GU1M6neaAAgD6V27kJ0KzCaaEsp9NiOy2MatRPB/Mc6LjLTOkcr6P8Lh7GHs0LN6qT/JFh2WKdDR+1TgOHZZQAH7O4suhx7fVHzby+7cljMMAdPv5V7mdEIgPssYxHFocMdq9wD91aa/MqjgYQ+saLfdalWYomfRx99j6MurJImtJB3CpGzt1XJsL+Vg0eaVHUTmM1g58qvj6mbVkOgnBB+6sxzozWjT/wDjbqo9mdUVc1lhqVe2rErQsNwurnmIOvZZHh7nEC57K1VeYObU4suIYHDUAE9jQ03U9DE10fxBLU0xJBjCt/kTMyG0PiBtf7J5GwTWENYGk7pfcaG2JTG0LPbQx4sf1SIJJ5KVtr7pVIquLGu+UqExnk2VUA07CyDE0ctslYnqylaCXCyqoWENH6pBEwG4UjOEnaJI/Rx2F1FqBcQnSvLRYKKNxLt0nwlTGVLD27qlkY7gBXEsLuyjlpmjgf2opSZImmUcQIduFV05tZR+01v0pzHaTsVH7Ej7XQ6oiMjdla6yL2zwrs4lxsFRYpEfbLgFQvn2V5RLNV4s2jYS51rLXGaeYzKDD5NM1vhPdXrrnEpqRkulxGy5wzz6srW08rGyn5TwVlXyeuivOJpb1HZ5vpjUMFSfmP1LhbOXOWrrcTmLal27j9S3Tn9XYjXTTAucfiPdcvdYdHYtiFfI72XkE+Fk2lKyHRiXUHWtTiE5c55N/urTJiJlb8SyE5YYpNUD/hX7/ZXL/wCyavZT6jRuvbwsjIUjNthtmFxVLGu1WVwpccZDbU61lXYhl/X0zyfwrgB9li2P4dXUElmscAOVjX+y7KEoNPsyKbqSOQhrXDf7qd+mtpL27LA6eulbO0SOPO6zzAJI6ihABubKrG1pjH8MM6mwcbua3v4VRlrFJT40wG4+JZJi+BunaXaO6OkcCEGLMcI/qC08a3sSLezvP0M4g6nqKNzz3C9Vcj8WZV9OQgG/wheUvo2o5ddIGMI4Xp/kF7tN03F7txZo5XTYl6STL9Fvq0badKxzTcK3SNi965Z3VK/qGmp3OEswHm5VmxvMTB6CNxNawH9Vpzy4tF+zKi1sySoxSloo7uIGyx3Guu6WBxAkAt91rPrHO+hhc5kde22/dat6zz5p47lmID/coJZf/sqzy0zfGO5y0OHREuqBt/qWvur/AFM4fTRSRiuHB+pcy5l+oKRlNI6PEe3Zy5zzG9Sdc2WRrcSPH5lA8llaWR2b99S3qIgxOmljjrb3vsHLhfNjGpOpcUkLbu1OUvVmcVf1BUGN9a51z5U/RvTT+pKmOR7C4uco3btjFNyZXZDZcVGJ4tE8QGxeL7L0h9KWTwjpYZHwDhv0rQXpoyahbJBMaPlwvsvQDIjoxmFUMX/D2s0dlPTW5Mu0LbNldCdJx4TSxnQBZo7LLoqhkIDCFT4dDoja0NtYIqoiHrqcCv1SNvHrIsTlbM66lwyIgD9VSVEbnOFuxVxoG6YRtutppaLsoJIXGm2o3jV9JXMnqTjL6Wb/ANJXSOOPmfE5rT2Whc9cAnraWS7CbgqauOoGblPo88M6WmKuls0fOVrGixcUNf7jn2sfK31nv0Y+GWaR0J5O65b68rajCK2QB1gHLm+YpUoM47kHtM3r0R1pDNoj93+1t7pXGop4WgG+y4zy565m/GsjM55C6ayuxr8bTscZL7BeYZ2DOdhx2Untm1nYjHFAH/ZWuo66ioX2MnH3VDjGJCCjJD+y1P171lJRl5bNa33T8Pi5bW0UlOSN1UeccNGLCqt+jkYhm6yvYQaq9+11yRiWbFbBMWmrPPlVOD5r1czwPxZI/VdrxfDyck9EF1z0dBdR9VNrWus+9/BWturK4gukF+VDgnWjK2ICee/6lUvVeJU8lO5zXjjZe0+M8UoJbRg5VkmYpjHUP4Vzvj/tWsdXa3W93+1YussTe179L+6xA9RTQTaXSf2vZuOxYwrRm+0vY2g7qYEf+J/aoq7qcNjN5N7eVg0fVLi3/wAX+1TVnUuoW9z+10FTUSasvuNdS6wbSdvKwnHse9xzhqPKjxLGJHtJ9wrGMWrpHPJDjytKu/SLcYsmr8Tc/hx/lUT8QJdYqjkqHOB1OUD6kNPzKOzIQ9w2TV9QCL3VtlqAATqUlTVahu5WfEqwsBsUkcleuhPxbFxLEdN7O4VpqcWuSCVS11e4uPxKz19ZJf4HLG5K9ND40bKvFawyMPxKwyxmSW48qtbJJKPjSwwMLwXDuvLPIZuVb0XK6OzN8oIXf4jGONwu5PTtIKenhcT2C4oyxbFFWxlh32XXeR+LPp4IgXbaQvl7zaDlGRcrqkdLvrmT0AaHdli9bSievuG33S4fi76mBrWlXbCMPFVVBzm9189X40/8n/8A6bGJBqSNm5EYU78TEdPcLtLKin9nCYv/AEhcuZG4Ixk0T9PjsuregIjDQxho22Xo/jEHGSO14xaaM3o9xZS1TQ1uoqGkBI+FTPhlePjXsmG24I7KmKYlPMNOkKnqpSx+x7p5b7R2CocQlcNx2V+Ve4lv8SaJKt4lp9JN7rA8wMvm43SyvdGDdp7LM6KcSENeVXVNNHPCWaARZc5n0+2yrfR0efnqbyRjZSzSilbwTs1ecHqJ6MmwfE5Q2IjS88Be1/qK6NpqrCpXGnHynsvMX1ddD0VPU1LzCB8R7LmLa9GPd+vw5Oy762l6axVpc8t0vHBXZfp69TbMMp4jJXkWA+pcGdaSNwfE5faOmzuyMBzdxXBmBsFW4AeCqqtcGZF9/qewOB+tujjp2wHE+Bb51kOH+s2imYB/iW//AK14+4f6jsbjkDf8Qft91kmD+pTGg9oOJP2P5lZqzXHrZTWdpnr9gHqxpKucNFfe5/MttdB51UuNMZ/xVyf9S8dMvPUfiD5WGTEXcj6l1DkV6jJ3zQtkxE2sPqVuHJ/+yeGc9HpYzqKDFaExsdfU1c7+qDpU1+HzFrL6mnsrtlpnXR19HGH1wLiOLq69bz0fVWHuDnh12lVMrPViEtyfynlX6jcsZGYhNL+H+s/SueMSwKXDqt947WPhemOf2TdJWsmmbSA7nsuLs68uG4LLM+On02J7LFut/IV9tmi8ZcfYtq/tYRitM6qncLLJep6uamrDA4WF7JuA4OzFpGgMvf7KnGHsxFBtmMYb0xJPMAIjufCzzpXLyoqg0Ni/pZz0VlQ2r9txpbk/Zbmy1yLnqKiNraA2Lh9KuVY7bJ4V6ZqHpvIStxWw/Bk3/wBKyqD0p4hJEHtoO1/lXbeUXprpZYI3S4aN2jlq23hnpqofaaz/AA1vH5VcjhSbLca2kecWCeneqwpn+bQ2t/pV4osu58LmGmnt/wC1d79S+m+ip4zow4A2/KtedRZBsimJZQd/yrbxcdwijQqjr6aZy0w2rp5oQGHYhdd+nKWphmhDyfmC1d0rlBJSVTbUhAB8LfWUvST8MdG72SLEdlvYyaL8N6R0/wBGTuOGMufpWQNs6PcdlifQczxSNjkPDVletojFit/He0aFZBUNsLqjleAbg91NVTki11RnU5y04R6LESdk4JsFKy77W7qnhYCRdVMY0kWTmtD5J/SZjNIBJSk3NwErASPiCcWNVdrbKs5MYCQL8JDL9yklNuD2UWt3lOSKcpNMlY467qYHVwqZji47cqVriENE9dhK4FouVTySWvbynySv4uqeVxuT90xlpS2hTO5p3UkTfdF1A0gn4uVPFI2M6QVFKQ3emSsYW904mwvdNlcQy7SotTvKib0Ncux0lQxo3P3VLLiIbcAqgxmomiNmHsra2ueQS9yrzt0Wsap2SSLhXVTHAvcrDi2LRQg3NtlFjGNtgBBktt5WD9XdZwUzHF1SBt3KqzuSOu43i7LppJB1p1fDS0z3GS1r91zFn/nVDhMU9qi1gfqWS5w5u09FSzBtaBz3XEXqXzk/ER1IbXb2PdZN+Ut9HsHBeLSnWtot+afqkZSVcn/HkWJ+ta+w/wBYDXYgIjiJ5/OuUs9s0MVFdKYKp1iT3Wn6HNPGosTa51W/5u5WXdlvZ0Ob4k4V7cT2U9OnqPjxetgaa4m7h9S7+yJ67gxXDoiJbkgd14L+k3Ousir6UTV5+YXuV6r+k3Ounmw6BsteLkDlyWjKTZw/K+POuL6PQLCK2KeIEb/Cp55mdgtedE9e0uIU7Cypabt7FZZHiH4iMOY/ldBRfFpHleZgWY9j2i5me4sVbcWgD2E2VZSMdI3UVHURGRxZZX/bcShTdKuZg+P4YZg4BiwDqroRuJE6ogR4IW6K/BhK0kMurbJ0xG8fFGFTtr9jr8LllTFdnL3WuQ8FZE5zaVt//StI9femt0z5NNGDz9K77xDo+KcFpgBWNY3lZR1Yc40g3+yxr8bs6zC8m/Hrs8x+tPSrUzyu00P/AMViTfSJUvkJdhv/AMF6gVWQ9BVOJfQN/hFN6csKe4H/AA5v+1VHjM6GPmfpDXsebfT/AKPZjO2+Gjn8i3Dln6XG4Y6MOoBz+RdtUfp2wyFoczDm3/8ASr7g+S1BRuBfRNFuNk6FGn2Yub5j+T5I05lLkfT4eGONI0bflW9Ok+hoaSNjREBYDgK+4J0XS0AAZABYeFktFhUULBZgWtj1xRxXJ+QWXr1TLXSYEIWDQ0KpgppGyAAK909MwtsWhTMw+Mu1Bi1IJb6OPysh3Lsp8OhLmAEK5RQCOPhJFAyMWa1TN+WxWrWtIxrFsieCTsE+Nh07p2kdwgFo7hWIvSKbqbZG5xDtICeDoH3S6GE6rXTZCXfKU7eyxVVoUyXHKaozcbX4Stcb2uhrRdjHoqIwAdgpGkA3KhY4nunanHgqNrsZJEj3Am48JocCbBNLncFAv2SepETgWFkJge63Kc0ki5SAKhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEj+ACEITAEfx+6Ynv4/dMR9Hx+AgOLTYIR3/ZOa6B/B7TcXSpGfKEqI/BghAIsUxSKNOIZfAQDY3QhAJCl5IskS6SG3+yY8G90q+kseyOX5k5vA/RNk7JW7CyeTJaFdwf0UakO4smaCgc30KwG6ez5gkStNnBAx9j0A2N0ITNMj9dil5IskRwmvIPBSrYjhsV7tIumE3N0bIThPxjXP07KKaYnunSuDjYKneHHbwq9i2x6gkRVEYeCElPTWBICqIoHOA2CqoaYe2bqBLsdtFJTRaHWupKrU5lvKUuEchBSSyN89k/062Prit7LRUROkfuFSVeDskZchXh0bSb/9FHUWawgpjitdmjVZKDWjWGZvSlNiGGTQFl7tK4N9WGQra988kVKTe/DV6MdQUD6oPFuVpvNrLKHGIZNUAN2nssfIp3LZ3PEclKqCi2eM+YWUdf07ib52QObpceyqcvM38Q6HqmRPnLNJHddkeoLIZjYppI6Icnhq4ezry8xXAK2d9PA4aSeAqU6lo7XEzvyrtnRfRnrFLfbhlxDxy9bNwbPyi6phbG6radQ/MvMuHHuosNxERkvADluzJzMDFI5YhPO7kcuVKyCOmwciFb2dmY9g1H1PSOcGh2oLUfXvp4Zirnysoyb/AOlbIye6ibjVPDHJJcuG+63fgmX1Li1GJDE03HhV3SpPSOuxubhjw230eevUPpglie4toSNz9Kxw+mSd1Rf8C7n8q9IMdyYo5nOApG+PlVto8gKSWUEUjOfypn+Lp6ZsLymhVeykcM9Kel+QysvQuG/5FvXKr00tpXsLqQ9vpXTXT2QFLE5p/CN2/wBK2D03lDBRhpFO3YeE5YyicvyXmENNexrbLLJSCgZEfw9rAdlvfonpmPCqdoay1vsqvBej20jWgRDYeFkFNh/sRhtuFIq1E8o5zm3lt6ZfulZwLMJ7LIqisjgpy8kbBYZQ1ooHXJ7KDqfraGmoXn3LWHn7KWMlFbOL/wAG7KuWl9MXzmzPhwCOQ+8AWg91y5mR6to8KqHxivAsT9ak9XGbZpY6gx1JHwnhy83c+8+62DEpQyrePiP1KrLLcX9O+4/xuf41+p3z0v6vW1+ItYK9pu78637lbnzHjDIgahpLiPqXi1lr6hqgYoz3K13zfnXYvp69Q0UhpxJWnkcuT8fO3L6XcrgGq/h6u9CdUMxOFrwRuthYO4TAO+y5JyJztw6rpWNdU3Nh9S6L6I67o64M0yA7eVvY2UpM815zibKW9I2LHMYY7/ZNGJ7EOVC3FI6mEFhTAdd3X4WvC3/2cW6GvqKiavIfcFNbiN3WLlQVM4abX/tQMe97rtvz5UqnsbOD12X+Gra4Wupw4EK00Re0b3/lXCFx2uU9T7K6gtlQ24OqyfI83BATWSN02t+6Qgg2KVzaEnEX3R3t/KeyT4bgf2qctcSdk5oIFinqWyPWiV9n8hRsaA5KGl3CfK3SBv3Tn2hV9HtN2oc0Hcnso4jbcpzzqFgFDL6SJdkE5DNlSz1rYjYFTVTXW2VrrBIBf/qoZPSJ46LpRVYkvdPqY/diIPdW3CnucTcq6t3jsfKpWLZHLtmrszqB4ZJpB4K5uzV6cqMQMjAwm9xwututcKFXE5um91qnqDoFtXUOBh7+Fn2wf8IZQejhXr3I6qxeocfwriHH8qxP/wC6hLU/EaA7nf4F3+cm6aqeC6lbz+VXvCshqF8YvSN/2qlZT18K1lZ520HpAc6UH/Dz/sV1q/SCW0pIw88flXojSZEYdG65pGX/APSp6/JLDzTm1Mz/AGrOux9r4UrKd96PKLr30vOoIZHfgXbD8q5xzbyenwyWQfhiLA8tXsrmtkPSy002ikbwfpXGnqKyHERnLKMcH6ViZGMynKjZ5idRdPy4dVW0HZyvHSdc6MCJx/ZbOzcytmw6pkcYLWcey1dFTOw2t9o7WdZYrpkpFSdLRmMftzwgc3sshy+6MkxTF2aYyfiHZWXozDZcWlZGwXuV0zkHk9U1NTFUOp7i4+lWKm4aKrraZvv0eZbmj/DSvi4seF350O+HBenGXIFmLmrIzpqLp2khL4w3SPC2h1RmjSYJg7oRNazPK1ar3FDv2ihub2dMPTTZXfiWtt/qXLGanrSbQTSxtxICxP1rF/VXny5zZ209U7vw5ef+cmb2M1VfL7c8ltZ+pSyy2kQzuaR2H1F6z5KyVwbiAO351imKepqfFB/+W3/9y4npcxMXmkJklf8AuVdsO6/q4jd8jv3KhWW2/pUd72dHdbZ01NVSvH4i/PdaDzCzRrJKp1pOT5VBjPX5lgLXSHjysCxjFhiNSd+XKaNzZJGzZmfSPVNXiuJNjeSbuC7L9MXRbcZ/DPkj5seFxvlJgX4nE43lvcL0N9I2CMhjpQQOB2V2l+2tF2pNnXvp7yrp6engf7fjsuqOicBhw6kaxo4AWock4IoqCGwHZbuwWQCEC63cWG+zXohpovlN8PHZMq3XkTqVwNgnTQtkdcLfpn6pGzU9Ipi0XuQpaeV44G36JwgttZSxCNvZXY5G+iadiaKOvmuwhw5C15mThbK2mcDHe4K2PXQh4JAWEdePhp6Vxk2+E8qeOQkuzGy56WmcW+pLpiOKnnkEY2v2Xn76gpzh1bNpbwSvRP1Q9QUMNFUj3BffuvNL1P8AUdIa2o0SDk9/uqOSlajk81+xiXQfV7o8Vbqf9S6syS61ZLTsY544HdcDYB1iymxS/u8O8ronJLMuOMRt97x3WJZxasnvRzWRHvR131H1HGcOJDh8vlaFzQ6oeZpA1/fysiruv2VmHBolvdvla26sklxOV1gTcrQxuJUddGdKvswbHMdqXzktJ58qowHHqqN4NyqsdIzVb9XtHlOk6afQMLiy1vsu44rArhFNopXV/wAMpwLrKSFoBk/tXOu6tNVAWmTn7rV1dizsNfa5Fkym62a74HSf2vQuKnVRoyL6Wy/dTVxle48rCsXqHtmJHlXirxuKqZu8ErGMdxKGJ3xO/tdtjclWopbKaoexs2NyQC2pUpx+SQ2J5VkxTHI2kgOVBBjLXP5V6HIQb+lqunS+GWPrnSx7q3VzS/dQ0+JxlnzJs2IR25VmPIR19LEa9Mpap2i4VtqaotdbbhSV1cC824urVW1W9wobMtv+k0a/6TzVZ072/lW6ueX3KZJX2CgnrGhRrMeu2Swp7LfWRkuJKtssBL7f9FdKmZjuD2VMCxzhdZ+ZkOaLcMbsYyj0xXsqZxLH2PlXGombDBdWKtxFvuWHlcTzMXOtlyvHNg5cVmitYQe66xyPrGzsiYXDgLjDoTGmw1bS53fyum8ler46cRH3Ow7r598rwnP2WixDGf8ATrjpqlgELCXDdZZhMlPFUNsRt91pbAcx4mQMBm4t3WSYRmHE+qA97v5XiOZxnrfvRpY9LUjrrJOvj9yJoI7LqHoSfXRsFtrBcWZAdTR1E0LhJ47rsLLbEmS0MVjyAum4On8c0dThRUdGwoJ3Rt2F1JLiEpZYtUVC4Pb8QVaKeJ43byvSsWfSOrx2/VFGJpZT8qhqqZ8vZXWOkjabEBOlhjaBsP4WpG1OJoxmtFmosOcX3IVe6H22lp8Kohaxp2UVbwf0WXlJSTI8iS9TV2escJwiTX+Q/wDJeY/rNgg9yqsfqK9IfUTijqfCJdLvpK8vvWL1A989S3V3d3XMZMUkc3lS1s4RzYaf8TnDPJWDQw1j3aWs7+FnXX0oqcUl1b/EVQ4JhtNK8EtF7+FgX/q+jnMoxunwev1+4Gf0rnRUeIMeCQVm9LgdFoDizspP8Jo4zswfwqE7HExpe3sUfSuI19FI0ucRZbnywzTqMImZee2kDutRzRU9O27AOFSt6llw+T/LcRbwVWllSTHRlI72yo9SDoJIWOrhyNtS6tyhzRh6sp2MfOHXA7ryA6DzPr4sRiaJXbOHddv+lbNp8Yh9yc9vqUcciUmaFG5Ls7L6/wCjKLFcGfOWg3bdcQeq/oSGihqXxx8A9l2dS9e0+K4CGe6Ddnlc9+o/pp2PUk/ttvcHsrEG5FuEDzDzDwyRuMPY1h+Y9lkeTvTb6ysYJGHnuFn+YeT1W7F5JPw/1flV8ymy5loqxgdDbfwr1FPsWoVbZtvJfK2PEpIGeze9uAutsofT7TFsUhpD2PyrXnpv6La+ppg9g5HZdy5U9DQRYdHJ7Y+Udlv4uJ7aLkKNr4UOX2UVHh1Oy8IFgOyzmm6Jw+Jo+AbK/U2GNp2BjGjhJPFMG7LoaOPTXaLscdp9mLY1l/QVjSGsB28LD8aygo537QD+Ft2jpZJG/Gnvwlkh3aP3V1YTiukTRqaNK0WTNPE8FlP3/KsnwHL9tAWn2rW+y2LFhUMf0D+FJ+AibuGhOjS6yxXBot+AYe6mjAtwFc5Kkts1S00UbBYKCeFxlutHH/VluC0RSyFyI477i/CeYCeVNDDp2sFqxeoliIsUAHayd7dnWAUiRzw3lR+zHt7RKOAh3B/RQia5sCpA8W3SFScW2RTbfwolUOAdwonsOydvopSi/bQkZ0uupmHVyoWtLTdSxblNbJK4seYg4WUM1ObnZVTSByUPLSFDKRcS0UQp3XSOY5r7+FO+VjXX8KGWpYDe/wDahmxLI6RI6S0diVH7vgqGerBbYFLSkyXVWdj0Rw7ZRYuNV9lj9fKIIy4myyjEYP8AL1WWCdbYmKGmkcXW5VO6fqtnR8XSpzSRhmYXWAw9sn+YBZvlc152Z9sweORv4oCwP1LLs9cxGUgnb71rNPdcD+qPOGaMzNjqT3+pZGRdo9s8X42M2uiTPD1RukM0Ta4bk/UuW8zs4Z+oHTNbPq1fdYJmVmXXYhWyATOILj9SxfD8SmxCT4yfi8lYt13fZ9G+N8HCUI9Fk6+gqsXe+TTf9lrSuwKppqgye0QQebLoCPp+Crhu9gOyxvqXoumaxzmxjjwsy7JcZbOzzvG4WVLox3KPrqr6ZxGImSwa4Lu30yeqKXD2wROrbWIHzLz1xSgdhVXqYLWd2WYZa5n1eC1bGiZws4fUmV3tPa+HmfO+NJRfR7wenX1HMxpkMZrGm4H1LrboHqiPGKSKT3AbjyvFD0heoGRtXTskqz2+penPp3zkpcQwym1VFyWjut7Dy/h4H5NwThvSOt8NDXQX+yeaZpkusc6N6phxGmaWvvf7rKoSH2d9l0tVqlHaPHMzHnTa1Ib+CY9m4UL8OZbj+1XEhrLnwoXyNPBU29Irwsmv6WyTDWarBv8AChfgsb73Yro/TqulazWNmpn4vdFqN84rey0MwGnBsWqspsEpGG2kKrNO/sCnaHt3AUTp1/BLMmxx/wBiSmwmkABLVN/gtI/ewUUL5D3spzVPjbZQ/h7+GZbkWKX0Y7C6eIXA/hRFgabNunPqpHnlLGdRuVNCGmV3kzk/pLAwuF1VRRgbE9kyAAC9lK4hp2Ctw6kSe7kKGAG6c1t0xriU5atb3EjaH6G+Entjyj3B3CQuN9iVMmhFFIHNDRzuoztt909x2N1GnrQ9JIY7k/qkGxupRGLXH/JHt3O4StrQ5SSFj7p7PmQIz4AT2tvsmNjJNCObqN7oa3T3UoFhZCZvZEMaATYp4FhZCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEISP4AIQhMAR/H7pie/j90xLH6Pj8BHf8AZCLb3Tn8B/B7PlCVI3gJUJaGAo1Im+3905PRE1sbynNZv8QQGWN7pyRipCO+VRu+VSP+UpiCVaREWg8hODSeAh7bHZOb8oTnIfKXQ3Sf/oI0nwnoSewz2Yga224RpaOyeWjTqTUe2xUwQhCX2YewjiLEXTErx8WySxHITh60xheb8oL3HZFnHsUAOHZH8HJaQhjJ5amthBJVQxoIuU5jWg7+FDJbRHJ7RHHGGgbKewDTbwmlu+wTZXubGQAmRikxhbq57hIbHuqcSPcbXVVLE+R5LhtdMfTltwAnPSRYrYkO/KSpg1AmyfFGWp819OygkTe2n0WSsp2G4cAsfx7AYa2MgxA3Cy6sotbdatc1P+ZMlSnE1MXIcWjQWaeT8OMQSN/CXvfsuS89PSM7FBPJHht73+lei+MYU2puHR3v9ljHUGXWGYnTPE9ODfyFmXVNfDrcHkY1pbZ40ZiekKrwmWSpbhxGm5+VYLg3QGJYHigiFO4aXeF6tZyZGUNVFJHS0VwQeGrmvqr02y0+IOqI6E/N+VY9iaZ0dfK+q+mB5BS1tLVQxyA7Ecrs3K+RlRhcbXM3sOVoDLzKWswqvY51M4AO7tXROXuFuoIo4SOLbKFbTLUuYbhpvoyyHptla7UIQf2V1w3oWNgDzTjf7K99K4eyVoLgOFl9HhEbmAaQpYsx8rm7ILUWYrhXScLLAwDlX6l6fijbtD/SvlPg8MbVLJShgsFK0tbZz1/J2XS+lpiwyNn0BU+Itip2k2tsr1I1jGXJGyxXqzE4oNQLgNvKhkhMVSyLUizdQ9Qw0kbnGS1lpfNjOWlwymmiFYARfur3mt1pDh1FI8TAWB7riL1FZ1GlqJ2isHJ+pZt9ij/T17xfxv8AyHGTRYPVNm9HibKhjay9we68+M8Mdqa6vleyUn4it15q5of4xJKBUg3vtqWhurIXYvK91r7rJtuj/wBPa8PxaEavhrvCOrsQwjEBIJnAB3lb9yUz0rcPfDeuIAI7rReM9Lua8lrNwU3CMaqcAka0OtYplNy9ujO5LgY1xfR6nenX1RPa6KOTE/AN3LufIXPiHFBBevDrgfUvCLKXO+uwmuY01JABHJXdXpY9Skj5aWOWtHb6l0GLf2jxzyXiVHekeynRnVkGJ0Ub2zg3HlZNFUEsNiuXvTtnFT4zRQNdVA3t9S6NwTGIayna6N4NwuiotTXZ41n4Uqpt6KmZzzLdVuHxatyEz2hKA5trqelBhPx8K8rNIw7IIuEETWsv3RJOGEgHhU8uJwMbpDh/KpxUmWS7eCpYz2VXVJPei500+pwuVWgBwBKt1IBpDu4VXHOR8Ke5EM02ybSPCCWg2I/pN95g5KY+eLUfiUkGQNbJ4yw34SyNDhuFTtqG/SVIZ7ixI/lTb60L66FGkbAhOYWm9yFA551GxSxvdxdRy+jl8HSx6xsFRVVLcEEK4JkkQcCVDKLaHp6LdTwezcgKqjnNtJKf7AHIUbodBuAVVmhdJ9kFdQtq2m45Cs9R0oySQu9q6yaJnwcpTFfflQODY0x2k6UhYATDv+iulNhsFOwN9obKt4VJUVDmPO6jdTbGNLQPgjafkHKinijczSGqOSuJeApA4vAsq9lPWtEEl/DGOrunYa6lk/yAbrmvPbKeGvjlIpASWnsut56T3oiJBsta5odOU00T7M+krIyMV6fRUnWeVHqSyVfTMmfHR8E8BcZ9cdE11DjLmtpyLP8AC9bPULl3HXQTNbB57Li7MXI2eoxl8jKN1vcP0rnrcdqTKdlcTVnp76MnrMVhZPAbFw7L0T9PWVdBHhkUz6cX0jsuYcncsJcExOJ8lMRZ3dq7Lyxx2jwLBGMkcAQ0clUXBxKc61syXqSooukMPc9jwzS1c454Z/spGTQR14Fge6zD1B5u08VBNHFUN2aeHLgrPHNCuqcSmEc5IJPdNUnsrSjr6SZv5mSdQVD4zVlwc491pPqPpxuKudK43uVPVdUOrJwZZe6rm19PJTix3TZ2P+Gdf2jDn9FiCMuazt4VqqsHngcdjbdbIhNNURlrwFj/AFPTR07SY2qvCb9zPbaZrrHHzxNLA4q34JSzVNW0PF91ecdgfK82ap+lMN/4hpcO60q5PeyxVvZtLJ3DBDVROc3uF3f6ZcQgpWUw1AENC4i6A00sjC37LqTIrqr8JJA0SW2HdbWK9mxjxPRvJfqKJ1PDHrHbut99P1PvU7Sw32XIPp+6hkrmwWfzbuut+gG+9QtcfyrpMZxSRs0rSMlo3uHKkkqw12k+UuljOCFRYg/QS8EbK/KaitltycEVMmIRts0u3U0MocA7UsTxHG4ad13vbcfdUT8yqSjjMZmbt901ZCi/pE8iK7bM1rKuKJpLpLCy0vn/ANe0uEYfIW1AFmnuq/qzOWjgheRUt4/MuT/VLnrBJRzNirBfSeHJ3+UpP6ZWbkxmzRHqrzsMv4mFlX3I2cvPnPfrKtxWsnc2UkEnutx58ZlVGLYjO0T3u491obHcNrceq3kRkhx8K9RJWdHOZEvZs1hHitbBW6rnnytoZYZhT0ErA+cjZYzjOXtXTD3WQu4vwrOySowOX4trLex8WMkmZdtTZ1d01mcytp2Ruqr7dys0wCop8UAc54N1yH0jmO+nnYwz23Hdb0y3zHgfC0unH8rUhipL4Z9kPVm88NwOhLAQ1qt3VOC08cDixovZW7Auv6OVgHvA7eUuO9UwTsIDxuPKtQtdCKNkUzVfX9M+F7/bOw7hYJLXVNPKfiPK2P1g/wDGFwYAsIqcFnklJDO/Nkv/AMpOspWU7G0eLVLm7k8K2Y/JWTm7QTsskw3puZ9rsP8ACuQ6IfOLmIk/ortHPuL7ZGsbs1NXUle6wLXKnjpqmL4rFbUrcvZ/ppz/ALVZsU6Klp2FxiI/ZbVHPwetyH/i9TCRiM9MLPP8qnnx12qxcqzqHCp4C74SLfZYtWOliJD9rLThzdba/YbKKT6L+K9ssdy7e26o6ipa7bV2ViGLTRu0Emyl/wATY9t9XZbcM+mdW9ksIpk1VOGi9+6t1RXOBI1pmIV3NjdWqetLjYHdPjkKXey7VBMuDq4n6kx9eY9wbq3smcSLptRKTsEy2z2NCulMrK7FC6Kwd2VjmmfJMSPKrJY3vi83TKfD5JTs08rIz4KUC7ClbK7AKt9NM1wd3W48s+t/wRZrm2AHdaZioqiB4Jb/AEskwetnpYgGON14/wCR4fs20izGpnSNPmyyKNoZVeO6v3Subb6ivaBU9/K5tw3F6yazS88rOehjWmqbIXOXjXJ4TU29Fqqtpnof6Ysxfcnpw6fm3dd85J9S09ZRQAzi+3deT2QXWL8GkgMklrW7rtDJj1AU+G08LXVTdiOXKPAh+KfZsY8lFnfNDPE6MFsl9uyr4ZGncv8A7XO3S3qWoJ4Q01bOB9SzTCc+MNqrNFSz/curpyoxSRu0ZSS7NtCYXsHJKmpY1u5WD4fmXS1hBZK03+6vNPj0deAA8b/dX4ZUZRLkciLRdm1YLtnd1FX1JEbiPCZTtad9QRVRh7HC/ZQWzck9BbY5w6ND+pGoldhUouflK8ufV5I78ZVAu+or1Q9SNAW4RK4D6CvKz1kCSGrqvg+pywsl+yMG+W9nFXWdQGYnL8X1FQYLXFrgQ5UXXNTMMWlAB+b/AKo6c9yQNDgsC9MxshbMwjxwRx2v2UE/Uegm7lSOonmPUrXX004dweVl2xM6VabLxJjrZWkX/tUgIqZeeVa4mSsPxFXPCmNfI2xWZdGX8HxqMg6awj2Z2TM8roDJXrp+Avja+oLdJHdaa6cpbQguaeFdxjsmEP1ROIsU7HjL6XKK/U7zy+zqiqKZkT6wfKPqWay1tD1VS6S5ri4eVwb0Hm3WU9SyM1B/ldO5HZhnFnQsmlvfnda+PXtl+FZfeq8kYMSe6eOjBv4Cs+EZPPwqsaW0ZFj4XSnSuC4fjOGB9rkt8KsjywbV1JcyA/rZb2NQ2/hpVVGP5B9OPoauDVDaxC7Ly10DCmN0gbBaKy+y6mw+sjLYSAD4XQHRGHGjo2tf4XS4dL2ui/TUZLExrjYjsllpmOZsP3SxN3+E3UsvwxbBdRjw2u0XFByRFTxCNpsO6Vz2sNwohK43uVTVdQQNLTvdXJV6jsa4sqnVEYubqMzajcFWt0k7nfCFVUbZiQHBZ9lf7Dkmy4RF19ipfb1b2SQRi1zdSgN02Tq12ieKRH7X+lOe0AbBOSOGoWuryfRItEbjYEqGR9yfi5UkpNiO1lTSlwNgEOWmSx0hzDvvYqojdfZU7Ab3+ynja4DcJRbIxJNJsLBIW6ef+aew3G6aXF3Kb7IpOtNiEA8pDK2PYDeyY+UDkqF79yQdkknskhUyY1FuSopalwBLSmGQOPKa/wCJtgoJFpQ0iCarfc7lUdTVSE2BPKq5ILuOygkpA5237qGbIrotx6EidJNayvGHQ6YgXDdUdFS6LEq4ajHFZvNlUlsgqraKfFyBEQD2WoM3ah8VDMWnexW1q6fU0h52C1Zm5TCpoJWQ7kg8KlkPrZ1fBpRuSZwj6l+pa9lTURxvPB4XBnqGnxOtnk1FxBuvQ/1AZf1tfPUSCEkm9tlxnnflrWNmeZKU23+lYOTJn0L4iq/aJxT1DgNVJUuc5p5PKbg2HuppQJAtn9YdJx0bn649wT2WBYmI6Sctb24WBfNr6fT/AIvXBwiXSnqWRQWv2Vqxib8S1wsqdtfI92lnHCnewPiJPPdZF1jPTP8AEhZT0jXvVWHudO4hisUFFPTze4y4sb7LP8Wwd9TIbM5Vqq8CdBCXOYo673BaOH57i4uLejYXp7zFmwDE4g+qLdJHJXod6YfUfHGylgfiPgfMvKDCsalwXEA9htY+VvrIjOuXD62Bhq7WcPqWxiX6Z88+V8TJ+2ke8uQWbtHjFFF/xgJNu66DwLHIqqFrhIDcDuvLn0f56tqYadstaO3Ll3xljmBBiVHHpnabtHBXVYWQtfT568g4ifu20bhqKppgu13ZW6KtPu2Lu6p6XEW1NMNLgbhOp4HvkuVsRl7HC20/j6ZdIWmoALd1X0tAQ0alSUwFMzUBwqiPFg1wuVfph7Lsz7bpRekV7KGID4gmy0IPDbqOPEw8WVTFUCQJ8qtlb83/AEpJKUx/KE6KlD23cFVbOdvwoppREbNVaUJJg9TKeWisfhamtpnMN9Kqo3+5yP0TywW4TPQh/GkyKIWbwnE+SnOYAFBJIb2Fk5KWyeLSRKD3BSh5vuU1huwFKtSvaihV2x779rpRxuhCli9oH0McTci6eGgDbukLA4pVIm2Mk9IVoN7p4H3/AJSN2FkpIHKH8IffsWx+38pASDsk1jwUhlHZRvpCqxMcZLGxcjWXcOUZcCUocW8Jieh5I11juU8EHcKMbi6e0gNFyl9mAqEXB4KE5PaAEIQlAEIQgAQhCABCEIAEIQgAQhCABCEIAjT2fKExPZ8oQAqEIQAj/lKYnv8AlKYgAQhCABOZwSmpzXADcoE32OQkDgTYFKgUEIQgAQmuc4HYpwIPBQAJr+f2TkjgCL27IYDLA8hCEKMBQwkXTmtLeUjXgCycmuQAh3B/RCOUiegI01rSHbhSOZ+UJvCkT0P2gSOaHCxUjQC3cJHgC1gpE2xjf9IdLP8A6CLNHH/JCE8T3BKy5N/5SsAN7hKGgG4TWh3t2Oa621kuph5Cie7SSbpvvB31Jj+B1skdHGe3dMfA2xICeHA8FSNaNO4Uf8He2il9seP6R7QPIU7oxfZqa9u1wFGKpsp54W6CrNXxtYSWq9yzsDS26seKkuvpUuk4k9djTLfLLEdiAqKvgdM0tjsp3U0jn3sVV0tAXgam/qqdsNmrRkev0xHEOlIq8EVEQN/IWGdUZQ0Ml5DStN/9K3YMJiA1OYP4Vsx+momU51tFgO6ybqNGjTyLlNJHOmK5fYfhILxA1pH2VnjxqhwqcB0gAafKy/OrqeiwelmLHAabrkHNvP5uCVUmiqtYnus2yOmblHvazrnp/NTCaXS38Q3b7rP+nsysJxCJrWTi5HleWT/WUaSt9r/E7b/mW2snfVuMTqImHFL3I+pVvZpl2XHu2vtHo3h2Lw1TQWSXuquplYyPUSOForKTN6PG6eImrBuBvdbJr+rojSB4nHHlSqzaMe7irVYlorccxuOmjcdfC1HmXmBBTGQCbex7qp6/zBjpaeU/iQNvK5Sz7z3bh9RKxtdawO2pVMnJcY6R6T4j4rZk2qUkJ6gM3o6ailYKu1wfqXAHqJzLlxCrn9qoJu4/Us2z9z9lrmyMjrub91y11z1dVY1M93ul1ye65jKyZN/T6Z8c8aVEY9FpxDqCsrKt2qRxBPlVuHUn4qK7h27rH6WGeSfWb8rK8D0xxWeQsz8kpP6emVcZGNXwsuKYEHuILVg/VGAvjmLmt4PhbTrnwFx2Cx/F8JGIPIjjvc+Fbpck9nLcvxLmmzXmFyVVDVj2yRYrpX0z9S4pFX04Y91rjuVq7AMqK7FKxpZSuNz4XTnpuyLr4qqB76R3b6Vt4trTPFfIeNjBtNHdPpM6pxMU1KXyOtt3XcOXHV7TRM96bsOSuLMk+j6jpvDIZC0t0tC2mM429NQFj6wNsPK6Ci/SPH+W4qFm1o7Aw7q6hbYumHHcqrm6mpqlloX3K4zovVVTmqbB/iY5/MtuZXZsQ9S+2RWB2r7rSrv2zgbuIUZ70bk/EVEsmrUbK7YW9xsHDurLhlRHJCJHPBurzhtRDqHxdloV9oysitQTSRfKVwPw3U5bpF7q309UGv8Am/hV3vskYN1YWznbtqRDNM9nCppaiUk2KqnwiTymCgc83t3UyIdrQlJM8n4iq0H3BYKBtG6IXsp6UG9iFKvge2xzI3AgHypmsDeUaRe9kkhtbdK0mNch5dcWskBsb2UH4g3tdPim1WuUwb2Pc0u4Se3fmydcHgpQCeAopQUmPUmNHwjdGtvlMnJbsSqR05DrAoVa0L7Iq3StItZUNc9oupmuv8pUc9O54J/6pXWmMcuy2Hd/7quoHtFg5N/BO50o0GLa1lE61/wikyrqw0QFzR2Wv+uGPkDi4XCzeWRz4iAsa6jw11UxwDeQoLqFKL6IZy2aF6+6YZjLnRiEH9lrPF8gYa17p3UTT99K6ih6BFTPrfDcX8Kvny+oIqVxdTN48LmcjC3JlSa2cRY7llB0y/3BTtbp+yw3qzr9+A0zoY5tOnbYrpr1A9LQ0dLLJBBazT2XDGddVXQ1skLC4C5Cxr8OSKdiMMzczJq8Y92BtQTf7rQHWuH1NeXyOaSTfdbMq8GxHEKpznMcbu7hXKhylnxeEF1KTceFnyxmijbHZy3VYBiEdVrDTypmNq6aPS+66J6gyGnhBe2hI/8AasD6oynrKONzhSEW+yqWUtGfZXI1ezGZIH2LtgUtVVivZZxuVJ1D0vWUVQ5phcLHhUNPTVEBAcwqvGtxn2V1UymmwJkxPwptNQtoZhpbaxV9o47tOpvZW/FtPuEN87K3GeizCCXRlfR+JEytaPIXQmSzauoqYSy9tlz3lng0uIVrGtaTchdgZA9CSH2HmHsOy0qL9GlR0dU+mt8tLHB7t+Qu0Mta6F2GtDnb6RZciZVYY3B6eKRwDQ1bcoM5aXpqk0uqw2w8rZpytL6aEbPVbOgZ8QgYdTpLW+6xnrDr3DcMpn6qgXA8rnjrL1eUWHte0Ym0W4+JaPzR9acErJGMxYcdnqaec2tFLJyptdHR3WudFJC95ZV2/wDctUdUeoOOJz2treP9S5b6k9VLq5zyMS/+S1d1d6hp3yPLcQO5P1KlPLe/pkTypr+nVPX3qOtTyNFcflPDlzDnXnNPi4lb+LLr35ctadS52V1e14bWk3HYrB8R6kxDG5y10znXU2PlNy+lG2+cv6MxptV1FiR03Op+62FlvkvLjELS+kuSO7VTZTdCy4xiMRlh1XI7LtXIjIynnw+N5oQSWj6V1fHWKbQ2v9mcpdYenr8FhjpX0Y2b+Vct52dDyYJNKGMtYnsvXjNbJERYHIRQ7aD9K89PVplnUUk9R7dGRYngLu8CKkkWZUr1OKpMdnwutI1n4T5WwOhsz56eJrffI/dYD1v0zWUuIyAxEWceyZ03T1UG24suiroTRg5dTR0H09nFUQvANQ7+VlmH5qurQ3XMT+656wyaZjwTIf3KyfCsXNKGudLt+qz8ur1ZkuLb7N5U3UUOIOGt/P3WQYThNLWgENBP6LR+D9dxQSBrpxyO62pl11pBWysaJQb/AHXOZtqr2SRitaNlYD0G2fSWx8/ZZlg2VnvMBMW36KbLuBmIRRkNBvZbi6VwGBtONcQv+i5DN5hU/wBHuCSNUT5SQ+3vTN48LDer8rWMjeGwW28Lp6p6fge02iH8LEup+kYpg60IvbwsheUuD/2K00cZ9b5bujLyIf6WrepOhKhr3FsX9LtTq7LQVTXWpufstadSZQSfEfwnfwtGjy3bX7FOa0zkPGcGmpC6Mxm/6KymKoY/SQbLoLrbKGWOV7vwp2+y1zjPQUtLOR7BFvsux4zyl2aXsOhIwSWmkkZwd1Rvw+UPLi3ZZyOmHC14u/hQ1vTQjYSIuy9B4/mY2wT2XKZfwwp7PbbsFT2LpN1esSw4RPLdKoX0oY4Gy3q8tTWzYoaeh8NLqjF1W4fFBCQXkeFTB/tRfoFa63G3QvIB7qHLt3E16UpGXGKlqgGxgEq74P0vPVadDNj9ljPQ9RLitY1gbfddLZO5WSY62E/hC4ut2XB8woygzQhWtmC9L5YV1Q5jmwG1/C2Z0rltU0TGukgtb7LojLX0zPmgjkkw07i/yrLMfyHZg1Jr/A2IH5V5fn0wcn0TuEdHPuHunwHS8EtDVkGE54TYJZn4wix/MoM18FfgcEmhttIXN/XXWVdRVj4453CxIsCuUyY+j2iBto7N6U9Uk8Twz8e7/ctrdDepqeolYXVzv9682+i+v6987fcqncjkrbvSGZFVRhj/AMWdvuqkbpp62LG9xf09OMvvUFFUCP3Kzv3ctzdGZx0FQGh1UN7d15UdM+oWfDXMb/iBFj+ZbL6Q9XMlHKxrsT8fUr9WS9fSzDKevp6w9L9YUOKxNEdQDceVf21THizTe48rgTJj1cOrJImnEwb2+pdQZb5x02PwRyPqwdQ8q9HJ60XastrorvUFRCqwKQht/gPZeVnrUwlzKqqHt/Uey9Xsw62kxnApAHg3YV51+s3oUVctTIyG9y7gKrdZFkNtqfw8w+uMN/8AxaT4fqKXp3Dg0t+FZ/mP0HNTYpM/8ORZx7LGKehfRutoIt9ljXdmfODkVgo2iK6gdhLJ32DQpRUF5DGrIeken5sSnYwRXJKoyqciNYzZjB6Lqqv/AMKK/wCyu/TuWGLPnaTTm3PC6EyxyGmxsR3oS69vpW+OifR/JVMZJ/hR4H0pscP2XwsQxJM5LwbLbEm0gtTm9vCt+N5b4sAXGA7fZegmHej58cA//DNrflVJjPo9fI0huF8j8isV8dL+FmOLI8+8C6PxWlrmn2SLHwuhci4sQo54Q5p2IW3n+jqohmLhhZFvDFkXSXp2q8EnY78CRY/lWvj8e0W66Hs2rklPU1FJEx/FhyuheiOlocQDXe2CSPC1PlB0LUUDWRvhIsRyF0llvgjaWJutnZdDiYetGlVTp6KnBuh6am0u9sX/AEV7ZQCkAYzYBXHTHGBYWVDiOIRx8WXQ00qJfjBRJ6N4b8xU07wY9u6s9PiOp43srnG8SRjdasEtLROkkU8j7E2Cp3tLzeyq305JJslbSEuuR/amk1oZJrYUdPFtqb3VT7cTflahkHti9kySUMPxGyo2NbI30SJmoh179038QHcH+EgcSd/KZGS2NTkydkl/5T7bXUULSTcDupbEDcKZT30SxTIptuPKhdbVeymmuQSAqV99W6PdEibiieItJsAqnQ3ReypoG2FypdZAROxaI5Wpj02R2kG6QS/6goaioAHPCpSs7HRabIK2Wzfh/wCShje57TukfKJjpBSh7YRYlTVy67LlbTQha5u90wVJabEJ0lVG4D4gqWaaJu5fZPn32ieMHMqxLrbe3KdC0EkkK1/4pDH/AOYOVUU+M09gTIN1DJJfRzx5Jb0XJh0lSe8LWJurY7GIHfC2Qcpv+Itc34XKvZOP8IXX/wBHYw4ujIZyVhuL4I+r1+8LgrLS503PdQT0JeN27LOt/Zl3Eu/FJM0PmNlXT4k6R5pwQQfpXKvqMySg9iR8VGLhp30r0Ix/CaeSFzXRjjwtJ5vZe02KwvBpgbg9lmZNSSPVvE+f/HfGMjx8zoyurKGeYtgsA4/Sub+vMDqqCokLm2sV6mZ+5EMlZO+Oh8/SuH8+cnqihqZ9NGQBfsubyo99H1b4j5BW64rZzbSYg2J+mTlXSlnE3fuocd6UqcPqnf5RG6bhMUzJQx4PKwMhPej3Li+RrvrS2XiGgjlbqc26tnUdHFHTu0t+lZFSMayK54srN1IY5GOY09lUXT0R8lQro9GqOoGOiqHOaLWKk6G6iqsNxaN/ukAOHdXHH8IfK9zgxY7NR1FDMJGAixWnROMoaf08r57hoz30d0elnOeWgnp4/wAYQA4fUvSj05Z4R1VJAx9YSS0fUvDPKTMuswKrYXVJbZw7ruD0yepKWOWCKTETwPqW/hTaPCvJOAUlLSPZ3LvrWDE6aI+5cEeVsbDpoZow5q4s9Oud0GJUtPrrwbtH1Lp7o7renrKdpbODceV1eLNPWzwbneEsqk2kbBa4BpH2VDUyuZJt+ybTYpHOy7X3uPKkEBqHXC2aejhb8SUCejqyLXVxpKwkgKhp8OffhXCloXMIIHZXYxTMqytxZVukOi45VO8ku3VTYNZYhU8jfi2CJ1rQ2v22SwdlUNOwFlTQDe2/CqmAkAKpKpFn+DJTYfsqaSM3v91WPYOCoZY9/l2Qq9Mik++hkYIbYpwaSLhOZFccJdBbsArUFoljLoRrS3lKlsfBQ1pJ3CkX0GwabEJ6TSB2Q8kcFO+sjk9iprzvZMe51ue6brce6G2VpfBCbm6a1rmu3TkRtJ3cFFIijvYoaXC909AG2wTms/MFCWl8HN4H6IuRwUcJ7Wi24U0QBoIG5SoQnj18BCEIFBCEIAEIQgAQhCABCEIAEIQgAQhCAI09nyhMT2fKEAKm6z4CH8/smoAUvJFkiEIAEIQgAQhISALlA3/yHM+YJ6ZH8RuE9A4EITXOFiEAD+f2SBxbwkShpdwgB43F01zjchK7ZlkxDAEJHO07WSNFviJ2UT3/AAbIcl1uSAg7hCYImO1nwEB5JsmpW8j9UDx6jO5upFGnRAez5Qkk7IDgG2UchsFKmMbGvIamh99rJvKLnsFNFbWyGUuyZnCcoIyb22U4NxcIfQKeyCoJBJCiY/nZSVIveyp1G0PjP+FWx5vz2U7HEgAqkgNzcqpabAFRtdj1IkOwuoHOJuFI9197cKB/Fk3SHlFWB2olvlUFQwudYhXiSEPbqIVJLRm+wS9jlLRRQUbSeFWxUgjbxsnxUxYeylOzf2TZR2Sxua+EEzQIyVhPXdXNFTPawlZvKbggLFesMN/FQuYBclUrqdrs0MOx+xyT6hqjEKiCoaxzu64E9SEOMwunkaXcFepGZeV7sUgmcYb3v2XJfqC9Or8Rim0UfLT9KxsmrR3fFJSa2eUXXPWWPYVjDv8AOeLPPdbGyAzpxGnr4Gy1RHxC93LJ8+fS7X0tbLKyjI+I8NWten8tsT6Vrfc9pw0u8LHtTiegYGPXatM9KPTdnrG2jgE1YOBy5dA1eeWHuw0H8Yy9vzLy56BzSrulYmNdUOGn/Usqxb1Y1NPTe0a52w/Os6zIlH4dRh+OVXyTcTrrN7PumjpJWsq28H6lxB6jM756msmMdV54csZ659TU2Jsez8c43/1rSnXPWk3UUz3iVxv3usfJy2v6e0+K+PUUJfqWzrjr6sxWoc0yk3PlWLD/AHa+T490xuFS1k+qxO6vuC4Q2nF3DssS2/ctHsOFh01RXRB+AbBZ2nsnmvbA2wPAVXioDW2FlY5o5ZZC1qlpXsaUvxQiTitkqZ9AJNysx6F6NkxmeO7CQT4Vl6V6Vnrqlg0cldI5E5VvldFJJCCLg8LUhXtdHIc5l49VT7Lzk7kKysMcj6MncHdq6qyhyfoMHbE59MBptyFNk7l1BSUkb3QDYDstmVQpsBpDIABYK9XFxjs8I57MqyMhwj2VeITUGAYIbBo0tXNGfGc7cKMwiqgLX+pZRnhnjBhNDNTsqbWaeCuF8+s55sSqpWx1JILj9SsQyWjj7eKdu20Z9B6nKyHHg01+2v8AN911x6T/AFNwVE9OyeuabkA3cvIvEOu6mPEDOJXfNflbZyI9R1X05Xw6q1ws8fUtGnM7OczeB0m9H0D9BZsYfjOGRuZUtJLRw5Zzg3UIqXAxvB/Qry89OXrEbWQQwS4ge31rtLJjO6ixxkRNQDdo5ct/GyVNLs885Xivwt6R0jR1ksjwVeqSRxaCViPTmO01dTMljN7hZDS1rSLhasJeyOFycX1m+i+QSMPzHsqiOWLgELH58QLG3a7+FHT4u8u0lysKS+mZbj6WzJ/heLApjRpNwqTDqwyAaiqqYgC4CkTM+xOLHGUDn/moJ6gkHYKOSbSDuoTJr2UhCpNimRxKmgdtcqOKLU7cKdkDg3ZJpE8XsmjkJ2KfrB4BUbWlvKe1pB3Tow2Nk2mR1Bu3hUhbckqulYXX2ULqcON9k7060M22Np4wHbqp0Nc3hRsYW8lOfK1rOeyX00xf2FELSNxZUtdCAL91PHUA7JtRH7oSfiEabKSJm5byqarpGySWI2VfFAb2siWEg8Jn4dkM4sgp8NiYwFrN1HiNCJIHD7KuisDuNk2pLS0tVa3Era+DPTo0Rnn0ma3D5bMJuD2XDmcmV1RUYpJppzyfpXpN11gYxOnfHoBu3wtJ9UZEjFq0v/Cg3d+VY1+FHfwryr2cKYFktVVEw1UjufyrafRORNoWh1IePyrprB/TjT04DzRtB/8ASsrwXKGCiIb+HaLf6Vl24P8A6Ks6f/Ryf1D6fY5KY/8ABn/atU9f+nr/ACpA2jP+1ejOIZUQT09hC3jwsJ6kyKiq2vb+Faf/AGrLvwGv4VJUJ9nklmrkXPQ1Ejm0jha/0rUuN9Ay0LzriI/ZequcfpibM2R4oxbTf5VyFnlki/p8vcKYNtfhqycjFlBbIXjvZyHX0xodTbLHKuYy1Qb/AKlsHr/BXUM0jNNtz2WF0WCyVlaAOdSzG5REVXq+zbXp+wiOrq4nPZy4Lu/ILpaE08J9vho7Ljr0/wDTktNPE9zdgR2XbeTGJwYbSxCQ8NF06FzRLDo2rWPbgeGXbYWatG5zZx1GERyMjqbWvb4lsDMrMKlgw1zGyfSe6409QuYRmmmbHMdydrq3HKcf6Ona4x6LHmh6icT1y6a48n6lo7rDPfFquZ//ABhP/uVj64x+ermk+N3zeVhNRRz1kxJBN0yeY/8ApjZN/wD7Mr/+1zFZHWNQdz5VHivXuITs1vkO/wB1Z6PpyQuBLD91W12AH2LW3soHltv6ZFl4UPVFTUyfG88+Vm3RRbWzNLwNyFgdBgroTe3dZp0TIaSpbc/Ur2LkbZXVjbOqvTx01T1FbA4xjt2XoH6fOjqc4fD/AJf0hcA+m3HoW1tO0uHZejnpmr6etoqeMOFyB3Xc8Vkdo1cWPs0ZBmTltDXYG8Mhv8B7LgH1Z5DGpfUOFIeT9K9ZZ+kYsSwz2i0G7fC0Fn76eI8VpZpW0rTe/wBK9K4y1NI3I47cOzwezkyOkoK6Z5pXABx5atTVvSzcIeQ6O1vsvT/1Nemx9Gal7aMA7/SuFc6MuarBaiVjYrWv2XWU2L1MfMxevhpn8dDA+1+6ZV9Q+1GQ11tlbMegrKOpcHA7OVqqZ55AQq+XFSRgWY+mXNnVNWar4JDz5W3Mnepqr8TEHvPZaWwSgM9QHOb37rbeW9Oyjljdxay4XmITSbQ2NR29kPjjZ4IBI7kDuuhOn5RNC3Qf4XH+TPVEVHHCPd4t3XTOXHV9NPStD3328rxfyC+6tvQ2UWkbIipXSR8K24thjCDqbyrtg2JU1THs4bhU+NujHykLyzM5bIqsfZUsiYnV9P087SCxWPFuiaOZh/yxv9llrpGF9tSiqY2uHI5VOryK5T/2KE12aQ65yygla9zIP6Wmus8q3iZzm0579l2FieBRVUJLgFg3U/Q1LJqf7Y48LvuC8hulJdkfaZyBiWX76YXdEdj4WLdQYG6nY5uj+l0h1903SULXWYNr9lpbrllNGZAAF7pwHK22QW2Wqnpml+oqMxSlxHdYpieJspza/Cz3q5sTmut4K1Z1JDMZjpd37L0zCy5OK2bWM2yrOOwvaWFwVGKU4jLaMk3d2Vvw7B6+sqGsjB3K2/k9kxiePVMQdAXXcOyv35H6HQ4tey7ZB5Y1eJ4jGRC4/EPpXoj6U8gppzTOlpHHYctWF+lH0rzPmgkloRvblq9IvT96fYcDw+nmNI0WYPpXI8ncnFm3VTpFJl5kTRUuFxudS7hv5VjedeXdJh9BI1kIGx7Lpw4RBguHaS0CzfC0F6iupaWKkkZqHBXn2ZJbYttekee/qWw5tLFUNY225XEmZbiMTkuPqK7c9S2LQ1hqQxw5K4uzMoDLiErmjuVyOZJMyL5epYumqtzJG2WdUuPSU1MC129lrigmNFKGu8rJKSvE8GkHssedqizKsvaf0uGIde11NNdkhAUUGbmJQVAIqCLHyrZV4Q+sOprSqCXpCYyatLlF/levYRynr6dH5IZ9V9NVQB9X3H1Luz0758vqKGDXWA3A+peWHRFNUYZURnURYhdI5L5syYJ7MDqgixA5U9Wb7P6WacpylrZ6oYFmJ/juF+0Jg67fK03nz0FUdRRTSNgLr34CxrIHN6DExHDJUX1EC2pdI4XgeHdU4Vq9sO1N7hSTyN/00oTc2eZGdWS8tFJNK+mI530rm7rbCGYRO9hbYglepXqeykpoaCeWKnA+A/SvObPnouqp8WmZGyw1Hsq7s2zRpp9jV+AN/G14iHcrobInLN2K1MD/AGSbuH0rUuVmXtbX4vHqjJ+Lwu8PSzk/JamdJTA7jsr2PR+RmjXi7Xw236cshYJooXyUncctXXHQuSOFUdGwyUoFmjkKz5I9Ax4ZSRXiA47LeWH0kcVO1rANgF0OLx6mvherxIvoxGLK7CAwM/Dt/wBqSbKTBJeYG/7VmhaG8gXSe60dwtqji60iRY9cejA5sksCeLinb/tVkxbJTDoSXxUw2/0rbPvtHcJJoIqmMiw4VtcfCPweqIo1VgnQ0OGvGmG1vss96WgbGwMA4CqKjB2N+Vo47BMp2GiNx5VqvGjFfCWMEXOr+FlgeysWJQPkJLVchUGYb+EySD3eQrUK/Uk9dFqpKeUPF1eaZxYwApIaANOw7KoFKQ0E24T+0N7HwWIuQpA0DgKmc8wC106Goubk7J7+bZDLeyoJ1cqkrWEHbwqttncFMmhLzb7KpYP9dluBcHCwVVAwvFyntpADuP7UjGFpGyhi2O9dCxDSE/W5IgkDcpd6AZK3Ym6pntBdwp5H32uoXkgnfhRym0MlPrSHh2gcoc82uU1guTdOcz4Lnwmzs2iGEXJkZmdcgBMmYXi905zmsUMtW1oVdyL1dLZCIDG/XbvsoqslxJ8BJUYrGzurZiHUMELXFzk+u5L+mlRi2SfSDEK80rC5zuFhnU+ZcGFhwdM0W+6pOv8AMakw6je73bfCe65Mz19RMeHSytZVkWJ+pOlkxT+nXcfwtk0pSidHVeeNKHlgqW7f6lPh+cDKv5J2/s5eedf6rmRVTmvrzsfzrM8uPU7TV8gaa0m9vqUMr4v+mzkcK/w9I74wjrt1W9oEvP3WWYPib6oNde91y9lRmtBjM0bRMTf7roXofEmVUEbgeQovyezOPy+Nsqfw2DQMD2XKnfEC0hUdBU6Y/wBlLJWbbJyjtGP+OSlpFqximLnEdliXUnTrKxhu3lZtV/5wLirfU07S0hw7d1TvpejVw82WPNaOdM1MrqetpJbwXJv2XF/qQyRjd+Ie2kPB+lelPWWER1UT26Rv9loDOXK6PFaaYCAElp7LncvH/qPa/DvJrISipSPH/NfK92HVUgbTkWJ7LVdZhTKCY6m2sV6EZ9ZCPa2aZtKO5+VcWZt9DVWC1so0Ws49ly+ZBpn1B4v5B+SMezA5cWZEPbBVprqh1Q7Y8qixKeWGtdE53dVlBCZ3DVus1s9Zw7llRRTVGEmeO+jcrHMdwMsDrs/pbLpsOjEHxN7KxdT4ZGWuLQFLVNJlHlMCMoPo1frkw2QvYbWK2bkvmtWYVikTDPYAjusGxrBnO1WH9K2YXLNg9YJASLHyt3Du0zyvmuGjOL6PUn0v+oswR00UlYO31Lu3JDO+PFaeJv4lpvb6l4Y5OZ2TYLVQxmqcLED5l3t6UvUAav2I3VZNyPqXU4ty0jxDyLg6030es3R/U4r4WuDwbgd1n2CzCWME9wuZsjMxIsWpIv8AMuS0d1v/AKbxhkkDLO5C6fDsU1tngvP8d+Cx+qMyglZqsFXRkFuyx2mxC7wL9/KvVJN7jOVqwaaOJyKXH6LMXOeQEyxGxU0Ya6S5SVDLvuLJ718KGtMSNoa7ZVDHWGx7KBjg1tintN7FROA9fCYDXymuA4KAQeEJVFMjkAAHCEITUmmCnoEI/dFza104X2BIWh3KVCf0hjkmRP4/dMAubfdSHY2QBcphE/g32/unAWFglDD3TwLCyY0EY7fYjRYJUITEv+kumCkbwP0UacHgCykih6+DkJA4O4SpwoIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAEaez5QmJ7PlCAEfz+yanP5/ZNQAIQhAAhCEACHNc4bDuhPZx+6Pg3+jYmlvIT0IQOBMLXEnZPQgBlrEXTrtHcJH8/smoAe4gt2KYeDZCEjAj0uc7fwnuFm2CVI75UwZLYM+UJUjflSprQkexWgE2KdpaOyaz5gnppINfqvtdNUiY7k/qnR+iNbETZGlw2TkJ8fpHIg0OHZNLXaDt3VRoamEWNlPF6RBNEUYeDsp2uAFimpLG/OyVvYxPQ2YFx2UIhdexCqUx/zFMb/AISRCJobtbsp28D9FCzlTN4H6KJ/7Ey+AdwVE+NztrKVBNhdIO3pEUcbwbEGylbDG4XIQnMO9lJ66WxPbsjkgaG7qknY6/whVxcXcqmmT4rZLCLZSPa8NJKt1bR++74m3V2kbdhsqYix4TLK1JGhS/QxvGcCpZIHNkiButVZh5bUGKNe1lK03B7LcmLt1McFjtXhnvuOoXv9ljZVMd6On4zLlS/Zs4gzz9N8Nax8jMNBv/pXKeafp/lwsSvZQFtibWavVzrjoiDEaYtMIP7LnzOfJOKeime2k3IP0rnsqppM9E4blIysXZ5TZg9OV2A+5aNzdI8LRnXPU+JU8jmCZwsSvQHPbIuQictpSNj9K45zYyfnoqqQ+wfmPZcxkxcT3bx62m6MdmiZ+q8QlnLZJ3HfyrxhFXJWNGp1yUzGein0lQ4llrHwqvA8P/CWv5XOZMv7/T2PiXCEU0XvB8NOrW5quhp/bZcN2tsoMOqomgByqpq2J40gqjCLkzs6L04FkxUuc8gp+CYaK2oEft3N1XjDfx8lmi+6zHL3LqeqrmO9kncdls4tf8MTmOUjjQemZRlHlfVYhUxPbTEg27Lr3JXKp9JTRPfSW2HZYz6f8rHmOFzqU8Dlq6j6R6RiwjDmaobWHhbUK1rs8W8g8kla/RMXpqhhwWlAewNsFiOcvXlPhmFyiOcAhp7q/wDWnUMOEwOu8NsPK5iz/wA0YzTzxMqR3FtSW1+sNIy+I4mzkL/yyRo/1G5szy1FRG2rPJ7rl7qnqSbFahxdKTcrPM4MdfilZM5sl7k91rFlBJNU3I+rwsmy/wBWdn/+tShDeiw4tFKGufurXRY7W4bVtfHI4WKz6u6cZLSkhvZYxiXS5iGoN+/CWnLakYXIcElB9G4Mhc6sRwqqj1VzhYjuvQT0tepqFj6eOpxHsL3cvKbpKSfDKoaTaxXReRvWmI01ZBoncLEcFdLhZb0jyLyLio1t9HuZkjnLQ41QQP8AxYIIHdbuwPF4sVhBpn3Xmn6TMzsRqoqajfUO3IHK7+ydxKb/AA9kkjr6gOV0uNktrs8V5eCosaNgVLJBHYg8Kmp9TZNR8q5vidURhwHIUD6MhtwFbjkLZzN021ou2Dv12srlKf8ALuVaMGLomi4VZJUvd8IViFyZk2xk30Mnl7X/AFTKflMlY9xvY/wn0zXg7+fCtQtTKv4pFxpmNtcqVwBHwjuoIpLCx8KogINlNGW2SxXqDWW3KDI1psSlnfpG6oqiY32UsJJISUdsqxI0mwKd7VxcBUVNIS65Vcx5spG+hyjpET2vAuFSVJdxdV9wBuoJomuuU6L/AOjlHZRwOLXfEVXMc2QbKnfANVwpINjZOa6D1KljI9O6jn0Dt2Tzs3ZRvbr3J3UaWmMlX0RPe1o+ZU7tTnWUroyT/wDqQ2Mg/wD6lDOafRA49kD8NiqG/wCYxRHpygLtRhaT+iuAs0WJSPeALg91WlGMhjjF/SiZg9Iz4REP4TJcGhDrsiVa2ZriASp7DRflRfgjJdDPxxl0W4UMRbpLAqWXA6aQnVAD91c4wS4pz4x2Kq2YkWu0N/DGX01/mFl/S11HJIKVp+A9lw76uMvqeCKYtpQLauy9Gccp2S4dI0j6CuLfV7gLnRz2Yd9XZYfIYKUeiG2hL4eVWdeAmCtlZHHvqKxLofomtxCvDmwEjV4W9818vaiuxWRwicbvPZXDKjK72p2ukpza/dq5O7FaeilKpaK3Kboeow2mZNJDawHZbQpOs29Nx2dKG2HF1cKTp2HCsKuIwLN8LTubvU5w58jGSWtfuqE6tMqyjov2ZedEc9O+NtXvYjlcz5o9ZnFKl/8Am3uSn9VdZzVcj2iY8+VhGJvmr5C4km6gcWivYnos1fC2qeSfKigw2Jh1FoVxkw+RjS5zSrfXVApxZQzTZjZEWydslLALGyjqK2GQabjnZY3imOuZJYPKjpMWdO4AuNv1UWnsyLa5JmV08LJWamhVWGF9PPcbbqiwSYuhF1dKWPXJe3dXsXaYyEH7G9/TtjT2YnA3Ub3C9I/SdjM720oa89u68y8hGaMWgN+4XpP6O/jFLq7WXZ8ZY46OiwK/h2/0rJJNhzDJ4Cd1LgFHitE+OaEEkdwndN6WYcwi3yhXORsUrdJPZehYWQ/SL2ddVSnSjkL1M5HQ4tBUOp6AG7Tw1ed/qO9KeJz1E8seGOtvw1e03WHRlJjFO8OjBuPC0pmR6b8PxuGS2Hh1wfpXS05/X0oZWJtbPn9zQ9OOKYdUyXw5ws4/StWY3lpUYUHe7TEWPheyvqH9HcNMJp48NPJOzFxbnb6a5qD33MonC1+GK/DJVqOetw+/hxRRYe2ils6PhX/Deq48OIAcBayyPrTK6twqd4EDxYH6VrPHsGxOkmJDXc+FQzMRXQZVnitG8cv82fwjov8Aibbjuuicqc7acxsDqsdu64KwOsxGl0gudstoZe9aV1G1rXzELyjyThPaLeinbjtdHox0XnBSTsDRVDjysirOtmVzAY5gb/dcbZd5kVIc29Qe31LcXSnXn4prA+a/7rwrmuHlCbKFlBtmPGKiSQEPJVdHWzO3J7d1iuB4xHUgG43WSUs7HNvtsuNnx0ozKU6C4iocYLFY31VicFLA4yW+VXOrrjHG63hazzQ6hligeGOPBXY+PY81aiBUbZrfOLq+njbJpkG1+FzV13mJTNqJGGUc+VnOcHUNZL7rWvPJXN/WEeJ1uIP0l+7vC+hvGqn6IuVY7bL3ifUIxNx9s3v4KoKfo6sxyo/yadxv4Cl6D6SxHEKtkMjHnU7wuqcifTr/AIvJE59I5xdb6V6fiv1ijdxMV9dGnsrfTpimLVcLjhrjcj6V2v6YvSjMx1O+owo/ML3at2env0d08ogldhp4B+RddZY+m6kwCGNwotNiN9KmvyEo62dPiYzRj3p/9PUWGRQvbh4GkDsuq+j+mKTC8MZC6AAhoCougOlqXCoBGIgLDuFlYha0XGwXK517kbtFHfwwLNKRuH4fK5gsA0rh/wBTXW3s+8x03nuu0M86kxYdKAfpK87fVZXy+9OGuPJ4XGZs/uiLKq6ejlfOjqptdUTs9y93Fc9dZs/ETvdzutm5nV0oqpi531Fayxedkz3XPZchm2aZyubH1MGraRwmuG91csE1CzXKerpGPfsFU4fQAEOA79lgWzeznLm2y94dTRPYLgKapbTwsuQAqKOsbSs0k2VHiOIOmadDiqsm2QL2KmfG46R143AK69M9eSU9Qw+/9XlYJWtq5HXGpVWBYZXSTNeA610+htM0cKEnI7L9OOb0lNWRB9Xtcd16C5DZw4fVYXFHPVNN2C9yvJLK3EKrCJWPc8i1l1Pk5nNLh7Y4nVlrAfUre5M6XHqe0dnZ31FD1Lhcns6XamHhcP5yZNzYrisj4qIm7j2XR3S+Y46mgZAZ9WoW5WV4dk0zqpwqBS6r+Ap6oybN6irRyNk/6fqyDE45XYebah9K7n9O2WMGF01P7tIBYDkKu6K9PkeHSMJoSLf6Vt/o/opmDxxhsdrfZdNx9TbRqQSUTMukMKjpadrY2W4WWQF7GgfZWfpuMMaGq/Fgc3n9F22FQtIVzKaulkbCXNVqGIStdZxKu1QC9hjt2VAcPBNz3WzGMUiJ2pkP42aQ7E7q5YdJJtqVNFQBrr2CuFLEGgFD9UOVu9FSWsczflUFXTuc/YbKva0O7pJIm2/VRLRYjIoY4mxt3sqiExW3CZUREHb/AJKAFze/9JxNr27ZXtLe2ybI87gf8lBHIb2DlMNwk0HqU87XOduE2NpYbqodGHG5UTm6U/prQKuLZPA/cElSu3N/KpWOsBYqRs1tiVWnHYji0yYC/cJjpWNOklNM33/pU8xN9V1B6oT1f0qmyNdwUaXEblUcc+l3KrIpvcbYI0iOSe+yGV2kklROkab/ABbqSr1b2Ctcs72SbqvJbZXcZexdISPqKe5wLbAqipJ/d2uqpvATZR6LFUdFFW1LYbhxVmxDFWgfA5XDH2bGxWGY5iX4KNxc7hVLG0jfwKVbJCY51ZBSMdrlAI+6131nmzR0Ub2msAsD3VhzM65/BiVwl4v3XLmeOeUmFGZ34u1gfqWZdk+nw9T8d8bhlST0Z7nVn/SwUsrRiA4P1Lhb1GZ8ipmnMNf9R+pWvOf1JyVRkiFcO/1rmLMXMaoxqWV3v3ufKzLOQaPY8LwtKtP1Lj1PntVU9W8/4gfm/MswyX9Rkja1jZsS4Ivdy5R63xmrM7i1x5VJ0N15WYZibdUxA1eUynP95fSLM8YVa00e1HpVznhxepp2/jQb27rv/KHHmVmGwyiW9wO68SvRLm68YhSh9V45cvWP03Ziw4hgtO0zA3aO/wBlsU2qTR5j5Bwn4lLSOpcPrGGP5lVOqIy0fFysRwfHo5orh4/lXWOrdKAAVuVakeV34cq5PZfYjFIzbmyhrKE6CdPY91HQPcyK6r4ZhUR6LKS2mLiZVq9H0YbjdGCSC3krDuq+mYqulk/yb3C2fi+ENcddljuNYc32XNI7Ln8qhKTOi4fOnT66ZyfnLlrFV0kw/DA3aey4H9S2S88k1Q6mozyeAvU3MzCYXxPYWdiuVc7+haKWOaV0IN79lxXK1KL2j6T8G5mdvrGTPJfrnLPFsLxWQvgcAHeFb6KE4eQJm2I8rqjPHoaljqpnR0w5PAXNfXeHPoalzWtt4XOS6PqHx7LUoLbEixiD29AI/lW3EdVY8taLgq2Uz5XPsSeVdKJ4EgDlHCT2ddkelkC04hgJdGXaP5WFdU0P4QkhtrLa9Y+D2iCsD64w0VDXGMLWxrGziuVx4+jMAocfrMOxFjo5SAHLrj0hZqzU88EctUQQ4clcox9L1VRUi0Z58LeXp3wCvoa2ItDh8Q7LpMaxpLZ4R5PGMVLZ7CelHNCOoggD6m/wjuuyuguoDX00To33uOy80PSnW1dM2na95GwXoFkXiL6ilga4k/COV1GHc1BHzn5F6u1m6KB0r3tIKyigc+OIFx7KxYNBdrSRysgZHaG/2W/RZ0ea5sk56EFb/m6Q7upzMCBqKs5kMdTz3VcyQyEEq4p7MaX+xWNId8qlZG6wChp+f2VTG4825S+zBfAaxzRuEmtvlSkXFlA5ulEXsikw+I77pWusPiKVvyhDm6je6aRBral5Tfb+6cBYWQAE2F1GH34cVIRcWUQYWm5/5JW9gLYkpzWW3PlK1oG/2UjD8KQf6oYhK5obwkQ+xUkmCEITfUkBKGk7gJE9nyhOAGAi9wlQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEARp7PlCYns+UIARzSTcJqkSaG+EANZ8wT0gaAbgJUACEIQAIQhA3/yBCEIHAhCEACEIQAIQhI/gAozypEmlvhNj9Gy+DE5g7pdLfCVK4gkCEITdaHAhCEJANc08pqkSaW+FIhrQxFgeQnPHgJqdH4RSQWHgJhs75Qn2J4CQNA4Q2IodjCLGxSObqN7qRzQdwN0jW25CjbQ71G2A4Cez5QjS3wlAtsFG2KloEEXFkoaTwEm52t/SbvTH+v/AEEJWtubFDwAdgrMZbQ310xjngiwCY9uptkqBueE9dE0ZKJF7LlHLTi3H6qr+HTva6idGSeE2cuiRXLZZ62hMhNlRvw3Ty3+lkRiadiP5UNTSxkbALPuj7dl2rL10YjieHxlnxtCwbr3pqmraKRvtg3B7LZ+K0rXiwCxzHMHE0Dmll7hZGTVtHQcbnOu1PZx5nPlXBVRzFtMNwfpXGGe+TftOleKUcn6V6idfdFxVUcjXQXuD2XM2eOULKqCRzaPz2XK5dHTPdPFOf8ATSbPKPMroCShqpD7XB8LXtZh76KQi1rfZdm555QPppJ3CitYnsuZevOkZcPmkb+HItfsuUyKP20e+cLzsLIJbNd1OKPptgePukpMaknmazUefKhxnD5myub7ZVb0d0zUV9cxohJufChpx9s7Vc3XCnezYWWvT82Lyxt0XuQupMlMnH1UkT3UwN7fSsG9OuUc1XJC51ITuOy7myWyjioqSOR9IBYDstzHo10ea+T+Qxkmky75O5ZU2FUcT304BDR2WZ9VyUuD0DrWFmlXWCmgwOksQG6WrUed+ZlNhtNMw1QFmnutCfrVDv6eY4Nd/LcitfNmn/URmnHhscrGVGmwPdcXZsZqzYjUysFQTdx7rPPUzmoaqeVsVXcb91y3jfUM9fWuLpSbuWTdcvU+mPEeEhXTHaK/EZpcVncXG9z5SU+BiMay1GBETO1O3V7lEbYd9lh32Hd5XHUxh8LHVlrGlhGwVixV8Ml2CyvWLSNN9J3WOup56mtEbWE3coqZvZwfLYUFB9Fd0r0pLitUPaZe57Lo7IXJfE6ushcKdx42ssSyBy4mxWti1UxN3C+y9CvTBkTTiOCaajHyjkLosKUto8D8qx47kXr0s5PYjh1VTSPhIAcOy76yywYUGHQseOAFq7LvojDOn4Y3tha3SB2WwW9dUOERCP8AEtbbbldNVOVcez595vj3k3tV9m2IZ6eOAAkcKCavpr2uFq2XOShDNJr27fdW6bOigDv/AMvb/KtLJOfr8cy5PtG56TEacNI1BVENfT67kgrStNnTh3avb/KudHmzRVR/y61p/dXab4yGWeO5Mf4bd/GU7j2SioiO7VrnDuvY6l4a2pBufKyLDsadUW/zL7LSpmn8My/ibKP9kZJJVgDYpGYq2LkqjivIwH7Kkr2SM3F1dizMnSol7GJiqFwUbybBWTC5ZAfiKv2HMDzcqRS0UnpMWGJzSFVtcALFLpba1lFM7QbAqSNgLTQ57u5ukDg7ayja5zuSo/dcH2v34Uqs2PT0ip0g9glLNO9gkikaRuVM8gjYpfca5NEQaTuAl9s9ypAG6fuonOIdYFI59DXIDFY8BJpAPCkRcHa6rNbIvTZTyxudcjwqWYObtp/tXEtaeyhfSh++lCiMcXst7tbTqaO6q4JHOgNxdElKBcFvCfCxjG6SFYjX0J6kUFw83HdPsXO2U7Io+bbpwiYDeyZZBJB6FNXRF9K4W+lc+5/5bS9RxSFkN737LouRgdGWEdlZcT6YpcRic2aIG/kLMy6vaITj0ebPXvp+lbWyOdRj5j9Ks+HdBxdPXL4QLDwu7MwMoaKoMkraRp57LnjN/L9+F+77NNaw7BcvkYq+mfbDb2aI6uxuKkoHwtcLgELmbOQ1eKVEhhvu7suiOtOn8QkmfF7TrbrBpspqjFpzrpHG57hYV1BQnDZy3J0PilTK5xjPPhVlFltWkanRHb7Lqeh9Pri3V/h5/wBqq5Mh3QQkig7flVOVJBKptHH/AFL0nJh8Drx/0tcdQUMxkc0Dyuv8y8malkT9FCeDw1aT6mynrIKh16Jw/ZQunZRtx9mhsQwCpkOrSf4T8H6fqDKBoPPhbOruhpKU2kp7fqFSHBqehOtzAFF+BJlCeI2ygwnB3QwNLh/KuVBSH3P3Tm1kIj9sEcq59O0Lq2oDWsvc+Fapq0yt/j+rNl5GQPGKwgeQvST0cwSFlNt4XCmQfQk0+IwSCnO9l6Nekzpc0ENM58NrW5XRYUdNGxgw00dXdPxvbhjA78qqyydr732S4S1gpGNHgKvcyJrPiHZdjiOSijsKKv0RTwD3Phenz4dTSN0viab/AGUElVHDJsVUR1kUrdzv+q1oWNIWylP6auzlyyoMaw95bTsJN/pXIOdXpqZibJxHQNOq9rMXoNiFFT4jGYpGg/qsTx3KrDcT1aqVpv8AZaGPkuL0ZFuL2ePeZ3owrKuWV0WGjv8AQtDdeeirEadz3/4bbf8AIvc/G/Tjgtawk4cw3Hdq1RmR6TsMnif7eFM7/St+q+uyGtlG3Ef/AA8Osb9L+JYY93/BEWP5VbYMoMTw6TaAjfwvVHMj0kxMkl0YUO/0LTfV3pffSSu0Ybbb8q5fnFXKDRlXUdnG/T/T1fhJDntIssz6f6llw97BJIRb7rYvXOUEmDROP4bTb7LTXWMVRg8pDbixXinN01SmzMspN4dFdfQuDGGX+1sjB+oG1cYLH3uPK5A6P67qIK1sbpzyt/ZZdTGvhYHSb2Flw9uJBz3oqTobRtaWf3YCPIWAdd9OVOJhzWNvcdgthYDgtViTWGNpIcsvwXJ6qxWxfSF1z4Wvw1UI3IjjjLZxz1FkDiePvdopCb/6VjEfovxatrQ7/DSbn8i9M+hvTJFWuHuYcDfy1bT6c9IeFODHvwpl/wD0L3DgpxjWjVxcL2aPMHLX0P4lDUxynDOHD6F196fvS7PhEkPvUAFrcsXYPTHpZwahY13+FsFv9K2D05k5hOFAFlG0EDsF2McmMV0dJiYWjHMlMsaDB6OESU7QQ0fSttx4LRQ04ayNotwbK20OHRYWQyOOwb4VY/EtLdJ22VTJtlZLaZv4+N6oqaSBsTrtAH6KZ84Ac0qkpKxrr72CKmbUCGuWLkycmXo1eprvOmmfW0UrWj6CuDvUx0FWVRmeIidz2Xod1dhJxCF4c29wVzxndlnHVUsjjTXvfsudzItRZUyoJJnkhnT0fV4fVTOdGdnHstH45HNTVLmnsV3d6mMso6d1QW0vBPZcZZlYH/h9ZKPbtYlcZmr9jkM+HZiNOx1S8ADurxS0bmR7jsqDAXRCaz7XWUUlNHUDTG3kLIde2c7ZVuXRimKiYS6GeVcemek6zF5gwMJufCyfD8v58UqGltO43dtst2ZL5ET1U8bn0B5HLVLHE9xa8b2/hrHB/T/XYnE17aQm/wDpWW4J6cqumgDnUVv/AGrs7LT05xSUsfuYcOBy1ZxN6c4WQWZho4/KrFeC0zZwcTUjgGfKmuwgEtgIt4CrenaDF6KsaxgcLFdedZensxtdag/+KwcZImmrARR9/CsRw9s6KqnTK309R4hNUwMmuRqA3XfORGAUs+HRmaMElo3IXKuS+Xhw+riJp7WcOy7Hydw59LRxsDOwV6jCezVpr6Nh0/TdDEAWRN48KGrw1sXyNGyvtLFeNoI7JJ6FjwfhG66TDxfXRZlH9S24M0sd+6vQdZoKoYoGwHYKUyvPw+V1WLHUdFWaeibY7kJr2A7gJYGOcL2Kk9sflKttkPqyCwG9lGaz2+CqiSNobsqGojcXWAUT2mSQi0yrirbi9/6VVBOJuVa4WEG1uFWU7yzcFRuSTLcdk87RYqilicXKsuZO/KT2fuj3ROnpFMxhVSwEgAJDFp5T2aQ3n+U5THOfQx7vb5UL3BzrhLVuOq10RN1Dj+VJ7RS2OTSEax2oOtsnmIv3GykZDwpNIaNiq85iSmU4gJF1BUEsBb3VWXht7H9lR1Tg4mxTXJAm2UZlc2SxO11WU1WBsSqKeJ3IUWt8XdNk9onjR7/S8zTxvYrdPoe+wsqZ9bIG2DiqaSscw63P/VVZvRLHC2XeniDN1VCZgbuVjTuoWx7GThRf9526tPvAqD8i3oljx1n8RdcacHNcLrXHX5fHTuLT54WVVuNGUE+4OPKxHq+Q1NM4De4VTJnpbN3i8aUbEpHMmeWMz0kM7tZ791wV6o+vKuI1AbI4bHgrvbP/AAKonpagtaTyvPb1UdL1eqpOg8Fctm3tfD6J8Hpr3FM4wzJ68r5sTewzOtqOxKxvD66bESdbib/dV+YuBVUWLOJYfmPb7qLpTC5NQ1s5K5q/Jk3pH05xuDTZjrr+Fk6k6ckqiSGErF5OkKyGqD42EWd2C3X/AN3Y5gC5o47hW7F+moKcF4jH8JMfKlGWjH5jiq+3oyX00dT1HTOI0/uSkaSO69LvS56haemoqaF9buLbal5PYfjhwGqDo5NNvC3Zkbn5WYfWQQivIs4DldJiZf7I8Z8i4V2JtI9wcsM26fGomBlRqvbut0dOYmyrhY7Ve4C85vSXnHJjDIGvrSSbcld3Zb45+KoYX+7e7Quwwbvc8K5ziZ0OTaNpwvaKXY9k/DqsMkseFZqTFNUIbr/tTwVIb8Rf/K15ySicDbiy/pesQqGGG58LGsclYY3n7J2MdQxU8R1SgfusF6zzMw3D6R5dVtuB5XP5sktsvcdg2OS0YnmvikFHC97ncNK5NzwzIoYGTRaxye62XnXnfQPgmjbWt+U23XF2dHX0+K1cwgmLruPC4vPj+T4e4+Hz/wAVrZiOaHVdJi9XLG1wNydlovr/AKXdiUplhjBH6LYDMJxfGsT2ieQ5yzGhyUrq+kEktETcdwsGzH6PoHgufUNLZyu/oyopXEujPPhW2tgdQym+1l0T1/lgcEieX01rfZaGzAiZQyv2tYlVfw/to9Gx+bhbDtmN4hjLmnSHf2o6Wkfi8gYRe6tTHvraz22gn4uy2rlLl7Pi1VFelJBI7LRxaWpGNy/JwVb7G9C5Jy4zJG9tLfUfyrofJr021bJo3Ci+ofStk+nrIZlY2n10HNvpXYuU3p1pIYo3Ow4duWrpcap6Pnfy7l4bl2a5yNyXr8KbCfw5Gw7LsXJXp2bDqeH3GWsBe6f0Vk9SUMLCKMCwHZbEwXppmFRNDIgLfZblP6Hz5zOdC2x6Zk+DuaxjWkq+skEkJaPCxSjme14FismwoOkZcraxpto4rLcXLZRyUjnVJNlXQUxa0Gyq20jNV7BP9tnhaUdtGZ/5EUcZYblTsNrH7JpaDwlBA+Hun6aFHF9zsUiEJUmivMEJzWgi5SOABsE/fWhvqIg8FCHcH9Eg19DLnyUC7troaLu3T1GOjHY9nyhKgC3CFISL6Nk7Jqc/lNSpD0gQhCc1seCezj90xKHEcFMGyHoSMJN7lKgaCEIQAIQhAAhCEACEIQAIQhAAhCEACEIQBGns+UJNB8hK0WFkAKhCEACEIQAIQhAAhCEDdfsCEIQOBCEIAEIQgAQhCGAIQhNSAEjnFvCVI5pdwnAJrPgI1nwEaD5CNB8hJpAGs+AjWfARoPkI0HyEaQCtNxdKkaLCyVKAJCwE3SoQJpAo09zS7hNLSN02T0LpCJWt1C90iVrg3lRtoPURCc5wIsE1N7YeoocRwhnzIaWgbhLraOAkUJNgOsL3SFodylBuLoOwurCWkJtEWgJjrNHN08u0ndRvPwqVFaybQmsHm6Uy3FkxNlNm3TWtJkP5JEdTUaBsqOSuLiQiqkJJVK2+vcKpKKLFNjTJJGOm3AVHW0ephFld6WNpbuEVVIA0ut/aq21x9TZx8hJmu+psFbKXAt7LWXXOX0eJ072Ohvsey3pi2GioJs1WHEOnmSMIdGP4XOZVCk3o7TiuXlj6ezg3PfIZlRHPI2lO9/pXGWdORjqaaZ4piOey9dsyMvoa6mlBgG48LlDPLJM1TpfbpRvfhq5fJwrPdnsXA+UJRTcjzDxHJyWprnRiB3PhbAyj9Pkk1fE40p5H0rouH0+Sf4kSaQbu/Ktt5S5BR0k8c0lM0Wt9Krwx3D6dvZ5Up0aiy2+n/ItuGwQPfSna30rpXp/AYsGw8WZazfCTpjpuiwCja0xtGlvhQdY9aUOE4fJd4G2260qZV1rbOJy83J5G70XaMCzpzKg6bopSZg0gHuuGfUP6hn1NTPCyr23HzLZXq2zhL2VMUFQe/DlwFmn19V4li0sfuOOonuqebdGS6PU/DuK3KOkPzG64lx+pd/m31E91hn+HSP8A80tVRh9DPWuE0hPPdXh1ExkGgDgLn7ZyS0fRfEUTorRS4IDBYK4V9aWxEE9la5ZzQOLrbKnkxN9dII2juqE1KxmllXSS7Kuio5cRqdAaSCsu6NyvdiOIRvMRN3eEuW3Tpr6ljTHcn7LprJzJ51bJDL7A5v8AKrWPjTbOE5zNrhW9syD035QwUb4ZZIeLchdw5Q0lLgtHEA0CzRcrT+XfQIwKlY72wLAdlm0/XlN0zTESSAaR5XR4kVU02eC+QpZ0nCH9Nw9QZl0+CUJIlA0t8rQ+aPqsZhE72fjgLH8y1xnL6j4qaCVsdUdgeHLj7OXPSqxaokfFVO2vw5XrMhSZjcb4lCce4nXmIetUMLgMRbz+dWSu9b7Inm+Jj/evOzG87MShlew1T/m/MsZxbOXFpHl7at/+5NjlRNmXhsYx36nprS+uRrpLDEm/71n+XvrGbXTNa+vab/614/0edmLRzajVv5/Mto5V5/Yg2pYHVb9rfUtHHyYy1oxc3xeMItKJ7RZc+ouDE5owKxp1W+pdDZe5gMxSJjhIDf7ryByIz+lNZT+7WHkX+JdzZEZ70slNFrqr8X+JbWPaeb85wEq09xO6cFxJs8bSSOPKrKlrZRtutSdBZsUGIxsYJxu0d1snCsdp6yFrw+9x5WnHKhFdnk2fx9lU2kVdPCY3DwrvQVDYxcq3wvjmN2n91UsiLRcHsm/5MW+jnrKpqRdWztcLhMfG6U8qiimLCGkqsjqWtHxKeF0WR+skK2Bzef6TJYfiLgCpWVMb+ClkcwNJKsKfQmpIpjKI9inRVVzsVBVNLz8Kji1MO6cpbI5Sa+lyEt99QSE6jdU7Z7NtdPbKXCyctsgd8W9D3VGgbqL8aA+5Pfwo6i4BKonykPI/6pf1JE/ZbLxFN7g2Uh25VBR1AZa5VWJxLcBSQihdobVv0suPCt7q6xsVW1TSWHfsrXLA50hddWFpICuhqy9+yrWEll/srVSkNIJ7K5QVALbEKO1ey6HKDYj6gtdoKHOs2/kJssXuSh9trptXP7TbBZ9kZ6CUXFbKDFqGOrhcxzLrT2aWXMeKmS0XIPZbnbUNk2IVuxLBY66S7mix+yysjGk10UJpM5Ixj06Pr5i8UR3P5VBhvpt9me5oj/tXXcHS+Hxt0uhaT9whvSdA2T3BC3+FgXYVm30V/wAEpHNVF6fYmQ2dRf8AxTKrIGJ7NApP/iunv+71LosIW/rZQnpql1E+23+FnSw7Ex3+HYkca9Y+lsYhE8ihP+1aTzP9J7cOhlm/AkWH5V6Z1HTNA+ItdA2x/wBIWuM3sraLEMLmkjp27sPZRvEmiGeLKP08ec1Mpxgsj/8AIta/Zc95gudhUj2DaxK9DvVFl4MLdMWwjYu7LgjOvAaj8bK1kW2o9lFLGn/wpW0I15g2LSVlYIi47uW98leiHYxURksvcjstK9EdMVUuLNBjPzrtP0s5dyVU9OHQ8kdlNVjT3vRRnjyk+kb59OGSIcaeV1MeB2Xa+T3QhwSnhtFYADssU9POVkdPh8MjoW/IPpW/sLwaHD6ZsbWAWHhbuHjyRcxcWcZJlww5uiNrbquqQfZ2KoKdha/V2Vb7ofGGfZdLjw1E6Sh+i7LTURvdIR/0UkDXxcnkqsdRAnWVDO0tNw3haUYrRNKSa0TU5JdclVDXjVYjlW6Kt9s2KqI6nUdXhGmpdFdpFVM2MiyteJ4HSVrS18YN1PNiJYd2p0VY2Zt7WViFyqe0yrdFTRrnrHK/DKwPcYB37LSWZ+VmGUbJHiAcHsuluqsRho4Hve4cLn/OvrSgjp5S6YAhp7rA5jkVKLWzCyYKJxrn70zRUkUrWRAbnsuNc4MNYyomLWjkrrL1EZi0MkksYnB3Pdcj5m49T10koa8Ek+V5Tyd0rJsx7fVyNWQTOosUFnW+Jb2ycx5xfE0v8d1oeqp3TV/uN8rZOV2M/gaqJr+1lzkvbbIvRM9AMhcLpcapYC9oJIF11TlrlPQ1NGyZ0A8nZcbel/reljZTe7MANu67tye6ywqpwuKMStJIHdXOK3/kLYtOP7T0Zj0z0Bh2GkFsQ2HhZnh2G0cDWgMGyoMKqIaoaoiCrvDC8AOaF7FxFqVaR0eJiqOtFxpYYtNmhVLIGgfqFSUsxiZdwU7K9jjpsuj/ACNo6KmqMYkNRRNe4kKiqsOI4V1a33PiB7KGpI3af5Su3a0XY6KGkoyOO33UzaZoP3KdE4MJ2UkcZfJqvtdQT1Ik6Kaqw0TxuBGy11md0jHV0Tx7fI8LawjGjSQrJ1PhbKulddo2HhZGbS3FlHJ7ied3qeyw9yCod7J79l585+dBuo6yYtjIsT2XsBn/ANEtxGnnY2G979lwH6lcnZ2zTzNp9rH6Vx2ZjScjlsyvZwPPTT4dW6RcfEs+y1webF6mNpaTc+FD1z0VPRYm4ezazvC2L6eumvxOKwQvi+odlQrxJN/DFdEnL4buyL9PZ6g9iV1KTcj6V13lH6XGUMTJfwJ2t9KuPpFykp6jDqaZ8A4HZde9O9EUWGUjY2wN43NltYvHzk+kX8bCnL4jVnSeUdPhsLGGC1h+VZUzLailhsYf/is/kwOJgBDAP2ToMNA2WhLjZJfDbx8OUGaa6pyfpKphDaYG/wDpWDVmQTJKgubSHn8q6jkwKKdtnNH8JjOlKMOu6Nv8JiwZL+GlGiWznvpPJp2HTtd+GIsfC3V0F05/h9OG6bWHhZAzpyhZ8kY/hVcFNHSNs0W/ZW6cZx+lyENDowWmwSTz2unPnZbYKlmkEjrBa1FaRI49EjWGXj9k5tMQ74lJRt0jeynkaCNlq1NKJDKMf6MaAxmyPc+ySxB0kpTpaflUm0N/F7EcoLtrKF1O43uP6VY1oeLoLAHabD+ExzXwd6JFCISOApIwQdx2VS+NpN/+iZZt+P6VeViZJGIRdlIdhdI1oAFgmPfvdRuxfwcEsnw+N1H74BsmytLxsopWmNtyhWbYxvRPpM26e1mlRUdS0/CTypaidkQubKVTbiMdmltj/c+yZJMWi1xwoG1LZHfCklkB+FRNPQyNsW9Ec1Q6+xTNVxcpZISBquoHShtxdM9/Uv0QbexZpQArfW1gaLgBJiuIw0kZc9/AWCdU5mYdhYPuTDb7qKeVBdGxi4zskjJsQx1kAJc4bfdY/jXXkNLG4e40W+61H176icKw9j7VYFv9S0z1p6sMNjL4xiAv/wCpU7MlP4ddg8I7ddHSOI5rQxSEGdv8qlos2aaWoDDUN/3Li3HfVVR6yW1/J/Mrdh/qihZUiT8eefzLPldpnTR4D0j2j0BouvKapaP81p28qqlrYcQhtqB28ri/pD1TUVS9odiHfu9bX6T9ROEzxNY6uBv/AKlUtzFrTZBLg5p7rWjLs1+moK6imDWAkgriD1P5ZGcVJFPyD2XZldmJhmMU5cKlrtQ8rVea3SVH1PTySxsBu0rncyan/qeheKWXYNiVp5M5uZVvp6+SQwEfEey11DhYwqUtLbWPhd4Z5ZLF7pHR0o78NXK2ZWXFRgssjzHaxPZc9dCUXs+leB5mqypLZgDsYaxwaqHGsREsRJVNibZKaqc13ZUVbPJLFpaFBFuLN3Ki8mO0Yr1NiOiQiM73VZlz1NPR4nGTJw8d1bcfwqdz3SOBVswiR9HiDAD9S2MS3WuzjeT4xSg9o9IvRpmk6mnpmmcct7/ovTfIzMUVuFQXlHyDuvEP03ZijAqqF8k5Glw7r0g9MGfFNiFPT0v4r6QPmXZ8dmxjrs8N8q4unUk0egOEY62eNrtQ3VdWdQNp4iQ7e3laz6B6pZX0Eb2yXuAeVdepMbFNSueX2sPK3/8AOrlA8ev4rV3qkWnM/M1+G0sjhLaw8rkfPj1PTYa+en/HAWv9S2Bn3mK2npJ4xJuL91wPn71JieNYtMymLiC62yxMu5T3o2ON41wemi/dWZ/1fUNa6FtYXXPZyf0n0pV9a1DXFpdqPhal6G6Nx3EsajD4XnU4Luv0u5Fvnpaeepph8ovcLElTKbOpVsMJLRjuW3pcEzY6uajO9j8q2TUZMUmE4dpFMBZv5V0Tg3QmHYFg7WmJoIZ4Wv8ANHqLCcGppGukaLAqrbhuK2zU4vn77LfWH8/pxN6lOkosPp5tEVrX7LiLNDCpanEJIWA/MV3P6jer6HGHTQwPBuTbdcwYl0FNjOLmVsWoF9+FQWNLfw9T4/nXXWvZmrst8p58VxJhfCTqcOy7K9Pnp1BbDK6kPAO7Vbsg8h5a2theaMfMPpXdWS+STKGgivTAENH0rQxsaSfZS5vyrGjS/wBhcicnqbDWQXp7WA5aunug+kIaeFg9vYW7LH+h+hRh4jIiAtbstodP07IYgA0Lo8bHUUfOflPOSyrH6PouuHYTDDEAANgq4UIewABLRsuOVcqWIOAuFejXtnl998tttltp8H0v1EK9Ye0QNsVIylAbfSo52GM2utTHh6mXdZ7fCeSo0nYqM1QPf+lTukuCDdRODiditWuJXjJbK+OoF7XuphYnV3VBCHA2PhVkV3d+6f6f9JOmtkiEhcByUF7Umv8A0Qyg5EjOEjxvfyhjri1uyHne3hNbSYjWkMc4jhNLyRZK/iyb+qa5JEb0K02IT1GnNcALEpm0EZaJhuLprnkGyRso4Tg8E2UiZKmn8Gkkm5SJS0jlInprQ9NaBCOUuh3hLtC7QiEuh3hGhyYI2mLH3TkjWlvKVA0EIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQhgIXAclNLieSlfz+yY4kC4UMmOiBcAbEo1t8phNzdCaOHhwPBSpgJBuE5puLp8QFQhClIx7PlCa/5k5nyhI9o5Sr6MkuuiN4J4CjOzLFTKORnZSIrWJtEaCA4WKUixskTm1og0ykqKQuOwTYqC5uW91XtYCNwpGxhqqzW/hYqiyngpNPZTTQtfHpspEj3aBqVayO0XINotk+HjcWurdW4dHpJ0f0r7JI2S5v2VrxEnTsFmTx2+y/VfKP9MO6kwRlTE5ntg/stU9cZYR4o5//AAoN/st21lPJKT8KtlXhDHXMjP6Wbfj7/h0+BysqddnOUOREQqfdNEOfCvNH0JBgcdhTgW+y3JLhdPECNH8rEuromRRSFosse/GOvweWuumofw1R1tjcWEUzyXWs0rmzOfOVlNFJCKu3I5W4s9sTlp6WcMdb4SuF8+uo6xtRK0Snk91g5G4yPbfEuF/y4xlr6aw9QXXxxeWbRUXu4rm/HMONbXOncbm91sTrrFJKmZ/uvv8AEsRl9gtLlnytS+n0DwHBLBip6Lfhkb4AGAcKtfIz6lFE9gJtZUtfUuYSqdkvZnoVVihWJiLIpxa/dT9NdPtqKkBsZO6tlPJLVVAY0d1tfKjoSoxOVj/ZJvbgJ9FLcuzB5fkVVBmaZKdAyVFZCRT8kdl2jkr0M2koonPpwNh2Wq8icrZIJYXyU57HhdLdMUUOCUbQ5oFmrfxqUjxvyHlpWpxi+2V+KCLCsNLhYWauc89M3G4SZYhV2sT3W280+v6aiwyRjZhfSdrrhP1G9f1FVWTiObbUeClyLIp9GVwnD2ZTUprtljzMzm/xSeWAVhN7/UtP9TYtU1oc9spN/urJjGN1U2JPe953PlVMFW2eIB2+yzZX6Z6fhcFCqK6MI6ho6x85dqPJVokw6um+EBy2NV4TDVn5ApcO6NZKR/lc/ZMVrb6NGzjKvXRrOm6Xr3v+V25WW9J4NiGGyNkAcN1sPBcuGTloEH/xWbdO5NurNLW0x3+y1cOcto5HlOPphtlmy46uxLCJ4nF7hYrqLJjP6ooWxRSVpFiOXLUMWRlTSwCVlO4WG3wqjfQ1/Sc9yS2y6Sm5KJ5jzPHQyNpI9F8ovUhCz2g7EhfSOXLpjLbPykxCCJv48G/+peOfTmfUvT8jWvrNNvLlvXKD1exRPijfiLeR9aLL1/08r5PxdSk3o9dOl8xKWsiD/wAWD+6yik6qhnbdswXn9lr6t6Ooijaa9u9vrW9eg8/aXFtIbVtN/wDUlqs297OBz/G3CbaR0i3G2ukFpP7VZHiYIsXfotZ9NdYsxMMcyUG/3Wa4ZJ77A4nlatM+jlMzjnT9ReWYiWO5vdV1PV+8LE8qyuZbe/CfS1/tPDSVeU9GJZFxL+yEvF1FPTuYLlPo61jo7lNq61hGkHsp4T2yu6vcpmS2dYu/ZTwuDnbH+FRk3N1JTTBsnKtRktFZ4K+lVVxEsuB/Cts7XA3V2fK1zQqOoha/cd01PsbF6lopYpXtO6r6aUncKkFO4k7bKpp2Obt/0UsSZR2ircDICD4VNNTkbWVWwjSEOaHDdTrskUFvst7YnNNyP4VVBa4KJIxe1rpG/B+ye0kTJaRUD4uETUzJRcjhMilt8ydJVNaPhKinHaIrF0QvpI2D4R3TdDR2T3Thw55Ub2ucdQ/pUrIbRU/GADHH5VIGNLeFCGu73/hIZXN2ss26H/CauGiWWSKJu4Cginje633UFZ7jwSL/ALKki91sndZ06tsnaei7vhZIPlHKsnWdCybCpWBgN2lXeCV3t/ELWCtnU0xfRvY3u0qGVW1rRWvUZROH/VF0MMRkmAp+b9lw9mxkjLVVcjm0ZPxH6V6gZtdEOxh0hMRN/stD9V5FmtqHaqMm7vypn4G/4ZNsThjoPIKduJsc6gPzjsuyPTNlO+gngJpLWcOyyTpD07NjnbIaI/N+Vb1ytyvbg74x7FrEdlPVj6YV1r+m3co8DGH4ZE327WYFnbomiO2lWPpSFtFStj02s1XtkhkIC1aK0lrReriooRjO2lTRsbffwlEQCQHSbrRjHSJCW5II+yifStPI2KkbILagQh0jXd1YT0g+ooKihANwFLTUtgbj9N1O8sI3KGva0Wsne6S7I2u9EE9JG4fEFbcSr4MMgc8vAsPKuddOIoi8m2y1Pm112zCaKW0oFr91m5VukQW6SMbzgzbpsOZNH+LAsPK4f9T/AKmI8NdNFFiA4PDlfPUtnvJST1LGVdrX+pcAeo7N6pxeslDKq978OXH8jbvowsySSG5v+oN+JVUlq0m7vK1bN12/GJXEzE3Pla+6jxutxGqP+YTd3lV3S0c+oOeb+brjMv6YFk9Mzylc541/flX7AMXjopw8yWssfo5Gx09yrZX46+kkIa5ZM49i1zR0plXnw/p+ohjFZYAjuuvcgvVc1/swnEe4HzLyvwvquVlQwsmsQb8rc2SuZOI0mIRf8Qbax9SvYENWI0MfXse42RGaMXVEEZNUHEgd1vSgZHNA12q9xdecXpAzq9mGAT1Q2A5cu3uiM16TEaKICdpOkd16dxEvVI6jDcYo2PJSxCMn7K2RyN98gHe5T6HHmV9KS1w3ChgjJn1Lq4tepqp9FwjqC1uyhqZRe6lihc4cdkk1GSEyWmxy+lG2Q3uSQq2ilDzZU0lM5gunUTyyVLGKJl/qXJ5aDsQqaqg9yMtIvcJ01Q0EWOyYaoPbumXQWmVrEtdmuMwuhosRikd7IN79lyv6gMl2VscwFHfY9l27isLaiFzSL3Wq8zOi2YiyQCG9x4XP5GN7S+GHfS3I8nc4chHQYk8tobXceyuOQ2Uc1BjEDzRkWcOQuwczMjm19U54pCd/yq2dCZNf4ZXxu/CkWd+VVq8T9vhVjiv22dAelLABQ4RTsMViGhdFU9M0Rbt7LT+SeH/4TSRRltrAbLcVNUsfAD9lvYlKijZxKVBdkGIvEEVwFSU1UXHdVOIsdO2wVJBSvjNitGypKJfkvVFyp5tY22VQCDwVQwaoyqpjjsVUlWmNjZse5waL2VPUzi3PCfM91lRzB7jbdMVaH+5E6oOo7ojcS4Wug0r+SFNTQkHdSQjoHJlZSg6LlSvedNz2SQsFrXTpWjTYK1BPQ379KSadwdcHuiKo9w8/0myxlx+FNhYWOuVI09ApNLRXMJaNihzu5UX4gAWCNYIvdQyixrm9j9dwbqKRxG7fCBIS/SiZwY26qyi9k9fYwyvbyk9wv7qOWpZY7/ZMjqWA7kKLRZUOtlZEzYeVHPEXk3HZPhqYzYkpZJmm5BTorsp2w2y01E7qWXwocQxQmMfEp8Sh919wrXiETrAH/kp4jXUnAqaGvkfYA91WCSR7xurdhsIaBfyrpA0Czinv4Q10amTP1e2CVZ8Yq/wjHSarABXHE8Shpaf4iNh5Wscxsx4KCnkjbKBYc3VLImkujo8DHnZJddFmzPzKGGRSNbU2sD3XKmdnqBdQCQ/ju5+pXfPjOIRGUNqRwfqXF+eGZ1TiUkkcU5Nye6xLZts7vjOJc5J6Jc3/AFSVTXzMjxB3J+pc89aeprE5Kp5Fc/8A3KLqnCsY6ile5hcdRWG43kxj1S0yGB5vfsqzm0emcVx0Kkti4j6ksQc6zq93PlJB6lKtjQTiJ/3LWPX+X2L4Hqe+Nwt9lq/GsersPldEXkEG3Kq3W9HUy46NkVpHWeCerWpw6QXxQ7f6lszob1qVJe0DFT/uXnnT49iU77tldufKyHp3q3FMPlBMzgP1WNfayzRwm+9HrDlZ6uJcWkjgmxO4NuXLofovMSn6noWtE4dqHleQGUOb9ZT1kLXVJ5H1LuP005yOnjgjmqRvb6lR/ItEtnFOuW0jpDMDoalxehfKIASQey4/9R+W76VszmU1hc8BdqYf1JS4zhIIeDdvlaZz36Sjxall0RXJBOwUF6TjtHSeOZFlN347P4ecPVnTEkNZJqiI+LwrZS9OslZdzOFvXM3Lh1LUyu9k7E9lqzFYBhOpjxayzPX9j2DAvjZWka+6pwVo1MjZ/SwTEMPmo6j3NPylbSxCWOrldc8lY51NgUb4nPYzt4VyncWTZuOp1NaLP0pmLNglW1pmLbOC7F9KGe7oaumBrz2vuuDMUw6aCqJAIs5bXyE6zqMCxGAOntYi+/3W1RaopaZ5Bz3Cfnk9o90vT3mjBi3T8DnVYJ0jus46z6vdJhzyyX6Vwv6WM9Y48Kp4XVg4A+ZdK0XXUPUGGlomBuPK16r9x1s8z5DgFRZ+TXw1nnLiFTic8sbXOOolafpMmanqnF9TqUuDn+F0LinRT8crrhlwT4WeZYZLQwysqZqXve+lT62jmrrVRZo1VlP6TY45oaqXD7EEG5auqMtugKbpDD2NETW6WjsrhQYXh3TtKD7YbpHhYfmTnjhnTVJI2Odo0jypYwSRn5V0sl6j8L7mlmJRdP4VK38Q0FrfK4h9Q/qHeKmaGOs7kfMrnnl6lzi75qeCsG9wLOXLHX9bjHVte50Rc7U7so7K/f6aPHyhjLouB6lqutMSLQS/U7gLaeUeRtVj1bE6SiJDiN7LFPT3lFilficb56d5Fxy1d5ZBZQRUkdO6SlsduWqv/jts1MjmVVU+yjyW9PceEthk/AAG4v8ACumei+hoaCmY38OBZo7Kr6U6JipIWBkFrW7LNqDCGwxj4bbeFeoxtLbPN+a5+d0nGLKKgwVkTWgR2/ZXShpvbNgFVU9ESNgqymw+zhsf3WpVXo4bKynP6yahjNhcK60sdgLBU1NTaQNlX07A2yvQg2YNtm3olbs3dUtS+5tdVT/lKopTdyu1RZWb7GhgdtZPZDYXt/aWBl3AlVTGN0jZXoP1Q3RTsY4nhTNu0bJXNDeEwuINgE5tskihyXQ7wmtJPIUouRsE1vQ59DoxYXSP+YpzeAmv+YqAhl2hknZNTpOyamP6QyBCEJBiY5nP7J7QSb27prQALqRnH7qWP0mgI/hNTpOyankgreR+qemN5H6p6ABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCZL6A1/P7JjgSLBSFoPITCCOQo29ip6IyLGyE8tBN0aGpiT2L7DQCTYJzRYWQGgcBKnJvYewIQhTp7Gj2fKEOFxZDPlCU8bJPYH2R8JrmkkkJxPlCPYicSJ7LlI1paVK5uopS0d2pyeyP07GBpuDZPvtZMc8tNrpWyi1/wDokfaJIR0x7PmUdcCItQUwLXbhRVovCRZIoez0yRvSLayckG6a4Nld8XhNkHt32UBmcH2BSSo/4OqfsyqFBC4XICtWM07Ir6QrtDK5zbeVb8Yp5JrtA7KndjaW0aNMWpa2YdjddHAw3IC1z151LRwwSa5QP3WTZq1smB0j5i61guQ8/c9JMFimayqta/dc3m1emz0bxmhXXR9iHPbq2glgmYJgdj3XEudtXBVTyuY++5WR5peo2WtmljNaTe/1LR/V+Y/+LSO1TXuT3XF5zafZ9geB41NdUUa46/D2TPcwnkrCpsQmiuCVn2NRNxQuN73WM4r0w4AvDVz1tj2e8wlUsdaLNSVzn890lZK6Q6Wp7MNfC62lXPBcAkr6kN9sm/hPqTkzNvzI1xfZJ0JgElfXMvHy8dl1/wCnLLeOcROfAOBy1alyfytdU1ULvwpN3Dey7Y9PeWLqWKJ34U8Dey3sTG9mjzPybmYRg+zPsv8AoCnw6iZK2ECzebKnzJx2LAaF+l1iAtpRYD/h2E39u1mLnf1HYtLSxTMa47ArYlT+KOjyPFzpZuY5N7WzR+cOa0r3Sxe+e4+ZcwZl4u7F5pXFxNyVmmbnUkza6QGY8nutV1OICtkdqde5WHmSUWe2+L0Q9IyaMFxSif8AjHWHJUlPE+Fu6vmJ0DHTFwbclUVVRvZHfTwsSVv7Horri4bQ/D9L5AHHlZx0jhMVYWNbY3Wr34q+jqQ3Utm5QYi6vqYmne7gp6V7M5nkM2OOns3Nlzli7ESy0VwbdlvboTI0FrHOph2+lUuQHSjK6GJzoL3t2XT/AEb0XT01M18lOLaR2W7jRe1o8v53yCuCaNSVOTVNHhzi6nbs38q5v9RfRLMDZLJFHawPAXc/W5pMOo5AABZpXH/qir6argma1w+UrQ/KodGFguWcvbRwVmj1vXYLWuZHI4aXHgqz9IeoDFcLqW/8U/Z35lLndQiXEJS385Wr4sKm/EXbfY9lDK/2ZczOGU6/h2RlN6qcQBjD65/I+tdeZAeqM1EsTJq88Dly8oOncXrMGeLSuC3PlTnZWYJURk1zha31Kxj2s4zkvHo+j6PdHI3PCgxJkGusBJA5cuk+kus6Cup2lk43A2uvF30+erCanfTtdiR2t9S7dyR9TxxSGJv4+97fUtqi5pHkfP8ACKLfR3rR1kNTHcOuf1VOXOFTte11rPLrM4YrC2899TR3WysLqIqtjZbjdaEbHo8uzcNxk0i6QzSMZ8JUrfck5TqSGORoAKq4qdrXbFWITezM9fQhZA8jjsmvhex6ukdOzQDdRVFO1pvfsrcbNdEUpprRSNe4jSqiCLXa55UT9DBf+U1te1htf+078i2VI48nLZW/hGkfCP7Q2HSOE2mr2PFlUB8b+6nrmiZQcP4RAFpuQna2+UTuBZsqZ0xYbXVpTW9DktrbJ5Ht2UT9wVH7109rg8KdfBSCWVzDcJonc/lSTRAm6jZDvayWS6GSXZLC4vICrYYgRYqlp4S22yrYmODQbKtKCI3rY19M2/ZU0sLR/wDyVW9xA5VLKHm6pWVJsRSWxvtRltiN0xlHHqvZMe6TXZSgvYqsqOyX2TQPjY1ukforbiFOJQWuG3cKvZre5NqKQkFxCjeNt7KtjWjEMW6RgruWA3+ysc+VNJUP1fhwd/Cz8ss7S4Kpp4Y3EXaE6GMippTfRh2D5VUkEd/YaP2V1g6ShoHjQwbfZZZHABGCGjYKN9OJXW0/qrccZIkVWi0sAp4wAOFXYe8SEC6ZW0DmtuGqTDqd0Yvb+1YhTonjHRXFpAuVBK7SLhTlxPKgkYbbhP1of6sp5alzLgH9lEauTsVJPFckgJkdPq7JjZG49jo53uO52spmOuFGICwEqmmrfZcRq4VWy5xIZPTE6jqvZonHvpK5P9TvWL6CkqAJbc910j1tjOjD32f9BXEnq06leKeoAkPfusXNyjOybUjhf1U5nTNqqoCY8ngrj7rLqKoxqteXOcbk91vb1L18lZWVPxn5iufRA0VTvc33XJ5mR7No5vLuRTYR086ulBc0ndZJR4I2gYNrKfpqnhaNQaFV4zVMjaWggLnch7ZhWWv2KWeqdFAWtPZYvjVbJJIbK/xh1Q0gOuFBL026odfRe6oSW5BC3UjH8C/EzVoG9tS3DluDSSRym+zh3WDYP08KWoDnMtYrNsFxCGhY1uoCxWnhL1kmbWNPaOqciMz5cGfGxk5bYDuuyck87pqr2IjUutYd15n9AdUyMqmaJrfoV1b6cupaipq6ZhnJ3C7vjbFFI6DFt0emuVfVRxajjvJe9u62VR0oLA+3IWh/Tw+eahge43Fhyt/Ux0QNv4XVUWpxNuqfsieMMa2x/wCSCA52yp56sRt+ZU8eJBzj8SnUlssRkVlTCCy4Ct1Q72HGyrPxPuN3P9KjqwJOBupoyRIp6IJKt7hdI2rJNinNpbtuQU1tIdXwhOmlJBJKTJmlsjbEqhxLA4a1p1NBv9lcoqOS2zf5UsdJITZzQqU6U2V5VbNf43lpTVlyYQd/CtEeVUNK/W2AbHwtuGjjA+NgTKjDIXx3EYRDHWwjRFGDYHg/+F2a1trLJaCrfbQUlRhwbIQGJ8dMYtw2yvVVKJbhUolzptL9nbqZ1PGRcBW6mnLLXKq2VQLfmU1kBbIew8RW4spNBAUcU4LuVPqDhtZV/wAfRW/FpkZh1blApQTspdRtZAJHCj/GPUdCfho9NrKN0TGGwCkM9rjuqaWoIdZCiPUWyZrtJUhdqbayohP+ykE9uFJ7JIX0JjGCb7KKpjs34U5tQCAO6SXdtrqSOmhPRbKIPka5TRPJ3cESQX3H9JBaMaUyUUH4yQytb3VLWVJc2wKjqpy3ZqpfeN7OKgmlos10PQj5ZHEgEpYmyOO5/tAkY48/yqmEMG+ofooJL/hO4ev0fCyTm/8AaqGRucFTOqY4xf3AEsWJxtO8o/lQSfqV50OfaKl1GXjcdlSVWEl+5CqosUhLt5Apn1kDmAhwRGwi/HNdaLbBhxh5CklaY26geAnVWJxRixKpKjE4jC437eVL+RE9NMtp6MRzFx91BSPOu2x7rlXPDNhlH77HVNiCeHLeWe3Uoo8Lmc2S1gV5z+qPNaqo66oa2qI+I91QyLo6O74jj29NosudGan+IVEjGVF73+paXqaGr6mxDS0FwLliuL5iVmM477JnLrvtyt65DdC/49JDNJBq1WO4WJbatnomDVCiCbKzKj04vx4MdLSXvvu1bSrPSDSNw33HULfk/Kt/ZM5XUtBQQyGjAOkdlsDHenaWLDnN9gD4fCquXtHo0o8tXRco/Tyh9UXprjw2mnMVGBa/0rgfNPK+rw7FZWiEgB57L2w9TXQlLiNLMBTtNwey89c98pIY6+aQUo+c9ljX3tM9S4WuOVCLRyDgPQspeNcZ2+yqsY6Z/ARXaFtGt6ajwuRw9sCw8LEeqy112WHPKyrb3vZ6Bi8UnD4Yx0ric+E4ix5cQAR3XUGQGa5onwt98ixH1LmCSicHe4wcFZR0T1VUYJMwiYizvKilbvtFLkON/HFvR6n5N5tRYhRRwvqL3aO62Fi9HHj9C57QHAtXCnp1zbmnqIoDVnkd13Xk093UeGx6jqBaEm3J9HD25kcW3v8AhorOTLwtZLI2AcHey5EzlwmbDJ3hrLbnsvTzNjLSObC5JTTj5D2XCnqU6EZS1UpFORa/ZNdbO58a5qF9kU2ctxVMhqDc8FXCpp/xFMQR9KZiGGmmrXNDCLOVypKIvguR2Sp+p6a5xsr6Ne9QdNe5IXsYrdh1TNgVW1wJFj5WwMWoowDdgWEdTQMY4lo3Uld/Zz2fiQkn0b5yCztqMMMMT6pwsR3XcPp+za/x9kcDqgnVYbuXlJ0fj8+F1sZbMQA9dj+kfM9wxCnjfV/U3krTovaZ5j5FjQjW9I9UMrOl4MZjiqHNBu0HcLdmB9J02H0Ac1g2b4WjvTd1hTVmFU5MoN4x3XQuH18dTQAMcDdq6DFcZrbPnnn5W15Gl8NW5y49JguHSOiNrA8Lg31GZv4qKqeGOZ1gT3XeGefT02JUErWNJu08LhzOvJTEsQxCZ4pnG7j2WlXXtENF0UjmN3VWLY/jftSPc7U/yt95I5Kv6qdFJPS31W5arF0N6cq5+PskfQuPxj6V296aci3YfTwPfQ8AblqnWPsS/OVa6KrIv0yU2HiOb8E0bD6F0l0PlnFhLYgIgABvsrz0X0fFh1MxracD4R2WY0mHBjAGsGymhibWzkeT5me3FMjw3B4oowNIVeaZtgGgJ8NLI1vHCPbc126sRxtI4nIz5Sk9EtLSAgGw/VVbKZreUUUNwDZTuYQdgpFVroprIlJixx24sp2FrW2uoo7iyfdXKa2kVrLP2Hu+JhAVO6Ih1yp4+6JI9VjpVqENBGWyFu1lI2VoFlBK/SNyqd1T8VgVY9VosKL0V5eHmwQqeCXvtwqlg1b9kjWga0AjBFx/yUjDp58JA3bYIJA5UbZHJ6JBuLpj/mKA5w4KQkk3KiGv4Nk7JqdJ2TUx/SJoEIQkGkg2Fk9nH7piUOI4Klj9JY/RZOyapCAeQmuaALgJ48RvI/VPTG8j9U9AAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhMkAJCARYpUmseCo9MBrhY2StaCLlI43N0NdpFrI0xNodoHkprhY2S6/skcbm6cohtCIShpdwl0HyE9LsUQPIFkus+AmnY2Qk0x6SBCEKNt7GuIJ7+EzhI12o2sljIT1IJ7kpl3DZVJjubmyZJHbceFNHTE0kLC8t5KdVvHskhUssobsonVpd8BKlUdsbNpRB8LZGkk7q2VjXRSbDurvEC8WHdR1NAHm9v6TwxZxUymw97nC5CK+UMcTbsqynovbZsArfjTxGCSOyjs04mrXKM7Eac9RNQJMIeAbHSV5q+rzEKuEVQheeTay9Kc6aCbGaGRkV+Fwv6lcn6zFI6i8BNyey5nPr3s9Q8WnCFkTzQzC6oxSHEZWukdyb7rFGdVSSbzSH91vHOrI6toaqaQUxHPZc+dX4BW4LI5ukiy4Hka2pNH1H4nyMYQXZf8M6phkl0Od/auNTiMVU0NZY3C1LT45U01VoLiN1mXS+LSVbmscb7rm5UNyPV6+ZUatNmQ0vTxrZxpZyVsPLjLOSpqoz7J/hLlf0g/GJmH273I7LqPJnJV0z4XmmG9vpWliYzbOI53ymFKepEuRWUAc+Fz6Y8jfSuucr+g2YZTxgQ22HZUWT+TopIYn/hxtbst6dP9ENpadv+XwPC6fDx/VpniPkflqvTh7GE9XUgo8Fe4D6Fxt6ncQI/EDwCu5szcGdFhErbW+Erhj1T0Dmfif0KsZK62VvFstW2pbOF83sRD66S5+orXMVc1sp3+pZpnHFKzEX2PBO61tE97Xm57rks9bZ9QeM//wCOtF9fM2Yh91FWMc6E7dvCooK0MkAc5XaGSKpj0t5WLGDcuz0bHilRuRhWKUE0tX8Le/hbW9POC1MuKQNcw21jsrZgnQ78Xq26Y+TtsuiPTvk1K2ugk/DfUOy2MWr/AKeTeZZsaIvR1p6X+hY34VDM9u9geFvurpIsMoC0bWasTyH6Sfg+DRh7LWaFkOYuJsw/Dn3dazVrQShHZ4PfkWZ2eoJmmc7OuW4fDNEJOx7rjHPPrZ1dJLH7l7g91uL1JZg+xPOwSbC/dck9e9Wf4hVPu+/PdUrL0pHtHjvDapjtGt+tcCZjNU9zhy5YxD0HAyY6oxz4WdPlbUSHfuqWpgDHFwsolY2dv/8AD1yh8NcdV4CMO/8ACbZY+3HavDpRodaxWweqab8Q0krDpOlpsQrgyNhNyr1VnaOK5vi41xfRs/IzrjFZKyFjZXcjuu8/TT1NjT/YAkcdwuOPTjk9W1NZAfw53cOy9HPS5klKyGB8tL3G9ltY09ng/k+JGMmdZenqoxCsp4TKXW0i910r07KIKJge7ey1FlH0lBgNJHqjtZoWd4n1HBhlKSZLBo8rVhPS2zxjkMT8l3rFGYP6sp8PBD5Gj91SuzSw+F3xTs/lc/Zm52xYVrDKq1r8FaX6i9UbqWYtFcRv+ZSxteymuDdi+Hd0eb+GgafxDB/7lMzM/Danidn2s5efNJ6qJJpNP488/mWTdP8AqTlmlbetPP5lPG5gvGJ73o7if1jTTD4JW/ylixgTO1B39rmzo3OhuJaGvq73ty5bZ6Y6tp6qnY73rkjynxvTfY27g3THfqbLoqy4B1K5QVbiNisIoepKdtjr/tXWDqimYy+r+1NC9J/TCyMCyP8ADKffJbwoJpN7Kx0vVUdRL7bSriyqMhFu6tV3bf0zLMecSpjBLlURs0jnso4RcbBSOkDQSVpU2bIVFp9iSXJt9k+mjaXb7bqnkrWtPBT6WrD3clWW/wBRLF6x2XCOJgde6cXW2HCgjnF7FSe6CLhROPZnys6I5pXNsonSG3HKke5rzwkDQ42KbKCZGreyle7472ThIX7EKc0wc66V1LpFwFBKvRNGfsiOMhnxfZNqaoaSB4TZw6O6py4yOIKT8bGTIZnEuJsmsqZGFVrKIvH6pThgH0/0pa64/wBEpg2xkGLvDQwjlVtFUNd8RVL/AIb/AKU9jHxXAUygiz6FdMGSixUbWsZ8IH6KNsjibEpzT8V0KOhyXQ5zi3hOjYJRumvBPCfBdpsQoZiaY2WkaWkpjacMNyFVP+VROaSbhVpvQ1rZSVzzGyzVY8VJbE+T7K/1kd27qx49GW0jyDwFj5lmmU700a0zD6ifDTPi1baVxt6naltdTTuJ5JXT2cGMCja8E9iuOs/+ofxEUoB7lctm3tHPZljRw5n3hokr5xfly0hXYSyOpJPlb/zchNZXTO/1FaZ6iw50NSSCuctscpHN3yk2W6lc2ii+Aq0Y9jJ1G5VzfE8RWcVYMaw+eQ3bfdV3W5GfKLZcOmcTE8gY5ZtQUcMkevSsA6Yw2pZOHae/hbFwWnlbAC/woXQ9iRrl7EdZRRwR+40bqzz10kch0nur/iY1Rlt1jGJj2ySVex62jZo2ombZd4yfxjGud4XYXpmxGEVVM8uFyQuFuisRMFaCXdwus/TH1A51fTN9zuO66PDm4pGpTY4s9XPTRiDJcLgH2C37Ty6ohv2XMPpXxAy4XB8XhdK0EuqAE+F02Lc/hv4lm0NxRzmQlw8K0w1LzLv5V3rwHxEFUEFGDL+/laMJtPsuxkyvpZnFtiVUspg83UMEVmqqiuLbq1GTHKb2PbTN02skbSNa66ka/smvkIO3/NTJk8ZbJmsaGgAJrzoJI7JIZARv4SyPaT+yVa/o/tMgkqC43PZMFbf4EVQGlxAVGAde3lPWidJaKwQxynUUSUzA24KZTk35PCne0nhSewjk0WyoDmbAIic7Tyq19F7h4UM1IYtgE9T29DXYtjYZS126uEEjXNvccK0OaY9yUfj3w7ByRx6I5T2Xu48hFx5VogxB8hHxFXGmJlbqJUb6Q32CRp1EjyoJWO1XKqNR1abJHs1KtJ6HfkKVSNc13fsmygt4aqcvkbuG/wBqGViF92VzGN2IcCpQWgFzirfFVPb8wTK7ECyO7UsLUg9my4udG/g/2qSrfo3arXBi7/cILlNUYgHsN1L+VFmmO2LK1z2FwCtdXUOY8hyrP8SYxpDlYcfxemjY52oXCbOUdGti0ynPWiolxqGlBc94FvurdW5k0NC06qhgt91q7M3NGnwOGW1Ta33XN+ZvqiGHPkayvOwP1rPtyEjqMTg1e/2R2NW5z4WHEGrZ/uVDJnVhjD8NWz/cvOLHfWXJT1Bb/iJ2P51R03rJdO/fEjz+dZtmV39Ojx/EVNdRPTDD85KGeYNFS3n8yyOHMWnkiBjnabjaxXmf016ug+rYP8QcfiH1rd3QHqVgxJkbZK29wPqUCzEv6R5fhdkIe3qdlsx4VkXuF43+6pq7Gfbjc0P7eVqjpPNqir6RpFRyPKu9X1rBPES2S+3lTLLX/TDXAXVWJOJhvqJx4MwaZ3ufSe68u/V11LKMSqBG/wCo8L0L9QGMSVuEStjed2ledfqM6dq8TxWYFhN3lUrslM7jA478UUaOy6gq8Z6oYZASDIP+a9HvR7lpFXUNPLJHw1vZcU5M5euix6OR8P8A5g7fdekvpMw2HDsNh1AD4Asq25Nk2S5Vp6N+9MdLQYXQNY1oGlixvMTGY8Mje3UBYHZZhU41T0lCSXWs1aJzy67poGyaZeAeCobbfWGkZvEUX5Wb7S+bNaZxdR0lXFIJHDv3XHueEWF1D5ni17lbPzizRcPcDJj37rlzMrMKqraiWP3r3J7rEsbbZ9I+MY8a6oo1ZmTLHTVUjYeN+FrqtonYg+4CzfqmWTEZXahe6tOH4OffF27EqhYmew4GNCdS6MYiwJ+7Xt/pWXHb4bJ/l9itpYngscFGZWtF7LVvWp9uZxPZySmO59mZzmIlQ2kbI9PPWFVTY3E0vPzDa69R/R11KcSoaeOQ3uwd15G5JYi2HHI/s8L1C9DuL+5FTN+wV2uncj568g3Xazrjq3p9mKYQYxHyzwuOPVHlCxwmkER3Btsu9MMwsYhg7HEDdi05n7lY7GKSUsivsey0LMVxr2kUvGuZWPl+jZ5LZi9D/wCEVsj9B2ceyw6oxUUYMJXUnqKyqmwx87vZtZx7Lkzrmllw2ukjdtZyybK5a2fQfC8tDJrW2Omm/GNJb3WKdSYZI9zjYrI+mniqAa8qsxjBI543EKpqUZbNzJUZ17RqWaR1DUAeHLdHpz6+bhOKwl81rPHdao6twd0U50Dum9F4hiGFYi10ZIs5atLUtNfTzfyDH3B7PY70q55034OnhNW35R9S7Qy2zGgxajiDZgbjsV4z+mXMzFaeWnj993A7r0b9MHWdXikFM2SUm4HJXRYalrZ88eSUQhc2zqzEcHh6hp7OZe4WC9T5C0OJyOe+kBuedK2p0JSfi6Rjz3Cy+XpuGWEHSL28Lp8SHsts87yeQVE/VHN3Tvpvwukrmytox81/lW7MvugqbBadkbILWt2WQUfTTIpbkD+FkOG4dHE0WAWnCnvsyMrkm49MShpRCwADgeFVxz6Lbfop/wAO1rdgo2UpMnCsqvo5y+33WyeGoc4abf0p2Qe47VZJDSjawVdTw6eU/wBDGsg3IbC32m7BD3OvcBTlh7FIIgRuP6TXDsbGLiQe45p4T2EuOop0kQtcAfwmE6dyp60tENibkTsAA2T322sVTNn0m11IyUEKRxZLUtop6lpddW6bUx91eC0PPCpKyl3uFImi5FohpZXEgFXGCQFtrj+VbrGIcJ8VS4EhNl2Nn8Lqy2nZRy83+6jp59W36KVQMgktoBuN0IQmiaY2TsmqRNLCTdMf0aNG5T9DfCQMIN1JoPkJBVFDUJS0gXSKWP0cl2O1nwEheSLJEJ4oDY3TtZ8BNQgB2s+Alabi6Yns+UIAVCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQmP6AJmh3hPQhLYjeiMgg2KQuA5Kc/5imloJuUvqMF5StAJsUg2FkrPmCVLQL6PAA4CEISkgx3J/VIldyf1SIa6JF8BCEKB/QA7gprAb8JyUGxuo0xG9DgBbcJsrAW7BPBuLoO4srFbI38LdPG65FlSthcZLK6SxB9tlEYA0F1lai1ohnt9DYG6SNlUBzCN1Tai0WTHVDhwlcWyr7utlZ7jOFYuo26mktVy97a5P9qmq4BP2vso5Rei9i5EnLo17j+CiqjcHsuD9lpXNTLODEmzf8KDe/ZdMV2DMew3CwzqbpWGfWCzn7LGy6nKOzv+Ez1TNbZ5zZ+5CNmE5ZQfSfpXE2eGQdXA+VzKE7E8NXsnmblVTYgyS8FyR4XM+cPpwpq5kjxRXvc/KuRzsVN/D2/x7yL8cV2ePHUeV2I0Fef+FcLO8K/5e9EVz62Nhp3fMOy7EzE9MDW18hbQm+r8isXSvp+noMUYBRuADx9Kwv8AC/bZ3mR5S44/TL16csrpZzC59Ke3Zdu5M5VtihhJpOw7LXXp5yqFIyLXTkcctXYOWfRcVPBFaL6R2WjjYyizy3yHySyyD0yv6D6LZSQRtNOB+yzmLBGxQ7R9vCrsEwSOCFp02srjUU7WxHbgeFsV16PJ8jk7bre2agzapdGFzAN7FcFeqmllc6ps3yvQjNWmbLQysG5IPC4m9SvSrqp1R8HY9lTyukz0rxLJcZxbPNvOLCJZK6Q+33K1LiOHT073WYQupc2+hHR1UjjEeT2WkOrOnY6Uv1NtuVzGTH2PqPxTl4uEY7NW1VbPBNu7usl6MnfXzNYTe5Vh6ogZA4ltr3V6yh1VOKNYQfmWX+P1kel3cooYr0zpDJDLt2L1MTjTXvbsu0siMnYqOOGZ9GBweFpb0n9JxVzqdz4+w7LuDoLp2lw/Do3BgFm+Fs4sNngXmXM+7abKzD6aHAsOaxjQ2wWqs8+uY6bD5gJ9w091sbrvHIcPpXt1gWae65O9RPX7RDPGyYd+CpMqz8cNGD4rxssvLVskc3+ovrn8TXVH+d9R7rnnF8Y/ETuIes2znx6WsqZnh97krVMdS9851Fc1dk9n0pwuF+OpdFxpp5PcJB2VS9/uixKjoom+3rPhR1FWyKWwPdTUX+xtyXoilxDDnTtI0q9ZedCsr8VjD4LguHIU2BYd/ihDdPK27lBl1NNiMT2wkgkdlsUM4LyCcWmb/wDSnk/RSGme6jb27LvzJ3ojDcFw+J7IGiwB4XOHpr6Q/wANp6dzoyLAdl0/QYtFg2Ce4X2sxbmI+ts+dfLtyscI/wBMvxTr7Dum6U66hrdI8rUOZHqWpYTJTw4iPGzlpz1IeoOowczRQVdrX+pckdS+ovFcSxd0X4sm7/zLR9mzzOWLFWHS+Zuc9RjMj2w1hN78FaZ6n6mxeeR0jZn7nyo+gK2u6texzyXalsqHJ+WuphIYCbjwl9mbGJjV62aioOp8Yimu6V/Ky3p/r3EIJGl87tj5WQV2S01PdzaY/wC1WXE8v6zDgXCIgD7Jztkl0asaaG9GyOjc8JsKcx0tbYDyVuXof1WUcMTI5sTaLD8y4U646grunoXFry0tWrMT9T2KYDWGH8cW2P5lD+d7H3cRCyO0j19wj1Q4XU6Q3FGm5/Ms66Uzqo8XIaK4HVbuvGnor1jV752MfiPf866i9PvqckxWaMS1oPH1KWF72czncFHT6PTvpPG4qyRsrZgb/dZ7hdXFI1pLwuXMlc36TEY4mSVLdx3ct54D1nSStbpmaf3Wlj3JvZwfKcRKp/qjZkE0AZyOFFUTsuQHKx0mNCaMFjgdvKm/EyPWxVZ0cnLFlW22V8gZILA9k+kYWWIVLTNldvZXGljJADgtKufsjOyZNLQ9uq97FSBzhtdK5oH8oLABdSmTYNuRwVIL2CjUgFzZNkRL6SROHB5UrQ08qFjCHXHZS72TJfC5VFspK8Aj4QqMfCVcZ6cPBJKpn0YBJ/6phY/G2T0D2lu6qS9jtmq3tJjGn/qpoZDcG6ELGv1KlQ1DABdTA3F02Roc3dOi9MVPTKQFwf8A/qUsLgXWcgQkutZOjgLXauE9vY7ZI5tuAnRANGp3KEKCbehN7CSQb78KMSknlNncQTYqNr3XH6qtP4J69kswDwVY+pWllDIQOyvg+Ju6sPWMumgeB4WLmrrZXvinE5mz7rNIlDXdiuMM7q8kyhz+5XYPqAeQJT+q4nzzrQ10ov3K5DOi2zmc2s5uzHqG/ipbHutSdTPc6oNh3WzOvHvmqpLdysBrcEqK2ps1h58LIjX7SMKVDctFggw6aqOlkZP6K70GXFZiQaRTON/ss7y/ysrMSlZeBxv/AKVvvLzIB9SyP3KJ3b6VoVYvsh8cPZzbguTFcwaxRO+2yus+X9bQQ2NM4W+y7Rwn06RikDvwPb8qsnVfp/DY3aaMjbnSpP8ACTHrBWzirF+nK2PV/knZYf1DhtRAwlzDt5XV3V+Tc1M97BSu2/0rUeYeWNRTxvtAR/7Uqx/Xosxx1FGmMDqJYa4DhdO+mLFJv8RpbON9QXOx6bqKPEruYdj4XQvpjpyzE6YOFrOCuUw0ySFTUuz1O9I1dNLh9MC47gLrPC9X4dpP5QuT/R/Cz/Dqb9l1rhTB+GbY/SFuYaZu4kOx1Q0e2NlT0wbr47qsrI7RcFUdMfj38rZqi2aSrZcI4/h+VStYAbBMp3XFrqojaCrsY/wFDsGx7bBRPY697KoLtJtZMUyiTKKRBqczdIagX3KdVEMH7KjdIbnYJrWieKX0lnlBFr8hQsY3Veycxhl/ZTxU4HI7JU9D99BAGgC4UhkYOSlEQaNgVTVjyxhACPZkbZURVUYd8wSTyskOxVmfVPY+91W0TzK0ElPg9Mgl9FqY7t2CttRE7Vckq9iAPHdQ1FCLE7qZy2iNRk2Wyl1Nfvwr1Qvb7drq3ikDbk9lIKkQNsTwoJssQplIuZDBuSEhfGBu4fyrDP1A9rubWKid1E4mxdt5VKyekWoYU2X6SSncOQoSYHOtcKzNxxh+aQfymnqGnafikH7lUZ2bZPHBmv4XmaOD2yQeyoKlrXMLSVQzdW0QGn3W/wAqkm6npnxm0jePKj/Jolr4+x/UPDmMnN391LLNGW/C7srBUY9GZdTXjlU9X1PBTROL5Bx5T43Jvs1a+NnHWkT9RdSU+FwOfJMBYeVo/Nf1BUGBRyNFe0EX+pNz6zZjw2ik9qoAIae68+vUz6g8UjqZWR1Z+Y8OTbLno6fB4/0a2jbud3qWjroZxDiF73tZy5PzNzaxDEpZDHVOIN+6xGpzHxnqV7mGZx1HypabpTEMXh92SNx1DuFk5GRpHofD4MJNdGsevMxsVp5HPFU8bnusOp87cUpZ7OrnDfys3zX6DkpInvMZ2vyFoHqenkoqp7eLOWJdlaPVuL4mqUVtG+Oj8+qoTtc+vdsR9S3vln6l3UhjDsT4A+pcE4bjFTTfEx/H3V3p82cSwcgtnIt91ReY/Y38jgaLMf4et+V/qsp3RRROxUcfmW7Okc+KTGYmgV4N+2peK3QXqfxSjrI2OrSBqF/iXWvp39RsuJyQxy1wNyPqU8cttHB5vjsIT3o776yxRvUFC4MfqBC55zOyvOIVL5vw17nwts5Z9T0vUVAz3JWm4HdZLinR9FiMWosHCSd7kjLtxIU9HL3R2X7cKxNrzT2s7wumMp+rYOmqKMSTBoa0d1hHVPS9Pgc5kY0C2/C1117m0OlqRzW1AbpFuVRdrbKL49WT00dL9d+onDsPoHtGItB0+VzPm56h4MVkljbiAN7j5lzbnD6rKpjpYmYhwTb41pmHP2ux3FfbdVl2p/5kn5HI3+N4eqr9ktHQHVeM1HUr3iGRzr+CtcdR5b4nVSOm9hxub8LYeR8EfU/tOnsdVr3W/Ysk8OrMMEv4cbsvwmKvbZ3/AB2VDG0jhPEsvqqBxdJTnbyFbJcBNG8ExWIXWOZGTTKPWYaU7X4atF9edIT4W914yLfZV7Kuj1Ph+QjOC7NbY85rKJzD44Wm+vnMM7gPK2p1vWOpIXsPa6011VVvqastHdyhqh+5Dz2ZH8DMkyXpzJjcdvzhennobpJWiksDwF5uen/BZajGY3Bp+YL1I9EmBPiZSgsPyjstnDq93s+cPJ71+Rs7q6HoDPgsQLPoCtnX/Szaikk1Qg3B7LN8ucI14RENP0hVPVfT7H0zg5vI8LoJ43tjnlNXKfgz+medPqky1dUNqSyk7nsvP7PHLSvpcRme2mcLE9l7FZ2Zaw4nFNeG/PZcVeoXJBjXzvbSngn5Vg3Yuke2eMeROMIps4Bw2GfCZdMjSLFXSPE/xILLrJM0ug6nB6t/tQuFieywbDaOvbWCMsdufCzpYrTPVKuejOr6NxDpibFamzISblXrpfJOurahrmUTtyOAto5SZWTdRGJ76dxuRfZdYZJelmLEmsc+gJvbfQrOPjP2RyfP8xBUvs0VkTkxidHVQ3pHi1uy779MHRtdhzafVC4WI7K9ZX+kmlpzG8UHAH0LonLfI6DAYoyKe1gOy6nDo+Hzj5Ny0Z3PTM2y2hkioWNeLHa6z0RPMeoDsrJ0/g8eHsawAC32WTUzo3RhoK6fEqUUeY517nLaLe2CYuuGnlXCjZK0WIVbT0sTxuFWR0LLbD+FfUUmZM7/APpSwsc+wcqiOACxspHUxjGpMjlLnaVJEqzs2ieBjTtZVDWgDjsooWaTf7qZPb2V5abELgNro1NPdRSvO/6JsTzexS+qYyXRUvDCNvKhljbuAFKDtcprg0g//pRHpjFHaKNwcDcBSRvLRuU97W34USk9iSK0ioieDb4k6RgeOLqna8t4U8Dy9lymjilqoBwFCyGx2Kr5Yw43SNpgbFNbEk2yOmaQRcd1VaXHskZCAP3T3ODAFHIYMQgG4QmjG3sEIQmP6IHKkTG8j9U9IPS0I/5SmJ7/AJSmKSIoIQhSACEIQAJ7PlCYns+UIAVCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEJHkgbJGuJNiUAOQkeSOCm63eUDZA/5ikQTfcoTtoZsEIQl9kKux7OP3SpgcQLApry48XTCVLY5/wAxSJGkkbpUntoWP0EIQoX9HAhCFH6sRvQrXACxCcT8N/smFLc2tdTw6I2xEyV402TnkjgqJ++55urEeytOWlshkNgVT73uqssadyoxE08NUyaRSm3JkIa4hPiYSd1IGdgEjwW8CybOS0XcVOLRBWxNDNlYMRpBK4mw3Kv05kkbxdUM9OALkLOuft0dHi2enZhHUHTbakuu0FYL1TljDiEL9ULT+oW4qulbIT8KoarCGStLRGDftZY1+MpvZ02Fy9tOkmcj9bZAxVFS9wpGm9/pWL03p8iiqw80Q2P5V2VVdC09Y4l9MDdU78sqAM1/hRfzZZ0uPbZu2+TydWtmisvMs24S5gEAFu1lvLorBBDCz4e3hNj6Oio5QWQAWPhZH09R+wWtLeFLXhtHPZfL/ni1sulPR6IbAdlBWQv9si3ZXmCON0QFkyoomuYduymdDSMGORqfZqjrjCpqmN7dPnsuds6Mt5a9kzxDe4PZdb43g7JnOBYFgnW3RVNVU8jXQA3aeyysuh6PQOD5iNOkeX2eeWEtJJI4wWsD9K5Kza6efQOm2AsSvUv1HZXwGmmkjoxex4C8+/UJl/XRVM7Y6V1tR7Lm8ilo9x8a51xcXs426tfM+uMABPxWWa5J4PJ/icb3M5I7KTGsuak4iXy0p+a+6z3KfpqKirIjJDaxHZZs6m2es182smj1TO2PSNh8cMNO54t8I3IXWFNi9PQ4UB7gFmrkLIrqKHBqSLS8CzR3W08dzX9jDiBV2s3z9lpUP8cds4Tk+Eyc/IWu1snzwzFhoqaUie2x7riLO/NI11TLF75ILj3Wwc/s3p5xLGysNjfuuUeuuqJsTq3uEpJ1eVm51+0z0nxfg1jKMWi39XYgMRdI4uve/dYc6D26jVburyZJpnFrz3VLUUtnhwC5iU2pnsmJhetaA1XtU2m9laW1DqmsAB5KqcTbIyH4VRYJSzy1zPhPzBXcXe9mdyWRHHi9m2sqMAkraiNmi9yF2NkHlc2RkUzqYH4R2XP/AKbOlWV88LpIbnUOy9A8h+g6aKgieacfKOy6rEpcoI8V8m52FXs/+GQ9A4HHgtOz/L0hoHZV2YPWzKHCHwslt8B4KuPVhpcAoHOaQ0hq57zUzIe6aSnjqtrkWutOE/x9HjHI5Mcyft/01B6iMYqsWq5msc43J4K0jgmXuKYli4mbC4gv8Le9RhB6prLvbr1FbRyh9PsNfNFJJQggkH5VbquU2cnl1LHfsy3emPJ+sqBB71Oe3IXWmB5Ltbh7C6Bu7fCu2SuR9NhUUT4qQC1vpW8KLogR0oaYALDiy0YY0rFsxrObhQ9HOmJ5MRuiNoB/CwfrXJlrad4bTC+k/Suuq7o5guDCP4WLdWdGUboH64R8p7KvdXKr6TYvLRtvTTPMn1BZOVkFNNIyA7X7LgbPrp3EsDxKY+24WcV7OZ/9CUEmHTgQt4PZeanq16BpIqyqLYh8x7LMnb6M9b46uOXStHHGGdc4hhWIBrpHCzvK6Q9PWe8uHSRe5VOHF/iXNfV3T5o8Ue5oOxVb0x1BU4MAYZS23gqFZaTLOTwjnD4erOSvqtionQasQI2/OupMqPVNSYq6JjsQvcgfOvEXpDO/F8NqWNFc4W/1LozIH1F4s/EIGnEXW1jutPFylI4bluBl6t6PcnLfNClxmnYWzargd1tLBMRirGNNuy4L9KObMuL0sAnrL3Db3K7Uy8xmnq6WIiQG7R3XRYt3seS85xrx9vRsCm9prA7TwqiGVjiQAqCKZphADuyko5CH3JWzXPSOAvpcmV2sEhNc4A21KMy3OxUUwncbtVqNnsZllLT7KjUPKljeAbfZWw/iWfNdVdLUNb/4h7d0r6WwhjtlZ7rdJ/RRyVYZ3KgmkMjrxnZRvhkI8qCdqRchX6rsqmVIJ5Svlba6oYxI0/EpHyfBzukjYpE8YpsZPU2KjZWi9rqOZzSSCe6pnwSX1BLJepNOrcei6sxINAanivDu6tDGSN3cU9hkPykpFJFGacS8R1DHG6nila4WCtFP71+TwqulkLJAHOSuaSGJ7LhoKc/5VH+Lj8obIH8FROxSHJMiqGnlMhaXOUstibOSNADrtTP9h+9dkmn4dKxzrVgFJIbfSVkliBxsse63jc6jk0g/KqWTQ5IZLUonKPqFcRHKB4K4Vz1q5BUSt/1Fd9Z34PJWCVui+xXGWemXNVVTSOipibk9ly+ZhSlIwsmn2Zyj1DSPqKlxDb3KyjLLKSXqaZsn4e+45asqw/JrEq7EAySicRq8Lpj00+n2QVEIkoNiRy1U6uMlKRRWE/YxzJP01SzSRh2Hjgb6F0n0b6dW0VPG40TRt+Rb5yoyIwfDMPjmfQtB0jsthxdC4ZBGGx042Hhb2PxT1tluvCaOf8OyUhbBpdTjjwrD1ZkcwMNqUH/2rpOq6bEMumKEWSnoeKsYDNAD+oViXGaRajgeyOGerPTg+rL5G0I4/KtKZsemuaKne78CNgfpXqVWZVYXNA5ppG3I8LWGamRNJVUkmihbu08BVZ8c0hY8c5M8aOvMk5sNxF//AA2mzj9KyXIzpefDMYhGjh4XVeefp6kiqpXw4f3PDVgWXWUNXRY4wyUZADx2UCxnGRFPAlXI679IvuMpKZp7WXXuEMvSNcfyhcu+nPAnYUyBnt2tZdR4SSyhYP8ASFq4tPZfxaf6TVZtFwqGFpL1c9LJGfEVQVgbE4+2tquhrsvdJFQzS0blTRT76blWxk0hPKqI5ARdvKuRqQ2Nfs9lbJIPKiFUBwf6ULvcd3UUkUltuU9wWh8l69Dquq1A7/wqX37m10k1PP4TGwSDcjdQSiiWEfYuVFY7fZVTfmCo6H4Rupnz24KilHXYyaaeioeQG8q14nPa9lJNWOF26lRzubMNyo3P1JI0SaKJzy51j5VwoJdLQ0lUUzGNGoFQnERBsZOFE8qMWEaW38MnhmjA3KJp4yLLEpOqmxGzpwmu6xhtvUD+VLDJi/pahx9sltIyGsqGNBsrNX4i1pJ1K3VfVEcrCWzAqxYn1EIySZeybbkJI1MTjbG+0XWtxaJt7lWXEuq4KMEl/HO6w/rPMKHDIXP/ABIH3utT9Y580lM2QPxBvH5llZGXFHV4PCStetG4sazXo6EEmota/dYF1X6kaHDWu/421v8AUubMyfUeyIPEOJDvw5c4ZweputjZIYcTdyeHLHtzo76OsxfFJzXcTues9XtBHVFn+Jd/zq+9NepuhxVoArr3/wBS8hq/1T4t/ifxYo62r8y2jlB6l6+rqo4ziRN7fUq3+ejWj4i4x36nqvh2bFPVR+5+I7fmWO9dZyw0NPJpqbbHuubOjs6pJcJbI6u3093LFMzs555WujbW3v4cpIZ6ZTlwKhL4ZXnPm4cXjla2pJ2P1LkrNHCa3q/EHtijcbuWZSdW1uPV5jdMXBzrcrY+WmUkPUk0chpdRNr7Kb/J90Qzw/8AHfZovLTI/EZpmCSicbnu1bzwXIl9PhOt1HYhv5V0zlf6bcIp6Vks+Htvbu1Zf1NlRQYfhj2w0jRZh4CpZCk4to1eO5CmmxRb7PLz1K9BHCaea0YFr9lxDmbTugxCQeHL1D9ZPQkjIJ/apz9XAXnJnD0jUQYjPeA7PPZc1kWOLPZ/HLFl6SNa4cHPbaygxHBp6q5awrIMEwkNk0yMtuslpOm6eSK+gX/RZyval0egrjpuBqOLD63D6xr2hwsVu/IbMCqwariEkzm2eO6xrFOj4zIXe2P4VnmqpenZdULyLHsrcb3Z2YPIcWtfD0u9P+f8ENPDE+t7DbUuoei80aLGqNlpwSW+V4+5NZzYhS18cLqx3YcruD08ZmVmJww3qCQQO6lcm0cPncfHemjo/MzE2TUz3tP0lcZep7qCrpopfaee/ddT9Q4hJW4R7hJ3YuTPUrTvmbNqHF1G4NvoqUYa9ji7NXqfEX1Ul3uPxeVYOgMVqXYm2WQn5+6yjrTCGVOJyRyN21K00OEw4bVtdG0ABwU0KjpMbj3KOkdh+l7q2GJ8DJZbcd13B0PjVDiWCxtErSdAXlrlpmIcCljEM9rW7rrjITPl1Q2GnqK3bYEEqyoOItvFWQX06P6l6OgxWJz/AGQbjwud8+8tm08L5I6e3P0rpvpDqjDMZw5rzM11277rX+fkWEyYfIRpJ0lOtpjKCZNxXLZGDc65/EebuceESUT5W6CNytNnCJavELBt7u8LpT1A4dBNVStgaDdx4Wt+hcvZsTxEF1MTd3hV68SUn0WeW52N0GkzOvTH0E+evheYO4+leoHpD6MNLHSkx2+Edlyh6XcnRHLC91F47L0P9PHQv+HRU9oLWaOy3sPEcDw/yXMT32dFZe4WIsMiFhs0Kr6pwt0sZDW9vCufRVCIqNjCz6VccYw1r2/L2W+606tHi9mZ6Z2zRnWXRX4yOTUz+lzznXk82uilDacG4P0rsnqDAi+NwbFz9lrzqzoRuIB4kpr3HhZluPs7biuf/wAfXZ5bZyem+epqJHNob3vb4Vq/DPS1XPxIE0G2r8q9SeqsiqLEJzroAbn8qtFL6acPZIHsw0X/APSs54jbO3x/M1GGtnK+QXp6moXwxSUPBH0rtXJbKKmw2njc6nbwPpV46GyTw3C42P8AwLQ4cfCtodLdMigaGiGwH2VnHw2pGLzXlLyamovsvHR3SlJTtYPbbsPCzekweGOEBrQP2VpwWm9rSNNlk1A3UwC3ZdHjY/w8f5PKsss9my1y4ZIJPgVRTU8jABdXY0N/iLe/hRSQaBsFsVRUDGnlJ9CU2oEbqvgktz/CtzA8OVZBquBupt76KVlql8KxwbINKiZS6XXspYgT2PCnawe3uOyT1ZXbEjYHC6CLGyGkt2ahPjEVbZBLsSPsmxcqd4bYpgaBwFIDi2PIs390mm7dV0hJ7lI15JIB2skb0O9dIWwPIUMnF7Kp0t8I9prjwj2Qe6RTRsc8i4VRG3S3hO9oM3/pOaARuEje0RuW2IGhxsU8AAW8Jl9JNkFzj3UbfQbHqKZwcbAJ2pw7pLAm5CaAjPlCVAFuEJPZDemKGl3CNBSx905NfbHfBga4HhPQhHqwEf8AKUxK5xuRdAaTuApYpoBEIQnACEJQCeAgBE9nyhAYLbhKABsEACEIQD6BCEIG+yBCEIFT2CEIQKCEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEAIQCLFAYAbpUIE2hsnZNTnneyanJDWwQhCXSI/rBCEheAbWSdD4JinYXTQ+5tZNJJ5KVnzBGkkWEtIehB4/dCia0N+MEIQo39HAhCEgjWxDwluDwUIT00iNoQjUdxayZIzwpEj7aVJCZBOvcSAjayRjCFIRvwlDdWylc1ogjV32I2MFt/smSxnfYqdjLbAJXMHBHI8KOUtluuPr9KX2B4/pUlRTl1wAri/4Ez22uG4VeS2y7Cz1LNJQG5NkjKEE2IV4fTNd9Kglh0AWCrOHZYjkaRSsoIRYFqmbhUL2WtymvmczgFS01S9wAI/ZKq0xkrpP+lDUdPROdfT3TIsK9g3AV8jbrFyP7TaqmaGmw3T1Qhqufwt0IEYseyme4PYVFNG5r7BEYeTpPdNnQJ+VbKGroQ9xcrDj2CNlY4aeyzN1EXR6irRisQAcCFk5FGzSwsxxmtM5+zZy1ixame0x3uD2XH2evpvFW+WRtGTcn6V6K9QYOyrBaWj+FrXrnLKmxKFwdTtNz3asHKxf6j1LgecVaSkzyh639NjqWR8n4M7f6VhcWXUmAVGv2iNJ8L0lzJyJhfSSvZSt+Xb4VzNmnlJNh4lcymtsfpWJZT6s9c4XmlZpJmkMI6/d083Q6a2nblQ9U59kUrohVDi3zLEM16CvwaeUNYRZx4WlOqup66OR7HPdt91BNaR7BwkHkpMyrMfMubFnvDZb3J7rWrqyWepL393KFuKSVc1pCVXU1G2QByxMyX09M4/D/Fpj4GB7rorILbgKaGNsLrFQYjWxRjlY3p7M6aOUq69FDUUxm+EBXTpPpl89XG4R3u4dlDgrBiFS2Novdboyny1lxSWFwhvcjstbFpfRwfPZ8fWW2bf9KPQpmngLo+XDsu/srum48OwZlm8MC5w9N+W8mECFzoLcfSur8Eh/w/BRcWszx9l1uElGHZ84+WZjnc4xf01L6huqBhNHK1slrNK4ozDzKmlx58PuX+Pz910x6q8bfadrXHuuIuraiao6mIFzd/8A1T5o4qdnojpHICib1NUw6xcuIXc2S2V1MygglMP0jey429F2CyVVRTl7fC9JcpsAbFhEA0D5B2+ysYcG5nOcxnRVTZkfRPTsGHQNaGcfZZb7UTI/lCpcPw8wNvZVj43SM0hdXjx9YI82yb/y272WXGZI2NcbLXXXePQU0L9TgPhKzrqyU00DyfBXPWdvWP4CCW0trNPdZfItpM6zxzEWRdE1dnz1jRNo5me6L79155eqHEqXEKqpLXA7ldDZ75oTPdMz8QbXPdca5vdTSYrWTN1E3J7rjcjI/Z7Pqbxnhv8A+3j0aE65wls9c8xtWK1GFVELbtYf4WzK/CnVNSS4Xuqao6XiMJc5g/hZ/wDkdnbW8L/9fw1a+praWcENtZbUyK6trKbE4bu+sclYj1Lg1PTu2aArhllWQ0OJxk7WeFq4d5xPMcN6wl0eqHo4zDnMdO10nZvdeieS/VzqmjhJk+gd15Kekbq1kckDWv8AHdej+QPVPu0sA1/SO663Du6R4N5Rxyjvo6zwjFhNC0l3KvFG8TfKsF6TrzNSMIKzPBZNPzLoabPbR43n46qk9Fxa0tsLd1URyMAs4cKMWO6a5lyTdXoS0jnbY7kSvLJBwqWqABIa5OkkMbbhW2uxEsBBSTt0i1jUORUDEfY+DlSMxlp5t+6xrEcZZCC5xWLY1mZRYWT7kwFud1m3XpM2a+NlbHejaTMQifvcIlrYDy4fytDYn6isKobh1aB/7lZqr1V4Kx2n/ER/vUdeWosWPD2yZ0S+ohJ1ah/KGV8Y+EkcrnSm9VWBvdY4k3n86ucPqUwGQBwr28c61bjlxl9LC4W1/wBN9+/DLbcb/dVFNDG6wuN1o/CvUNg1QQG1YO/5lm/TGaGH4lpLJwb/AHTvzwKWRxN0VvWzYUsUcUesK2VuJtgubpkOPxVkQDXdvKt2LNfI1z2FRzu/4zL/AMSUfq7KqLHjI6xd/avGHVwkA3WFU75BLp3WRYK+TYu/pQK1bGOv1Wi/SO1NvdRsl0u3PdOadUO3dQWLDcqWN3ZA4uRcGvaY1a+pIG1FG8AdlUMqS74bqOrtLGWeQpJWKUAVfZozMfpF1dK+0d7g9lpfrTJV+KOdekJufyrrrFemoaqS7mjdUTMu6Go3fE3+FkXabI7MX2/hx3gHpytUNf8AgDe/5VvzJrKSHBRGZKXTa30rauH5d4ZTyAmFv+1XmHCqTD7GFgFvslojqRF/i9lXhFFFR0rWN2sFLLUMby7dUsuJNjZoHhW9+KXksbrZrkoxLMcSxrWivkmb7tyO6rKeqY9gBVnNS14BspqOrsbWt+yJ2LQ//GsSLu57Wi5Ks3UVPT10Do3NvcFVFRiA9ohW99Z7jrOKp3WdD66pKRqLMrKqnxgvc2mve/0rXmH5E/hcQEraMizudK6ljwqlrh/mNBv5CH9JYe27xC3+Fnye2QZFTctGrugOipsHdG/2iACOy2nSYiyOmbGXbgJj6Clp4yxjAD+itk8Mkbi4HZXsWZYxcdpdovT8WjYPmVLLiLJX3urJNNIDu4ogkJdfVdbVdnRfeEmi+sq2gchOgr2h1rhWOer9tu7rKhmx1lMS4v8A7UjuUY9k9WA5R0kZmyvbccfyqllQxwuAFrubMGjpT8co2+6jZm5hrDpM4/lUZ58F1sjs4q5fw2Q+Rrmnj+VRz1DIz2+6w6HNLDpxYTD9bqoi6tp6w6mSXv8AdR/50GNr4+5PtGQuxZsPJsl/xWNwvdY5WVxmAdGVRVeNmijJe/hQyy0/6TQ4+U5JJGUT4k0ki4/lU8uMxxtvqH8rWuP5sUOGlwknAt/qWH416hMJp2kGuHB+pU7M+EV2bWN49kXa0jcOKdXQU7STINh5WHdRZnQUhd/nt2+60X1X6mMMDntbXjY/mWqeufU7QsL7V/P+tZc85ex0eJ4vLf7ROlMdzsp6ckmob/uWO1fqEhjkDBVjn8y4z6t9T0BLtNf/APNYVL6lxPXNYK8nf8yWOfo6SnxiEIb9T0h6WzbZi0YtODf7q5Y31UTRmX3O1+VyJkBm+cY9sGpJuR3XQcuKSV2C62km7PKkeamvor4WuqxdGq/UFnK/A6WYiota/dcS5xermWhq54RX8E/Ut2+sisrKSiqXNc7g915Z+oXrTFIcenZ7j7B57lZuRkqR2fA8RXZNbRvvG/U5VY08t/G3uPzLXOYGZlfiMLy2Qm/3Wk+lOq6yoqWh73H91nEsgq6MF/cLEvyOz1jB8ehKtdGM4l1Vibq3WHH5lsnJfr7EKeuiMjzbUO61/WYVE9+rQr30hKzDqlpZtYqvG5SY/M4T8cHpHaXR2bVQzCWs976R9Sp8b6wrcYlDQ8m58rTvRXUzpYmRBx48rcGXmAuxyWJxZe5HIViFq2cBn4P4m+jK8rsAqsSrWuewm7h2Xafpqy/p/wDKdPH9I7LSmTmWwjMcns73HZdZ5NYC/DmRAMtsFp0TTR5pzd6pbNudPdL0tPSs0N4HZUfWmCxOpHt07aPCyjAaZ7qRpJ4CouqqQupiPsrdkl+PRxGPmTeYnv8ApxL6psvI8RpZ3Nive/Zed+fWURiq53+wfmPZes+dHTja2mlBYDz2XE3qE6Dha+of7Q79lyuZW/Zn03/+P8qFqjs88Mc6c/wWrc0ttb7JKPFYoGhpKzXOzBjQV0gY21rrUlVUzibSL8rLUOz3OqSlEymrxCCWIkEcLXPXFaTMWxjusuo6aqmpy4+FiXV9E5kvxDkq5VFIqZuL7VtjMua+rGNxtYT8wXoP6RKeqqaSnLm8gLgLLOKJmORlw+of816MejM0zoKZptwFfjBP4ee8tQqt7OlZOnpZcCB0fR/0XMXqR6YlayYhh3v2XbOGYPFWYMGtbe7dlpXPbKibEopXMgvcHsrCx9aONjnVxsaf8PMjrbp6aPFZPgOzvCxLHKSSkjJANx9l1nmBkDW/i5ZBSd/yrVPW+StfTh16Uiw/KrMcfo3cPloLS2aFo+pa7D6u4c6wPdbYymzirsOq4gZyLEd1hnUGXVVRyuvCRY+FB09gVbS1rQ1h2KHX/C5kcpGUOmd55SeopzMOZHJWfT+ZVmY+bn+OUT2ie9x5XNOXcONe0xrGustnYX0zjeJxaXRuNx4Qqv4c3lcjFb2zBOsaSTHsQIIJ1OWw8hsmv8SrInGmJu4fSrz0zkriOIV0b30pNyOWrqb035GPppIHSUg2I5arVNT2cxnctCMX2Zj6eci2UUUMhpiNh9K65y46KiwqCICO1m+FaMssv4sNpI2+0BYDstsYHgzYYm2HAW5jUaR5T5DzEbJNJlzwCL2mNb4V8OHCpi4Vvw2jLXADysiooRHFd3haSqbieX5uV62bMYxLAWEEaVYMU6Wifcli2BW07X8AK0YjRl4IA7KOWNsZRykt62a2rejqR8ly3v4UuH9G0Iduz+QsorMHmDiQ1Mp8KnDwQ3ZQPD7+GvVyra+lvpOkYGuDo28fZXikwBrW7M4+yuOH0bg0B4V0gogRYNVmrG1/CK7kZtfS1QYcWOAAV6wqmc0C4UsVEy/AVbBE1guBwtKqn1MfJyXMeIGFn7KjqYAqwvLdlFMC4bKxNepnRfs+yiEIvsqmCCwuQhrDcXsqiMADYJo7THRxgG1+ykttZMaQDcp4NxdOTEGlgAumqQ7iyjT0xYtDXNvc3Te9lIdxZRlpa42TtoemtgRcWQxg1ITmDe6Y2K3scnMG901ODwLD7JNoZLoRxuU0uDeUpPJTHOBOyZtkLehwIIuEqa1wGxShwPBRtAnsVCEJNocmCc1oIuUBlxe6Vo0i10wcAaG8JUhcG8pHPBFkqTF0xyExvI/VPTwa0IWAm6UCwshCkXwQTQPJRoHkpU0PBNrIGNi6B5KA0N4SoQKmCEIQLtAhCEC/QQhCBNIEJC8A2Sg3F0BpAhCECghCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEDH9Gv5/ZNTn8/smp6+DZAhCEoJCPJA2TL3Nynv+VRuNhdBNCIqVnzBNa4u5TmfMEj+ErWkPPH7oQeP3QopDP/IE1ziDYFK4kC4TCbm6ja/oooc6+5TnOsNimITQF1O4ugPIO5KY55BslaSRcpH8EaTJA4HgpU1nP7Jyb7MRxE0tPZAaAdkqE5TaGqK2Oa5oG5TZHDkHsi4HJUcrt7BO9mP9UNe7WRulaRYC6ZcHgpzQ0b3SpewmhyQ07XchOZYm90827J6ghj2QOw6M7uCRtC1jvh4up3SnghAcLXKf+NDHL1HRMa0WUdU5tiLp4eAdnKGf4jYFOjFbBTKSSIudeylp6UXBPKf7R+/8JwJYb8J7jFoG3/CSUARW+ysWLQl5Nu6u81SSzSFbqka73CzcitFiiTUtlgno9TrOarbiWDRSsJMY/WyySpg3uAVba5jwLadrrFuqWzo8TKktdmvuqekKashe0wA3HhaAznysoX0sjxTDg9l1LjDI2QOL/C0vnHVU0dFLrcPlKwc2mJ6T4ryF/wDkxjvo80fUtl7TUMk7hEBZx7LjvMLCI6etlA88Luf1a45SRvqQ1w+YrhPMrHoH4jMGu+pc/d+qPrrwzIg4R2YzS0QEgtyrvSs9pm/hWrDKttRKC0q7ym0Hw+Fg5O22j1yF1ca+i34piBhcdLv0WOYniVRLJYE8q6V0M0s5BHdRRYG+pmA0991Vqq3IzszNVdb0zKMoMGqMTxOMOYTchd0emzKsVMdPI+lvx2XMHp26HmnxKA+wTuOy9HfTL0H7VHTmSAj4RvZdBiUvaR5B5LzirhJ7+Gxstcu4KCmY/wDDgWA7LKOrcUpcDwhzHSBtmq9vhpsCw0P2FmrRGfWaFPSxSwR1A2uLXW5CPp0jwvIzbM7I/JL4aZ9R2PR4pUTMjlvcnhc2P6Tnr+oNYiJu/wAfdbU6q6nGPYi9jn3ufKuPQuX7cUr2SthJu4dk5xMnPt9DdHo16RkoX07nQ247L0Pyvw7ThcA0/SFyX6c+hZMNEJbCRYDsuxcu43U1BExw+lXcGH7nA8vkynBpGURUP+Vs3hMFK4XsFWCce3ZqgfUBrfiXU1JepxfvKUzA8znGnoJXDYgFcWepjqx9HHUD3iLNPddk5w4gxuGTlp+krz59W3UHstqQZLfCe6xeV1+NntP/AOPsGWROL0ch529e66qZn4jlx7rn3qHGm11c8ukv8XlZdnN1AX4hLaT6j3WqGYg6atJLu680ybmrGfZnjPHaoj0XtsEb33tyosUYIaVxDeykoyS5pUmLxsfSEE22VBWNyO2uwVGrejVHV9a91U5v3VJ0jUysxBtj9aq+sYNFW4g9/Cpuj6aSbEmBrTu8LcwpdI8556iMK5bO1fSLV1T54AHH6V6W+nGapNNTgk/KF5v+jvCagzwEsPZem/p1wmRtLT3b9I7LscLbSPmjzJqLkdM9AOeaSPUT2WwsKjJbuFhPQlHppowRZZ3S2gaHDwuhx5NPZ4LylilY0isfIYmAkqndiGm+6c6VszbEqCelBFwrkr0jAdblLsWfEWaLudbZY/i+OUsQdqmA/dQ9V4yMJpXPc+wAPdaDzNz5pMEfKx9W1tj3cqlmV0dHxXHq59mdZg5j0WGskDatosD3XMmdWfb6AvENfa1+CsKzb9UVJJNLGyvbwfqXN2aWck+OOc2nqNV78FZdlzk9npGHxFapSRlmY3qkxGmMnt4i7Ynhy1B1B6wsbgncG4i/b/UsN6iixjHC4gOOolYdieVfUWIzF0cEm/Fgo1Nstvi6o/w2nSetLHBKL4i/n8yyTC/WnjLQC/E3gbfWtC0mRfUhZ7r4JNvsVZeoek+ocEDhJG8Bv2U0b/Ulr4mE/iO1Mv8A1mzVM8YmxY7nf410/kl6qKav9sSYoDcjly8aKfMPE+m60NfUFul3lbuyQ9TVTR1MbH19tx9SJZaf9G38F+vSPczLvOTD8YgjtWgkgd1sehx6nxGmGiQG4Xmz6avUfT4j7DZcQbuAPnXamU3X1PjMEOidrgQOHJqym1o4zlOE/GnLXw27RULZJNVlfaKmELQbWVtwCRk8bXNKvcpjjhFypoz62cBlJQnoeyYAabpJdxqAH7K3mrDZDc7XVTHVMlZpDk5WtMqpLYjZPZN3FD62Mm1+yjlaZOFRzMewlTLIbiLp/kSKqSZjviuozisVP9Y/dWrEsYjooSXuAsFrnrfNuHB2vcJ2ix7lVbbVFm1i8dZkfw2lVdV08LjeYbfdW6r67o2Depb/ACuXusfVNT4dI8OrWix/MsLrfV3RSNJNe3b/AFpK8jRuU+O7W9HZkPWVHVOs2qH8qQY/Rg6jUN/lcSYf6ysNppSHYiz/AHp2IeuSgiNmYg3/AHq9HM6Ly8acls7dHUlGGbVI/lLB1PSg2E4XFmC+trDawaX4i3n86yfA/VJQ18o0VzTf/UmTy0+yCzx9Q/p1bLjrJj8Mw343ULsTAds/+1pXpzOqDEo26ahpJ8OWTxdel1P7msWt5VSzI6K0eHlvSRsyk6qjpba5QFXN60o3NsZ23/Vc8dYZyw4QHF1Q0W/1LXOL+rikw6UxmvaLH86ovM0yX/8AWXd3o7Eq+p6JzbioCs+IdV07b/8AEBcgv9bWGsOh+Is/3q3Yt618Jcz4cRZ/vVrHzey9j+KzizrSp6ypg8j8UP5SR9Xx8ioH8riuo9aGGOkv/iLOfzqvoPWVhkjQ017P94WnDPSX014eNOS00dc4r1oxg2qh/Kw3rTNCHDaN0hrALfdc09SesOhbFeOuYT/61rDr/wBWjMQp5IvxrbG/1KDJ5B+j7NTE8ajHXR0N1X6hoqcvDcRAt/qWCVXqd0zlv+J8f6lx/wBe+o+RzpDBWjf/AFLW9V6ha0zuJrP/AJLnZcg/bey/b425LfqejWCeqNnuBrsTB/8ActrZdeoCmxMsDq8G/wB15JYf6k6iGdpdXd/zLdWTXqgAdEH4g3kfWiGe99soT8dcf4eseA9fUVfTNe2padvKtHXPWsNPRyOZUcDbdcw5T+o+iraVjHV7SSO71lvUmZtPi1E8RVLTdp4KklyDaIsfxrV3towbPrOipwiWYw1ZFr8Fcr5h+rLEqGZ8YxJwtf6lsL1F1tVWsndE4m4K4izhhxmOpke0OG5Wbk5zbPQeI8fXSaM/6n9YVcS++KO5/OtZ9VeravqZnNGJOP8A7lo/rLEMVhkeC93PlYXUzV9RMXOeVmvLnJ9M6+Pjsa47UTeWMepGuqGlxr3X/wDUqHAc9ayrxVgNc4/F3K0jWNrWxE3PCd0vV1MGLRlzzsfKlhkT1vZbfB6q/wBT1B9HGZkldJTtfVXuR3XoT0DO3FOnWODr3Z/0Xkx6Leonw1VKPc+od16k5FY4yfp+Nr3fQO6tVZLkcJzmFPH+I0x6xejX1eGVLmx8tK8pvUhlnVuxuokbAfnPZe0PqQwqDE8GlDWAktK84/UR0JH/AIhUOMHc9ky2yT2dL4lH8k49HF3TvSFTR1bQ9h2KzmHD3spACzgK/VXTdPR1d5IwLHwm1kVPHBojI2WTfYz6A4zC3QtIxarw9w3DVBSl0E4JPdXusi/yzYLHq6oNPMXO23UNM2x+bx8fwttGzcu6wyVMTNe111/6c8EbiAgIZe5C4jyxxyF2IRM1jkbXXffo/bT1n4XcHcK9W22eK+Q1qpyOtMougwYIj+H8LfvR3TLaBjD7VrDwsPymwWIUUTmM7BbkwXCgYmgN7eFvYtbcdnzv5RkR/JKKLlgrBHTgW4Cp+oYGzQkAdvCutLRiKPSfChxGlaYjqPZaDqlo4HHtlG/ZozM7BhJTyXZzfsuQfUN0050dSRF2PZd1df4MyeF9m33K5Y9QnSr/AMPUO9o2seyycujaPf8AwHmFTNbZ5keoLppwrZSYvK0HXYa2KsAc36l1j6kMHNPVTXjtz2XM+NU0Rrud9S56cFCZ9J8Tm/ngpFThNDEKQkt+lYR1/TsEpLW8FbAo/bjoy3V2WDdcMD5HWKmq1s6GyXtT2W3L+kk/xeNwb9QXfHo5qKiN9KwE9lwj0Eyb/FoxGy4uu/fRxhc8opXaDfbstbHjs8r8pyFWmzvjLLDJMRwmIuZe7Qr9juUceMQO10gNx3CqcjsFqHYXCHxHt2W68H6Vjnh+OPt3C2Kcf2XZ8/8AL89LEvemcddaemiKoe9ww4b+GrTGZnpiDYpC3Dex+lelWJ5eUU7SHQjceFr/AK/ycpKmJ+mm5H5VYdDSK2L5V7NdnkXmB6aalszwzDjyfpWG4R6b6/8AxENdh5+b8q9M+tsgKeeV4bRX/wDasWwz06Qsrw92H/V+VRf47NteSqUe2c1ZT+mKonZHqoDvb6Vvzor0r/5bdeH9vyrfeW2S9FQRxg0tiP8AStt9PZfUcDABTjb7JY4zcjNy+fj67bOdOkfTJDTzsccPG3+lbsy1yjgwUR/8IARY8LZmE9F0jCC2EfwrzSYA2CQaI/6V2rGaZx2fzqs2kxvT+ACCJoEVtllOG0WkAFqTDaHQwfCrrR05Dt2rXpq6OFzc12ye2LS0wYdQaq33tIsFKynYyO11SVDS19m8LQjWktHPZDdq2ia4eeVFLSMf2ToQbAnx5U0djsSn/jKcK5JlBLhrH/QmswuNrgdCufss7pHxAC4KeqIv6W4ScSljw4AAhqqI4RHtZSMIDbE8JkkhcbDhPjUv4TJykAeAdgpWynTwqdPj3FiVJ6pDZQTJQC7f/mkkFhb7pS8s4UcjnkX+/hQWjFBJit3cqljG6eFSxBxNyFVs4USY2QwkN5QHG1wUkvP7ob8qeRNjtZH1JEwu1EXT0vsxqkCCy++lA3NlIAALJ6HqT2RCK/lKGFuwCkuDwUE2F1FKXY72ZGdjYpDZouE4m5uo3uvsm+zI5yAvJ2SITXuIOxS+zIXIclZykG4Ss+YJosex6eGtI4TE8EWG6CaPwYXb2Dv7S6nDa6jcfiul9w9wnJf0kSHkk8lIm+59k4EFOF/greR+qemN5H6p6eloa2CCbblBIHJTHPvslImxXPvwmjY3QhLvoZvsfrHgoD2lMQkF9iQG/CEjPlCVA4EIQgevgcJNbfKV3B/RRoFA7kp7PlCYns+UIAVCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgY/oKNSKOxHISp6EBCEJW9ockI/wCUqN/ylPeeyY4EiwQmkiWIkfdPZ8wTWAi9wlBINwhtND20SISNJI3SqJtjQTXMJN04AnhOa033CQNojDCDdK4EiwUmkeE3Q7wkcRvsRHY2QnuYN7DdN0O8JjQqexErnjSAEaHeEBhJFxwUxoH8ANLuE5rS3lLYDgIUemxqaQyRrjuConA7gqd/ylMsD2UsUySP0ia0g7lLc+UEEchK0XKsQSQ8cwutsf7T2utzdMtYGyGhw5U4jSJA5pKbKbiwQ3kIdbVskK18V6lNJ7gN2uTonWeC5SPafmAUEhLTshdleCaZVNczTc/8kyWVpCphU2Nrpj5wUdFqEdiuf8RFlG9uo3CcAXG5RazrKtYm0W64JIhkiFrWVtxOJrIyNKvLowRsFb8Up9TDss22ot1S0zCOqnuZSvc38pXOme+I1Jo5WxuPB7rpXqjD5JaR7Q3stE5qdD1OIxSNbCTcHsufzqm30d/41kquSZ5leq9uJVEtRYE/EVxN13hOJvxOQuBtqXqjnx6fazFTO78ETcn6VyjmJ6XK+Gqll/w51gfyrnsjHej6M8X8hhSktnKmBUk8LQZGq7S1DY2aXHay2F1PlHU4DcGkIt9lrTrCnnwwuBjI37LDuxm3o9Yx/JITguxY3088waANyss6O6T/AMSnbZl7kdlrnp6uknrmggn4l0lkB0w3F5oiYL3cOyfThvezO5Ln4+j7Ny+mPLK1XA99P4+ld+ZN9Kx0GGQ6YgCGjstJ+m/K6GOOGV1KOAeF1T0jgMeHUjWhlrNW9jYzTR4h5RzDsTin9MOzgxk4Pg8g1W+Erg71D5iTtxGVn4g21H6l2d6oq51NhsrWSW+E2XnDn5X1dRi8gDzu8qy4NSOVxW/VMl6KxWXGsVaA693rrj0+9BOrWQzPivcjey5I9PWC1FdjUQe0kF45XpT6YugojhlPI+DsOyd6IzOXu0jaOVHSEVBFHeIbAfSt2YFTsgpmNYOyx3pvpyGjjGiIDZZNRuETQxXsNamedZs/d9FyidaxJVBjmIMhhs124UlTVCOM2PZYZ1r1CaaFzhJay6CMkoFLDxnbekYbnH1DGzDZw6Thp7rzq9Y3UDZHVDWSdj3XXeeeYjIaSoZ+I7HuvPr1UdaGsfUf599iue5W1+jPp7/8acRpLo5BzWxKSTEJSH/UVg+Fzl1Zvf5lfOva59ViD7nlxVjwyK0+q3dea5X/APIz7C8f470pj0ZbRvAjG/ZQ4zUFsBAKjppCIwSVRYtUufGRq7KrBfsdBn0KFPZhHVAM1QT5KvmVOBiqxCMll/jHZUNVQ/jKwNDb7rZ2SfSBfiEV4eXjst/Ah2jx/wAmaVcjsT0d9GtfLTkQ+Oy9K8iOk/Yw+A+3b4B2XF3o76MZCyncYRw1ehWUuFsgw+EBlvgFl3OBU2j5R85vUPY2F01Rfh4mgCyyRhbosVacOYI422FtlXhz37Ddbqh6RPCcuXvZtkzWOLrg91JM724Tfwo4XOb8yhxGtYyIgu7KpbMqKDlNJGr89cafR4XI6M2+E8fovOn1RZi4tS1dS2Cdw+I8FegOdzXYhh0sbHctK4M9ROVuIYxVzOjjcbuPZZdlz2egcLiPro416v626jxHE3gTSEF3lXfoXp3F+op2e9G51/K2Ph3pxrayv1S0jjd35VvLJf0ymGWN8tFwRy1RRls7quX4qzXvQHp0mxiOPXRXuB9K3J0Z6M6Wsp2vnw8H9WLoPLrJrD8Kp49dK0EAdltTAumsOoKcD2Gi32VmH7Iy8zlq6V12clYh6LcPgoi5tCwWH5Vzh6j/AE0UmD0U7oaMAtB4avT3qg4fBRua2NtrLlH1RDDJcNqRoZexVbMkqo72b/imS+Qu9XE8ZPUH0xN0ziMwa0t0uPC1X01mZWYNiQY2Zws78y6V9ZOERS19U6CMcncLj3EcOmp6953B1bLGWQ5S1s9NfCqUPh3H6Wc+64VtMDXOG421r0/9Jmc4r6elZLVkk25cvC3IXqqvwfFogZyAD5Xon6TM6p6SWka+tIFx3UtOS3LRxfkHA+kG9Hs9l31dTVlAx4kvt5WXzYh70YLXbW8rknIzOZldQxMNaDe3ddB9NdVtxKFhbLe48rZqk5LR8/8AO8Z/j2t6MpkJ03BUuHGV0liVFQMfURg25Vzo6X226i1TuLSOV9fWXZJIQyO6seO45BRxOLjwrnilW2CI3dYBakzZ62iwqkmd71rA91DZY4I2eKwZZdyWi05p5r0uGQPAmtYE/MuS87/UTDTiZorDydtSovUl6gWYf7zBX2sD9S4Uzo9Q09bUSxsxAnc91RtyO9nsvA+MucFpGeZxepeVksojrnc/nWlcZ9VlfA9zW17/APetN5h5i4lik0hZVON/utZ4pjmIyzO1TPuT5VN5nZ3FPi7iu0dHu9UuNTSkx17/APcVIPUT1FVbiqkN/wDUtEdBYPX41WNaXPNyt/5eZA1+ORxyew4gi/CkjmsbfwSqj8Ln03nz1MJWn8TIBf8AMVtvLz1E4vDPG2erfvb6lisPpmxDD6T3/wAG7Yc6VbZOiavAawXjcNP2U6vczjeSxY1y1o7jyQzmkroopJaom4F7uW82ZrQDC9pfp8rgLJ/rWqw10dOZSLW7reVHmBJJhob7x3b5TbrX6kGLhwsfwuOfedU1HFL7VQ4c8Fcd5n+pTEaSrlaK14s4/Uto55YvU19NKWyng8LjbNuhxSStmLHOsXHhYd2U4s77ifHVkxXRkuO+qzF4XuLcQeP/AHlY7V+rnGu+ISf71pvqPCcXDnOu/hYhXxYgHlrnu5TsfMk39OqXiKjH/U6HHqyxZ0lv8Qf/AL1f8C9UeNT2Irn/AO5cp0UGIS1Ab7jjuti9A9OV9WWA697dloxzOvpG/GfT+HQrPUBjdezUap5/9yoMXzVxitjLWzP3+6oujcsqysY0GJxuB2WaQZG1j4RIKZxv9lFdkylEjXDRqn8NX4n1Xic1zK9xv91jmK9S1EbSdTltnqTKGqoYnPfTuFh4Wp+t8Bfh2phaRssl2SNWniq7I60Yni/XlZSzXbM4WPlZL0FnbXYa5l6pw3/Mtb4/TSTTEMJ5KtoZWUnxMLkKba+jLvH4v4juXJj1M1jXsjdiDuR9a6iy4zndjsLI31hOod3Lyf6D65xHCKwXqHCxHddUenrOCplqoIn1ZPHLk78sl9K0OAjB70dv47gjOqKYvPxBw7haHzoyggbTySCmHB3st4ZX9Rx4vhcbnuvdoVDm9SUsmGSOLBu0qtc5OOzVxMaFNqho84M1OgvwddIwREfEeywOPoYyPJ9tdCZ2U9K3EZfgHzFawinpo5nM0hUHJp7O2xMWFsUtGDYl0UIqcnRwFjJwZ1LibS0WsVtfG5oDSmwHCwHFXx/jwW9in12zXSNqXEwdHw6O9H9W6lrqcPdsHBeneQ2Pn/A4g1/0juvKr0w4r7GIwDVb4gvSL0/Y26TCogJPpC0MeTbR5R5RxKi30bUzHmNbhsjH73b3XGnqD6cZLUzvEY3v2XZWOMFdQFp3uFzznl0k2Rs0ns32PZaMotrZm+LqNVyRwlmLhjqSdxjbblYE2pkE5bK7a63RnPgwopZSY7WutD4lWGGsc29hdZOVHXZ9H8B6WUpFwqauPcHwsO6yrWxh3t7K7VFaSLlyxbqeZ8oNioKC1zdSrx3ouWWOOTNxuMaz8w7r0a9E2NPeaQF/juvM7LovGPRkX+cL0R9EtQ9klJd/5Vo1rUtHzb5Ttzkep2StSyTDIi7vZbmwirhijBPgLnvJnGGQYTFql7Duts0HVMOgNMw43XU4Hq4LZ86+Q4NluS2kZw/FGEfCVFPKaiM28LGoupKd4A97+1cKLGIpRZsoWyoJo5WWFOnvRQ43hxnY4ELRmfXSQmw2oIhudJ7LozRBOy5eFr3NPAqOropmuDSC1UMjH3BnR+PcjLHzIo8nvVX0fJFLUERW2PZcW9W4dPQYo7ULDUV6fernLuKV07oIr/Cey8+M6ek34dVyvEVrOO9lxmXW1YfWvi+Z7YcW2a7biZZGQXLHcdd+Nfpab3KdX1M8U5jAI3Vb07gs2K1DWmIm7goa970dhdyEY0tbL9k10m6rxWMvivcjsvRj0a9BlslK8w7bdly56eso5KmthlNJ3HZei/pXy7bhsdMX09rAdlv4UHLR415hyC9HpnUuUPTsFLhUN4xwOy2nhNKxrLADhYz0BhTIcPY0NtYDss1pKTQNh27Lp6Kmoo+Yuby/yZMuynnp2uNrBUtd0/HWQFpYDceFeIaRzpN291c4cOboF2DjupnUznlmyrf01ViGWUE0he+Bpv5arbLldSxSFzKZo/8Aat0jCIZNjEP2CZN05TOufZCI07ZajzUl0zU+GdI/g3C0QH7LJMOw1sQA0f0son6ahudMQ+ybBgZa6wj/AKUkadMWzlXOPbLfQUwDh8Ku0FNFsS0XU8ODGPctU8VHpIu3YFWoV6Zk35nv8H0kLLDZVrI2jZotsoY2Bg4VSzT25V6uKRmObkwaHdymytDiCVIGOKR0ZPP9Kwvgia2RNaR3T2h3IKcI7fSjTbayfFpDX6i3PlHut4IQWkDhNMdzexUm0xvukD3h2wSaD904NDeyByl2kNdqGtZbn+09rSeFJoNrkpzQAFDOTYK5EWje5KdYcFT6WngJhjAFyP7UW9sd7bEYABsEqcxjdI2SPbY7BA1sQm25THOudk5xFrJiCvJghCEDE9j2/KlTWE3AunIJYrYrTY3SHc3QgkDcpj+jt66Gv5/ZNSvIJ2SJCOQJr+f2TkWB5CX1ItbYJzOf2SNAJ3TwAOAj1ZJGIKO58qRRk3S+rJ4xBCTUL2ulUqSSJAStaSQUNAJsU8DsAlGyYbKRMsQdwhzr8JdEMmNldf8A6Jic8tIt3TU5LQxvY6PulcLiwSR907lD+CDA1wPCenBgtul0DyUwd6gz5QlQBYWCEDgQhCB6+A7g/oo1Jyk0N8IFGJ7PlCYdiU9nyhACoQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEm0JpAggHlCEbQaQmhqa4WNk9Nc0k3CNoctDC0O5TXCxspNDvCQgg2KNoctEaFIhG0KM1EDZOa4u5TXfMlZwSo97YEoaAbhKkDgTYJU9IjYIQk1jwU7Wxm2I5osSmp+seCjW1J6ipvYxOLRpunIUbiO3sjTvb+6dYeEJnqAx7BpNimCI8/wDRTIT0tDlJoi9sDlBYOye9pJuE21tk9MPYb7f3SlgPGyVCftjXYhAwA3ugtH/VGpo7pW7ofYyU0/gmgWsqSqZYmyrSCDYqKdmoXT4kXxlscDc7JWMLzYKrNLq3RHTFp4TtIswkkIIS2PhQSnTvZVriGssfCo6vuQopraLUJjGyOBtZOkp/eaoYQS791cIANI/RU5x2LK2K+FixbBmyREFt9lhmPdGwVRc0xg3+y2jVwsdCduQrFU0DXuJICzMihM1MDkZ0/GaI6wyYoMQY4vpQb3+laQzS9OdA6OUsouR+VdrYhhEb4yCAsJ6u6NjrWPb7Y3HhY+RiJnd8P5JbCSTZ5WZ8ZCfhTJ7dIRz9K5FzbyerGSSBtO4fEey9lM2cho8Za8ilHB+lcx5t+lIyOkLaIcnhqznhJ/w9R4/yWx1r9jzJ6dyrr48RYBTu+b8q659LGWVTHNDrgdyOyzjCPSg6OtD3UI+b8i6ByNyGbg74nOpQLEfSpasHT+EuZ5DKcdbNpZH9FtoKCJzo7fCOy2pJJFQ05Gws1UnS2AtwzD2tawCzVYMwephhdPINVrN8rRhjKMTjci+WZkfdmlfVf1TTtp5I9Y2B7rgPNmvp6vF37gnUV056oOtpa10rGyX2Pdcg9UCqxHGLBxN3KnZXqRq1Q/HUbh9LuFRT4tAQwfOF6femvBWswWAhnYLzk9I+ATCvp3PH1BeoXp2w4RYFCCPpCb6LZyHOXtJmzaOm9qPYdk+ONzpLBVn4cNGw7IpKcOfcqzjr9+jgndvbKLFGuji38LUGb2NHD6KQh3AK3L1IwRQEjsFzX6kMeFDh83xHYFa0361G7wFauvRyz6hsyvZ/ENMw791w9nt1r/iM0w9y9791t/1PZiuZXVMYlPzHuuRuv+rH11W8ayb37rk+UsbTPr7/APHWIoxizDseP4mrc7/Uo8OpDq3HdPaTPLqPlXChpgN7Lg75fuz6r4WMY0oJXCKI2Vmq6nW4sV4xRrmQkDwseOp05Cgg/wBhnNXxhUyrwLDhU17CRe58LoDInphklfA4M+sdlqDoTB3VVZHYX38LqP0+9JSfjadzmfUOy6Tjv4eBeUZyUJLZ2t6UemhFTwkMtYC2y7ay4ojFSRAj6QuY/TR057NJCdH0i+y606FodFNGLcNXoPGxXr2fJ3nOWpSaRk1JDphBIVwoIA77qFkWmEWCqKFxY7cLZnFOs8Zybl7fRKyP2wSPCxLqrFnUzH/FssrxWoAjN9lrXMOvEcUhDuxWFlS9UanFQVti2YH1/wBUQljmSuHfkrSHXVbglXK4ztYbnuVX51deHCWSO921r91yZmv6lG4RPI38bazj9SwLbdM9h4TA9oro6JwWh6b90SBkfK2d0JiGAUTQIwwcd151UfrRpqOUxvxHv+dZr0d614JC0NxG9/8AWmwvZ0ORxsnUejsHWmE08Q0zsFh5U3/2j4a2MtbVtG35lwiz1cipiBbiBG351PS+pierbdmIHf8A1Kd5ck/pgPgFJ9rZ2D1hmJQOpHtFW3j8y5V9RPV0dXTVAEwIN+6sGM58VNRAT+McdvzLT2ambrq6KWN0xN733WVm5MprR6L4dw6x7N+pzp6lmMrquoI35XK/U+CtZVucGd10jm7jLcRklcXc3WlcUwptZVE2B38LId7Uj2/C4yNkV0WDooPoK1smm1jyum8hswJcNnpwJbEOHdc/Nwb8JZ7Rbusr6Bx+TDqyIajYOCv4c25nOeS8NH8Muj1I9OGcUrmwxmpHI+pd1ZIdVOxeniJkvdo7ryM9MnXMktXAz3D8w7r059KOLvraSC7ifhC6/DhtHyv5dxyrsl0db9ODXTMP2V4dpbFdWfpp4ZRRk/lCraurswgFaLr0tnj90G7vVFg6txH2oXaT/a5f9S/VU9LQ1Lmv4ae66F65rSymkcCe65M9TmIukoakeQVjZa09HofimLB2R2ee/qwzExBtRUATHv3XFXWnWtdWYg9plJu8911N6qnPkqpxY9+FyJjlA52JOJafnWLfLR9SeKcVXZWuhjferm6nC9+U1nTsE79UreD3CuuEUgay5bwEzF2SQtvGbLJttaZ6J/8ABw9N6Nh5IdOYU3E42yBvIXevp06N6cq6SAOjYTYcrzX6H61nwWua8zWsfK6oyB9TLcJkgjlr+CPqT6Ldy7Oa5biVGppI7/qMn+nq/BiIoGX07WC0hmV6f2OrJH01L3NrBZ9lD6gqDqSiji/FAlwtytw4B0rQ9XN94sa7WPC3Kf2+HiPPYUqW/Y4uwXJ3EsOr7tp3AB3YLLZ+nsQw+nDXMdsPC63/APu/0jiZm0bTcXvpWGZi5RMoIXFtMBYHspMmGqznOPv/APvUTj7r3D5Z4XiRp7rQWYHS0EtRJriG58Lq/Nnp4YYyS7LWv2XMmZmIxU1TK2/BXJZcnFn0R4ZiRvhHZp3qXpKmJcPaFreFgeNdD0LXudpG5Wx+ocfhkLmh1jZYRjNXI95cH8lZ8Ln7HsK4aDrXRZ8C6Io3VrbsG58Ld2VGXdBJJHdg5HZakwKqeyra7V3W6sq8dEBj1O7ha9FraMfL4iCT6Ojcr8qcKkijLom9uy23h+UWFyUQ0wA7eFrnKHqAVDWNEg4C350pVMlpm3IPwrRrSmuzzvnK5Yj3FGjc2cqqWkopHspwPhPZcZZ69O/gKuRjGdz2Xo3nHHC/DZPhHynsuC/Uc2KKtmJH1FVbq9PoOIsVz7OcjgpnnILe6Sv6YYyK5Z2V3hqYW1btvqVRikzHw/D48KhLaZ19eLGcDXFfAcPqT7YtutuZAY5OzEacau4WtcVojU1Lu262VkPgkn+KwFo+oJ6ltIjvwYxr3o9C/T3XSVGDRFzvpCyLNjU/CJLc6Ssa9PtFLT4LCNJ+ULLcyKd0uFPbb6SpfT2gcrkJQyVo4Yz396PEJbE/MVqeBkkk7iSeVvXPvBmiqleR9R2Wm20oiqHbd1Tvr9Vs6nhZuc0i140HNpiL9lhVdE51Wf1WddQNtCbBYhPDrqr27qpCWmd9GlunRtP0+1ZpMRhubfGF6IenDH2Ow+GMuHA7rzZyqrfwVdEb2+ILtn069btgihYZOLd1o4rZ5l5VitpnadAG1lGDe/wrW+cXT7H0crjH9J7LMsu8abilIwA3uAm5n4P+IwqRwaPkK34r2q2eTYd0sPkPU87/AFE4YIJJrC2x7LlnqE6MQcB+Zdj+qXCDSuqDbyuNepA7/F3D/WVjZaPoXxHKlZCKZEIHzM2HZY91FSyRtNwd1neA4cKmMEt7Kg6t6fa2M/CqVT0zseaj7Y72Ypl7EI8ajc783hd6ekLGY6N1Ldw2IXDPT9CaTEmvHYrqL069YtwySBpk7jurtU9y2fPXkON72S6PUXKzrRowyJoeOB3WcTZgTUjNTZP7XMWS/XorKaJnu8gd1t2przU0Ika6+3ldFhT1o8n5Lj4ezejYEObLIWa5ZwLeSrpg+fmFQG0tYz93LmDNDreqwCikeyUt0g91zV196s8R6eq3xtr3CxP1LfhZ+pyeTgJ7Wj1Zw/P/AACWMNFfHf8A9QVk66zgwSoo5NFYw3H5l5QYP67sVbUhhxN/P51mVL6v8Qxel+PEHbj86qXXS9RnHcTV+ZSUezojPnrDCMXjmBlabtPdcN59YbRVk0piAN3FZv1PnXWY2HAVROr7rAsbgrepJTe7tRXOZNftLZ69xfKf4eOobNDV3RTqjECY4zu7sFsfKPKeasrI705+YdlsPo7I2pxWdj3U97m+4XROSfp1dDUROdSD5h9KqRr7JcvyP1g+y5enLJURNhe6lIsB9K7Tyb6F/wAMjhDYbWA7KxZPZQR4bTxj8OB8I7Lf/RvScVJDH/lgWHhdHx1TejybyXn/AHi02X3pSlNPA1lrLLaSH4eFa8Nw8R2ACv8AQU7gy9u3hddRT0jxnkMhWWNhT0w1hVsTPpsmwxWl4CqmxgG//RSyr0jFlbsRtOGbhSaGuFiUj32aNk0PubWTFXoqOctjvwocdhslbQxNNwFJCbDdPU0aw/K9fSN8DdNrqF0DQbKpDgTZNePiU0YiJtlG4WNlJBuQpDTl5vsnxQlnKlS0LvRKxl28pfb+6bqIHKc1+26fFkTkI+O45/pM0BoNxunvkFuSE0vaRyn6Yjk2M/ZFj4Rt2KkbwP0Se2hNMicy53KGsI43Ty0672Tw0u4TXJsb6MZu7a1k4CwsnFlhclMe4C4Buk2OUGhwcQgv1bKndNY2JTo5LkEjskjHvZJFP+k7HG9krgCExrr7hODtiCU/SGyfZG8C901OeNr+EwuANil0ivJ6FQkDwTZKk0hsX/wcxo2cnIShhIujSLEREEXFkpYQLpExoVoY4aTa6ROc0k3CadjZJpEcgQhKGk7pUhuhWc/snWNr2SNFhZSP4/dPSJILYw7C6jUijRpFhLQmje90qE5rb73UiS0DYMHdPZ8wSIBsbpv1kUmPf8pTEpfcWsmSdk5bIpCO5P6pEISjR0fdPb8wTI+6e02N0j+D0h6EA3F0Jg9IEIQgXSBCEIF+AhCECbQhYCbpQLCyEIDaBCEIFBCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEJGtgCEITWtAIXAclKCDwo33Lv3SgkcFII2tjtbb8o1M/+gmEkDZN1O8IE99Et2fb+ExN9z7JWu1dkCKabFLRe5CLAcBBN0bpVHf0mTWgFxuE4PAG903tZB7J6RDKT0K519kyz/8A6KcdhdM1u8p6WiBzYocQbFKXNHdM5QlHRm2TNkB5KHOFtio2cpSbBN9USRe2BksbXKX3B+YqMm5uU3WfASqCZPpEvu/coMu3JUWs+AlHxN37o9EO9UTMlve907Uz/wCgoWXBtdPTPXRHKOhJODZMuRwVIRcWKY5obwgrv6NuL2UjHC2yhd8xQHEbJW9EUZPZPcnkoIB5UTXE3unCQAblM/JolWmx2lo7JXSQtG6ikmIG3hUVRO4vtdRu97J4xJ5ZQXHdRTRmRtwOUM+K11NEwC36odzY5yaKaCmc113BVTToapCwHhRyAgbhO9FIrzsaGyvLm2uqGpjdI74AqtxJOlDYmtG4RLHjIZC5p/S1S0sj2/KrfWYSJL62Xusl9lt72UFXTNIuAs63GW9Gzh5M4mAY/wBJQVILfYB28LAOrso6fEI3E0TTv4W66mkY53xBUVZhsVQ3QGf0mwwoN9nUYnM3Y6S30c3HI+KOfUygHPhZZ0vlm3D2i1Lb9ltdvTkWu5j/AKVRHgsUTNmfyFYWBGK2Xnz05/01ziWF/wCH0huy1lojOvEi33o2u7FdN9Y4YPwjwAuac5MAlkqJS0He6z8lfj+Grgcj1s41zxhqK2okaATe605S9A11ZijX/hyRq8Lq3rDLObFqlx9gnfwoOm8j3OqmOFIdv9KwbZN2HSS5KP4SP0uZf1NFPTvdTEWI7L0LyRpRSYTHEW2Ngue8mssv8L9kupyLW7LprLygFHTsbbhWYVuS2cLy+b77RnMbLi5HZRM1QyFx2CqGtHtc8BWrGMRdTxuHhTxrUHs5qmLtlpFJ1ji0UdK74gDp33XIXqx6lhgw2e8w7rf+YXVZp6eQGS1mnuuKvVv1wJaGdgk891WzM30jpHrPg/BO21OSOB/VB1I+fFqn25SRrK5txbEjNWlr3XJW38+8eFRidQ3Xf4j3Wkqr/Nr9YtyuQzsr3R9eeG8WsdRReMMpfcaHAK9UtK1rPlVDgrG+w39Fdg5jI+Vy1rcpHveNGNGOmWfHqmGNhjJF1YaWISVBdbk7K4dRAPnLg7v5TMFhjlqGtukqi3I5PyDO9an2bFya6flq8UivFcF3hdpZBZeVD5KeWOn2uOy5w9PnTLaqqgLWXuR2XoB6c+iyKOC8B7dl1XGw3o+a/MOW9PbR0BkB086lpYmPisQ0LpLpCjLYmNA+lasyo6aNLG0mO37Lc3TEAi0gjsvQeOj+qPl7yjOeRY2XdlLaIFzU6OKGPcqqLQ6OwVFWtLG7FbF0PWro881+SfZaeoZLRu0lafzTxJ9NDKS7hpW18bld7LrrTecDXSUs2n8pXM5TbWzsOBxou1HHPqf6qdHSzaJTffheavqYzCxGirZ9NS4fGe69E/Unhrnwzg37rzl9TXTP4mpqPh4eVzOTJ7Po3xbja7YI5xxXNLHjXudHWSAA9nLKugc5MXglY2atf+5WAY9hYoq5zC3k+FcekMGkqapulvdUpXOMdnoU/H6pVfDpPpXNnEa6JgbVuNx5WxOmet8Ve1rjO+x+61Llf0XPK2NwZ2HZbw6Y6An/AArD7R/hELnL6Y9nDV0yK1/W1U6EMfM7jysU6vx334XEykk/dZNi/Sc1JETpI57LAeraR8QcD2VbLlpHScLiwU1o1t1zNLUl+lxPKwiGlmbUEvB5Wd9RNA1agsb0NdJwsOd8lI9b4rGj6It1fTH2L6VRYXP+GqmXdb4lfMTjZ7BaPCs1PRCWrbpP1LU4+6UpIwPK64Rx5aOmPSziznYjA0P+sd16xejCZz6OmLzy1q8lvSthsseKQkg21Besvo6a6Khp/wD0hejcZH2ifHPm02rZaOzMGLvwUenfYIravQ0tJ3TenHl2Hxj/AEqPEoXPkNgugdCcTxdJSvezGep4zUwPDhcG65i9SuA6qKoLW/SV1fiGH/iKchwWhfUd0+DhNSWtudB7LDzcb1O48ZyIxyYxR5O+qXDYYKufW3yuS8cp6c4g4BotqXZ3q/6fqHV1QWMPJ7LjPqXD56XEHF7SPj8Lk86Prs+u/CbYyriVOF0MGk/CFQ9R4XI+Euibt9lcun5GSnQ4hXPFKSL8MRblcvdY1Ls9iophZA1HiLqqjkJaSLKXp3r3GcHr4y2pcAHdir31Dgup7naP6WI4hRup59mcHwpca5PoxeW472qbSOxPSzn7PDUwQ1NefmF7uXpd6Zs2qDGKaBrqppu0X3Xh5ld1jNgVfG4TabOHddzel71JjCnwRvrgNh9S38XIfR4L5Xxe1Lo9i+mKrCK/DWuJaSWrDM1sFo56aQsjb8p7LVuROfcHUFBC38YDdo+pbK6lxuPFMMc8PBu091t3WRso/wDZ4rj4FuLyPsntbOOPUlhLKaGZzG25XCGc1RNFXztDttRXfvqif7VLOfsV58Zx1TpcXmZb61wuetNn1T4H6wqgapxY1M0xDCSrJidNVNF3A/qszFEHP1uF1ascgaWlrWcLFjL1ke5ws3UtGOYbK+CZrnFbD6Fx90b2ND+CFgEsBY657FXvpOrMNQy7u61ce1r4Y+b2jrjI7qOV0sbTJ4XU2X9XJLSse59xZcWZIY5HFNFqcO3dda5b9SwPw+NmsfJ5Wvj3blo818kx5Tp3FFyzdIkwqRzDf4CuBfU7M2KrmaT3K7rzQx2lGESAvG7D3XB3qaljrKyYsd3KdfNbOXwPfF09HPcda59eWg8OV+jLHwgv8KyU+HkVpPcuWSUWEyVEQa0HhUde7O54/KU4/sY7iFO11RaFvfdbe9POEuficGuPuOywH/uhVmqBbG43Phb89OXQFVJXU7nQu5HZXKsX2W2VuX5SGPU+zsvIvANWCQuEX0hZHmFg7Bhz2lnY9lfsiej3w4HEHxn5B2VzzN6abHQPcW8Aqy6HGHw8zs5iN2auzgb1EYPIyeV7Y9tRWiZKZkMzzIOCuovUVQMa6ZpbwSuYepnCGqkjH3WTl+2taPSvHJQck0yydQyU7oy1pCxR8LH1FwO6vOLh7gTfkK0xB3u7BZXxnqVMk6i8dLTPpKthvb4l0rkP1Y6OoiZ71tx3XMNFO6KRriO62xk11K6lxGJhk2uFo43R5/5VHabR6YZCYsK+jiDX3u0LZXWuH+/gzyRe7P8AotB+mHqulNHAXSi9h3W/Mdx2lqMFI1j5PK6HHnGUGmeC59d0OQjJL+nCfq+wt0QqCGdiuFup4dGNuuP/ADCvQX1esiqIZywDgrgPr2Iw4zIR2kKw8yetn0F4XH1jBsv3SjoGU4JteyZ1VHHPC7QB+ys2A4mY2hpPZXGqqvfYsf8AM0zvuZadejFfw0tPWe5awvytk5X9ROoKmIultZ3lYPisYadYaqrprFxTTMGqxv5VzHubejx7ncNJOR3l6eswI5vagFRvcDldadGiXFMMa91yCxednps6kccRhJl+od16S+nCmj6jwyGJ4B+ELruMi56PE+fu/wAZs1bn50DieI4XM6mhdu08BcD575V9SsxCZ3sS8m2y9r8YyQosawwxmmDtTfC0Jmx6J6bGJnyR4Xe9/oXWV4q9TzPI5pe/08bKXLrqaGuF4ZbavutmdJ9E9R/hWt9qTjwu8an0DsjqNZwo8/8A5tX3BvRY2ijA/wANIt/oVLJxWiXC5uMJbOJOnstOoap4DqeQ7+FtbL7I/EayVjpqJx4+ldadM+kaKItc7DjsfyrZXR3prpsPc0mhtb/Ss54ak9Fq7yCW29miMrMg3RCEyUH9LobLfJ+Gj0H8EBYjsthdNZSUmHxs/wCHsR/pWa4H0tDRgAM4PhTV8WpMxcznpuP0p+lOkI6WJobDaw7BZrhOGGIAaEuE0EUTRYcBXmmhaALBbmLgxr1o4fkOQsuk9klDS2c34VfaWGIRAABUFJFxdXKnj0ixWzCOkctlT9uxGU4bLqPCkc1pN2hSEXFkxwANgla2jP8AyMY5rLbhI0R7FOIBFimNiOvv/ChS7Ecmx/b4U3W5m5JTwNOxUdQfhI+ynhHfwjb0xDUhp3O6e2YP5KonHcqSFxsApVDX0khMr4bDlOdYjaygils2xsne83slaSJNbHltxuf7TCHDj+knu7/MpGPNibKPbi9jZVr6McHaTe6juR3U0h2/dRlgJQrWLGPQMa8qXhNYdrJyVPY5LQAE8BL8TUrSA3lIXF3Ka5NB/RHlzhYFRSAjkb+VKke0OBuopWNCroo3NcXeFK1ha0Ouf5SvAB2Twe9lLTP26IrJ+osbtrH+07U0d0xCs+qIffY9wJFgmaL8tUiUNu3VdDSQnr7EftfYJ2hqVI46ReyTokVaQ5tuSl1t8Jgfc2ske4g7FL6kkYaJdbTymusTskG4QmtCtBayRzbjYJU8MA53TfVDHHZHb4bWSsaSLJ2gX5TgANglS0J6oaG6TclDnAi10r+P3TEo5LQHgqO91ImuaALhA9SAFluycLHhQDd1/up2bWT3/qD+ClrhvZIpDuLKNJEgmxDsDum2c5K872TU4hc9Al0lInt+UIHRkwYCEam+UOcRwmJH8JY7ZJ7unZHv/ZRoTCb1JWzAmxCeCCLhQM+YKZnH7oEa0KhCEDX8BCEIGAhCECx+ghCEDwQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEJGtgMdyf1SJXfMUiYNa/oJC8DayVNc03JAQNGp0fdDWi24Q3ZxCButMchLY2vZABPAUi+E6/wBREFKGu32SIIpoE14FuO6da6CAeU9PZA1ojQlIIPCTnZKKkCf9H7JGtN9wlINrBBND+EMnJsoXO09lUmMk3LVC+Lb5U5NIsCMNyCpA0kXCja0gjZTNFgmkn8Hs5unJrOFLZp22TZEMntjHD4bqO+9lO5o02AUTmG9wmleaIXX1cd0X3snlg7hNcAHbJJfCFR7ES6Da6RSRbjfwoZfSaC19I3MdpKppad5dsVcfbuPlTHRg8BR60WIlGyNwICqoRYC6X2fshwLBtsnRjsR/SQkDcqnkcHNtZKXuPJTXC4VmPWitNJkMhsSU1ri8qSWE6C6yjhLQd1ZilopyepE7PlAKSVmpqdEAbbKRzAdiFWsrTZpY1nRaauPcjSoKeC77uCutTTtcOFSuhs7ZLXV3s0FfqI38OzTfSFHNAwsOyqmsOnfwmvY3T2/ZWWv1HQuTZiPVFAZ4XNaOVp7r3oSSvkeTFe58Lf1dQNmuC1WWt6ThqHlzoRz4WJk1bbOgw8yMI9nML8qh7510457tWRdL5UQMkD3Uzf8AatzV/QFP7mpkA++yqcP6Tip9vYWFZj/uXLORbjpMxPAOiYaFrdEQFvss26bw10IG3CqoMIY2w0D+FfcIw6OIfKrEKtLowcrIc2RujLIgD4WL9Z1bKWkkkJ4CzTEI2siNlrnM10v4CUsva3ZLdBxRY4rU7kaBzrzAZRRytEn0nuuDfVNmWZ4p2iXz3XVnqEdVF02kncFcK+oSgrqr3Rpcdyuczk9M+hfDZQhKJyTmt1O+rxOYl17uKwanq3S1Iue6zfr3pOrdXyOMLvmWMQdPy084c6M7eQuWyINo+nvHMuqMY7ZkGBscYQfsqmrkc1pAJ4VPhtQynjDHC1vKhrsWhDiC8LLdTbPR7OUhGn6WfHqhwJSdLVEk2IsYDyQqfGayKZ2xB37K55f4c6pxeOzL7jsp6MduR5j5LzKUJdnY/pJ6bdXS0rnR3uRfZelfp26Hjjw2BxiHA7Lhf0W9NteKT/Kuduy9MMhunxDhMF4rbBdZxuN2tnzB5lzHt7dmzelMBZRwCzANvCyrDP8ALkAGyjwihDILaeApIQWVNrLuMSHqlo8Azst2zbZe4Zhosd1FWsDmXSQkkA3TK6YsZp3Whb+0NGPFr26MfxyImNwBWrcysKdUUstm8tK2rWNdMSCNiVifWOFsmgeNA+UrByKemkddwuQoWI4O9SfT8zKedxjPfsvOv1JYe5lRUgt+or1l9RfRsc+HzOEPY9l5q+qbot0dVUlsH1Hsuay6mfSnhuVFqPZwf1pRkYo+3lXvLmga6rYCO4S5j4S+ixGQmMj4lJlpVMGJRxuI+YLDsh2e0U6nSdTZKdPRTsi+AG4HZdI9JdDxyYe1wi7eFpX09UArI4C0eF1j0ZgIbhjdTBfSkhH/AIYHIwVb2zT/AF90rHTQvOgceFojMPDhC59uxXVGbmGfh4HnT2XMOZ9TG18jdQ5Kr5r3EscL/uaZ6nGlzwsVmnbHKsg6xrWxyP8Ai8rB6zFmiWxd3WO4bZ6Vh5UaYfS7S66htm73CrulumKitrozoJBKpOl5o66ZsZ3ut2ZVdCx4jNC6OnvuOy2+Npfsmcn5RyUZVS7Nnemfod8NXA72/qHZemvpYwx1HS04It8DVx16e8tJYJoXupSPiHZd4ZE4C7DqWG8dvhC9H42v1ij5K8xmp2SOi+mf/wAijb/pVZVQAuNwqDpqT/hWb8BXV7Q/c8rdctRPGLn63NloxOMRQGwWos6MM/xHDZ2EXu0rcmMx3h+ILX/WmE/jYJGBl7hZWVuaZ0PA3qrIjJnmz6nco34lUTvbT3vfsuHs48o6nC5pJRT2s4/SvYPNrKiPEmveaS9wey489RWQrjTzSMofP0rks+vp7PqLwzm64xS2eb8v4jB60sftYq4xY22qaI3HkLMM3MrqzCMQmcKQizvC1waWooajS9hG65DJh2e/8TycLoJbLpiFDHUwucAP1WE9RYN/muAb3Wb0lUHw6XeFQYjhYqXFwZf9lDVHUjfyIwuqZrOqM+GTa2kix2Wf5TZl19BiUTG1DhYjhyxLrjC30wJa223ZWLpHE5qLGG3fazvK28bSPIfJuPUtrR6q+kPNyrmjpmOqnW2+pdudMdU/4jgDXOkvdnleVXpG66MUlMz8RuLd16EZXdX/AIrp9gM3LR3WvK3VZ4xbxEv8lvRjnqUphX0UwbubFcC5w9OvixWZ5ZYaz2Xf2bk7a2klJ32XHGeGFxionkEYvc9lzWbH2Z7F4humEUzQNS9lKSw9grNiM8cwI+6rOsZJKepeGjZYya97n6XO7rJ/CvY9oxr91ofX07bXb3UeFzmlmFz3VUY3TRarKkqKZ7DqAVuuPqMyNOO2bOy865GFzMJmtuO66Hy7ztgp6VofU8D8y4rw6trY6kNaXcrZPSdfi7qdgiL+Fbr7kcZydtcW/Y6QzAzh/wASonMjqb3H5lzfmhUz45UvdqvcrL8NwbqDFmhr45CCPCq5Mn8WrRrdRPN/IVqdcjiczNxoS6NIYZ0VPU1IOjk+Fs3oXKapr/bvAd7dlmmAZN1NNM0y0RH6tW5MsMuoIBGJacDcchFVT9ilHmY1/Ga86S9NE2Jzsd+Cvcj6V0tkZ6X3Yd7MpogLW+lZ/lN0FhL/AG9cLL7dl0Vl/wBG4ZDCwRwt2HhdBiY6ZxHkfkf44P8ApjfRGX4wTDWwmECzfCxfOSjFNh0m3Y9l0DP07DFT/wCXGLaey09nfgj30UjWx32PZXrceKjo4Dj+ZduT7s88vUdqdNOB+YrlTq8ObXSXHBK7S9QXSMr5J3ewfmPZcpZgdMmmq5XOitud1z/J0KMOj3nxDlY2Ndmt6pnujSQqaDDbvJLVdqlkMD9LksUlOBuBwuVlW9nsuPmwdetlkxCMU24CuHR3Vow7EGnXaxCouqK2nZA6zhsFhcfUAp627X9/KtY6aZzfOWQtTO8vTznYaBsLHVJFgPqXR0eecFXhIb+Jv8P5l5rZTZhTQysYyY8Dut+9NdeV9XStYJXH4eLrSjJxXR59/hVyu21/TM8/+tY8agmAfe4Pdcf9d0D58Re9o+sroPqt1XicTtQcbhav6m6Tke90roTz4Wblyej0fgbI0JGroIJKZyudDqlIDj2VRi2HCkmLHNtZR0crIzdZag5dnVZWZC2K2xmMUgEBcsYdUvpqpuk9/KybG8Qj9gi44WBYzjDIZx8X1eVdxoP2OG5tRlWzpT0w4u5+KQtLj847r1b9Gs3u0dP3+ALxy9MXVkUeLw3k4eL/AMr1q9EXV9LLS07TMPkau14tKLR88eYR0pHd/SlBHUU0YkaNxurtXdJYbUs/zIWn9QrD0TjEMlPEQ6/w8rKTWNcNl3VDjOGj5y5Cy2nIb2Y3W5bYTIdQpY/9qidlnh4j+GlZ/tWZ0gZMBqYq1tLAG2MYTpY8ZlZcnbWlpmEYf0BQwtuKZo/9qqo+l6eE3EbR+yy0wQNF2tCp6iOI20tVV48IvpB/8lbN9sx9mDMYdmDb7Kenwol2zVcRGy4+De6q6KnaXbN/tTV0kM8/a1sp6LCpLCyuVLQlgAIVbS07Az5VUMgFxsFfqqSMu3K9ingprbjyq2IbJBHpIFrpXDSNlZUEinKXuD3gA7qMzBpFzdNkcRc3UMxcRsUShqBA4FQJWlSMG2pUlO8u7qqjJNgqaj+wwHCxULhqFlNKSNx4TGM1HhWIRGP6Uz6d3ISNjcBYqvEbTtZNdTfFsFMuh0CmuRwU0P0mymmi0cBQaXHeyZJFuLHB93f9VUxv+G9lSAEOAKqYGuc3YKGY+a/UlcCRYJAwg3TkrWk9lHH4RCKNx0qZzBb4QoXtcQdlIloRPYwzWNrpRKDwFBKSH2uURlwvuU1oUrGOBAH2Su4P6JkP/RPO4KgmuwIX8/slHATX8p4BDQbKfGiV7gQhCuEKRIlDrN02TGuJO5TkjWyWAJH8fulSP4/dNX0lGIQhPJF8HM5/dOGxums5/dOTH9GP6P1jwUqjS63eUgg9CaHm+5TgQeEACY7k/qnprmixNkANSOBIsEqEAR23spY2n+E3SL3sns7pzfQ5/ByjUijII5CSP0gmhrmm901SJjm2OwTyFrQikbwP0TLHwU5l7boFSEeonPuOFK8E8BRvYLbBD+E0P4NTo+6Sx8FKwEXuFGWB7PmCmZx+6haDcGymZx+6BshUIQgY/gIQhAwEIQgWP0EIQgeCEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhADH/MUic5hJujQbWJTWkI+xqEpaRukTRumCAADcBCEBoe0XZZAaG8JRuLoT18Hgkfx+6VI4EjZKvox/RiEuh3hGh3hP2iP1YhFxZIGAG907Q7wjQ5G0CQiE7QfISnZtj4SNkkVoYmPYLcnlPQl2ibaI2x7jZO0DynIS7F3sQAAWCcz5gkAJ4Tgx19wmP6Nehya/n9k5FgeQkIpIjIuLKN8Y1d1KWG+yDGSN0S010R+rKdzbcKSHbnwn6NIsQgWBUTQ+PQ9nCT2x2KNbfCXWPBTPXZKtjXAAbFNczWntYdiU5OitMGUz4gOCk9v7qZI4aha6minoryXeiGYf5dlTshde6rtAtYpghF+LKaMtIrTrbfRHECLAqRwJBNuyeGgcJ7S0DdNbLFacUUrmk7KIxW3Krn6SdgP4THsDhayVS0S+2kUgjubBDqcnkFVIiDDf7p40ngD+E5zFhN72W+WkJCi/DaRa39K6PY0jcKnmjA47qnaky7C160W+WmjtuFT+w25CrqjhQtYQbrPnUnL4WoWPRDFTfEDZXGnZ7YBHKjha0tGyqmAAJ0aiGyRS4g17ozt2WC9d0Es1LIwNvstiVEbSy1lYsdw2Oojc0s5CbdRuPRcwMj8ViOO86OhZq+SW0ROx7LlTN7JKat9wmlJuT2XpF1pl/HXOcTENx4WqOs8laesDiadpufyrBycRyPVOA5z/Hkns8psw/T3Mx8jxRnb/StS9S5P1dA5/8Awzhb/SvVHMT0/QCKR34Npv8A6VoXMXIJoZKWUQvpP0rBv4+Wvh7PwvmSjKMfY87+oOmJ8Ma74XC32WBYzNLHUFgJ5XYGZmRta10jW0e1z9K0V1NkpisWIOP4V1tW3wrJ/wANqXw9L/8A2uNmOv2NV0NJNWVDWG/K3Jkx0BJVV8T3Rne3ZUXTWTeIGsY51MdnDsulshspJjNE51NwB9KvUYZwXPc3+WD7Oh/R50U+hfSl8ZttvZeimTmHshwuGw4AXKHpy6LFGKeEQWIA7LsLLWlOH0kcLx4XS4WP662j5/8AJ8t2OXZsjDKUOisB2Tm4cBPq+6nwgARXPhVD26XlxK6OuGktHkuTY/ZopxGYiAVBWMEo8/oqqZwcduypy25G6l/9FaufZb5qOzS7/osb6nprxuA8cLNJ6fVHwsc6goS5rtuypXwWjoeOtUZo59zi6c/xGilbpvcFcFepvKR1U+pkEB5PZemPWnT/AOJgeDH2PZc1ZzZXDE21FoQb37Lm8yt7Z7l4ny6q0tnjR6gssJcNrJpBERYnstP9MasMx1kbidn/APVegvquySmY+oMdIOD9K4v6gy0xDDOodYhIGvx91z91bTPfOJ5iF1KWzqj0qYk2aGAXHA7rsrpJ/wD+FNdYfKuEvTjiT+nmwmc2025XWPTObOHQ4S2N8wuG+VWj+r2WOT1k1JR+kGemKxQUUmo2+ErjLNPqIurJWh3Lit+Z95oU1ZBK2KYbg91yj1njLsRrXhpvdx4VS6DmScdONT0Yr1PPJVSOIPKwvEaKf3ybFZ8MPkqpNIZe/wBlcaDLGpxV2psN7/ZRVYzb7LuVzMaYfSyZV4DNW17GBrrkhdn+mjK+atqabVASDbstUZI5F14xKJ7qXa4+ld7+mHKcUjqYSUgBuN7LpePxu/h5r5B5HGcGvY2hk1k/DTQQyfh7HbsulehulGYfTRhrbEAdlaeg+jWUVNG32xsB2WzMJwlsUAcGj5V2+LVqCPAfIuWjdY0irwQew1rPCu4kNgVa4B7Dhsq6Kb3G2sp5vrR59k/vPaIcWvLHZoWN11H7143ALKXRgA61Y8ckhoi6ZxACo2PrslwrJwmYP1Z0lFUQuc6MHbuFoLN/K6mxOCRhp73J7LenWOZ2EUOqCSZoIHla4xzq/CMYDhHK03+6wc/1mtHqPi/JZNFqaZ5/+of09NdJPJHRnv8ASuRcx8qX4PVPPskWv2XrFmd0pQ45DK1kTXagey4/9ROTxpvdnjgFrHsuPyKdSaPpbxbmpWqKbOGamldRSe27axVVRNZK23cBX3r7pmairXsEdrOPZWGiD6fU1yqqGmexY2YpUmL5gYax8LnAdlrMRimxO48ra/XLwaRzvstUVmqfFC1h+pXKmzlOacLDpL0uY7PDX04DtrjuvQzJrqaR2DwtL/pC84fTSySOqpxbe4XoHkbSVE2Gw6QflCt+8mjgMrFqjL20Z71k81tG83vsuZs7MHdeZ2nm66nxXCJTRnU3kLR2cvTD5YZnaO3hUra3I1OJy6qWkmcW5hYeWVDzbi6waOm1VIFu62nm/Qvw+plDm8ErU0mLMpau7iOVVdR6Rg8lBxXZlFBQ6oLW7eFHV4cLkAKDDOpoHRWLhx5Sy9QU7pRd458pri0aV2WnWXzo/og4rWtAjub+F0tkh6eH466FjqS4cB2WnckqqiqsRj1uHzBd9+mGDBWsp3PLR8I3U+Ov/sSZ5l5TnSpolKLHdAejmncyMvotrflWezekChpaXU2iHHGldB9C0mCGljeHs47EK69W9QdP4RREvlZx9l0ax63Dez59zfKM15LgltHGfVuQNNgd3ilA0/6ViE0FJ0zJZwA0n9FvDOjM7A2RytjmZ37rkvNnM+KWrlbTTdzaxRCmOy1RyttnbZuforN2lw6oa1tQNiO639lbnTS1ntx/iBvtyvOPAevMQdXDRITc7brorITHcWramB13W2WhBeq6Mflsp2Rez0F6cxiPG6MPYb3arBmB0R/i9I+0d7g9lTZLVdRLQxRSg7gLbH+BR1FHqe0bjuFI5OSOH/zliW7RwJn7ktJ7U8gpjyey4gz36Bmwuee0JFr9l7BZv9BU2IUUzBA29j2XB/qdyic6pqGxUg3B7LKyYSt6PXfEeeUJx7PNjrBs9DVubYi32VhZitQRbdb3zSyWxBla5zaQ7nwsKiyWxR1yKQ/7VkywHv4e14fkMJQX7GqOoJ6moYWglYtFhtXPXBga75vC37PklichAdRk/wDtU+CenrEJ8Ra78CfmH0p0cWUfhU5Hna2vpZMmMuq6rkikEbt7dl1Tlrk1W1FLG8wOPwjsq/In0+yU8UJko97D6V1pl1lBBR4XGXUrdh4T/wDHkcxHnqlY/wBjm3EcmZIoCX0548LXnXeWjaOB59o8eF3L1LlvF7TmtgA28LROdPRbcMpJpCwbA9lSvxpN/Dq+K8grtitM4PzJwY0FVJpbaxWEtnlbJp7LbGdFMG1kzWgbErVTGufWe0Gc7cKvXiP/AIdH/wDMKS1socYlc6A3cf4WveqHuZLqv3W55Og6yupDMyM2I22WF9S5aYhPL7bYTz4VyjG9Jb0Zmfn+8Gmyf094vNBjEYa8/OP+a9UfRL1TPDFTgyH5QvNPJHK7FKLGI3ugPzjt916TekHpespoqcGMj4Qt/Cg4M8T8tnGcZHovlDi8tfSwXdfYLblDRGVgce60rkdE+nggY8cALeuE7QBdXi2aR8681BflZWQ0TYQN+AnzyBjDulfJ8NxyqOomLzpC1VOOjBhD2J4f8wfqnMoy82Kio7t2KutHFr3AQq9vZSybJRnpFG3CiSCO6q6agEW5Vc2msAbJJI7cHspoxRUdkh0cDAL3snBoBuFBqd5/tSRPN7FWI6RA5skRp1bWQnM5/ZOfSHKW2QyRcjSonwA2sqt1nbDlII97lJ7dEm9op20xYbqZjQBceFI5t9wkDD3UOtjGm2MLC43ShunypALCyRzS7hSR6GtIa3lPuDwU3QfIStBAsU56BIa+MW3VM+Jo3+6q3NLuFG9urY+U0mi9MgEOoXCnp26dvshrdIsnx902S2hZS2tCObYXunM4/dDgSLBDQQLFQ6GbFTXsFiU5CkApJKYOeTZHsA8KqIB7JPbPcpH8F2yKNpBsnpzWWO6HMJOyicdhtkL4t7hOaCW2UrW25sm21XspKumMmvZDNAvyl0DyU7Q7wjQ5T7I0hoaBwlTmtINynO4P6I2x6RGkfx+6VCQeRjc/un6B5KVCXbHpoQNA4SpQCTYJdB8hINf0alaATYpzQQLFKgQboHlK0aRa6VCABBFxZCEAMcADYJE5zSTcI0HyEAAYCLpQABYJRsLIQAJr+LpyRwJGyF9GP6MQl0O8I0O8J2yP1YiUNLuEaHeE5rSOUmxUhpaQLkqMi5P6qZzdXdNZEWuuUbY+KGaB5S6B5Ke5hvcJNDvCQm2hBsLJ7PlTdBTmiwsgZvYqEIQAIQhA1oEIQgEnsEIQgcCEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEAI4XFk3Q5PQmtAM0O8I0O8J6E0AGwQhCevgAhCEojSYIQhAnqCEIQHqCRwJFglQgVLQzQ7wjQ7wnoQKM0nwix8FPQl2xdsawEG5CchCQQEIQgRrYIQhAjWhsnZNTpOyaka2CW+wQhCT1Hp6JG8D9EIbwP0Qj1EELBbYJhBHIUibJ2T49EckmxqA3wla0E7p6SUtCRjvtkaE57QN/umpVPY5pIEXtyhI/5Sl9mINc65sgEjgpEJjmPURz3N03uoJXix/pSP4/dRSMuCbqBvbJV0QPbqHCiazf4iFUBg7lMMdzsoXF7Hq6Ueh0DAXWHHhVbY9rAbKnhuyyqWygDf/mpI9Ia7NjXNDtioaiiZKDYdlI+ZrdgUMma7kpzSFjOSfRYcVwBsjTePt4WLYv0o2S59gLY0wZI3zsrViFG117BQzphM18PPtraNMdV5dxVkbm/hhv9lrTqjImGtY8fgQdvC6ZrMIbKTdn9K31fTEUrS32u3hUrcOMkdVhc5OmSezhXMH0wQVAe5uHDv9K0v1T6TY31Tnf4X3/KvSzqHL6lnaSYb3+ywXGcpKKaUu/D7/osG3B9Z/Dv8Pyx2VJbPPrDvS3HSSg/4bax/KtrZVZJw4XKwfggLW+ldI1eUFMx21N/8VV4Hloykku2C3HZS04v7CZXOK6HbIMquiIcOdE+OGxAHZbz6VoSwMJbwsW6O6XNM9vwWWxMDoPba0WW1j1JHnnM5cbG+zIsPcI6cE+EktXvYO7pWxkQgN8KmmY5rifutOMVo89ypbl0SuluLk8JkbnPdYcKKx7qakcGuu5NcWQVNqRVll4rWVpxOj9wkOHKvOpjuDt+qoq7S51gq1kdo1sebjLow7HMAZPER7fY9lrDrboFlU2QCnvf7LeFVTh7CLLHcYwVkur/AC/6WRk07R1vE8rbjT+nDPqByEhxeKZxoQSQfpXE2b3ptdQ4g+dmG/UTcNXr71vl5DijHh0N7jwuf83PTvT1zHvbRm5B7LCuxW2ev8F5TpJOR5fy4BUdLDS2Et0lAzFxCkjMQkdsPK6czY9NNU18pho3CxP0rR+P+n7F6erc0Ur7A/lWdPGez0CnySEodyNS9Z9RYrjJLQ5zgfusao+kayvlDjTuJP2XQOFennEqogSUbj/7VmfTHpfqtbXOoXb/AOhJHEcvov8A+xwgumc+9JZR1NZIxzqMm5HZbyys9O8te9gOHncj6VuXob02PidHroncj6V0DlNkZHQmMupCOPpVurC0/hzvKeSpxfZrnJr0uCF8UjsO7D6V1Bljk9BgLInilAI+yy3ovoWjw6BlqcAgeFnGGYRGxrQGcfZbuJi+ujy3l+elY2kyPp7CPaa1pYsupKYNhA0jhW+kpvYsQLK60ji5gaQuhpjqJ5/m5X5p7In0jAT8P8KSGJjTuFO6I6e/8JgifylnHZS99oJow6O61xm/i0uFYZLI11iGlbGmc+OLcLUue7pJ8LnYwb6CqF9f6lrDi5TOLM/s8azBcQkZ+KIAJ7rAeiPUXPiFY2GStNi7u5W/1VdP4nNX1D4mO5PC5/6eqsUwLFQ+VzhZ3dYeVSzt+Jt/HJaZ3l071PT4/TB75Qbjyte589O0tfh8hDW/KVrroXO04XC2OWoAsO5Tuv8APGmxHD3sM4N2nusK/G2e2eNchGucZbOYs4eio4a+V7Yx8x7LTuNYWaWR9md+y3jmJ1LHi1S8tN7krV2PYc+qkdpadz4VF4rZ7Dh85BVJbNW9W0s1RTOYGnhYNh3RtdU4tqbTk/F4W8h0JU4i/QInG58LMMvfT9UV1ayQ0Tjcj6U6OO0U+Q5iuUH2N9NOXNT+Ip3PpjyL7L0EyG6HkZhkV4CNh2WrMhfT9LRew80ZFrfSuxso8uf8Poo2OgtsOytRxmzzXlvIlBtJlixDoZ76Q6oe3haWzl6GkZTTaafsey7MqOjWyU5b7XbwtWZq5YGtp5WtgJ2PZPlh/wBMXB8n1P6eW2fvRMolmcKc3sey5m6l6fraatdeJ1g7wvTPOzICesfK5tI48/SuYMwPTpXR1D3CjcNzwxVLMXTPQuL8oi0tyOWGy1lPcBrkz8fWF4vfnwtvY5kZiFMXf8K//asenynr45LGmdz+VVXjts7OvnoTr+lZlD1TU0FdGSSLELszI3OWbC4YT+IIsB3XHnTnRFdh1Q1wicLHwtw9BjEaSJjRfYKSGO4y2cb5DnV5NTjs7o6b9VE2H0bWGt4H5lYMx/VtNV07mfjjsPzLmpuLYy6INY9ytGN0HUGIgkF5v+q0K5SkeOZWHCNjezJsy/ULVYi6QCqJ1HytZTdS1nUVSXAudqcpJstOocTmAdDIbnwtgZY5BYpLIx01I877/CtCqtyKP5Y0P6T5P5d1eM1LHywuO47LsP0/ZTvp5Yb0xtYdlY8isin0ojL6QjcfSus8pMsI6H2nexbSB2V+FDaMHk+Qj6vsyfLLpEYdTxEx2Nh2W0KWk1U2gN7KgwfAvwkLA1lrfZZDh1G8gDTypo4pwmVm+8zBOsumfxUL7Q3uufM2skafGZJJH0YJP2XXeK4O2SM3YsN6g6Ljq9WqO9/slWCm9s3+F5t48l2eePXvpWirqskYYDv+VWKj9IMGn4sMH6aF3xjGWFI+TU6n/pW4ZbUsXEA/hI+PPScPy2MK/pw+PR5TPeCMLH6aFd8F9HlPFKHjCxe/5V2hS5dUbnbwf/FXrD8uaIEf8P38KCWB6fwhzvLVOPTOZugvTy3Cixv+HgBtvpW1MKy6ZQ0YZ+GAsPC29T9BU8DdTYO3hMqemrN0tiP8KvLF0cyvJZSnrZo3qnpG0Li2Dey5t9Q/S076Kdopz37LuXHejDJEf8rsey0ZnTlRLX00oFOTe/ZV7MNN/DsOG8l9F/seUucHRFVJiUwNOd3HssFwXK6WpxNt6Unfwu5MzvTpU1FXJK2jdzt8KxnpT04VDcRDn0Ttj+RNjhqL+HfYnkkLI9yNU9JZIzVuHNaaG/w/lVTN6X5qqcP/AMOO/wDpXYnQeRYgpGMdSHj8qzzB8iaaV7dVHe3+lSLEW/g7J8ir9P8AY44yy9LclPXxk4Zb4h9K7LyByWdg8MNqO1mjss36TyMo6aRrxR23H0rcvQnQEGHxsayG1vsrdOM0zzPyHm6pp7ZcctumBQxRF0drBbKo2+1EAdlasGwtlIxtm8BXIyEbfdaVS9ejxvksqNtjkVzXB4sonUxL+E6ha5+xCucdECA+39q/BtmKshRZTUtJsCWq40UOjYt7JYYGjsqhrNK0q09FO2SnLZI6zWlU8riXWB2spnuu21lTvDrkgf0pCu10R6nHupoANiUxkN73v/CkDC3ayd7MhaJErNjclIOAhHux8YrWx4AvcJUxnzBPSew5LQIQhOSFBCEJRGkwQhCAS0CY5pveyehAozS49k5gIvcJUJH8AEIQmACEISpbAEIQkAEIQk0gBAAHCEJ0VoH2CEITxvqCDuChCBUtDNDvCNDvCehAozQ7wjQ7wnoQA1rSDuE5CEACEIQAIQhAAhCEACEIQAIQhAAhCECNJghCECeoIQhAeoIQhA74CEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQma3eUAPQma3eU5pJG6AFQhCABCEIAEIQgAQhCABCEIAEJhc4E7pzSSN0AJJ2TU6TsmoAEIQgCRvA/RCG8D9EIAEIQgY/oIQhMmtix+AmOFnFPTXFv7p0VoGxqEJzW35CdJDU9sQRgi/8A0Q5unungAbBI4i2/7KFrZKiBNLCTe6cedkDdKlvoc3oaWWF7qMsJNwVO8AHZMeNuU1w7D029kRaQLprnuabBSPBO9yo3NvyN0jj6ksYRInyFx2Tw0ht7pBGQ64CdJJpZpKic2hXDsRswsAbprmh3zKEvJdseFIC88JnvodFtMilp2A3IUbqeKx+HsppQ8mwTGQyl1yNvukdnsixGb19LViFG2QbNH8KzVWDsc8nQP4WYOo2SbWURwZrzcs2UE6W+yzRyDh0jB5+nWPN/bH8JtP09Gx9/aH8LNpMEaTtGkbgkTN/bt+yjVWi//wDKNx1ssuFYUyMizR/Cv1DTBhBASw0LIj8qq4ogOArdMezGzM2U39KmKIaB/wDoSSUeoXIUkF//ANKlAubFX4x0jGb9nst0lKA61lS1QfC74SrzNEBuAqKogE17hO9fYc/1jspYJ3ub8RTnEnc904RNbsApG0xcL27KGVZYxrGyldGH7qlqaVjgbgbK5/hHHhpUM2Hyu3AKqW07Lzv9FtGOVuExzPLdAN/ssd6l6HhrYy0wggjwtgilhjv7rd0j8PgqPoBWbPGX/DQw+YsqktM536qyEosVLy6labn8qwHGPSNQ1crniibv/oXXk+BQarGIKP8A7tU0n/kDdVZ4abOlq8quhHTZyHhvpIpKd4P4Jv8AtWTYX6a6OlsPwbBb/SulHdK07Df8MP4UjOnKdo/8EfwmwxFsdLyu1rpmicJyPpKMgtpmi3+lZdgfQ1LhjBaFv8LYU+CRR8Rj+FTnDWk2a1WY46iVrOatyF2yy0NGyFwbpH7LIcNoWuiDrDhU7MJeJAdKu2H0z2NADdldqq0Y+Tkyn/RhohbYKenhEZ4VbDRlwuQEk1KYxcBXop/DHss2xkbQ/ayf+GFrlNgIDrFTSbC90/1Yz8rKSriYYiLd1rzMnp8YjSSMAvdqz3FJ3aS2NWHEKOWraWvbcKC2CkaGJd6dnG+dWQ7ca91/4YG4J+Vcp5qZD1GCyySw01rE8Beo/VHRkFXG4GnFyD2Wj81sjY8Vhk9uhBvfhqzr6dnQYWcoyR5d9VRYtgMz2Na4WKxWtx3Gay8Z1W4su0szvSfV1lRI6PDjuT9K17/90ivinN8Ndz+VZNuMv+Hf8Xy/49dnMDcFxKuku+M7q64ZltVVzml0HP2XTVH6VKuGxOHHj8qy3pj0yztezVhx/wBqqPF/9HYVeTekNexzzl7kLJiNQwupBu4fSulspfTLTtZG99G3gfStlZd+nsUMjHOw/gj6VvHpHLyPDIWN/CgWA7J0MRSfwgyvJ91t+xhWX+SdJhzIwKVuwG2lbU6f6IjomBrYwP2V/wAB6ejiDbRDYeFfocMDCAGf0tGOGoo885Lmp3WPTLF/3dYYrFo/hWPHegYq9rw6IG48LY0WGFzb6U7/AAVr9vbG/wBk54iMSvlp1y3s5v60yFpsTL/+Faf/AGrUPXfpWpJQ5woW7/6F3FX9MxvuDAP4WNdRdCwyxm9MP4VDIxF/DpeN8mlFpNnnF1j6UYG6yKJv+xa06g9MLYZXaaJvf6V6VdS5Vw1LXEUY3+ywfF8i4qmR3/AD/aqP+N+3w7jG8qfp/sedFX6eZKZ4Iov/AIq64JkvUQaQKX+l29i3p2YXav8ADx/tUFL6eww//kFv/arEcRSXwoZfk6c+2cr4BkfLVFgdTc/ZZ30/6ZWVdi6jH+1dF4Hko2mkaPwQ2P5Vsno/KiJobqpB/tU1PH6ezn8vyGt/05o6Y9INJM9rnULf9i2l0b6UaTD42vFE0WP5V0VgOX0FMG/8INvsssw/pSBsQApwN/C16cHSOZyebT/pp3onJmnwkta2naLfZbS6X6UioNPwAWHhXyDp+OB1/aCuFHSNa7YK2sb1XRzuZyErF0wp8LY5oAarlR4U1jb2H8KakpgG8dlVEtjHCkjWtHO23ScvpbsQpGhhFlaKrD2EG7f6WQSs942AKhmw4Fh+H+k9QT/g+nKcDDcQweNwJDBx4VnqcKaHW0Dnws7q8NBuNP8ASt8mAte65jSus3cbktLtmK0mGM1AFg58K70eHsZb4Rz4VxbggjdcRqshwyzfl3Cq21f9EyOQ9vjKdtDE6IfD2UDsGieT8I/hXRtHLfTp/RL+Fe03sqUoez1opQyZp/SxVfS8UzbFn9LE+qctafEY3MdADf7LZrYmgWLVHLh8b/mYOUqqi1ouY/KX0PaZzZ1R6e6Os1O/Bt5P0qwUPp3pKWo1ijaN/wAq6mrMDpZmlvtg3+yt7ukYiSRTj+FHKlJnQ4vlFlcPppLCsqYKVoYKZot/pWS4Pl3EwtvA3+FsmPpWLVtCFcaTphjGgiIKWupNjcnyiycdexhuF9CxxtB9ofwsjwzAGU4sGj+Ff4cIbDHcssmNayJxFgrcaYr4c3kcvO59so/wYY2wCRlCSbkKc1LTNoB5VwpqZskeoBOjQzLsv90U1BSlpGyuvt6IgooIWtktZVbmgxcK5XRopSb2QxEA3Kk1t8qDdpO6Nf8Aq/tXoQ/UXpom1ajaydYeFAyWxG6lY+4vdDixjZI2MNPb+EFlze6cCDwUJpGN9v7oZzdDnEGwKVwsPhH8JGtj18FJsLpA8E2TS51rEpBsUKPQ7XRIhHKEogIQhD6AEIQm+wAhCEewAhCE4TfegQhCBQQhCABCEIAEIQgAQhM1u8oAehI0ki5SoAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQg7Apmt3lAD0Jmt3lOaSRugBUIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABJoHkpUIATQPJQAALBKhAAhCEACEIQAIQhAAhCEACEIQAhYCbpCdGwTk1/P7IAB8fPZNOxsnR90jmkb/dACIShpIuE5rS3lACt4H6IQhAAhCECNdAhCEDNsE0sub3TkIAb7f3SuOkbJUjgSLBAA03F0OAIv4Q0ECxSPJvZI0mPiQnY2QNzZKWkC5SJgux7m6je6Zp1bJ7OP3TmkA3Ka29kib0R+wbX0pphBNy0qpBBF01zLnayRtsFNog9rxf+FDNA03BVWmPjc7+UxxTHKT2UD6axsAg/ALeVWGLexP8ASZ+H8hKq012ORTtaHfEU9o+EgqUQWPCf7ALCl/FFA5aRTMHxXVVDGH7FMZTm6qIhp2spPxoh3pgKdg//AJKKSBvlVDnaTaypp5COB/aFVFh7yRE+Bt7+EjdIN0yaU2P6+VAahwNlKq4ojluX0uETwCbf81O0DklWtlabkKpiqXOt+ic1sYo6Kx+lwsSo/aYFH7xLb3QJyTyhLQkm30H4RpdqKlDGNbYf8lGHuJsCpGarbpGm2JCSgtINDfCa5w0m7eyeoZpGtuo5VtkjnstmJRudKS0qFsr4dlcnxtn3UUlE29lBKr+sWDS7KZtQ6S12lT05cCPhT46AAggKqipGtA+FQyp2WVc2iJwDhYBUVXM+EEtHdXb2bdgqeooWvabtCb+BArtGN1eJyvcRZSUWuVw1BVs+ENLz8Kno8PEZuBwj8KHxyJLofBQNc0OcFURU7Y1IGFrd1DVze1HcFPUNBK1yfbKiOZrRZK8NlVphry59iVXU9R91NFNjHpDzShtyoZi75QqxhMgSPp2uNyFMo/8ASPaLPPSk3cVSzQaRu1X99HqHCoquhDAdhsh1plymcUtMsM2HMqDZwVBW9GUde0tfGDfyFfJgIylgqG35CgnVFluFziYPiGSuDYgSX0oN/wDSrFX+nbBQ/Wyjbz+VblpZInmwIUktMyUcD+FBLGrkizDlMip6ND1OQeFstpoht/pTqPJmgpH/AA0tv/at3S4XGdy0KknweMXdpCheJH/hchzVz6bNcYdl/R0gGmHv4V0j6cYwWay23hZS+gYHdk9mHtduAlWNFfwklylkvrMdpqB0NgGq4U9KTa4V4bhDQL6f6Tm4eGC1v6Sfja6KNmZ7so44w0aS1SshGxsbqdtMAeP6U0FObgECyRwZXdxQupPcOrSqbEMK95m7FkMVGDYW5Klkw5j22I3UUqU0MWZ6SWjAanppkhsY/wClCzoSCU6zFz9lnT8JZrJsE+LDmNsFX/xYplxcvdFaizAp8uaOYbwf0qWXLWkZxB/S2b+BZ9lHJh8e5ICljStkf/ytsn2zWTMv4I3XEPH2V0wvAW0ZDRFwsvnoY+A0KL8JGOGhW4VJA8uU1tlJQUrQAA3+ldKWJrABZJTQNBuB3U/tkbBXa4Ip22OTIqgtuNrbeUsDQDcJKuMgjhJThzeSrCqTKdlj1ouEM5AF1K4iQKmg4ClSfiiihZJkjQGm4QZrnTZRpQQDcpfxxIlNoHwMekNE21wFIHAnYqQDazihwWizXe10UjqFh3skMLWHjlVRYS6w4TJI9PCr2Vx0TqbZAIw34tN1DObdu6q2sc7hMqKe7bkbqrOlfwkjNJlrnqTGNgom1z3c9lPVUwD7WUcUDXG1lB+PTFnY9BFI553B3VY0XbYNKKegAANlUimawJXVsh/K49EdPTM1aneVVXa1u3CYALJHOABH2SqGiOVns+xk9SCNICtVe9zTqaq+Vwc7ZQSwe7sR3U8Y7ItooKSme94kJ5Kv1A0hmgqmpKGwAsVXxBsYsp4xQ5TJGwtHxA8ofIGjSkM1u5VPLJrdsrUYi79iKoncH2A7oY4uG4SmIPdchTRwfZSt6RNHX9Gxx3O/ZSgaeEe2QPlSOdpNrJm9iesdkzHWF7cponNwCo/ctxdOY3fVZNa0N0tjydRupFGNjdSJo19CFgJuk9v7pyEDfYALCyEIQOBCEIAEIQk0gBCEI0gBCEJQ0CEIQAIQhAAhCEACEIQAJNA8lKhAABYWQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIADuLJNA8lKhACaB5KAABYJUIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAE1/P7Jya/n9kAEfdOIB5TY+6A4l1kAOAA4QhCABCEIAEIQgR/AQhCBgIQhAAhCEACCAeQhCBU9DDGTyE0sAO4UqQsBN031HkZIajU3yllYBweyjUTWmOTZIJQNg7+ke7/q/pRoSC9D9bfKf8JbcEcKFKHkCyd6ph9Fc0k3ATU73D3CanCi6XHsnNBAsQkD7C1krTq3Qk2wFsBwE4ubb4ef0THkgbJut3lTeo1rbHkk8qCoBvsFLrPgJhaHcpdaBpJFLNGSw2G6p3RHe43Vz9hpHKY+lBdcBNctDS2sicCquFh8dlMaW/ZSshDQm+7E9URNa61iEe3pNx/SnDBfa6NDU6M9/RklpDBGRwE9oIFilGwsi48p5XGyO0tvdUFZN8XKq6iQ6CPsrbUOJcQfKco9Cp6KilmBFlUxt9zhW6BxHCr6SQhoH2SOIvsyoDGjske7SlLgBdRTPIBP2THFNCueugfU6Da/9IdUB7du6oZpHF+9k+F5PdJGrsb+XRVxsDzchSNiY3gKOB1gpdbfKVwiPjY9DJ9mEqgrWPfEbBV7iHixKZJC14TfxokVhZKene19yFX0zHi11O2is65U0UAtcp3ohXLSFi2AspC9o7pjho2HZQzSm1k5R2Nc3/CpEjSbAqGr0lpH2VKJ3BPbIZeUjjolhL+lpxWGTctHdWl5qQ+zbrL30DJm7j+VA/AIwdWnv4TJRJVayxUc9UyxN1c6aomeLkqoOEsabaeCnCBsAsQoHFkv5t/SP3Hn7pH6ntsQnPe1p2UtPZ9gm6JFYkUf4b7J7YwzgKvFOC1U88JBuBZCix/5dj4gxzbJ4pb8BRQOLXABV0YBbuFL+LoglNrtFKaLwErKdrOQq1jWm+yZMxpuAm/iRG7WRtDGjVskdUN4bbZRykgbFU4lcHWHhI6tEMrSeV5ANlSy1bmusFM55LLqkmjcXXTPwETyGiQVkh4KkFQ+UaR37KnjjPBCq6KOzwSEipSGxytsp5IZgdRChIkvYq8yRseB+ijNHETeyljXourJeihijdYGyqYhtxup20wbwP6QYCHAhWIxSF/MmUtTCXcBNihtYEKtdECLFDIW6lImkiKUtkUUTgBYd1Jpd4Untho2Ke2M9v7TWyGS2QGNwF7JDtyqgjsVBKCHW+6VdlexNACRwVIJCRsVFbe6GOIF7IaGwbZOx+1iUpAPIUTSbXUjXF3KY4pluEuhQ0X2CZKwm+ocJ4IablMqJPhNvCh/HsmTey21+ztlFTWa4EqSqDpHblNjjc13H8pn4v+CvbLjAQY+USHf9FFTyaQnSODt790300ipbJpjHTFpJB/lMMuo8ndBGrlI2P4uU31WyL3e9houb2U0EDQb2QxgA3TxdvCeoie5IxoBAAT3Btuyja7vdK5xO/wBlKkoolUloilc69rpjRqNvunuaXcJ8UO4cVNGTFT0xYY7DdS2A4CQAAWCHEgXCG2TxYj3gAgqJ5BNwiaT7d0jCHcj+032YvsxdNhclTM4TWi53UrWCw3PCG9hvYNaCNwnJAABYJUgj7BCEIG+qBCEIHAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACRzgNvslSFoPITZCoYhP0N8Jh2JTQfbHs+UJUxrjcC6egQEIQgASPJA2KVRlxNgT3QArSdXKeowSDcJdbvKdEY3sehCE4QEjx8KR+q+11HK54bsUAKXgGyPcJNt/5UQLybm6kYARe3dAEwNxdCa11uSl1t8oARzSTcJsjHW/dSAg8IsDyEx/SRfCncDYhRu1NNtP8Aaqvbbe9kGJhNyEgFJd35f7UjPlCn9ln3QI2N3QlsVPRCne2e5TntaTsEJfVjvZDQyxvdOQhOS0KCY7k/qnpjuT+qlAROZYmxCalZykfwB/HCEjiQLhN1OPdV5MB6eDpaLqm1nwEGVx2uo2xGtkr5ACTZDHh/Cjbcj4k+MAXsE320xJJtCl9jayaTc3Q8WvYqMue0Xt/KmVpB6BM3ULqimYQeFVsLnHfdOELXndqnhYhJVso4IS7kKrhaWdu3ZSNpww7J+ht72UjkmReoxMlGrZOm+HcFRB7idykT0McWRPpiRqsoWEtk0/dV7NxZNfRsB1W7p6mNcNjGvsLpr5xe9/7TagOaNgqJ7pb8pG4ofGBWxVQLrXVRDOCRdWyn161X0gu4XUTmtkygyrDbnYJ4aAEbNFrpGkk8pjmtkijpDZGkAqjmY7Uq9wuCFDLEAdx/CFYhPTstsw0Dcd0QygEFT1sbSNlDBGDf4eFNGSY1RaZW09RrFlV8jhUcEIYLjlVTCb89kyQ9LZHKzc28Kjq43ngK4kA9kySJpO6Y1seiz/h3k3KqKaFzCCSquWBgbcNVMXODrBJ6MetoqGuAFiVFM4HhR6nDlPaGvNrp0YokWxjWG4cp45dCb8Ddv+ijmIvcKVNa0O1tFS6paAovxGp2558K3zzv1W+6kppHO2N0nRDKDKqQl4TW0rvmNtlU08bHN3Ur428gJG0VpQkUD2EAqCRjibWVzfTtI3b/AEozSstfSk2itKuWygaCDuFUU/Kl/Dgdv7Q1jW7gJEtsj9WmPaHcp4BJsFGHkCyUP8qT1aJIz0Saw0fF2TXVDGm1lFITyD3UMrnb2KVRJozbKoSCQ7eFKNhZUVNqN7j+lNqcTe6RrROpJk6eXtUDXOAF09hJ5TGh6WxTubpHNuEqLHmyEyOyJGWW5CjVQQDyFE9m1mhSJkMYDWk3tcqRpsb2UQ2dv5TyRY2KGWIR0SPNm3VO+TVcJznkqN3J/VKkWIxexjmBxuf+SPaA4t/CchGkP9WNawp5YU5mgj7p4AtuVHNIqXQItBvwlDCDdShjU11gbBRerKbg0xEJQCeAleGgcI9WJ6sRrSTdPUYJHdPY4nuka0SRg2SRwgcp/tjsVGxzr8qUOFgCUvsWVDSBo0i11DUO0jvyp7g8FU9SCW/e6PYa1rsoppbeUtPLc/8ANQ1LXA8optQd3R7Eblv4XSnk247KYG4uFSwkhtwpgTbYpyexUyRCawk8lOQPX0EJHEgXCaHOJ5QPHoQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEIQAIQhAAhCEACEITZAI5xbwmHc3T3NLuEw7GyaADY3T2uLuUxCAJEJrOf2TkACjUijPIQI/ghcQ4BKg7JQ0u4Tk0Il0PQhCXaYNAmSMFr/AHT0JRpFoagAAWClQgCNCUtIFymOabkoAeHEcIDz3USczn9kxpi7ZK1xJslTWNtvdOSpCtgkdwUj+E1LpIXaGucQbBDXFx38Ifz+yGc/slFJC0Bt0w3AJUreB+ibLx+yA2yMvINkaAdz3SW1Ep42Fk/aH7Q3QPKCNBB5TkjgSLBRzew2hpeSLJEOBsQmhhBuoGxRqe1o2KVOY0jf7KJvQDRubJ4aG8JUjml3CjfwBSARYpCxtrJGsIN05LFsTSGtiAT2RDlIntN2hTxfY1jX2B2SJzmm5Kjft+6ni5DJJMhncSbWUfCkkBJIHlNDCDcp+2RNEsTb3UpFxZNZzdPuNNu6X2YRimQSwB11Tvo7b2/tV4YHDcpfbBO//JNlIkUdMt8VIQ5VUUAjAIU3tAcW/hBFmWULZIkkI5xckBI4QhRbex2kLrcmSuN7nwnJkl7o2xOiCSL3UjKfSeFUxt1OsVJ7Q7W/hT1y0hrRHG0AJ4JG6Cwje6RK5oWKQ73Psmvk33CY/wCYprnaTayT2HpIeCHixCjkhAuU9jgP3TiQ4WBT000BSSMG1iofcLSVWyMPA3VNJBve6enoli0IHkm4/hKQX7aU+KINHG6mZDcXIsk2xZTSKKSjvvb+0sVPpI2Vc6EHYIELQLd0baGOxMZASOVOJAByoyzSNk1riTYpNtkUtP6TF+oWASEdiExnzJ90Ebihvt/dNfGLp7m6gmFpB3SrpkM6/wBSNCV4seE14J2AUjkktlT1e9DXOvsmuYCb3UkbPi3UnsX3TffvRYhFobSx2ve6m0N8JYWBp/ZOc0k3Ca57J4p6GFgQGhvCcWEC6RJsmTQJ2va1uyamO3dZNT7Elpj0x4tv5TmtLeU4ssLlO9hElshc0HdMUsjTuQFEnKf8JY+uhpf4CadzdOYwl24TxECbaU720SKUUQucW8JpcSLEKofABwFC+MqRSWhyaY1jiDspmuvyomt0XKliaXbBRzlsjtSbJmNL+Er4wGm6fENI0olF9vsoyq0iFrdPdI/i6e4aUmxHCCJpJkYFzZPa3SlFuAhNkSQaFa7T2SF4JvdNk7Jqh9tFmOmVEcm3lNkAcBuomv0iylj33+yPYimuylnhDgfKhbEWm4Cr5I9XHlRuh09gl2yFxGxyEbKZr9hcKBrSDcqZvA/RPTGkrHeO6eo4+B+qkUhJER/ylNbyP1Tn/KU1vI/VBIPQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQmyAEmlp7JUJoCaG+EaWjslQgAsBwEIQgATXNaBcBOSP4/dADLX2UgAHATG8j9U9AiWgSFwBsSlTH/ADFLH6KO1N8oDgeCm9v3QCQbhPGP6PQkabi6VAgEA8pjm72AT0JU9AR+3b6U5rLHdoTkJABCEIACAeQkLRawCVCBU9EbmC/xBDWC/wAITy0E3KA0A3CB4NuBuke0uPHZOQgCP2y3cNRY+FIkf8pSN6AYl0uHZIpFG/gEUjSG3t3TACeAppBdtj5TAABYKJip6Eaw3+IJ3CEKOQ8EIOwumtcSbFN1sR9IchCE9RSGOT+Ci1904uBFmpieGgcKxCGhN6XY0l3BKQgHkJXfMUinUVojcuxjo7m+lJ7Y/KpEJfVDW22NYCDwn2Nr2TS4h1rJ/wD5aa1oIMRpNxv3T1GNjdPa4u5TGicVNc4WIunJjuT+qif0BEWI5CE+2oC6Z6oXbI3XtskaCd3BOOxshHqMb7FbZpvZO1t8piE5dDhXOJOx2SIQkb0KnoY4HVwmPa4nhTJzADe4SJ7YqZCGutayc1rgbkKRzQBcJqfF6FQEAm5CjdFt/wDoUiVoBO6mT2DeiJke4Nv5UzdLRuUOaALhNTktkUp99j9TBx/yTHEXJQgi4sl9RPdDXP7BNDLG4aUEWNrqRHqhFMI47WcQn6W+EMNwlTR3sJpaOybI0dh2T02TsgRvaISAdiEgYAUqFE5PZD6oAzwFIBsAhOZwk9mTRhoGAi9wnJHkjgput3lJ7MeOc4WIumIJJNyhHswBNIOu9k5ODARe6PZgNT9TSLEprm6e6RHswCS3DQoxFf7KRCX2Yns0xjGAO+VPDN7hqE9nyhP9h3sxjmE8hNdG0hTJNDUvsxVJopXQ3cnRRlh4U7mgC4CRrQ7lI22Lv+jmtAF7JspI3HhOe4jhRSPJ2KWLIpfBpJcSCmudbZpTu90x3J/VOKspdjmuFtzulUY2N1INjdNl9HQkBb5CY4G9rKYgEWKQsABVeRZi9EKljNrKN/zFSRcX+yaSdND0haDuQlQnJsjaZH7d/pRa2ykSaBe6liiL1FjadtuFImx905Sjl0xH/KU1vI/VOf8AKU1vI/VBIPQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCAP//Z"
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
      const arr = pdfBytesFromStringLatin1(str);
      this.addBytes(arr);
    },
    addBytes(arr) {
      if (!arr || typeof arr.length !== "number") return;

      // Evita RangeError: Maximum call stack size exceeded com imagens grandes.
      // O operador spread em push(...arr) estoura a pilha quando o logo possui
      // centenas de milhares de bytes. Inserimos em blocos seguros.
      const CHUNK_SIZE = 16384;
      for (let i = 0; i < arr.length; i += CHUNK_SIZE) {
        const fim = Math.min(i + CHUNK_SIZE, arr.length);
        for (let j = i; j < fim; j += 1) {
          this.bytes.push(arr[j]);
        }
      }
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
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 841.89 595.28] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> ${xObjectResource} >> /Contents ${streamId} 0 R >>`);
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
      encoder.addBytes(obj.bytes);
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
  // Usa exatamente o mesmo HTML/CSS da opção Imprimir.
  // Na janela de impressão, escolha "Salvar como PDF".
  // Dessa forma, fonte, tamanhos, espaçamentos, logo e colunas ficam idênticos.
  const linhas = pdfColetarLinhasDaLista();
  if (!linhas.length) return alert("Gere a lista antes de salvar em PDF.");
  if (!exigirDataFuncaoAntesDeSaida()) return;

  try {
    gerarConferenciaMesasParaImpressao();
  } catch (e) {
    console.warn("Não foi possível atualizar a conferência antes do PDF.", e);
  }

  if (typeof window.imprimirListaGerada === "function") {
    window.imprimirListaGerada();
    return;
  }

  alert('Não foi possível abrir a folha. Use o botão "Imprimir" e escolha "Salvar como PDF".');
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
    montarLinhaEditavelListaGerada({ totalTxt: "", ingrediente: "", pratosTxt: "", ebosTxt: "", obsTxt: "" }, true)
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
    const obs = (it?.obs || "").toString().trim();
    return ing || qtd || obs;
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
      <th class="print-observacoes">OBS</th>
    </tr>
  `;

  const tbody = document.createElement("tbody");

  if (!itens.length) {
    const tr = document.createElement("tr");
    const tdIng = document.createElement("td");
    tdIng.className = "print-ing";
    tdIng.colSpan = 3;
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

      const tdObs = document.createElement("td");
      tdObs.className = "print-observacoes";
      tdObs.textContent = (it?.obs || "").toString().trim();

      tr.appendChild(tdQtd);
      tr.appendChild(tdIng);
      tr.appendChild(tdObs);
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
        "Molhos de couve",
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
  const caixas = [];

  for (let i = 1; i <= total; i++) {
    caixas.push(`
      <span class="conf-ok-pessoa" title="Pessoa ${i}" aria-label="Pessoa ${i}">
        <span class="check-conferencia" aria-hidden="true"></span>
      </span>
    `);
  }

  return `<div class="conf-ok-lista" aria-label="OK por pessoa">${caixas.join("")}</div>`;
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

  const campo = document.getElementById("dataFuncao");
  const valor = String(campo?.value || "").trim();

  if (!valor) {
    alert("Informe o dia da função antes de imprimir ou salvar em PDF.");
    campo?.focus();
    return false;
  }

  const escolhida = new Date(valor + "T00:00:00");

  const hoje = new Date();
  hoje.setHours(0,0,0,0);

  const fimAno = new Date(
    hoje.getFullYear(),
    11,
    31
  );

  if (escolhida < hoje) {
    alert("Não é permitido usar datas anteriores ao dia de hoje.");
    campo.value = "";
    campo.focus();
    return false;
  }

  if (escolhida > fimAno) {
    alert("Não é permitido usar datas de anos futuros.");
    campo.value = "";
    campo.focus();
    return false;
  }

  atualizarDataFuncaoNaLista();

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
        ebosTxt: montarTextoObservacoesLinha(item),
        obsTxt: obterObservacaoAutomaticaLinha(item.ingrediente, montarTextoObservacoesLinha(item)),
      };
    });

    const linhasPade = Object.values(consolidadosPade).map((item) => ({
      ordem: item.ordem,
      totalTxt: item.total ? formatNumero(item.total) : "—",
      ingrediente: item.ingrediente,
      pratosTxt: formatarDetalhesQualidadesPade(item),
      origensTxt: montarTextoOrigensLinha(item),
      ebosTxt: montarTextoObservacoesLinha(item),
      obsTxt: obterObservacaoAutomaticaLinha(item.ingrediente, montarTextoObservacoesLinha(item)),
    }));

    const linhas = ordenarLinhasGeradasComPrioridade([...linhasNormais, ...linhasPade]);

    // 🔹 MOSTRAR LISTA NO CARD "Lista gerada" no mesmo visual da tabela final
    const container = document.getElementById("listaGeradaContainer");

    const linhasHtml = linhas.length
      ? linhas.map((item) => montarLinhaEditavelListaGerada({
          totalTxt: item.totalTxt,
          ingrediente: item.ingrediente,
          pratosTxt: montarTextoPratosLista(item),
          ebosTxt: item.ebosTxt || "—",
          obsTxt: item.obsTxt || "",
        })).join("")
      : `
          <tr>
            <td class="print-total" data-label="Quantidades">—</td>
            <td class="print-ing" data-label="Ingredientes">Nenhum item gerado.</td>
            <td class="print-pratos print-origens" data-label="Origens">—</td>
            <td class="print-ebos" data-label="Ebós">—</td>
            <td class="print-observacoes" data-label="OBS">—</td>
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
                <th class="print-ebos">Ebós</th>
                <th class="print-observacoes">OBS</th>
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

const tdEbos = document.createElement("td");
tdEbos.className = "print-ebos";
tdEbos.textContent = item.ebosTxt || "—";

const tdObservacoes = document.createElement("td");
tdObservacoes.className = "print-observacoes";
tdObservacoes.textContent = item.obsTxt || obterObservacaoAutomaticaLinha(item.ingrediente, item.ebosTxt) || "—";

      tr.appendChild(tdTotal);
      tr.appendChild(tdIng);
      tr.appendChild(tdOrigens);
      tr.appendChild(tdEbos);
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

  const listaJaExiste = window.__listasAcumuladas.some((item) => {

  return normalizarTexto(item.nome) === normalizarTexto(eboNome);

});


if (listaJaExiste) {

  const confirmar = confirm(
    `⚠️ Essa lista já foi adicionada anteriormente.\n\n` +
    `Lista: ${eboNome}\n\n` +
    `Deseja adicionar novamente?`
  );

  if (!confirmar) {
    return;
  }
}

const chaveNova = `${normalizarTexto(eboNome)}|${pratos}`;

const jaExiste = window.__listasAcumuladas.some(
  l => `${normalizarTexto(l.nome)}|${l.pratos}` === chaveNova
);

if (jaExiste) {

  const confirmar = confirm(
    `A lista "${eboNome}" com ${pratos} pessoa(s) já foi adicionada.\n\nDeseja adicionar novamente?`
  );

  if (!confirmar) {
    return;
  }
}

window.__listasAcumuladas.push({
  nome: eboNome,
  pratos,
  itens: itensConsolidados
});

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

function modalCriarLinhaPositivos(listId = "1", ingrediente = "", quantidade = "", obs = "") {
  const tbody = document.getElementById(`modalBodyLinhas_${listId}Positivos`);
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="modalIng" type="text" placeholder="Ex: Pipoca" value="${String(ingrediente).replace(/"/g, "&quot;")}" /></td>
    <td><input class="modalQtd" type="text" placeholder="Ex: 7" value="${String(quantidade).replace(/"/g, "&quot;")}" /></td>
    <td><input class="modalObs" type="text" placeholder="Observação opcional" value="${escaparValorInput(obs)}" /></td>
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
    const obs = (tr.querySelector(".modalObs")?.value || "").trim();
    if (ing || qtd || obs) linhas.push({ ingrediente: ing, quantidade: qtd, obs });
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
    (data.itens || []).forEach(it => modalCriarLinhaPositivos("1", it.ingrediente || "", it.quantidade || "", it.obs || ""));

    // Lista 2
    if ($("modalSubtitulo_2Positivos")) $("modalSubtitulo_2Positivos").value = data.subtitulo2 || "";
    if ($("modalModoFazer_2Positivos")) $("modalModoFazer_2Positivos").value = data.modo2 || "";
    modalLimparLinhasPositivos("2");
    (data.itens2 || []).forEach(it => modalCriarLinhaPositivos("2", it.ingrediente || "", it.quantidade || "", it.obs || ""));

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
const ok = confirmarExclusaoDupla("este positivo");
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

function modalCriarLinhaBanhos(listId = "1", ingrediente = "", quantidade = "", obs = "") {
  const tbody = document.getElementById(`modalBodyLinhasBanhos_${listId}`);
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="modalIng" type="text" placeholder="Ex: Pipoca" value="${ingrediente}" /></td>
    <td><input class="modalQtd" type="text" placeholder="Ex: 7" value="${quantidade}" /></td>
    <td><input class="modalObs" type="text" placeholder="Observação opcional" value="${escaparValorInput(obs)}" /></td>
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
    const obs = (tr.querySelector(".modalObs")?.value || "").trim();
    if (ing || qtd || obs) linhas.push({ ingrediente: ing, quantidade: qtd, obs });
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
    (data.itens || []).forEach(it => modalCriarLinhaBanhos("1", it.ingrediente || "", it.quantidade || "", it.obs || ""));

    if ($("modalSubtituloBanho_2")) $("modalSubtituloBanho_2").value = data.subtitulo2 || "";
    if ($("modalModoFazerBanho_2")) $("modalModoFazerBanho_2").value = data.modo2 || "";
    modalLimparLinhasBanhos("2");
    (data.itens2 || []).forEach(it => modalCriarLinhaBanhos("2", it.ingrediente || "", it.quantidade || "", it.obs || ""));

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

  const ok = confirmarExclusaoDupla("este banho");

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

function modalCriarLinhaOferendas(listId = "1", ingrediente = "", quantidade = "", obs = "") {
  const tbody = document.getElementById(`modalBodyLinhasOferendas_${listId}`);
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="modalIng" type="text" placeholder="Ex: Pipoca" value="${escaparValorInput(ingrediente)}" /></td>
    <td><input class="modalQtd" type="text" placeholder="Ex: 7" value="${escaparValorInput(quantidade)}" /></td>
    <td><input class="modalObs" type="text" placeholder="Observação opcional" value="${escaparValorInput(obs)}" /></td>
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
    const obs = (tr.querySelector(".modalObs")?.value || "").trim();
    if (ing || qtd || obs) linhas.push({ ingrediente: ing, quantidade: qtd, obs });
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
      data.itens.forEach(it => modalCriarLinhaOferendas("1", it.ingrediente || "", it.quantidade || "", it.obs || ""));
    } else {
      modalCriarLinhaOferendas("1", "", "");
    }

    if ($("modalSubtituloOferenda_2")) $("modalSubtituloOferenda_2").value = data.subtitulo2 || "";
    if ($("modalModoFazerOferenda_2")) $("modalModoFazerOferenda_2").value = data.modo2 || "";
    modalLimparLinhasOferendas("2");
    if (Array.isArray(data.itens2) && data.itens2.length) {
      data.itens2.forEach(it => modalCriarLinhaOferendas("2", it.ingrediente || "", it.quantidade || "", it.obs || ""));
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
 const ok = confirmarExclusaoDupla("esta oferenda de Orixá");
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

  console.log("ABRINDO MODAL OFERENDA EBO");

  const modal = document.getElementById("modalBackdropOferendasEbo");

  if (!modal) {
    console.error("Modal modalBackdropOferendasEbo NÃO encontrado");
    return;
  }

  modal.style.display = "flex";

  console.log("MODAL ABERTO");

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

function modalCriarLinhaOferendasEbo(listId = "1", ingrediente = "", quantidade = "", obs = "") {
  const tbody = document.getElementById(`modalBodyLinhasOferendasEbo_${listId}`);
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="modalIng" type="text" placeholder="Ex: Pipoca" value="${escaparValorInput(ingrediente)}" /></td>
    <td><input class="modalQtd" type="text" placeholder="Ex: 7" value="${escaparValorInput(quantidade)}" /></td>
    <td><input class="modalObs" type="text" placeholder="Observação opcional" value="${escaparValorInput(obs)}" /></td>
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
    const obs = (tr.querySelector(".modalObs")?.value || "").trim();
    if (ing || qtd || obs) linhas.push({ ingrediente: ing, quantidade: qtd, obs });
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
      data.itens.forEach((it) => modalCriarLinhaOferendasEbo("1", it.ingrediente || "", it.quantidade || "", it.obs || ""));
    } else {
      modalCriarLinhaOferendasEbo("1", "", "");
    }

    if ($("modalSubtituloOferendaEbo_2")) $("modalSubtituloOferendaEbo_2").value = data.subtitulo2 || "";
    if ($("modalModoFazerOferendaEbo_2")) $("modalModoFazerOferendaEbo_2").value = data.modo2 || "";
    modalLimparLinhasOferendasEbo("2");
    if (Array.isArray(data.itens2) && data.itens2.length) {
      data.itens2.forEach((it) => modalCriarLinhaOferendasEbo("2", it.ingrediente || "", it.quantidade || "", it.obs || ""));
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
 const ok = confirmarExclusaoDupla("esta oferenda de Ebó");
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
  oferendas_ebo: { stateKey: "__oferendasEboFotos", inputPrefix: "modalFotosOferendaEbo_", previewPrefix: "previewFotosOferendaEbo_"},
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

function modalCriarLinhaObrigacoes(listId = "1", ingrediente = "", quantidade = "", obs = "") {
  const tbody = document.getElementById(`modalBodyLinhasObrigacoes_${listId}`);
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="modalIng" type="text" placeholder="Ex: Pipoca" value="${escaparValorInput(ingrediente)}" /></td>
    <td><input class="modalQtd" type="text" placeholder="Ex: 7" value="${escaparValorInput(quantidade)}" /></td>
    <td><input class="modalObs" type="text" placeholder="Observação opcional" value="${escaparValorInput(obs)}" /></td>
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
    const obs = (tr.querySelector(".modalObs")?.value || "").trim();
    if (ing || qtd || obs) linhas.push({ ingrediente: ing, quantidade: qtd, obs });
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
      data.itens.forEach((it) => modalCriarLinhaObrigacoes("1", it.ingrediente || "", it.quantidade || "", it.obs || ""));
    } else {
      modalCriarLinhaObrigacoes("1", "", "");
    }

    if ($("modalSubtituloObrigacao_2")) $("modalSubtituloObrigacao_2").value = data.subtitulo2 || "";
    if ($("modalModoFazerObrigacao_2")) $("modalModoFazerObrigacao_2").value = data.modo2 || "";
    modalLimparLinhasObrigacoes("2");
    if (Array.isArray(data.itens2) && data.itens2.length) {
      data.itens2.forEach((it) => modalCriarLinhaObrigacoes("2", it.ingrediente || "", it.quantidade || "", it.obs || ""));
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

  const ok = confirmarExclusaoDupla("esta lista obrigação");

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

function modalCriarLinhaIbaOrixa(listId = "1", ingrediente = "", quantidade = "", obs = "") {
  const tbody = document.getElementById(`modalBodyLinhasIbaOrixa_${listId}`);
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="modalIng" type="text" placeholder="Ex: Pipoca" value="${ingrediente}" /></td>
    <td><input class="modalQtd" type="text" placeholder="Ex: 7" value="${quantidade}" /></td>
    <td><input class="modalObs" type="text" placeholder="Observação opcional" value="${escaparValorInput(obs)}" /></td>
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
    const obs = (tr.querySelector(".modalObs")?.value || "").trim();

    if (ing || qtd || obs) {
      linhas.push({
        ingrediente: ing,
        quantidade: qtd,
        obs
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

  const ok = confirmarExclusaoDupla("esta Lista Ibá Orixá");

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
        modalCriarLinhaIbaOrixa("1", it.ingrediente || "", it.quantidade || "", it.obs || "");
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
        modalCriarLinhaIbaOrixa("2", it.ingrediente || "", it.quantidade || "", it.obs || "");
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
function modalCriarLinhaAleatorio(listId = "1", nome = "", quantidade = "", obs = "") {
  const tbody = document.getElementById(`modalBodyLinhasAleatorio_${listId}`);
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="modalIng" type="text" placeholder="Ex: Item" value="${nome}" /></td>
    <td><input class="modalQtd" type="text" placeholder="Ex: 7" value="${quantidade}" /></td>
    <td><input class="modalObs" type="text" placeholder="Observação opcional" value="${escaparValorInput(obs)}" /></td>
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
    const obs = (tr.querySelector(".modalObs")?.value || "").trim();
    if (ing || qtd || obs) linhas.push({ ingrediente: ing, quantidade: qtd, obs });
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
    (data.itens || []).forEach(it => modalCriarLinhaAleatorio("1", it.ingrediente || "", it.quantidade || "", it.obs || ""));

    window.editingDocIdAleatorio = docId;
  } catch (e) {
    console.error(e);
    alert("Erro ao editar Aleatório.");
  }
};

window.excluirAleatorio = async function(docId) {
  const ok = confirmarExclusaoDupla("este Aleatório");
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

function formatarObsImpressaoComNegrito(texto) {
  return escPrint(texto || "—")
    .replace(
      /(Ebó Exu 11|Ebó Exu 7|Ebó Exu 9|Ebó de 7 completo|Ebó pelos caminhos de Ossá |Ebó Ikú |Ebó de 7 completo)/gi,
      "<strong class='ebo-negrito'>$1</strong>"
    )
    .replace(/\n/g, "<br>");
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
        <td class="print-ebos">${textoLinhaPrint(item.ebos)}</td>
        <td class="print-observacoes">${formatarObsImpressaoComNegrito(item.observacoes)}</td>
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
    @page { size: A4 landscape; margin: 7mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #ffffff; color: #111827; }
    body { font-family: Inter, Arial, Helvetica, sans-serif; font-size: 12pt; }
    .print-header { text-align: center; margin: 0 0 10px 0; padding: 0; }
    .print-logo { display: block; width: 84mm; max-width: 40%; max-height: 60mm; height: auto; object-fit: contain; image-rendering: auto; margin: 0 auto 2px auto; }
    h1 { margin: 0; font-size: 20pt; line-height: 1.1; font-weight: 900; letter-spacing: -0.02em; }
    .print-funcao-data { margin-top: 1.2mm; font-size: 13pt; line-height: 1.2; font-weight: 900; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; page-break-inside: auto; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    th, td { border: 1px solid #111827; text-align: center; vertical-align: middle; }
    th { padding: 2.8mm 2mm; font-size: 12pt; line-height: 1.15; font-weight: 900; color: #111827; background: #e5e7eb; white-space: normal; text-align: center; vertical-align: middle; }
    td { padding: 2.2mm 2mm; font-size: 12pt; line-height: 1.3; white-space: normal; overflow-wrap: anywhere; text-align: center; vertical-align: middle; }
    .print-total { width: 10%; font-weight: 900; text-align: center; vertical-align: middle; }
    .print-ing { width: 30%; font-weight: 900; text-align: center; vertical-align: middle; }
    .print-origens { width: 15%; color: #111827; text-align: center; vertical-align: middle; }
    .print-ebos { width: 20%; color: #111827; text-align: center; vertical-align: middle; white-space: pre-line; }
    .print-observacoes { width: 25%; color: #111827; text-align: center; vertical-align: middle; white-space: pre-line; }
    .conferencia-print { page-break-before: always; break-before: page; margin-top: 0; }
    .conferencia-print .conf-capa { page-break-after: auto; break-after: auto; margin-bottom: 8px; }
    .conferencia-print .conf-mesa-bloco { page-break-before: auto; break-before: auto; page-break-inside: auto; break-inside: auto; }
    .conferencia-print * { box-sizing: border-box; }
    .conf-mesa-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0; font-size: 15px;}
    .conf-mesa-table th, .conf-mesa-table td { border: 1px solid #111827; padding: 9px 7px; vertical-align: middle; font-size: 15px; line-height: 1.3; }
    .conf-mesa-table th { background: #f1f5f9; font-weight: 900; text-transform: uppercase; letter-spacing: .03em;font-size: 16px; }
    .conf-ok { width: 130px; text-align: center; }
    .conf-qtd { width: 150px; text-align: center; font-weight: 900; font-size: 15px;  padding-left: 12px; padding-right: 12px;}
    .conf-ing { text-align: left; font-weight: 800; overflow-wrap: anywhere; word-break: break-word; font-size: 15px;  padding-left: 12px; padding-right: 12px;}
    .conf-ok-lista { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: center; width: 100%; }
    .conf-ok-pessoa { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; min-width: 18px; min-height: 18px; line-height: 1; }
    .check-conferencia { display: inline-block; width: 18px; height: 18px; border: 2.2px solid #111827; border-radius: 3px; background: #ffffff; flex: 0 0 auto; }
    .conf-observacao-box { margin: 10px 12px 12px; padding: 8px 10px 10px; border: 1px solid #cbd5e1; border-radius: 10px; }
    .conf-observacao-titulo { display: inline-block; margin-bottom: 6px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; }
    .conf-observacao-linhas span { display: block; height: 20px; border-bottom: 1px solid #334155; }
    .conf-observacao-linhas span + span { margin-top: 3px; }
    .conf-capa { text-align: center; border: 1.6px solid #94a3b8; border-radius: 14px; padding: 14px; margin: 0 0 14px 0; }
    .conf-capa h1 { font-size: 24px; }
    .conf-resumo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; }
    .conf-resumo-card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 8px; }
    .conf-mesa-bloco { border: 1.3px solid #94a3b8; border-radius: 12px; margin: 0 0 14px 0; overflow: hidden; page-break-inside: auto; break-inside: auto; }
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
          <th class="print-ebos">EBÓS</th>
          <th class="print-observacoes">OBS</th>
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
