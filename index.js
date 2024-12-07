const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const pino = require('pino')
const fs = require('fs')

let user = JSON.parse(fs.readFileSync('./views/user.json'))

let iya = null;

//---------------------------------------------------------------------//

__path = process.cwd();
let favicon = require('serve-favicon');
let express = require('express'),
cors = require('cors'),
secure = require('ssl-express-www');
const PORT = process.env.PORT || 8080 || 5000 || 3000

app = express()
app.enable('trust proxy');
app.set("json spaces",2)
app.use(cors())
app.use(secure)
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
        let pesan = `Kode verifikasi kamu adalah: ${Math.floor(Math.random() * 10000)}`
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
	        message = 'Error '+err
	    })
    }
    res.status(200).json({
        status: status,
        message: message
    })
})

app.get('/user', async (req, res) => {
    res.status(200).json({
        reg
    })
})

//---------------------------------------------------------------------//

async function connectToWhatsApp () {
	const { state, saveCreds } = await useMultiFileAuthState("./session")
	const { version, isLatest } = await fetchLatestBaileysVersion()
    const sock = makeWASocket({
    	version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state
    })

    // mboh
    iya = sock

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr} = update	    
        if (connection === 'close') {
        let reason = new Boom(lastDisconnect?.error)?.output.statusCode
            if (reason === DisconnectReason.badSession) { console.log(`Bad Session File, Please Delete Session and Scan Again`); sock.logout(); }
            else if (reason === DisconnectReason.connectionClosed) { console.log("Connection closed, reconnecting...."); connectToWhatsApp(); }
            else if (reason === DisconnectReason.connectionLost) { console.log("Connection Lost from Server, reconnecting..."); connectToWhatsApp(); }
            else if (reason === DisconnectReason.connectionReplaced) { console.log("Connection Replaced, Another New Session Opened, Please Close Current Session First"); sock.logout(); }
            else if (reason === DisconnectReason.loggedOut) { console.log(`Device Logged Out, Please Scan Again And Run.`); sock.logout(); }
            else if (reason === DisconnectReason.restartRequired) { console.log("Restart Required, Restarting..."); connectToWhatsApp(); }
            else if (reason === DisconnectReason.timedOut) { console.log("Connection TimedOut, Reconnecting..."); connectToWhatsApp(); }
            else sock.end(`Unknown DisconnectReason: ${reason}|${connection}`)
        }
        if (update.connection == "open" || update.receivedPendingNotifications == "true") {
				console.log('Connect, welcome owner!')
			}
    })

    // message upsert
    sock.ev.on('messages.upsert', async (m) => {
        //console.log(JSON.stringify(m, undefined, 2))
        //await sock.sendMessage(m.messages[0].key.remoteJid, { text: 'Hello there!' })
    })

    // write session
    sock.ev.on("creds.update", saveCreds)

    return sock
}

// run in main file
connectToWhatsApp()

//---------------------------------------------------------------------//

app.listen(PORT, () => {
    console.log("Server running on port " + PORT)
})

module.exports = app
