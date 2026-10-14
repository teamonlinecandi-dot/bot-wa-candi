const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fetch = require('node-fetch');

// URL Webhook Google Apps Script kamu
const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzsIbY8uV5bc7QqLMf_mQHWxlGoNKOuupnAyU7z4wE5fMnpTn6wOFEQ8KEdE1c5q_HSKA/exec';

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('=== SCAN QR CODE DI BAWAH INI ===');
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ BOT WHATSAPP BERHASIL TERHUBUNG DI CLOUD!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const nomorPengirim = msg.key.remoteJid;
        const isiPesan = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        console.log(`[Pesan Masuk dari ${nomorPengirim}]: ${isiPesan}`);
        const pesanLower = isiPesan.toLowerCase();

        if (pesanLower.includes('#paking kayu') || pesanLower.includes('#pk belum proses')) {
            try {
                const res = await fetch(WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nomor: nomorPengirim.replace('@s.whatsapp.net', '').replace('@lid', ''),
                        pesan: isiPesan
                    }),
                    redirect: 'follow'
                });
                
                const responseText = await res.text();
                console.log('✅ Data berhasil dikirim ke Spreadsheet:', responseText);

                let balasan = 'Halo! Data Anda sudah kami terima dan tercatat di sistem. Terima kasih!';
                if (pesanLower.includes('#pk belum proses')) {
                    balasan = 'Halo! Status *PK Belum Proses* Anda telah dicatat. Mohon ditunggu ya!';
                }

                await sock.sendMessage(nomorPengirim, { text: balasan });
                console.log('📤 Balasan otomatis berhasil dikirim.');

            } catch (err) {
                console.error('❌ Terjadi kesalahan:', err);
            }
        } else {
            console.log('⏭️ Pesan diabaikan.');
        }
    });
}

connectToWhatsApp();