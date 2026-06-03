// ==========================================
// 1. FIREBASE CONFIGURATION & INITIALIZATION
// ==========================================
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
const storage = firebase.storage(); 

let currentUser = null;
let currentRoom = "global"; 
let isInitialLoad = true; 
let typingTimeout = null;
let isMuted = false; 
let isRegisterMode = false; 

const decorationsList = ["deco-cyber-neon", "deco-golden-flame", "deco-magic-star"];

// Incoming Notification Sound Wave synthesizer
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
    } catch (e) { console.log("Audio Engine Error:", e); }
}

// Switching view configurations for Registration/Login Panel UI
function toggleAuthMode(e) {
    e.preventDefault();
    isRegisterMode = !isRegisterMode;
    const title = document.getElementById('auth-title'), subtitle = document.getElementById('auth-subtitle');
    const mainBtn = document.getElementById('main-auth-btn'), switchLink = document.getElementById('switch-auth-link'), switchText = document.getElementById('switch-text');
    const usernameGroup = document.getElementById('reg-username-group'), regExtras = document.getElementById('reg-extras');

    if (isRegisterMode) {
        title.innerText = "CREATE AN ACCOUNT"; subtitle.innerText = "Join the ultimate Sri Lankan gaming hub today!";
        mainBtn.innerText = "Continue & Register"; switchText.innerText = "Already have an account?"; switchLink.innerText = "Log In";
        usernameGroup.style.display = "block"; regExtras.style.display = "block";
    } else {
        title.innerText = "WELCOME BACK!"; subtitle.innerText = "We're so excited to see you again!";
        mainBtn.innerText = "Log In"; switchText.innerText = "Need an account?"; switchLink.innerText = "Register";
        usernameGroup.style.display = "none"; regExtras.style.display = "none";
    }
}

// Google Authentication Pop-up Handler Engine [FIXED INTEGRITY BUG]
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
    .then(result => {
        console.log("Google Login Granted:", result.user.displayName);
    })
    .catch(err => {
        console.error("Google Auth Error Node:", err);
        alert("Google Access Denied: " + err.message);
    });
}

// Account Registration & Traditional Authentication Handler [FIXED UPLOAD BUG]
function handlePrimaryAuth() {
    const email = document.getElementById('auth-email').value.trim(), password = document.getElementById('auth-password').value;
    const username = document.getElementById('auth-username').value.trim();
    const bio = document.getElementById('auth-bio').value.trim() || "Hey there! I am using CraftMeet.";
    const avatarFileInput = document.getElementById('auth-avatar-file');

    if (!email || !password) { alert("Please fill in all required fields."); return; }

    if (isRegisterMode) {
        if (!username) { alert("Please choose a Gamertag/Username."); return; }
        
        auth.createUserWithEmailAndPassword(email, password).then(async (credential) => {
            const user = credential.user;
            let photoURL = 'https://via.placeholder.com/40';

            // Catching avatar uploaded stream data
            if (avatarFileInput && avatarFileInput.files[0]) {
                try {
                    const storageRef = storage.ref(`avatars/${user.uid}`);
                    const snapshot = await storageRef.put(avatarFileInput.files[0]);
                    photoURL = await snapshot.ref.getDownloadURL();
                } catch(e) { console.error("Avatar Upload Fail Loop:", e); }
            }

            await user.updateProfile({ displayName: username, photoURL: photoURL });
            
            await db.ref(`users/${user.uid}`).set({
                name: username,
                profilePic: photoURL,
                bio: bio,
                gameSpecialty: "Multi-Game Athlete",
                xp: 0,
                level: 1, 
                currentDecoration: "none",
                decorationClaimedAt: 0
            });
            location.reload();
        }).catch(err => alert("Registration Fault: " + err.message));
    } else {
        auth.signInWithEmailAndPassword(email, password).catch(err => alert("Login Fault: " + err.message));
    }
}

// Observer Matrix Tracking User Status State Changes
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
        document.getElementById('jitsi-voice-frame').src = "";
    }
});

