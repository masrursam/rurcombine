const axios = require('axios');
const fs = require('fs').promises;
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { ethers } = require('ethers');

const POLYFLOW_API = 'https://api-v2.polyflow.tech';

const headers = {
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.6',
  'content-type': 'application/json',
  'priority': 'u=1, i',
  'sec-ch-ua': '"Brave";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'sec-gpc': '1',
  'Referer': 'https://app.polyflow.tech/',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const log = {
  info: (msg) => console.log(`[ℹ] ${msg}`),
  success: (msg) => console.log(`[✔] ${msg}`),
  error: (msg) => console.log(`[✘] ${msg}`),
  warn: (msg) => console.log(`[⚠] ${msg}`),
  section: (msg) => console.log(`\n=== ${msg} ===\n`),
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function readRefCode() {
  try {
    const content = await fs.readFile('code.txt', 'utf8');
    const refCode = content.trim();
    if (!refCode) throw new Error('Referral code is empty');
    return refCode;
  } catch (error) {
    log.error(`Failed to read code.txt: ${error.message}`);
    return null;
  }
}

async function readProxies() {
  try {
    const content = await fs.readFile('proxies.txt', 'utf8');
    const proxies = content.split('\n').map(line => line.trim()).filter(line => line);
    if (proxies.length === 0) throw new Error('No proxies found');
    return proxies;
  } catch (error) {
    log.error(`Failed to read proxies.txt: ${error.message}`);
    return [];
  }
}

function createAxiosInstance(proxy) {
  const config = {};
  if (proxy) {
    config.httpsAgent = new HttpsProxyAgent(proxy);
  }
  return axios.create(config);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function askNumberOfAccounts() {
  return new Promise(resolve => {
    rl.question('[?] Number of accounts to create: ', answer => {
      const num = parseInt(answer);
      if (isNaN(num) || num <= 0) {
        log.error('Please enter a valid number greater than 0.');
        rl.close();
        process.exit(1);
      }
      resolve(num);
    });
  });
}

function generateWallet() {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

async function registerAccount(refCode, axiosInstance) {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    log.info(`Registering account (Attempt ${attempt}/${maxRetries})...`);
    try {
      const { address, privateKey } = generateWallet();
      log.info(`Generated wallet address: ${address}`);

      log.info('Fetching sign message...');
      const signContentRes = await axiosInstance.get(`${POLYFLOW_API}/api/account/sign_content?address=${address}`, {
        headers,
      });
      const signMessage = signContentRes.data.msg.content;
      if (!signMessage) throw new Error('No sign message received');

      log.info(`Signing message: ${signMessage}`);
      const wallet = new ethers.Wallet(privateKey);
      const signature = await wallet.signMessage(signMessage);
      log.info(`Generated signature: ${signature}`);

      log.info('Logging in with wallet...');
      const chainId = 1;
      const loginResponse = await axiosInstance.post(`${POLYFLOW_API}/api/account/login`, {
        address,
        signature,
        chain_id: chainId,
        referral_code: refCode,
      }, { headers });

      const authToken = loginResponse.data.msg.token;
      log.success(`Logged in successfully for ${address}`);
      return { address, privateKey, authToken };
    } catch (error) {
      log.error(`Registration attempt failed: ${error.response?.data?.msg || error.message}`);
      if (attempt < maxRetries) await delay(2000);
      else throw error;
    }
  }
}

async function completeDailyQuests(authToken, axiosInstance) {
  log.section('Processing Daily Quests');
  try {
    const response = await axiosInstance.get(`${POLYFLOW_API}/api/account/personalcenter/quests/daily`, {
      headers: { ...headers, authorization: `Bearer ${authToken}` },
    });
    const quests = response.data.msg.quests;

    if (quests.length === 0) {
      log.warn('No daily quests available');
      return;
    }

    for (const quest of quests) {
      if (quest.status !== 'Completed') {
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          log.info(`Completing daily quest "${quest.title}" (Attempt ${attempt}/${maxRetries})...`);
          try {
            await axiosInstance.post(`${POLYFLOW_API}/api/account/personalcenter/quests/complete`, {
              quest_id: quest.id,
            }, {
              headers: { ...headers, authorization: `Bearer ${authToken}` },
            });
            log.success(`Completed daily quest: ${quest.title}`);
            break;
          } catch (error) {
            log.warn(`Failed to complete "${quest.title}": ${error.response?.data?.msg || error.message}`);
            if (attempt < maxRetries) await delay(1000);
          }
        }
      } else {
        log.info(`Daily quest "${quest.title}" already completed`);
      }
      await delay(1000);
    }

    if (response.data.msg.reward_available) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        log.info(`Claiming daily reward (Attempt ${attempt}/3)...`);
        try {
          await axiosInstance.post(`${POLYFLOW_API}/api/account/personalcenter/quests/daily/claim-reward`, {}, {
            headers: { ...headers, authorization: `Bearer ${authToken}` },
          });
          log.success('Claimed daily reward');
          break;
        } catch (error) {
          log.warn(`Failed to claim reward: ${error.response?.data?.msg || error.message}`);
          if (attempt < 3) await delay(1000);
        }
      }
    }
  } catch (error) {
    log.error(`Error processing daily quests: ${error.response?.data?.msg || error.message}`);
  }
}

