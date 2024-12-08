const { default: riyConnect, useMultiFileAuthState, DisconnectReason, jidNormalizedUser, fetchLatestBaileysVersion, generateForwardMessageContent, prepareWAMessageMedia, generateWAMessageFromContent, generateMessageID, downloadContentFromMessage, makeInMemoryStore, jidDecode, proto, delay } = require("@whiskeysockets/baileys")
const pino = require('pino')
const { Boom } = require('@hapi/boom')
const fs = require('fs')

// database
let user = JSON.parse(fs.readFileSync('./views/user.json'))

// mboh
let iya = null;

//---------------------------------------------------------------------//

__path = process.cwd();
const favicon = require('serve-favicon');
const express = require('express'),
PORT = process.env.PORT || 8080 || 5000 || 3000

app = express()
app.set("json spaces",2)
app.use(favicon(__path +'/views/favicon.ico'))
app.use(express.static("public"))

app.get('/', (req, res) => {
    res.sendFile(__path + '/views/docs.html')
})

app.get('/verifikasi', async (req, res) => {
    let status = false
    let message = null
    let name = req.query.name
    let phone = req.query.phone
	let dbx = user.find(i => i.phone === phone)
    if (dbx !== undefined) {
        if (dbx.status === false) {
            res.status(200).json({
		        status: 'waiting for verification',
		        message: 'Silahkan verifikasi kode yang dikirim oleh bot'
	        })
	        return
        }
        if (dbx.status === true) {
	        res.status(200).json({
		        status: true,
		        message: 'Nomor kamu sudah terverifikasi'
	        })
	        return
        }
    }
    if (name && phone) {
        let pesan = `Kode verifikasi kamu adalah: *${Math.floor(Math.random() * 10000)}*\n\nKetik *.verifikasi ${Math.floor(Math.random() * 10000)}* untuk memverifikasi.`
	    await iya.sendMessage(phone+"@s.whatsapp.net", { text: pesan }).then((respon) => {
            status = 'waiting for verification'
		    message = 'Kode verifikasi berhasil dikirim'
			let obj = {
				name: name,
	            phone: phone,
			    status: false
		    }
		    user.push(obj)
	        fs.writeFileSync('./views/user.json', JSON.stringify(user, null, 2))
	    }).catch((err) => {
	        message = 'Error, silahkan kembali ke halaman utama'
	    })
    }
    res.status(200).json({
        status: status,
        message: message
    })
})

app.get('/userJson', async (req, res) => {
    res.status(200).json({
        user
    })
})

app.get('/user', (req, res) => {
    res.sendFile(__path + '/views/user.html')
})

//---------------------------------------------------------------------//

const startRiy = async() => {
	
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) })
const { state, saveCreds } = await useMultiFileAuthState(`./session`)

// start
const oke = riyConnect({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    browser: ['Chrome (Linux)', '', ''],
    auth: state
})

store.bind(oke.ev)

// mboh
iya = oke

oke.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr} = update	    
    if (connection === 'close') {
        let reason = new Boom(lastDisconnect?.error)?.output.statusCode
        if (reason === DisconnectReason.badSession) { console.log(`Bad Session File, Please Delete Session and Scan Again`); oke.logout(); }
        else if (reason === DisconnectReason.connectionClosed) { console.log("Connection closed, reconnecting...."); startRiy(); }
        else if (reason === DisconnectReason.connectionLost) { console.log("Connection Lost from Server, reconnecting..."); startRiy(); }
        else if (reason === DisconnectReason.connectionReplaced) { console.log("Connection Replaced, Another New Session Opened, Please Close Current Session First"); oke.logout(); }
        else if (reason === DisconnectReason.loggedOut) { console.log(`Device Logged Out, Please Scan Again And Run.`); oke.logout(); }
        else if (reason === DisconnectReason.restartRequired) { console.log("Restart Required, Restarting..."); startRiy(); }
        else if (reason === DisconnectReason.timedOut) { console.log("Connection TimedOut, Reconnecting..."); startRiy(); }
        else oke.end(`Unknown DisconnectReason: ${reason}|${connection}`)
    }
    if (update.connection == "open" || update.receivedPendingNotifications == "true") {
        console.log('Connect, welcome owner!')
    }
})

oke.ev.on("creds.update", saveCreds)

return oke
}

startRiy()

// start website
app.listen(PORT, () => {
    console.log("Server running on port " + PORT)
})