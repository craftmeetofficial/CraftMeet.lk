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
        auth.createUserWithEmailAndPassword(email, password).then(credential => {
            const user = credential.user;
            user.updateProfile({ displayName: username, photoURL: avatar || 'https://via.placeholder.com/40' }).then(() => {
                db.ref(`users/${user.uid}`).set({ name: username, profilePic: avatar || 'https://via.placeholder.com/40', bio: bio || "Hey there! I am using CraftMeet.", gameSpecialty: "Multi-Game Athlete", xp: 0, currentDecoration: "none", decorationClaimedAt: 0 })
                .then(() => { location.reload(); });
            });
        }).catch(err => alert("Registration Fault: " + err.message));
    } else {
        auth.signInWithEmailAndPassword(email, password).catch(err => alert("Login Fault: " + err.message));
    }
}

auth.getRedirectResult().then(result => {
    if (result && result.user) console.log("Google Redirect Logged In:", result.user.displayName);
}).catch(err => console.warn("Redirect Auth Info:", err.message));

auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        const authScreen = document.getElementById('auth-screen');
        const displayNameElem = document.getElementById('user-display-name');
        
        if (authScreen) authScreen.classList.add('hidden');
        if (displayNameElem) displayNameElem.innerText = user.displayName || "Gamer";
        
        syncUserProfileData(user);
        setupOnlineCounter();
        loadMessages(currentRoom);
        listenToTyping(currentRoom);
        initVoiceConference(currentRoom);
        loadPrivateRoomsList();
        setupLeaderboard();
    } else {
        currentUser = null;
        const authScreen = document.getElementById('auth-screen');
        const jitsiFrame = document.getElementById('jitsi-voice-frame');
        
        if (authScreen) authScreen.classList.remove('hidden');
        if (jitsiFrame) jitsiFrame.src = "";
    }
});

function syncUserProfileData(user) {
    const userRef = db.ref(`users/${user.uid}`);
    userRef.on('value', snapshot => {
        const data = snapshot.val();
        const avatarImg = document.getElementById('user-avatar');
        const specialtyText = document.getElementById('user-specialty');
        
        if (!avatarImg || !specialtyText) return; 

        if (data) {
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
            specialtyText.innerHTML = `<span class="dot-neon"></span> ${data.gameSpecialty || 'Multi-Game Athlete'}`;
            
            const footerFrame = document.getElementById('user-footer-deco-frame');
            if (footerFrame) {
                footerFrame.className = "deco-frame-container footer-avatar-frame"; 
                if(data.currentDecoration && data.currentDecoration !== "none"){
                    footerFrame.classList.add(data.currentDecoration);
                }
            }

            const picInput = document.getElementById('profile-pic-input');
            const bioInput = document.getElementById('profile-bio-input');
            const gameInput = document.getElementById('profile-game-input');
            const rewardModal = document.getElementById('reward-popup-modal');

            if (picInput) picInput.value = data.profilePic || '';
            if (bioInput) bioInput.value = data.bio || '';
            if (gameInput) gameInput.value = data.gameSpecialty || 'Multi-Game Athlete';

            if (rewardModal) {
                if (data.xp >= 500 && (!data.currentDecoration || data.currentDecoration === "none")) {
                    rewardModal.classList.remove('hidden');
                } else {
                    rewardModal.classList.add('hidden');
                }
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
            const rewardModal = document.getElementById('reward-popup-modal');
            if (rewardModal) rewardModal.classList.add('hidden');
            alert(`🎉 LEGENDARY CLAIM SUCCESSFUL!\n\nYou unlocked the [${randomDeco.replace('deco-', '').replace('-', ' ').toUpperCase()}] Avatar border!\n\n*Note: This decoration is valid for exactly 7 days!`);
        });
    });
}

function toggleProfileModal() { 
    const modal = document.getElementById('profile-modal');
    if (modal) modal.classList.toggle('hidden'); 
}

// Fixed Redirect Info
function loginWithGoogle() { 
    const provider = new firebase.auth.GoogleAuthProvider(); 
    auth.signInWithRedirect(provider).catch(err => console.error(err)); 
}

