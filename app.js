// ==========================================
// 1. FIREBASE CONFIGURATION & INITIALIZATION
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

// Initialize Firebase using Compatibility v10 SDK
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// Core App States
let currentUser = null;
let currentRoom = "global"; 
let isInitialLoad = true; 
let typingTimeout = null;
let isMuted = false; 
let isRegisterMode = false; 

// Reward Borders List
const decorationsList = ["deco-cyber-neon", "deco-golden-flame", "deco-magic-star"];

// ==========================================
// 2. AUDIO & SOUND FX
// ==========================================
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

// ==========================================
// 3. AUTHENTICATION CONTROLS
// ==========================================
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

    if (!email || !password) { alert("Please complete required login fields."); return; }

    if (isRegisterMode) {
        if (!username) { alert("Please pick a unique Gamertag."); return; }
        auth.createUserWithEmailAndPassword(email, password).then(credential => {
            const user = credential.user;
            const defaultAvatar = avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;
            
            user.updateProfile({ displayName: username, photoURL: defaultAvatar }).then(() => {
                db.ref(`users/${user.uid}`).set({
                    name: username,
                    profilePic: defaultAvatar,
                    bio: bio || "Hey there! I am using CraftMeet.",
                    gameSpecialty: "Multi-Game Athlete",
                    xp: 0,
                    currentDecoration: "none",
                    decorationClaimedAt: 0
                }).then(() => { location.reload(); });
            });
        }).catch(err => alert("Registration Interrupted: " + err.message));
    } else {
        auth.signInWithEmailAndPassword(email, password).catch(err => alert("Authentication Interrupted: " + err.message));
    }
}

window.loginWithGoogle = function() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then(result => {
        console.log("Google Link Complete:", result.user.displayName);
    }).catch(err => alert("Google Auth Error: " + err.message));
}

window.logout = function() {
    if (currentUser) {
        db.ref(`online_users/${currentUser.uid}`).remove();
        db.ref(`typing/${currentRoom}/${currentUser.uid}`).remove();
    }
    auth.signOut().then(() => location.reload());
}

// Global Auth State Tracking
auth.onAuthStateChanged(user => {
    const authScreen = document.getElementById('auth-screen');
    const jitsiFrame = document.getElementById('jitsi-voice-frame');
    
    if (user) {
        currentUser = user;
        if (authScreen) authScreen.classList.add('hidden');
        
        const displayField = document.getElementById('user-display-name');
        if(displayField) displayField.innerText = user.displayName || "Gamer";
        
        syncUserProfileData(user);
        setupOnlineCounter();
        loadMessages(currentRoom);
        listenToTyping(currentRoom);
        initVoiceConference(currentRoom);
        loadPrivateRoomsList();
    } else {
        currentUser = null;
        if (authScreen) authScreen.classList.remove('hidden');
        if (jitsiFrame) jitsiFrame.src = "";
    }
});

