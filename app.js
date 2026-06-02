// Firebase Production Realtime Configuration With Your Credentials Embedded
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

// Initialize Identity Matrix Compat Layer Nodes
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let currentRoom = "global"; 
let isInitialLoad = true; 
let typingTimeout = null;
let isMuted = false; 

// Audio Generator Engine for Message Sound
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
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
        console.log("Audio node allocation bypassed:", e);
    }
}

// Active Core State Auth Engine Listener Block
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('user-display-name').innerText = user.displayName;
        
        // Listen to custom profile updates from Firebase Realtime Database
        syncUserProfileData(user);

        setupOnlineCounter();
        loadMessages(currentRoom);
        listenToTyping(currentRoom);
        initVoiceConference(currentRoom);
    } else {
        currentUser = null;
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('jitsi-voice-frame').src = "";
    }
});

// Realtime User Custom Profile Synchronization Hub
function syncUserProfileData(user) {
    db.ref(`users/${user.uid}`).on('value', snapshot => {
        const data = snapshot.val();
        const avatarImg = document.getElementById('user-avatar');
        const specialtyText = document.getElementById('user-specialty');

        if (data) {
            avatarImg.src = data.profilePic || user.photoURL || 'https://via.placeholder.com/40';
            specialtyText.innerHTML = `<span class="dot-neon"></span> ${data.gameSpecialty || 'Multi-Game Athlete'}`;
            
            // Auto fill inputs inside modal for smooth editing
            document.getElementById('profile-pic-input').value = data.profilePic || '';
            document.getElementById('profile-bio-input').value = data.bio || '';
            document.getElementById('profile-game-input').value = data.gameSpecialty || 'Multi-Game Athlete';
        } else {
            avatarImg.src = user.photoURL || 'https://via.placeholder.com/40';
            specialtyText.innerHTML = `<span class="dot-neon"></span> ACTIVE SQUAD`;
        }
    });
}

// Modal Toggle Window Logic
function toggleProfileModal() {
    const modal = document.getElementById('profile-modal');
    modal.classList.toggle('hidden');
}

// Save Custom Profile Logic to Firebase Nodes Matrix
function saveUserProfile() {
    if (!currentUser) return;

    const customPic = document.getElementById('profile-pic-input').value.trim();
    const customBio = document.getElementById('profile-bio-input').value.trim();
    const customGame = document.getElementById('profile-game-input').value;

    db.ref(`users/${currentUser.uid}`).set({
        name: currentUser.displayName,
        profilePic: customPic || currentUser.photoURL,
        bio: customBio,
        gameSpecialty: customGame,
        lastUpdated: Date.now()
    }).then(() => {
        toggleProfileModal();
    }).catch(err => {
        alert("Profile Update Failed: " + err.message);
    });
}

function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => {
        alert("Transmission Fault: " + err.message);
    });
}

function logout() {
    auth.signOut();
}

function setupOnlineCounter() {
    const onlineRef = db.ref('.info/connected');
    const userStatusRef = db.ref(`online_users/${currentUser.uid}`);

    onlineRef.on('value', snapshot => {
        if (snapshot.val() === false) return;
        userStatusRef.onDisconnect().remove().then(() => {
            userStatusRef.set({ name: currentUser.displayName, active: true });
        });
    });

    db.ref('online_users').on('value', snapshot => {
        const count = snapshot.numChildren() || 1;
        document.getElementById('online-count').innerText = count;
    });
}

function handleTyping() {
    if (!currentUser) return;
    db.ref(`typing/${currentRoom}/${currentUser.uid}`).set({
        name: currentUser.displayName,
        typing: true
    });

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        db.ref(`typing/${currentRoom}/${currentUser.uid}`).remove();
    }, 2000); 
}

function listenToTyping(roomName) {
    db.ref(`typing/${roomName}`).on('value', snapshot => {
        const typingBox = document.getElementById('typing-indicator');
        const typingUserSpan = document.getElementById('typing-user');
        let typers = [];

        snapshot.forEach(child => {
            if (child.key !== currentUser.uid) {
                typers.push(child.val().name);
            }
        });

        if (typers.length > 0) {
            typingUserSpan.innerText = typers.join(', ');
            typingBox.classList.remove('hidden');
        } else {
            typingBox.classList.add('hidden');
        }
    });
}

