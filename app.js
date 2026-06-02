// Firebase Configuration
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

// Initialize Firebase via Compat Mode
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let currentRoom = "global"; 

// Auth Tracker
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('user-display-name').innerText = user.displayName;
        document.getElementById('user-avatar').src = user.photoURL || 'https://via.placeholder.com/40';
        
        loadMessages(currentRoom);
        initVideoConference();
    } else {
        currentUser = null;
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('jitsi-conference-frame').src = "";
    }
});

// Secure Redirect Method
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithRedirect(provider).catch(error => {
        alert("System Error: " + error.message);
    });
}

function logout() {
    auth.signOut();
}

// Tactical Room Switcher
function switchRoom(roomName) {
    currentRoom = roomName;
    
    document.querySelectorAll('.room-item').forEach(item => item.classList.remove('active'));
    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    }
    
    document.getElementById('current-room-title').innerText = `${roomName}-chat`;
    loadMessages(roomName);
}

// Tactical Chat Message Sender
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
        
        snapshot.forEach(childSnapshot => {
            const data = childSnapshot.val();
            const isOwnMessage = data.uid === currentUser.uid;
            const timeString = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const msgHtml = `
                <div class="msg-container ${isOwnMessage ? 'own-msg' : ''}">
                    <div class="msg-info">
                        <span class="msg-sender">${isOwnMessage ? 'You' : data.sender}</span>
                        <span class="msg-time">${timeString}</span>
                    </div>
                    <div class="msg-bubble">${data.message}</div>
                </div>
            `;
            chatDisplay.innerHTML += msgHtml;
        });
        
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    });
}

// HD Secure Video Room
function initVideoConference() {
    const uniqueRoomName = `${firebaseConfig.projectId}_secure_hq_conference_room`;
    const jitsiServerUrl = `https://meet.jit.si/${uniqueRoomName}#userInfo.displayName="${currentUser.displayName}"&config.prejoinPageEnabled=false&config.startWithVideoMuted=true`;
    
    const iframe = document.getElementById('jitsi-conference-frame');
    iframe.src = jitsiServerUrl;
    
    iframe.onload = () => {
        document.getElementById('video-loading').classList.add('hidden');
    };
}