// Firebase v9+ Modular SDK Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-analytics.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithRedirect, getRedirectResult } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getDatabase, ref, set, update, onValue, push, runTransaction } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

// Your web app's Firebase configuration
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

// Initialize Firebase Components
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getDatabase(app);

// Core App States
let currentUser = null;
let currentRoom = "global"; 
let isInitialLoad = true; 
let typingTimeout = null;
let isMuted = false; 
let isRegisterMode = false; 

const decorationsList = ["deco-cyber-neon", "deco-golden-flame", "deco-magic-star"];

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
    } catch (e) { console.log(e); }
}

function toggleAuthMode(e) {
    e.preventDefault();
    isRegisterMode = !isRegisterMode;
    const title = document.getElementById('auth-title'), subtitle = document.getElementById('auth-subtitle');
    const mainBtn = document.getElementById('main-auth-btn'), switchLink = document.getElementById('switch-auth-link'), switchText = document.getElementById('switch-text');
    const usernameGroup = document.getElementById('reg-username-group'), regExtras = document.getElementById('reg-extras');

    if (isRegisterMode) {
        title.innerText = "CREATE AN ACCOUNT"; subtitle.innerText = "Join the ultimate Sri Lankan gaming hub today!";
        mainBtn.innerText = "Continue & Register"; switchText.innerText = "Already have an account?"; switchLink.innerText = "Log In";
        usernameGroup.style.display = "flex"; regExtras.style.display = "block";
    } else {
        title.innerText = "WELCOME BACK!"; subtitle.innerText = "We're so excited to see you again!";
        mainBtn.innerText = "Log In"; switchText.innerText = "Need an account?"; switchLink.innerText = "Register";
        usernameGroup.style.display = "none"; regExtras.style.display = "none";
    }
}

function handlePrimaryAuth() {
    const email = document.getElementById('auth-email').value.trim(), password = document.getElementById('auth-password').value;
    const username = document.getElementById('auth-username').value.trim(), avatar = document.getElementById('auth-avatar').value.trim(), bio = document.getElementById('auth-bio').value.trim();

    if (!email || !password) { alert("Please fill in all required fields."); return; }

    if (isRegisterMode) {
        if (!username) { alert("Please choose a Gamertag/Username."); return; }
        createUserWithEmailAndPassword(auth, email, password).then(credential => {
            const user = credential.user;
            const defaultAvatar = avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;
            updateProfile(user, { displayName: username, photoURL: defaultAvatar }).then(() => {
                set(ref(db, `users/${user.uid}`), { name: username, profilePic: defaultAvatar, bio: bio || "Hey there! I am using CraftMeet.", gameSpecialty: "Multi-Game Athlete", xp: 0, currentDecoration: "none", decorationClaimedAt: 0 })
                .then(() => { location.reload(); });
            });
        }).catch(err => alert("Registration Fault: " + err.message));
    } else {
        signInWithEmailAndPassword(auth, email, password).catch(err => alert("Login Fault: " + err.message));
    }
}

getRedirectResult(auth).then(result => {
    if (result && result.user) console.log("Google Redirect Logged In:", result.user.displayName);
}).catch(err => console.warn("Redirect Auth Info:", err.message));

