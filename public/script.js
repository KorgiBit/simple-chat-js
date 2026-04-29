let socket = null
let myName = ''

// Экраны
const loginScreen = document.getElementById('loginScreen')
const loginUsername = document.getElementById('loginUsername')
const loginPassword = document.getElementById('loginPassword')
const loginError = document.getElementById('loginError')
const loginButton = document.getElementById('loginButton')


const chatScreen = document.getElementById('chatScreen')

// чат
const messageInput = document.getElementById("messageInput")
const sendButton = document.getElementById("sendButton")
const messages = document.getElementById("messages")
const currentUser = document.getElementById("currentUser")
const onlineList = document.getElementById("onlineList")
const onlineCount = document.getElementById("onlineCount")

// регистрация и авторизация
const registerScreen = document.getElementById('registerScreen')
const regUsername = document.getElementById('regUsername')
const regPassword = document.getElementById('regPassword')
const regError = document.getElementById('regError')
const regSubmitButton = document.getElementById('regSubmitButton')
const goToRegisterButton = document.getElementById('goToRegisterButton')
const goToLoginButton = document.getElementById('goToLoginButton')
const logoutButton = document.getElementById('logoutButton')


function logout() {
    if (socket) {
        socket.disconnect()
        socket = null
    }
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    myName = ''
    currentUser.textContent = ''
    messages.innerHTML = ''
    onlineList.innerHTML = ''
    onlineCount.textContent = '0'
    chatScreen.classList.add('hidden')
    loginScreen.classList.remove('hidden')
    loginUsername.value = ''
    loginPassword.value = ''
    hideLoginError()
    loginUsername.focus()
}

async function login() {
    const username = loginUsername.value.trim()
    const password = loginPassword.value.trim()
    if (username === '' || password === '') {
        showLoginError('Пожалуйста, заполните все поля')
        return
    }
    const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    const data = await response.json()
    if (!data.ok) {
        showLoginError(data.error)
        return
    }

    localStorage.setItem('username', data.username)
    localStorage.setItem('token', data.token)
    myName = data.username
    connectSocket(data.token)

}

function connectSocket(token) {
    socket = io({
        auth: {token}
    })

    socket.on('connect', () => { 
        currentUser.textContent = myName
        loginScreen.classList.add('hidden')
        chatScreen.classList.remove('hidden')
        messageInput.focus()
    })

    socket.on('connect_error', (err) => {
        showLoginError(err.message)
        logout()
    })

    socket.on("chat message", (messageData) => {
        const item = document.createElement("li")
        item.textContent = messageData.user + ": " + messageData.text
        if (messageData.senderId === socket.id) {
            item.classList.add('my-message')
        } else{ 
            item.classList.add('other-message')
        }
        messages.appendChild(item)
    })
    socket.on("chat history", (history) => {
        messages.innerHTML = ""
        history.forEach(messageData => {
            const item = document.createElement("li")
            item.textContent = messageData.user + ": " + messageData.text
            if (messageData.user === myName) {
                item.classList.add('my-message')
            } else{
                item.classList.add('other-message')
            }
            messages.appendChild(item)
        })
        messages.scrollTop = messages.scrollHeight
    })


    socket.on('online users', (users) => {
        onlineCount.textContent = users.length
        onlineList.innerHTML = ""
        
        users.forEach(name => {
            const li = document.createElement("li")
            li.textContent = name
            if  (name === myName) {
                li.classList.add('me')
            }
            onlineList.appendChild(li)
        })
})
}


function showLoginError(message) {
    loginError.textContent = message
    loginError.classList.remove('hidden')
}
function hideLoginError() {
    loginError.textContent = ""
    loginError.classList.add('hidden')
}



function sendMessage() {
    const text = messageInput.value.trim()
    if (text === "" || !socket) return
    socket.emit("chat message", {text: text})
    messageInput.value = ""
}


sendButton.addEventListener("click", () => {
    sendMessage()
})

messageInput.addEventListener("keydown", (event) => {
    if(event.key === "Enter") {
        sendMessage()
    }
})


loginButton.addEventListener("click", login)
loginPassword.addEventListener("keydown", (event) => {
    if (event.key === "Enter") login()
})




goToRegisterButton.addEventListener("click", () => {
    loginScreen.classList.add('hidden')
    registerScreen.classList.remove('hidden')
})

goToLoginButton.addEventListener("click", () => {
    registerScreen.classList.add('hidden')
    loginScreen.classList.remove('hidden')
})

function showRegError(message) {
    regError.textContent = message
    regError.classList.remove('hidden')
}

function hideRegError() {
    regError.textContent = ""
    regError.classList.add('hidden')
}

async function register() {
    hideRegError()
    const username = regUsername.value.trim()
    const password = regPassword.value.trim()

    if (username === '' || password === '') {
        showRegError('Пожалуйста, заполните все поля')
        return
    }

    const responce = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })

    const data = await responce.json()
    if (!data.ok) {
        showRegError(data.error)
        return
    }

    registerScreen.classList.add('hidden')
    loginScreen.classList.remove('hidden')
    loginUsername.value = username
    loginPassword.focus()
    
}

regSubmitButton.addEventListener('click', register)

regUsername.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        regPassword.focus()
    }
})
    
regPassword.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        register()
    }
})

logoutButton.addEventListener('click', logout)

const savedToken = localStorage.getItem('token')
const savedUsername = localStorage.getItem('username')
if (savedToken && savedUsername) {
    myName = savedUsername
    connectSocket(savedToken)
}