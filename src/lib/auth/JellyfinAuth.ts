import axios from 'axios';
import { JellyfinAuthConfig } from './JellyfinAuthConfig'

export class JellyfinAuth {
    private serverUrl: string;
    private apiKey?: string;

    constructor(config: JellyfinAuthConfig) {
        this.serverUrl = config.serverUrl.replace(/\/$/, '');
        this.apiKey = config.apiKey;
    }

    /**
     * Authenticate user with username/password
     */
    async authenticateByName(username: string, password: string): Promise<{ userId: string; accessToken: string }> {
        const response = await axios.post(
            `${this.serverUrl}/Users/AuthenticateByName`,
            {
                Username: username,
                Pw: password
            },
            {
                headers: {
                    'X-Emby-Authorization': `MediaBrowser Client="AniFin", Device="Server", DeviceId="anifin-001", Version="1.0.0"`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            userId: response.data.User.Id,
            accessToken: response.data.AccessToken
        };
    }

    /**
     * Validate access token
     */
    async validateToken(accessToken: string): Promise<boolean> {
        try {
            const response = await axios.get(`${this.serverUrl}/System/Info`, {
                headers: {
                    'X-Emby-Token': accessToken
                }
            });
            return response.status === 200;
        } catch {
            return false;
        }
    }

    /**
     * Get user info
     */
    async getUserInfo(accessToken: string): Promise<any> {
        const response = await axios.get(`${this.serverUrl}/Users/Me`, {
            headers: {
                'X-Emby-Token': accessToken
            }
        });
        return response.data;
    }
}