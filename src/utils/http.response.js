// Helpers per response shape JSend-compliant (https://github.com/omniti-labs/jsend).
//   - 'success' → 2xx, payload in `data`
//   - 'fail'    → 4xx, contesto in `data`
//   - 'error'   → 5xx, messaggio in `message`
// Dual-emit `success: boolean` per retro-compat coi consumer FE.

function sendSuccess(res, statusCode, data) {
  const payload =
    data != null && typeof data === 'object' && typeof data.toJSON === 'function'
      ? data.toJSON()
      : data;
  return res.status(statusCode).json({ status: 'success', success: true, data: payload ?? null });
}

function sendFail(res, statusCode, data) {
  const payload = typeof data === 'string' ? { message: data } : data;
  return res.status(statusCode).json({
    status: 'fail',
    success: false,
    message: payload?.message,
    data: payload ?? null,
  });
}

function sendError(res, statusCode, message, extra) {
  return res.status(statusCode).json({
    status: 'error',
    success: false,
    message,
    ...(extra ? { data: extra } : {}),
  });
}

module.exports = { sendSuccess, sendFail, sendError };
