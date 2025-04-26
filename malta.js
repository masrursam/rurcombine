const axios = require('axios');
const fs = require('fs');
const { ethers } = require('ethers');
const readline = require('readline');
const { faker } = require('@faker-js/faker');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  white: '\x1b[37m'
};

const emoji = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  wallet: '💼',
  loading: '⏳',
  rocket: '🚀',
  save: '💾',
  user: '👤',
  warning: '⚠️',
  finish: '🏁'
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ACCOUNTS_FILE = 'accounts.json';

const displayBanner = () => {
  const bannerWidth = 70;
  const title = 'Auto Ref Malta Quest - Airdrop Insiders';
  
  console.log('\n' + colors.cyan + '-'.repeat(bannerWidth) + colors.reset);
  console.log(colors.cyan + colors.bright + ' '.repeat((bannerWidth - title.length) / 2) + title + colors.reset);
  console.log(colors.cyan + '-'.repeat(bannerWidth) + colors.reset + '\n');
};

const log = {
  info: (message) => console.log(`${colors.white}${emoji.info} ${message}${colors.reset}`),
  success: (message) => console.log(`${colors.green}${emoji.success} ${message}${colors.reset}`),
  error: (message) => console.log(`${colors.red}${emoji.error} ${message}${colors.reset}`),
  warning: (message) => console.log(`${colors.yellow}${emoji.warning} ${message}${colors.reset}`),
  wallet: (message) => console.log(`${colors.white}${emoji.wallet} ${message}${colors.reset}`),
  save: (message) => console.log(`${colors.green}${emoji.save} ${message}${colors.reset}`),
  user: (message) => console.log(`${colors.white}${emoji.user} ${message}${colors.reset}`),
  loading: (message) => console.log(`${colors.yellow}${emoji.loading} ${message}${colors.reset}`),
  rocket: (message) => console.log(`${colors.green}${emoji.rocket} ${message}${colors.reset}`),
  finish: (message) => console.log(`${colors.green}${emoji.finish} ${message}${colors.reset}`),
  separator: () => console.log(colors.cyan + '-'.repeat(50) + colors.reset)
};

let accounts = [];
if (fs.existsSync(ACCOUNTS_FILE)) {
  try {
    accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
    log.info(`Loaded ${colors.green}${accounts.length}${colors.white} existing accounts from ${ACCOUNTS_FILE}`);
  } catch (error) {
    log.error(`Error reading accounts file: ${error.message}`);
  }
}

const randomDelay = (min, max) => {
  const seconds = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
};

const generateWallet = () => {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey
  };
};

