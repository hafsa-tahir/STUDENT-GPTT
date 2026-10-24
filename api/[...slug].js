import handler from "./index.js";

export default function catchAllHandler(req, res) {
  return handler(req, res);
}
