/**
 * Blowfish, enough of it to read a World of Tanks replay.
 *
 * Decryption only, ECB, no padding: the game encrypts a replay's packet stream
 * with a key shipped inside its own client, so nothing here is secret or
 * protects anything. It lives in `shared` because the one caller is a browser
 * reading a file the player chose, on their own machine, and the file never
 * leaves it.
 *
 * **The constants are the hexadecimal digits of pi**, which is what Blowfish
 * specifies, so they are written here as those digits rather than as a table
 * nobody can check: 18 words of P, then four S-boxes of 256, 1042 in all. They
 * were generated with Machin's formula and checked twice, on the first word
 * (243f6a88) and on the cipher's own published test vector: an all-zero key
 * and block give 4ef997456198dd78. `blowfishSelfTest` re-runs the second
 * check, so a transcription error cannot be silent.
 */

/** Pi's fractional part in hex: P[0..17] then S[0..3][0..255]. */
const PI_HEX =
  "243f6a8885a308d313198a2e03707344a4093822299f31d0082efa98ec4e6c89452821e638d0" +
  "1377be5466cf34e90c6cc0ac29b7c97c50dd3f84d5b5b54709179216d5d98979fb1bd1310ba6" +
  "98dfb5ac2ffd72dbd01adfb7b8e1afed6a267e96ba7c9045f12c7f9924a19947b3916cf70801" +
  "f2e2858efc16636920d871574e69a458fea3f4933d7e0d95748f728eb658718bcd5882154aee" +
  "7b54a41dc25a59b59c30d5392af26013c5d1b023286085f0ca417918b8db38ef8e79dcb0603a" +
  "180e6c9e0e8bb01e8a3ed71577c1bd314b2778af2fda55605c60e65525f3aa55ab9457489862" +
  "63e8144055ca396a2aab10b6b4cc5c341141e8cea15486af7c72e993b3ee1411636fbc2a2ba9" +
  "c55d741831f6ce5c3e169b87931eafd6ba336c24cf5c7a325381289586773b8f48986b4bb9af" +
  "c4bfe81b6628219361d809ccfb21a991487cac605dec8032ef845d5de98575b1dc262302eb65" +
  "1b8823893e81d396acc50f6d6ff383f442392e0b4482a484200469c8f04a9e1f9b5e21c66842" +
  "f6e96c9a670c9c61abd388f06a51a0d2d8542f68960fa728ab5133a36eef0b6c137a3be4ba3b" +
  "f0507efb2a98a1f1651d39af017666ca593e82430e888cee8619456f9fb47d84a5c33b8b5ebe" +
  "e06f75d885c12073401a449f56c16aa64ed3aa62363f77061bfedf72429b023d37d0d724d00a" +
  "1248db0fead349f1c09b075372c980991b7b25d479d8f6e8def7e3fe501ab6794c3b976ce0bd" +
  "04c006bac1a94fb6409f60c45e5c9ec2196a246368fb6faf3e6c53b51339b2eb3b52ec6f6dfc" +
  "511f9b30952ccc814544af5ebd09bee3d004de334afd660f2807192e4bb3c0cba85745c8740f" +
  "d20b5f39b9d3fbdb5579c0bd1a60320ad6a100c6402c7279679f25fefb1fa3cc8ea5e9f8db32" +
  "22f83c7516dffd616b152f501ec8ad0552ab323db5fafd23876053317b483e00df829e5c57bb" +
  "ca6f8ca01a87562edf1769dbd542a8f6287effc3ac6732c68c4f5573695b27b0bbca58c8e1ff" +
  "a35db8f011a010fa3d98fd2183b84afcb56c2dd1d35b9a53e479b6f84565d28e49bc4bfb9790" +
  "e1ddf2daa4cb7e3362fb1341cee4c6e8ef20cada36774c01d07e9efe2bf11fb495dbda4dae90" +
  "9198eaad8e716b93d5a0d08ed1d0afc725e08e3c5b2f8e7594b78ff6e2fbf2122b648888b812" +
  "900df01c4fad5ea0688fc31cd1cff191b3a8c1ad2f2f2218be0e1777ea752dfe8b021fa1e5a0" +
  "cc0fb56f74e818acf3d6ce89e299b4a84fe0fd13e0b77cc43b81d2ada8d9165fa26680957705" +
  "93cc7314211a1477e6ad206577b5fa86c75442f5fb9d35cfebcdaf0c7b3e89a0d6411bd3ae1e" +
  "7e4900250e2d2071b35e226800bb57b8e0af2464369bf009b91e5563911d59dfa6aa78c14389" +
  "d95a537f207d5ba202e5b9c5832603766295cfa911c819684e734a41b3472dca7b14a94a1b51" +
  "00529a532915d60f573fbc9bc6e42b60a47681e6740008ba6fb5571be91ff296ec6b2a0dd915" +
  "b6636521e7b9f9b6ff34052ec585566453b02d5da99f8fa108ba47996e85076a4b7a70e9b5b3" +
  "2944db75092ec4192623ad6ea6b049a7df7d9cee60b88fedb266ecaa8c71699a17ff5664526c" +
  "c2b19ee1193602a575094c29a0591340e4183a3e3f54989a5b429d656b8fe4d699f73fd6a1d2" +
  "9c07efe830f54d2d38e6f0255dc14cdd20868470eb266382e9c6021ecc5e09686b3f3ebaefc9" +
  "3c9718146b6a70a1687f358452a0e286b79c5305aa5007373e07841c7fdeae5c8e7d44ec5716" +
  "f2b8b03ada37f0500c0df01c1f040200b3ffae0cf51a3cb574b225837a58dc0921bdd19113f9" +
  "7ca92ff69432477322f547013ae5e58137c2dadcc8b576349af3dda7a94461460fd0030eecc8" +
  "c73ea4751e41e238cd993bea0e2f3280bba1183eb3314e548b384f6db9086f420d03f60a04bf" +
  "2cb8129024977c795679b072bcaf89afde9a771fd9930810b38bae12dccf3f2e5512721f2e6b" +
  "7124501adde69f84cd877a5847187408da17bc9f9abce94b7d8cec7aec3adb851dfa63094366" +
  "c464c3d2ef1c18473215d908dd433b3724c2ba1612a14d432a65c45150940002133ae4dd71df" +
  "f89e10314e5581ac77d65f11199b043556f1d7a3c76b3c11183b5924a509f28fe6ed97f1fbfa" +
  "9ebabf2c1e153c6e86e34570eae96fb1860e5e0a5a3e2ab3771fe71c4e3d06fa2965dcb999e7" +
  "1d0f803e89d65266c8252e4cc9789c10b36ac6150eba94e2ea78a5fc3c531e0a2df4f2f74ea7" +
  "361d2b3d1939260f19c279605223a708f71312b6ebadfe6eeac31f66e3bc4595a67bc883b17f" +
  "37d1018cff28c332ddefbe6c5aa56558218568ab9802eecea50fdb2f953b2aef7dad5b6e2f84" +
  "1521b62829076170ecdd4775619f151013cca830eb61bd960334fe1eaa0363cfb5735c904c70" +
  "a239d59e9e0bcbaade14eecc86bc60622ca79cab5cabb2f3846e648b1eaf19bdf0caa02369b9" +
  "655abb5040685a323c2ab4b3319ee9d5c021b8f79b540b19875fa09995f7997e623d7da8f837" +
  "889a97e32d7711ed935f166812810e358829c7e61fd696dedfa17858ba9957f584a51b227263" +
  "9b83c3ff1ac24696cdb30aeb532e30548fd948e46dbc312858ebf2ef34c6ffeafe28ed61ee7c" +
  "3c735d4a14d9e864b7e342105d14203e13e045eee2b6a3aaabeadb6c4f15facb4fd0c742f442" +
  "ef6abbb5654f3b1d41cd2105d81e799e86854dc7e44b476a3d816250cf62a1f25b8d2646fc88" +
  "83a0c1c7b6a37f1524c369cb749247848a0b5692b285095bbf00ad19489d1462b17423820e00" +
  "58428d2a0c55f5ea1dadf43e233f70613372f0928d937e41d65fecf16c223bdb7cde3759cbee" +
  "74604085f2a7ce77326ea607808419f8509ee8efd85561d99735a969a7aac50c06c25a04abfc" +
  "800bcadc9e447a2ec3453484fdd567050e1e9ec9db73dbd3105588cd675fda79e3674340c5c4" +
  "3465713e38d83d28f89ef16dff20153e21e78fb03d4ae6e39f2bdb83adf7e93d5a68948140f7" +
  "f64c261c94692934411520f77602d4f7bcf46b2ed4a20068d40824713320f46a43b7d4b75000" +
  "61af1e39f62e9724454614214f74bf8b88404d95fc1d96b591af70f4ddd366a02f45bfbc09ec" +
  "03bd97857fac6dd031cb850496eb27b355fd3941da2547e6abca0a9a28507825530429f40a2c" +
  "86dae9b66dfb68dc1462d7486900680ec0a427a18dee4f3ffea2e887ad8cb58ce0067af4d6b6" +
  "aace1e7cd3375fecce78a399406b2a4220fe9e35d9f385b9ee39d7ab3b124e8b1dc9faf74b6d" +
  "185626a36631eae397b23a6efa74dd5b43326841e7f7ca7820fbfb0af54ed8feb397454056ac" +
  "ba48952755533a3a20838d87fe6ba9b7d096954b55a867bca1159a58cca9296399e1db33a62a" +
  "4a563f3125f95ef47e1c9029317cfdf8e80204272f7080bb155c05282ce395c11548e4c66d22" +
  "48c1133fc70f86dc07f9c9ee41041f0f404779a45d886e17325f51ebd59bc0d1f2bcc18f4111" +
  "3564257b7834602a9c60dff8e8a31f636c1b0e12b4c202e1329eaf664fd1cad181156b2395e0" +
  "333e92e13b240b62eebeb92285b2a20ee6ba0d99de720c8c2da2f728d012784595b794fd647d" +
  "0862e7ccf5f05449a36f877d48fac39dfd27f33e8d1e0a476341992eff743a6f6eabf4f8fd37" +
  "a812dc60a1ebddf8991be14cdb6e6b0dc67b55106d672c372765d43bdcd0e804f1290dc7cc00" +
  "ffa3b5390f92690fed0b667b9ffbcedb7d9ca091cf0bd9155ea3bb132f88515bad247b9479bf" +
  "763bd6eb37392eb3cc1159798026e297f42e312d6842ada7c66a2b3b12754ccc782ef11c6a12" +
  "4237b79251e706a1bbe64bfb63501a6b101811caedfa3d25bdd8e2e1c3c9444216590a121386" +
  "d90cec6ed5abea2a64af674eda86a85fbebfe98864e4c3fe9dbc8057f0f7c08660787bf86003" +
  "604dd1fd8346f6381fb07745ae04d736fccc83426b33f01eab71b08041873c005e5f77a057be" +
  "bde8ae2455464299bf582e614e58f48ff2ddfda2f474ef388789bdc25366f9c3c8b38e74b475" +
  "f25546fcd9b97aeb26618b1ddf84846a0e79915f95e2466e598e20b457708cd55591c902de4c" +
  "b90bace1bb8205d011a862487574a99eb77f19b6e0a9dc09662d09a1c4324633e85a1f0209f0" +
  "be8c4a99a0251d6efe101ab93d1d0ba5a4dfa186f20f2868f169dcb7da83573906fea1e2ce9b" +
  "4fcd7f5250115e01a70683faa002b5c40de6d0279af88c27773f8641c3604c0661a806b5f017" +
  "7a28c0f586e0006058aa30dc7d6211e69ed72338ea6353c2dd94c2c21634bbcbee5690bcb6de" +
  "ebfc7da1ce591d766f05e4094b7c018839720a3d7c927c2486e3725f724d9db91ac15bb4d39e" +
  "b8fced54557808fca5b5d83d7cd34dad0fc41e50ef5eb161e6f8a28514d96c51133c6fd5c7e7" +
  "56e14ec4362abfceddc6c837d79a323492638212670efa8e406000e03a39ce37d3faf5cfabc2" +
  "77375ac52d1b5cb0679e4fa33742d382274099bc9bbed5118e9dbf0f7315d62d1c7ec700c47b" +
  "b78c1b6b21a19045b26eb1be6a366eb45748ab2fbc946e79c6a376d26549c2c8530ff8ee468d" +
  "de7dd5730a1d4cd04dc62939bbdba9ba4650ac9526e8be5ee304a1fad5f06a2d519a63ef8ce2" +
  "9a86ee22c089c2b843242ef6a51e03aa9cf2d0a483c061ba9be96a4d8fe51550ba645bd62826" +
  "a2f9a73a3ae14ba99586ef5562e9c72fefd3f752f7da3f046f6977fa0a5980e4a91587b08601" +
  "9b09e6ad3b3ee593e990fd5a9e34d7972cf0b7d9022b8b5196d5ac3a017da67dd1cf3ed67c7d" +
  "2d281f9f25cfadf2b89b5ad6b4725a88f54ce029ac71e019a5e647b0acfded93fa9be8d3c48d" +
  "283b57ccf8d5662979132e28785f0191ed756055f7960e44e3d35e8c15056dd488f46dba03a1" +
  "61250564f0bdc3eb9e153c9057a297271aeca93a072a1b3f6d9b1e6321f5f59c66fb26dcf319" +
  "7533d928b155fdf5035634828aba3cbb28517711c20ad9f8abcc5167ccad925f4de817513830" +
  "dc8e379d58629320f991ea7a90c2fb3e7bce5121ce64774fbe32a8b6e37ec3293d4648de5369" +
  "6413e680a2ae0810dd6db22469852dfd09072166b39a460a6445c0dd586cdecf1c20c8ae5bbe" +
  "f7dd1b588d40ccd2017f6bb4e3bbdda26a7e3a59ff453e350a44bcb4cdd572eacea8fa6484bb" +
  "8d6612aebf3c6f47d29be463542f5d9eaec2771bf64e6370740e0d8de75b1357f8721671af53" +
  "7d5d4040cb084eb4e2cc34d2466a0115af84e1b0042895983a1d06b89fb4ce6ea0486f3f3b82" +
  "3520ab82011a1d4b277227f8611560b1e7933fdcbb3a792b344525bda08839e151ce794b2f32" +
  "c9b7a01fbac9e01cc87ebcc7d1f6cf0111c3a1e8aac71a908749d44fbd9ad0dadecbd50ada38" +
  "0339c32ac69136678df9317ce0b12b4ff79e59b743f5bb3af2d519ff27d9459cbf97222c15e6" +
  "fc2a0f91fc719b941525fae59361ceb69cebc2a8645912baa8d1b6c1075ee3056a0c10d25065" +
  "cb03a442e0ec6e0e1698db3b4c98a0be3278e9649f1f9532e0d392dfd3a0342b8971f21e1b0a" +
  "74414ba3348cc5be7120c37632d8df359f8d9b992f2ee60b6f470fe3f11de54cda541edad891" +
  "ce6279cfcd3e7e6f1618b166fd2c1d05848fd2c5f6fb2299f523f357a632762393a8353156cc" +
  "cd02acf081625a75ebb56e16369788d273ccde96629281b949d04c50901b71c65614e6c6c7bd" +
  "327a140a45e1d006c3f27b9ac9aa53fd62a80f00bb25bfe235bdd2f671126905b2040222b6cb" +
  "cf7ccd769c2b53113ec01640e3d338abbd602547adf0ba38209cf746ce7677afa1c520756060" +
  "85cbfe4e8ae88dd87aaaf9b04cf9aa7e1948c25c02fb8a8c01c36ae4d6ebe1f990d4f869a65c" +
  "dea03f09252dc208e69fb74e6132ce77e25b578fdfe33ac372e6";