onAuthStateChanged(auth, user => {
    const authScreen = document.getElementById('auth-screen');
    const jitsiFrame = document.getElementById('jitsi-voice-frame');
    
    if (user) {
        currentUser = user;
        if (authScreen) authScreen.classList.add('hidden');
        
        const userDispName = document.getElementById('user-display-name');
        if (userDispName) userDispName.innerText = user.displayName || "Gamer";
        
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

function syncUserProfileData(user) {
    const userRef = ref(db, `users/${user.uid}`);
    onValue(userRef, snapshot => {
        const data = snapshot.val();
        const avatarImg = document.getElementById('user-avatar');
        const specialtyText = document.getElementById('user-specialty');
        
        if (data) {
            if (data.currentDecoration && data.currentDecoration !== "none" && data.decorationClaimedAt) {
                const oneWeekInMs = 7 * 24 * 60 * 60 * 1000; 
                const currentTime = Date.now();
                
                if (currentTime - data.decorationClaimedAt > oneWeekInMs) {
                    update(ref(db, `users/${user.uid}`), {
                        currentDecoration: "none",
                        decorationClaimedAt: 0
                    });
                    alert("⏰ YOUR DECORATION EXPIRED!\n\nYour 7-day avatar decoration frame time has ended. Keep chatting to earn more XP and unlock it again!");
                    return; 
                }
            }

            if (avatarImg) avatarImg.src = data.profilePic || user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.displayName}`;
            if (specialtyText) specialtyText.innerHTML = `<span class="dot-neon"></span> ${data.gameSpecialty || 'Multi-Game Athlete'}`;
            
            const footerFrame = document.getElementById('user-footer-deco-frame');
            if (footerFrame) {
                footerFrame.className = "deco-frame-container footer-avatar-frame"; 
                if (data.currentDecoration && data.currentDecoration !== "none") {
                    footerFrame.classList.add(data.currentDecoration);
                }
            }

            const userXp = data.xp || 0;
            const barPercent = Math.min(100, (userXp / 500) * 100);
            const dashXpFill = document.getElementById('dashboard-xp-fill');
            const dashXpText = document.getElementById('dashboard-xp-text');
            
            if (dashXpFill) dashXpFill.style.width = `${barPercent}%`;
            if (dashXpText) dashXpText.innerText = `${userXp} / 500 XP`;

            const picInput = document.getElementById('profile-pic-input');
            const bioInput = document.getElementById('profile-bio-input');
            const gameInput = document.getElementById('profile-game-input');
            
            if (picInput) picInput.value = data.profilePic || '';
            if (bioInput) bioInput.value = data.bio || '';
            if (gameInput) gameInput.value = data.gameSpecialty || 'Multi-Game Athlete';

            const rewardModal = document.getElementById('reward-popup-modal');
            if (rewardModal) {
                if (data.xp >= 500 && (!data.currentDecoration || data.currentDecoration === "none")) {
                    rewardModal.classList.remove('hidden');
                } else {
                    rewardModal.classList.add('hidden');
                }
            }
        } else {
            const defaultName = user.displayName || "Gamer";
            const defaultAvatar = user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${defaultName}`;
            set(ref(db, `users/${user.uid}`), { name: defaultName, profilePic: defaultAvatar, bio: "Hey there! I am using CraftMeet.", gameSpecialty: "Multi-Game Athlete", xp: 0, currentDecoration: "none", decorationClaimedAt: 0 });
            if (avatarImg) avatarImg.src = defaultAvatar; 
            if (specialtyText) specialtyText.innerHTML = `<span class="dot-neon"></span> Multi-Game Athlete`;
        }
    });
}

function claimAvatarDecoration() {
    if (!currentUser) return;
    const randomDeco = decorationsList[Math.floor(Math.random() * decorationsList.length)];
    
    const userXpRef = ref(db, `users/${currentUser.uid}`);
    runTransaction(userXpRef, (currentData) => {
        if (currentData) {
            const currentXp = currentData.xp || 0;
            currentData.xp = Math.max(0, currentXp - 500);
            currentData.currentDecoration = randomDeco;
            currentData.decorationClaimedAt = Date.now();
        }
        return currentData;
    }).then(() => {
        const rewardModal = document.getElementById('reward-popup-modal');
        if (rewardModal) rewardModal.classList.add('hidden');
        alert(`🎉 LEGENDARY CLAIM SUCCESSFUL!\n\nYou unlocked the [${randomDeco.replace('deco-', '').replace('-', ' ').toUpperCase()}] Avatar border!\n\n*Note: This decoration is valid for exactly 7 days!`);
    });
}

function toggleProfileModal() { 
    const profModal = document.getElementById('profile-modal');
    if (profModal) profModal.classList.toggle('hidden'); 
}

function loginWithGoogle() { 
    const provider = new GoogleAuthProvider(); 
    signInWithRedirect(auth, provider).catch(err => console.error(err)); 
}

function saveUserProfile() {
    if (!currentUser) return;
    update(ref(db, `users/${currentUser.uid}`), {
        profilePic: document.getElementById('profile-pic-input').value.trim() || currentUser.photoURL,
        bio: document.getElementById('profile-bio-input').value.trim(),
        gameSpecialty: document.getElementById('profile-game-input').value
    }).then(() => toggleProfileModal()).catch(err => alert(err.message));
}

function logout() { signOut(auth).then(() => location.reload()); }

function toggleUserCardModal() { 
    const cardModal = document.getElementById('user-card-modal');
    if (cardModal) cardModal.classList.toggle('hidden'); 
}

window.viewUserProfileCard = function(targetUid) {
    if (!currentUser) return;
    onValue(ref(db, `users/${targetUid}`), snapshot => {
        const data = snapshot.val();
        if (!data) return;

        if (data.currentDecoration && data.currentDecoration !== "none" && data.decorationClaimedAt) {
            const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
            if (Date.now() - data.decorationClaimedAt > oneWeekInMs) {
                update(ref(db, `users/${targetUid}`), { currentDecoration: "none", decorationClaimedAt: 0 });
                data.currentDecoration = "none"; 
            }
        }

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
        if (dmBtn) {
            if (targetUid === currentUser.uid) {
                dmBtn.style.display = "none";
            } else {
                dmBtn.style.display = "flex";
                dmBtn.onclick = function() { initiatePrivateDM(targetUid, data.name); };
            }
        }
        toggleUserCardModal();
    }, { onlyOnce: true });
}

function initiatePrivateDM(targetUid, targetName) {
    toggleUserCardModal();
    const dmRoomId = currentUser.uid < targetUid ? `dm_${currentUser.uid}_${targetUid}` : `dm_${targetUid}_${currentUser.uid}`;
    set(ref(db, `users/${currentUser.uid}/active_dms/${dmRoomId}`), { roomName: targetName, targetId: targetUid });
    set(ref(db, `users/${targetUid}/active_dms/${dmRoomId}`), { roomName: currentUser.displayName, targetId: currentUser.uid });
    switchRoom(dmRoomId);
}

function loadPrivateRoomsList() {
    if (!currentUser) return;
    onValue(ref(db, `users/${currentUser.uid}/active_dms`), snapshot => {
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
            li.className = `room-item priv-item ${isActive}`;
            li.id = `room-${roomId}`;
            li.innerHTML = `<i class="fa-solid fa-comment-medical cyber-magenta-text"></i> <span>${dmData.roomName.toLowerCase()}</span>`;
            li.addEventListener('click', () => switchRoom(roomId));
            dmList.appendChild(li);
        });
    });
}

