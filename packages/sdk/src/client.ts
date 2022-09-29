import axios, {
    AxiosRequestConfig,
    AxiosResponse,
    AxiosRequestHeaders,
    AxiosError,
} from "axios";
import createAuthRefreshInterceptor, {
    AxiosAuthRefreshRequestConfig,
} from "axios-auth-refresh";

import {
    Auth,
    Log,
    DraftResource,
    Config,
    CloudQuery,
    Storage,
} from "./services";

class RefineCloudException extends Error {
    status: number;
    statusText: string;
    constructor(message: string, status = 0, statusText = "") {
        super(message);
        this.name = "RefineCloudException";
        this.message = message;
        this.status = status;
        this.statusText = statusText;
    }
}

class Client {
    private baseUrl: string;
    private clientId: string;
    private clientSecret?: string;

    constructor(payload: {
        baseUrl: string;
        clientId: string;
        clientSecret?: string;
    }) {
        const { baseUrl, clientId, clientSecret } = payload;

        this.baseUrl = baseUrl;
        this.clientId = clientId;
        this.clientSecret = clientSecret;

        // refresh token
        const refreshAuthLogic = async () => {
            const refreshToken = this.getLocalStorage(
                "refine-sdk-refresh-token",
            );
            if (refreshToken) {
                return await axios.post(`${this.baseUrl}/auth/refresh-token`, {
                    applicationClientId: this.clientId,
                    refreshToken,
                });
            }

            return;
        };

        createAuthRefreshInterceptor(axios, refreshAuthLogic);

        // axios response interceptor
        axios.interceptors.response.use((response: AxiosResponse) => {
            const accessToken = response?.data?.accessToken;
            const refreshToken = response?.data?.refreshToken;

            if (response.status === 200 && accessToken && refreshToken) {
                this.setLocalStorage("refine-sdk-access-token", accessToken);
                this.setLocalStorage("refine-sdk-refresh-token", refreshToken);
            }

            return response;
        });

        // axios request interceptor
        axios.interceptors.request.use((config: AxiosRequestConfig) => {
            const accessToken = this.getLocalStorage("refine-sdk-access-token");

            if (config && config.headers && accessToken) {
                config.headers["Authorization"] = `Bearer ${accessToken}`;
            }

            return config;
        });
    }

    getBaseUrl(): string {
        return this.baseUrl;
    }

    getClientId(): string {
        return this.clientId;
    }

    getClientSecret(): string | undefined {
        return this.clientSecret;
    }

    getRefineCloudToken(): string | undefined {
        const key = `refine-cloud-token`;

        if (!this.isBrowser) {
            console.warn(`"${key}" is only available in browser`);
        }

        const token = window.localStorage.getItem(key);

        if (!token) {
            console.warn(`"${key}" is not set in localStorage`);
            return;
        }

        return token;
    }

    private isBrowser() {
        return typeof window !== "undefined";
    }

    setLocalStorage(key: string, value: string): void {
        if (this.isBrowser()) {
            return window.localStorage.setItem(key, value);
        }

        return;
    }

    getLocalStorage(key: string): void | string | null {
        if (this.isBrowser()) {
            return window.localStorage.getItem(key);
        }

        return;
    }

    get auth(): Auth {
        return new Auth(this);
    }

    get log(): Log {
        return new Log(this);
    }

    get draftResource(): DraftResource {
        return new DraftResource(this);
    }

    get config(): Config {
        return new Config(this);
    }

    get cloudQuery(): CloudQuery {
        return new CloudQuery(this);
    }

    get storage(): Storage {
        return new Storage(this);
    }

    async call<D>(payload: {
        method:
            | "get"
            | "delete"
            | "head"
            | "options"
            | "post"
            | "put"
            | "patch";
        url: string;
        params?: any;
        data?: any;
        skipAuthRefresh?: boolean;
        headers?: AxiosRequestHeaders;
    }): Promise<any> {
        const { params, method, url, skipAuthRefresh, headers, data } = payload;

        const config: AxiosAuthRefreshRequestConfig = {
            baseURL: this.baseUrl,
            method,
            url,
            params,
            data,
            skipAuthRefresh,
            headers,
        };

        return axios({
            ...config,
        })
            .then((response) => response.data)
            .catch((err: AxiosError) => {
                const { response } = err;

                throw new RefineCloudException(
                    response?.data?.message,
                    response?.status,
                    response?.statusText,
                );
            });
    }
}

export { Client, RefineCloudException };