const WORDS = 18 + 4 * 256;

function piWords(): Uint32Array {
  const out = new Uint32Array(WORDS);
  for (let i = 0; i < WORDS; i += 1) {
    out[i] = Number.parseInt(PI_HEX.slice(i * 8, i * 8 + 8), 16);
  }
  return out;
}

const INITIAL = piWords();

export class Blowfish {
  private readonly p = new Uint32Array(18);
  private readonly s: Uint32Array[] = [
    new Uint32Array(256),
    new Uint32Array(256),
    new Uint32Array(256),
    new Uint32Array(256),
  ];

  constructor(key: Uint8Array) {
    if (key.length === 0) throw new Error("Blowfish needs a key");
    this.p.set(INITIAL.subarray(0, 18));
    for (let box = 0; box < 4; box += 1) {
      this.s[box].set(INITIAL.subarray(18 + box * 256, 18 + (box + 1) * 256));
    }
    let j = 0;
    for (let i = 0; i < 18; i += 1) {
      let word = 0;
      for (let k = 0; k < 4; k += 1) {
        word = ((word << 8) | key[j % key.length]) >>> 0;
        j += 1;
      }
      this.p[i] = (this.p[i] ^ word) >>> 0;
    }
    let left = 0;
    let right = 0;
    for (let i = 0; i < 18; i += 2) {
      [left, right] = this.encryptBlock(left, right);
      this.p[i] = left;
      this.p[i + 1] = right;
    }
    for (const box of this.s) {
      for (let i = 0; i < 256; i += 2) {
        [left, right] = this.encryptBlock(left, right);
        box[i] = left;
        box[i + 1] = right;
      }
    }
  }

