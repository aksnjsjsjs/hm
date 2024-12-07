const baileys = require("@whiskeysockets/baileys")
const { useMultiFileAuthState, DisconnectReason, makeInMemoryStore, jidNormalizedUser, makeCacheableSignalKeyStore, PHONENUMBER_MCC } = baileys
const { Boom } = require("@hapi/boom")
const Pino = require("pino")
const NodeCache = require("node-cache")
const fs = require("fs")

const store = makeInMemoryStore({ logger: Pino({ level: "fatal" }).child({ level: "fatal" }) })

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
		    status = 'waiting for verification'
		    message = 'Silahkan verifikasi kode yang dikirim oleh bot'
	        return
        }
        if (dbx.status === true) {
		    status = true
		    message = 'Nomor kamu sudah terverifikasi'
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
		    status = '404'
	        message = 'Error, silahkan kembali ke halaman utama'
	    })
    }
    res.status(200).json({
        status: status,
        message: message
    })
})

app.get('/user', async (req, res) => {
    res.status(200).json({
        user
    })
})

app.get('/users', (req, res) => {
    res.sendFile(__path + '/views/users.html')
})

//---------------------------------------------------------------------//

// start
async function start() {
   process.on("unhandledRejection", (err) => console.error(err))

   const { state, saveCreds } = await useMultiFileAuthState(`./session`)
   const msgRetryCounterCache = new NodeCache()

   const oke = baileys.default({
      logger: Pino({ level: "fatal" }).child({ level: "fatal" }),
      printQRInTerminal: true,
      auth: {
         creds: state.creds,
         keys: makeCacheableSignalKeyStore(state.keys, Pino({ level: "fatal" }).child({ level: "fatal" })),
      },
      browser: ['Chrome (Linux)', '', ''],
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      getMessage: async (key) => {
         let jid = jidNormalizedUser(key.remoteJid)
         let msg = await store.loadMessage(jid, key.id)

         return msg?.message || ""
      },
      msgRetryCounterCache,
      defaultQueryTimeoutMs: undefined,
   })

   // iya
   iya = oke

   // bind store
   store.bind(oke.ev)

   // push update
   oke.ev.on("contacts.update", (update) => {
      for (let contact of update) {
         let id = jidNormalizedUser(contact.id)
         if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
      }
   })

   // for auto restart
   oke.ev.on("connection.update", async (update) => {
      const { lastDisconnect, connection, qr } = update
      if (connection) {
         console.info(`Connection Status : ${connection}`)
      }

      if (connection === "close") {
         let reason = new Boom(lastDisconnect?.error)?.output.statusCode
         if (reason === DisconnectReason.badSession) {
            console.log(`Bad Session File, Please Delete Session and Scan Again`)
            process.send('reset')
         } else if (reason === DisconnectReason.connectionClosed) {
            console.log("Connection closed, reconnecting....")
            await start()
         } else if (reason === DisconnectReason.connectionLost) {
            console.log("Connection Lost from Server, reconnecting...")
            await start()
         } else if (reason === DisconnectReason.connectionReplaced) {
            console.log("Connection Replaced, Another New Session Opened, Please Close Current Session First")
            process.exit(1)
         } else if (reason === DisconnectReason.loggedOut) {
            console.log(`Device Logged Out, Please Scan Again And Run.`)
            process.exit(1)
         } else if (reason === DisconnectReason.restartRequired) {
            console.log("Restart Required, Restarting...")
            await start()
         } else if (reason === DisconnectReason.timedOut) {
            console.log("Connection TimedOut, Reconnecting...")
            process.send('reset')
         } else if (reason === DisconnectReason.multideviceMismatch) {
            console.log("Multi device mismatch, please scan again")
            process.exit(0)
         } else {
            console.log(reason)
            process.send('reset')
         }
      }

      if (connection === "open") {
         oke.sendMessage("6281575886399" + "@s.whatsapp.net", {
            text: `${oke?.user?.name || ""} has Connected...`,
         })
      }
   })

   // write session
   oke.ev.on("creds.update", saveCreds)

   return oke
}

start()

//---------------------------------------------------------------------//

app.listen(PORT, () => {
    console.log("Server running on port " + PORT)
})
