// ==========================================
// FIREBASE CONFIGURATION & INITIALIZATION
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAHpQdXnJkW7SVBFpsQV7dRny-NByKne4M",
    authDomain: "craftmeet-bea37.firebaseapp.com",
    databaseURL: "https://craftmeet-bea37-default-rtdb.firebaseio.com",
    projectId: "craftmeet-bea37",
    storageBucket: "craftmeet-bea37.firebasestorage.app",
    messagingSenderId: "861031856963",
    appId: "1:861031856963:web:b795f7bfa69877ef920df6",
    measurementId: "G-JPF9GEPXSJ"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let currentRoom = "global"; 
let isInitialLoad = true; 
let typingTimeout = null;
let isMuted = true;  // 🛡️ Default Mute on Join
let isRegisterMode = false; 
let appVolume = 1.0; // Global App Volume (Range: 0.0 - 1.0)

// 🛡️ ANTI-LAG & SPAM MEMORY VARIABLES
let lastSentMessage = ""; 
let localUserData = null; // Speed Optimization

const decorationsList = ["deco-cyber-neon", "deco-golden-flame", "deco-magic-star", "neon-legendary-border"];

// =================================================================
// --- CRAFTMEET AI SYSTEM (STABLE GEMINI FLASH VIA CODETABS) ---
// =================================================================

function toggleFloatingAI() {
    const aiBody = document.getElementById('ai-floating-body');
    const aiIcon = document.getElementById('ai-toggle-icon');
    
    if (aiBody && aiBody.classList.contains('hidden')) {
        aiBody.classList.remove('hidden');
        if (aiIcon) aiIcon.className = "fa-solid fa-chevron-down"; 
    } else if (aiBody) {
        aiBody.classList.add('hidden');
        if (aiIcon) aiIcon.className = "fa-solid fa-chevron-up"; 
    }
}

