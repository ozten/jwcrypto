/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is trusted.js; substantial portions derived
 * from XAuth code originally produced by Meebo, Inc., and provided
 * under the Apache License, Version 2.0; see http://github.com/xauth/xauth
 *
 * Contributor(s):
 *     Ben Adida <benadida@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var libs = require("../libs/all"),
    exceptions = require("./exceptions"),
    jwk = require("../jwk");

var BigInteger = libs.BigInteger;

var HASH_ALGS = {
  "sha1": libs.hex_sha1,
  "sha256": function(message) {return libs.sjcl.codec.hex.fromBits(libs.sjcl.hash.sha256.hash(message));}
};

function doHash(hashAlg, message, modulus) {
  // updated for FIPS186-3, section 4.6, and integer/string conversion as per appendix c.2
  var raw_hash = HASH_ALGS[hashAlg](message);

  // not really taking the minlength of bitlength and hash output, because assuming
  // that the parameters we use match hash-output bitlength.

  // we don't actually need to do modulus here, because of the previous assumption
  return new libs.BigInteger(raw_hash, "16");
}

// pad with leading 0s a hex string
function hex_lpad(str, length) {
  while (str.length < length) {
    str = "0" + str;
  }
  return str;
}

// supported keysizes
// the Diffie-Hellman group is specified for each keysize
// this means we don't need to specify a parameter generation step.
var KEYSIZES = {
  // for testing only
  // 64 and 128 are the same, since DSA is fast anyways, so no 64 here
  // the following are based on the first FIPS186-3 test vectors for 1024/160 SHA-256
  // under the category A.2.3 Verifiable Canonical Generation of the Generator g
  128: {
    p: "ff600483db6abfc5b45eab78594b3533d550d9f1bf2a992a7a8daa6dc34f8045ad4e6e0c429d334eeeaaefd7e23d4810be00e4cc1492cba325ba81ff2d5a5b305a8d17eb3bf4a06a349d392e00d329744a5179380344e82a18c47933438f891e22aeef812d69c8f75e326cb70ea000c3f776dfdbd604638c2ef717fc26d02e17",
    q: "e21e04f911d1ed7991008ecaab3bf775984309c3",
    g: "c52a4a0ff3b7e61fdf1867ce84138369a6154f4afa92966e3c827e25cfa6cf508b90e5de419e1337e07a2e9e2a3cd5dea704d175f8ebf6af397d69e110b96afb17c7a03259329e4829b0d03bbc7896b15b4ade53e130858cc34d96269aa89041f409136c7242a38895c9d5bccad4f389af1d7a4bd1398bd072dffa896233397a",
    hashAlg: "sha1"
  },
  // the following are based on the first FIPS186-3 test vectors for 2048/256 SHA-256
  // under the category A.2.3 Verifiable Canonical Generation of the Generator g
  256: {
    p: "d6c4e5045697756c7a312d02c2289c25d40f9954261f7b5876214b6df109c738b76226b199bb7e33f8fc7ac1dcc316e1e7c78973951bfc6ff2e00cc987cd76fcfb0b8c0096b0b460fffac960ca4136c28f4bfb580de47cf7e7934c3985e3b3d943b77f06ef2af3ac3494fc3c6fc49810a63853862a02bb1c824a01b7fc688e4028527a58ad58c9d512922660db5d505bc263af293bc93bcd6d885a157579d7f52952236dd9d06a4fc3bc2247d21f1a70f5848eb0176513537c983f5a36737f01f82b44546e8e7f0fabc457e3de1d9c5dba96965b10a2a0580b0ad0f88179e10066107fb74314a07e6745863bc797b7002ebec0b000a98eb697414709ac17b401",
    q: "b1e370f6472c8754ccd75e99666ec8ef1fd748b748bbbc08503d82ce8055ab3b",
    g: "9a8269ab2e3b733a5242179d8f8ddb17ff93297d9eab00376db211a22b19c854dfa80166df2132cbc51fb224b0904abb22da2c7b7850f782124cb575b116f41ea7c4fc75b1d77525204cd7c23a15999004c23cdeb72359ee74e886a1dde7855ae05fe847447d0a68059002c3819a75dc7dcbb30e39efac36e07e2c404b7ca98b263b25fa314ba93c0625718bd489cea6d04ba4b0b7f156eeb4c56c44b50e4fb5bce9d7ae0d55b379225feb0214a04bed72f33e0664d290e7c840df3e2abb5e48189fa4e90646f1867db289c6560476799f7be8420a6dc01d078de437f280fff2d7ddf1248d56e1a54b933a41629d6c252983c58795105802d30d7bcd819cf6ef",
    hashAlg: "sha256"
  }
};