const generateUserData = () => {
  faker.locale = 'id_ID';

  const firstNames = ['Budi', 'Siti', 'Agus', 'Dewi', 'Adi', 'Sri', 'Joko', 'Rina', 'Doni', 'Ani', 'Wawan', 'Lina'];
  const lastNames = ['Santoso', 'Wijaya', 'Susanto', 'Hartono', 'Kusuma', 'Prasetyo', 'Hidayat', 'Nugroho', 'Suryadi', 'Wibowo'];

  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

  const emailProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'protonmail.com', 'mail.com'];
  const provider = emailProviders[Math.floor(Math.random() * emailProviders.length)];

  let email;
  const emailPattern = Math.floor(Math.random() * 5);
  switch (emailPattern) {
    case 0:
      email = `${firstName.toLowerCase()}${lastName.toLowerCase()}${Math.floor(Math.random() * 999)}@${provider}`;
      break;
    case 1:
      email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${provider}`;
      break;
    case 2:
      email = `${firstName.toLowerCase()}${Math.floor(Math.random() * 9999)}@${provider}`;
      break;
    case 3:
      email = `${lastName.toLowerCase()}${firstName.charAt(0).toLowerCase()}${Math.floor(Math.random() * 99)}@${provider}`;
      break;
    default:
      email = `${firstName.charAt(0).toLowerCase()}${lastName.toLowerCase()}${Math.floor(Math.random() * 999)}@${provider}`;
  }

  const generatePassword = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const length = 10 + Math.floor(Math.random() * 6); 
    let password = '';

    password += characters.charAt(Math.floor(Math.random() * 26)); 
    password += characters.charAt(26 + Math.floor(Math.random() * 26)); 
    password += characters.charAt(52 + Math.floor(Math.random() * 10)); 
    password += characters.charAt(62 + Math.floor(Math.random() * 8)); 

    for (let i = 4; i < length; i++) {
      password += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return password.split('').sort(() => 0.5 - Math.random()).join('');
  };
  
  const wallet = generateWallet();
  
  return {
    name: firstName,
    surname: lastName,
    email: email,
    password: generatePassword(),
    country: 'Indonesia',
    polygon_address: wallet.address,
    wallet: {
      address: wallet.address,
      privateKey: wallet.privateKey
    }
  };
};

const registerAccount = async (userData) => {
  try {
    const payload = {
      name: userData.name,
      surname: userData.surname,
      email: userData.email,
      password: userData.password,
      country: userData.country.toLowerCase(),
      polygon_address: userData.polygon_address
    };
    
    log.user(`Registering: ${colors.yellow}${userData.email}`);
    log.wallet(`Using wallet: ${colors.yellow}${userData.polygon_address.substring(0, 10)}...${userData.polygon_address.substring(32)}`);
    
    const response = await axios({
      method: 'POST',
      url: 'https://www.ulys.site/api/users',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.7',
        'content-type': 'application/json',
        'priority': 'u=1, i',
        'sec-ch-ua': '"Brave";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'sec-gpc': '1',
        'cookie': 'PHPSESSID=hdc5tj8qo3egc641p4pnj34o07; cf_clearance=DUami5mS9mbCm4XwBLl5HaBGL7JIoW8KRt2DcccKu7o-1745515424-1.2.1.1-5tNG6LlZkUFYTMHaIBD71NE9_BpG2blrNgLi_SfB5SIMjaHk85CN1FpcLOLPREYRflKbKTWxIvQOp2e66i86J3lcUwav2npk7qStXI4kCEX5pavqYV88dBoiCqlJZ09zHBZ94VuOhvutUhPd8E_jP4YE_XbUljyezuSg80BWc7nXdh0XHyM5xwnQyURUUJQ17tQq3AzDsXcvSOZe4BDHz118L6CaoLjqir7DbydgqqRGKan8AM5R1ChVZQLu50bnbBFmYe5.gVuJhaVoCZZ8_koRGevpBo05mo_DIsLBHxMz6_jbmBvnxSDq8DkMi_nkl2ojaO4ZL8XSwvRf0EG3j9FhUahi8dW16S6rJjW7loY',
        'Referer': 'https://www.ulys.site/hunters-form.html',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      },
      data: payload
    });
    
    log.success(`Registration successful for ${colors.green}${userData.email}`);
    return { success: true, data: response.data, userData };
  } catch (error) {
    log.error(`Registration failed for ${colors.red}${userData.email}: ${error.message}`);
    if (error.response) {
      log.error(`Server response: ${JSON.stringify(error.response.data)}`);
    }
    return { success: false, error: error.message, userData };
  }
};

const processAccounts = async (count) => {
  log.rocket(`Starting registration process for ${colors.green}${count}${colors.green} accounts...`);
  
  for (let i = 0; i < count; i++) {
    const userData = generateUserData();

    if (i > 0) {
      const delay = Math.floor(Math.random() * 5) + 3;
      log.loading(`Waiting for ${colors.yellow}${delay}${colors.yellow} seconds before next registration...`);
      await randomDelay(3, 8);
    }
    
    log.separator();

    const result = await registerAccount(userData);

    accounts.push({
      ...userData,
      registrationSuccess: result.success,
      registrationTime: new Date().toISOString(),
      response: result.success ? result.data : result.error
    });

    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
    log.save(`Account data saved to ${colors.green}${ACCOUNTS_FILE}`);

    log.info(`Progress: ${colors.green}${i + 1}${colors.white}/${colors.yellow}${count}${colors.white} registrations (${colors.green}${Math.round(((i + 1) / count) * 100)}%${colors.white})`);
    
    log.separator();
  }
  
  log.finish(`Registration process completed. Total accounts: ${colors.green}${accounts.length}`);
};

const displaySummary = () => {
  if (accounts.length === 0) return;
  
  const successful = accounts.filter(acc => acc.registrationSuccess).length;
  const failed = accounts.length - successful;
  
  log.separator();
  log.info(`${colors.bright}ACCOUNT SUMMARY:${colors.reset}`);
  log.success(`Successful registrations: ${colors.green}${successful}`);
  log.error(`Failed registrations: ${colors.red}${failed}`);
  log.info(`Success rate: ${colors.yellow}${Math.round((successful / accounts.length) * 100)}%`);
  log.separator();
};

const main = async () => {
  displayBanner();
  
  rl.question(`${colors.white}${emoji.info} How many accounts would you like to register? ${colors.reset}`, async (answer) => {
    const count = parseInt(answer.trim());
    
    if (isNaN(count) || count <= 0) {
      log.error('Please enter a valid positive number.');
      rl.close();
      return;
    }
    
    log.info(`Preparing to register ${colors.green}${count}${colors.white} accounts...`);
    await processAccounts(count);
    displaySummary();
    rl.close();
  });
};

main().catch(error => {
  log.error(`An unexpected error occurred: ${error}`);
  rl.close();
});