async function sendAMessageToAIBox() {
    const aiInput = document.getElementById('ai-box-input');
    const aiMessagesDiv = document.getElementById('ai-box-messages');
    
    if (!aiInput || !aiMessagesDiv) return;
    const userText = aiInput.value.trim();

    if (userText === "") return;

    const username = (currentUser && currentUser.displayName) ? currentUser.displayName : "Gamer";

    appendAiBoxMessage(`😎 ${username}`, userText, "#00ffcc");
    aiInput.value = ""; 

    const typingId = appendAiBoxMessage("🤖 CraftMeet AI", "Matrix connecting to Gemini core...", "#949ba4", true);

    // AI Character Prompts
    const systemInstruction = "You are CraftMeet AI, a friendly pro Sri Lankan gamer and tech assistant integrated into the CraftMeet platform built by Mr_kaveeya_bro. Keep your answer under 2 sentences, use gaming slang like GG, Clutch, and reply directly to this user: ";

    try {
        const chatUrl = "https://duckduckgo.com/duckchat/v1/chat";
        
        // 🔥 FIX: AllOrigins වෙනුවට කෙලින්ම වැඩකරන CodeTabs Proxy එක භාවිතා කර CORS Error එක මගහැරීම
        const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(chatUrl)}`;

        // 🚀 Sending prompt to the AI Matrix via CodeTabs Proxy
        const chatResponse = await fetch(proxyUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
                "x-vqd-4": "1" // DuckDuckGo API එකට අවශ්‍ය Default Token එකක්
            },
            body: JSON.stringify({
                model: "gpt-4o-mini", 
                messages: [{ role: "user", content: systemInstruction + userText }]
            })
        });

        if (!chatResponse.ok) throw new Error("AI core dropped packet");

        const rawText = await chatResponse.text();
        
        // Text stream response එකෙන් data chunks වෙන් කර ගැනීම
        const lines = rawText.split('\n');
        let aiReplyText = "";
        for (let line of lines) {
            if (line.startsWith('data: ')) {
                const dataStr = line.substring(6).trim();
                if (dataStr === '[DONE]') break;
                try {
                    const parsed = JSON.parse(dataStr);
                    // DuckDuckGo API stream එකේ සාමාන්‍යයෙන් එන්නේ 'data' කියන field එකෙන්
                    if (parsed.data) {
                        aiReplyText += parsed.data;
                    } else if (parsed.message) {
                        aiReplyText += parsed.message;
                    }
                } catch(e) {}
            }
        }

        const tempTyping = document.getElementById(typingId);
        if (tempTyping) tempTyping.remove();

        // Response එකක් ආවේ නැත්නම් fallback එකක් දෙනවා
        if (!aiReplyText) {
            aiReplyText = "GG! Matrix sync was successful, but response stream dropped. Shoot the message again, Comrade!";
        }

        appendAiBoxMessage("🤖 CraftMeet AI", aiReplyText.trim(), "#fff");

        // Firebase එකට චැට් එක සේව් කිරීම
        if (currentUser) {
            db.ref(`ai_chats/${currentUser.uid}`).push().set({
                user_prompt: userText,
                ai_response: aiReplyText.trim(),
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        }

    } catch (error) {
        console.error("AI Error:", error);
        const tempTyping = document.getElementById(typingId);
        if (tempTyping) tempTyping.remove();
        appendAiBoxMessage("🤖 CraftMeet AI", "Lag detected in Proxy node, Comrade! Shoot it again. GG!", "#ff0055");
    }
}

function appendAiBoxMessage(sender, text, color, isTyping = false) {
    const aiMessagesDiv = document.getElementById('ai-box-messages');
    if (!aiMessagesDiv) return;

    const msgElement = document.createElement('div');
    const uniqueId = "msg-" + Date.now() + Math.floor(Math.random() * 1000);
    
    msgElement.id = uniqueId;
    msgElement.style.color = color;
    msgElement.style.lineHeight = "1.4";
    msgElement.style.marginBottom = "8px";
    if (isTyping) msgElement.style.fontStyle = "italic";
    
    msgElement.innerHTML = `<strong>${sender}:</strong> ${text}`;
    aiMessagesDiv.appendChild(msgElement);
    
    aiMessagesDiv.scrollTop = aiMessagesDiv.scrollHeight;
    return uniqueId;
}

window.checkAIBoxEnter = function(event) {
    if (event.key === "Enter") {
        sendAMessageToAIBox();
    }
}

window.toggleFloatingAI = toggleFloatingAI;
window.sendAMessageToAIBox = sendAMessageToAIBox;

// ==========================================
// CORE FUNCTIONS
// ==========================================

window.toggleCraftMeetModal = function() {
    const craftMeetModal = document.getElementById('craftmeet-modal');
    if (craftMeetModal) {
        craftMeetModal.classList.toggle('hidden');
    }
}

function playIncomingSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);
        
        const calculatedVolume = 0.1 * appVolume;
        
        gainNode.gain.setValueAtTime(calculatedVolume, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(calculatedVolume > 0 ? 0.01 : 0, audioCtx.currentTime + 0.15);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) { console.log("Sound context notice:", e); }
}

window.toggleAuthMode = function(e) {
    if(e) e.preventDefault();
    isRegisterMode = !isRegisterMode;
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const mainBtn = document.getElementById('main-auth-btn');
    const switchLink = document.getElementById('switch-auth-link');
    const switchText = document.getElementById('switch-text');
    const usernameGroup = document.getElementById('reg-username-group');
    const regExtras = document.getElementById('reg-extras');

    if (isRegisterMode) {
        title.innerText = "CREATE AN ACCOUNT"; 
        subtitle.innerText = "Join the ultimate Sri Lankan gaming hub today!";
        mainBtn.innerText = "Register & Connect"; 
        switchText.innerText = "Already have an account?"; 
        switchLink.innerText = "Log In";
        if(usernameGroup) usernameGroup.style.display = "block"; 
        if(regExtras) regExtras.style.display = "block";
    } else {
        title.innerText = "WELCOME BACK!"; 
        subtitle.innerText = "We're so excited to see you again!";
        mainBtn.innerText = "Log In"; 
        switchText.innerText = "Need an account?"; 
        switchLink.innerText = "Register";
        if(usernameGroup) usernameGroup.style.display = "none"; 
        if(regExtras) regExtras.style.display = "none";
    }
}

window.handlePrimaryAuth = function(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }

    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const username = document.getElementById('auth-username') ? document.getElementById('auth-username').value.trim() : "";
    const avatar = document.getElementById('auth-avatar') ? document.getElementById('auth-avatar').value.trim() : "";
    const bio = document.getElementById('auth-bio') ? document.getElementById('auth-bio').value.trim() : "";

    if (!email || !password) { alert("Please complete required fields."); return; }

    if (isRegisterMode) {
        if (!username) { alert("Please pick a unique Gamertag."); return; }
        auth.createUserWithEmailAndPassword(email, password).then(credential => {
            const user = credential.user;
            const defaultAvatar = avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;
            
            user.updateProfile({ displayName: username, photoURL: defaultAvatar }).then(() => {
                db.ref(`users/${user.uid}`).set({
                    name: username, profilePic: defaultAvatar, bio: bio || "Hey there! I am using CraftMeet.",
                    gameSpecialty: "Multi-Game Athlete", xp: 0, currentDecoration: "none", decorationClaimedAt: 0,
                    lastNameChange: 0
                }).then(() => { location.reload(); });
            });
        }).catch(err => alert("Registration Error: " + err.message));
    } else {
        auth.signInWithEmailAndPassword(email, password).catch(err => alert("Auth Error: " + err.message));
    }
}

window.loginWithGoogle = function() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => alert("Google Auth Error: " + err.message));
}

window.logout = function() {
    if (currentUser) {
        db.ref(`online_users/${currentUser.uid}`).remove();
        db.ref(`typing/${currentRoom}/${currentUser.uid}`).remove();
    }
    auth.signOut().then(() => location.reload());
}

auth.onAuthStateChanged(user => {
    const authScreen = document.getElementById('auth-screen');
    const jitsiFrame = document.getElementById('jitsi-voice-frame');
    const mainAppInterface = document.getElementById('main-app-interface');
    
    if (user) {
        currentUser = user;
        if (authScreen) authScreen.classList.add('hidden');
        if (mainAppInterface) mainAppInterface.classList.remove('hidden');
        
        document.getElementById('user-display-name').innerText = user.displayName || "Gamer";
        
        syncUserProfileData(user);
        setupOnlineCounter();
        loadMessages(currentRoom);
        listenToTyping(currentRoom);
        initVoiceConference(currentRoom);
        loadPrivateRoomsList();
        listenToXPLeaderboard(); 
        setupScrollToBottomBtn();
        
        const muteBtn = document.getElementById('comms-mute-btn');
        const btnIcon = document.getElementById('mute-btn-icon');
        const btnText = document.getElementById('mute-btn-text');
        const pulseNode = document.getElementById('voice-pulse-node');
        const statusDesc = document.getElementById('voice-status-desc');
        if(muteBtn) muteBtn.className = "comms-mute-btn muted";
        if(btnIcon) btnIcon.className = "fa-solid fa-microphone-lines-slash";
        if(btnText) btnText.innerText = "UNMUTE MIC";
        if(pulseNode) pulseNode.className = "voice-pulse-icon muted-pulse";
        if(statusDesc) statusDesc.innerText = "Microphone transmission locked.";
    } else {
        currentUser = null;
        if (authScreen) authScreen.classList.remove('hidden');
        if (mainAppInterface) mainAppInterface.classList.add('hidden');
        if (jitsiFrame) jitsiFrame.src = "";
    }
});

function syncUserProfileData(user) {
    db.ref(`users/${user.uid}`).on('value', snapshot => {
        const data = snapshot.val();
        if (!data) return;

        localUserData = data;

        if (data.currentDecoration && data.currentDecoration !== "none" && data.decorationClaimedAt) {
            if (Date.now() - data.decorationClaimedAt > 7 * 24 * 60 * 60 * 1000) {
                db.ref(`users/${user.uid}`).update({ currentDecoration: "none", decorationClaimedAt: 0 });
                alert("⏰ Your avatar border decoration node has expired!");
                return;
            }
        }

        document.getElementById('user-avatar').src = data.profilePic || user.photoURL;
        document.getElementById('user-specialty').innerHTML = `<span class="dot-neon"></span> ${data.gameSpecialty || 'Multi-Game Athlete'}`;
        
        const footerFrame = document.getElementById('user-footer-deco-frame');
        if (footerFrame) {
            footerFrame.className = "deco-frame-container";
            if (data.currentDecoration && data.currentDecoration !== "none") {
                footerFrame.classList.add(data.currentDecoration);
            }
        }

        const userXp = data.xp || 0;
        const barPercent = Math.min(100, (userXp / 500) * 100);
        
        const xpFillEl = document.getElementById('dashboard-xp-fill') || document.getElementById('view-card-xp-fill');
        const xpTextEl = document.getElementById('dashboard-xp-text') || document.getElementById('view-card-xp-text');
        
        if (xpFillEl) xpFillEl.style.width = `${barPercent}%`;
        if (xpTextEl) xpTextEl.innerText = `${userXp} / 500 XP`;

        const userAvatarEl = document.getElementById('user-avatar');
        if (userAvatarEl) {
            if (userXp >= 500 || (data.currentDecoration && data.currentDecoration === "neon-legendary-border")) {
                userAvatarEl.classList.add('neon-legendary-border');
            } else {
                userAvatarEl.classList.remove('neon-legendary-border');
            }
        }

        const rewardModal = document.getElementById('reward-popup-modal');
        if (rewardModal) {
            if (userXp >= 500 && (!data.currentDecoration || data.currentDecoration === "none")) {
                rewardModal.classList.remove('hidden');
            } else {
                rewardModal.classList.add('hidden');
            }
        }
    });
}

window.toggleProfileModal = function() { document.getElementById('profile-modal').classList.toggle('hidden'); }

window.saveUserProfile = function() {
    if (!currentUser) return;
    db.ref(`users/${currentUser.uid}`).update({
        profilePic: document.getElementById('profile-pic-input').value.trim() || currentUser.photoURL,
        bio: document.getElementById('profile-bio-input').value.trim(),
        gameSpecialty: document.getElementById('profile-game-input').value
    }).then(() => toggleProfileModal());
}

window.claimAvatarDecoration = function() {
    if (!currentUser) return;
    const legendaryDeco = "neon-legendary-border";
    
    db.ref(`users/${currentUser.uid}`).transaction(currentData => {
        if (currentData) {
            currentData.xp = Math.max(0, (currentData.xp || 0) - 500);
            currentData.currentDecoration = legendaryDeco;
            currentData.decorationClaimedAt = Date.now();
        }
        return currentData;
    }).then(() => {
        const rewardModal = document.getElementById('reward-popup-modal');
        if (rewardModal) rewardModal.classList.add('hidden');
        alert("🎉 LEGENDARY DECORATION UNLOCKED! Your avatar is now glowing!");
    }).catch(err => {
        alert("Error claiming decoration: " + err.message);
    });
}

window.toggleUserCardModal = function() { document.getElementById('user-card-modal').classList.toggle('hidden'); }

window.viewUserProfileCard = function(targetUid) {
    db.ref(`users/${targetUid}`).once('value', snapshot => {
        const data = snapshot.val();
        if (!data) return;

        const viewCardAvatar = document.getElementById('view-card-avatar');
        viewCardAvatar.src = data.profilePic || `https://api.dicebear.com/7.x/bottts/svg?seed=${data.name}`;
        
        const targetXp = data.xp || 0;
        if (targetXp >= 500 || (data.currentDecoration && data.currentDecoration === "neon-legendary-border")) {
            viewCardAvatar.classList.add('neon-legendary-border');
        } else {
            viewCardAvatar.classList.remove('neon-legendary-border');
        }

        document.getElementById('view-card-name').innerText = data.name || 'Gamer';
        document.getElementById('view-card-game').innerText = data.gameSpecialty || 'Multi-Game Athlete';
        document.getElementById('view-card-bio').innerText = data.bio || 'No bio available.';
        
        const barPercent = Math.min(100, (targetXp / 500) * 100);
        document.getElementById('view-card-xp-fill').style.width = `${barPercent}%`;
        document.getElementById('view-card-xp-text').innerText = `${targetXp} / 500 XP`;

        const cardFrame = document.getElementById('view-card-deco-frame');
        if (cardFrame) {
            cardFrame.className = "deco-frame-container";
            if (data.currentDecoration && data.currentDecoration !== "none") {
                cardFrame.classList.add(data.currentDecoration);
            }
        }

        const dmBtn = document.getElementById('view-card-dm-btn');
        if (targetUid === currentUser.uid) {
            dmBtn.style.display = "none";
        } else {
            dmBtn.style.display = "block";
            dmBtn.onclick = function() {
                toggleUserCardModal();
                const dmRoomId = currentUser.uid < targetUid ? `dm_${currentUser.uid}_${targetUid}` : `dm_${targetUid}_${currentUser.uid}`;
                db.ref(`users/${currentUser.uid}/active_dms/${dmRoomId}`).set({ roomName: data.name, targetId: targetUid });
                db.ref(`users/${targetUid}/active_dms/${dmRoomId}`).set({ roomName: currentUser.displayName, targetId: currentUser.uid });
                switchRoom(dmRoomId);
            };
        }
        
        const cardModal = document.getElementById('user-card-modal');
        if (cardModal) cardModal.classList.remove('hidden');
    });
}

