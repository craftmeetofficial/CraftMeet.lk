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
    } catch (e) { }
}

function toggleAuthMode(e) {
    e.preventDefault();
    isRegisterMode = !isRegisterMode;
    const title = document.getElementById('auth-title'), subtitle = document.getElementById('auth-subtitle');
    const mainBtn = document.getElementById('main-auth-btn'), switchLink = document.getElementById('switch-auth-link'), switchText = document.getElementById('switch-text');
    const usernameGroup = document.getElementById('reg-username-group'), regExtras = document.getElementById('reg-extras');

    if (isRegisterMode) {
        title.innerText = "CREATE AN ACCOUNT"; subtitle.innerText = "Join CraftMeet today!";
        mainBtn.innerText = "Register"; switchText.innerText = "Already have an account?"; switchLink.innerText = "Log In";
        usernameGroup.style.display = "block"; regExtras.style.display = "block";
    } else {
        title.innerText = "WELCOME BACK!"; subtitle.innerText = "We're so excited to see you again!";
        mainBtn.innerText = "Log In"; switchText.innerText = "Need an account?"; switchLink.innerText = "Register";
        usernameGroup.style.display = "none"; regExtras.style.display = "none";
    }
}

function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => alert(err.message));
}

function handlePrimaryAuth() {
    const email = document.getElementById('auth-email').value.trim(), password = document.getElementById('auth-password').value;
    const username = document.getElementById('auth-username').value.trim();
    const bio = document.getElementById('auth-bio').value.trim() || "Hey there! I am using CraftMeet.";
    const avatarFileInput = document.getElementById('auth-avatar-file');

    if (!email || !password) { alert("Please fill fields."); return; }

    if (isRegisterMode) {
        if (!username) { alert("Please choose a Username."); return; }
        auth.createUserWithEmailAndPassword(email, password).then(async (credential) => {
            const user = credential.user;
            let photoURL = 'https://via.placeholder.com/40';

            if (avatarFileInput && avatarFileInput.files[0]) {
                try {
                    const storageRef = storage.ref(`avatars/${user.uid}`);
                    const snapshot = await storageRef.put(avatarFileInput.files[0]);
                    photoURL = await snapshot.ref.getDownloadURL();
                } catch(e) { }
            }

            await user.updateProfile({ displayName: username, photoURL: photoURL });
            await db.ref(`users/${user.uid}`).set({
                name: username, profilePic: photoURL, bio: bio, gameSpecialty: "Multi-Game Athlete",
                xp: 0, level: 1, currentDecoration: "none", decorationClaimedAt: 0
            });
            location.reload();
        }).catch(err => alert(err.message));
    } else {
        auth.signInWithEmailAndPassword(email, password).catch(err => alert(err.message));
    }
}

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

function syncUserProfileData(user) {
    db.ref(`users/${user.uid}`).on('value', snapshot => {
        const data = snapshot.val(), avatarImg = document.getElementById('user-avatar'), specialtyText = document.getElementById('user-specialty');
        if (data) {
            if (data.currentDecoration && data.currentDecoration !== "none" && data.decorationClaimedAt) {
                if (Date.now() - data.decorationClaimedAt > 7 * 24 * 60 * 60 * 1000) {
                    db.ref(`users/${user.uid}`).update({ currentDecoration: "none", decorationClaimedAt: 0 });
                    return;
                }
            }
            avatarImg.src = data.profilePic || 'https://via.placeholder.com/40';
            let currentLvl = data.level || 1;
            let currentXp = data.xp || 0;
            let nextLevelXp = currentLvl * 500;
            specialtyText.innerHTML = `<span class="dot-neon"></span> Lvl ${currentLvl} (${currentXp}/${nextLevelXp} XP)`;
            
            const footerFrame = document.getElementById('user-footer-deco-frame');
            footerFrame.className = "deco-frame-container footer-avatar-frame"; 
            if(data.currentDecoration && data.currentDecoration !== "none") footerFrame.classList.add(data.currentDecoration);

            if (data.xp >= 500 && (!data.currentDecoration || data.currentDecoration === "none")) {
                document.getElementById('reward-popup-modal').classList.remove('hidden');
            } else {
                document.getElementById('reward-popup-modal').classList.add('hidden');
            }
        }
    });
}

