import axios, {AxiosInstance} from "axios";
import {turtle} from "../turtle";
import {genMemCache} from "./memCache";

let cache = genMemCache();

export function createHttpClient(baseURL: string = "", timeout: number = 17000) {
    let client: AxiosInstance = cache.get(baseURL);
    if (!client) {
        client = axios.create({
            baseURL,
            timeout,
            responseType: "json",
            headers: {
                "svr_name": turtle.conf ? turtle.conf.name : undefined,
                "svr_id": turtle.conf ? turtle.conf.id : undefined,
                "Content-Type": "application/json",
            },
        });
        cache.set(baseURL, client, 600); // recreate every 10 min
    }
    return client;
}


let axiosInstance: AxiosInstance;
export const http = () => {
    if (!axiosInstance) {
        axiosInstance = createHttpClient();
        axiosInstance.interceptors.request.use((config) => {
            // console.log('$http', config)
            return config;
        }, (error) => {
            return Promise.reject(error);
        });
    }
    return axiosInstance;
};
