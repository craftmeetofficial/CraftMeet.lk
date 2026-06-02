// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

let currentUser = null;
let currentRoom = "global"; // Default Chat Room

// 1. Auth Status Control
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

// Google Login Function
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(error => {
        alert("Authentication Failed: " + error.message);
    });
}

// Logout Function
function logout() {
    auth.signOut();
}

// 2. Chat Room Switching Feature
function switchRoom(roomName) {
    currentRoom = roomName;
    
    // Update active class on Sidebar UI
    document.querySelectorAll('.room-item').forEach(item => item.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    // Update Top Title Bar
    document.getElementById('current-room-title').innerHTML = `<i class="fa-solid fa-hashtag"></i> ${roomName}-chat`;
    
    // Reload Database listener for new room
    loadMessages(roomName);
}

// 3. Send Message to Realtime Database
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

// 4. Listen & Load Messages Dynamically
let currentDbRef = null;
function loadMessages(roomName) {
    const chatDisplay = document.getElementById('chat-messages');
    
    // Turn off old listener if exists
    if (currentDbRef) currentDbRef.off();

    currentDbRef = db.ref(`rooms/${roomName}`).limitToLast(100);
    
    currentDbRef.on('value', snapshot => {
        chatDisplay.innerHTML = "";
        
        snapshot.forEach(childSnapshot => {
            const data = childSnapshot.val();
            const isOwnMessage = data.uid === currentUser.uid;
            
            // Format Timestamp to Time String
            const timeString = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const msgHtml = `
                <div class="msg-bubble ${isOwnMessage ? 'own-msg' : ''}">
                    <div class="msg-header">
                        <span class="msg-sender">${isOwnMessage ? 'You' : data.sender}</span>
                        <span class="msg-time">${timeString}</span>
                    </div>
                    <div class="msg-text">${data.message}</div>
                </div>
            `;
            chatDisplay.innerHTML += msgHtml;
        });
        
        // Auto Scroll to Bottom
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    });
}

// 5. Connect Secure & Free Open-source Video Conference (Jitsi Meet)
function initVideoConference() {
    // Unique secure room name using Project ID so others can't randomly join
    const uniqueRoomName = `${firebaseConfig.projectId}_secure_hq_conference_room`;
    
    // Injecting Jitsi API into the Iframe
    const jitsiServerUrl = `https://meet.jit.si/${uniqueRoomName}#userInfo.displayName="${currentUser.displayName}"&config.prejoinPageEnabled=false&config.startWithVideoMuted=true`;
    
    document.getElementById('jitsi-conference-frame').src = jitsiServerUrl;
}