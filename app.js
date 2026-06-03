// Firebase Live Config Matrix
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
    const username = document.getElementById('auth-username').value.trim(), bio = document.getElementById('auth-bio').value.trim();
    const fileInput = document.getElementById('auth-avatar-file'); 

    if (!email || !password) { alert("Please fill in all required fields."); return; }

    if (isRegisterMode) {
        if (!username) { alert("Please choose a Gamertag/Username."); return; }
        
        auth.createUserWithEmailAndPassword(email, password).then(credential => {
            const user = credential.user;
            const defaultAvatar = 'https://via.placeholder.com/40';

            // IMAGE UPLOAD SYSTEM FOR SIGNUP
            if (fileInput && fileInput.files[0]) {
                const file = fileInput.files[0];
                const storageRef = storage.ref(`avatars/${user.uid}_${Date.now()}_${file.name}`);
                
                storageRef.put(file).then(snapshot => {
                    snapshot.ref.getDownloadURL().then(downloadURL => {
                        completeRegistration(user, username, downloadURL, bio);
                    });
                }).catch(err => {
                    console.error("Signup image upload failed, using default", err);
                    completeRegistration(user, username, defaultAvatar, bio);
                });
            } else {
                completeRegistration(user, username, defaultAvatar, bio);
            }
        }).catch(err => alert("Registration Fault: " + err.message));
    } else {
        auth.signInWithEmailAndPassword(email, password).catch(err => alert("Login Fault: " + err.message));
    }
}

function completeRegistration(user, username, avatarUrl, bio) {
    user.updateProfile({ displayName: username, photoURL: avatarUrl }).then(() => {
        db.ref(`users/${user.uid}`).set({ 
            name: username, 
            profilePic: avatarUrl, 
            bio: bio || "Hey there! I am using CraftMeet.", 
            gameSpecialty: "Multi-Game Athlete", 
            xp: 0, 
            currentDecoration: "none", 
            decorationClaimedAt: 0 
        }).then(() => { location.reload(); });
    });
}

auth.getRedirectResult().then(result => {
    if (result && result.user) console.log("Google Redirect Logged In:", result.user.displayName);
}).catch(err => console.warn("Redirect Auth Info:", err.message));

auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('user-display-name').innerText = user.displayName || "Gamer";
        
        syncUserProfileData(user);
        setupOnlineCounter();
        loadMessages(currentRoom);
        listenToTyping(currentRoom);
        loadPrivateRoomsList();
    } else {
        currentUser = null;
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('jitsi-voice-frame').src = "";
    }
});

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
                    db.ref(`users/${user.uid}`).update({ currentDecoration: "none", decorationClaimedAt: 0 });
                    alert("⏰ YOUR DECORATION EXPIRED!\n\nYour 7-day avatar decoration frame time has ended. Keep chatting to earn more XP and unlock it again!");
                    return; 
                }
            }

            avatarImg.src = data.profilePic || user.photoURL || 'https://via.placeholder.com/40';
            specialtyText.innerHTML = `<span class="dot-neon"></span> ${data.gameSpecialty || 'Multi-Game Athlete'}`;
            
            const footerFrame = document.getElementById('user-footer-deco-frame');
            footerFrame.className = "deco-frame-container footer-avatar-frame"; 
            if(data.currentDecoration && data.currentDecoration !== "none"){
                footerFrame.classList.add(data.currentDecoration);
            }

            document.getElementById('profile-bio-input').value = data.bio || '';
            document.getElementById('profile-game-input').value = data.gameSpecialty || 'Multi-Game Athlete';

            // ANTI-SPAM CONTROL LOGIC:
            if (data.xp >= 500 && (!data.currentDecoration || data.currentDecoration === "none")) {
                document.getElementById('reward-popup-modal').classList.remove('hidden');
            } else {
                document.getElementById('reward-popup-modal').classList.add('hidden');
            }
        } else {
            const defaultName = user.displayName || "Gamer", defaultAvatar = user.photoURL || 'https://via.placeholder.com/40';
            userRef.set({ name: defaultName, profilePic: defaultAvatar, bio: "Hey there! I am using CraftMeet.", gameSpecialty: "Multi-Game Athlete", xp: 0, currentDecoration: "none", decorationClaimedAt: 0 });
            avatarImg.src = defaultAvatar; specialtyText.innerHTML = `<span class="dot-neon"></span> Multi-Game Athlete`;
        }
    });
}

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
function loginWithGoogle() { const provider = new firebase.auth.GoogleAuthProvider(); auth.signInWithRedirect(provider).catch(err => console.error(err)); }