// Dynamic Synchronizer Checking Level Configurations & 7-Day Expire Engine
function syncUserProfileData(user) {
    const userRef = db.ref(`users/${user.uid}`);
    userRef.on('value', snapshot => {
        const data = snapshot.val(), avatarImg = document.getElementById('user-avatar'), specialtyText = document.getElementById('user-specialty');
        if (data) {
            // 7-DAY EXPIRY CHECKER LOGIC
            if (data.currentDecoration && data.currentDecoration !== "none" && data.decorationClaimedAt) {
                const oneWeekInMs = 7 * 24 * 60 * 60 * 1000; 
                const currentTime = Date.now();
                
                if (currentTime - data.decorationClaimedAt > oneWeekInMs) {
                    db.ref(`users/${user.uid}`).update({
                        currentDecoration: "none",
                        decorationClaimedAt: 0
                    });
                    alert("⏰ YOUR DECORATION EXPIRED!\n\nYour 7-day avatar decoration frame time has ended. Keep chatting to earn more XP and unlock it again!");
                    return; 
                }
            }

            avatarImg.src = data.profilePic || user.photoURL || 'https://via.placeholder.com/40';
            
            // Render Profile Tracker Details in Application Footer Layout
            let currentLvl = data.level || 1;
            let currentXp = data.xp || 0;
            let nextLevelXp = currentLvl * 500;
            specialtyText.innerHTML = `<span class="dot-neon"></span> Lvl ${currentLvl} (${currentXp}/${nextLevelXp} XP)`;
            
            const footerFrame = document.getElementById('user-footer-deco-frame');
            footerFrame.className = "deco-frame-container footer-avatar-frame"; 
            if(data.currentDecoration && data.currentDecoration !== "none"){
                footerFrame.classList.add(data.currentDecoration);
            }

            if(document.getElementById('profile-bio-input')) document.getElementById('profile-bio-input').value = data.bio || '';
            if(document.getElementById('profile-game-input')) document.getElementById('profile-game-input').value = data.gameSpecialty || 'Multi-Game Athlete';

            // ANTI-SPAM CONTROL LOGIC FOR REWARD MODAL
            if (data.xp >= 500 && (!data.currentDecoration || data.currentDecoration === "none")) {
                document.getElementById('reward-popup-modal').classList.remove('hidden');
            } else {
                document.getElementById('reward-popup-modal').classList.add('hidden');
            }
        } else {
            const defaultName = user.displayName || "Gamer", defaultAvatar = user.photoURL || 'https://via.placeholder.com/40';
            userRef.set({ 
                name: defaultName, 
                profilePic: defaultAvatar, 
                bio: "Hey there! I am using CraftMeet.", 
                gameSpecialty: "Multi-Game Athlete", 
                xp: 0, 
                level: 1, 
                currentDecoration: "none", 
                decorationClaimedAt: 0 
            });
        }
    });
}

// Reward Extraction Engine (Consumes XP Nodes)
function claimAvatarDecoration() {
    if (!currentUser) return;
    const randomDeco = decorationsList[Math.floor(Math.random() * decorationsList.length)];
    
    db.ref(`users/${currentUser.uid}`).once('value').then(snapshot => {
        const currentXp = snapshot.val().xp || 0;
        const newXp = Math.max(0, currentXp - 500);

        db.ref(`users/${currentUser.uid}`).update({
            xp: newXp,
            currentDecoration: randomDeco,
            decorationClaimedAt: Date.now() 
        }).then(() => {
            document.getElementById('reward-popup-modal').classList.add('hidden');
            alert(`🎉 LEGENDARY CLAIM SUCCESSFUL!\n\nYou unlocked the [${randomDeco.replace('deco-', '').replace('-', ' ').toUpperCase()}] Avatar border!\n\n*Note: This decoration is valid for exactly 7 days!`);
        });
    });
}

function toggleProfileModal() { document.getElementById('profile-modal').classList.toggle('hidden'); }

