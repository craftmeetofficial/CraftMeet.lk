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

// Toggle between Sign In and Discord-Style Register Modes
function toggleAuthMode(e) {
    e.preventDefault();
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
        mainBtn.innerText = "Continue & Register";
        switchText.innerText = "Already have an account?";
        switchLink.innerText = "Log In";
        usernameGroup.style.display = "flex";
        regExtras.style.display = "block";
    } else {
        title.innerText = "WELCOME BACK!";
        subtitle.innerText = "We're so excited to see you again!";
        mainBtn.innerText = "Log In";
        switchText.innerText = "Need an account?";
        switchLink.innerText = "Register";
        usernameGroup.style.display = "none";
        regExtras.style.display = "none";
    }
}

// Primary Native Custom Form Trigger Engine
function handlePrimaryAuth() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const username = document.getElementById('auth-username').value.trim();
    const avatar = document.getElementById('auth-avatar').value.trim();
    const bio = document.getElementById('auth-bio').value.trim();

    if (!email || !password) {
        alert("Please fill in all required fields.");
        return;
    }

    if (isRegisterMode) {
        if (!username) { alert("Please choose a Gamertag/Username."); return; }
        
        auth.createUserWithEmailAndPassword(email, password).then(credential => {
            const user = credential.user;
            
            user.updateProfile({
                displayName: username,
                photoURL: avatar || 'https://via.placeholder.com/40'
            }).then(() => {
                db.ref(`users/${user.uid}`).set({
                    name: username,
                    profilePic: avatar || 'https://via.placeholder.com/40',
                    bio: bio || "Hey there! I am using CraftMeet.",
                    gameSpecialty: "Multi-Game Athlete"
                }).then(() => {
                    location.reload(); 
                });
            });
        }).catch(err => alert("Registration Fault: " + err.message));
    } else {
        auth.signInWithEmailAndPassword(email, password).catch(err => {
            alert("Login Fault: " + err.message);
        });
    }
}

// SAFE REDIRECT HANDLER (CLEANED)
auth.getRedirectResult().then(result => {
    if (result && result.user) {
        console.log("Google Redirect Login Successful:", result.user.displayName);
    }
}).catch(err => {
    // Alert කර කර කරදර කරන්නේ නැතුව Error එක background එකේ console එකට විතරක් යවනවා
    console.warn("Handled Redirect Auth Info:", err.message);
});

// Central Identity Matrix Core Synchronizer Listener Node
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
    } else {
        currentUser = null;
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('jitsi-voice-frame').src = "";
    }
});

// Sync Profile Database & Automatically Handle Google Account First Visits
function syncUserProfileData(user) {
    const userRef = db.ref(`users/${user.uid}`);
    
    userRef.on('value', snapshot => {
        const data = snapshot.val();
        const avatarImg = document.getElementById('user-avatar');
        const specialtyText = document.getElementById('user-specialty');

        if (data) {
            avatarImg.src = data.profilePic || user.photoURL || 'https://via.placeholder.com/40';
            specialtyText.innerHTML = `<span class="dot-neon">
