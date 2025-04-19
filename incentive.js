const fs = require('fs');
const axios = require('axios');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

class BadgeClaimer {
  constructor() {
    this.accountsFile = 'accounts.json';
    this.accounts = this.loadAccounts();
    this.referralId = this.loadReferralId();
    this.proxies = this.loadProxies();
  }

  loadReferralId() {
    try {
      const content = fs.readFileSync('code.txt', 'utf8');
      const id = parseInt(content.trim(), 10);
      if (isNaN(id)) throw new Error('Invalid referral ID in code.txt');
      return id;
    } catch (error) {
      console.error('Error loading referral ID from code.txt, using default:', error.message);
      return 26745; 
    }
  }

  loadProxies() {
    try {
      const content = fs.readFileSync('proxies.txt', 'utf8');
      return content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(proxy => {
          if (proxy.startsWith('http://') || proxy.startsWith('https://') || 
              proxy.startsWith('socks4://') || proxy.startsWith('socks5://')) {
            return proxy;
          }
          return `http://${proxy}`; 
        });
    } catch (error) {
      console.error('Error loading proxies from proxies.txt:', error.message);
      return [];
    }
  }

  getRandomProxy() {
    if (!this.proxies.length) return null;
    return this.proxies[Math.floor(Math.random() * this.proxies.length)];
  }

  printBanner() {
    const bannerWidth = 50;
    const title = 'Auto Reff Social Incentive - Airdrop Insiders';
    
    console.log('='.repeat(bannerWidth));
    console.log(this.centerText(title, bannerWidth));
    console.log('='.repeat(bannerWidth));
    console.log('');
  }

  centerText(text, width) {
    const padding = width - text.length;
    const leftPadding = Math.floor(padding / 2);
    const rightPadding = width - text.length - leftPadding;
    return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
  }

  loadAccounts() {
    try {
      return JSON.parse(fs.readFileSync(this.accountsFile, 'utf8'));
    } catch (error) {
      return [];
    }
  }

  saveAccounts() {
    fs.writeFileSync(this.accountsFile, JSON.stringify(this.accounts, null, 2));
  }

  generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  generateRealisticUser() {
    const username = this.generateRandomString(8);
    
    return {
      email: `${username}@gmail.com`,
      referralId: this.referralId,
      discord: {
        id: Math.floor(Math.random() * 1000000000000000000).toString(),
        username: username,
        status: true,
        accessCode: this.generateRandomString(30)
      },
      x: {
        id: Math.floor(Math.random() * 1000000000000000000).toString(),
        username: `0x${username}`,
        status: true
      },
      telegram: {
        id: Math.floor(Math.random() * 1000000000).toString(),
        username: username,
        status: true
      }
    };
  }

  async claimBadge(userData) {
    try {
      const proxy = this.getRandomProxy();
      const config = {
        headers: {
          'accept': 'application/json, text/plain, */*',
          'content-type': 'application/json',
          'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Brave";v="134"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
          'sec-gpc': '1',
          'Referer': 'https://social.incentiv.net/',
          'Referrer-Policy': 'strict-origin-when-cross-origin'
        }
      };

      if (proxy) {
        console.log(`Using proxy: ${proxy}`);
        if (proxy.startsWith('socks4://') || proxy.startsWith('socks5://')) {
          const agent = new SocksProxyAgent(proxy);
          config.httpAgent = agent;
          config.httpsAgent = agent;
        } else {
          const agent = new HttpsProxyAgent(proxy);
          config.httpsAgent = agent;
          config.httpAgent = agent;
        }
      }

      const response = await axios.post('https://social-api.incentiv.net/claims', userData, config);
      return response.data;
    } catch (error) {
      console.error('Failed to claim badge:', error.response ? error.response.data : error.message);
      return null;
    }
  }

  async runCampaign(numberOfAccounts) {
    this.printBanner();
    console.log(`Starting badge claiming campaign for ${numberOfAccounts} accounts...`);
    console.log(`Using Referral ID: ${this.referralId}`);
    console.log(`Available proxies: ${this.proxies.length}`);

    for (let i = 0; i < numberOfAccounts; i++) {
      const userData = this.generateRealisticUser();
      
      console.log(`\nAttempting to claim badge for user: ${userData.discord.username}`);
      
      const claimResult = await this.claimBadge(userData);
      
      if (claimResult) {
        userData.claimData = claimResult;
        this.accounts.push(userData);
        console.log(`Badge claimed successfully for ${userData.discord.username}`);
        
        console.log(`    Email: ${userData.email}`);
        console.log(`    Discord: ${userData.discord.username}`);
        console.log(`    X Username: ${userData.x.username}`);
        console.log(`    Telegram: ${userData.telegram.username}`);
      }

      await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 2000));
    }

    this.saveAccounts();
    console.log('\nBadge claiming campaign completed. Accounts saved to accounts.json');
  }

  static getUserInput() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('Enter the number of accounts to create: ', (answer) => {
        rl.close();
        resolve(parseInt(answer, 10));
      });
    });
  }
}

async function main() {
  const claimer = new BadgeClaimer();
  
  try {
    const numberOfAccounts = await BadgeClaimer.getUserInput();
    
    if (isNaN(numberOfAccounts) || numberOfAccounts <= 0) {
      console.log('Please enter a valid number.');
      return;
    }
    
    await claimer.runCampaign(numberOfAccounts);
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

main().catch(console.error);

module.exports = BadgeClaimer;