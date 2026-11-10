/**
 * YALNIZCA TEST: gerçek kriptografi üreten yazılım WebAuthn doğrulayıcısı (F4.2).
 *
 * Gerçek bir telefonun platform doğrulayıcısının yaptığını yapar: P-256 anahtar çifti üretir, `none`
 * attestation ile kayıt yanıtı ve ES256 imzalı yoklama (assertion) yanıtı oluşturur. Sunucu bu yanıtları
 * `@simplewebauthn/server` ile, üretimdeki gibi doğrular. Hata senaryoları için imza bozma, kullanıcı
 * doğrulaması (UV) olmadan imza, yanlış köken ve sayacı geri alma seçenekleri vardır.
 */
import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from "node:crypto";

// --- Minimal CBOR kodlayıcı (yalnızca burada gereken türler) ---------------------------------
type Cbor = number | string | Uint8Array | Map<Cbor, Cbor> | { [k: string]: Cbor };

function head(major: number, n: number): Buffer {
  if (n < 24) return Buffer.from([(major << 5) | n]);
  if (n < 0x100) return Buffer.from([(major << 5) | 24, n]);
  if (n < 0x10000) return Buffer.from([(major << 5) | 25, n >> 8, n & 0xff]);
  const b = Buffer.alloc(5);
  b[0] = (major << 5) | 26;
  b.writeUInt32BE(n, 1);
  return b;
}

function cbor(value: Cbor): Buffer {
  if (typeof value === "number") return value >= 0 ? head(0, value) : head(1, -1 - value);
  if (typeof value === "string") {
    const bytes = Buffer.from(value, "utf8");
    return Buffer.concat([head(3, bytes.length), bytes]);
  }
  if (value instanceof Uint8Array) return Buffer.concat([head(2, value.length), Buffer.from(value)]);
  const entries = value instanceof Map ? [...value.entries()] : Object.entries(value);
  return Buffer.concat([head(5, entries.length), ...entries.flatMap(([k, v]) => [cbor(k), cbor(v)])]);
}

// --- Doğrulayıcı -----------------------------------------------------------------------------
const FLAG_UP = 0x01;
const FLAG_UV = 0x04;
const FLAG_AT = 0x40;

const b64url = (b: Buffer | Uint8Array) => Buffer.from(b).toString("base64url");
const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest();

export interface SoftAuthenticatorOptions {
  rpId?: string;
  origin?: string;
}

export interface AssertOverrides {
  /** Kullanıcı doğrulaması (biyometrik/PIN) bayrağı olmadan imzala. */
  withoutUserVerification?: boolean;
  /** İmzayı boz (geçersiz imza). */
  tamperSignature?: boolean;
  /** Farklı bir sitede üretilmiş gibi (oltalama). */
  origin?: string;
  /** Sayacı bu değere ayarla (geri alma = kopyalanmış doğrulayıcı). */
  counter?: number;
}

export class SoftAuthenticator {
  readonly credentialId = randomBytes(16);
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;
  counter = 0;
  private readonly rpId: string;
  private readonly origin: string;

  constructor({ rpId = "localhost", origin = "http://localhost:3100" }: SoftAuthenticatorOptions = {}) {
    const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });
    this.privateKey = pair.privateKey;
    this.publicKey = pair.publicKey;
    this.rpId = rpId;
    this.origin = origin;
  }

  private cosePublicKey(): Buffer {
    const jwk = this.publicKey.export({ format: "jwk" }) as { x: string; y: string };
    return cbor(
      new Map<Cbor, Cbor>([
        [1, 2], // kty: EC2
        [3, -7], // alg: ES256
        [-1, 1], // crv: P-256
        [-2, Buffer.from(jwk.x, "base64url")],
        [-3, Buffer.from(jwk.y, "base64url")],
      ])
    );
  }

  private authData(flags: number, counter: number, attested?: Buffer): Buffer {
    const c = Buffer.alloc(4);
    c.writeUInt32BE(counter);
    return Buffer.concat([sha256(this.rpId), Buffer.from([flags]), c, ...(attested ? [attested] : [])]);
  }

  private clientData(type: "webauthn.create" | "webauthn.get", challenge: string, origin = this.origin) {
    return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  }

  /** `navigator.credentials.create` karşılığı. */
  register(
    options: { challenge: string },
    overrides: Pick<AssertOverrides, "withoutUserVerification" | "origin"> = {}
  ) {
    const credIdLen = Buffer.alloc(2);
    credIdLen.writeUInt16BE(this.credentialId.length);
    const attested = Buffer.concat([Buffer.alloc(16), credIdLen, this.credentialId, this.cosePublicKey()]);
    const flags = FLAG_UP | FLAG_AT | (overrides.withoutUserVerification ? 0 : FLAG_UV);
    const authData = this.authData(flags, this.counter, attested);
    const attestationObject = cbor({ fmt: "none", attStmt: {}, authData });
    return {
      id: b64url(this.credentialId),
      rawId: b64url(this.credentialId),
      type: "public-key" as const,
      clientExtensionResults: {},
      authenticatorAttachment: "platform" as const,
      response: {
        clientDataJSON: b64url(this.clientData("webauthn.create", options.challenge, overrides.origin)),
        attestationObject: b64url(attestationObject),
        transports: ["internal"],
      },
    };
  }

  /** `navigator.credentials.get` karşılığı. Her çağrı sayacı artırır (gerçek doğrulayıcı gibi). */
  assert(options: { challenge: string }, overrides: AssertOverrides = {}) {
    this.counter = overrides.counter ?? this.counter + 1;
    const flags = FLAG_UP | (overrides.withoutUserVerification ? 0 : FLAG_UV);
    const authData = this.authData(flags, this.counter);
    const clientDataJSON = this.clientData("webauthn.get", options.challenge, overrides.origin);
    let signature = sign("sha256", Buffer.concat([authData, sha256(clientDataJSON)]), this.privateKey);
    if (overrides.tamperSignature) {
      signature = Buffer.from(signature);
      signature[signature.length - 1] ^= 0xff;
    }
    return {
      id: b64url(this.credentialId),
      rawId: b64url(this.credentialId),
      type: "public-key" as const,
      clientExtensionResults: {},
      authenticatorAttachment: "platform" as const,
      response: {
        clientDataJSON: b64url(clientDataJSON),
        authenticatorData: b64url(authData),
        signature: b64url(signature),
      },
    };
  }
}
