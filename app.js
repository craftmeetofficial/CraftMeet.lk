import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
    signOut, onAuthStateChanged, updateProfile 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getDatabase, ref, set, push, onValue, serverTimestamp, update, get, remove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ====== FIREBASE INITIALIZATION ======
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ====== GLOBAL UTILITIES & STATE ======
let currentUser = null;
let currentRoom = "lobby";
let authMode = "login";
let typingTimeout = null;

// DOM Elements
const authOverlay = document.getElementById("auth-overlay");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authUsername = document.getElementById("auth-username");
const usernameGroup = document.getElementById("username-group");
const authActionBtn = document.getElementById("auth-action-btn");
const toggleAuthMode = document.getElementById("toggle-auth-mode");
const authSwitcherText = document.getElementById("auth-switcher-text");

const messagesContainer = document.getElementById("messages-container");
const chatMessageInput = document.getElementById("chat-message-input");
const chatSendBtn = document.getElementById("chat-send-btn");
const typingIndicator = document.getElementById("typing-indicator");
const roomItems = document.querySelectorAll(".room-item");

const footerProfileTrigger = document.getElementById("footer-profile-trigger");
const footerAvatarWrapper = document.getElementById("footer-avatar-wrapper");
const userAvatarImg = document.getElementById("user-avatar");
const userDisplayName = document.getElementById("user-display-name");
const userDisplayLevel = document.getElementById("user-display-level");
const logoutBtn = document.getElementById("logout-btn");

const profileModal = document.getElementById("profile-modal");
const closeProfileModal = document.getElementById("close-profile-modal");
const modalUsernameInput = document.getElementById("modal-username-input");
const modalDecoSelect = document.getElementById("modal-deco-select");
const saveProfileBtn = document.getElementById("save-profile-btn");
const leaderboardDisplayList = document.getElementById("leaderboard-display-list");

// NEW LOOT BOX DOM ELEMENTS
const lootBoxTrigger = document.getElementById("loot-box-trigger");
const lootTimerText = document.getElementById("loot-timer");
const claimLootBtn = document.getElementById("claim-loot-btn");

// ====== AUTH ENGINE LOGIC ======
toggleAuthMode.addEventListener("click", (e) => {
    e.preventDefault();
    if (authMode === "login") {
        authMode = "register";
        usernameGroup.classList.remove("hidden");
        authActionBtn.innerText = "Create Identity";
        authSwitcherText.innerHTML = 'Already a member? <a href="#" id="toggle-auth-mode">Log In</a>';
    } else {
        authMode = "login";
        usernameGroup.classList.add("hidden");
        authActionBtn.innerText = "Log In";
        authSwitcherText.innerHTML = 'Need an account? <a href="#" id="toggle-auth-mode">Register</a>';
    }
    // Re-bind click event safely
    document.getElementById("toggle-auth-mode").addEventListener("click", () => toggleAuthMode.click());
});

authActionBtn.addEventListener("click", async () => {
    const email = authEmail.value.trim();
    const password = authPassword.value.trim();
    const username = authUsername.value.trim();

    if (!email || !password) return alert("Fill essential clearcodes.");

    if (authMode === "register") {
        if (!username) return alert("Select a username.");
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, {
                displayName: username,
                photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`
            });
            // Init user in Realtime database
            await set(ref(db, `users/${userCredential.user.uid}`), {
                uid: userCredential.user.uid,
                username: username,
                photoURL: userCredential.user.photoURL,
                xp: 0,
                decoration: "none",
                lastLootClaimed: 0
            });
            authOverlay.classList.add("hidden");
        } catch (error) { alert(error.message); }
    } else {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            authOverlay.classList.add("hidden");
        } catch (error) { alert(error.message); }
    }
});

logoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        authOverlay.classList.add("hidden");
        userDisplayName.innerText = user.displayName || "Unknown Rogue";
        userAvatarImg.src = user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=Rogue`;
        
        // Track stats live
        syncUserStatsAndLootSystem(user.uid);
        listenToLeaderboard();
        listenToChatMessages(currentRoom);
        listenToTyping();
    } else {
        currentUser = null;
        authOverlay.classList.remove("hidden");
    }
});

// ====== CORE USER STATS & LOOT SYSTEM (FIREBASE ENGINE) ======
function syncUserStatsAndLootSystem(uid) {
    const userRef = ref(db, `users/${uid}`);
    onValue(userRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            // Level algorithm calculation
            const xp = data.xp || 0;
            const currentLevel = Math.floor(Math.sqrt(xp / 100)) + 1;
            userDisplayLevel.innerText = `LVL ${currentLevel} (${xp} XP)`;
            
            // Frame Setup Engine
            footerAvatarWrapper.className = "deco-frame-container footer-avatar-frame";
            if (data.decoration && data.decoration !== "none") {
                footerAvatarWrapper.classList.add(data.decoration);
            }

            // Realtime Loot Box Countdown Logic
            const lastClaimed = data.lastLootClaimed || 0;
            setupLootBoxTimer(lastClaimed);
        }
    });
}