function saveUserProfile() {
    if (!currentUser) return;
    db.ref(`users/${currentUser.uid}`).update({
        profilePic: document.getElementById('profile-pic-input').value.trim() || currentUser.photoURL,
        bio: document.getElementById('profile-bio-input').value.trim(),
        gameSpecialty: document.getElementById('profile-game-input').value
    }).then(() => toggleProfileModal()).catch(err => alert(err.message));
}

function logout() { auth.signOut().then(() => location.reload()); }

function toggleUserCardModal() { 
    const modal = document.getElementById('user-card-modal');
    if (modal) modal.classList.toggle('hidden'); 
}

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

        document.getElementById('view-card-name').innerText = data.name || "Gamer Tag";
        document.getElementById('view-card-avatar').src = data.profilePic || 'https://via.placeholder.com/80';
        document.getElementById('view-card-game').innerText = data.gameSpecialty || "Multi-Game Athlete";
        document.getElementById('view-card-bio').innerText = data.bio || "No bio available.";
        
        const xpFill = document.getElementById('view-card-xp-fill');
        const xpText = document.getElementById('view-card-xp-text');
        if(xpFill && xpText) {
            const currentXp = data.xp || 0;
            const percentage = Math.min(100, (currentXp / 500) * 100);
            xpFill.style.width = `${percentage}%`;
            xpText.innerText = `${currentXp} / 500 XP`;
        }

        const cardDeco = document.getElementById('view-card-deco-frame');
        if(cardDeco) {
            cardDeco.className = "deco-frame-container";
            if(data.currentDecoration && data.currentDecoration !== "none") {
                cardDeco.classList.add(data.currentDecoration);
            }
        }

        const dmBtn = document.getElementById('view-card-dm-btn');
        if(dmBtn) {
            dmBtn.onclick = () => {
                toggleUserCardModal();
                startPrivateChat(targetUid);
            };
        }

        toggleUserCardModal();
    });
}

// CORE SYSTEMS
function setupOnlineCounter() {
    if (!currentUser) return;
    const onlineRef = db.ref(`online_users/${currentUser.uid}`);
    onlineRef.set({
        name: currentUser.displayName || "Gamer",
        lastActive: Date.now()
    });
    onlineRef.onDisconnect().remove();

    db.ref('online_users').on('value', snapshot => {
        const count = snapshot.numChildren() || 1;
        const countElem = document.getElementById('online-count');
        if (countElem) countElem.innerText = count;
    });
}

function loadMessages(roomName) {
    const chatDisplay = document.getElementById('chat-messages');
    if (!chatDisplay) return;

    db.ref(`messages/${roomName}`).off();
    chatDisplay.innerHTML = ""; 

    db.ref(`messages/${roomName}`).limitToLast(50).on('child_added', snapshot => {
        const msg = snapshot.val();
        if (!msg) return;

        const msgId = snapshot.key;
        const isMyMsg = msg.senderUid === currentUser?.uid;
        
        // 🗑️ Delete Button Structure matched with exact inline styling to not break the look
        const deleteBtnHtml = isMyMsg ? `<i class="fa-solid fa-trash" onclick="deleteMessage('${roomName}', '${msgId}')" style="color: #ff4d4d; margin-left: auto; padding-left:10px; cursor: pointer; font-size: 12px;" title="Delete Message"></i>` : "";

        const msgHtml = `
            <div class="message-row" id="msg-${msgId}" style="display: flex; align-items: baseline; width: 100%;">
                <div class="message-user-wrap" onclick="viewUserProfileCard('${msg.senderUid}')" style="cursor:pointer;">
                    <strong style="color: #00ffcc;">[${msg.senderName}]</strong>
                </div>
                <div class="message-content-text" style="color: #fff; margin-left: 10px; word-break: break-word; flex-grow: 1;">
                    ${msg.text}
                </div>
                ${deleteBtnHtml}
            </div>
        `;
        
        chatDisplay.innerHTML += msgHtml;
        chatDisplay.scrollTop = chatDisplay.scrollHeight; 

        if (!isInitialLoad && msg.senderUid !== currentUser?.uid) {
            playIncomingSound();
        }
    });

    db.ref(`messages/${roomName}`).on('child_removed', snapshot => {
        const deletedMsgElem = document.getElementById(`msg-${snapshot.key}`);
        if (deletedMsgElem) deletedMsgElem.remove();
    });

    db.ref(`messages/${roomName}`).once('value', () => {
        isInitialLoad = false;
    });
}