// ==========================================
// 4. SYNC USER PROFILE, XP & REWARDS
// ==========================================
function syncUserProfileData(user) {
    db.ref(`users/${user.uid}`).on('value', snapshot => {
        const data = snapshot.val();
        const avatarImg = document.getElementById('user-avatar');
        const specialtyText = document.getElementById('user-specialty');
        
        if (data) {
            // Check 7 Days Border Expiration Rule
            if (data.currentDecoration && data.currentDecoration !== "none" && data.decorationClaimedAt) {
                const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
                if (Date.now() - data.decorationClaimedAt > oneWeekInMs) {
                    db.ref(`users/${user.uid}`).update({ currentDecoration: "none", decorationClaimedAt: 0 });
                    alert("⏰ DECORATION EXPIRED\n\nYour 7-day avatar border node has expired. Earn more XP to get another!");
                    return;
                }
            }

            if (avatarImg) avatarImg.src = data.profilePic || user.photoURL;
            if (specialtyText) specialtyText.innerHTML = `<span class="dot-neon"></span> ${data.gameSpecialty || 'Multi-Game Athlete'}`;
            
            // Footer Frame Glow Controller
            const footerFrame = document.getElementById('user-footer-deco-frame');
            if (footerFrame) {
                footerFrame.className = "deco-frame-container footer-avatar-frame";
                if (data.currentDecoration && data.currentDecoration !== "none") {
                    footerFrame.classList.add(data.currentDecoration);
                }
            }

            // Sync User's Sidebar XP Progress Bar Bar Percentage
            const userXp = data.xp || 0;
            const barPercent = Math.min(100, (userXp / 500) * 100);
            const dashXpFill = document.getElementById('dashboard-xp-fill');
            const dashXpText = document.getElementById('dashboard-xp-text');
            if(dashXpFill) dashXpFill.style.width = `${barPercent}%`;
            if(dashXpText) dashXpText.innerText = `${userXp} / 500 XP`;

            // Prep Profile Dialog Inputs
            const pPicIn = document.getElementById('profile-pic-input');
            const pBioIn = document.getElementById('profile-bio-input');
            const pGamIn = document.getElementById('profile-game-input');
            if(pPicIn) pPicIn.value = data.profilePic || '';
            if(pBioIn) pBioIn.value = data.bio || '';
            if(pGamIn) pGamIn.value = data.gameSpecialty || 'Multi-Game Athlete';

            // Show Loot Pop-up if Target 500 XP Achieved
            const rewardModal = document.getElementById('reward-popup-modal');
            if (rewardModal) {
                if (data.xp >= 500 && (!data.currentDecoration || data.currentDecoration === "none")) {
                    rewardModal.classList.remove('hidden');
                } else {
                    rewardModal.classList.add('hidden');
                }
            }
        } else {
            const dName = user.displayName || "Gamer";
            const dPic = user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${dName}`;
            db.ref(`users/${user.uid}`).set({
                name: dName, profilePic: dPic, bio: "Hey there! I am using CraftMeet.",
                gameSpecialty: "Multi-Game Athlete", xp: 0, currentDecoration: "none", decorationClaimedAt: 0
            });
        }
    });
}

window.toggleProfileModal = function() {
    document.getElementById('profile-modal').classList.toggle('hidden');
}

window.saveUserProfile = function() {
    if (!currentUser) return;
    db.ref(`users/${currentUser.uid}`).update({
        profilePic: document.getElementById('profile-pic-input').value.trim() || currentUser.photoURL,
        bio: document.getElementById('profile-bio-input').value.trim(),
        gameSpecialty: document.getElementById('profile-game-input').value
    }).then(() => toggleProfileModal()).catch(err => alert("Operation error: " + err.message));
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
        alert(`🎉 REWARD CLAIMED!\n\nYou've unlocked the [${randomDeco.toUpperCase()}] Profile Border Frame!`);
    });
}

// ==========================================
// 5. USER CARD VIEW & INTRICATE DM LOGIC
// ==========================================
window.toggleUserCardModal = function() {
    document.getElementById('user-card-modal').classList.toggle('hidden');
}

window.viewUserProfileCard = function(targetUid) {
    if (!currentUser) return;
    db.ref(`users/${targetUid}`).once('value', snapshot => {
        const data = snapshot.val();
        if (!data) return;

        document.getElementById('view-card-avatar').src = data.profilePic || 'https://via.placeholder.com/80';
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
            dmBtn.onclick = function() { initiatePrivateDM(targetUid, data.name); };
        }
        toggleUserCardModal();
    });
}

function initiatePrivateDM(targetUid, targetName) {
    toggleUserCardModal();
    const dmRoomId = currentUser.uid < targetUid ? `dm_${currentUser.uid}_${targetUid}` : `dm_${targetUid}_${currentUser.uid}`;
    
    db.ref(`users/${currentUser.uid}/active_dms/${dmRoomId}`).set({ roomName: targetName, targetId: targetUid });
    db.ref(`users/${targetUid}/active_dms/${dmRoomId}`).set({ roomName: currentUser.displayName, targetId: currentUser.uid });
    
    switchRoom(dmRoomId);
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
            
            const li = document.createElement('li');
            li.className = `room-item ${isActive}`;
            li.id = `room-${roomId}`;
            li.innerHTML = `<i class="fa-solid fa-comments cyber-magenta-text"></i> <span>${dmData.roomName.toLowerCase()}</span>`;
            li.onclick = function() { switchRoom(roomId); };
            dmList.appendChild(li);
        });
    });
}

