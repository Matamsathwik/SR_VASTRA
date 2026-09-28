const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/";
const HIBP_USER_AGENT = "SR Vastra Billing Software/1.0";

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function isPasswordCompromised(
  password: string
): Promise<boolean> {
  const encoded = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-1", encoded);
  const hash = toHex(digest).toUpperCase();

  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const response = await fetch(
    HIBP_RANGE_URL + prefix,
    {
      headers: {
        "user-agent": HIBP_USER_AGENT,
        "Add-Padding": "true",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      "Unable to verify password security. Please try again."
    );
  }

  const text = await response.text();

  return text.split(/\r?\n/).some((line) => {
    const [returnedSuffix, countText] = line.trim().split(":");
    return (
      returnedSuffix?.toUpperCase() === suffix &&
      Number(countText) > 0
    );
  });
}

export function validatePasswordLength(password: string): void {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
}
