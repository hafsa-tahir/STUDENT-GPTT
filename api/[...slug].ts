import handler from "./index";

export default function catchAllHandler(req: any, res: any) {
  return handler(req, res);
}