function setupOnlineCounter() {
    onValue(ref(db, '.info/connected'), snap => {
        if (snap.val() === false) return;
        const myOnlineRef = ref(db, `online_users/${currentUser.uid}`);
        set(myOnlineRef, { name: currentUser.displayName, active: true });
    });
    onValue(ref(db, 'online_users'), snap => { 
        const onlineCount = document.getElementById('online-count');
        // FIXED: Added parentheses () here
        if (onlineCount) onlineCount.innerText = snap.numChildren() || 1; 
    });
}

function handleTyping() {
    if (!currentUser) return;
    set(ref(db, `typing/${currentRoom}/${currentUser.uid}`), { name: currentUser.displayName, typing: true });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => { set(ref(db, `typing/${currentRoom}/${currentUser.uid}`), null); }, 2000); 
}

function listenToTyping(roomName) {
    onValue(ref(db, `typing/${roomName}`), snapshot => {
        const typingBox = document.getElementById('typing-indicator'), typingUserSpan = document.getElementById('typing-user');
        if (!typingBox || !typingUserSpan) return;
        let typers = []; snapshot.forEach(child => { if (child.key !== currentUser.uid) typers.push(child.val().name); });
        if (typers.length > 0) { typingUserSpan.innerText = typers.join(', '); typingBox.classList.remove('hidden'); } else { typingBox.classList.add('hidden'); }
    });
}

