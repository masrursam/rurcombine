const axios = require('axios');
const ethers = require('ethers');
const fs = require('fs').promises;
const { HttpsProxyAgent } = require('https-proxy-agent'); 
const { SocksProxyAgent } = require('socks-proxy-agent'); 

class TapNodeBot {
    constructor() {
        this.baseURL = 'https://api-tapnodegame.inflectiv.ai/api';
        this.authBaseURL = 'https://accounts.inflectiv.ai/realms/inflectiv/protocol/openid-connect';
        this.walletsFile = 'wallets.json';
        this.proxies = [];
        this.referralCodes = [];
    }

    async loadProxies() {
        try {
            const data = await fs.readFile('proxies.txt', 'utf8');
            this.proxies = data.split('\n')
                .map(proxy => proxy.trim())
                .filter(proxy => proxy !== '');
            
            console.log(`= LOADED ${this.proxies.length} PROXIES =`);
            return this.proxies;
        } catch (error) {
            console.error('Error reading proxies file:', error.message);
            return [];
        }
    }

    async loadReferralCodes() {
        try {
            const data = await fs.readFile('code.txt', 'utf8');
            this.referralCodes = data.split('\n')
                .map(code => code.trim())
                .filter(code => code !== '');
            
            console.log(`= LOADED ${this.referralCodes.length} REFERRAL CODES =`);
            return this.referralCodes;
        } catch (error) {
            console.error('Error reading referral codes file:', error.message);
            return [];
        }
    }

    getProxyConfig(proxy) {
        let proxyUrl = proxy;
        let agent;

        if (proxyUrl.startsWith('socks4://') || proxyUrl.startsWith('socks5://')) {
            agent = new SocksProxyAgent(proxyUrl);
        } else {
            if (!proxyUrl.startsWith('http://') && !proxyUrl.startsWith('https://')) {
                const parts = proxyUrl.split(':');
                if (parts.length === 4) {
                    proxyUrl = `http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`;
                } else {
                    proxyUrl = `http://${proxyUrl}`;
                }
            }
            agent = new HttpsProxyAgent(proxyUrl);
        }

        return {
            httpsAgent: agent,
            httpAgent: agent
        };
    }

    async generateWallet() {
        const wallet = ethers.Wallet.createRandom();
        return {
            address: wallet.address,
            privateKey: wallet.privateKey
        };
    }

    async saveWallets(wallets) {
        try {
            await fs.writeFile(this.walletsFile, JSON.stringify(wallets, null, 2));
            console.log(`Wallets saved to ${this.walletsFile}`);
        } catch (error) {
            console.error('Error saving wallets:', error);
        }
    }

