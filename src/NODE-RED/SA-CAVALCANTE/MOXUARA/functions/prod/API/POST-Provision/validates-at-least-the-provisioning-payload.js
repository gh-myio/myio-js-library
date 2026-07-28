// valida minimamente e move pra params do postgres
if (!msg.payload || !Array.isArray(msg.payload.devices)) {
  msg.statusCode = 400;
  msg.payload = { error: 'missing devices[]' };
  return [null, msg]; // manda pro http response direto
}

msg.params = [msg.payload]; // $1 = o JSON inteiro

return [msg, null];