function deleteMessage(roomName, msgId) {
    if (confirm("Are you sure you want to delete this message?")) {
        db.ref(`messages/${roomName}/${msgId}`).remove()
            .catch(err => console.error("Error deleting message:", err));
    }
}

function sendMessage() {
    const input = document.getElementById('message-input');
    if (!input || !currentUser) return;

    const textStr = input.value.trim();
    if (textStr === "") return;

    const msgData = {
        senderUid: currentUser.uid,
        senderName: currentUser.displayName || "Gamer",
        text: textStr,
        timestamp: Date.now()
    };

    db.ref(`messages/${currentRoom}`).push(msgData).then(() => {
        input.value = ""; 
        input.focus();

        db.ref(`users/${currentUser.uid}/xp`).transaction(currentXp => {
            return (currentXp || 0) + 10;
        });
    }).catch(err => console.error("Message Send Error:", err));
}

function switchRoom(roomName) {
    if (currentRoom === roomName) return;
    
    document.getElementById(`room-${currentRoom}`)?.classList.remove('active');
    document.getElementById(`room-${roomName}`)?.classList.add('active');
    
    document.getElementById(`dm-${currentRoom}`)?.classList.remove('active');
    document.getElementById(`dm-${roomName}`)?.classList.add('active');

    currentRoom = roomName;
    isInitialLoad = true; 

    const roomTitle = document.getElementById('current-room-title');
    if (roomTitle) {
        roomTitle.innerText = roomName.startsWith('dm-') ? `🔒 private-chat` : `${roomName}-chat`;
    }

    loadMessages(roomName);
    listenToTyping(roomName);
    initVoiceConference(roomName);
}

function handleTyping() {
    if (!currentUser) return;
    
    db.ref(`typing/${currentRoom}/${currentUser.uid}`).set({
        name: currentUser.displayName || "Gamer",
        isTyping: true
    });

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        db.ref(`typing/${currentRoom}/${currentUser.uid}`).remove();
    }, 2000);
}

function listenToTyping(roomName) {
    const indicator = document.getElementById('typing-indicator');
    const typingUserText = document.getElementById('typing-user');
    if (!indicator || !typingUserText) return;

    db.ref(`typing/${roomName}`).on('value', snapshot => {
        const data = snapshot.val();
        let typers = [];

        if (data) {
            Object.keys(data).forEach(uid => {
                if (uid !== currentUser?.uid && data[uid].isTyping) {
                    typers.push(data[uid].name);
                }
            });
        }

        if (typers.length > 0) {
            typingUserText.innerText = typers.join(', ');
            indicator.classList.remove('hidden');
        } else {
            indicator.classList.add('hidden');
        }
    });
}

function startPrivateChat(targetUid) {
    if (!currentUser) return;
    if (currentUser.uid === targetUid) { alert("You cannot start a DM with yourself!"); return; }

    const dmRoomId = currentUser.uid < targetUid ? `dm-${currentUser.uid}-${targetUid}` : `dm-${targetUid}-${currentUser.uid}`;

    db.ref(`users/${currentUser.uid}/private_rooms/${dmRoomId}`).set({ targetUid: targetUid });
    db.ref(`users/${targetUid}/private_rooms/${dmRoomId}`).set({ targetUid: currentUser.uid });

    setTimeout(() => { switchRoom(dmRoomId); }, 300);
}

