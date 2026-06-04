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

// 👑 DEVELOPER PORTAL MODAL TOGGLE
window.toggleCraftMeetModal = function() {
    const craftMeetModal = document.getElementById('craftmeet-modal');
    if (craftMeetModal) {
        craftMeetModal.classList.toggle('hidden');
    }
}

// 👑 SOUND ENGINE WITH GLOBAL VOLUME SCALE
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

// ⚡ ULTRA-OPTIMIZED LAG-FREE MESSAGE LOADER WITH SKELETON LOADER
function loadMessages(roomName) {
    const chatDisplay = document.getElementById('chat-messages');
    if (!chatDisplay) return;
    
    db.ref(`rooms/${roomName}`).off(); 
    chatDisplay.innerHTML = "";
    isInitialLoad = true;

    // Injected Skeleton HTML Loader while fetching data from Firebase
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
            <div class="skeleton-item">
                <div class="skeleton-avatar skeleton-blink"></div>
                <div class="skeleton-content">
                    <div class="skeleton-name skeleton-blink"></div>
                    <div class="skeleton-line skeleton-blink"></div>
                    <div class="skeleton-line short skeleton-blink"></div>
                </div>
            </div>
        </div>
    `;
    chatDisplay.innerHTML = loaderHTML;

    db.ref(`rooms/${roomName}`).limitToLast(50).on('child_added', snapshot => {
        const msgId = snapshot.key; 
        const data = snapshot.val(); 
        if (!data) return;

        // Remove the Skeleton loader instantly as soon as first real node arrives
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
        // Safe check for empty rooms to strip out loader
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
    createAnchor.rel = 'noopener noreferrer';
    createAnchor.click();
}

window.triggerMembershipAlert = function() { alert("⚡ Upgrade to Membership Grid to add custom channels — $2/Mo"); }

function setupScrollToBottomBtn() {
    const chatDisplay = document.getElementById('chat-messages');
    const scrollBtn = document.getElementById('scroll-to-bottom-btn');
    
    if (!chatDisplay || !scrollBtn) return;

    chatDisplay.addEventListener('scroll', () => {
        const totalScrollableHeight = chatDisplay.scrollHeight - chatDisplay.clientHeight;
        if (totalScrollableHeight - chatDisplay.scrollTop > 200) {
            scrollBtn.classList.add('show');
        } else {
            scrollBtn.classList.remove('show');
        }
    });

    scrollBtn.onclick = function() {
        chatDisplay.scrollTo({
            top: chatDisplay.scrollHeight,
            behavior: 'smooth'
        });
    };
}

// 👑 APP SETTINGS ENGINE
window.toggleSettingsModal = function() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    
    modal.classList.toggle('hidden');
    
    if (!modal.classList.contains('hidden') && currentUser) {
        document.getElementById('settings-username').value = currentUser.displayName || "";
        document.getElementById('settings-volume').value = appVolume * 100;
        document.getElementById('volume-value').innerText = Math.round(appVolume * 100) + "%";
        
        document.getElementById('settings-volume').oninput = function() {
            document.getElementById('volume-value').innerText = this.value + "%";
        };

        db.ref(`users/${currentUser.uid}/lastNameChange`).once('value', snapshot => {
            const lastChange = snapshot.val() || 0;
            const cooldownMS = 3 * 24 * 60 * 60 * 1000;
            const timePassed = Date.now() - lastChange;

            const inputField = document.getElementById('settings-username');
            const cooldownText = document.getElementById('name-cooldown-text');

            if (timePassed < cooldownMS) {
                const timeLeft = cooldownMS - timePassed;
                const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                
                inputField.disabled = true;
                cooldownText.innerHTML = `⏳ SYSTEM LOCKED: You can update gamertag again in <strong style="color:#ff0055;">${daysLeft}d ${hoursLeft}h</strong>.`;
            } else {
                inputField.disabled = false;
                cooldownText.innerText = "✅ SYSTEM READY: Gamertag transition authorized.";
                cooldownText.style.color = "#00ffcc";
            }
        });
    }
}

window.saveAppSettings = function() {
    if (!currentUser) return;

    const newVolume = parseInt(document.getElementById('settings-volume').value) / 100;
    const newName = document.getElementById('settings-username').value.trim();
    const inputField = document.getElementById('settings-username');

    appVolume = newVolume;

    if (!inputField.disabled && newName && newName !== currentUser.displayName) {
        currentUser.updateProfile({ displayName: newName }).then(() => {
            const updatesObj = {};
            updatesObj[`users/${currentUser.uid}/name`] = newName;
            updatesObj[`users/${currentUser.uid}/lastNameChange`] = Date.now();
            updatesObj[`online_users/${currentUser.uid}/name`] = newName;

            db.ref().update(updatesObj).then(() => {
                alert("🎯 Terminal protocol updated! Gamertag successfully changed.");
                location.reload();
            });
        }).catch(err => alert("Error updating gamertag: " + err.message));
    } else {
        toggleSettingsModal();
    }
}

// Dynamic Typing Event Listener & Emoji Picker Injection
document.addEventListener('DOMContentLoaded', () => {
    const inputContainer = document.querySelector('.input-container');
    const inputField = document.getElementById('message-input');
    
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

// ==========================================
// 👑 DEVELOPER DISCORD COPIER PROTOCOL
// ==========================================
window.copyDevDiscord = function() {
    const discordName = "Mr_kaveeya_bro";
    navigator.clipboard.writeText(discordName).then(() => {
        const btnText = document.getElementById("dev-discord-name");
        btnText.innerHTML = `COPIED! <i class="fa-solid fa-check" style="color: #00ffcc;"></i>`;
        setTimeout(() => {
            if (btnText) btnText.innerHTML = "Discord Contact";
        }, 2000);
    }).catch(err => console.log("Copy error:", err));
}

// ==========================================
// 🏆 👑 REALTIME XP LEADERBOARD SYSTEM (TOP 5)
// ==========================================
function listenToXPLeaderboard() {
    db.ref('users').orderByChild('xp').limitToLast(5).on('value', snapshot => {
        const leaderboardList = document.getElementById('xp-leaderboard-list');
        if (!leaderboardList) return;

        let gamers = [];
        
        snapshot.forEach(childSnapshot => {
            const userId = childSnapshot.key;
            const userData = childSnapshot.val();
            gamers.push({
                uid: userId,
                name: userData.name || 'Gamer',
                xp: userData.xp || 0,
                avatar: userData.profilePic || `https://api.dicebear.com/7.x/bottts/svg?seed=${userData.name}`
            });
        });

        gamers.reverse(); // Highest XP to Lowest XP
        leaderboardList.innerHTML = "";

        gamers.forEach((gamer, index) => {
            const rank = index + 1;
            let rankBadge = `<span class="rank-number">#${rank}</span>`;
            if (rank === 1) rankBadge = `<span class="rank-badge gold" title="Champion">🥇</span>`;
            if (rank === 2) rankBadge = `<span class="rank-badge silver" title="Challenger">🥈</span>`;
            if (rank === 3) rankBadge = `<span class="rank-badge bronze" title="Elite">🥉</span>`;

            const isMeClass = (currentUser && gamer.uid === currentUser.uid) ? 'leaderboard-item-me' : '';

            const rowHtml = `
                <li class="leaderboard-item ${isMeClass}" onclick="viewUserProfileCard('${gamer.uid}')" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; margin-bottom: 6px; border-radius: 6px; cursor: pointer; background: rgba(255,255,255,0.03); transition: background 0.2s;">
                    <div class="leaderboard-left" style="display: flex; align-items: center; gap: 10px;">
                        ${rankBadge}
                        <img src="${gamer.avatar}" class="leaderboard-avatar" alt="${gamer.name}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(0, 255, 204, 0.3);">
                        <span class="leaderboard-name" style="font-weight: 500; color: #f2f3f5;">${gamer.name}</span>
                    </div>
                    <div class="leaderboard-right">
                        <span class="leaderboard-xp" style="color: #00ffcc; font-weight: bold; font-size: 0.9rem;">${gamer.xp} <small style="color: #949ba4; font-size: 0.7rem;">XP</small></span>
                    </div>
                </li>
            `;
            leaderboardList.insertAdjacentHTML('beforeend', rowHtml);
        });

        if (gamers.length === 0) {
            leaderboardList.innerHTML = '<li class="no-leaderboard-notice" style="color: #949ba4; text-align: center; padding: 10px;">No ranks tracked yet.</li>';
        }
    });
}
