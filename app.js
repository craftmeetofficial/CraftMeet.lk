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
let appVolume = 1.0; // 👑 Global App Volume Variable (Range: 0.0 - 1.0)

// 🛡️ ANTI-LAG & SPAM MEMORY VARIABLES
let lastSentMessage = ""; 
let localUserData = null; // ⚡ Speed Optimize කරන්න යූසර් ඩේටා Local එකේ තියාගන්නවා

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
        
        // Settings එකෙන් හදපු Volume එක මෙතනට බලපානවා
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
                    lastNameChange: 0 // Initialize name cooldown timestamp
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
        setupScrollToBottomBtn();
    } else {
        currentUser = null;
        if (authScreen) authScreen.classList.remove('hidden');
        if (jitsiFrame) jitsiFrame.src = "";
    }
});

// Profile & XP Engine (🔥 AI UPDATED)
function syncUserProfileData(user) {
    db.ref(`users/${user.uid}`).on('value', snapshot => {
        const data = snapshot.val();
        if (!data) return;

        // ⚡ Fast Send කරන්න ඩේටා ටික Memory එකට ගන්නවා (Anti-Lag)
        localUserData = data;

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
        
        // HTML එකේ ID එක නිවැරදිව Handle කිරීම
        const xpFillEl = document.getElementById('dashboard-xp-fill') || document.getElementById('view-card-xp-fill');
        const xpTextEl = document.getElementById('dashboard-xp-text') || document.getElementById('view-card-xp-text');
        
        if (xpFillEl) xpFillEl.style.width = `${barPercent}%`;
        if (xpTextEl) xpTextEl.innerText = `${userXp} / 500 XP`;

        // 👑 AI FIXED: XP 500ට සමාන හෝ වැඩි නම් Claim නොකරත් Border එක Auto පෙන්වන කොටස
        const userAvatarEl = document.getElementById('user-avatar');
        if (userAvatarEl) {
            if (userXp >= 500 || (data.currentDecoration && data.currentDecoration === "neon-legendary-border")) {
                userAvatarEl.classList.add('neon-legendary-border');
            } else {
                userAvatarEl.classList.remove('neon-legendary-border');
            }
        }

        // Reward Alert Trigger (XP 500 සම්පූර්ණ වුණාම විතරක් පෙන්වන්න)
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

// 👑 UPDATED REWARD CLAIM LOGIC FOR XP 500 PROFILE DECORATION
window.claimAvatarDecoration = function() {
    if (!currentUser) return;
    
    // XP 500 සපුරා ඇති නිසා Profile Decoration එකක් විදිහට 'neon-legendary-border' එක ලබාදීම
    const legendaryDeco = "neon-legendary-border";
    
    db.ref(`users/${currentUser.uid}`).transaction(currentData => {
        if (currentData) {
            // XP 500ක් අඩු කරලා, Decoration එක Claim කළා කියලා Update කරනවා
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

// Profile Cards & DM Channels Logic
window.toggleUserCardModal = function() { document.getElementById('user-card-modal').classList.toggle('hidden'); }

window.viewUserProfileCard = function(targetUid) {
    db.ref(`users/${targetUid}`).once('value', snapshot => {
        const data = snapshot.val();
        if (!data) return;

        const viewCardAvatar = document.getElementById('view-card-avatar');
        viewCardAvatar.src = data.profilePic || `https://api.dicebear.com/7.x/bottts/svg?seed=${data.name}`;
        
        // 👑 AI FIXED: අනිත් අය ඔයාගේ Profile එක බලද්දිත් ඔයාට XP 500+ නම් Border එක ලස්සනට පේන්න හැදුවා
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

// ⚡ HIGH-SPEED & ANTI-SPAM SEND MESSAGE PROTOCOL
window.sendMessage = function() {
    const input = document.getElementById('message-input');
    if (!input || !currentUser) return;
    const text = input.value.trim();
    if (text === "") return;

    // 🛡️ SPAM CONTROL 1: එකම මැසේජ් එක පිට පිට යවනවා නම් බ්ලොක් කිරීම
    if (text.toLowerCase() === lastSentMessage.toLowerCase()) {
        alert("⚠️ Duplicate transmission detected! Repeating the same data will not grant XP.");
        input.value = "";
        return;
    }

    // 🛡️ SPAM CONTROL 2: එකම අකුර දිගටම ගහලා ද කියල Check කිරීම (උදා: "aaaaaaaaaa...")
    if (text.length > 3 && /^([a-zA-Z0-9])\1+$/.test(text)) {
        alert("⚠️ Character spam detected! Quality transmission required for XP.");
        input.value = "";
        return;
    }

    // ⚡ INSTANT WRITE Protocol: Database Read එකක් වෙනුවට Local data පාවිච්චි කර මැසේජ් එක Speed එකෙන් යවයි
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

    // XP ලබාදීම
    db.ref(`users/${currentUser.uid}/xp`).transaction(currentXp => { return (currentXp || 0) + (text.length > 25 ? 12 : 6); });
    db.ref(`typing/${currentRoom}/${currentUser.uid}`).remove();
    
    // වර්තමාන මැසේජ් එක "අන්තිම මැසේජ් එක" විදිහට Save කරගැනීම
    lastSentMessage = text;
    input.value = "";
}

// ⚡ ULTRA-OPTIMIZED LAG-FREE MESSAGE LOADER (FIXED)
function loadMessages(roomName) {
    const chatDisplay = document.getElementById('chat-messages');
    
    // කලින් රූම් එකේ තිබ්බ Listeners ඔක්කොම අයින් කරලා Screen එක clear කරනවා
    db.ref(`rooms/${roomName}`).off(); 
    chatDisplay.innerHTML = "";
    isInitialLoad = true;

    // ⚡ Optimization 1: අන්තිම මැසේජ් 50 විතරක් සීමා කරනවා (limitToLast)
    // ⚡ Optimization 2: 'child_added' මඟින් මුළු HTML එකම Reset කරන්නේ නැතිව අලුත් Node එක විතරක් DOM එකට Append කරයි
    db.ref(`rooms/${roomName}`).limitToLast(50).on('child_added', snapshot => {
        const msgId = snapshot.key; 
        const data = snapshot.val(); 
        if (!data) return;

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

        // මුල්ම පාරට රූම් එක ලෝඩ් වෙද්දී Notification සවුන්ඩ් ප්ලේ වෙන එක නවත්වනවා
        if (!isInitialLoad && !isOwn) {
            playIncomingSound();
        }

        // Auto Scroll to Bottom Logic
        const isUserAtBottom = chatDisplay.scrollHeight - chatDisplay.clientHeight - chatDisplay.scrollTop < 300;
        if (isInitialLoad || isUserAtBottom) {
            chatDisplay.scrollTop = chatDisplay.scrollHeight;
        }
    });

    // මුල්ම මැසේජ් 50 එකපාර ලෝඩ් වෙලා ඉවර වුන ගමන් initial load එක false කරනවා
    db.ref(`rooms/${roomName}`).limitToLast(50).once('value', () => {
        isInitialLoad = false;
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    });

    // ⚡ REALTIME DELETE LISTENER: වෙන කෙනෙක් මැසේජ් එකක් ඩිලීට් කලොත් Screen එකෙන් ක්ෂණිකව අයින් වෙන්න
    db.ref(`rooms/${roomName}`).on('child_removed', snapshot => {
        const deletedMsgId = snapshot.key;
        const msgElement = document.getElementById(`msg-${deletedMsgId}`);
        if (msgElement) msgElement.remove();
    });
}

// 👑 OPTIMIZED DELETE FUNCTION (REALTIME DOM REMOVAL)
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
    
    // පරණ රූම් එකේ child_removed listeners අයින් කරනවා ඩියුප්ලිකේට් නොවෙන්න
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

// 👑 APP SETTINGS ENGINE (VOLUME & NAME CHANGE 3-DAYS COOLDOWN)
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

        // Check 3 Days Cooldown Condition
        db.ref(`users/${currentUser.uid}/lastNameChange`).once('value', snapshot => {
            const lastChange = snapshot.val() || 0;
            const cooldownMS = 3 * 24 * 60 * 60 * 1000; // 3 Days in milliseconds
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

    // Save Volume
    appVolume = newVolume;

    // Save Username changes if not disabled/cooldown active
    if (!inputField.disabled && newName && newName !== currentUser.displayName) {
        currentUser.updateProfile({ displayName: newName }).then(() => {
            const updates = {};
            updates[`users/${currentUser.uid}/name`] = newName;
            updates[`users/${currentUser.uid}/lastNameChange`] = Date.now();
            updates[`online_users/${currentUser.uid}/name`] = newName;

            db.ref().update(updates).then(() => {
                alert("🎯 Terminal protocol updated! Gamertag successfully changed.");
                location.reload();
            });
        }).catch(err => alert("Error updating gamertag: " + err.message));
    } else {
        toggleSettingsModal(); // Just close modal if volume was adjusted or name unchanged
    }
}

// Emoji Injected Generator & Dynamic Typing Event Listener
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
        
        // සාර්ථකව Copy වූ පසු Icon එකත් එක්කම Text එක මාරু කිරීම
        btnText.innerHTML = `COPIED! <i class="fa-solid fa-check" style="color: #00ffcc;"></i>`;
        
        // තත්පර 2කට පසු නැවත පරණ තත්වයට පත් කිරීම
        setTimeout(() => {
            btnText.innerHTML = "Discord Contact";
        }, 2000);
    }).catch(err => console.log("Copy error:", err));
}