function toggleVoiceMute() {
    isMuted = !isMuted;
    const muteBtn = document.getElementById('comms-mute-btn'), btnIcon = document.getElementById('mute-btn-icon'), btnText = document.getElementById('mute-btn-text');
    const pulseNode = document.getElementById('voice-pulse-node'), statusIcon = document.getElementById('voice-status-icon'), statusDesc = document.getElementById('voice-status-desc');
    if (isMuted) {
        if (muteBtn) muteBtn.className = "comms-mute-btn muted"; if (btnIcon) btnIcon.className = "fa-solid fa-microphone-lines-slash"; if (btnText) btnText.innerText = "UNMUTE MIC";
        if (pulseNode) pulseNode.className = "voice-pulse-icon muted-pulse"; if (statusIcon) statusIcon.className = "fa-solid fa-microphone-slash"; if (statusDesc) statusDesc.innerText = "Transmission terminated. Microphone locked.";
    } else {
        if (muteBtn) muteBtn.className = "comms-mute-btn unmuted"; if (btnIcon) btnIcon.className = "fa-solid fa-microphone-lines"; if (btnText) btnText.innerText = "MUTE MIC";
        if (pulseNode) pulseNode.className = "voice-pulse-icon active-pulse"; if (statusIcon) statusIcon.className = "fa-solid fa-microphone"; if (statusDesc) statusDesc.innerText = "Voice link operational. Transmission LIVE.";
    }
    initVoiceConference(currentRoom);
}

function searchYT(channelName) { window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(channelName + " gaming youtube")}`, '_blank'); }
function triggerMembershipAlert() { alert("⚡ CRAFTMEET MULTIVERSE UPGRADE ⚡\n\nTo register custom YouTube channels, purchase Membership Tier.\n\nFee: $2.00 / Month"); }

function switchRoom(roomName) {
    if (currentUser) set(ref(db, `typing/${currentRoom}/${currentUser.uid}`), null);
    currentRoom = roomName; isInitialLoad = true;
    
    document.querySelectorAll('.room-item').forEach(i => i.classList.remove('active'));
    const activeTarget = document.getElementById(`room-${roomName}`);
    if (activeTarget) activeTarget.classList.add('active');
    
    const isDM = roomName.startsWith('dm_');
    const visualTitle = isDM ? "private-direct-chat" : roomName.replace('-', ' ') + "-chat";
    
    const roomTitleEl = document.getElementById('current-room-title');
    const voiceChanEl = document.getElementById('active-voice-channel');
    if (roomTitleEl) roomTitleEl.innerText = visualTitle;
    if (voiceChanEl) voiceChanEl.innerText = `CONNECTED: ${visualTitle}`;
    
    loadMessages(roomName); 
    listenToTyping(roomName); 
    initVoiceConference(roomName);
}

function sendMessage() {
    const input = document.getElementById('message-input');
    if (!input || !currentUser) return;
    const text = input.value.trim(); 
    if (text === "") return;
    
    const gainedXp = text.length > 25 ? 10 : 5;
    push(ref(db, `rooms/${currentRoom}`), { uid: currentUser.uid, sender: currentUser.displayName, message: text, timestamp: Date.now() });
    
    const userXpRef = ref(db, `users/${currentUser.uid}/xp`);
    runTransaction(userXpRef, (currentValue) => {
        return (currentValue || 0) + gainedXp;
    });

    set(ref(db, `typing/${currentRoom}/${currentUser.uid}`), null); 
    input.value = "";
}

function loadMessages(roomName) {
    const chatDisplay = document.getElementById('chat-messages');
    if (!chatDisplay) return;
    
    const chatRef = ref(db, `rooms/${roomName}`);
    isInitialLoad = true;
    
    onValue(chatRef, snapshot => {
        chatDisplay.innerHTML = "";
        // FIXED: Added parentheses () here
        let totalChildren = snapshot.numChildren(), counter = 0;
        
        if (totalChildren === 0) { isInitialLoad = false; }
        
        snapshot.forEach(child => {
            const data = child.val(); const isOwn = data.uid === currentUser.uid;
            const timeStr = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            counter++;
            
            chatDisplay.innerHTML += `
                <div class="msg-container ${isOwn ? 'own-msg' : ''}">
                    <div class="msg-info">
                        <span class="msg-sender" onclick="viewUserProfileCard('${data.uid}')" style="cursor: pointer;" title="Click to View Profile & DM">${isOwn ? 'You' : data.sender}</span>
                        <span class="msg-time">${timeStr}</span>
                    </div>
                    <div class="msg-bubble">${data.message}</div>
                </div>
            `;
            if (!isInitialLoad && counter === totalChildren && !isOwn) playIncomingSound();
        });
        isInitialLoad = false;
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    });
}

function initVoiceConference(roomName) {
    if (!currentUser) return;
    const secureRoomString = `${firebaseConfig.projectId}_voice_${roomName}_grid_session`;
    const voiceServerUrl = `https://meet.jit.si/${secureRoomString}#userInfo.displayName="${currentUser.displayName}"&config.prejoinPageEnabled=false&config.startWithVideoMuted=true&config.startWithAudioMuted=${isMuted}&config.videoQA.disabled=true&config.startAudioMuted=999`;
    const voiceFrame = document.getElementById('jitsi-voice-frame');
    if (voiceFrame) voiceFrame.src = voiceServerUrl;
}            