function claimAvatarDecoration() {
    if (!currentUser) return;
    const randomDeco = decorationsList[Math.floor(Math.random() * decorationsList.length)];
    db.ref(`users/${currentUser.uid}`).once('value').then(snapshot => {
        const currentXp = snapshot.val().xp || 0;
        db.ref(`users/${currentUser.uid}`).update({
            xp: Math.max(0, currentXp - 500),
            currentDecoration: randomDeco,
            decorationClaimedAt: Date.now() 
        });
    });
}

function toggleProfileModal() { document.getElementById('profile-modal').classList.toggle('hidden'); }

async function saveUserProfile() {
    if (!currentUser) return;
    const fileInput = document.getElementById('profile-pic-file');
    let profilePicUrl = currentUser.photoURL || 'https://via.placeholder.com/40';

    if(fileInput && fileInput.files[0]) {
        try {
            const snap = await storage.ref(`avatars/${currentUser.uid}`).put(fileInput.files[0]);
            profilePicUrl = await snap.ref.getDownloadURL();
        } catch(e) { }
    }

    db.ref(`users/${currentUser.uid}`).update({
        profilePic: profilePicUrl,
        bio: document.getElementById('profile-bio-input').value.trim(),
        gameSpecialty: document.getElementById('profile-game-input').value
    }).then(() => toggleProfileModal());
}

function logout() { auth.signOut().then(() => location.reload()); }
function toggleUserCardModal() { document.getElementById('user-card-modal').classList.toggle('hidden'); }

function viewUserProfileCard(targetUid) {
    db.ref(`users/${targetUid}`).once('value').then(snapshot => {
        const data = snapshot.val(); if (!data) return;
        document.getElementById('view-card-avatar').src = data.profilePic || 'https://via.placeholder.com/80';
        document.getElementById('view-card-name').innerText = data.name || 'Gamer';
        document.getElementById('view-card-game').innerText = data.gameSpecialty || 'Multi-Game Athlete';
        document.getElementById('view-card-bio').innerText = data.bio || 'No bio.';
        
        let level = data.level || 1, userXp = data.xp || 0, targetXP = level * 500;
        document.getElementById('view-card-xp-fill').style.width = `${Math.min(100, (userXp / targetXP) * 100)}%`;
        document.getElementById('view-card-xp-text').innerText = `${userXp} / ${targetXP} XP`;

        const cardFrame = document.getElementById('view-card-deco-frame');
        cardFrame.className = "deco-frame-container";
        if(data.currentDecoration && data.currentDecoration !== "none") cardFrame.classList.add(data.currentDecoration);

        const dmBtn = document.getElementById('view-card-dm-btn');
        if (targetUid === currentUser.uid) dmBtn.style.display = "none";
        else {
            dmBtn.style.display = "flex";
            dmBtn.onclick = function() {
                toggleUserCardModal();
                const dmRoomId = currentUser.uid < targetUid ? `dm_${currentUser.uid}_${targetUid}` : `dm_${targetUid}_${currentUser.uid}`;
                db.ref(`users/${currentUser.uid}/active_dms/${dmRoomId}`).set({ roomName: data.name, targetId: targetUid });
                db.ref(`users/${targetUid}/active_dms/${dmRoomId}`).set({ roomName: currentUser.displayName, targetId: currentUser.uid });
                switchRoom(dmRoomId);
            };
        }
        toggleUserCardModal();
    });
}

function loadPrivateRoomsList() {
    db.ref(`users/${currentUser.uid}/active_dms`).on('value', snapshot => {
        const dmList = document.getElementById('private-rooms-list'); dmList.innerHTML = "";
        if (!snapshot.exists()) { dmList.innerHTML = '<li class="no-dm-notice">No active DMs</li>'; return; }
        snapshot.forEach(child => {
            dmList.innerHTML += `<li class="room-item ${currentRoom === child.key ? 'active' : ''}" id="room-${child.key}" onclick="switchRoom('${child.key}')"><i class="fa-solid fa-comment-medical"></i> ${child.val().roomName.toLowerCase()}</li>`;
        });
    });
}

function setupOnlineCounter() {
    db.ref('.info/connected').on('value', snap => {
        if (snap.val() === false) return;
        db.ref(`online_users/${currentUser.uid}`).onDisconnect().remove().then(() => {
            db.ref(`online_users/${currentUser.uid}`).set({ name: currentUser.displayName, active: true });
        });
    });
    db.ref('online_users').on('value', snap => { document.getElementById('online-count').innerText = snap.numChildren() || 1; });
}

