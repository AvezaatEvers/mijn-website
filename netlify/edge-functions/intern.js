// Interne omgeving voor Koen en Daan: eigen inlog per persoon en een gedeelde takenlijst.
// Blijft ook na de lancering actief. De logica staat in ../intern-logica.js.
import { getStore } from "@netlify/blobs";
import { verwerk } from "../intern-logica.js";

export default async (request, context) =>
  verwerk(request, context.cookies, () => context.next(), () => getStore({ name: "intern", consistency: "strong" }), (k) => Netlify.env.get(k));

export const config = {
  // Ook de adressen zonder .html: Netlify serveert /voorstel als voorstel.html, dus die moeten ook achter de inlog
  path: ["/intern", "/intern/*", "/handtekening", "/handtekening.html", "/voorstel", "/voorstel.html"],
};