  private f(x: number): number {
    const a = (x >>> 24) & 0xff;
    const b = (x >>> 16) & 0xff;
    const c = (x >>> 8) & 0xff;
    const d = x & 0xff;
    // An unsigned cast after every step: the additions are modulo 2^32 and
    // JavaScript's bitwise operators work on signed 32-bit, so one missing
    // cast turns a large word negative and quietly corrupts every block after
    // it. Nothing downstream would notice; the stream would simply fail to
    // inflate, a thousand bytes later.
    const sum = (this.s[0][a] + this.s[1][b]) >>> 0;
    return (((sum ^ this.s[2][c]) >>> 0) + this.s[3][d]) >>> 0;
  }

  private encryptBlock(left: number, right: number): [number, number] {
    let l = left >>> 0;
    let r = right >>> 0;
    for (let i = 0; i < 16; i += 1) {
      l = (l ^ this.p[i]) >>> 0;
      r = (r ^ this.f(l)) >>> 0;
      [l, r] = [r, l];
    }
    [l, r] = [r, l];
    r = (r ^ this.p[16]) >>> 0;
    l = (l ^ this.p[17]) >>> 0;
    return [l, r];
  }

  private decryptBlock(left: number, right: number): [number, number] {
    let l = left >>> 0;
    let r = right >>> 0;
    for (let i = 17; i > 1; i -= 1) {
      l = (l ^ this.p[i]) >>> 0;
      r = (r ^ this.f(l)) >>> 0;
      [l, r] = [r, l];
    }
    [l, r] = [r, l];
    r = (r ^ this.p[1]) >>> 0;
    l = (l ^ this.p[0]) >>> 0;
    return [l, r];
  }

