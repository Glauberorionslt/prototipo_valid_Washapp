import 'dotenv/config'
import { rm } from 'node:fs/promises'
import express from 'express'
import cors from 'cors'
import qrcode from 'qrcode-terminal'
import {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeWASocket,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'

const logger = pino({ level: 'info' })
const app = express()
const port = Number(process.env.PORT || 3100)
const authDir = process.env.AUTH_DIR || '.baileys-auth'
const linkMode = String(process.env.WA_LINK_MODE || 'qr').toLowerCase()

app.use(cors())
app.use(express.json())

const state = {
  connected: false,
  registered: false,
  lastQr: null,
  detail: 'starting',
  linkMode,
}

let socketInstance = null
let isResettingSession = false

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }
  return digits
}

async function connectToWhatsApp() {
  const { state: authState, saveCreds } = await useMultiFileAuthState(authDir)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    auth: {
      creds: authState.creds,
      keys: makeCacheableSignalKeyStore(authState.keys, logger),
    },
    browser: Browsers.windows('Desktop'),
    logger,
    printQRInTerminal: false,
    version,
  })

  socketInstance = sock

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      state.lastQr = qr
      state.detail = 'qr_available'
      if (linkMode === 'qr') {
        qrcode.generate(qr, { small: true })
        logger.info('qr_rendered_in_terminal')
      }
    }

    if (connection === 'open') {
      state.connected = true
      state.registered = true
      state.lastQr = null
      state.detail = 'connected'
    }

    if (connection === 'close') {
      state.connected = false
      state.registered = false
      const shouldReconnect = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
        : true

      state.detail = shouldReconnect ? 'reconnecting' : 'logged_out'
      if (shouldReconnect && !isResettingSession) {
        await connectToWhatsApp()
      }
    }
  })

  if (linkMode === 'pairing-code' && !sock.authState.creds.registered) {
    const configuredPhone = normalizePhone(process.env.PAIRING_PHONE || '')
    if (configuredPhone) {
      try {
        const code = await sock.requestPairingCode(configuredPhone)
        state.detail = 'pairing_code_available'
        logger.info({ phone: configuredPhone, code }, 'pairing_code_generated')
      } catch (error) {
        logger.error({ error: String(error) }, 'pairing_code_generation_failed')
      }
    }
  }

  sock.ev.on('creds.update', saveCreds)

  return sock
}

async function resetSession() {
  isResettingSession = true
  state.connected = false
  state.registered = false
  state.lastQr = null
  state.detail = 'resetting'

  const currentSocket = socketInstance
  socketInstance = null

  if (currentSocket) {
    try {
      currentSocket.ev.removeAllListeners('connection.update')
      currentSocket.ev.removeAllListeners('creds.update')
    } catch {}
    try {
      currentSocket.ws?.close()
    } catch {}
    try {
      await currentSocket.logout()
    } catch {}
  }

  await rm(authDir, { recursive: true, force: true })
  isResettingSession = false
  await connectToWhatsApp()
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/session/status', (_req, res) => {
  res.json(state)
})

app.get('/session/qr', (_req, res) => {
  if (!state.lastQr) {
    return res.status(404).json({ ok: false, detail: 'qr_not_available' })
  }
  return res.json({ ok: true, qr: state.lastQr })
})

app.post('/session/reset', async (_req, res) => {
  try {
    await resetSession()
    return res.json({ ok: true, detail: 'session_reset_started' })
  } catch (error) {
    return res.status(500).json({ ok: false, detail: String(error) })
  }
})

app.post('/session/request-pairing-code', async (req, res) => {
  try {
    if (linkMode !== 'pairing-code') {
      return res.status(400).json({ ok: false, detail: 'bridge_not_in_pairing_mode' })
    }

    if (!socketInstance) {
      return res.status(503).json({ ok: false, detail: 'socket_not_ready' })
    }

    const phoneNumber = normalizePhone(req.body.phoneNumber || process.env.PAIRING_PHONE || '')
    if (!phoneNumber) {
      return res.status(400).json({ ok: false, detail: 'phone_number_required' })
    }

    if (socketInstance.authState?.creds?.registered) {
      return res.json({ ok: true, detail: 'already_registered' })
    }

    const code = await socketInstance.requestPairingCode(phoneNumber)
    return res.json({ ok: true, code })
  } catch (error) {
    return res.status(500).json({ ok: false, detail: String(error) })
  }
})

app.post('/messages/send-text', async (req, res) => {
  try {
    if (!socketInstance || !state.connected) {
      return res.status(503).json({ ok: false, detail: 'whatsapp_not_connected' })
    }

    const phone = normalizePhone(req.body.phone)
    const text = String(req.body.text || '').trim()

    if (!phone || !text) {
      return res.status(400).json({ ok: false, detail: 'phone_and_text_required' })
    }

    if (![12, 13].includes(phone.length)) {
      return res.status(400).json({ ok: false, detail: 'invalid_phone_for_whatsapp' })
    }

    const jid = `${phone}@s.whatsapp.net`
    const response = await socketInstance.sendMessage(jid, { text })
    return res.json({
      ok: true,
      detail: 'sent',
      providerMessageId: response?.key?.id || null,
    })
  } catch (error) {
    return res.status(500).json({ ok: false, detail: String(error) })
  }
})

connectToWhatsApp().catch((error) => {
  logger.error(error, 'failed_to_connect_whatsapp')
  state.detail = String(error)
})

app.listen(port, () => {
  logger.info({ port }, 'washapp2_whatsapp_bridge_started')
})
