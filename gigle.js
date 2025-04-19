const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs').promises;
const readline = require('readline');
const path = require('path');
const crypto = require('crypto');

const config = {
  baseUrl: 'https://creator.giggleacademy.com',
  mailTmApiUrl: 'https://api.mail.tm',
  mailDomain: 'ptct.net',
  outputFile: 'accounts.json',
  proxyFile: 'proxies.txt',
  codeFile: 'code.txt'
};

const mailClient = axios.create({
  baseURL: config.mailTmApiUrl,
  headers: { 'Content-Type': 'application/json' }
});

function generateRandomEmail() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let username = '';
  for (let i = 0; i < 8; i++) {
    username += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${username}@${config.mailDomain}`;
}

function generateRandomPassword() {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=';
  
  let password = '';
  password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += special.charAt(Math.floor(Math.random() * special.length));
  
  const allChars = lowercase + uppercase + numbers + special;
  const additionalLength = Math.floor(Math.random() * 3) + 6; 
  
  for (let i = 0; i < additionalLength; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }
  
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

async function loadProxies() {
  try {
    const data = await fs.readFile(config.proxyFile, 'utf8');
    return data.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  } catch (error) {
    console.log(`⚠️ Could not load proxies: ${error.message}`);
    return [];
  }
}

async function loadReferralCodes() {
  try {
    const data = await fs.readFile(config.codeFile, 'utf8');
    return data.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  } catch (error) {
    console.log(`⚠️ Could not load referral codes: ${error.message}`);
    return ['CK7QCF']; 
  }
}

async function createMailTmAccount() {
  const email = generateRandomEmail();
  const password = 'P@ssw0rd123!';
  console.log(`📧 Creating mail account: ${email}`);
  
  try {
    const response = await mailClient.post('/accounts', { address: email, password });
    const loginResponse = await mailClient.post('/token', { address: email, password });
    console.log(`✅ Mail account created successfully`);
    return { email, password, token: loginResponse.data.token, id: response.data.id };
  } catch (error) {
    console.log(`❌ Failed to create mail account: ${error.message}`);
    throw error;
  }
}

async function getVerificationCode(mailAccount, retries = 20, delay = 5000) {
  const mailHeaders = { 'Authorization': `Bearer ${mailAccount.token}` };
  
  console.log(`🔎 Looking for verification email...`);
  
  for (let i = 0; i < retries; i++) {
    try {
      const messagesResponse = await mailClient.get('/messages', { headers: mailHeaders });
      const messages = messagesResponse.data['hydra:member'] || [];
      
      if (messages.length > 0) {
        const messageId = messages[0].id;
        const messageResponse = await mailClient.get(`/messages/${messageId}`, { headers: mailHeaders });
        const content = (messageResponse.data.text || '') + (messageResponse.data.html || '');
        const verificationCodeMatch = content.match(/\b\d{6}\b/);
        
        if (verificationCodeMatch) {
          console.log(`✅ Verification code found: ${verificationCodeMatch[0]}`);
          return verificationCodeMatch[0];
        }
      }
      
      process.stdout.write(`.`);
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      console.log(`\n⚠️ Error checking emails: ${error.message}`);
    }
  }
  
  throw new Error('Failed to retrieve verification code');
}

async function registerAccount(proxyUrl, inviteCode) {
  console.log(`\n🚀 Starting registration process with invite code: ${inviteCode}`);
  
  const accountPassword = generateRandomPassword();
  console.log(`🔑 Generated password: ${accountPassword}`);
  
  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  };
  
  if (proxyUrl) {
    console.log(`🔄 Using proxy: ${proxyUrl}`);
    launchOptions.args.push(`--proxy-server=${proxyUrl}`);
  }
  
  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  
  try {
    console.log(`🌐 Navigating to registration page...`);
    await page.goto(`${config.baseUrl}/view/app-download?inviteCode=${inviteCode}`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    const mailAccount = await createMailTmAccount();
    
    console.log(`📝 Submitting email address...`);
    await page.waitForSelector('input[placeholder="Enter email"]', { timeout: 60000 });
    await page.type('input[placeholder="Enter email"]', mailAccount.email);
    await page.click('.custom-button');
    
    await page.waitForFunction(() => document.querySelector('input[placeholder="Enter verification code"]'), { timeout: 60000 });
    
    const verifyCode = await getVerificationCode(mailAccount);
    
    console.log(`🔑 Submitting verification code...`);
    await page.waitForSelector('input[placeholder="Enter verification code"]', { timeout: 60000 });
    await page.type('input[placeholder="Enter verification code"]', verifyCode);
    await page.click('.custom-button');
    
    await page.waitForFunction(() => document.querySelector('input[placeholder="Enter password"]'), { timeout: 60000 });
    
    console.log(`🔒 Setting password...`);
    await page.waitForSelector('input[placeholder="Enter password"]', { timeout: 60000 });
    await page.type('input[placeholder="Enter password"]', accountPassword);
    await page.click('.custom-button');
    
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
      .catch(() => console.log('No navigation after registration, assuming success'));
    
    console.log(`✅ Registration completed successfully!`);
    
    return {
      email: mailAccount.email,
      password: accountPassword,
      registrationDate: new Date().toISOString(),
      inviteCode: inviteCode
    };
  } catch (error) {
    console.log(`❌ Registration failed: ${error.message}`);
    throw error;
  } finally {
    await browser.close();
  }
}

async function saveAccounts(accounts) {
  try {
    const exists = await fs.access(config.outputFile).then(() => true).catch(() => false);
    if (exists) {
      const backupFile = `${config.outputFile}.bak`;
      await fs.copyFile(config.outputFile, backupFile);
    }
  } catch (error) {
    console.log(`⚠️ Failed to create backup: ${error.message}`);
  }
  
  await fs.writeFile(config.outputFile, JSON.stringify(accounts, null, 2));
  console.log(`💾 Saved ${accounts.length} accounts to ${config.outputFile}`);
}

async function main() {
  console.log(`GiggleAcademy Auto Reff - Airdrop Insiders`);
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  try {
    const proxies = await loadProxies();
    console.log(`🔄 Loaded ${proxies.length} proxies`);
    
    const referralCodes = await loadReferralCodes();
    console.log(`🎟️ Loaded ${referralCodes.length} referral codes`);
    
    if (referralCodes.length === 0) {
      console.log(`❌ No referral codes found. Please add codes to ${config.codeFile}`);
      return;
    }
    
    const numAccounts = await new Promise((resolve) => {
      rl.question('How many accounts would you like to create? ', (answer) => {
        resolve(parseInt(answer.trim()));
      });
    });
    
    if (isNaN(numAccounts) || numAccounts <= 0) {
      console.log('❌ Number of accounts must be a positive number');
      return;
    }
    
    console.log(`\n🚀 Creating ${numAccounts} accounts...\n`);
    
    let accounts = [];
    try {
      const data = await fs.readFile(config.outputFile, 'utf8');
      accounts = JSON.parse(data);
      console.log(`📊 Loaded ${accounts.length} existing accounts`);
    } catch (error) {
      console.log(`📝 Starting with fresh accounts list`);
    }
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < numAccounts; i++) {
      console.log(`\n📋 Account ${i + 1}/${numAccounts}`);
      
      try {
        const proxy = proxies.length > 0 ? proxies[i % proxies.length] : null;
        const code = referralCodes[i % referralCodes.length];
        
        const account = await registerAccount(proxy, code);
        accounts.push(account);
        successCount++;
        
        console.log(`✅ Successfully registered: ${account.email}`);
        await saveAccounts(accounts);
        
        if (i < numAccounts - 1) {
          const delay = Math.floor(Math.random() * 3000) + 5000; 
          console.log(`⏱️ Waiting ${Math.round(delay/1000)} seconds before next registration...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        failCount++;
        console.log(`❌ Failed to create account ${i + 1}: ${error.message}`);
      }
    }
    
    console.log(`\n🏁 Registration process completed!`);
    console.log(`📊 Summary: ${successCount} successful, ${failCount} failed`);
    
  } catch (error) {
    console.log(`\n❌ Fatal error: ${error.message}`);
  } finally {
    rl.close();
  }
}

main();