const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const dotenv = require('dotenv');

const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  bold: "\x1b[1m"
};

const logger = {
  info: (msg) => console.log(`${colors.green}[✓] ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}[⚠] ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}[✗] ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}[✅] ${msg}${colors.reset}`),
  loading: (msg) => console.log(`${colors.cyan}[⟳] ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.white}[➤] ${msg}${colors.reset}`),
  banner: () => {
    console.log(`${colors.cyan}${colors.bold}`);
    console.log(`---------------------------------------------`);
    console.log(`   Soul Campaign Auto Bot - Airdrop Insiders`);
    console.log(`---------------------------------------------${colors.reset}`);
    console.log();
  }
};

dotenv.config();
const COOKIE = process.env.COOKIE;
if (!COOKIE) {
    logger.error('COOKIE not found in .env file');
    process.exit(1);
}

const HEADERS = {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9',
    'content-type': 'application/json',
    'priority': 'u=1, i',
    'sec-ch-ua': '"Brave";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'sec-gpc': '1',
    'cookie': COOKIE,
    'Referer': 'https://www.pulsar.money/',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const RANDOM_VIDEO_LINK = `https://www.youtube.com/watch?v=${Math.random().toString(36).substring(2, 13)}`;

let proxies = [];
try {
    proxies = fs.readFileSync('proxies.txt', 'utf8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#')); 
    logger.info(`Loaded ${proxies.length} proxies from proxies.txt`);
} catch (error) {
    logger.error(`Error reading proxies.txt: ${error.message}`);
    proxies = [];
}

if (proxies.length === 0) {
    logger.warn('No proxies found in proxies.txt. Running without proxy.');
}

function getRandomProxy() {
    if (proxies.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * proxies.length);
    return proxies[randomIndex];
}

function createAxiosInstance() {
    const proxyUrl = getRandomProxy();
    if (!proxyUrl) {
        return axios.create();
    }

    logger.step(`Using proxy: ${proxyUrl}`);
    const proxyAgent = new HttpsProxyAgent(proxyUrl, { rejectUnauthorized: false });
    return axios.create({
        httpAgent: proxyAgent,
        httpsAgent: proxyAgent,
    });
}

async function fetchTaskStatus() {
    const axiosInstance = createAxiosInstance();
    logger.loading('Fetching task status...');
    try {
        const response = await axiosInstance.get('https://evm-api.pulsar.money/challenges/soul/tasks-status', {
            headers: { ...HEADERS, 'if-none-match': 'W/"4655-SMYqWQdjhbxNEAJk99DtVyBa3ZU"' },
        });
        logger.success(`Fetched ${response.data.tasksStatus.length} tasks`);
        return response.data.tasksStatus;
    } catch (error) {
        logger.error(`Error fetching task status: ${error.response?.data?.message || error.message}`);
        return [];
    }
}

async function completeTask(taskGuid, extraArguments = []) {
    const axiosInstance = createAxiosInstance();
    logger.loading(`Attempting to complete task ${taskGuid}...`);
    try {
        const response = await axiosInstance.post(
            'https://evm-api.pulsar.money/challenges/do-task',
            { taskGuid, extraArguments },
            { headers: HEADERS }
        );
        logger.success(`Task ${taskGuid} completed: ${JSON.stringify(response.data)}`);
        return response.data;
    } catch (error) {
        logger.error(`Error completing task ${taskGuid}: ${error.response?.data?.message || error.message}`);
        return null;
    }
}

async function processTasks() {
    logger.step('Starting task processing (single attempt)...');
    const tasks = await fetchTaskStatus();

    for (const task of tasks) {
        logger.step(`Processing task: ${task.title} (${task.taskName}) [Status: ${task.status}]`);

        switch (task.taskName) {
            case 'quiz':
                const correctAnswer = task.arguments.find(arg => arg.name === 'correctAnswer')?.value;
                if (correctAnswer) {
                    logger.info(`Submitting quiz answer: ${correctAnswer}`);
                    await completeTask(task.taskGuid, [correctAnswer]);
                } else {
                    logger.warn(`No correct answer found for quiz: ${task.title}`);
                }
                break;

            case 'create_media':
                if (task.taskGuid === '1971cfde-ac54-4940-85e8-628f309c73b8') {
                    logger.info(`Submitting random video link: ${RANDOM_VIDEO_LINK}`);
                    await completeTask(task.taskGuid, [RANDOM_VIDEO_LINK]);
                } else if (task.taskGuid === 'fef8a2e9-b16b-47a7-a5df-ff2314ec838a') {
                    logger.info(`Retrying thread task with previous link (if applicable)`);
                    await completeTask(task.taskGuid, []); 
                }
                break;

            case 'follow_twitter_account':
            case 'retweet_post':
            case 'click_link':
            case 'twitter_username':
                logger.info(`Attempting social task: ${task.title}`);
                await completeTask(task.taskGuid);
                break;

            case 'email_setup':
                logger.warn(`Task ${task.title} requires manual email setup at https://app.pulsar.money/profile. Attempting anyway...`);
                await completeTask(task.taskGuid);
                break;

            case 'daily_checkin':
                logger.warn(`Task ${task.title} requires on-chain transaction. Attempting anyway...`);
                await completeTask(task.taskGuid);
                break;

            default:
                logger.warn(`Unsupported task type: ${task.taskName}`);
                await completeTask(task.taskGuid);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

async function main() {
    logger.banner();
    await processTasks();
    logger.success('Task processing completed.');
}

main().catch(error => {
    logger.error(`Error in task processing: ${error.message}`);
});