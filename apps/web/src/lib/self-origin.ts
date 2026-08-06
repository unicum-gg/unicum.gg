/**
 * Origin to use when the server fetches its own pages.
 *
 * Always loopback, never `APP.URL`: the public hostname hairpins through the
 * CDN and does not reliably resolve from inside the container. `PORT` is set by
 * the host, 3000 is the Next default.
 */
export function selfOrigin(): string {
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