  /** Decrypt whole 8-byte blocks, ECB. A short tail is carried through as is. */
  decryptEcb(data: Uint8Array): Uint8Array {
    const out = new Uint8Array(data.length);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const outView = new DataView(out.buffer);
    const whole = data.length - (data.length % 8);
    for (let offset = 0; offset < whole; offset += 8) {
      const [l, r] = this.decryptBlock(
        view.getUint32(offset, false),
        view.getUint32(offset + 4, false),
      );
      outView.setUint32(offset, l, false);
      outView.setUint32(offset + 4, r, false);
    }
    // The game pads the stream to a multiple of eight, so a tail means a
    // truncated file rather than something left to decrypt. Carried through
    // untouched; the caller trims to the compressed size anyway.
    out.set(data.subarray(whole), whole);
    return out;
  }
}

/**
 * The cipher against its own published test vector.
 *
 * An all-zero key turns the block 4ef997456198dd78 back into zeroes. Cheap,
 * and it is the only thing standing between a mistyped constant and a decoder
 * that produces plausible rubbish.
 */
export function blowfishSelfTest(): boolean {
  const cipher = new Blowfish(new Uint8Array(8));
  const known = Uint8Array.from([0x4e, 0xf9, 0x97, 0x45, 0x61, 0x98, 0xdd, 0x78]);
  return cipher.decryptEcb(known).every((byte) => byte === 0);
}
