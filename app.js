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

// 3 Custom Core Avatar Decoration CSS Mapping Reference Arrays
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
        
        if (!avatarImg || !specialtyText) return; // Prevent Hydration / Timing Crashes

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

            // ANTI-SPAM CONTROL LOGIC
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

// REWARD CLAIM ALGORITHM WITH TIMESTAMP (FOR 7-DAY VALIDITY)
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

        // CARD VIEW MODAL - ANOTHER USER EXPIRY VERIFICATION ON DEMAND
        if (data.currentDecoration && data.currentDecoration !== "none" && data.decorationClaimedAt) {
            const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
            if (Date.now() - data.decorationClaimedAt > oneWeekInMs) {
                db.ref(`users/${targetUid}`).update({ currentDecoration: "none", decorationClaimedAt: 0 });
                data.currentDecoration = "none"; 
            }
        }

        const avatar = document.getElementById('view-