function toggleVoiceMute() {
    isMuted = !isMuted;
    const muteBtn = document.getElementById('comms-mute-btn');
    const btnIcon = document.getElementById('mute-btn-icon');
    const btnText = document.getElementById('mute-btn-text');
    const pulseNode = document.getElementById('voice-pulse-node');
    const statusIcon = document.getElementById('voice-status-icon');
    const statusDesc = document.getElementById('voice-status-desc');

    if (isMuted) {
        muteBtn.className = "comms-mute-btn muted";
        btnIcon.className = "fa-solid fa-microphone-lines-slash";
        btnText.innerText = "UNMUTE MIC";
        pulseNode.className = "voice-pulse-icon muted-pulse";
        statusIcon.className = "fa-solid fa-microphone-slash";
        statusDesc.innerText = "Transmission terminated. Your microphone is locked.";
    } else {
        muteBtn.className = "comms-mute-btn unmuted";
        btnIcon.className = "fa-solid fa-microphone-lines";
        btnText.innerText = "MUTE MIC";
        pulseNode.className = "voice-pulse-icon active-pulse";
        statusIcon.className = "fa-solid fa-microphone";
        statusDesc.innerText = "Voice link fully operational. Transmission is currently LIVE.";
    }
    initVoiceConference(currentRoom);
}

function searchYT(channelName) {
    const query = encodeURIComponent(channelName + " gaming youtube");
    const searchUrl = `https://www.youtube.com/results?search_query=${query}`;
    window.open(searchUrl, '_blank');
}

function triggerMembershipAlert() {
    alert("⚡ CRAFTMEET MULTIVERSE UPGRADE ⚡\n\nTo register custom YouTube channels directly into this grid, purchase the Extended Space Tier.\n\nFee: $2.00 USD / Month");
}

function switchRoom(roomName) {
    if (currentUser) db.ref(`typing/${currentRoom}/${currentUser.uid}`).remove();

    currentRoom = roomName;
    isInitialLoad = true; 

    document.querySelectorAll('.room-item').forEach(i => i.classList.remove('active'));
    
    const activeTarget = document.getElementById(`room-${roomName}`);
    if (activeTarget) activeTarget.classList.add('active');

    const formattedName = roomName.replace('-', ' ') + "-room";
    document.getElementById('current-room-title').innerText = formattedName;
    document.getElementById('active-voice-channel').innerText = `CONNECTED: ${roomName.replace('-', ' ')}`;
    
    loadMessages(roomName);
    listenToTyping(roomName);
    initVoiceConference(roomName);
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (text === "" || !currentUser) return;

    db.ref(`rooms/${currentRoom}`).push({
        uid: currentUser.uid,
        sender: currentUser.displayName,
        message: text,
        timestamp: Date.now()
    });
    
    db.ref(`typing/${currentRoom}/${currentUser.uid}`).remove();
    input.value = "";
}

function checkEnter(e) {
    if (e.key === 'Enter') sendMessage();
}

let currentDbRef = null;
function loadMessages(roomName) {
    const chatDisplay = document.getElementById('chat-messages');
    if (currentDbRef) currentDbRef.off();

    currentDbRef = db.ref(`rooms/${roomName}`).limitToLast(100);
    
    currentDbRef.once('value').then(() => {
        isInitialLoad = false;
    });

    currentDbRef.on('value', snapshot => {
        chatDisplay.innerHTML = "";
        let totalChildren = snapshot.numChildren();
        let counter = 0;

        snapshot.forEach(child => {
            const data = child.val();
            const isOwn = data.uid === currentUser.uid;
            const timeStr = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            counter++;

            chatDisplay.innerHTML += `
                <div class="msg-container ${isOwn ? 'own-msg' : ''}">
                    <div class="msg-info">
                        <span class="msg-sender">${isOwn ? 'You' : data.sender}</span>
                        <span class="msg-time">${timeStr}</span>
                    </div>
                    <div class="msg-bubble">${data.message}</div>
                </div>
            `;

            if (!isInitialLoad && counter === totalChildren && !isOwn) {
                playIncomingSound();
            }
        });
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    });
}

function initVoiceConference(roomName) {
    if (!currentUser) return;
    const secureRoomString = `${firebaseConfig.projectId}_voice_${roomName}_grid_session`;
    const voiceServerUrl = `https://meet.jit.si/${secureRoomString}#userInfo.displayName="${currentUser.displayName}"&config.prejoinPageEnabled=false&config.startWithVideoMuted=true&config.startWithAudioMuted=${isMuted}&config.videoQA.disabled=true&config.startAudioMuted=999`;
    const iframe = document.getElementById('jitsi-voice-frame');
    iframe.src = voiceServerUrl;
}