function loadPrivateRoomsList() {
    db.ref(`users/${currentUser.uid}/active_dms`).on('value', snapshot => {
        const dmList = document.getElementById('private-rooms-list');
        if (!dmList) return;
        dmList.innerHTML = "";
        
        if (!snapshot.exists()) {
            dmList.innerHTML = '<li class="no-dm-notice">No active DMs</li>';
            return;
        }
        
        snapshot.forEach(child => {
            const roomId = child.key; const dmData = child.val();
            const isActive = currentRoom === roomId ? 'active' : '';
            dmList.innerHTML += `<li class="room-item ${isActive}" id="room-${roomId}" onclick="switchRoom('${roomId}')"><i class="fa-solid fa-comments"></i> <span>${dmData.roomName.toLowerCase()}</span></li>`;
        });
    });
}

// 👑 FIXED REALTIME LEADERBOARD FUNCTION
function listenToXPLeaderboard() {
    console.log("XP Leaderboard tracking linked to database matrix.");
    
    db.ref('users').orderByChild('xp').limitToLast(10).on('value', snapshot => {
        const leaderboardList = document.getElementById('xp-leaderboard-list');
        if (!leaderboardList) return;
        
        leaderboardList.innerHTML = ""; 

        if (!snapshot.exists()) {
            leaderboardList.innerHTML = `<li style="color: #949ba4; font-size: 0.85rem; text-align: center; padding: 10px;">No matrix data found</li>`;
            return;
        }

        let gamers = [];
        snapshot.forEach(childSnapshot => {
            const userData = childSnapshot.val();
            gamers.push({
                uid: childSnapshot.key,
                name: userData.name || "Unknown Gamer",
                xp: userData.xp || 0
            });
        });

        gamers.reverse();

        gamers.forEach((gamer, index) => {
            const isMe = currentUser && gamer.uid === currentUser.uid;
            const rowStyle = isMe ? 'background: rgba(0, 255, 204, 0.05); border-left: 2px solid #00ffcc;' : '';
            
            leaderboardList.innerHTML += `
                <li style="color: #fff; font-family: 'Inter', sans-serif; font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; ${rowStyle}" onclick="viewUserProfileCard('${gamer.uid}')">
                    <span style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: ${index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#949ba4'}; font-weight: bold; width: 20px;">#${index + 1}</span>
                        <span style="${isMe ? 'color: #00ffcc; font-weight: 500;' : ''}">${gamer.name}</span>
                    </span>
                    <span style="color: #00ffcc; font-weight: bold; font-family: 'JetBrains Mono', monospace;">${gamer.xp} XP</span>
                </li>
            `;
        });
    });
}