function getParams(keysize) {
  return KEYSIZES[parseInt(keysize)];
}

// turn the keysize params to bigints
for (keysize in KEYSIZES) {
  var the_params = getParams(keysize);
  the_params.p = new BigInteger(the_params.p, "16");
  the_params.q = new BigInteger(the_params.q, "16");
  the_params.g = new BigInteger(the_params.g, "16");

  // sizes
  the_params.q_bitlength = the_params.q.bitLength();
}


function _getKeySizeFromYBitlength(size) {
  for (keysize in KEYSIZES) {
    var keysize_nbits = KEYSIZES[keysize].p.bitLength();
    var diff = keysize_nbits - size;

    // extremely unlikely to be more than 30 bits smaller than p
    // 2^-30. FIXME: should we be more tolerant here.
    if (diff >= 0 && diff < 30) {
      return keysize;
    }
  }

  return null;
}

function randomNumberMod(q, rng) {
  // do a few more bits than q so we can wrap around with not too much bias
  // wow, turns out this was actually not far off from FIPS186-3, who knew?
  // FIPS186-3 says to generate 64 more bits than needed into "c", then to do:
  // result = (c mod (q-1)) + 1
  return new libs.BigInteger(q.bitLength() + 64, rng).mod(q.subtract(BigInteger.ONE)).add(BigInteger.ONE);
}

function serializeParamsToObject(keysize, obj) {
  // add other parameters, because we want these keys to be portable
  var params = getParams(keysize);
  obj.p = params.p.toString(16);
  obj.q = params.q.toString(16);
  obj.g = params.g.toString(16);
}

// this function will throw an exception if the parameters don't
// match what's expected in KEYSIZES
function keysizeFromObject(obj) {
  var p = new libs.BigInteger(obj.p, 16);
  var q = new libs.BigInteger(obj.q, 16);
  var g = new libs.BigInteger(obj.g, 16);

  var keysize = _getKeySizeFromYBitlength(p.bitLength());
  var params = getParams(keysize);

  // check!
  if (!p.equals(params.p))
    throw "bad p";

  if (!q.equals(params.q))
    throw "bad q";

  if (!g.equals(params.g))
    throw "bad g";

  return keysize;
}

var KeyPair = function() {
  this.algorithm = "DS";
};

KeyPair.prototype = new jwk.KeyPair();

KeyPair.prototype.generate = function(keysize, progressCB, doneCB) {
  var params = getParams(keysize);
  if (!params)
    throw new exceptions.KeySizeNotSupportedException(keysize.toString());
  
  this.keysize= keysize;

  // FIXME: should we have a more global rng?
  // FIXME++: more importantly, should we pass this in as a parameter? I think so XXX
  var rng = new libs.SecureRandom();
  
  // DSA key gen: random x modulo q
  var x = randomNumberMod(params.q, rng);

  // the secret key will compute y
  this.secretKey = new SecretKey(x, this.keysize);
  this.publicKey = new PublicKey(this.secretKey.y, this.keysize);
  
  this.publicKey.algorithm = this.secretKey.algorithm = this.algorithm;

  if (!progressCB)
    return this;
  else
    doneCB(this);
};

var PublicKey = function(y, keysize) {
  this.y = y;
  this.keysize = keysize;
};

PublicKey.prototype = new jwk.PublicKey();

