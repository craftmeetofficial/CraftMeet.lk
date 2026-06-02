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

// Active Core State Auth Engine Listener Block
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

// FIXED: Native Pop-up Auth Handler Matrix to bypass Third Party Isolation Blockers
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
    .then(result => {
        console.log("Transmission Synchronized. Access Granted:", result.user.displayName);
    })
    .catch(err => {
        console.error("Authentication Core Error Exception:", err);
        alert("Transmission Fault: " + err.message + "\n\nTip: Ensure your Vercel URL domain is added to Firebase Auth Authorized Domains Panel.");
    });
}

function logout() {
    auth.signOut();
}

// Discord Style Active Counter Logic Array Structure
function setupOnlineCounter() {
    const onlineRef = db.ref('.info/connected');
    const userStatusRef = db.ref(`online_users/${currentUser.uid}`);

    onlineRef.on('value', snapshot => {
        if (snapshot.val() === false) return;
        userStatusRef.onDisconnect().remove().then(() => {
            userStatusRef.set({ name: currentUser.displayName, active: true });
        });
    });

    // Event listener array to stream aggregate data rows
    db.ref('online_users').on('value', snapshot => {
        const count = snapshot.numChildren() || 1;
        document.getElementById('online-count').innerText = count;
    });
}

// Interactive Realtime Auto Search Module for YouTubers Panel Grid
function searchYT(channelName) {
    const query = encodeURIComponent(channelName + " gaming youtube");
    const searchUrl = `https://www.youtube.com/results?search_query=${query}`;
    window.open(searchUrl, '_blank');
}

// Dynamic Tier Lock Protection Alert Execution Call
function triggerMembershipAlert() {
    alert("⚡ CRAFTMEET MULTIVERSE UPGRADE ⚡\n\nTo register custom YouTube channels or create persistent Private Channels, purchase the Elite Membership.\n\nFee: $2.00 USD / Month\nStatus: Stripe & Crypto payment gateway pending integration by Developer.");
}

// Global Client Application Router Navigation Matrix
function switchRoom(roomName) {
    currentRoom = roomName;
    document.querySelectorAll('.room-item').forEach(i => i.classList.remove('active'));
    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    }
    document.getElementById('current-room-title').innerText = `${roomName}-room`;
    loadMessages(roomName);
}

// Structural Instant Messaging System Logic Node
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

// Integrated Interactive Intercom Media Frame Stream Module
function initVideoConference() {
    const uniqueRoomName = `${firebaseConfig.projectId}_secure_hq_conference_room`;
    const jitsiServerUrl = `https://meet.jit.si/${uniqueRoomName}#userInfo.displayName="${currentUser.displayName}"&config.prejoinPageEnabled=false&config.startWithVideoMuted=true`;
    
    const iframe = document.getElementById('jitsi-conference-frame');
    iframe.src = jitsiServerUrl;
    iframe.onload = () => document.getElementById('video-loading').classList.add('hidden');
}