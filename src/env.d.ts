declare namespace App {
  interface Locals {
    /** The signed-in member, or null; read once per request, when first asked (src/middleware.ts). */
    member: () => Promise<import('./lib/auth').Member | null>;
  }
}