function setupOnlineCounter() {
    db.ref(`.info/connected`).on('value', snap => {
        if (snap.val() === false) return;
        const myOnlineRef = db.ref(`online_users/${currentUser.uid}`);
        myOnlineRef.set({ name: currentUser.displayName, active: true });
        myOnlineRef.onDisconnect().remove();
    });
    db.ref(`online_users`).on('value', snap => {
        document.getElementById('online-count').innerText = snap.numChildren() || 1;
    });
}

window.handleTyping = function() {
    if (!currentUser) return;
    db.ref(`typing/${currentRoom}/${currentUser.uid}`).set({ name: currentUser.displayName, typing: true });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => { db.ref(`typing/${currentRoom}/${currentUser.uid}`).remove(); }, 2000);
}

function listenToTyping(roomName) {
    db.ref(`typing/${roomName}`).on('value', snapshot => {
        const typingBox = document.getElementById('typing-indicator');
        if (!typingBox) return;

        let typers = [];
        snapshot.forEach(child => { if (child.key !== currentUser.uid) typers.push(child.val().name); });
        
        if (typers.length > 0) {
            typingBox.innerHTML = `
                <span>${typers.join(', ')} ${typers.length > 1 ? 'are' : 'is'} typing</span>
                <div class="typing-dots">
                    <span></span><span></span><span></span>
                </div>
            `;
            typingBox.style.opacity = "1";
        } else {
            typingBox.innerHTML = '';
            typingBox.style.opacity = "0";
        }
    });
}

