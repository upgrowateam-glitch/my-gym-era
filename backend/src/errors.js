/** An error whose message is safe to send to the app. */
export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
    this.expose = true;
  }
}

export const badRequest = (msg, code = 'bad_request') => new HttpError(400, msg, code);
export const unauthorized = (msg = 'Not signed in', code = 'unauthorized') => new HttpError(401, msg, code);
export const forbidden = (msg = 'You do not have access to this', code = 'forbidden') => new HttpError(403, msg, code);
export const notFound = (msg = 'Not found', code = 'not_found') => new HttpError(404, msg, code);
export const conflict = (msg, code = 'conflict') => new HttpError(409, msg, code);
