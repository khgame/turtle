import { Keccak } from "sha3";
import * as md5 from "md5";
import { ec } from "elliptic";

function getKeccakStr(msg: string, size: 224 | 256 | 384 | 512 = 256, encoding: BufferEncoding = "hex"){
    const hash = new Keccak(size);
    hash.update(msg);
    return hash.digest(encoding);
}

function getMd5(msg: string | Buffer | number[]) : string{
    return md5(msg);
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

export const Crypto = {
    getKeccakStr,
    getMd5,
    ecdsaValidate,
    ecdsaSign
};