window.checkEnter = function(e) { if (e.key === 'Enter') sendMessage(); }

window.sendMessage = function() {
    const input = document.getElementById('message-input');
    if (!input || !currentUser) return;
    const text = input.value.trim();
    if (text === "") return;

    if (text.toLowerCase() === lastSentMessage.toLowerCase()) {
        alert("⚠️ Duplicate transmission detected! Repeating the same data will not grant XP.");
        input.value = "";
        return;
    }

    if (text.length > 3 && /^([a-zA-Z0-9])\1+$/.test(text)) {
        alert("⚠️ Character spam detected! Quality transmission required for XP.");
        input.value = "";
        return;
    }

    const userData = localUserData || {};
    const myAvatar = userData.profilePic || currentUser.photoURL;
    const mySpecialty = userData.gameSpecialty || "Multi-Game Athlete";

    db.ref(`rooms/${currentRoom}`).push({ 
        uid: currentUser.uid, 
        sender: currentUser.displayName, 
        message: text, 
        timestamp: Date.now(),
        senderAvatar: myAvatar,
        senderSpecialty: mySpecialty
    });

    db.ref(`users/${currentUser.uid}/xp`).transaction(currentXp => { return (currentXp || 0) + (text.length > 25 ? 12 : 6); });
    db.ref(`typing/${currentRoom}/${currentUser.uid}`).remove();
    
    lastSentMessage = text;
    input.value = "";
}