function loadPrivateRoomsList() {
    if (!currentUser) return;
    const dmListContainer = document.getElementById('private-rooms-list');
    if (!dmListContainer) return;

    db.ref(`users/${currentUser.uid}/private_rooms`).on('value', snapshot => {
        dmListContainer.innerHTML = "";
        const rooms = snapshot.val();

        if (!rooms) {
            dmListContainer.innerHTML = `<li class="no-dm-notice" style="padding: 10px; color:#666; font-size:12px;">No active DMs</li>`;
            return;
        }

        Object.keys(rooms).forEach(roomId => {
            const targetUid = rooms[roomId].targetUid;
            
            db.ref(`users/${targetUid}/name`).once('value').then(nameSnapshot => {
                const targetName = nameSnapshot.val() || "Unknown Gamer";
                const isActive = currentRoom === roomId ? "active" : "";

                const liHtml = `
                    <li class="room-item ${isActive}" id="dm-${roomId}" onclick="switchRoom('${roomId}')">
                        <i class="fa-solid fa-lock" style="color: #ff007f;"></i> <span>${targetName}</span>
                    </li>
                `;
                dmListContainer.innerHTML += liHtml;
            });
        });
    });
}

function setupLeaderboard() {
    const leaderboardContainer = document.getElementById('live-leaderboard-list');
    if (!leaderboardContainer) return;

    db.ref('users').orderByChild('xp').limitToLast(5).on('value', snapshot => {
        leaderboardContainer.innerHTML = "";
        let gamers = [];

        snapshot.forEach(childSnapshot => {
            gamers.push({
                uid: childSnapshot.key,
                ...childSnapshot.val()
            });
        });

        gamers.reverse();

        if (gamers.length === 0) {
            leaderboardContainer.innerHTML = `<li style="color: #666; font-size: 12px; padding: 10px;">No rankings</li>`;
            return;
        }

        gamers.forEach((gamer, index) => {
            let rankBadge = `<span style="color: #888; margin-right: 5px;">#${index + 1}</span>`;
            if (index === 0) rankBadge = `🥇 `;
            if (index === 1) rankBadge = `🥈 `;
            if (index === 2) rankBadge = `🥉 `;

            // Uses your exact layout rules (.room-item style) dynamically
            const liHtml = `
                <li class="room-item" onclick="viewUserProfileCard('${gamer.uid}')" style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        ${rankBadge} ${gamer.name || 'Gamer'}
                    </span>
                    <span style="color: #00ffcc; font-size: 11px; font-weight: bold;">${gamer.xp || 0}xp</span>
                </li>
            `;
            leaderboardContainer.innerHTML += liHtml;
        });
    });
}

function searchYT(query) { window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank'); }
function triggerMembershipAlert() { alert("🚀 CraftMeet PRO Membership Node coming soon!\n\nSoon you will be able to feature your YouTube channel here for $2/mo."); }
function checkEnter(e) { if(e.key === 'Enter') sendMessage(); }

// JITSI VOICE CHAT INTEGRATION
function initVoiceConference(roomName) {
    const jitsiFrame = document.getElementById('jitsi-voice-frame');
    if (!jitsiFrame) return;
    const secureRoomId = `craftmeet-${roomName}-voice-v1`;
    jitsiFrame.src = `https://meet.jit.si/${secureRoomId}#config.startWithVideoMuted=true&config.startWithAudioMuted=false&config.prejoinPageEnabled=false`;
}

function toggleVoiceMute() {
    const muteBtn = document.getElementById('comms-mute-btn');
    const icon = document.getElementById('mute-btn-icon');
    const text = document.getElementById('mute-btn-text');
    
    isMuted = !isMuted;
    if (isMuted) {
        muteBtn.className = "comms-mute-btn muted";
        icon.className = "fa-solid fa-microphone-slash";
        text.innerText = "UNMUTE MIC";
    } else {
        muteBtn.className = "comms-mute-btn unmuted";
        icon.className = "fa-solid fa-microphone-lines";
        text.innerText = "MUTE MIC";
    }
}

// EMOJI BUTTON SYSTEM INITIALIZATION
window.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('message-input');
    const triggerBtn = document.getElementById('emoji-trigger-btn');
    
    if (typeof EmojiButton !== 'undefined' && input && triggerBtn) {
        const picker = new EmojiButton({
            theme: 'dark',
            autoHide: true,
            position: 'top-start'
        });

        picker.on('emoji', selection => {
            input.value += selection.emoji;
            input.focus(); 
        });

        triggerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            picker.togglePicker(triggerBtn);
        });
    }
});