// Profile Configurations Database Push Update Method
async function saveUserProfile() {
    if (!currentUser) return;
    const fileInput = document.getElementById('profile-pic-file');
    let profilePicUrl = currentUser.photoURL || 'https://via.placeholder.com/40';

    if(fileInput && fileInput.files[0]) {
        try {
            const fileRef = storage.ref(`avatars/${currentUser.uid}`);
            const snap = await fileRef.put(fileInput.files[0]);
            profilePicUrl = await snap.ref.getDownloadURL();
        } catch(e) { console.error(e); }
    }

    db.ref(`users/${currentUser.uid}`).update({
        profilePic: profilePicUrl,
        bio: document.getElementById('profile-bio-input').value.trim(),
        gameSpecialty: document.getElementById('profile-game-input').value
    }).then(() => {
        toggleProfileModal();
    }).catch(err => alert(err.message));
}

function logout() { auth.signOut().then(() => location.reload()); }
function toggleUserCardModal() { document.getElementById('user-card-modal').classList.toggle('hidden'); }

// On-Demand Public Profiler Card Viewer Renderer
function viewUserProfileCard(targetUid) {
    if (!currentUser) return;
    db.ref(`users/${targetUid}`).once('value').then(snapshot => {
        const data = snapshot.val();
        if (!data) return;

        if (data.currentDecoration && data.currentDecoration !== "none" && data.decorationClaimedAt) {
            const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
            if (Date.now() - data.decorationClaimedAt > oneWeekInMs) {
                db.ref(`users/${targetUid}`).update({ currentDecoration: "none", decorationClaimedAt: 0 });
                data.currentDecoration = "none"; 
            }
        }

        document.getElementById('view-card-avatar').src = data.profilePic || 'https://via.placeholder.com/80';
        document.getElementById('view-card-name').innerText = data.name || 'Gamer';
        document.getElementById('view-card-game').innerText = data.gameSpecialty || 'Multi-Game Athlete';
        document.getElementById('view-card-bio').innerText = data.bio || 'No bio available.';
        
        let level = data.level || 1;
        let userXp = data.xp || 0;
        let targetXPForNextLevel = level * 500;
        const barPercent = Math.min(100, (userXp / targetXPForNextLevel) * 100);
        
        document.getElementById('view-card-xp-fill').style.width = `${barPercent}%`;
        document.getElementById('view-card-xp-text').innerText = `${userXp} / ${targetXPForNextLevel} XP (Level ${level})`;

        const cardFrame = document.getElementById('view-card-deco-frame');
        cardFrame.className = "deco-frame-container";
        if(data.currentDecoration && data.currentDecoration !== "none"){
            cardFrame.classList.add(data.currentDecoration);
        }

        const dmBtn = document.getElementById('view-card-dm-btn');
        if (targetUid === currentUser.uid) {
            dmBtn.style.display = "none";
        } else {
            dmBtn.style.display = "flex";
            dmBtn.onclick = function() { initiatePrivateDM(targetUid, data.name); };
        }
        toggleUserCardModal();
    });
}

// Instantiate Messaging Data Stream Pipelines between Players
function initiatePrivateDM(targetUid, targetName) {
    toggleUserCardModal();
    const dmRoomId = currentUser.uid < targetUid ? `dm_${currentUser.uid}_${targetUid}` : `dm_${targetUid}_${currentUser.uid}`;
    db.ref(`users/${currentUser.uid}/active_dms/${dmRoomId}`).set({ roomName: targetName, targetId: targetUid });
    db.ref(`users/${targetUid}/active_dms/${dmRoomId}`).set({ roomName: currentUser.displayName || 'Gamer', targetId: currentUser.uid });
    switchRoom(dmRoomId);
}

// Reactive Active DM Listing Listener Node
function loadPrivateRoomsList() {
    if (!currentUser) return;
    db.ref(`users/${currentUser.uid}/active_dms`).on('value', snapshot => {
        const dmList = document.getElementById('private-rooms-list');
        dmList.innerHTML = "";
        if (!snapshot.exists()) {
            dmList.innerHTML = '<li class="no-dm-notice">No active DMs</li>';
            return;
        }
        snapshot.forEach(child => {
            const roomId = child.key; const dmData = child.val();
            const isActive = currentRoom === roomId ? 'active' : '';
            dmList.innerHTML += `
                <li class="room-item priv-item ${isActive}" id="room-${roomId}" onclick="switchRoom('${roomId}')">
                    <i class="fa-solid fa-comment-medical cyber-magenta-text"></i> <span>${dmData.roomName.toLowerCase()}</span>
                </li>
            `;
        });
    });
}