PublicKey.prototype.verify = function(message, signature) {
  var params = getParams(this.keysize);

  // extract r and s
  var hexlength = params.q_bitlength / 4;
  if (signature.length != (hexlength * 2)) {
    console.log("problem with r/s combo");
    return false;
  }

  var r = new BigInteger(signature.substring(0, hexlength), 16),
      s = new BigInteger(signature.substring(hexlength, hexlength*2), 16);

  // check rangeconstraints
  if ((r.compareTo(libs.BigInteger.ZERO) < 0) || (r.compareTo(params.q) > 0)) {
    console.log("problem with r: " + r.toString(16));
    return false;
  }
  if ((s.compareTo(libs.BigInteger.ZERO) < 0) || (s.compareTo(params.q) > 0)) {
    console.log("problem with s");
    return false;
  }

  var w = s.modInverse(params.q);
  var u1 = doHash(params.hashAlg, message, params.q).multiply(w).mod(params.q);
  var u2 = r.multiply(w).mod(params.q);
  var v = params.g
    .modPow(u1,params.p)
    .multiply(this.y.modPow(u2,params.p)).mod(params.p)
    .mod(params.q);

  return v.equals(r);
};

PublicKey.prototype.serializeToObject = function(obj) {
  obj.y = this.y.toString(16);

  serializeParamsToObject(this.keysize, obj);
};

PublicKey.prototype.equals = function(other) {
  if (other == null)
    return false;
  
  return ((this.keysize == other.keysize) && (this.y.equals(other.y)));
};

PublicKey.prototype.deserializeFromObject = function(obj) {
  this.y = new libs.BigInteger(obj.y, 16);

  //this.keysize = _getKeySizeFromYBitlength(this.y.bitLength());
  this.keysize = keysizeFromObject(obj);
  return this;
};

function SecretKey(x, keysize, y) {
  this.x = x;

  var params = getParams(keysize);

  // compute y if need be
  if (!y && params)
    y = params.g.modPow(this.x, params.p);
  this.y = y;
  
  this.keysize = keysize;
};

SecretKey.prototype = new jwk.SecretKey();

SecretKey.prototype.sign = function(message, progressCB, doneCB) {
  var params = getParams(this.keysize);

  // see https://secure.wikimedia.org/wikipedia/en/wiki/Digital_Signature_Algorithm

  // only using single-letter vars here because that's how this is defined in the algorithm
  var rng = new libs.SecureRandom();  
  var k, r, s;

  // do this until r != 0 (very unlikely, but hey)
  while(true) {
    k = randomNumberMod(params.q, rng);
    r = params.g.modPow(k, params.p).mod(params.q);
    
    if (r.equals(libs.BigInteger.ZERO)) {
      console.log("oops r is zero");
      continue;
    }

    // the hash
    var bigint_hash = doHash(params.hashAlg, message, params.q);
    
    // compute H(m) + (x*r)
    var message_dep = bigint_hash.add(this.x.multiply(r).mod(params.q)).mod(params.q);
    
    // compute s
    s = k.modInverse(params.q).multiply(message_dep).mod(params.q);

    if (s.equals(libs.BigInteger.ZERO)) {
      console.log("oops s is zero");
      continue;
    }

    // r and s are non-zero, we can continue
    break;
  }

  // format the signature, it's r and s
  var hexlength = params.q_bitlength / 4;
  var signature = hex_lpad(r.toString(16), hexlength) + hex_lpad(s.toString(16), hexlength);

  if (!progressCB)
    return signature;
  else
    doneCB(signature);
};

SecretKey.prototype.serializeToObject = function(obj) {
  obj.x = this.x.toString(16);
  serializeParamsToObject(this.keysize, obj);
};

SecretKey.prototype.deserializeFromObject = function(obj) {
  this.x = new BigInteger(obj.x, 16);

  //this.keysize = obj.keysize;
  this.keysize = keysizeFromObject(obj);

  var params = getParams(keysize);
  
  // repetition, bad - FIXME
  this.y = params.g.modPow(this.x, params.p);

  return this;
};

// register this stuff 
jwk.KeyPair._register("DS", {
  KeyPair: KeyPair,
  PublicKey: PublicKey,
  SecretKey: SecretKey});

