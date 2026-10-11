// Interne omgeving voor Koen en Daan: eigen inlog per persoon en een gedeelde takenlijst.
// Blijft ook na de lancering actief. De logica staat in ../intern-logica.js.
import { getStore } from "@netlify/blobs";
import { verwerk } from "../intern-logica.js";

export default async (request, context) =>
  verwerk(request, context.cookies, () => context.next(), () => getStore({ name: "intern", consistency: "strong" }));

export const config = {
  path: ["/intern", "/intern/*", "/handtekening.html", "/voorstel.html"],
};
