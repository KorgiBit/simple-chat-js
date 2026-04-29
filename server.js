require('dotenv').config() 

const jwt = require('jsonwebtoken')
const  express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const fs = require('fs/promises')
const bcrypt = require('bcryptjs')
const { error } = require("console")
const { randomUUID } = require('crypto')

const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.use(express.json())
app.use(express.static("public"))

const onlineUsers = new Map()

async function readUsers() {
    const data = await fs.readFile('users.json', 'utf-8')
    return JSON.parse(data)
}

async function writeUsers(users) {
    await fs.writeFile('users.json', JSON.stringify(users, null, 4))
}

const MAX_MESSAGES = 100

async function  readMessages() {
    try {
        const data = await fs.readFile('messages.json', 'utf-8')
        return JSON.parse(data)
    } catch (error) {
        if (error.code === 'ENOENT') return []
        throw error
    }
}

async function writeMessages(messages) {
    await fs.writeFile('messages.json', JSON.stringify(messages, null, 4))
}


app.post('/register', async (req,res) => {
    const { username, password } = req.body

    if (!username || !password) {
        return res.status(400).json({
            ok: false,
            error: 'Ник и пароль обязательны'
        })
    }
    const cleanUsername = username.trim()
    const cleanPassword = password.trim()

    if (cleanUsername === '' || cleanPassword === '') {
        return res.status(400).json({
            ok: false,
            error: 'Ник и пароль не должны быть пустыми'
        })
    }
    if (cleanUsername.length < 3) {
        return res.status(400).json({
            ok: false,
            error: 'Ник должен быть не короче 3 символов'
        })
    }
    if (cleanPassword.length < 4) {
        return res.status(400).json({
            ok: false,
            error: 'Пароль должен быть не короче 4 символов'
        })
    }

    const users = await readUsers()
    const alreadyExists = users.find(u => u.username === cleanUsername)
    if (alreadyExists) {
         return res.status(409).json({
            ok: false,
            error: 'Ник уже занят'
        })
    }
    const passwordHash = await bcrypt.hash(cleanPassword,10)
    const newUser = {
        id: randomUUID(),
        username : cleanUsername,
        passwordHash
    }
    users.push(newUser)
    await writeUsers(users)

    res.json({ok: true, message: 'Аккаунт создан'})

})

app.post('/login', async (req,res) => {
    const { username, password } = req.body
    if (!username || !password) {
        return res.status(400).json({
            ok: false,
            error: 'Ник и пароль обязательны'
        })
    }
    const cleanUsername = username.trim()
    const cleanPassword = password.trim()

    const users = await readUsers()
    const user = users.find(u => u.username === cleanUsername)

    if (!user) {
        return res.status(401).json({
            ok: false,
            error: 'Неверный ник или пароль'
        })
    }
    const passwordMatches = await bcrypt.compare(cleanPassword, user.passwordHash)
    if (!passwordMatches) {
        return res.status(401).json({
            ok: false,
            error: 'Неверный ник или пароль'
        })
    }

    const token = jwt.sign(
        { userId: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    )

    res.json({ok: true, token, username: user.username})
})

io.use((socket, next) => {
    const token = socket.handshake.auth.token
    if (!token) {
        return next(new Error('Токен не предоставлен'))
    }
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET)
        socket.data.userId = payload.userId
        socket.data.username = payload.username
        next()
    } catch (error) {
        return next(new Error('Неверный токен'))
    }

})

io.on('connection', async(socket)=> {
    const userName = socket.data.username
    console.log(`Пользователь подключился: ${userName}`)
    const history = await readMessages()
    socket.emit('chat history', history)

    onlineUsers.set(socket.id, userName)
    io.emit("user joined", userName)
    io.emit('online users', Array.from(onlineUsers.values()))

    socket.on("chat message", async (messageData) => {
        const fullMessageData = {
            user: userName,
            text: messageData.text,
            senderId: socket.id,
            time: new Date().toLocaleTimeString('ru-RU', {hour: '2-digit',minute: '2-digit'})
        }
        io.emit("chat message", fullMessageData)
        // Сохраняем сообщение в истории
        const history = await readMessages()
        history.push({
            user: fullMessageData.user,
            text: fullMessageData.text,
            time: fullMessageData.time
        })
        if (history.length > MAX_MESSAGES) {
            history.splice(0, history.length - MAX_MESSAGES)
        }
        await writeMessages(history)

    })
    socket.on("disconnect", ()=> {
        onlineUsers.delete(socket.id)
        io.emit("user left", userName)
        io.emit('online users', Array.from(onlineUsers.values()))
        console.log(`${userName} вышел из чата`)
    })
})

server.listen(3000, () => {
    console.log('Сервер запущен: http://localhost:3000')
})