// System Cluster Presence Cluster Connector Unit
function setupOnlineCounter() {
    db.ref('.info/connected').on('value', snap => {
        if (snap.val() === false) return;
        db.ref(`online_users/${currentUser.uid}`).onDisconnect().remove().then(() => {
            db.ref(`online_users/${currentUser.uid}`).set({ name: currentUser.displayName || 'Gamer', active: true });
        });
    });
    db.ref('online_users').on('value', snap => { document.getElementById('online-count').innerText = snap.numChildren() || 1; });
}

// Typing Indicator Interface Event Handlers
function handleTyping() {
    if (!currentUser) return;
    db.ref(`typing/${currentRoom}/${currentUser.uid}`).set({ name: currentUser.displayName || 'Gamer', typing: true });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => { db.ref(`typing/${currentRoom}/${currentUser.uid}`).remove(); }, 2000); 
}

function listenToTyping(roomName) {
    db.ref(`typing/${roomName}`).on('value', snapshot => {
        const typingBox = document.getElementById('typing-indicator'), typingUserSpan = document.getElementById('typing-user');
        let typers = []; snapshot.forEach(child => { if (child.key !== currentUser.uid) typers.push(child.val().name); });
        if (typers.length > 0) { typingUserSpan.innerText = typers.join(', '); typingBox.classList.remove('hidden'); } else { typingBox.classList.add('hidden'); }
    });
}

function toggleVoiceMute() {
    isMuted = !isMuted;
    const muteBtn = document.getElementById('comms-mute-btn'), btnIcon = document.getElementById('mute-btn-icon'), btnText = document.getElementById('mute-btn-text');
    const pulseNode = document.getElementById('voice-pulse-node'), statusIcon = document.getElementById('voice-status-icon'), statusDesc = document.getElementById('voice-status-desc');
    if (isMuted) {
        muteBtn.className = "comms-mute-btn muted"; btnIcon.className = "fa-solid fa-microphone-lines-slash"; btnText.innerText = "UNMUTE MIC";
        pulseNode.className = "voice-pulse-icon muted-pulse"; statusIcon.className = "fa-solid fa-microphone-slash"; statusDesc.innerText = "Transmission terminated. Microphone locked.";
    } else {
        muteBtn.className = "comms-mute-btn unmuted"; btnIcon.className = "fa-solid fa-microphone-lines"; btnText.innerText = "MUTE MIC";
        pulseNode.className = "voice-pulse-icon active-pulse"; statusIcon.className = "fa-solid fa-microphone"; statusDesc.innerText = "Voice link operational. Transmission LIVE.";
    }
    initVoiceConference(currentRoom);
}

