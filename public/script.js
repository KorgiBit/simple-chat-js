let socket = null
let myName = ''

// Экраны
const loginScreen = document.getElementById('loginScreen')
const loginUsername = document.getElementById('loginUsername')
const loginPassword = document.getElementById('loginPassword')
const loginError = document.getElementById('loginError')
const loginButton = document.getElementById('loginButton')

const chatScreen = document.getElementById('chatScreen')

// Чат
const messageInput = document.getElementById("messageInput")
const sendButton = document.getElementById("sendButton")
const messages = document.getElementById("messages")
const currentUser = document.getElementById("currentUser")
const onlineList = document.getElementById("onlineList")
const onlineCount = document.getElementById("onlineCount")

// Регистрация и авторизация
const registerScreen = document.getElementById('registerScreen')
const regUsername = document.getElementById('regUsername')
const regPassword = document.getElementById('regPassword')
const regError = document.getElementById('regError')
const regSubmitButton = document.getElementById('regSubmitButton')
const goToRegisterButton = document.getElementById('goToRegisterButton')
const goToLoginButton = document.getElementById('goToLoginButton')
const logoutButton = document.getElementById('logoutButton')

const AVAILABLE_REACTIONS = ['👍', '👎', '❤️', '😂', '😢', '🔥']

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

// Лёгкая чистка состояния — без переключения экранов и без затирания ошибки
function clearAuthState() {
    if (socket) {
        socket.disconnect()
        socket = null
    }
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    myName = ''
}

async function login() {
    hideLoginError()
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
        auth: { token }
    })

    socket.on('connect', () => {
        currentUser.textContent = myName
        loginScreen.classList.add('hidden')
        chatScreen.classList.remove('hidden')
        messageInput.focus()
    })

    socket.on('connect_error', (err) => {
        // Если чат уже открыт — возвращаемся на login полноценно
        // Если ещё на login — просто чистим состояние и показываем ошибку
        if (!chatScreen.classList.contains('hidden')) {
            logout()
        } else {
            clearAuthState()
        }
        showLoginError(err.message)
    })

    socket.on("chat message", (messageData) => {
        renderMessage(messageData)
        messages.scrollTop = messages.scrollHeight
    })

    socket.on("chat history", (history) => {
        messages.innerHTML = ""
        history.forEach(messageData => renderMessage(messageData))
        messages.scrollTop = messages.scrollHeight
    })

    socket.on('reaction updated', ({ messageId, reactions }) => {
        const messageElement = messages.querySelector(`li[data-message-id="${messageId}"]`)
        if (!messageElement) return
        const reactionsBox = messageElement.querySelector(".reactions-box")
        renderReactions(reactionsBox, messageId, reactions)
    })

    socket.on('online users', (users) => {
        onlineCount.textContent = users.length
        onlineList.innerHTML = ""

        users.forEach(name => {
            const li = document.createElement("li")
            li.textContent = name
            if (name === myName) {
                li.classList.add('me')
            }
            onlineList.appendChild(li)
        })
    })
}

function renderReactions(container, messageId, reactions) {
    container.innerHTML = ""
    for (const emoji in reactions) {
        const users = reactions[emoji]
        if (users.length === 0) continue
        const chip = document.createElement("button")
        chip.classList.add("reaction-chip")
        chip.textContent = `${emoji} ${users.length}`
        if (users.includes(myName)) chip.classList.add("my-reaction")
        chip.title = users.join(", ")
        chip.addEventListener("click", () => {
            socket.emit("toggle reaction", { messageId, emoji })
        })
        container.appendChild(chip)
    }
}

function renderMessage(messageData) {
    const item = document.createElement("li")
    item.dataset.messageId = messageData.id

    const isMine = messageData.user === myName
    item.classList.add(isMine ? 'my-message' : 'other-message')

    const nameEl = document.createElement("div")
    nameEl.classList.add("msg-name")
    nameEl.textContent = messageData.user
    item.appendChild(nameEl)

    const textEl = document.createElement("div")
    textEl.classList.add("msg-text")
    textEl.textContent = messageData.text
    item.appendChild(textEl)

    if (messageData.time) {
        const timeEl = document.createElement("div")
        timeEl.classList.add("msg-time")
        timeEl.textContent = messageData.time
        item.appendChild(timeEl)
    }

    const addReactionBtn = document.createElement("button")
    addReactionBtn.textContent = "🙂+"
    addReactionBtn.classList.add("add-reaction-btn")
    addReactionBtn.addEventListener("click", () => togglePicker(item, messageData.id))
    item.appendChild(addReactionBtn)

    const reactionsBox = document.createElement("div")
    reactionsBox.classList.add("reactions-box")
    item.appendChild(reactionsBox)

    renderReactions(reactionsBox, messageData.id, messageData.reactions || {})
    messages.appendChild(item)
}

function togglePicker(messageElement, messageId) {
    const existing = messageElement.querySelector(".emoji-picker")
    if (existing) {
        existing.remove()
        return
    }
    const picker = document.createElement("div")
    picker.classList.add("emoji-picker")
    AVAILABLE_REACTIONS.forEach(emoji => {
        const btn = document.createElement("button")
        btn.textContent = emoji
        btn.addEventListener("click", () => {
            socket.emit("toggle reaction", { messageId, emoji })
            picker.remove()
        })
        picker.appendChild(btn)
    })
    messageElement.appendChild(picker)
}

function showLoginError(message) {
    loginError.textContent = message
    loginError.classList.remove('hidden')
}

function hideLoginError() {
    loginError.textContent = ""
    loginError.classList.add('hidden')
}

function showRegError(message) {
    regError.textContent = message
    regError.classList.remove('hidden')
}

function hideRegError() {
    regError.textContent = ""
    regError.classList.add('hidden')
}

function sendMessage() {
    const text = messageInput.value.trim()
    if (text === "" || !socket) return
    socket.emit("chat message", { text: text })
    messageInput.value = ""
}

async function register() {
    hideRegError()
    const username = regUsername.value.trim()
    const password = regPassword.value.trim()

    if (username === '' || password === '') {
        showRegError('Пожалуйста, заполните все поля')
        return
    }

    const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })

    const data = await response.json()
    if (!data.ok) {
        showRegError(data.error)
        return
    }

    registerScreen.classList.add('hidden')
    loginScreen.classList.remove('hidden')
    loginUsername.value = username
    loginPassword.focus()
}

// --- Обработчики событий ---

sendButton.addEventListener("click", sendMessage)

messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        sendMessage()
    }
})

loginButton.addEventListener("click", login)

loginUsername.addEventListener("keydown", (event) => {
    if (event.key === "Enter") loginPassword.focus()
})

loginPassword.addEventListener("keydown", (event) => {
    if (event.key === "Enter") login()
})

goToRegisterButton.addEventListener("click", () => {
    hideLoginError()
    loginScreen.classList.add('hidden')
    registerScreen.classList.remove('hidden')
})

goToLoginButton.addEventListener("click", () => {
    hideRegError()
    registerScreen.classList.add('hidden')
    loginScreen.classList.remove('hidden')
})

regSubmitButton.addEventListener('click', register)

regUsername.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') regPassword.focus()
})

regPassword.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') register()
})

logoutButton.addEventListener('click', logout)

// --- Автологин по сохранённому токену ---

const savedToken = localStorage.getItem('token')
const savedUsername = localStorage.getItem('username')
if (savedToken && savedUsername) {
    myName = savedUsername
    connectSocket(savedToken)
}