const axios = require('axios');
const fs = require('fs');
const ethers = require('ethers');
const readline = require('readline');
const FormData = require('form-data');

const defaultHeaders = {
    "accept": "*/*",
    "accept-language": "en-US,en;q=0.9",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Chromium\";v=\"134\", \"Not:A-Brand\";v=\"24\", \"Microsoft Edge\";v=\"134\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "Referer": "https://ai.zoro.org/",
    "Referrer-Policy": "strict-origin-when-cross-origin"
};

let REF_CODE;
try {
    REF_CODE = fs.readFileSync('code.txt', 'utf8').trim();
    console.log(`Using referral code: ${REF_CODE}`);
} catch (error) {
    console.error('Error reading code.txt:', error.message);
    console.error('Please create a code.txt file with a valid referral code');
    process.exit(1);
}

const imageMissions = {
    "hamster": "92611072-99d6-4d39-ae06-0ef4175c0aea",
    "cattle": "a78693c5-aae5-4d5c-9e07-f79777cbebbb",
    "kiwi": "a11b1dd4-316c-4b75-b8f5-0c6aba7876ae",
    "lemon": "f052e17c-36fe-4a2b-8fc3-272ec0097ffa",
    "lollipop": "b85fbda3-0bcd-4a1e-bc2e-9e6e0f855eaf"
};

const missionRewardIds = [
    "3bb23601-b879-42b4-be72-3e175974604b",
    "31e4891d-9c1e-4ca0-8362-5be848176bf4"
];

const imageUrls = {
    "hamster": "https://images.unsplash.com/photo-1425082661705-1834bfd09dca",
    "cattle": "https://images.unsplash.com/photo-1596733430284-f7437764b1a9",
    "kiwi": "https://images.unsplash.com/photo-1616684000067-36952fde56ec",
    "lemon": "https://images.unsplash.com/photo-1590502593747-42a996133562",
    "lollipop": "https://plus.unsplash.com/premium_photo-1661255468024-de3a871dfc16"
};

function generateRandomUsername() {
    const adjectives = ['Cool', 'Happy', 'Smart', 'Fast', 'Lucky'];
    const nouns = ['Cat', 'Dog', 'Bird', 'Fish', 'Tiger'];
    const number = Math.floor(Math.random() * 1000);
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${number}`;
}

async function createWallet() {
    try {
        const wallet = ethers.Wallet.createRandom();
        const address = wallet.address;
        const privateKey = wallet.privateKey;

        const loginRequest = await axios.get(
            `https://api.zoro.org/user-auth/wallet/login-request?strategy=ETHEREUM_SIGNATURE&address=${address}`,
            { headers: defaultHeaders }
        );

        const { token, message } = loginRequest.data;
        const signature = await wallet.signMessage(message);

        const loginResponse = await axios.get(
            `https://api.zoro.org/user-auth/login?strategy=ETHEREUM_SIGNATURE&address=${address}&message=${message}&token=${token}&signature=${signature}&inviter=${REF_CODE}`,
            { headers: defaultHeaders }
        );

        const { access_token } = loginResponse.data.tokens;
        const randomUsername = generateRandomUsername();

        const nicknameHeaders = {
            ...defaultHeaders,
            "authorization": `Bearer ${access_token}`
        };

        await axios.post(
            `https://api.zoro.org/user/set-nickname?nickname=${randomUsername}`,
            null,
            { headers: nicknameHeaders }
        );

        return {
            address,
            privateKey,
            username: randomUsername,
            accessToken: access_token,
            message,
            signature
        };
    } catch (error) {
        console.error('Error creating wallet:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
        return null;
    }
}

async function claimDailyReward(accessToken) {
    try {
        const response = await axios.post(
            "https://api.zoro.org/daily-rewards/claim",
            null,
            {
                headers: {
                    ...defaultHeaders,
                    "authorization": `Bearer ${accessToken}`
                }
            }
        );
        console.log('Daily reward claimed successfully');
        return response.data;
    } catch (error) {
        console.error('Error claiming daily reward:', error.message);
        return null;
    }
}

async function claimMissionReward(accessToken, rewardId) {
    try {
        const response = await axios.post(
            `https://api.zoro.org/mission-reward/${rewardId}`,
            null,
            {
                headers: {
                    ...defaultHeaders,
                    "authorization": `Bearer ${accessToken}`
                }
            }
        );
        console.log(`Mission reward ${rewardId} claimed successfully`);
        return response.data;
    } catch (error) {
        console.error(`Error claiming mission reward ${rewardId}:`, error.message);
        return null;
    }
}

async function completeImageMission(accessToken, missionType, missionId) {
    try {
        const imageUrl = imageUrls[missionType];
        
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(imageResponse.data);

        const form = new FormData();
        form.append('image', imageBuffer, {
            filename: `${missionType}.jpg`,
            contentType: 'image/jpeg'
        });

        const response = await axios.post(
            `https://api.zoro.org/mission-activity/${missionId}`,
            form,
            {
                headers: {
                    ...defaultHeaders,
                    "authorization": `Bearer ${accessToken}`,
                    "content-type": `multipart/form-data; boundary=${form._boundary}`
                }
            }
        );
        console.log(`Mission ${missionType} completed successfully`);
        return response.data;
    } catch (error) {
        console.error(`Error completing ${missionType} mission:`, error.message);
        return null;
    }
}

async function getAccountInfo(accessToken) {
    try {
        const response = await axios.get(
            "https://api.zoro.org/scoreboard/me",
            {
                headers: {
                    ...defaultHeaders,
                    "authorization": `Bearer ${accessToken}`
                }
            }
        );
        const nickname = response.data.user.nickname;
        const { balance, rank } = response.data;
        console.log('Account Info:');
        console.log(`Nickname: ${nickname}`);
        console.log(`Balance: ${balance}`);
        console.log(`Rank: ${rank}`);
        return { nickname, balance, rank };
    } catch (error) {
        console.error('Error fetching account info:', error.message);
        return null;
    }
}

async function createAndProcessWallet(walletNumber, totalWallets) {
    console.log(`Creating wallet ${walletNumber}/${totalWallets}...`);
    const walletData = await createWallet();
    if (!walletData) return null;

    console.log(`Wallet created - Address: ${walletData.address}, Username: ${walletData.username}`);

    await claimDailyReward(walletData.accessToken);
    await new Promise(resolve => setTimeout(resolve, 500));

    for (const [missionType, missionId] of Object.entries(imageMissions)) {
        await completeImageMission(walletData.accessToken, missionType, missionId);
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    for (const rewardId of missionRewardIds) {
        await claimMissionReward(walletData.accessToken, rewardId);
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    await getAccountInfo(walletData.accessToken);

    return walletData;
}

async function main(count) {
    const wallets = [];
    
    for (let i = 0; i < count; i++) {
        const walletData = await createAndProcessWallet(i + 1, count);
        if (walletData) {
            wallets.push(walletData);
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); 
    }

    fs.writeFileSync('wallet.json', JSON.stringify(wallets, null, 2));
    console.log(`Successfully created and processed ${wallets.length} wallets and saved to wallet.json`);
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('How many wallets do you want to create? ', async (answer) => {
    const count = parseInt(answer);
    if (isNaN(count) || count <= 0) {
        console.log('Please enter a valid number');
    } else {
        await main(count);
    }
    rl.close();
});