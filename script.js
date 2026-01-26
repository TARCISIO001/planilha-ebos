// 🔥 CONFIG FIREBASE v8 (SEU PROJETO)
var firebaseConfig = {
  apiKey: "AIzaSyAAT20n1_CQWe0lP0kum0pmpXkLc4RRQIE",
  authDomain: "sistema-ebos.firebaseapp.com",
  projectId: "sistema-ebos",
};

// 🚀 INICIALIZA
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// 🔐 LOGIN (FUNCIONA)
function login() {
  const username = document.getElementById("username").value.trim();
  const senha = document.getElementById("senha").value;

  if (!username || !senha) {
    alert("Preencha usuário e senha");
    return;
  }

  const email = username + "@app.com";

  auth.signInWithEmailAndPassword(email, senha)
    .then(() => {
      alert("LOGIN FEITO COM SUCESSO 👑");
    })
    .catch(error => {
      console.error(error);
      alert("Erro Firebase: " + error.message);
    });
}



  // transforma username em email fake
  const email = username + "@app.com";

  auth.signInWithEmailAndPassword(email, senha)
    .then((userCredential) => {
      const uid = userCredential.user.uid;

      // busca permissão no firestore
      return db.collection("users").doc(uid).get();
    })
    .then((doc) => {
      if (!doc.exists) {
        alert("Usuário sem permissão no sistema");
        return;
      }

      const role = doc.data().role;

      if (role === "master") {
        alert("Bem-vindo MASTER 👑");
        // window.location.href = "painel-master.html";
      } else {
        alert("Bem-vindo usuário");
        // window.location.href = "painel.html";
      }
    })
    .catch((error) => {
      alert("Erro no login: " + error.message);
    });



// ================= CRIAR USUÁRIO =================
function criarUsuario() {
  const username = document.getElementById("newUsername").value.trim();
  const senha = document.getElementById("newSenha").value;
  const role = document.getElementById("role").value;

  if (!username || !senha) {
    alert("Dados incompletos");
    return;
  }

  const emailFake = `${username}@app.com`;

  // verifica se username já existe
  db.collection("users")
    .where("username", "==", username)
    .get()
    .then(snapshot => {
      if (!snapshot.empty) {
        alert("Usuário já existe");
        throw "exists";
      }

      return auth.createUserWithEmailAndPassword(emailFake, senha);
    })
    .then(res => {
      return db.collection("users").doc(res.user.uid).set({
        username,
        email: emailFake,
        role
      });
    })
    .then(() => alert("Usuário criado com sucesso"))
    .catch(() => {});
}


// ================= CRIAR EBÓ =================
function criarEbo() {
  const linhas = itensEbo.value.split("\n").map(l => {
    const p = l.split(",");
    return { item: p[0], qtd: p[1], obs: p[2] };
  });

  db.collection("ebos").add({
    nome: nomeEbo.value.toLowerCase(),
    itens: linhas
  }).then(() => alert("Ebó salvo"));
}

// ================= BUSCAR EBÓ =================
function buscarEbo() {
  const nome = busca.value.toLowerCase();
  resultado.innerHTML = "";

  db.collection("ebos").where("nome", "==", nome).get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        doc.data().itens.forEach(i => {
          resultado.innerHTML += `
            <tr>
              <td>${i.item}</td>
              <td>${i.qtd}</td>
              <td>${i.obs}</td>
            </tr>
          `;
        });
      });
    });
}
