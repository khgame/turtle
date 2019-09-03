import { Keccak } from "sha3";
import { ec } from "elliptic";
import * as crypto from "crypto";

function getKeccakStr(msg: string, size: 224 | 256 | 384 | 512 = 256, encoding: BufferEncoding = "hex"){
    const hash = new Keccak(size);
    hash.update(msg);
    return hash.digest(encoding);
}

function getMd5(msg: string | Buffer) : string{
    const md5 = crypto.createHash("md5");
    return md5.update(msg).digest("hex");
}

const ecInstance = new ec("secp256k1");
function ecdsaValidate(pubKeyHex: string, data: string, signatureStr: string) : boolean {
    const pubKey = ecInstance.keyFromPublic(pubKeyHex, "hex");
    const word = getMd5(data);
    return pubKey.verify(word, signatureStr);
}

function ecdsaSign(privKeyHex: string, data: string) : boolean {
    const prvKey = ecInstance.keyFromPrivate(privKeyHex, "hex");
    const word = getMd5(data);
    return prvKey.sign(word).toDER("hex");
}

function dullSign(data: { [key: string]: any }, hash: string){
    const keys: any[] = Object.keys(data).filter(s => s !== "sign").sort();
    const signStr = keys.reduce((prev, k) =>
        prev + (data[k] !== undefined ? `&${k}=${typeof data[k] === "object" ? JSON.stringify(data[k]) : data[k]}` : "")
        , "").substr(1) + hash;
    const dist = (signStr).toLowerCase();
    return getMd5(dist);
}

export const Crypto = {
    getKeccakStr,
    getMd5,
    ecdsaValidate,
    ecdsaSign,
    dullSign
};
