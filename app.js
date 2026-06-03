// ================= FIREBASE =================
const firebaseConfig = {
    apiKey: "AIzaSyAHpQdXnJkW7SVBFpsQV7dRny-NByKne4M",
    authDomain: "craftmeet-bea37.firebaseapp.com",
    databaseURL: "https://craftmeet-bea37-default-rtdb.firebaseio.com/",
    projectId: "craftmeet-bea37",
    storageBucket: "craftmeet-bea37.firebasestorage.app",
    messagingSenderId: "861031856963",
    appId: "1:861031856963:web:b795f7bfa69877ef920df6"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let currentRoom = "global";

// ================= LANGUAGE =================
let currentLang = "en";

const langPack = {
    en: { online: "ONLINE USERS" },
    si: { online: "ඔන්ලයින් පරිශීලකයින්" }
};

function setLang(lang){
    currentLang = lang;
    document.querySelector(".counter-text")?.innerHTML =
        `${langPack[lang].online}: <strong id="online-count">1</strong>`;
}

// ================= EMOJI =================
function toggleEmojiPicker(){
    document.getElementById("emoji-picker").classList.toggle("hidden");
}

document.addEventListener("click",(e)=>{
    if(e.target.parentElement?.id === "emoji-picker"){
        document.getElementById("message-input").value += e.target.innerText;
    }
});

// ================= DELETE MESSAGE =================
function deleteMessage(id){
    if(!currentUser) return;

    if(confirm("Delete message?")){
        db.ref(`rooms/${currentRoom}/${id}`).remove();
    }
}

// ================= SEND MESSAGE =================
function sendMessage(){
    const input = document.getElementById("message-input");
    const text = input.value.trim();
    if(!text || !currentUser) return;

    db.ref(`rooms/${currentRoom}`).push({
        uid: currentUser.uid,
        sender: currentUser.displayName,
        message: text,
        timestamp: Date.now()
    });

    input.value = "";
}

// ================= LOAD MESSAGES =================
function loadMessages(){
    const chat = document.getElementById("chat-messages");

    db.ref(`rooms/${currentRoom}`).on("value", snap=>{
        chat.innerHTML = "";

        snap.forEach(child=>{
            const data = child.val();
            const isOwn = data.uid === currentUser?.uid;

            chat.innerHTML += `
            <div class="msg-container ${isOwn ? "own-msg":""}">
                <div class="msg-info">
                    <span>${data.sender}</span>
                    ${isOwn ? `<button class="delete-btn" onclick="deleteMessage('${child.key}')">🗑️</button>` : ""}
                </div>

                <div class="msg-bubble">${data.message}</div>
            </div>`;
        });
    });
}

// ================= ENTER KEY =================
function checkEnter(e){
    if(e.key === "Enter") sendMessage();
}

// ================= AUTH =================
auth.onAuthStateChanged(user=>{
    if(user){
        currentUser = user;
        document.getElementById("auth-screen").style.display = "none";
        loadMessages();
    }else{
        document.getElementById("auth-screen").style.display = "flex";
    }
});
