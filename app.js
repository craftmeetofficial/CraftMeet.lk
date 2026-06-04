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
let isMuted = false; 
let isRegisterMode = false; 

const decorationsList = ["deco-cyber-neon", "deco-golden-flame", "deco-magic-star"];

// Incoming sound logic
function playIncomingSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) { console.log("Sound context notice:", e); }
}

// Auth Controls
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

window.handlePrimaryAuth = function() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const username = document.getElementById('auth-username').value.trim();
    const avatar = document.getElementById('auth-avatar').value.trim();
    const bio = document.getElementById('auth-bio').value.trim();

    if (!email || !password) { alert("Please complete required fields."); return; }

    if (isRegisterMode) {
        if (!username) { alert("Please pick a unique Gamertag."); return; }
        auth.createUserWithEmailAndPassword(email, password).then(credential => {
            const user = credential.user;
            const defaultAvatar = avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;
            
            user.updateProfile({ displayName: username, photoURL: defaultAvatar }).then(() => {
                db.ref(`users/${user.uid}`).set({
                    name: username, profilePic: defaultAvatar, bio: bio || "Hey there! I am using CraftMeet.",
                    gameSpecialty: "Multi-Game Athlete", xp: 0, currentDecoration: "none", decorationClaimedAt: 0
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
    
    if (user) {
        currentUser = user;
        if (authScreen) authScreen.classList.add('hidden');
        document.getElementById('user-display-name').innerText = user.displayName || "Gamer";
        
        syncUserProfileData(user);
        setupOnlineCounter();
        loadMessages(currentRoom);
        listenToTyping(currentRoom);
        initVoiceConference(currentRoom);
        loadPrivateRoomsList();
        setupScrollToBottomBtn(); // ස්ක්‍රෝල් බටන් එක ඉනිට් කරනවා
    } else {
        currentUser = null;
        if (authScreen) authScreen.classList.remove('hidden');
        if (jitsiFrame) jitsiFrame.src = "";
    }
});

// Profile & XP Engine
function syncUserProfileData(user) {
    db.ref(`users/${user.uid}`).on('value', snapshot => {
        const data = snapshot.val();
        if (!data) return;

        // Border Expiration Check (7 Days)
        if (data.currentDecoration && data.currentDecoration !== "none" && data.decorationClaimedAt) {
            if (Date.now() - data.decorationClaimedAt > 7 * 24 * 60 * 60 * 1000) {
                db.ref(`users/${user.uid}`).update({ currentDecoration: "none", decorationClaimedAt: 0 });
                alert("⏰ Your avatar border decoration node has expired!");
                return;
            }
        }

        document.getElementById('user-avatar').src = data.profilePic || user.photoURL;
        document.getElementById('user-specialty').innerHTML = `<span class="dot-neon"></span> ${data.gameSpecialty || 'Multi-Game Athlete'}`;
        
        // Footer Frame
        const footerFrame = document.getElementById('user-footer-deco-frame');
        if (footerFrame) {
            footerFrame.className = "deco-frame-container";
            if (data.currentDecoration && data.currentDecoration !== "none") {
                footerFrame.classList.add(data.currentDecoration);
            }
        }

        // Sidebar XP Progress
        const userXp = data.xp || 0;
        const barPercent = Math.min(100, (userXp / 500) * 100);
        document.getElementById('dashboard-xp-fill').style.width = `${barPercent}%`;
        document.getElementById('dashboard-xp-text').innerText = `${userXp} / 500 XP`;

        // Reward Alert Trigger
        const rewardModal = document.getElementById('reward-popup-modal');
        if (rewardModal) {
            if (data.xp >= 500 && (!data.currentDecoration || data.currentDecoration === "none")) {
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
    const randomDeco = decorationsList[Math.floor(Math.random() * decorationsList.length)];
    db.ref(`users/${currentUser.uid}`).transaction(currentData => {
        if (currentData) {
            currentData.xp = Math.max(0, (currentData.xp || 0) - 500);
            currentData.currentDecoration = randomDeco;
            currentData.decorationClaimedAt = Date.now();
        }
        return currentData;
    }).then(() => {
        document.getElementById('reward-popup-modal').classList.add('hidden');
    });
}

// Profile Cards & DM Channels Logic
window.toggleUserCardModal = function() { document.getElementById('user-card-modal').classList.toggle('hidden'); }

window.viewUserProfileCard = function(targetUid) {
    db.ref(`users/${targetUid}`).once('value', snapshot => {
        const data = snapshot.val();
        if (!data) return;

        document.getElementById('view-card-avatar').src = data.profilePic || `https://api.dicebear.com/7.x/bottts/svg?seed=${data.name}`;
        document.getElementById('view-card-name').innerText = data.name || 'Gamer';
        document.getElementById('view-card-game').innerText = data.gameSpecialty || 'Multi-Game Athlete';
        document.getElementById('view-card-bio').innerText = data.bio || 'No bio available.';
        
        const userXp = data.xp || 0;
        const barPercent = Math.min(100, (userXp / 500) * 100);
        document.getElementById('view-card-xp-fill').style.width = `${barPercent}%`;
        document.getElementById('view-card-xp-text').innerText = `${userXp} / 500 XP`;

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

// Chat Engine Core
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

// 👑 UPDATED: LISTEN TO TYPING WITH CYBER DOTS ANIMATION
function listenToTyping(roomName) {
    db.ref(`typing/${roomName}`).on('value', snapshot => {
        const typingBox = document.getElementById('typing-indicator');
        if (!typingBox) return;

        let typers = [];
        snapshot.forEach(child => { if (child.key !== currentUser.uid) typers.push(child.val().name); });
        
        if (typers.length > 0) {
            // මෙතනදී කලින් තිබ්බ text එක වෙනුවට ලස්සන Neon dots ඇනිමේෂන් එක HTML එකටම ඉන්ජෙක්ට් කරනවා
            typingBox.innerHTML = `
                <span>${typers.join(', ')} ${typers.length > 1 ? 'are' : 'is'} typing</span>
                <div class="typing-dots">
                    <span></span><span></span><span></span>
                </div>
            `;
            typingBox.style.opacity = "1"; // පේන්න සලස්වනවා
        } else {
            typingBox.innerHTML = '';
            typingBox.style.opacity = "0"; // හංගනවා
        }
    });
}

window.checkEnter = function(e) { if (e.key === 'Enter') sendMessage(); }

window.sendMessage = function() {
    const input = document.getElementById('message-input');
    if (!input || !currentUser) return;
    const text = input.value.trim();
    if (text === "") return;

    db.ref(`users/${currentUser.uid}`).once('value', snap => {
        const userData = snap.val() || {};
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
        input.value = "";
    });
}

// 👑 UPDATED: LOAD MESSAGES WITH TWO-SIDE ALIGNMENT & NEON USERNAME
function loadMessages(roomName) {
    const chatDisplay = document.getElementById('chat-messages');
    db.ref(`rooms/${roomName}`).off(); 
    isInitialLoad = true;

    db.ref(`rooms/${roomName}`).on('value', snapshot => {
        chatDisplay.innerHTML = "";
        let total = snapshot.numChildren(), count = 0;
        if (total === 0) isInitialLoad = false;

        snapshot.forEach(child => {
            const msgId = child.key; 
            const data = child.val(); 
            const isOwn = data.uid === currentUser.uid;
            const timeStr = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            count++;

            const senderAvatar = data.senderAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${data.sender}`;

            // Delete Button if user owns the message
            const deleteBtnHtml = isOwn ? `<button class="delete-msg-btn" onclick="deleteMessage('${roomName}', '${msgId}')" title="Delete Message" style="background:none; border:none; color:#ff0055; cursor:pointer; margin: 0 6px;"><i class="fa-solid fa-trash-can"></i></button>` : '';

            // ⚡ 'isOwn' සත්‍ය නම් 'own-msg' Class එක එකතු කරනවා (දකුණු පැත්තට කරන්න)
            chatDisplay.innerHTML += `
                <div class="message-item ${isOwn ? 'own-msg' : ''}">
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
            if (!isInitialLoad && count === total && !isOwn) playIncomingSound();
        });

        // ස්ක්‍රෝල් ලොජික්: යූසර් දැනටමත් යටම නම් ඉන්නේ, අලුත් මැසේජ් එකක් එද්දී ඔටෝ යටටම ස්ක්‍රෝල් කරනවා
        const isUserAtBottom = chatDisplay.scrollHeight - chatDisplay.clientHeight - chatDisplay.scrollTop < 200;
        if (isInitialLoad || isUserAtBottom) {
            chatDisplay.scrollTop = chatDisplay.scrollHeight;
        }
        isInitialLoad = false;
    });
}

// Injected Delete Transmission Logic
window.deleteMessage = function(roomName, msgId) {
    if (confirm("Are you sure you want to delete this transmission from orbit?")) {
        db.ref(`rooms/${roomName}/${msgId}`).remove()
            .catch(err => alert("Error deleting transmission: " + err.message));
    }
}

window.switchRoom = function(roomName) {
    if (currentUser) db.ref(`typing/${currentRoom}/${currentUser.uid}`).remove();
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

// Voice Comms & YouTube Controls
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

window.searchYT = function(channel) { window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(channel)}`, '_blank'); }
window.triggerMembershipAlert = function() { alert("⚡ Upgrade to Membership Grid to add custom channels — $2/Mo"); }

// 👑 NEW: SCROLL TO BOTTOM BUTTON INTERACTION FUNCTION
function setupScrollToBottomBtn() {
    const chatDisplay = document.getElementById('chat-messages');
    const scrollBtn = document.getElementById('scroll-to-bottom-btn');
    
    if (!chatDisplay || !scrollBtn) return;

    // ස්ක්‍රෝල් කරනකොට බටන් එක පෙන්වන්න/හංගන්න
    chatDisplay.addEventListener('scroll', () => {
        const totalScrollableHeight = chatDisplay.scrollHeight - chatDisplay.clientHeight;
        if (totalScrollableHeight - chatDisplay.scrollTop > 200) {
            scrollBtn.classList.add('show');
        } else {
            scrollBtn.classList.remove('show');
        }
    });

    // ක්ලික් කරපු ගමන් Smooth විදිහට යටටම යවන්න
    scrollBtn.onclick = function() {
        chatDisplay.scrollTo({
            top: chatDisplay.scrollHeight,
            behavior: 'smooth'
        });
    };
}

// Emoji Injected Generator & Dynamic Typing Event Listener
document.addEventListener('DOMContentLoaded', () => {
    const inputContainer = document.querySelector('.input-container');
    const inputField = document.getElementById('message-input');
    
    // Typing Event Listener එක .input-container එක ඇතුලේ තියෙන input එකට ලින්ක් කරනවා
    if (inputField) {
        inputField.addEventListener('input', handleTyping);
    }

    if (typeof EmojiButton !== 'undefined' && inputContainer && inputField) {
        const btn = document.createElement('button');
        btn.type = "button";
        btn.style = "background:none; border:none; color:#949ba4; cursor:pointer; font-size:1.1rem; padding:0 8px;";
        btn.innerHTML = `<i class="fa-regular fa-face-smile"></i>`;
        inputContainer.insertBefore(btn, inputContainer.lastElementChild);

        const picker = new EmojiButton({ theme: 'dark', autoHide: true, position: 'top-start' });
        picker.on('emoji', sel => { inputField.value += sel.emoji; inputField.focus(); });
        btn.addEventListener('click', () => picker.togglePicker(btn));
    }
});