function setupLootBoxTimer(lastClaimedTimestamp) {
    const cooldownTime = 24 * 60 * 60 * 1000; // 24 Hours in ms
    
    function updateTimer() {
        const now = Date.now();
        const timePassed = now - lastClaimedTimestamp;
        
        if (timePassed >= cooldownTime) {
            lootTimerText.innerText = "Loot Box Ready!";
            lootTimerText.style.color = "#22c55e"; // Green color when active
            lootBoxTrigger.classList.add("ready-to-claim");
            claimLootBtn.disabled = false;
        } else {
            const timeLeft = cooldownTime - timePassed;
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
            
            lootTimerText.innerText = `${hours}h ${minutes}m ${seconds}s`;
            lootTimerText.style.color = "#949ba4";
            lootBoxTrigger.classList.remove("ready-to-claim");
            claimLootBtn.disabled = true;
        }
    }
    
    updateTimer();
    // Clear old intervals if any and set new live ticking
    if (window.lootInterval) clearInterval(window.lootInterval);
    window.lootInterval = setInterval(updateTimer, 1000);
}

// Trigger Reward Action on Loot Claim Click
async function claimDailyLoot() {
    if (!currentUser) return;
    const userRef = ref(db, `users/${currentUser.uid}`);
    
    try {
        const snapshot = await get(userRef);
        const data = snapshot.val();
        const now = Date.now();
        
        if (data && (now - (data.lastLootClaimed || 0) >= 24 * 60 * 60 * 1000)) {
            // Random Loot Generator Engine (10 - 100 XP Points)
            const randomXPBonus = Math.floor(Math.random() * 91) + 10;
            const currentTotalXP = (data.xp || 0) + randomXPBonus;
            
            await update(userRef, {
                xp: currentTotalXP,
                lastLootClaimed: now
            });
            
            alert(`🎁 LOOT DROP UNLOCKED!\nYou received +${randomXPBonus} XP Matrix Points.`);
        }
    } catch (err) { console.error(err); }
}

claimLootBtn.addEventListener("click", claimDailyLoot);
lootBoxTrigger.addEventListener("click", () => { if(!claimLootBtn.disabled) claimDailyLoot(); });

// ====== CHAT CORE LOGIC ======
function listenToChatMessages(room) {
    const chatRef = ref(db, `messages/${room}`);
    onValue(chatRef, (snapshot) => {
        messagesContainer.innerHTML = "";
        const data = snapshot.val();
        if (data) {
            Object.keys(data).forEach((msgId) => {
                const msg = data[msgId];
                const isOwn = msg.senderUid === currentUser?.uid;
                
                // Fetch dynamic decoration at generation time
                let userDecoClass = msg.senderDeco && msg.senderDeco !== "none" ? msg.senderDeco : "";

                const msgHTML = `
                    <div class="msg-container ${isOwn ? 'own-msg' : ''}" id="msg-${msgId}">
                        <div class="msg-info">
                            <span class="msg-sender">${msg.senderName}</span>
                            <span class="msg-time">${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            ${isOwn ? `<button class="msg-delete-btn" data-id="${msgId}" data-room="${room}" style="background:none;border:none;color:#949ba4;cursor:pointer;font-size:0.8rem;margin-left:5px;"><i class="fa-solid fa-trash"></i></button>` : ''}
                        </div>
                        <div style="display:flex; gap:10px; align-items:center; flex-direction: ${isOwn ? 'row-reverse' : 'row'};">
                            <div class="deco-frame-container ${userDecoClass}" style="padding:2px;">
                                <img src="${msg.senderPhoto}" style="width:32px; height:32px; border-radius:50%;">
                            </div>
                            <div class="msg-bubble">${msg.text}</div>
                        </div>
                    </div>
                `;
                messagesContainer.insertAdjacentHTML("beforeend", msgHTML);
            });
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            // Link delete listeners dynamically
            document.querySelectorAll(".msg-delete-btn").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    const id = e.currentTarget.getAttribute("data-id");
                    const r = e.currentTarget.getAttribute("data-room");
                    if(confirm("Terminate message payload permanently?")) {
                        remove(ref(db, `messages/${r}/${id}`));
                    }
                });
            });
        }
    });
}

// Sending messages
async function sendMessage() {
    const text = chatMessageInput.value.trim();
    if (!text || !currentUser) return;

    // Get fresh snapshot info for user framework tracking
    const userSnapshot = await get(ref(db, `users/${currentUser.uid}`));
    const userData = userSnapshot.val() || {};
    
    // Auto incremental matrix rewarding (+2 XP per chat)
    const newXP = (userData.xp || 0) + 2;
    await update(ref(db, `users/${currentUser.uid}`), { xp: newXP });

    const msgData = {
        text: text,
        senderUid: currentUser.uid,
        senderName: currentUser.displayName,
        senderPhoto: currentUser.photoURL,
        senderDeco: userData.decoration || "none",
        timestamp: Date.now()
    };

    await push(ref(db, `messages/${currentRoom}`), msgData);
    chatMessageInput.value = "";
    // Clear typing states
    set(ref(db, `typing/${currentRoom}/${currentUser.uid}`), null);
}

