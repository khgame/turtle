import axios, {AxiosInstance} from "axios";
import {turtle} from "../turtle";

let axiosInstance: AxiosInstance;

export const http = () => {
    if (!axiosInstance) {
        axiosInstance = axios.create({
            baseURL: "",
            // headers: { 'X-Requested-With': 'XMLHttpRequest' },
            // withCredentials: true,
            responseType: "json", // default
            timeout: 30000,
            headers: {
                "svr_name":  turtle.conf.name,
                "svr_id":  turtle.conf.id,
                "Content-Type": "application/json",
            },
        });

        axiosInstance.interceptors.request.use((config) => {
            // console.log('$http', config)
            return config;
        }, (error) => {
            return Promise.reject(error);
        });
    }
    return axiosInstance;
};