// ==========================================
// 6. CORE CHAT STREAMS & ENGINE
// ==========================================
function setupOnlineCounter() {
    db.ref(`.info/connected`).on('value', snap => {
        if (snap.val() === false) return;
        const myOnlineRef = db.ref(`online_users/${currentUser.uid}`);
        myOnlineRef.set({ name: currentUser.displayName, active: true });
        myOnlineRef.onDisconnect().remove();
    });

    db.ref(`online_users`).on('value', snap => {
        const onlineCount = document.getElementById('online-count');
        if (onlineCount) onlineCount.innerText = snap.numChildren() || 1;
    });
}

window.handleTyping = function() {
    if (!currentUser) return;
    db.ref(`typing/${currentRoom}/${currentUser.uid}`).set({ name: currentUser.displayName, typing: true });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        db.ref(`typing/${currentRoom}/${currentUser.uid}`).remove();
    }, 2000);
}

function listenToTyping(roomName) {
    db.ref(`typing/${roomName}`).on('value', snapshot => {
        const typingBox = document.getElementById('typing-indicator');
        const typingUserSpan = document.getElementById('typing-user');
        if (!typingBox || !typingUserSpan) return;
        
        let typers = [];
        snapshot.forEach(child => {
            if (child.key !== currentUser.uid) typers.push(child.val().name);
        });
        
        if (typers.length > 0) {
            typingUserSpan.innerText = typers.join(', ');
            typingBox.classList.remove('hidden');
        } else {
            typingBox.classList.add('hidden');
        }
    });
}

window.checkEnter = function(e) {
    if (e.key === 'Enter') sendMessage();
}

window.sendMessage = function() {
    const input = document.getElementById('message-input');
    if (!input || !currentUser) return;
    const text = input.value.trim();
    if (text === "") return;

    const gainedXp = text.length > 25 ? 12 : 6;
    
    db.ref(`rooms/${currentRoom}`).push({
        uid: currentUser.uid, sender: currentUser.displayName,
        message: text, timestamp: Date.now()
    });

    db.ref(`users/${currentUser.uid}/xp`).transaction(currentXp => {
        return (currentXp || 0) + gainedXp;
    });

    db.ref(`typing/${currentRoom}/${currentUser.uid}`).remove();
    input.value = "";
}

function loadMessages(roomName) {
    const chatDisplay = document.getElementById('chat-messages');
    if (!chatDisplay) return;
    
    db.ref(`rooms/${roomName}`).off(); 
    isInitialLoad = true;

    db.ref(`rooms/${roomName}`).on('value', snapshot => {
        chatDisplay.innerHTML = "";
        let totalChildren = snapshot.numChildren(), counter = 0;
        
        if (totalChildren === 0) isInitialLoad = false;

        snapshot.forEach(child => {
            const data = child.val(); const isOwn = data.uid === currentUser.uid;
            const timeStr = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            counter++;

            chatDisplay.innerHTML += `
                <div class="msg-container ${isOwn ? 'own-msg' : ''}">
                    <div class="msg-info">
                        <span class="msg-sender" onclick="viewUserProfileCard('${data.uid}')" style="cursor: pointer; font-weight:bold;">${isOwn ? 'You' : data.sender}</span>
                        <span class="msg-time" style="font-size:0.75rem; margin-left:8px; opacity:0.6;">${timeStr}</span>
                    </div>
                    <div class="msg-bubble" style="display:inline-block; padding:8px 12px; border-radius:6px; margin-top:4px;">${data.message}</div>
                </div>
            `;
            
            if (!isInitialLoad && counter === totalChildren && !isOwn) {
                playIncomingSound();
            }
        });
        isInitialLoad = false;
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    });
}