chatSendBtn.addEventListener("click", sendMessage);
chatMessageInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendMessage(); });

// ====== TYPING SYSTEMS ======
chatMessageInput.addEventListener("input", () => {
    if (!currentUser) return;
    set(ref(db, `typing/${currentRoom}/${currentUser.uid}`), currentUser.displayName);
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        set(ref(db, `typing/${currentRoom}/${currentUser.uid}`), null);
    }, 2000);
});

function listenToTyping() {
    onValue(ref(db, `typing/${currentRoom}`), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const typers = Object.values(data).filter(name => name !== currentUser?.displayName);
            if (typers.length > 0) {
                typingIndicator.innerText = `${typers.join(", ")} ${typers.length > 1 ? 'are' : 'is'} hacking text...`;
            } else { typingIndicator.innerText = ""; }
        } else { typingIndicator.innerText = ""; }
    });
}

// ====== ROOM SWITCHER SYSTEM ======
roomItems.forEach(item => {
    item.addEventListener("click", (e) => {
        roomItems.forEach(r => r.classList.remove("active"));
        e.currentTarget.classList.add("active");
        currentRoom = e.currentTarget.getAttribute("data-room");
        listenToChatMessages(currentRoom);
        listenToTyping();
    });
});

// ====== PROFILE SETTINGS MODAL INTERFACES ======
footerProfileTrigger.addEventListener("click", async () => {
    if (!currentUser) return;
    const snap = await get(ref(db, `users/${currentUser.uid}`));
    const data = snap.val();
    if (data) {
        modalUsernameInput.value = data.username || currentUser.displayName;
        modalDecoSelect.value = data.decoration || "none";
    }
    profileModal.classList.remove("hidden");
});

closeProfileModal.addEventListener("click", () => profileModal.classList.add("hidden"));

saveProfileBtn.addEventListener("click", async () => {
    const newName = modalUsernameInput.value.trim();
    const newDeco = modalDecoSelect.value;
    if (!newName) return alert("System requires a designation.");

    try {
        await updateProfile(currentUser, { displayName: newName });
        await update(ref(db, `users/${currentUser.uid}`), {
            username: newName,
            decoration: newDeco
        });
        profileModal.classList.add("hidden");
    } catch (err) { alert(err.message); }
});

// ====== REALTIME NEON LEADERBOARD ======
function listenToLeaderboard() {
    onValue(ref(db, 'users'), (snapshot) => {
        const usersData = snapshot.val();
        if (!usersData) return;

        // Convert, rank sort, and crop to top 5
        const sortedUsers = Object.values(usersData)
            .sort((a, b) => (b.xp || 0) - (a.xp || 0))
            .slice(0, 5);

        leaderboardDisplayList.innerHTML = "";
        sortedUsers.forEach((user, index) => {
            let rankBadge = `<span style="color:#6366f1; width:20px; display:inline-block;">#${index+1}</span>`;
            if (index === 0) rankBadge = "🥇 ";
            if (index === 1) rankBadge = "🥈 ";
            if (index === 2) rankBadge = "🥉 ";

            const itemHTML = `
                <li class="room-item" style="cursor:default; justify-content:space-between; text-transform:none; color:#dbdee1;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        ${rankBadge}
                        <span style="font-weight:700; max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${user.username}</span>
                    </div>
                    <span class="cyber-glow-text" style="font-size:0.8rem; font-family:'Orbitron',sans-serif;">${user.xp || 0} XP</span>
                </li>
            `;
            leaderboardDisplayList.insertAdjacentHTML("beforeend", itemHTML);
        });
    });
}

// ====== AUDIO VOICE EMULATION COMMS ======
const toggleVoiceBtn = document.getElementById("toggle-voice-btn");
const voicePulse = document.getElementById("voice-pulse");
const voiceStatusLbl = document.getElementById("voice-status-lbl");
let inVoice = false;

toggleVoiceBtn.addEventListener("click", () => {
    inVoice = !inVoice;
    if (inVoice) {
        toggleVoiceBtn.innerText = "KILL LINK";
        toggleVoiceBtn.className = "comms-mute-btn muted";
        voicePulse.classList.add("active-pulse");
        voiceStatusLbl.innerText = "COMMS ACTIVE // BROADCASTING";
        voiceStatusLbl.style.color = "var(--neon-cyan)";
    } else {
        toggleVoiceBtn.innerText = "CONNECT COMMS";
        toggleVoiceBtn.className = "comms-mute-btn unmuted";
        voicePulse.classList.remove("active-pulse");
        voiceStatusLbl.innerText = "VOICE DISCONNECTED";
        voiceStatusLbl.style.color = "var(--text-muted)";
    }
});