// DOM Element Event Binding Setup
document.addEventListener('DOMContentLoaded', () => {
    const msgInput = document.getElementById('message-input');
    if (msgInput) {
        msgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
        msgInput.addEventListener('input', handleTyping);
    }

    document.getElementById('switch-auth-link').addEventListener('click', toggleAuthMode);
    document.getElementById('primary-auth-form').addEventListener('submit', (e) => { e.preventDefault(); handlePrimaryAuth(); });
    document.getElementById('google-auth-btn').addEventListener('click', loginWithGoogle);
    document.getElementById('open-profile-settings').addEventListener('click', toggleProfileModal);
    document.getElementById('close-profile-settings').addEventListener('click', toggleProfileModal);
    document.getElementById('save-profile-btn').addEventListener('click', saveUserProfile);
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('close-user-card').addEventListener('click', toggleUserCardModal);
    document.getElementById('claim-deco-btn').addEventListener('click', claimAvatarDecoration);
    document.getElementById('comms-mute-btn').addEventListener('click', toggleVoiceMute);
    document.getElementById('send-msg-btn').addEventListener('click', sendMessage);
    
    document.getElementById('room-global').addEventListener('click', () => switchRoom('global'));
    document.getElementById('room-sri-lankan-esports').addEventListener('click', () => switchRoom('sri-lankan-esports'));
    document.getElementById('room-pc-gamers').addEventListener('click', () => switchRoom('pc-gamers'));
    document.getElementById('room-mobile-legends').addEventListener('click', () => switchRoom('mobile-legends'));
    
    document.getElementById('search-gamerlk-btn').addEventListener('click', () => searchYT('GamerLK'));
    document.getElementById('register-channel-btn').addEventListener('click', triggerMembershipAlert);

    // Emoji Picker Instantiation
    const pickerButton = document.getElementById('emoji-picker-btn');
    if (typeof EmojiButton !== 'undefined' && pickerButton) {
        const picker = new EmojiButton({ theme: 'dark', autoHide: true, position: 'top-start' });
        picker.on('emoji', selection => {
            if (msgInput) { msgInput.value += selection.emoji; msgInput.focus(); }
        });
        pickerButton.addEventListener('click', () => picker.togglePicker(pickerButton));
    }
});
