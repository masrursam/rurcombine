require('dotenv').config();
const axios = require('axios');
const ethers = require('ethers');
const readline = require('readline');
const fs = require('fs');
const { setTimeout } = require('timers/promises');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const prompt = (q) => new Promise(res => rl.question(q, ans => res(ans)));

const headers = {
  "accept": "application/json, text/plain, */*",
  "content-type": "application/json",
  "Referer": "https://app.stobix.com/",
};

const banner = () => {
  console.clear();
  console.log("\x1b[36m%s\x1b[0m", `
  =============================================
         Stobix Auto Bot - Airdrop Insiders
                Recode by @PetrukStar
  =============================================
  `);
};

const getNonce = async (address) => {
  const res = await axios.post('https://api.stobix.com/v1/auth/nonce', { address }, { headers });
  return res.data.nonce;
};

const verifySignature = async (nonce, signature) => {
  const res = await axios.post('https://api.stobix.com/v1/auth/web3/verify', {
    nonce, signature, chain: 8453
  }, { headers });
  return res.data.token;
};

const claimTask = async (token, taskId) => {
  try {
    const res = await axios.post('https://api.stobix.com/v1/loyalty/tasks/claim',
      { taskId },
      { headers: { ...headers, authorization: `Bearer ${token}` } });
    console.log(`[✓] Task ${taskId} claimed: +${res.data.points} pts`);
  } catch {
    console.log(`[!] Task ${taskId} skipped or failed`);
  }
};

const startMining = async (token) => {
  try {
    const res = await axios.post('https://api.stobix.com/v1/loyalty/points/mine', {}, {
      headers: { ...headers, authorization: `Bearer ${token}` }
    });
    console.log(`[✓] Mining started: +${res.data.amount} pts`);
  } catch {
    console.log(`[!] Mining failed or already started`);
  }
};

const visitReferral = async (ref) => {
  try {
    await axios.get(`https://stobix.com/invite/${ref}`, { headers });
    console.log(`[✓] Visited referral link: ${ref}`);
  } catch {
    console.log(`[!] Failed to visit referral link`);
  }
};

(async () => {
  banner();
  const referralCode = await prompt('Masukkan kode referral: ');
  const jumlah = parseInt(await prompt('Jumlah akun yang ingin dibuat: '));
  const saveToFile = false;

  for (let i = 1; i <= jumlah; i++) {
    console.log(`\n[${i}/${jumlah}] Membuat wallet baru...`);
    const wallet = ethers.Wallet.createRandom();
    const address = wallet.address;
    const privateKey = wallet.privateKey;

    await visitReferral(referralCode);

    try {
      const nonce = await getNonce(address);
      const msg = `Sign this message to authenticate: ${nonce}`;
      const sig = await wallet.signMessage(msg);
      const token = await verifySignature(nonce, sig);

      const tasks = [
        'follow_x',
        'join_discord',
        'join_telegram_channel',
        'join_telegram_chat',
        'start_telegram_bot',
        'leave_trustpilot_review'
      ];

      for (const task of tasks) {
        await claimTask(token, task);
        await setTimeout(1500);
      }

      await startMining(token);

      if (saveToFile) {
        fs.appendFileSync('wallets.txt', `PRIVATE_KEY_${i}=${privateKey}\n`);
      }
    } catch (e) {
      console.log(`[✗] Gagal proses wallet: ${e.message}`);
    }

    const delay = Math.floor(Math.random() * 5000) + 5000;
    console.log(`[i] sabar cok tunggu ${(delay / 1000).toFixed(1)} detik sebelum akun berikutnya...\n`);
    await setTimeout(delay);
  }

  console.log(`\n[✓] done ngab 👍🗿.`);
  rl.close();
})();