function searchYT(channelName) { window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(channelName + " gaming youtube")}`, '_blank'); }
function triggerMembershipAlert() { alert("⚡ CRAFTMEET MULTIVERSE UPGRADE ⚡\n\nTo register custom YouTube channels, purchase Membership Tier.\n\nFee: $2.00 / Month"); }

// Channel Dynamic Room Switcher Processor [FIXED TIMEOUT DELAY BUG]
function switchRoom(roomName) {
    if (currentUser) db.ref(`typing/${currentRoom}/${currentUser.uid}`).remove();
    currentRoom = roomName; isInitialLoad = true;
    
    document.querySelectorAll('.room-item').forEach(i => i.classList.remove('active'));
    const activeTarget = document.getElementById(`room-${roomName}`);
    if (activeTarget) activeTarget.classList.add('active');
    
    const isDM = roomName.startsWith('dm_');
    const visualTitle = isDM ? "private-direct-chat" : roomName.replace('room-', '') + "-chat";
    document.getElementById('current-room-title').innerText = visualTitle;
    document.getElementById('active-voice-channel').innerText = `CONNECTED: ${visualTitle}`;
    
    loadMessages(roomName); listenToTyping(roomName); initVoiceConference(roomName);
}

// Atomic Processing System Data Pipeline for Messaging & Profile Progression [FIXED LEVEL BUG]
function sendMessage() {
    const input = document.getElementById('message-input'), text = input.value.trim(); if (text === "" || !currentUser) return;
    
    const gainedXp = text.length > 25 ? 15 : 8; 
    
    db.ref(`rooms/${currentRoom}`).push({ 
        uid: currentUser.uid, 
        sender: currentUser.displayName || 'Gamer', 
        message: text, 
        timestamp: Date.now() 
    });
    
    // Core Atomic Engine Transaction Processor
    const userRef = db.ref(`users/${currentUser.uid}`);
    userRef.transaction(userData => {
        if (userData) {
            userData.xp = (userData.xp || 0) + gainedXp;
            let currentLevel = userData.level || 1;
            let xpNeeded = currentLevel * 500;
            
            if (userData.xp >= xpNeeded) {
                userData.level = currentLevel + 1;
                // Emit systemic globally distributed broadcast celebration notification
                setTimeout(() => {
                    db.ref(`rooms/${currentRoom}`).push({ 
                        uid: "SYSTEM", 
                        sender: "[SYSTEM ALERT]", 
                        message: `🚀 CONGRATULATIONS! ${userData.name.toUpperCase()} just leveled up to LEVEL ${userData.level}! 🔥`, 
                        timestamp: Date.now() 
                    });
                }, 500);
            }
        }
        return userData;
    });

    db.ref(`typing/${currentRoom}/${currentUser.uid}`).remove(); input.value = "";
}

function checkEnter(e) { if (e.key === 'Enter') sendMessage(); }

// Database Stream Message Core Dispatch Reader
let currentDbRef = null;
function loadMessages(roomName) {
    const chatDisplay = document.getElementById('chat-messages');
    if (currentDbRef) currentDbRef.off();
    currentDbRef = db.ref(`rooms/${roomName}`).limitToLast(100);
    currentDbRef.once('value').then(() => { isInitialLoad = false; });
    currentDbRef.on('value', snapshot => {
        chatDisplay.innerHTML = "";
        let totalChildren = snapshot.numChildren(), counter = 0;
        snapshot.forEach(child => {
            const data = child.val(); const isOwn = data.uid === currentUser.uid;
            const isSystem = data.uid === "SYSTEM";
            const timeStr = data.timestamp ? new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            counter++;
            
            if(isSystem) {
                chatDisplay.innerHTML += `
                    <div class="msg-container system-msg" style="text-align: center; width: 100%; margin: 8px 0;">
                        <div class="msg-bubble" style="background: rgba(255, 0, 127, 0.15) !important; border: 1px dashed #ff007f !important; color: #ff007f; display: inline-block; font-size: 13px;">${data.message}</div>
                    </div>`;
            } else {
                chatDisplay.innerHTML += `
                    <div class="msg-container ${isOwn ? 'own-msg' : ''}">
                        <div class="msg-info">
                            <span class="msg-sender" onclick="viewUserProfileCard('${data.uid}')" style="cursor: pointer;" title="Click to View Profile & DM">${isOwn ? 'You' : data.sender}</span>
                            <span class="msg-time">${timeStr}</span>
                        </div>
                        <div class="msg-bubble">${data.message}</div>
                    </div>`;
            }
            if (!isInitialLoad && counter === totalChildren && !isOwn && !isSystem) playIncomingSound();
        });
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    });
}

// Tactical WebRTC Audio Bridge Connection Initiator
function initVoiceConference(roomName) {
    if (!currentUser) return;
    const secureRoomString = `${firebaseConfig.projectId}_voice_${roomName}_grid_session`;
    const voiceServerUrl = `https://meet.jit.si/${secureRoomString}#userInfo.displayName="${currentUser.displayName}"&config.prejoinPageEnabled=false&config.startWithVideoMuted=true&config.startWithAudioMuted=${isMuted}&config.videoQA.disabled=true&config.startAudioMuted=999`;
    if(document.getElementById('jitsi-voice-frame')) {
        document.getElementById('jitsi-voice-frame').src = voiceServerUrl;
    }
}
