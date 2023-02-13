const { Address } = require("../address");
const { GetKeyAtPath } = require("../utils/extendedKey");
const bitcoin = require('bitcoinjs-lib');
const constants = require("../constants");

class P2WSH extends Address {
  generateAddresses(
    bip32PrivKey,
    secondaryPubKey,
    network,
    i,
    derivationPath
  ) {
    let outputs = [];

    for (let chainCodeType of ["standard", "nonstandard"]) {
      // get addresses with both standard and non-standard chain codes

      let output;
      let primaryKey = GetKeyAtPath(
        bip32PrivKey,
        network,
        i,
        derivationPath,
        chainCodeType
      );

      let publicKeys = [
        primaryKey.publicKey,
        Buffer.from(secondaryPubKey, "hex"),
      ];

      let p2msOpts = {
        m: 2,
        pubkeys: publicKeys,
        network: network,
      };
      output = bitcoin.payments.p2wsh({
        redeem: bitcoin.payments.p2ms(p2msOpts),
      });

      outputs.push({
        payment: output,
        addrType: constants.P2WSH,
        primaryKey: primaryKey,
      });
    }

    if (
      outputs[0].primaryKey.publicKey.toString("hex") ===
      outputs[1].primaryKey.publicKey.toString("hex")
    ) {
      // remove duplicate if standard and non-standard derivations match
      outputs.shift();
    }

    return outputs;
  }
  async prepareAddressData(generatedAddress, i, provider, network) {
    
    const payment = generatedAddress.payment;
    const address = payment.address;
    console.log("type=P2WSH address=" + address);

    // prepare the object
    const addressData = {};
    addressData.address_type = constants.P2WSH;
    addressData.i = i;
    addressData.primaryKey = generatedAddress.primaryKey;
    addressData.tx = [];

    // get the unspent transactions for the derived address
    const addrUtxo = await provider.getUtxo(address);

    let x;

    for (x of addrUtxo) {
      const unspentObj = {};
      unspentObj.hash = x.hash;
      unspentObj.index = x.output;
      unspentObj.value = x.value;

      unspentObj.witnessUtxo = {
        script: Buffer.from(this.toOutputScript(address, network), "hex"),
        value: x.value,
      };
      unspentObj.witnessScript = payment.redeem.output;

      addressData.tx.push(unspentObj);
    }

    if (!addressData.tx.length) {
      // no unspent transactions found, so just discard this address
      return null;
    }
    return { address, addressData };
  }
}

module.exports = P2WSH