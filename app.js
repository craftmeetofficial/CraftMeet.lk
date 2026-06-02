// Firebase Live Configuration
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

// Initialize Compat Engine Matrix
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let currentRoom = "global"; 

// Active Authentication Core Node Tracker
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('user-display-name').innerText = user.displayName;
        document.getElementById('user-avatar').src = user.photoURL || 'https://via.placeholder.com/40';
        
        setupOnlineCounter();
        loadMessages(currentRoom);
        initVideoConference();
    } else {
        currentUser = null;
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('jitsi-conference-frame').src = "";
    }
});

// Secure Redirection Routine to Prevent Overlap Popup Crashes
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithRedirect(provider).catch(err => alert("Transmission Fault: " + err.message));
}

function logout() {
    auth.signOut();
}

// Real-Time Online Users Engine Array Logic
function setupOnlineCounter() {
    const onlineRef = db.ref('.info/connected');
    const userStatusRef = db.ref(`online_users/${currentUser.uid}`);

    onlineRef.on('value', snapshot => {
        if (snapshot.val() === false) return;
        userStatusRef.onDisconnect().remove().then(() => {
            userStatusRef.set({ name: currentUser.displayName, active: true });
        });
    });

    // Sync total online count loop node
    db.ref('online_users').on('value', snapshot => {
        const count = snapshot.numChildren() || 1;
        document.getElementById('online-count').innerText = count;
    });
}

// Auto Search Trigger Action Logic for Youtubers Box
function searchYT(channelName) {
    const query = encodeURIComponent(channelName + " gaming youtube");
    const searchUrl = `https://www.youtube.com/results?search_query=${query}`;
    window.open(searchUrl, '_blank');
}

// Locked Membership Tier Notice Handler Call
function triggerMembershipAlert() {
    alert("⚡ CRAFTMEET MULTIVERSE UPGRADE ⚡\n\nTo register custom YouTube channels or create persistent Private Channels, purchase the Elite Membership.\n\nFee: $2.00 USD / Month\nStatus: payment gateway pending integration by Developer.");
}

// Dynamic Room Router Segment
function switchRoom(roomName) {
    currentRoom = roomName;
    document.querySelectorAll('.room-item').forEach(i => i.classList.remove('active'));
    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    }
    document.getElementById('current-room-title').innerText = `${roomName}-room`;
    loadMessages(roomName);
}

// Instant Messaging Module
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
    currentDbRef.on('value', snapshot => {
        chatDisplay.innerHTML = "";
        snapshot.forEach(child => {
            const data = child.val();
            const isOwn = data.uid === currentUser.uid;
            const timeStr = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            chatDisplay.innerHTML += `
                <div class="msg-container ${isOwn ? 'own-msg' : ''}">
                    <div class="msg-info">
                        <span class="msg-sender">${isOwn ? 'You' : data.sender}</span>
                        <span class="msg-time">${timeStr}</span>
                    </div>
                    <div class="msg-bubble">${data.message}</div>
                </div>
            `;
        });
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    });
}

// Interactive Realtime Stream Module
function initVideoConference() {
    const uniqueRoomName = `${firebaseConfig.projectId}_secure_hq_conference_room`;
    const jitsiServerUrl = `https://meet.jit.si/${uniqueRoomName}#userInfo.displayName="${currentUser.displayName}"&config.prejoinPageEnabled=false&config.startWithVideoMuted=true`;
    
    const iframe = document.getElementById('jitsi-conference-frame');
    iframe.src = jitsiServerUrl;
    iframe.onload = () => document.getElementById('video-loading').classList.add('hidden');
}
