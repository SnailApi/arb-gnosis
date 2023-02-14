import { readFileSync, writeFileSync } from "fs";
import ethers from "ethers";
import { queue } from "async";
import Web3 from "web3";
import * as dotenv from "dotenv";
dotenv.config();

import { GNOSIS_ABI } from "./abi.mjs";

const RPC = process.env.RPC;
const web3 = new Web3(RPC);
const GNOSIS_CONTRACT_ADDRESS = "0xa6b71e26c5e0845f74c812102ca7114b6a896ab2";
const GNOSIS_CONTRACT = new web3.eth.Contract(GNOSIS_ABI, GNOSIS_CONTRACT_ADDRESS);

const deploy_contract = async (item) => {
    const initializer = `0xb63e800d0000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000160000000000000000000000000f48f2b2d2a534e402487b3ee7c18c33aec0fe5e40000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000${
        item.address.split("0x")[1]
    }000000000000000000000000ba1c3aaefb7758cf460faec678f0b7c2aa5bd2510000000000000000000000000000000000000000000000000000000000000000`;

    const query = GNOSIS_CONTRACT.methods.createProxyWithNonce("0x3E5c63644E683549055b9Be8653de26E0B4CD36E", initializer, Date.now());
    const tx = {
        type: 2,
        from: item.address,
        to: GNOSIS_CONTRACT_ADDRESS,
        value: 0,
        data: query.encodeABI(),
    };
    tx.gas = await web3.eth.estimateGas(tx);

    const signed = await web3.eth.accounts.signTransaction(tx, item.private_key);
    await web3.eth.sendSignedTransaction(signed.rawTransaction);
};

(async () => {
    const WALLET_FILE = "wallets.json";

    const EXISTING_WALLETS = JSON.parse(readFileSync(WALLET_FILE, "utf-8"));

    const save_wallet_state = queue((_, cb) => {
        writeFileSync(WALLET_FILE, JSON.stringify(EXISTING_WALLETS));
        cb(null);
    }, 1);

    const IMPORT_KEYS = readFileSync("keys", "utf-8")
        .split("\n")
        .map((item) => item.toLocaleLowerCase());

    for (const private_key of IMPORT_KEYS) {
        if (private_key && JSON.stringify(EXISTING_WALLETS).indexOf(private_key) === -1) {
            const wallet = new ethers.Wallet(private_key);
            EXISTING_WALLETS.push({ private_key, address: wallet.address, contract_deployed: false });
        }
    }
    save_wallet_state.push("");

    for (let wallet of EXISTING_WALLETS) {
        if (!wallet.contract_deployed) {
            try {
                await deploy_contract(wallet);
                console.log(`::INFO ${wallet.address} DEPLOYED`);
                wallet.contract_deployed = true;
                save_wallet_state.push("");
            } catch (e) {
                console.log(`::ERROR ${wallet.address} NOT DEPLOYED: ${e.message}`);
            }
        }
    }
})();
