const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const BASE_PATH = configuredBasePath === "/"
  ? ""
  : configuredBasePath.replace(/\/$/, "");

export function withBasePath(pathname: string) {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return BASE_PATH ? `${BASE_PATH}${path}` : path;
}
