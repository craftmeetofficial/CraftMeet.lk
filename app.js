// Firebase Live Config Matrix
const firebaseConfig = {
    apiKey: "AIzaSyAHpQdXnJkW7SVBFpsQV7dRny-NByKne4M",
    authDomain: "craftmeet-bea37.firebaseapp.com",
    databaseURL: "https://craftmeet-bea37-default-rtdb.firebaseio.com/",
    projectId: "craftmeet-bea37",
    storageBucket: "craftmeet-bea37.firebasestorage.app",
    messagingSenderId: "861031856963",
    appId: "1:861031856963:web:b795f7bfa69877ef920df6",
    measurementId: "G-JPF9GEPXSJ"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();

// ================= CORE STATE =================
let currentUser = null;
let currentRoom = "global";
let typingTimeout = null;
let isMuted = false;
let isRegisterMode = false;

// ✅ ADDED FIX (COOLDOWN + LISTENER CONTROL)
let lastMessageTime = 0;
let messageRef = null;

// ================= DECORATIONS =================
const decorationsList = [
    "deco-cyber-neon",
    "deco-golden-flame",
    "deco-magic-star"
];

// ================= AUTH =================
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('user-display-name').innerText = user.displayName || "Gamer";

        syncUserProfileData(user);
        setupOnlineCounter();
        loadMessages(currentRoom);
        listenToTyping(currentRoom);
        initVoiceConference(currentRoom);
        loadPrivateRoomsList();

    } else {
        currentUser = null;
        document.getElementById('auth-screen').classList.remove('hidden');
    }
});

// ================= SEND MESSAGE (FIXED + COINS + XP + ANTI SPAM) =================
function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text || !currentUser) return;

    const now = Date.now();

    // 🔥 Anti Spam (5 sec)
    if (now - lastMessageTime < 5000) {
        alert("⏳ Wait few seconds before sending next message!");
        return;
    }
    lastMessageTime = now;

    // XP SYSTEM
    const gainedXp = Math.min(10, Math.max(3, Math.floor(text.length / 5)));

    // 💰 COINS SYSTEM (1–3 random + bonus)
    const baseCoins = Math.floor(Math.random() * 3) + 1;
    const bonusCoins = gainedXp >= 10 ? 2 : 0;
    const coinsEarned = baseCoins + bonusCoins;

    db.ref(`rooms/${currentRoom}`).push({
        uid: currentUser.uid,
        sender: currentUser.displayName,
        message: text,
        timestamp: Date.now(),
        coins: coinsEarned
    });

    db.ref(`users/${currentUser.uid}/xp`).transaction(v => (v || 0) + gainedXp);
    db.ref(`users/${currentUser.uid}/coins`).transaction(v => (v || 0) + coinsEarned);

    db.ref(`typing/${currentRoom}/${currentUser.uid}`).remove();
    input.value = "";
}

// ================= LOAD MESSAGES (CLEAN + FAST + NO DUPLICATE LISTENERS) =================
function loadMessages(roomName) {
    const chatDisplay = document.getElementById('chat-messages');

    if (messageRef) messageRef.off();

    messageRef = db.ref(`rooms/${roomName}`).limitToLast(50);

    messageRef.on('value', snapshot => {
        chatDisplay.innerHTML = "";

        snapshot.forEach(child => {
            const data = child.val();
            const isOwn = currentUser && data.uid === currentUser.uid;

            const timeStr = new Date(data.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });

            chatDisplay.innerHTML += `
                <div class="msg-container ${isOwn ? 'own-msg' : ''}">
                    <div class="msg-info">
                        <span class="msg-sender" onclick="viewUserProfileCard('${data.uid}')">
                            ${isOwn ? 'You' : data.sender}
                        </span>
                        <span class="msg-time">${timeStr}</span>
                    </div>

                    <div class="msg-bubble">
                        ${data.message}
                        ${data.coins ? `<div class="msg-coins">💰 +${data.coins}</div>` : ""}
                    </div>
                </div>
            `;
        });

        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    });
}

// ================= ENTER KEY =================
function checkEnter(e) {
    if (e.key === 'Enter') sendMessage();
}