function handleTyping() {
    db.ref(`typing/${currentRoom}/${currentUser.uid}`).set({ name: currentUser.displayName, typing: true });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => { db.ref(`typing/${currentRoom}/${currentUser.uid}`).remove(); }, 2000); 
}

function listenToTyping(roomName) {
    db.ref(`typing/${roomName}`).on('value', snapshot => {
        const typingBox = document.getElementById('typing-indicator');
        let typers = []; snapshot.forEach(child => { if (child.key !== currentUser.uid) typers.push(child.val().name); });
        if (typers.length > 0) { document.getElementById('typing-user').innerText = typers.join(', '); typingBox.classList.remove('hidden'); }
        else { typingBox.classList.add('hidden'); }
    });
}

function switchRoom(roomName) {
    if (currentUser) db.ref(`typing/${currentRoom}/${currentUser.uid}`).remove();
    currentRoom = roomName; isInitialLoad = true;
    document.querySelectorAll('.room-item').forEach(i => i.classList.remove('active'));
    if (document.getElementById(`room-${roomName}`)) document.getElementById(`room-${roomName}`).classList.add('active');
    document.getElementById('current-room-title').innerText = roomName.startsWith('dm_') ? "private-chat" : roomName + "-chat";
    loadMessages(roomName); listenToTyping(roomName); initVoiceConference(roomName);
}

function sendMessage() {
    const input = document.getElementById('message-input'), text = input.value.trim(); if (text === "" || !currentUser) return;
    db.ref(`rooms/${currentRoom}`).push({ uid: currentUser.uid, sender: currentUser.displayName, message: text, timestamp: Date.now() });
    
    db.ref(`users/${currentUser.uid}`).transaction(userData => {
        if (userData) {
            userData.xp = (userData.xp || 0) + (text.length > 25 ? 15 : 8);
            let currentLevel = userData.level || 1;
            if (userData.xp >= currentLevel * 500) {
                userData.level = currentLevel + 1;
                setTimeout(() => {
                    db.ref(`rooms/${currentRoom}`).push({ uid: "SYSTEM", sender: "[SYSTEM ALERT]", message: `🚀 CONGRATULATIONS! ${userData.name.toUpperCase()} just leveled up to LEVEL ${userData.level}! 🔥`, timestamp: Date.now() });
                }, 500);
            }
        }
        return userData;
    });
    input.value = "";
}

function checkEnter(e) { if (e.key === 'Enter') sendMessage(); }

let currentDbRef = null;
function loadMessages(roomName) {
    const chatDisplay = document.getElementById('chat-messages'); if (currentDbRef) currentDbRef.off();
    currentDbRef = db.ref(`rooms/${roomName}`).limitToLast(100);
    currentDbRef.once('value').then(() => { isInitialLoad = false; });
    currentDbRef.on('value', snapshot => {
        chatDisplay.innerHTML = "";
        snapshot.forEach(child => {
            const data = child.val();
            if(data.uid === "SYSTEM") {
                chatDisplay.innerHTML += `<div class="msg-container system-msg" style="text-align: center; width: 100%; margin: 8px 0;"><div class="msg-bubble" style="background: rgba(255, 0, 127, 0.15); color: #ff007f;">${data.message}</div></div>`;
            } else {
                chatDisplay.innerHTML += `<div class="msg-container ${data.uid === currentUser.uid ? 'own-msg' : ''}"><div class="msg-info"><span class="msg-sender" onclick="viewUserProfileCard('${data.uid}')">${data.uid === currentUser.uid ? 'You' : data.sender}</span></div><div class="msg-bubble">${data.message}</div></div>`;
            }
        });
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    });
}

function initVoiceConference(roomName) {
    if (!currentUser) return;
    document.getElementById('jitsi-voice-frame').src = `https://meet.jit.si/${firebaseConfig.projectId}_voice_${roomName}#userInfo.displayName="${currentUser.displayName}"&config.prejoinPageEnabled=false&config.startWithAudioMuted=${isMuted}`;
}
function toggleVoiceMute() { isMuted = !isMuted; switchRoom(currentRoom); }
function searchYT(name) { window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(name)}`, '_blank'); }
function triggerMembershipAlert() { alert("Premium Tier Only ($2/mo)"); }