// IMAGE UPLOAD PROCESS FOR SETTINGS INTERFACE
function saveUserProfile() {
    if (!currentUser) return;
    
    const fileInput = document.getElementById('profile-pic-file');
    const bioValue = document.getElementById('profile-bio-input').value.trim();
    const gameValue = document.getElementById('profile-game-input').value;
    
    const saveBtn = document.querySelector("#profile-modal button[onclick='saveUserProfile()']");
    if(saveBtn) saveBtn.innerText = "Uploading Image...";

    if (fileInput && fileInput.files[0]) {
        const file = fileInput.files[0];
        const storageRef = storage.ref(`avatars/${currentUser.uid}_${Date.now()}_${file.name}`);
        
        storageRef.put(file).then(snapshot => {
            snapshot.ref.getDownloadURL().then(downloadURL => {
                updateDatabaseProfile(downloadURL, bioValue, gameValue, saveBtn);
            });
        }).catch(err => {
            alert("Image Upload Failed: " + err.message);
            if(saveBtn) saveBtn.innerText = "Save Changes";
        });
    } else {
        db.ref(`users/${currentUser.uid}/profilePic`).once('value').then(snap => {
            updateDatabaseProfile(snap.val() || currentUser.photoURL, bioValue, gameValue, saveBtn);
        });
    }
}

function updateDatabaseProfile(picUrl, bio, game, buttonEl) {
    db.ref(`users/${currentUser.uid}`).update({
        profilePic: picUrl,
        bio: bio,
        gameSpecialty: game
    }).then(() => {
        if(buttonEl) buttonEl.innerText = "Save Changes";
        toggleProfileModal();
    }).catch(err => {
        alert(err.message);
        if(buttonEl) buttonEl.innerText = "Save Changes";
    });
}

function logout() { auth.signOut().then(() => location.reload()); }
function toggleUserCardModal() { document.getElementById('user-card-modal').classList.toggle('hidden'); }

function viewUserProfileCard(targetUid) {
    if (!currentUser) return;
    db.ref(`users/${targetUid}`).once('value').then(snapshot => {
        const data = snapshot.val();
        if (!data) return;

        // USER DECORATION ON-DEMAND TIME VERIFICATION
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
        
        const userXp = data.xp || 0;
        const barPercent = Math.min(100, (userXp / 500) * 100);
        document.getElementById('view-card-xp-fill').style.width = `${barPercent}%`;
        document.getElementById('view-card-xp-text').innerText = `${userXp} / 500 XP`;

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

function initiatePrivateDM(targetUid, targetName) {
    toggleUserCardModal();
    const dmRoomId = currentUser.uid < targetUid ? `dm_${currentUser.uid}_${targetUid}` : `dm_${targetUid}_${currentUser.uid}`;
    db.ref(`users/${currentUser.uid}/active_dms/${dmRoomId}`).set({ roomName: targetName, targetId: targetUid });
    db.ref(`users/${targetUid}/active_dms/${dmRoomId}`).set({ roomName: currentUser.displayName, targetId: currentUser.uid });
    switchRoom(dmRoomId);
}

function loadPrivateRoomsList() {
    if (!currentUser) return;
    db.ref(`users/${currentUser.uid}/active_dms`).on('value', snapshot => {
        const dmList = document.getElementById('private-rooms-list');
        dmList.innerHTML = "";
        if (!snapshot.exists()) {
            dmList.innerHTML = '<li class="no-dm-notice" style="padding:10px 20px; font-size:13px; color:#52527a;">No active DMs</li>';
            return;
        }
        snapshot.forEach(child => {
            const roomId = child.key; const dmData = child.val();
            const isActive = currentRoom === roomId ? 'active' : '';
            dmList.innerHTML += `
                <li class="room-item priv-item ${isActive}" id="room-${roomId}" onclick="switchRoom('${roomId}')">
                    <i class="fa-solid fa-comment-medical" style="color: var(--neon-magenta);"></i> <span>${dmData.roomName.toLowerCase()}</span>
                </li>
            `;
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
    if (!currentUser) return;
    db.ref(`typing/${currentRoom}/${currentUser.uid}`).set({ name: currentUser.displayName, typing: true });
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

function switchRoom(roomName) {
    if (currentUser) db.ref(`typing/${currentRoom}/${currentUser.uid}`).remove();
    currentRoom = roomName; isInitialLoad = true;
    document.querySelectorAll('.room-item').forEach(i => i.classList.remove('active'));
    
    const activeTarget = document.getElementById(`room-${roomName}`);
    if (activeTarget) activeTarget.classList.add('active');
    
    const isDM = roomName.startsWith('dm_');
    const visualTitle = isDM ? "private-direct-chat" : roomName.replace('-', ' ') + "-chat";
    document.getElementById('current-room-title').innerText = visualTitle;
    loadMessages(roomName); listenToTyping(roomName);
}

function sendMessage() {
    const input = document.getElementById('message-input'), text = input.value.trim(); if (text === "" || !currentUser) return;
    
    const gainedXp = text.length > 25 ? 10 : 5;
    db.ref(`rooms/${currentRoom}`).push({ uid: currentUser.uid, sender: currentUser.displayName, message: text, timestamp: Date.now() });
    
    const userXpRef = db.ref(`users/${currentUser.uid}/xp`);
    userXpRef.transaction(currentValue => {
        return (currentValue || 0) + gainedXp;
    });

    db.ref(`typing/${currentRoom}/${currentUser.uid}`).remove(); input.value = "";
}
function checkEnter(e) { if (e.key === 'Enter') sendMessage(); }

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
            const timeStr = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            counter++;
            
            // USER CLICK ACTION INTERFACE RE-ENGINEERED
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
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    });
}
