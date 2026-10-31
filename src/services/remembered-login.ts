import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { normalizeSchoolLoginURL } from "../core/login.ts";

const NAME = "cx_login";
const MAX_AGE = 180 * 24 * 60 * 60;
const PURPOSE = Buffer.from("kexu-remembered-login-v1");
export type RememberedLogin = {
  loginUrl: string;
  username: string;
  password: string;
};

function key() {
  const secret = process.env.SCHOOL_SESSION_KEY ?? "";
  if (
    !/^[a-z\d_-]{43}$/i.test(secret) ||
    Buffer.from(secret, "base64url").length !== 32
  )
    throw new Error("服务端尚未配置安全的登录信息保存密钥");
  return Buffer.from(secret, "base64url");
}

export function readRememberedLogin(request: Request): RememberedLogin | null {
  try {
    const value = request.headers
      .get("cookie")
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${NAME}=`))
      ?.slice(NAME.length + 1);
    if (!value || value.length > 3000) return null;
    const bytes = Buffer.from(value, "base64url");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      bytes.subarray(0, 12),
    );
    decipher.setAAD(PURPOSE);
    decipher.setAuthTag(bytes.subarray(12, 28));
    const data = JSON.parse(
      Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString("utf8"),
    );
    if (
      typeof data.expires !== "number" ||
      data.expires <= Date.now() ||
      typeof data.username !== "string" ||
      !data.username.trim() ||
      data.username.length > 50 ||
      typeof data.password !== "string" ||
      !data.password ||
      data.password.length > 50
    )
      return null;
    return {
      loginUrl: normalizeSchoolLoginURL(data.loginUrl),
      username: data.username,
      password: data.password,
    };
  } catch {
    return null;
  }
}

export function setRememberedLogin(
  headers: Headers,
  login: RememberedLogin | null,
  request: Request,
) {
  let value = "";
  if (login) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key(), iv);
    cipher.setAAD(PURPOSE);
    const encrypted = Buffer.concat([
      cipher.update(
        JSON.stringify({ ...login, expires: Date.now() + MAX_AGE * 1000 }),
        "utf8",
      ),
      cipher.final(),
    ]);
    value = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
      "base64url",
    );
  }
  const secure =
    new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";
  headers.append(
    "Set-Cookie",
    `${NAME}=${value}; HttpOnly; SameSite=Strict; Path=/school; Max-Age=${login ? MAX_AGE : 0}${secure ? "; Secure" : ""}`,
  );
}