function loadMessages(roomName) {
    const chatDisplay = document.getElementById('chat-messages');
    if (!chatDisplay) return;
    
    db.ref(`rooms/${currentRoom}`).off(); 
    chatDisplay.innerHTML = "";
    isInitialLoad = true;

    let loaderHTML = `
        <div class="msg-skeleton-container" id="chat-loader">
            <div class="skeleton-item">
                <div class="skeleton-avatar skeleton-blink"></div>
                <div class="skeleton-content">
                    <div class="skeleton-name skeleton-blink"></div>
                    <div class="skeleton-line skeleton-blink"></div>
                    <div class="skeleton-line short skeleton-blink"></div>
                </div>
            </div>
            <div class="skeleton-item">
                <div class="skeleton-avatar skeleton-blink"></div>
                <div class="skeleton-content">
                    <div class="skeleton-name skeleton-blink"></div>
                    <div class="skeleton-line skeleton-blink"></div>
                </div>
            </div>
        </div>
    `;
    chatDisplay.innerHTML = loaderHTML;

    db.ref(`rooms/${roomName}`).limitToLast(50).on('child_added', snapshot => {
        const msgId = snapshot.key; 
        const data = snapshot.val(); 
        if (!data) return;

        const loader = document.getElementById("chat-loader");
        if (loader) loader.remove();

        const isOwn = data.uid === currentUser.uid;
        const timeStr = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const senderAvatar = data.senderAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${data.sender}`;
        const deleteBtnHtml = isOwn ? `<button class="delete-msg-btn" onclick="deleteMessage('${roomName}', '${msgId}')" title="Delete Message" style="background:none; border:none; color:#ff0055; cursor:pointer; margin: 0 6px;"><i class="fa-solid fa-trash-can"></i></button>` : '';

        const msgHtml = `
            <div class="message-item ${isOwn ? 'own-msg' : ''}" id="msg-${msgId}">
                <img src="${senderAvatar}" class="msg-avatar" onclick="viewUserProfileCard('${data.uid}')" alt="${data.sender}">
                <div class="msg-content">
                    <div class="msg-header">
                        <span class="msg-username" onclick="viewUserProfileCard('${data.uid}')">${isOwn ? 'You' : data.sender}</span>
                        <span class="msg-timestamp">${timeStr}</span>
                        ${deleteBtnHtml}
                    </div>
                    <div class="msg-text">${data.message}</div>
                </div>
            </div>
        `;
        
        chatDisplay.insertAdjacentHTML('beforeend', msgHtml);

        if (!isInitialLoad && !isOwn) {
            playIncomingSound();
        }

        const isUserAtBottom = chatDisplay.scrollHeight - chatDisplay.clientHeight - chatDisplay.scrollTop < 300;
        if (isInitialLoad || isUserAtBottom) {
            chatDisplay.scrollTop = chatDisplay.scrollHeight;
        }
    });

    db.ref(`rooms/${roomName}`).limitToLast(50).once('value', () => {
        isInitialLoad = false;
        const loader = document.getElementById("chat-loader");
        if (loader) loader.remove();
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    });

    db.ref(`rooms/${roomName}`).on('child_removed', snapshot => {
        const deletedMsgId = snapshot.key;
        const msgElement = document.getElementById(`msg-${deletedMsgId}`);
        if (msgElement) msgElement.remove();
    });
}

window.deleteMessage = function(roomName, msgId) {
    if (confirm("Are you sure you want to delete this transmission from orbit?")) {
        db.ref(`rooms/${roomName}/${msgId}`).remove().then(() => {
            const msgElement = document.getElementById(`msg-${msgId}`);
            if (msgElement) msgElement.remove();
        }).catch(err => alert("Error deleting transmission: " + err.message));
    }
}

window.switchRoom = function(roomName) {
    if (currentUser) db.ref(`typing/${currentRoom}/${currentUser.uid}`).remove();
    db.ref(`rooms/${currentRoom}`).off();
    
    currentRoom = roomName;
    isInitialLoad = true;

    document.querySelectorAll('.room-item').forEach(el => el.classList.remove('active'));
    const targetedLi = document.getElementById(`room-${roomName}`);
    if (targetedLi) targetedLi.classList.add('active');

    const visualTitle = roomName.startsWith('dm_') ? "secure-private-comms" : roomName + "-zone";
    document.getElementById('current-room-title').innerText = visualTitle;
    document.getElementById('active-voice-channel').innerText = `CONNECTED: ${visualTitle.toUpperCase()}`;

    loadMessages(roomName); listenToTyping(roomName); initVoiceConference(roomName);
}

window.toggleVoiceMute = function() {
    isMuted = !isMuted;
    const muteBtn = document.getElementById('comms-mute-btn');
    const btnIcon = document.getElementById('mute-btn-icon');
    const btnText = document.getElementById('mute-btn-text');
    const pulseNode = document.getElementById('voice-pulse-node');
    const statusDesc = document.getElementById('voice-status-desc');

    if (isMuted) {
        if(muteBtn) muteBtn.className = "comms-mute-btn muted";
        if(btnIcon) btnIcon.className = "fa-solid fa-microphone-lines-slash";
        if(btnText) btnText.innerText = "UNMUTE MIC";
        if(pulseNode) pulseNode.className = "voice-pulse-icon muted-pulse";
        if(statusDesc) statusDesc.innerText = "Microphone transmission locked.";
    } else {
        if(muteBtn) muteBtn.className = "comms-mute-btn unmuted";
        if(btnIcon) btnIcon.className = "fa-solid fa-microphone-lines";
        if(btnText) btnText.innerText = "MUTE MIC";
        if(pulseNode) pulseNode.className = "voice-pulse-icon active-pulse";
        if(statusDesc) statusDesc.innerText = "Voice link fully operational. LIVE.";
    }
    initVoiceConference(currentRoom);
}

function initVoiceConference(roomName) {
    if (!currentUser) return;
    const voiceFrame = document.getElementById('jitsi-voice-frame');
    if (voiceFrame) voiceFrame.src = `https://meet.jit.si/${firebaseConfig.projectId}_voice_${roomName}#userInfo.displayName="${currentUser.displayName}"&config.prejoinPageEnabled=false&config.startWithVideoMuted=true&config.startWithAudioMuted=${isMuted}`;
}

window.searchYT = function(channel) {
    if (!channel || channel.trim() === "") {
        console.error("Streamer හෝ Channel නම ලැබී නැත!");
        return;
    }
    const query = encodeURIComponent(channel.trim());
    const ytUrl = `https://www.youtube.com/results?search_query=${query}`;
    
    const createAnchor = document.createElement('a');
    createAnchor.href = ytUrl;
    createAnchor.target = '_blank';
    createAnchor.click(); // Anchor එක ට්‍රිගර් කර නව ටැබ් එකකින් යූටියුබ් එක ඕපන් කිරීම
}