async function completeTutorialQuests(authToken, axiosInstance) {
  log.section('Processing Tutorial Quests');
  try {
    const response = await axiosInstance.get(`${POLYFLOW_API}/api/account/personalcenter/quests/tutorial?page=1&size=15`, {
      headers: { ...headers, authorization: `Bearer ${authToken}` },
    });
    const quests = response.data.msg.list;

    if (quests.length === 0) {
      log.warn('No tutorial quests available');
      return;
    }

    for (const quest of quests) {
      if (!quest.is_completed) {
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          log.info(`Completing tutorial quest "${quest.title}" (Attempt ${attempt}/${maxRetries})...`);
          try {
            await axiosInstance.post(`${POLYFLOW_API}/api/account/personalcenter/quests/complete`, {
              quest_id: quest.id,
            }, {
              headers: { ...headers, authorization: `Bearer ${authToken}` },
            });
            log.success(`Completed tutorial quest: ${quest.title}`);
            break;
          } catch (error) {
            log.warn(`Failed to complete "${quest.title}": ${error.response?.data?.msg || error.message}`);
            if (quest.title.includes('KYC') || quest.title.includes('Mint')) {
              log.info(`Quest "${quest.title}" may require manual action`);
              break;
            }
            if (attempt < maxRetries) await delay(1000);
          }
        }
      } else {
        log.info(`Tutorial quest "${quest.title}" already completed`);
      }
      await delay(1000);
    }
  } catch (error) {
    log.error(`Error processing tutorial quests: ${error.response?.data?.msg || error.message}`);
  }
}

async function saveAccount(account) {
  try {
    let accounts = [];
    if (await fs.access('accounts.json').then(() => true).catch(() => false)) {
      accounts = JSON.parse(await fs.readFile('accounts.json'));
    }
    accounts.push(account);
    await fs.writeFile('accounts.json', JSON.stringify(accounts, null, 2));
    log.success(`Saved account: ${account.address}`);
  } catch (error) {
    log.error(`Failed to save account: ${error.message}`);
  }
}

async function main() {
  log.section('POLYFLOW AUTO REFF - AIRDROP INSIDERS');
  const refCode = await readRefCode();
  if (!refCode) {
    log.error('File code.txt not found or empty. Please provide a referral code.');
    rl.close();
    return;
  }
  log.info(`Using referral code: ${refCode}`);

  const proxies = await readProxies();
  if (proxies.length === 0) {
    log.warn('No proxies found. Running without proxies.');
  } else {
    log.info(`Loaded ${proxies.length} proxies`);
  }

  const numAccounts = await askNumberOfAccounts();
  log.info(`Creating ${numAccounts} accounts...`);

  const accounts = [];
  for (let i = 0; i < numAccounts; i++) {
    log.section(`Creating Account ${i + 1}/${numAccounts}`);
    const proxy = proxies.length > 0 ? proxies[i % proxies.length] : null;
    const axiosInstance = createAxiosInstance(proxy);
    log.info(`Using proxy: ${proxy || 'none'}`);

    try {
      const account = await registerAccount(refCode, axiosInstance);
      await completeDailyQuests(account.authToken, axiosInstance);
      await completeTutorialQuests(account.authToken, axiosInstance);
      const accountDetails = {
        address: account.address,
        privateKey: account.privateKey,
        authToken: account.authToken,
        referralCode: refCode,
        proxyUsed: proxy || 'none',
        createdAt: new Date().toISOString(),
      };
      await saveAccount(accountDetails);
      accounts.push(accountDetails);
      log.success(`Account ${i + 1} created and quests completed`);
      await delay(2000);
    } catch (error) {
      log.error(`Failed to create account ${i + 1}: ${error.message}`);
    }
  }

  log.success(`Total ${accounts.length} accounts processed and saved to accounts.json`);
  rl.close();
}

main().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  rl.close();
  process.exit(1);
});