window.switchRoom = function(roomName) {
    if (currentUser) db.ref(`typing/${currentRoom}/${currentUser.uid}`).remove();
    
    currentRoom = roomName;
    isInitialLoad = true;

    document.querySelectorAll('.room-item').forEach(el => el.classList.remove('active'));
    const targetedLi = document.getElementById(`room-${roomName}`);
    if (targetedLi) targetedLi.classList.add('active');

    const isDM = roomName.startsWith('dm_');
    const visualTitle = isDM ? "🔥 secure-private-comms" : roomName + "-zone";

    document.getElementById('current-room-title').innerText = visualTitle;
    document.getElementById('active-voice-channel').innerText = `CONNECTED: ${visualTitle.toUpperCase()}`;

    loadMessages(roomName);
    listenToTyping(roomName);
    initVoiceConference(roomName);
}

// ==========================================
// 7. VOICE & YT SEARCH EXTERNAL MODULES
// ==========================================
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
        if(statusDesc) statusDesc.innerText = "Transmission terminated. Tactical Microphone locked.";
    } else {
        if(muteBtn) muteBtn.className = "comms-mute-btn unmuted";
        if(btnIcon) btnIcon.className = "fa-solid fa-microphone-lines";
        if(btnText) btnText.innerText = "MUTE MIC";
        if(pulseNode) pulseNode.className = "voice-pulse-icon active-pulse";
        if(statusDesc) statusDesc.innerText = "Voice link fully operational. Transmission is currently LIVE.";
    }
    initVoiceConference(currentRoom);
}

function initVoiceConference(roomName) {
    if (!currentUser) return;
    const secureRoomString = `${firebaseConfig.projectId}_voice_${roomName}_grid_session`;
    const voiceServerUrl = `https://meet.jit.si/${secureRoomString}#userInfo.displayName="${currentUser.displayName}"&config.prejoinPageEnabled=false&config.startWithVideoMuted=true&config.startWithAudioMuted=${isMuted}&config.videoQA.disabled=true&config.startAudioMuted=999`;
    
    const voiceFrame = document.getElementById('jitsi-voice-frame');
    if (voiceFrame) voiceFrame.src = voiceServerUrl;
}

window.searchYT = function(channelName) {
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(channelName)}`, '_blank');
}

window.triggerMembershipAlert = function() {
    alert("⚡ CRAFTMEET MULTIVERSE UPGRADE ⚡\n\nTo register custom YouTube channels into the Grid, purchase Membership Tier.\n\nFee: $2.00 / Month");
}

// ==========================================
// 8. DYNAMIC EMOJI INJECTION ENGINE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const inputField = document.getElementById('message-input');
    const inputContainer = document.querySelector('.input-container');
    
    if (typeof EmojiButton !== 'undefined' && inputContainer && inputField) {
        const pickerTrigger = document.createElement('button');
        pickerTrigger.type = "button";
        pickerTrigger.className = "emoji-trigger-btn";
        // Styling to seamlessly match your placeholder input border box
        pickerTrigger.style.background = "none";
        pickerTrigger.style.border = "none";
        pickerTrigger.style.color = "#949ba4";
        pickerTrigger.style.cursor = "pointer";
        pickerTrigger.style.fontSize = "1.1rem";
        pickerTrigger.style.padding = "0 10px";
        pickerTrigger.innerHTML = `<i class="fa-regular fa-face-smile"></i>`;
        
        // Push Emoji trigger right before the send airplane arrow
        inputContainer.insertBefore(pickerTrigger, inputContainer.lastElementChild);

        const picker = new EmojiButton({ theme: 'dark', autoHide: true, position: 'top-start' });
        picker.on('emoji', selection => {
            inputField.value += selection.emoji;
            inputField.focus();
        });
        
        pickerTrigger.addEventListener('click', () => picker.togglePicker(pickerTrigger));
    }
});