    async loadWallets() {
        try {
            const data = await fs.readFile(this.walletsFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return [];
        }
    }

    generateSignMessage(walletAddress) {
        return `tapnodegame.inflectiv.ai wants you to sign in with your Ethereum account:

URI: https://tapnodegame.inflectiv.ai
Issued At: ${new Date().toISOString()}`;
    }

    async signMessage(wallet, message) {
        return await wallet.signMessage(message);
    }

    async getKeycloakToken(wallet, signature, message, proxy) {
        const messageBase64 = Buffer.from(message).toString('base64');
        const tokenData = new URLSearchParams({
            client_id: 'tng-b384fb5d-28e0-47ba-9273-d7262aa911e0',
            grant_type: 'password',
            scope: 'openid email profile',
            authFlow: 'wallet',
            walletAddress: wallet.address,
            walletSignature: signature,
            walletMessage: messageBase64,
            walletBlockchain: 'eth',
            walletType: 'metaMask'
        });

        const config = {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        if (proxy) {
            Object.assign(config, this.getProxyConfig(proxy));
        }

        const response = await axios.post(
            `${this.authBaseURL}/token`, 
            tokenData.toString(),
            config
        );

        return response.data.access_token;
    }

    async registerUser(keycloakToken, wallet, referralCode, proxy) {
        const config = {
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (proxy) {
            Object.assign(config, this.getProxyConfig(proxy));
        }

        const response = await axios.post(
            `${this.baseURL}/auth/register`,
            {
                keycloakAccessToken: keycloakToken,
                refBy: referralCode, 
                username: wallet.address
            },
            config
        );

        return response.data;
    }

    async completeTasks(accessToken, proxy) {
        const taskIds = [
            'task_7', 
            '7BhNEc96WsnmuMNzmBxRkY', 
            '76jEJCJA39SbpVfP6ChZVr', 
            'cipc9RATyK7YuEiX8K9CSu', 
            '8bUM49oxix8BUsGFPHAqFo', 
            'eShDNGxXovy2mjXy3Gmc7Y', 
            'qrpuXu1XBkiqp3fX7WkJMZ'
        ];

        for (const taskId of taskIds) {
            try {
                const config = {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                };

                if (proxy) {
                    Object.assign(config, this.getProxyConfig(proxy));
                }

                await axios.post(
                    `${this.baseURL}/tasks/complete`,
                    { taskId },
                    config
                );
                console.log(`Task ${taskId} completed successfully`);
            } catch (error) {
                console.error(`Error completing task ${taskId}:`, error.response ? error.response.data : error.message);
            }
        }
    }

    async claimDailyReward(accessToken, proxy) {
        try {
            const config = {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            };

            if (proxy) {
                Object.assign(config, this.getProxyConfig(proxy));
            }

            await axios.post(
                `${this.baseURL}/game/claim-daily-reward`,
                {},
                config
            );
            console.log('Daily reward claimed successfully');
        } catch (error) {
            console.error('Error claiming daily reward:', error.response ? error.response.data : error.message);
        }
    }

    async performTaps(accessToken, proxy) {
        const tapSequence = [1, 1, 16];
        for (const taps of tapSequence) {
            try {
                const config = {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                };

                if (proxy) {
                    Object.assign(config, this.getProxyConfig(proxy));
                }

                await axios.post(
                    `${this.baseURL}/game/tap`,
                    { taps },
                    config
                );
                console.log(`Performed ${taps} taps successfully`);
            } catch (error) {
                console.error(`Error performing ${taps} taps:`, error.response ? error.response.data : error.message);
            }
        }
    }

    async processWallet(wallet, proxy, referralCode) {
        try {
            console.log(`\n===== PROCESSING WALLET: ${wallet.address.slice(0, 10)}... ${proxy ? `USING PROXY: ${proxy}` : ''} ${referralCode ? `USING REF CODE: ${referralCode}` : ''} =====`);
            
            const ethersWallet = new ethers.Wallet(wallet.privateKey);
            const walletMessage = this.generateSignMessage(wallet.address);
            const signature = await this.signMessage(ethersWallet, walletMessage);
            
            const keycloakToken = await this.getKeycloakToken(
                { address: wallet.address }, 
                signature, 
                walletMessage,
                proxy
            );

            const registrationResponse = await this.registerUser(keycloakToken, { address: wallet.address }, referralCode, proxy);
            console.log(`Wallet ${wallet.address} registered successfully`);

            await this.completeTasks(keycloakToken, proxy);
            await this.claimDailyReward(keycloakToken, proxy);
            await this.performTaps(keycloakToken, proxy);
        } catch (error) {
            console.error(`Error processing wallet ${wallet.address}:`, error.response ? error.response.data : error.message);
        }
    }

    async run(numberOfWallets) {
        console.log('=====================================');
        console.log(' Tap Node Inflectiv - Airdrop Insiders ');
        console.log('=====================================\n');

        const existingWallets = await this.loadWallets();
        const proxies = await this.loadProxies();
        const referralCodes = await this.loadReferralCodes();
        const newWallets = [];

        if (referralCodes.length === 0) {
            console.log('No referral codes found in code.txt. Please add at least one referral code.');
            return;
        }

        for (let i = 0; i < numberOfWallets; i++) {
            const wallet = await this.generateWallet();
            newWallets.push(wallet);
        }

        const allWallets = [...existingWallets, ...newWallets];
        await this.saveWallets(allWallets);

        for (let i = 0; i < newWallets.length; i++) {
            const proxy = proxies.length > 0 ? proxies[i % proxies.length] : null;
            const referralCode = referralCodes[i % referralCodes.length]; 
            await this.processWallet(newWallets[i], proxy, referralCode);
        }
    }
}

async function main() {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const bot = new TapNodeBot();

    readline.question('How many wallets do you want to create? ', async (numberOfWallets) => {
        await bot.run(parseInt(numberOfWallets));
        readline.close();
    });
}

main().catch(console.error);